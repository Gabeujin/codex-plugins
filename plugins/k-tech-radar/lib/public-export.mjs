import { access, mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import {
  assertCurrentDictionaryRevision,
  assertDictionaryRevisionCommit,
  dictionaryCanonicalClaimHash,
  dictionaryEntryHistory,
  dictionaryEvidenceStatus,
  dictionaryPayloadHash,
  dictionaryPublicationGate,
  validateDictionaryEntry
} from "./dictionary.mjs";
import {
  buildSnapshotIdentity,
  catalogFingerprint,
  completeSourceStateRecord,
  configurationHash,
  partitionFingerprint,
  publisherContentTrust,
  stableJson,
  taxonomyHash,
  validateSnapshotBundle
} from "./integrity.mjs";
import { buildSearchIndex } from "./index.mjs";
import { readJson, writeJson } from "./paths.mjs";
import {
  buildPublicDataCommitment,
  publicDictionaryRevisionPins,
  validatePublicDataObjects
} from "./public-data.mjs";
import {
  projectPublicReviewEvidenceRefs,
  PUBLIC_REVIEW_EVIDENCE_MODE
} from "./review-evidence.mjs";
import { sha256 } from "./text.mjs";

function clone(value) {
  return structuredClone(value);
}

function boundedExcerpt(value) {
  return String(value ?? "").trim().slice(0, 600);
}

function sanitizedRevision(revision) {
  return {
    revisionHash:
      revision.revisionHash ?? revision.contentHash ?? null,
    contentHash: revision.contentHash ?? null,
    ontologyHash: revision.ontologyHash ?? null,
    publisherUpdatedAt: revision.publisherUpdatedAt ?? null,
    firstSeenAt: revision.firstSeenAt ?? null,
    lastSeenAt: revision.lastSeenAt ?? null,
    lastChangedAt: revision.lastChangedAt ?? null
  };
}

function sanitizedArticle(
  article,
  { includePublisherExcerpts }
) {
  return {
    articleId: article.articleId,
    sourceId: article.sourceId,
    companyId: article.companyId,
    companyName: article.companyName,
    sourceName: article.sourceName,
    sourceHomepage: article.sourceHomepage,
    language: article.language,
    evidenceAuthority: article.evidenceAuthority,
    storagePolicy: {
      storesFullText: false,
      contentFetch: "on-demand-excerpt",
      publicSnapshot: includePublisherExcerpts
        ? "bounded-rights-confirmed"
        : "metadata-only"
    },
    businessUnitId: article.businessUnitId,
    canonicalUrl: article.canonicalUrl,
    canonicalWorkId: article.canonicalWorkId ?? null,
    translationOf: article.translationOf ?? null,
    workIdentityBasis:
      article.workIdentityBasis ?? "derived-metadata",
    workIndependenceStatus:
      article.translationOf
        ? "related-copy"
        : article.workIndependenceStatus ??
          "review-required",
    title: String(article.title ?? "").trim(),
    summary: includePublisherExcerpts
      ? boundedExcerpt(article.summary)
      : "",
    publishedAt: article.publishedAt ?? null,
    publisherUpdatedAt: article.publisherUpdatedAt ?? null,
    authors: clone(article.authors ?? []),
    tags: clone(article.tags ?? []),
    rawPublisherTags: clone(article.rawPublisherTags ?? []),
    namespacedTags: clone(article.namespacedTags ?? []),
    domainIds: clone(article.domainIds ?? []),
    problemTypeIds: clone(article.problemTypeIds ?? []),
    metadataState: article.metadataState ?? "metadata-only",
    contentHash: article.contentHash,
    ontologyHash: article.ontologyHash,
    revisionHash:
      article.revisionHash ?? article.contentHash,
    recordStatus: article.recordStatus ?? "active",
    fetchedAt: article.fetchedAt ?? null,
    revisions: (article.revisions ?? []).map(
      sanitizedRevision
    ),
    firstSeenAt: article.firstSeenAt ?? null,
    lastSeenAt: article.lastSeenAt ?? null,
    lastChangedAt: article.lastChangedAt ?? null,
    taxonomyHash: article.taxonomyHash ?? null
  };
}

function sanitizedSourceState(sourceState, config) {
  return {
    schemaVersion: 2,
    updatedAt: sourceState.updatedAt ?? null,
    collectionStatus:
      sourceState.collectionStatus ?? "unknown",
    snapshotId: null,
    sources: Object.fromEntries(
      config.sources.map((source) => {
        const state = sourceState.sources?.[source.id] ?? {};
        return [
          source.id,
          completeSourceStateRecord({
            status: state.status ?? "never-checked",
            lastCheckedAt: state.lastCheckedAt ?? null,
            lastAttemptAt: state.lastAttemptAt ?? null,
            lastSuccessAt: state.lastSuccessAt ?? null,
            dataAsOf: state.dataAsOf ?? null,
            articleCountSeen:
              Number.isInteger(state.articleCountSeen)
                ? state.articleCountSeen
                : null,
            endpoint: null,
            etag: null,
            lastModified: null,
            durationMs: null,
            error: null,
            errorCode: state.errorCode ?? null,
            warningCount:
              Number.isInteger(state.warningCount)
                ? state.warningCount
                : null
          })
        ];
      })
    )
  };
}

function publicDictionary(
  dictionary,
  catalog,
  taxonomy,
  currentTaxonomyHash,
  timestamp
) {
  const entries = [];
  for (const entry of dictionary.entries ?? []) {
    if (entry.visibility !== "public") {
      continue;
    }
    const validated = validateDictionaryEntry(
      entry,
      catalog,
      taxonomy
    );
    const currentPin =
      assertCurrentDictionaryRevision(
        entry,
        dictionary,
        catalog,
        taxonomy
      );
    assertDictionaryRevisionCommit(
      currentPin,
      dictionary,
      {
        observedRevision: dictionary.revision
      }
    );
    const gate = dictionaryPublicationGate(entry);
    if (!gate.passed) {
      throw new Error(
        `Public Dictionary entry ${entry.entryId ?? "(missing id)"} failed publication gate: ${gate.reasons.join(", ")}`
      );
    }
    const evidenceStatus = dictionaryEvidenceStatus(
      entry,
      catalog,
      currentTaxonomyHash
    );
    if (evidenceStatus.status !== "current") {
      throw new Error(
        `Public Dictionary entry ${entry.entryId ?? "(missing id)"} has ${evidenceStatus.status} evidence pins`
      );
    }
    if (
      !entry.revisionId ||
      !Number.isInteger(entry.entryRevision) ||
      !entry.evidenceSnapshot?.snapshotId
    ) {
      throw new Error(
        `Public Dictionary entry ${entry.entryId ?? "(missing id)"} lacks immutable revision pins`
      );
    }
    const expectedPayloadHash =
      dictionaryPayloadHash(validated);
    const expectedProvenanceHash = sha256(
      stableJson({
        evidenceSnapshot: entry.evidenceSnapshot,
        sourceIds: [...validated.sourceIds].sort(),
        articleIds: [...validated.articleIds].sort(),
        evidence: validated.evidence,
        contextComparisons:
          validated.contextComparisons,
        counterEvidence: validated.counterEvidence,
        application: validated.application,
        status: validated.status,
        visibility: validated.visibility
      })
    );
    const expectedRevisionId = `dictrev:${sha256(
      stableJson({
        entryId: entry.entryId,
        entryRevision: entry.entryRevision,
        requestHash: expectedPayloadHash,
        provenanceHash: expectedProvenanceHash
      })
    ).slice(0, 24)}`;
    if (
      entry.payloadHash !== expectedPayloadHash ||
      entry.provenanceHash !== expectedProvenanceHash ||
      entry.canonicalClaimHash !==
        dictionaryCanonicalClaimHash(validated) ||
      entry.revisionId !== expectedRevisionId
    ) {
      throw new Error(
        `Public Dictionary entry ${entry.entryId} revision hashes are invalid`
      );
    }
    const history = dictionaryEntryHistory(
      entry.entryId,
      dictionary
    );
    const terminal = history.at(-1);
    const terminalProjection = clone(terminal ?? {});
    delete terminalProjection.recordedAt;
    delete terminalProjection.idempotencyKey;
    delete terminalProjection.noveltyAssessment;
    delete terminalProjection.migration;
    if (
      !terminal ||
      stableJson(terminalProjection) !== stableJson(entry)
    ) {
      throw new Error(
        `Public Dictionary entry ${entry.entryId} is not the terminal immutable revision`
      );
    }
    const publicValidated = validateDictionaryEntry(
      {
        ...validated,
        qualityReview: {
          reviewedAt:
            validated.qualityReview.reviewedAt,
          evidenceMode:
            PUBLIC_REVIEW_EVIDENCE_MODE,
          rounds:
            validated.qualityReview.rounds.map(
              (round) => ({
                ...round,
                summary: "content-withheld",
                evidenceRefs:
                  projectPublicReviewEvidenceRefs(
                    round.evidenceRefs
                  )
              })
            )
        }
      },
      catalog,
      taxonomy,
      {
        allowPublicReviewProjection: true
      }
    );
    const publicGate =
      dictionaryPublicationGate(publicValidated);
    if (!publicGate.passed) {
      throw new Error(
        `Public Dictionary entry ${entry.entryId} could not produce a valid content-withheld review projection`
      );
    }
    entries.push({
      ...publicValidated,
      entryId: entry.entryId,
      entryRevision: entry.entryRevision,
      revisionId: entry.revisionId,
      supersedesRevisionId:
        entry.supersedesRevisionId ?? null,
      provenanceHash: entry.provenanceHash,
      payloadHash: entry.payloadHash,
      canonicalClaimHash: entry.canonicalClaimHash,
      evidenceSnapshot: clone(entry.evidenceSnapshot),
      publisherContentTrust: publisherContentTrust(),
      createdAt: entry.createdAt ?? null,
      updatedAt: entry.updatedAt ?? timestamp
    });
  }
  return {
    document: {
      schemaVersion: 2,
      revision: entries.length,
      updatedAt: entries.length ? timestamp : null,
      entries,
      revisions: [],
      idempotency: {}
    }
  };
}

async function assertNewOutputDirectory(outputDataRoot) {
  try {
    await access(outputDataRoot);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }
    throw error;
  }
  throw new Error(
    `Public snapshot output already exists: ${outputDataRoot}`
  );
}

