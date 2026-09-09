import { join } from "node:path";

import {
  publisherContentTrust,
  stableJson
} from "./integrity.mjs";
import { dataRoot, readJson } from "./paths.mjs";
import {
  PUBLIC_REVIEW_EVIDENCE_MODE
} from "./review-evidence.mjs";
import {
  canonicalInstant,
  dictionaryPublicationGate,
  validateDictionaryEntry
} from "./dictionary.mjs";
import { sha256 } from "./text.mjs";

function assertExactKeys(value, keys, field) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(`${field} must be an object`);
  }
  const expected = [...keys].sort();
  const actual = Object.keys(value).sort();
  if (stableJson(actual) !== stableJson(expected)) {
    throw new Error(
      `${field} must contain exactly: ${expected.join(", ")}`
    );
  }
}

function exactPublicEvidenceSnapshot(value, field) {
  assertExactKeys(
    value,
    ["snapshotId", "taxonomyHash", "articles"],
    field
  );
  if (
    typeof value.snapshotId !== "string" ||
    !value.snapshotId ||
    !/^[a-f0-9]{64}$/u.test(value.taxonomyHash) ||
    !Array.isArray(value.articles)
  ) {
    throw new Error(`${field} is invalid`);
  }
  return {
    snapshotId: value.snapshotId,
    taxonomyHash: value.taxonomyHash,
    articles: value.articles.map((article, index) => {
      assertExactKeys(
        article,
        [
          "articleId",
          "sourceId",
          "contentHash",
          "revisionHash",
          "ontologyHash"
        ],
        `${field}.articles[${index}]`
      );
      for (const key of [
        "contentHash",
        "revisionHash",
        "ontologyHash"
      ]) {
        if (
          article[key] !== null &&
          !/^[a-f0-9]{64}$/u.test(
            String(article[key] ?? "")
          )
        ) {
          throw new Error(
            `${field}.articles[${index}].${key} is invalid`
          );
        }
      }
      return {
        articleId: String(article.articleId ?? ""),
        sourceId: String(article.sourceId ?? ""),
        contentHash: article.contentHash,
        revisionHash: article.revisionHash,
        ontologyHash: article.ontologyHash
      };
    })
  };
}

export function buildPublicDataCommitment(
  dictionary,
  insightRuns
) {
  const dictionaryEntries = Array.isArray(
    dictionary?.entries
  )
    ? dictionary.entries
    : [];
  const runs = Array.isArray(insightRuns?.runs)
    ? insightRuns.runs
    : [];
  return {
    schemaVersion: 1,
    dictionaryHash: sha256(stableJson(dictionary)),
    dictionaryEntryCount: dictionaryEntries.length,
    insightRunsHash: sha256(stableJson(insightRuns)),
    insightRunCount: runs.length
  };
}

export function publicDictionaryRevisionPins(dictionary) {
  return (dictionary.entries ?? [])
    .map((entry) => ({
      entryId: entry.entryId,
      entryRevision: entry.entryRevision,
      revisionId: entry.revisionId,
      provenanceHash: entry.provenanceHash,
      payloadHash: entry.payloadHash
    }))
    .sort((left, right) =>
      left.entryId.localeCompare(right.entryId)
    );
}

