import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const dataRoot = await mkdtemp(
  join(tmpdir(), "k-tech-radar-dictionary-")
);
process.env.K_TECH_RADAR_DATA_DIR = dataRoot;
await writeFile(
  join(dataRoot, "dictionary.json"),
  `${JSON.stringify(
    {
      schemaVersion: 2,
      revision: 0,
      updatedAt: null,
      entries: [],
      revisions: [],
      idempotency: {}
    },
    null,
    2
  )}\n`,
  "utf8"
);

const {
  dictionaryEntryHistory,
  recordDictionaryEntry,
  validateDictionaryCommitLedger,
  validateDictionaryRevisionChain
} = await import(
  `../lib/dictionary.mjs?ledger=${Date.now()}`
);

const catalog = {
  snapshotId: "snapshot:test",
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

function entry(summary = "점진 전환 가설") {
  return {
    kind: "cross-source-synthesis",
    status: "reviewed",
    visibility: "local",
    title: "두 회사의 점진 전환 검증",
    summary,
    sourceIds: ["source-a", "source-b"],
    articleIds: ["source-a:a1", "source-b:b1"],
    domainIds: ["architecture"],
    problemTypeIds: ["migration"],
    evidence: [
      {
        sourceId: "source-a",
        articleId: "source-a:a1",
        claim: "dual-run을 관찰했다",
        locator: "section-a",
        evidenceLevel: "article-observation",
        role: "observed"
      },
      {
        sourceId: "source-b",
        articleId: "source-b:b1",
        claim: "rollback gate를 관찰했다",
        locator: "section-b",
        evidenceLevel: "article-observation",
        role: "observed"
      }
    ],
    counterEvidence: ["규모와 스택이 다르다"],
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

test("Dictionary writes are idempotent and retain immutable revisions", async () => {
  const created = await recordDictionaryEntry(
    entry(),
    catalog,
    taxonomy,
    {
      idempotencyKey: "dictionary-create-001"
    }
  );
  assert.equal(created.action, "created");
  assert.equal(created.revision, 1);
  assert.equal(created.entryRevision, 1);

  const replay = await recordDictionaryEntry(
    entry(),
    catalog,
    taxonomy,
    {
      idempotencyKey: "dictionary-create-001"
    }
  );
  assert.equal(replay.action, "noop");
  assert.equal(replay.reason, "idempotent-replay");
  assert.equal(replay.revision, 1);

  const duplicateReceipt = await recordDictionaryEntry(
    entry(),
    catalog,
    taxonomy,
    {
      idempotencyKey: "dictionary-duplicate-001",
      expectedRevision: 1
    }
  );
  assert.equal(duplicateReceipt.action, "noop");
  assert.equal(duplicateReceipt.reason, "exact-duplicate");
  assert.equal(duplicateReceipt.revision, 2);
  await assert.rejects(
    recordDictionaryEntry(
      entry("같은 키로 다른 요청"),
      catalog,
      taxonomy,
      {
        idempotencyKey: "dictionary-duplicate-001"
      }
    ),
    /already used for a different Dictionary payload/
  );

  const updatedInput = {
    ...entry("관측 지표를 포함한 점진 전환 가설"),
    entryId: created.entry.entryId
  };
  const updated = await recordDictionaryEntry(
    updatedInput,
    catalog,
    taxonomy,
    {
      idempotencyKey: "dictionary-update-001",
      expectedRevision: 2
    }
  );
  assert.equal(updated.action, "updated");
  assert.equal(updated.revision, 3);
  assert.equal(updated.entryRevision, 2);
  assert.equal(
    updated.entry.supersedesRevisionId,
    created.entry.revisionId
  );
  const historicReplay = await recordDictionaryEntry(
    entry(),
    catalog,
    taxonomy,
    {
      idempotencyKey: "dictionary-create-001"
    }
  );
  assert.equal(historicReplay.action, "noop");
  assert.equal(historicReplay.entry.entryRevision, 1);
  assert.equal(
    historicReplay.entry.revisionId,
    created.entry.revisionId
  );

  const persisted = JSON.parse(
    await readFile(
      join(dataRoot, "dictionary.json"),
      "utf8"
    )
  );
  const history = dictionaryEntryHistory(
    created.entry.entryId,
    persisted
  );
  assert.equal(history.length, 2);
  assert.equal(history[0].revisionId, created.entry.revisionId);
  assert.equal(history[1].revisionId, updated.entry.revisionId);
});

test("verified status cannot be downgraded and concurrent stale writers do not win", async () => {
  const persisted = JSON.parse(
    await readFile(
      join(dataRoot, "dictionary.json"),
      "utf8"
    )
  );
  const current = persisted.entries[0];
  const verified = await recordDictionaryEntry(
    {
      ...entry("검증 상태로 승격"),
      entryId: current.entryId,
      status: "verified",
      verification: {
        primarySourcesChecked: true,
        counterEvidenceReviewed: true,
        reviewedAt: "2026-07-30T00:00:00.000Z"
      }
    },
    catalog,
    taxonomy,
    {
      idempotencyKey: "dictionary-verify-001",
      expectedRevision: persisted.revision,
      allowVerified: true
    }
  );
  await assert.rejects(
    recordDictionaryEntry(
      {
        ...entry("검증을 후보로 되돌리려는 시도"),
        entryId: current.entryId,
        status: "candidate"
      },
      catalog,
      taxonomy,
      {
        idempotencyKey: "dictionary-downgrade-001",
        expectedRevision: verified.revision,
        allowVerified: true
      }
    ),
    /cannot move backward/
  );

  const writer = (suffix) =>
    recordDictionaryEntry(
      {
        ...entry(`동시 작성 ${suffix}`),
        entryId: current.entryId,
        status: "verified",
        verification: {
          primarySourcesChecked: true,
          counterEvidenceReviewed: true,
          reviewedAt: "2026-07-30T00:00:00.000Z"
        }
      },
      catalog,
      taxonomy,
      {
        idempotencyKey: `dictionary-concurrent-${suffix}`,
        expectedRevision: verified.revision,
        allowVerified: true
      }
    );
  const results = await Promise.allSettled([
    writer("a"),
    writer("b")
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled")
      .length,
    1
  );
  assert.equal(
    results.filter(
      (result) =>
        result.status === "rejected" &&
        /revision conflict/.test(result.reason.message)
    ).length,
    1
  );
});

test("Dictionary idempotent replay resolves only its exact validated historical revision", async () => {
  const original = JSON.parse(
    await readFile(
      join(dataRoot, "dictionary.json"),
      "utf8"
    )
  );
  try {
    const missing = structuredClone(original);
    missing.idempotency[
      "dictionary-create-001"
    ].revisionId = "dictrev:missing";
    await writeFile(
      join(dataRoot, "dictionary.json"),
      `${JSON.stringify(missing, null, 2)}\n`,
      "utf8"
    );
    await assert.rejects(
      recordDictionaryEntry(
        entry(),
        catalog,
        taxonomy,
        {
          idempotencyKey: "dictionary-create-001"
        }
      ),
      /exact immutable Dictionary revision/
    );

    const tampered = structuredClone(original);
    const historic = tampered.revisions.find(
      (revision) =>
        revision.idempotencyKey ===
        "dictionary-create-001"
    );
    historic.summary = "tampered historic payload";
    await writeFile(
      join(dataRoot, "dictionary.json"),
      `${JSON.stringify(tampered, null, 2)}\n`,
      "utf8"
    );
    await assert.rejects(
      recordDictionaryEntry(
        entry(),
        catalog,
        taxonomy,
        {
          idempotencyKey: "dictionary-create-001"
        }
      ),
      /hashes or payload/
    );
  } finally {
    await writeFile(
      join(dataRoot, "dictionary.json"),
      `${JSON.stringify(original, null, 2)}\n`,
      "utf8"
    );
  }
});

test("Dictionary current, revision, and ledger timestamps are canonical and monotonic", async () => {
  const original = JSON.parse(
    await readFile(
      join(dataRoot, "dictionary.json"),
      "utf8"
    )
  );
  const current = original.entries[0];
  const terminal = original.revisions.find(
    (revision) =>
      revision.revisionId === current.revisionId
  );
  assert.ok(terminal);

  for (const field of ["createdAt", "updatedAt"]) {
    const tampered = structuredClone(original);
    const tamperedCurrent = tampered.entries.find(
      (entry) => entry.entryId === current.entryId
    );
    const tamperedTerminal = tampered.revisions.find(
      (revision) =>
        revision.revisionId === current.revisionId
    );
    tamperedCurrent[field] =
      "SECRET=sk-proj-abcdefghijkl";
    tamperedTerminal[field] =
      "SECRET=sk-proj-abcdefghijkl";
    assert.throws(
      () =>
        validateDictionaryRevisionChain(
          tamperedCurrent,
          tampered,
          catalog,
          taxonomy
        ),
      /canonical ISO-8601 UTC instant/
    );
  }

  const badRecordedAt = structuredClone(original);
  badRecordedAt.revisions.find(
    (revision) =>
      revision.revisionId === current.revisionId
  ).recordedAt = "2026-07-30T00:00:00Z";
  assert.throws(
    () =>
      validateDictionaryRevisionChain(
        badRecordedAt.entries.find(
          (entry) => entry.entryId === current.entryId
        ),
        badRecordedAt,
        catalog,
        taxonomy
      ),
    /canonical ISO-8601 UTC instant/
  );

  const badLedger = structuredClone(original);
  badLedger.updatedAt =
    "SECRET=sk-proj-abcdefghijkl";
  assert.throws(
    () => validateDictionaryCommitLedger(badLedger),
    /canonical ISO-8601 UTC instant/
  );
});
