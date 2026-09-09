#!/usr/bin/env node

import {
  loadConfig,
  loadDictionary,
  loadInsightRuns,
  loadSnapshotContext,
  readJson,
  ontologySchemaPath,
  taxonomyPath
} from "../lib/paths.mjs";
import {
  dictionaryEvidenceStatus,
  dictionaryPublicationGate,
  validateDictionaryEntry,
  validateDictionaryCommitLedger,
  validateDictionaryRevisionChain
} from "../lib/dictionary.mjs";
import {
  validateInsightRunCommitLedger,
  validateStoredInsightRun
} from "../lib/insight-runs.mjs";
import { catalogFingerprint } from "../lib/index.mjs";
import {
  taxonomyHash as computeTaxonomyHash,
  validateSnapshotBundle
} from "../lib/integrity.mjs";
import { sourceAllowedHosts } from "../lib/collector.mjs";
import { assertAllowedUrl } from "../lib/http.mjs";
import { loadBoundPublicData } from "../lib/public-data.mjs";
import {
  validateWorkRelations
} from "../lib/work-identity.mjs";

const failures = [];
const checks = [];
const check = (condition, message) => {
  if (condition) {
    checks.push(message);
  } else {
    failures.push(message);
  }
};

const [
  config,
  snapshot,
  ontologySchema,
  taxonomy
] =
  await Promise.all([
    loadConfig(),
    loadSnapshotContext(),
    readJson(ontologySchemaPath),
    readJson(taxonomyPath)
  ]);
if (!snapshot) {
  throw new Error("Committed snapshot.json is required");
}
const publicSnapshot = snapshot.visibility === "public";
const boundPublicData = publicSnapshot
  ? await loadBoundPublicData(snapshot)
  : null;
const [dictionary, insightRuns] = publicSnapshot
  ? [
      boundPublicData.dictionary,
      boundPublicData.insightRuns
    ]
  : await Promise.all([
      loadDictionary(),
      loadInsightRuns()
    ]);
const catalog = snapshot.catalog;
const index = snapshot.searchIndex;

const sourceIds = config.sources.map((source) => source.id);
const sourceById = new Map(
  config.sources.map((source) => [source.id, source])
);
const partitions = config.sources.map(
  (source) => snapshot.partitions[source.id]
);
check(
  new Set(sourceIds).size === sourceIds.length,
  "source ids are unique"
);
check(
  config.sources.every(
    (source) =>
      source.policy.authority === "official-primary" &&
      source.policy.storesFullText === false
  ),
  "all ingested sources are official-primary and metadata-only"
);
try {
  for (const source of config.sources) {
    validateWorkRelations(source);
  }
  checks.push(
    "curated work/translation relations are unique and confined to official article boundaries"
  );
} catch (error) {
  failures.push(
    `work relation configuration: ${error.message}`
  );
}
check(
  config.discoveryReferences.every((reference) => reference.ingest === false),
  "discovery references are not ingested"
);
check(
  config.discoveryReferences.some(
    (reference) => reference.id === "velopers" && reference.ingest === false
  ),
  "Velopers remains a non-ingested discovery reference"
);
check(
  ontologySchema.properties?.dictionaryEntries,
  "ontology schema declares Dictionary entries"
);
check(
  ontologySchema.properties?.problemTypes,
  "ontology schema uses the runtime problemTypes vocabulary"
);
check(
  ontologySchema.properties?.insightRuns,
  "ontology schema declares InsightRun receipts"
);
try {
  validateSnapshotBundle(snapshot, config, taxonomy);
  checks.push(
    "snapshot identity, config/taxonomy hashes, partitions, and derived catalog are valid"
  );
} catch (error) {
  failures.push(`snapshot integrity: ${error.message}`);
}

const articleIds = catalog.articles.map((article) => article.articleId);
check(
  new Set(articleIds).size === articleIds.length,
  "article ids are unique"
);
check(
  catalog.articles.every(
    (article) =>
      sourceIds.includes(article.sourceId) &&
      article.companyId &&
      article.canonicalUrl &&
      article.contentHash &&
      !Object.hasOwn(article, "fullText") &&
      article.storagePolicy?.storesFullText === false
  ),
  "catalog articles retain source provenance and no full body"
);
check(
  catalog.articles.every((article) => {
    try {
      assertAllowedUrl(
        article.canonicalUrl,
        sourceAllowedHosts(sourceById.get(article.sourceId))
      );
      return true;
    } catch {
      return false;
    }
  }),
  "catalog URLs stay inside each source HTTPS host allowlist"
);
check(
  index.catalogHash === catalogFingerprint(catalog.articles),
  "search index fingerprint matches catalog"
);
check(
  catalog.view === "derived-from-source-partitions",
  "catalog is declared as a derived partition view"
);
check(
  partitions.every(
    (partition) =>
      partition.sourceId &&
      partition.articles.every(
        (article) => article.sourceId === partition.sourceId
      )
  ),
  "physical source partitions contain only their publisher records"
);
const catalogIdSet = new Set(articleIds);
const partitionArticleIds = partitions.flatMap((partition) =>
  partition.articles.map((article) => article.articleId)
);
check(
  partitionArticleIds.length === catalog.articles.length &&
    new Set(partitionArticleIds).size ===
      partitionArticleIds.length &&
    partitionArticleIds.every((articleId) =>
      catalogIdSet.has(articleId)
    ) &&
    [...catalogIdSet].every((articleId) =>
      partitionArticleIds.includes(articleId)
    ),
  "derived catalog is the exact union of physical source partitions"
);
check(
  !catalog.snapshotId ||
    partitions.every(
      (partition) =>
        !partition.snapshotId ||
        partition.snapshotId === catalog.snapshotId
    ),
  "catalog and source partitions share one committed snapshot id"
);
check(
  catalog.articles.every(
    (article) => String(article.summary ?? "").length <= 600
  ),
  "persisted publisher excerpts are capped at 600 characters"
);