export function validatePublicDataObjects(
  snapshot,
  dictionary,
  insightRuns,
  manifest
) {
  if (snapshot?.visibility !== "public") {
    throw new Error(
      "Bound public data requires a public snapshot"
    );
  }
  const commitment = buildPublicDataCommitment(
    dictionary,
    insightRuns
  );
  if (
    stableJson(snapshot.publicData) !==
    stableJson(commitment)
  ) {
    throw new Error(
      "Public Dictionary or InsightRun sidecar does not match the snapshot commitment"
    );
  }
  if (
    (() => {
      try {
        assertExactKeys(
          dictionary,
          [
            "schemaVersion",
            "revision",
            "updatedAt",
            "entries",
            "revisions",
            "idempotency"
          ],
          "Public Dictionary"
        );
        return false;
      } catch {
        return true;
      }
    })() ||
    dictionary?.schemaVersion !== 2 ||
    dictionary?.revision !== dictionary?.entries?.length ||
    !Array.isArray(dictionary.entries) ||
    !Array.isArray(dictionary.revisions) ||
    dictionary.revisions.length !== 0 ||
    Object.keys(dictionary.idempotency ?? {}).length !== 0
  ) {
    throw new Error(
      "Public Dictionary must be a current-only projection with no local revision or idempotency ledger"
    );
  }
  const dictionaryUpdatedAt = canonicalInstant(
    dictionary.updatedAt,
    "Public Dictionary.updatedAt",
    { required: dictionary.entries.length > 0 }
  );
  if (
    dictionary.entries.length === 0 &&
    dictionaryUpdatedAt !== null
  ) {
    throw new Error(
      "Empty Public Dictionary.updatedAt must be null"
    );
  }
  for (const entry of dictionary.entries) {
    const validated = validateDictionaryEntry(
      entry,
      snapshot.catalog,
      null,
      { allowPublicReviewProjection: true }
    );
    const createdAt = canonicalInstant(
      entry?.createdAt,
      `Public Dictionary ${entry?.entryId ?? "(missing id)"}.createdAt`,
      { required: true }
    );
    const updatedAt = canonicalInstant(
      entry?.updatedAt,
      `Public Dictionary ${entry?.entryId ?? "(missing id)"}.updatedAt`,
      { required: true }
    );
    if (
      Date.parse(createdAt) > Date.parse(updatedAt) ||
      Date.parse(updatedAt) > Date.parse(dictionaryUpdatedAt)
    ) {
      throw new Error(
        `Public Dictionary ${entry?.entryId ?? "(missing id)"} timestamps must be monotonic`
      );
    }
    const rounds = entry?.qualityReview?.rounds;
    canonicalInstant(
      entry?.qualityReview?.reviewedAt,
      `Public Dictionary ${entry?.entryId ?? "(missing id)"}.qualityReview.reviewedAt`
    );
    canonicalInstant(
      entry?.verification?.reviewedAt,
      `Public Dictionary ${entry?.entryId ?? "(missing id)"}.verification.reviewedAt`
    );
    if (
      entry?.qualityReview?.evidenceMode !==
        PUBLIC_REVIEW_EVIDENCE_MODE ||
      !Array.isArray(rounds) ||
      rounds.length !== 3 ||
      rounds.some(
        (round) =>
          round?.summary !== "content-withheld" ||
          !Array.isArray(round.evidenceRefs) ||
          !round.evidenceRefs.length ||
          round.evidenceRefs.some(
            (reference) =>
              reference?.contentWithheld !== true ||
              Object.hasOwn(reference ?? {}, "content")
          )
      )
    ) {
      throw new Error(
        "Public Dictionary review evidence must be a content-withheld receipt projection"
      );
    }
    const evidenceSnapshot = exactPublicEvidenceSnapshot(
      entry.evidenceSnapshot,
      `Public Dictionary ${entry.entryId}.evidenceSnapshot`
    );
    if (
      !Number.isSafeInteger(entry.entryRevision) ||
      entry.entryRevision < 1 ||
      !/^dictrev:[a-f0-9]{24}$/u.test(
        String(entry.revisionId ?? "")
      ) ||
      !(
        entry.supersedesRevisionId === null ||
        /^dictrev:[a-f0-9]{24}$/u.test(
          String(entry.supersedesRevisionId ?? "")
        )
      ) ||
      ![
        entry.provenanceHash,
        entry.payloadHash,
        entry.canonicalClaimHash
      ].every((hash) =>
        /^[a-f0-9]{64}$/u.test(String(hash ?? ""))
      ) ||
      !dictionaryPublicationGate(validated).passed
    ) {
      throw new Error(
        `Public Dictionary ${entry.entryId ?? "(missing id)"} immutable projection is invalid`
      );
    }
    const expectedEntry = {
      ...validated,
      entryRevision: entry.entryRevision,
      revisionId: entry.revisionId,
      supersedesRevisionId:
        entry.supersedesRevisionId,
      provenanceHash: entry.provenanceHash,
      payloadHash: entry.payloadHash,
      canonicalClaimHash: entry.canonicalClaimHash,
      evidenceSnapshot,
      publisherContentTrust: publisherContentTrust(),
      createdAt,
      updatedAt
    };
    if (stableJson(entry) !== stableJson(expectedEntry)) {
      throw new Error(
        `Public Dictionary ${entry.entryId ?? "(missing id)"} contains fields outside the exact public projection`
      );
    }
  }
  if (
    (() => {
      try {
        assertExactKeys(
          insightRuns,
          [
            "schemaVersion",
            "revision",
            "updatedAt",
            "runs",
            "idempotency"
          ],
          "Public InsightRun sidecar"
        );
        return false;
      } catch {
        return true;
      }
    })() ||
    insightRuns?.schemaVersion !== 1 ||
    insightRuns?.revision !== 0 ||
    insightRuns?.updatedAt !== null ||
    !Array.isArray(insightRuns.runs) ||
    insightRuns.runs.length !== 0 ||
    Object.keys(insightRuns.idempotency ?? {}).length !== 0
  ) {
    throw new Error(
      "Public InsightRun sidecar must contain zero local review receipts"
    );
  }
  const expectedPins =
    publicDictionaryRevisionPins(dictionary);
  const expectedManifest = {
    schemaVersion: 1,
    exportedAt: snapshot.committedAt,
    sourceSnapshotId:
      snapshot.collection?.sourceSnapshotId ?? null,
    publicSnapshotId: snapshot.snapshotId,
    visibility: "public",
    publisherExcerptPolicy:
      snapshot.collection?.publisherExcerptPolicy,
    articleCount: snapshot.catalog.articles.length,
    dictionaryEntryCount:
      commitment.dictionaryEntryCount,
    dictionaryHash: commitment.dictionaryHash,
    dictionaryRevisionPins: expectedPins,
    insightRunCount: commitment.insightRunCount,
    insightRunsHash: commitment.insightRunsHash,
    publicDataHash: sha256(stableJson(commitment)),
    configHash: snapshot.configHash,
    taxonomyHash: snapshot.taxonomyHash,
    integrityHash: snapshot.integrityHash
  };
  if (
    !snapshot.committedAt ||
    !snapshot.collection?.publisherExcerptPolicy ||
    stableJson(manifest) !== stableJson(expectedManifest)
  ) {
    throw new Error(
      "PUBLIC-SNAPSHOT-MANIFEST.json does not match the committed public snapshot"
    );
  }
  return {
    dictionary,
    insightRuns,
    manifest,
    commitment
  };
}

export async function loadBoundPublicData(
  snapshot,
  { root = dataRoot } = {}
) {
  const [dictionary, insightRuns, manifest] =
    await Promise.all([
      readJson(join(root, "dictionary.json")),
      readJson(join(root, "insight-runs.json")),
      readJson(
        join(root, "PUBLIC-SNAPSHOT-MANIFEST.json")
      )
    ]);
  return validatePublicDataObjects(
    snapshot,
    dictionary,
    insightRuns,
    manifest
  );
}
