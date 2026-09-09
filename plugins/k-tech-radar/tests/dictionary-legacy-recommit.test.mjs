import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const dataRoot = await mkdtemp(
  join(tmpdir(), "k-tech-radar-legacy-dictionary-")
);
process.env.K_TECH_RADAR_DATA_DIR = dataRoot;

const {
  assertDictionaryRevisionCommit,
  dictionaryCanonicalClaimHash,
  recordDictionaryEntry,
  validateDictionaryEntry,
  validateDictionaryRevisionChain
} = await import(
  `../lib/dictionary.mjs?legacy-recommit=${Date.now()}`
);
const {
  publisherContentTrust,
  stableJson
} = await import("../lib/integrity.mjs");
const { sha256 } = await import("../lib/text.mjs");

const catalog = {
  snapshotId: "snapshot:legacy-test",
  articles: [
    {
      articleId: "source-a:a1",
      sourceId: "source-a",
      companyId: "a",
      canonicalWorkId: "work:source-a:a1",
      workIndependenceStatus: "confirmed-original",
      contentHash: "a".repeat(64),
      revisionHash: "a".repeat(64),
      ontologyHash: "b".repeat(64)
    },
    {
      articleId: "source-b:b1",
      sourceId: "source-b",
      companyId: "b",
      canonicalWorkId: "work:source-b:b1",
      workIndependenceStatus: "confirmed-original",
      contentHash: "c".repeat(64),
      revisionHash: "c".repeat(64),
      ontologyHash: "d".repeat(64)
    }
  ]
};
const taxonomy = {
  domains: [{ id: "architecture" }],
  problemTypes: [{ id: "migration" }]
};

function inputEntry() {
  return {
    entryId: "dict-legacy-recommit",
    kind: "cross-source-synthesis",
    status: "reviewed",
    visibility: "local",
    title: "레거시 해시 재커밋",
    summary: "의미 변경 없이 표준 해시 체인으로 전환한다.",
    sourceIds: ["source-a", "source-b"],
    articleIds: ["source-a:a1", "source-b:b1"],
    domainIds: ["architecture"],
    problemTypeIds: ["migration"],
    evidence: [
      {
        sourceId: "source-a",
        articleId: "source-a:a1",
        claim: "dual-run을 관찰했다.",
        locator: "section-a",
        evidenceLevel: "article-observation",
        role: "observed"
      },
      {
        sourceId: "source-b",
        articleId: "source-b:b1",
        claim: "rollback gate를 관찰했다.",
        locator: "section-b",
        evidenceLevel: "article-observation",
        role: "observed"
      }
    ],
    counterEvidence: ["두 시스템의 규모는 다르다."],
    contextComparisons: [
      {
        sourceId: "source-a",
        comparability: "conditional"
      },
      {
        sourceId: "source-b",
        comparability: "conditional"
      }
    ]
  };
}

test("legacy Dictionary revisions require and support an explicit canonical recommit", async () => {
  const validated = validateDictionaryEntry(
    inputEntry(),
    catalog,
    taxonomy
  );
  const evidenceSnapshot = {
    snapshotId: catalog.snapshotId,
    taxonomyHash: sha256(stableJson(taxonomy)),
    articles: catalog.articles.map((article) => ({
      articleId: article.articleId,
      sourceId: article.sourceId,
      contentHash: article.contentHash,
      revisionHash: article.revisionHash,
      ontologyHash: article.ontologyHash
    }))
  };
  const payloadHash = sha256(stableJson(validated));
  const provenanceHash = sha256(
    stableJson({
      evidenceSnapshot,
      evidence: validated.evidence,
      contextComparisons: validated.contextComparisons,
      counterEvidence: validated.counterEvidence,
      application: validated.application,
      status: validated.status,
      visibility: validated.visibility
    })
  );
  const revisionId = `dictrev:${sha256(
    stableJson({
      entryId: validated.entryId,
      entryRevision: 1,
      payloadHash,
      provenanceHash
    })
  ).slice(0, 24)}`;
  const canonicalClaimHash =
    dictionaryCanonicalClaimHash(validated);
  const current = {
    ...validated,
    entryId: validated.entryId,
    entryRevision: 1,
    revisionId,
    supersedesRevisionId: null,
    provenanceHash,
    payloadHash,
    canonicalClaimHash,
    evidenceSnapshot,
    publisherContentTrust: publisherContentTrust(),
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z"
  };
  const dictionary = {
    schemaVersion: 2,
    revision: 1,
    updatedAt: current.updatedAt,
    entries: [current],
    revisions: [
      {
        ...structuredClone(current),
        recordedAt: current.updatedAt,
        migration: "schema-v1-to-v2"
      }
    ],
    idempotency: {}
  };
  await writeFile(
    join(dataRoot, "dictionary.json"),
    `${JSON.stringify(dictionary, null, 2)}\n`,
    "utf8"
  );

  const legacyPin = validateDictionaryRevisionChain(
    current,
    dictionary,
    catalog,
    taxonomy
  );
  assert.throws(
    () =>
      assertDictionaryRevisionCommit(
        legacyPin,
        dictionary
      ),
    /commit ledger|must be recommitted/
  );
  await assert.rejects(
    recordDictionaryEntry(
      inputEntry(),
      catalog,
      taxonomy,
      {
        expectedRevision: 1,
        idempotencyKey: "legacy-recommit-denied"
      }
    ),
    /recommitLegacy=true/
  );

  const result = await recordDictionaryEntry(
    inputEntry(),
    catalog,
    taxonomy,
    {
      expectedRevision: 1,
      idempotencyKey: "legacy-recommit-001",
      recommitLegacy: true
    }
  );
  assert.equal(result.action, "updated");
  assert.equal(result.reason, "legacy-recommit");
  assert.equal(result.entryRevision, 2);

  const persisted = JSON.parse(
    await readFile(
      join(dataRoot, "dictionary.json"),
      "utf8"
    )
  );
  const pin = validateDictionaryRevisionChain(
    persisted.entries[0],
    persisted,
    catalog,
    taxonomy
  );
  assert.equal(
    assertDictionaryRevisionCommit(pin, persisted),
    2
  );
});