for (const entry of dictionary.entries) {
  try {
    validateDictionaryEntry(
      entry,
      catalog,
      taxonomy,
      {
        allowPublicReviewProjection: publicSnapshot
      }
    );
    if (publicSnapshot) {
      const publicationGate =
        dictionaryPublicationGate(entry);
      if (!publicationGate.passed) {
        throw new Error(
          `public entry failed publication gate: ${publicationGate.reasons.join(", ")}`
        );
      }
    } else {
      validateDictionaryRevisionChain(
        entry,
        dictionary,
        catalog,
        taxonomy
      );
    }
    const evidenceStatus = dictionaryEvidenceStatus(
      entry,
      catalog,
      computeTaxonomyHash(taxonomy)
    );
    if (
      ["reviewed", "verified"].includes(entry.status) &&
      evidenceStatus.status !== "current"
    ) {
      throw new Error(
        `reviewed evidence is ${evidenceStatus.status}`
      );
    }
    checks.push(`Dictionary entry ${entry.entryId} is valid`);
  } catch (error) {
    failures.push(`Dictionary entry ${entry.entryId}: ${error.message}`);
  }
}
if (publicSnapshot) {
  check(
    dictionary.schemaVersion === 2 &&
      dictionary.revision === dictionary.entries.length &&
      Array.isArray(dictionary.revisions) &&
      dictionary.revisions.length === 0 &&
      Object.keys(dictionary.idempotency ?? {}).length === 0,
    "public Dictionary projection contains current entries only and no local revision or idempotency history"
  );
} else {
  check(
    dictionary.schemaVersion === 2 &&
      Number.isInteger(dictionary.revision) &&
      Array.isArray(dictionary.revisions) &&
      dictionary.revisions.length >=
        dictionary.entries.length,
    "Dictionary v2 retains immutable revision history"
  );
  check(
    Object.entries(dictionary.idempotency ?? {}).every(
      ([key, receipt]) =>
        key &&
        /^[a-f0-9]{64}$/u.test(
          String(receipt.inputHash ?? "")
        ) &&
        receipt.requestHash &&
        receipt.entryId &&
        receipt.revisionId
    ),
    "Dictionary idempotency receipts are structurally valid"
  );
  try {
    validateDictionaryCommitLedger(dictionary);
    checks.push(
      "Dictionary global commit ledger is contiguous, unique, owned, and monotonic"
    );
  } catch (error) {
    failures.push(
      `Dictionary global commit ledger: ${error.message}`
    );
  }
}
const insightRunIds = new Set();
const insightRunRequestHashes = new Set();
try {
  validateInsightRunCommitLedger(insightRuns);
  checks.push(
    "InsightRun global commit ledger is contiguous, unique, and owned"
  );
} catch (error) {
  failures.push(
    `InsightRun global commit ledger: ${error.message}`
  );
}
for (const run of insightRuns.runs ?? []) {
  try {
    validateStoredInsightRun(run, {
      catalog,
      config,
      dictionary,
      taxonomy
    });
    if (
      insightRunIds.has(run.runId) ||
      insightRunRequestHashes.has(run.requestHash)
    ) {
      throw new Error(
        "duplicate runId or requestHash"
      );
    }
    insightRunIds.add(run.runId);
    insightRunRequestHashes.add(run.requestHash);
    checks.push(
      `InsightRun ${run.runId} immutable receipt is valid`
    );
  } catch (error) {
    failures.push(
      `InsightRun ${run.runId ?? "unknown"}: ${error.message}`
    );
  }
}
const insightReceipts = Object.entries(
  insightRuns.idempotency ?? {}
);
check(
  insightReceipts.every(
    ([key, receipt]) => {
      const run = (insightRuns.runs ?? []).find(
        (candidate) =>
          candidate.runId === receipt.runId
      );
      return (
        key &&
        run &&
        /^[a-f0-9]{64}$/u.test(
          String(receipt.inputHash ?? "")
        ) &&
        receipt.requestHash === run.requestHash &&
        Number.isSafeInteger(
          receipt.committedRevision
        ) &&
        receipt.committedRevision >=
          run.committedRevision &&
        receipt.committedRevision <=
          Number(insightRuns.revision)
      );
    }
  ),
  "InsightRun idempotency receipts resolve to one immutable run"
);
check(
  Number.isSafeInteger(insightRuns.revision) &&
    Number(insightRuns.revision) ===
      Math.max(
        0,
        ...insightReceipts.map(
          ([, receipt]) =>
            Number(receipt.committedRevision) || 0
        )
      ),
  "InsightRun ledger revision equals its terminal committed receipt"
);

const result = {
  status: failures.length ? "failed" : "ok",
  checksPassed: checks.length,
  checks,
  failures,
  counts: {
    sources: config.sources.length,
    articles: catalog.articles.length,
    indexedDocuments: index.documentCount,
    dictionaryEntries: dictionary.entries.length,
    dictionaryRevisions:
      dictionary.revisions?.length ?? 0,
    insightRuns: insightRuns.runs?.length ?? 0
  }
};

console.log(JSON.stringify(result, null, 2));
if (failures.length) {
  process.exitCode = 1;
}
