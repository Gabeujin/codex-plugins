import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { stableJson } from "../lib/integrity.mjs";
import { calculateNegativeReviewScore } from "../lib/quality-score.mjs";
import { sha256 } from "../lib/text.mjs";

const dataRoot = await mkdtemp(
  join(tmpdir(), "k-tech-radar-runs-")
);
process.env.K_TECH_RADAR_DATA_DIR = dataRoot;
await writeFile(
  join(dataRoot, "insight-runs.json"),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      revision: 0,
      updatedAt: null,
      runs: [],
      idempotency: {}
    },
    null,
    2
  )}\n`,
  "utf8"
);

const {
  dictionaryCanonicalClaimHash,
  dictionaryPayloadHash,
  validateDictionaryEntry
} = await import(
  `../lib/dictionary.mjs?dictionary=${Date.now()}`
);
const {
  recordInsightRun,
  validateInsightRunCommitLedger,
  validateInsightRun,
  validateStoredInsightRun
} = await import(
  `../lib/insight-runs.mjs?runs=${Date.now()}`
);

const context = {
  catalog: {
    snapshotId: "snapshot:test",
    articles: [
      {
        articleId: "source-a:a1",
        sourceId: "source-a",
        companyId: "company-a",
        canonicalWorkId: "work:source-a:a1",
        workIndependenceStatus: "confirmed-original",
        contentHash: "a".repeat(64),
        ontologyHash: "b".repeat(64)
      },
      {
        articleId: "source-b:b1",
        sourceId: "source-b",
        companyId: "company-b",
        canonicalWorkId: "work:source-b:b1",
        workIndependenceStatus: "confirmed-original",
        contentHash: "c".repeat(64),
        ontologyHash: "d".repeat(64)
      }
    ]
  },
  taxonomyHash: "e".repeat(64),
  taxonomy: {
    domains: [],
    problemTypes: []
  },
  config: {
    sources: [
      { id: "source-a" },
      { id: "source-b" }
    ]
  },
  dictionary: {
    revision: 1,
    updatedAt: "2026-07-28T00:00:00.000Z",
    entries: [],
    revisions: [],
    idempotency: {}
  }
};

function rounds(finalP2 = 5, p0 = 0, p1 = 0) {
  return [
    {
      round: 1,
      p0: 0,
      p1: 1,
      p2: 2,
      summary: "architecture falsification"
    },
    {
      round: 2,
      p0: 0,
      p1: 0,
      p2: 1,
      summary: "adversarial regression"
    },
    {
      round: 3,
      p0,
      p1,
      p2: finalP2,
      summary: "final release audit"
    }
  ].map((round) => ({
    ...round,
    evidenceRefs: [
      {
        kind: "review-report",
        content:
          `review round ${round.round}: ${round.summary}`
      }
    ],
    score: calculateNegativeReviewScore(round)
  }));
}

function makeVerifiedEntry() {
  const validated = validateDictionaryEntry(
    {
      entryId: "dict-accepted",
      kind: "cross-source-synthesis",
      status: "verified",
      visibility: "local",
      title: "Kafka rollback synthesis",
      summary:
        "Two independent publishers describe bounded rollback verification.",
      sourceIds: ["source-a", "source-b"],
      articleIds: ["source-a:a1", "source-b:b1"],
      evidence: [
        {
          sourceId: "source-a",
          articleId: "source-a:a1",
          claim: "Source A observed rollback verification.",
          locator: "section-a",
          evidenceLevel: "article-observation",
          role: "observed",
          directness: "direct"
        },
        {
          sourceId: "source-b",
          articleId: "source-b:b1",
          claim: "Source B observed rollback verification.",
          locator: "section-b",
          evidenceLevel: "article-observation",
          role: "observed",
          directness: "direct"
        }
      ],
      counterEvidence: [
        "The workloads and organizations differ."
      ],
      contextComparisons: [
        {
          sourceId: "source-a",
          comparability: "conditional",
          note: "Recheck workload."
        },
        {
          sourceId: "source-b",
          comparability: "conditional",
          note: "Recheck scale."
        }
      ],
      verification: {
        primarySourcesChecked: true,
        counterEvidenceReviewed: true,
        reviewedAt: "2026-07-30T00:00:00.000Z"
      },
      qualityReview: {
        rounds: rounds(5),
        reviewedAt: "2026-07-30T00:00:00.000Z"
      }
    },
    context.catalog,
    context.taxonomy
  );
  const evidenceSnapshot = {
    snapshotId: "snapshot:test",
    taxonomyHash: context.taxonomyHash,
    articles: context.catalog.articles.map(
      (article) => ({
        articleId: article.articleId,
        sourceId: article.sourceId,
        contentHash: article.contentHash,
        revisionHash:
          article.revisionHash ?? article.contentHash,
        ontologyHash: article.ontologyHash
      })
    )
  };
  const payloadHash = dictionaryPayloadHash(validated);
  const provenanceHash = sha256(
    stableJson({
      evidenceSnapshot,
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
  const entryRevision = 1;
  const revisionId = `dictrev:${sha256(
    stableJson({
      entryId: validated.entryId,
      entryRevision,
      requestHash: payloadHash,
      provenanceHash
    })
  ).slice(0, 24)}`;
  const updatedAt = "2026-07-28T00:00:00.000Z";
  const idempotencyKey = "dictionary-verified-001";
  const revision = {
    ...structuredClone(validated),
    entryRevision,
    revisionId,
    supersedesRevisionId: null,
    provenanceHash,
    payloadHash,
    canonicalClaimHash:
      dictionaryCanonicalClaimHash(validated),
    evidenceSnapshot:
      structuredClone(evidenceSnapshot),
    publisherContentTrust: {
      kind: "untrusted-third-party-content",
      trustLevel: "untrusted-publisher-content",
      instructionsAllowed: false,
      mayContainPromptInjection: true
    },
    createdAt: updatedAt,
    updatedAt,
    recordedAt: updatedAt,
    idempotencyKey
  };
  const revisions = [revision];
  const entry = structuredClone(revision);
  delete entry.recordedAt;
  delete entry.idempotencyKey;
  return { entry, revisions, idempotencyKey };
}

const verifiedFixture = makeVerifiedEntry();
const verifiedEntry = verifiedFixture.entry;
context.dictionary.entries = [verifiedEntry];
context.dictionary.revisions =
  verifiedFixture.revisions;
context.dictionary.idempotency = {
  [verifiedFixture.idempotencyKey]: {
    inputHash: "f".repeat(64),
    requestHash: verifiedEntry.payloadHash,
    entryId: verifiedEntry.entryId,
    revisionId: verifiedEntry.revisionId,
    committedRevision: 1
  }
};

test("held runs are first-class, idempotent receipts", async () => {
  const run = {
    status: "held",
    query: "Kafka migration",
    snapshotId: "snapshot:test",
    sourceIds: ["source-a", "source-b"],
    acceptedEntryIds: [],
    heldReasons: [
      "bounded primary evidence was not available from every publisher"
    ],
    candidateDecisions: [
      {
        candidateId: "candidate-1",
        decision: "held",
        reason: "metadata-comparable only"
      }
    ],
    reviewRounds: rounds(60)
  };
  const created = await recordInsightRun(
    run,
    context,
    {
      idempotencyKey: "insight-held-001"
    }
  );
  assert.equal(created.action, "created");
  assert.equal(created.run.status, "held");
  assert.deepEqual(created.run.acceptedEntryIds, []);
  assert.deepEqual(
    created.run.allowedMutationRefs,
    created.run.expectedMutationRefs
  );
  const replay = await recordInsightRun(
    run,
    context,
    {
      idempotencyKey: "insight-held-001"
    }
  );
  assert.equal(replay.action, "noop");
  assert.equal(replay.revision, 1);
  context.dictionary.revision = 2;
  const replayAfterContextChange =
    await recordInsightRun(run, context, {
      idempotencyKey: "insight-held-001"
    });
  assert.equal(
    replayAfterContextChange.reason,
    "idempotent-replay"
  );
  context.dictionary.revision = 1;
});

test("identical InsightRun content under another key is a single no-op receipt", async () => {
  const duplicate = await recordInsightRun(
    {
      status: "held",
      query: "Kafka migration",
      snapshotId: "snapshot:test",
      sourceIds: ["source-a", "source-b"],
      acceptedEntryIds: [],
      heldReasons: [
        "bounded primary evidence was not available from every publisher"
      ],
      candidateDecisions: [
        {
          candidateId: "candidate-1",
          decision: "held",
          reason: "metadata-comparable only"
        }
      ],
      reviewRounds: rounds(60)
    },
    context,
    {
      idempotencyKey: "insight-held-002"
    }
  );
  assert.equal(duplicate.action, "noop");
  assert.equal(duplicate.reason, "duplicate-content");
  assert.equal(duplicate.revision, 2);
});

test("accepted runs fail closed below the final 9.9 gate", async () => {
  await assert.rejects(
    recordInsightRun(
      {
        status: "accepted",
        query: "Kafka migration",
        snapshotId: "snapshot:test",
        sourceIds: ["source-a", "source-b"],
        acceptedEntryIds: ["dict-accepted"],
        heldReasons: [],
        reviewRounds: rounds(10)
      },
      context,
      {
        idempotencyKey: "insight-accepted-below-gate"
      }
    ),
    /final score >=9.9/
  );
});

test("accepted runs pin the verified current Dictionary revision", async () => {
  const created = await recordInsightRun(
    {
      status: "accepted",
      query: "Kafka migration",
      snapshotId: "snapshot:test",
      sourceIds: ["source-a", "source-b"],
      acceptedEntryIds: ["dict-accepted"],
      heldReasons: [],
      reviewRounds: rounds(5)
    },
    context,
    {
      idempotencyKey: "insight-accepted-pinned"
    }
  );
  assert.equal(created.action, "created");
  assert.deepEqual(
    created.run.acceptedEntryRevisions,
    [
      {
        entryId: "dict-accepted",
        entryRevision: 1,
        revisionId: verifiedEntry.revisionId,
        provenanceHash:
          verifiedEntry.provenanceHash,
        payloadHash: verifiedEntry.payloadHash,
        evidenceSnapshotId: "snapshot:test",
        statusAtAcceptance: "verified",
        dictionaryCommittedRevision: 1
      }
    ]
  );
  assert.equal(
    created.run.observedDictionaryRevision,
    1
  );
  assert.equal(
    validateStoredInsightRun(created.run, context)
      .runId,
    created.run.runId
  );
});

test("stored InsightRun receipts reject artifact and commit-order tampering", async () => {
  const ledger = JSON.parse(
    await readFile(
      join(dataRoot, "insight-runs.json"),
      "utf8"
    )
  );
  const accepted = ledger.runs.find(
    (run) => run.status === "accepted"
  );
  for (const mutate of [
    (run) => {
      run.reviewRounds[2].evidenceRefs[0]
        .content += " forged";
    },
    (run) => {
      run.committedRevision += 1;
    },
    (run) => {
      run.requestHash = "0".repeat(64);
    },
    (run) => {
      run.createdAt =
        "SECRET=sk-proj-abcdefghijkl";
    }
  ]) {
    const tampered = structuredClone(accepted);
    mutate(tampered);
    assert.throws(
      () => validateStoredInsightRun(tampered, context),
      /canonical review artifact|immutable receipt|canonical ISO-8601 UTC instant/
    );
  }
});

test("accepted runs require the exact terminal immutable Dictionary revision", () => {
  for (const mutate of [
    (candidate) => {
      candidate.dictionary.revisions = [];
    },
    (candidate) => {
      candidate.dictionary.revisions[0].summary =
        "tampered terminal revision";
    },
    (candidate) => {
      const duplicate = structuredClone(
        candidate.dictionary.revisions[0]
      );
      duplicate.entryRevision = 2;
      duplicate.supersedesRevisionId =
        candidate.dictionary.revisions[0].revisionId;
      candidate.dictionary.revisions.push(duplicate);
    },
    (candidate) => {
      candidate.dictionary.revisions[0]
        .supersedesRevisionId =
        "dictrev:forged-predecessor";
    },
    (candidate) => {
      candidate.dictionary.revisions[0]
        .canonicalClaimHash = "8".repeat(64);
    },
    (candidate) => {
      candidate.dictionary.entries[0].payloadHash =
        "9".repeat(64);
      candidate.dictionary.revisions[0].payloadHash =
        "9".repeat(64);
    }
  ]) {
    const invalidContext = structuredClone(context);
    mutate(invalidContext);
    assert.throws(
      () =>
        validateInsightRun(
          {
            status: "accepted",
            query: "Kafka migration",
            snapshotId: "snapshot:test",
            sourceIds: ["source-a", "source-b"],
            acceptedEntryIds: ["dict-accepted"],
            heldReasons: [],
            reviewRounds: rounds(5)
          },
          invalidContext
        ),
      /current entry|broken immutable revision chain|terminal immutable revision|hashes or payload|canonical review artifact/
    );
  }
});

test("accepted runs reject unverified Dictionary entries", () => {
  const candidateContext = structuredClone(context);
  candidateContext.dictionary.entries[0].status =
    "candidate";
  assert.throws(
    () =>
      validateInsightRun(
        {
          status: "accepted",
          query: "Kafka migration",
          snapshotId: "snapshot:test",
          sourceIds: ["source-a", "source-b"],
          acceptedEntryIds: ["dict-accepted"],
          heldReasons: [],
          reviewRounds: rounds(5)
        },
        candidateContext
      ),
    /verified Dictionary entries/
  );
});

test("accepted runs reject stale Dictionary evidence pins", () => {
  const staleContext = structuredClone(context);
  staleContext.catalog.articles[0].contentHash =
    "9".repeat(64);
  assert.throws(
    () =>
      validateInsightRun(
        {
          status: "accepted",
          query: "Kafka migration",
          snapshotId: "snapshot:test",
          sourceIds: ["source-a", "source-b"],
          acceptedEntryIds: ["dict-accepted"],
          heldReasons: [],
          reviewRounds: rounds(5)
        },
        staleContext
      ),
    /stale evidence/
  );
});

test("accepted runs reject Dictionary sources outside the run", () => {
  assert.throws(
    () =>
      validateInsightRun(
        {
          status: "accepted",
          query: "Kafka migration",
          snapshotId: "snapshot:test",
          sourceIds: ["source-a"],
          acceptedEntryIds: ["dict-accepted"],
          heldReasons: [],
          reviewRounds: rounds(5)
        },
        context
      ),
    /sources outside the insight run/
  );
});

test("review counts fail closed when a severity count is missing", () => {
  const invalidRounds = rounds(5);
  delete invalidRounds[2].p1;
  assert.throws(
    () =>
      validateInsightRun(
        {
          status: "held",
          query: "Kafka migration",
          snapshotId: "snapshot:test",
          sourceIds: ["source-a", "source-b"],
          acceptedEntryIds: [],
          heldReasons: ["review data is incomplete"],
          reviewRounds: invalidRounds
        },
        context
      ),
    /integer P0\/P1\/P2 counts/
  );
});

test("review counts fail closed when a severity count is negative", () => {
  const invalidRounds = rounds(5);
  invalidRounds[2].p2 = -1;
  assert.throws(
    () =>
      validateInsightRun(
        {
          status: "held",
          query: "Kafka migration",
          snapshotId: "snapshot:test",
          sourceIds: ["source-a", "source-b"],
          acceptedEntryIds: [],
          heldReasons: ["review data is invalid"],
          reviewRounds: invalidRounds
        },
        context
      ),
    /non-negative integer/
  );
});

test("InsightRun review rounds require content-addressed artifacts", () => {
  const invalidRounds = rounds(5);
  invalidRounds[1].evidenceRefs = [];
  assert.throws(
    () =>
      validateInsightRun(
        {
          status: "held",
          query: "Kafka migration",
          snapshotId: "snapshot:test",
          sourceIds: ["source-a", "source-b"],
          acceptedEntryIds: [],
          heldReasons: ["review evidence is missing"],
          reviewRounds: invalidRounds
        },
        context
      ),
    /content-addressed review artifacts/
  );
});

test("InsightRun rejects fabricated review artifact hashes", () => {
  const invalidRounds = rounds(5);
  invalidRounds[0].evidenceRefs[0].sha256 =
    "0".repeat(64);
  assert.throws(
    () =>
      validateInsightRun(
        {
          status: "held",
          query: "Kafka migration",
          snapshotId: "snapshot:test",
          sourceIds: ["source-a", "source-b"],
          acceptedEntryIds: [],
          heldReasons: [
            "review artifact receipt is fabricated"
          ],
          reviewRounds: invalidRounds
        },
        context
      ),
    /canonical review artifact/
  );
});

test("InsightRun replay fails closed on a missing target or tampered immutable run", async () => {
  const original = JSON.parse(
    await readFile(
      join(dataRoot, "insight-runs.json"),
      "utf8"
    )
  );
  const input = {
    status: "held",
    query: "Kafka migration",
    snapshotId: "snapshot:test",
    sourceIds: ["source-a", "source-b"],
    acceptedEntryIds: [],
    heldReasons: [
      "bounded primary evidence was not available from every publisher"
    ],
    candidateDecisions: [
      {
        candidateId: "candidate-1",
        decision: "held",
        reason: "metadata-comparable only"
      }
    ],
    reviewRounds: rounds(60)
  };
  try {
    const missing = structuredClone(original);
    missing.idempotency["insight-held-001"].runId =
      "insight-run:missing";
    await writeFile(
      join(dataRoot, "insight-runs.json"),
      `${JSON.stringify(missing, null, 2)}\n`,
      "utf8"
    );
    await assert.rejects(
      recordInsightRun(input, context, {
        idempotencyKey: "insight-held-001"
      }),
      /does not resolve|commit receipt .* is invalid/
    );

    const tampered = structuredClone(original);
    const held = tampered.runs.find(
      (run) => run.status === "held"
    );
    held.query = "tampered semantic query";
    await writeFile(
      join(dataRoot, "insight-runs.json"),
      `${JSON.stringify(tampered, null, 2)}\n`,
      "utf8"
    );
    await assert.rejects(
      recordInsightRun(input, context, {
        idempotencyKey: "insight-held-001"
      }),
      /query fingerprint|immutable receipt/
    );
  } finally {
    await writeFile(
      join(dataRoot, "insight-runs.json"),
      `${JSON.stringify(original, null, 2)}\n`,
      "utf8"
    );
  }
});

test("InsightRun commit ledger rejects duplicate and missing global positions", async () => {
  const ledger = JSON.parse(
    await readFile(
      join(dataRoot, "insight-runs.json"),
      "utf8"
    )
  );
  const keys = Object.keys(ledger.idempotency);
  assert.ok(keys.length >= 3);
  ledger.idempotency[keys[1]].committedRevision =
    ledger.idempotency[keys[0]].committedRevision;
  assert.throws(
    () => validateInsightRunCommitLedger(ledger),
    /commit receipt|missing revision/
  );
});

test("InsightRun ledger timestamps are canonical and monotonic", async () => {
  const original = JSON.parse(
    await readFile(
      join(dataRoot, "insight-runs.json"),
      "utf8"
    )
  );
  const badLedgerTime = structuredClone(original);
  badLedgerTime.updatedAt =
    "SECRET=sk-proj-abcdefghijkl";
  assert.throws(
    () => validateInsightRunCommitLedger(badLedgerTime),
    /canonical ISO-8601 UTC instant/
  );

  const badRunTime = structuredClone(original);
  badRunTime.runs[0].createdAt =
    "2026-07-30T00:00:00Z";
  assert.throws(
    () => validateInsightRunCommitLedger(badRunTime),
    /canonical ISO-8601 UTC instant/
  );

  const futureRun = structuredClone(original);
  futureRun.runs[0].createdAt =
    "9999-12-31T23:59:59.999Z";
  assert.throws(
    () => validateInsightRunCommitLedger(futureRun),
    /created after ledger.updatedAt/
  );
});