export async function exportPublicSnapshot({
  pluginRoot,
  sourceDataRoot,
  outputDataRoot,
  timestamp = new Date().toISOString(),
  includePublisherExcerpts = false,
  rightsConfirmed = false
}) {
  const resolvedPluginRoot = resolve(pluginRoot);
  const resolvedSourceRoot = resolve(sourceDataRoot);
  const resolvedOutputRoot = resolve(outputDataRoot);
  if (resolvedSourceRoot === resolvedOutputRoot) {
    throw new Error(
      "Public snapshot export requires a new output directory"
    );
  }
  if (includePublisherExcerpts && !rightsConfirmed) {
    throw new Error(
      "Publisher excerpts require an explicit rights confirmation"
    );
  }
  await assertNewOutputDirectory(resolvedOutputRoot);

  const [config, taxonomy, sourceSnapshot, dictionary] =
    await Promise.all([
      readJson(
        join(resolvedPluginRoot, "config", "sources.json")
      ),
      readJson(
        join(
          resolvedPluginRoot,
          "ontology",
          "domain-taxonomy.json"
        )
      ),
      readJson(join(resolvedSourceRoot, "snapshot.json")),
      readJson(join(resolvedSourceRoot, "dictionary.json"), {
        schemaVersion: 2,
        revision: 0,
        updatedAt: null,
        entries: [],
        revisions: [],
        idempotency: {}
      })
    ]);
  validateSnapshotBundle(sourceSnapshot, config, taxonomy);
  if ((sourceSnapshot.visibility ?? "local") !== "local") {
    throw new Error(
      "Only a validated local/admin snapshot can be exported"
    );
  }

  const articles = sourceSnapshot.catalog.articles.map(
    (article) =>
      sanitizedArticle(article, {
        includePublisherExcerpts
      })
  );
  const articlesBySource = new Map(
    config.sources.map((source) => [source.id, []])
  );
  for (const article of articles) {
    articlesBySource.get(article.sourceId).push(article);
  }
  const partitions = Object.fromEntries(
    config.sources.map((source) => {
      const sourceArticles = articlesBySource.get(source.id);
      const previous =
        sourceSnapshot.partitions[source.id] ?? {};
      return [
        source.id,
        {
          schemaVersion: 2,
          sourceId: source.id,
          companyId: source.companyId,
          snapshotId: null,
          refreshedAt: previous.refreshedAt ?? null,
          dataAsOf: previous.dataAsOf ?? null,
          lastAttemptAt: previous.lastAttemptAt ?? null,
          lastSuccessAt: previous.lastSuccessAt ?? null,
          collectionStatus:
            previous.collectionStatus ?? "unknown",
          recordCount: sourceArticles.length,
          sourceHash: partitionFingerprint(sourceArticles),
          articles: sourceArticles
        }
      ];
    })
  );
  const currentConfigHash = configurationHash(config);
  const currentTaxonomyHash = taxonomyHash(taxonomy);
  const currentCatalogHash = catalogFingerprint(articles);
  const searchIndex = buildSearchIndex(articles, timestamp);
  const catalog = {
    schemaVersion: 2,
    view: "derived-from-source-partitions",
    refreshedAt: sourceSnapshot.catalog.refreshedAt ?? null,
    lastAttemptAt:
      sourceSnapshot.catalog.lastAttemptAt ?? null,
    collectionStatus:
      sourceSnapshot.catalog.collectionStatus ?? "unknown",
    taxonomyHash: currentTaxonomyHash,
    configHash: currentConfigHash,
    snapshotId: null,
    catalogHash: currentCatalogHash,
    articles
  };
  const sourceState = sanitizedSourceState(
    sourceSnapshot.sourceState,
    config
  );
  const collection = {
    status: sourceSnapshot.collection?.status ?? "unknown",
    attemptedAt:
      sourceSnapshot.collection?.attemptedAt ?? null,
    mode: "public-snapshot-export",
    sourceSnapshotId: sourceSnapshot.snapshotId,
    publisherExcerptPolicy: includePublisherExcerpts
      ? "bounded-rights-confirmed"
      : "metadata-only",
    requestedSourceIds: clone(
      sourceSnapshot.collection?.requestedSourceIds ?? []
    ),
    succeededSourceIds: clone(
      sourceSnapshot.collection?.succeededSourceIds ?? []
    ),
    failedSourceIds: clone(
      sourceSnapshot.collection?.failedSourceIds ?? []
    ),
    unselectedSourceIds: clone(
      sourceSnapshot.collection?.unselectedSourceIds ?? []
    )
  };
  const exportedDictionary = publicDictionary(
    dictionary,
    catalog,
    taxonomy,
    currentTaxonomyHash,
    timestamp
  );
  const insightRuns = {
    schemaVersion: 1,
    revision: 0,
    updatedAt: null,
    runs: [],
    idempotency: {}
  };
  const publicData = buildPublicDataCommitment(
    exportedDictionary.document,
    insightRuns
  );
  searchIndex.snapshotId = null;
  const changeSet = clone(sourceSnapshot.changeSet ?? {
    newArticleIds: [],
    updatedArticleIds: [],
    reclassifiedArticleIds: [],
    migratedArticleIds: []
  });
  const identity = buildSnapshotIdentity({
    visibility: "public",
    configHash: currentConfigHash,
    taxonomyHash: currentTaxonomyHash,
    catalogHash: currentCatalogHash,
    catalog,
    searchIndex,
    partitions,
    sourceState,
    collection,
    committedAt: timestamp,
    changeSet,
    publicData
  });
  catalog.snapshotId = identity.snapshotId;
  searchIndex.snapshotId = identity.snapshotId;
  sourceState.snapshotId = identity.snapshotId;
  for (const partition of Object.values(partitions)) {
    partition.snapshotId = identity.snapshotId;
  }
  const snapshot = {
    schemaVersion: 2,
    visibility: "public",
    snapshotId: identity.snapshotId,
    integrityHash: identity.integrityHash,
    committedAt: timestamp,
    configHash: currentConfigHash,
    taxonomyHash: currentTaxonomyHash,
    collection,
    publicData,
    changeSet,
    catalog,
    searchIndex,
    sourceState,
    partitions
  };
  validateSnapshotBundle(snapshot, config, taxonomy);
  const manifest = {
    schemaVersion: 1,
    exportedAt: timestamp,
    sourceSnapshotId: sourceSnapshot.snapshotId,
    publicSnapshotId: snapshot.snapshotId,
    visibility: "public",
    publisherExcerptPolicy:
      collection.publisherExcerptPolicy,
    articleCount: articles.length,
    dictionaryEntryCount:
      exportedDictionary.document.entries.length,
    dictionaryHash: publicData.dictionaryHash,
    dictionaryRevisionPins:
      publicDictionaryRevisionPins(
        exportedDictionary.document
      ),
    insightRunCount: 0,
    insightRunsHash: publicData.insightRunsHash,
    publicDataHash: sha256(stableJson(publicData)),
    configHash: currentConfigHash,
    taxonomyHash: currentTaxonomyHash,
    integrityHash: identity.integrityHash
  };
  validatePublicDataObjects(
    snapshot,
    exportedDictionary.document,
    insightRuns,
    manifest
  );

  await mkdir(resolvedOutputRoot, { recursive: true });
  await Promise.all([
    writeJson(
      join(resolvedOutputRoot, "snapshot.json"),
      snapshot
    ),
    writeJson(
      join(resolvedOutputRoot, "catalog.json"),
      catalog
    ),
    writeJson(
      join(resolvedOutputRoot, "search-index.json"),
      searchIndex
    ),
    writeJson(
      join(resolvedOutputRoot, "source-state.json"),
      sourceState
    ),
    writeJson(
      join(resolvedOutputRoot, "dictionary.json"),
      exportedDictionary.document
    ),
    writeJson(
      join(resolvedOutputRoot, "insight-runs.json"),
      insightRuns
    ),
    writeJson(
      join(
        resolvedOutputRoot,
        "PUBLIC-SNAPSHOT-MANIFEST.json"
      ),
      manifest
    ),
    ...config.sources.map((source) =>
      writeJson(
        join(
          resolvedOutputRoot,
          "partitions",
          source.id,
          "articles.json"
        ),
        partitions[source.id]
      )
    )
  ]);

  const writtenSnapshot = JSON.parse(
    await readFile(
      join(resolvedOutputRoot, "snapshot.json"),
      "utf8"
    )
  );
  validateSnapshotBundle(writtenSnapshot, config, taxonomy);
  validatePublicDataObjects(
    writtenSnapshot,
    JSON.parse(
      await readFile(
        join(resolvedOutputRoot, "dictionary.json"),
        "utf8"
      )
    ),
    JSON.parse(
      await readFile(
        join(resolvedOutputRoot, "insight-runs.json"),
        "utf8"
      )
    ),
    JSON.parse(
      await readFile(
        join(
          resolvedOutputRoot,
          "PUBLIC-SNAPSHOT-MANIFEST.json"
        ),
        "utf8"
      )
    )
  );
  return manifest;
}
