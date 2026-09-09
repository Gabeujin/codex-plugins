import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateReviewedFileSetHash,
  normalizeReviewedContent,
  validateQualityGate
} from "../scripts/check-quality-gate.mjs";
import { calculateNegativeReviewScore } from "../lib/quality-score.mjs";
import { pluginRoot } from "../lib/paths.mjs";
import { sha256 } from "../lib/text.mjs";

function evidence(round) {
  const output =
    `Round ${round} completed with reviewed findings and remediation receipts.`;
  return [
    {
      command: `round-${round}`,
      exitCode: 0,
      outputSha256: sha256(output),
      outputBytes: Buffer.byteLength(
        output,
        "utf8"
      ),
      output,
      classification:
        "public-sanitized-review-report"
    }
  ];
}

function validGate(reviewedFileSet) {
  return {
    documentType: "k-tech-radar.quality-gate",
    schemaVersion: 1,
    pluginVersion: "0.3.0",
    scope:
      "local-plugin-and-sanitized-distribution-candidate",
    officialCertificationClaimed: false,
    scoringPolicy: {
      id: "negative-review-v1",
      p0Weight: 2,
      p1Weight: 0.1,
      p2Weight: 0.02,
      decimals: 2
    },
    reviewedFileSet,
    reviewRounds: [
      {
        round: 1,
        score: 7.56,
        p0: 1,
        p1: 4,
        p2: 2,
        summary: "baseline hostile review",
        evidence: evidence(1)
      },
      {
        round: 2,
        score: 9.88,
        p0: 0,
        p1: 1,
        p2: 1,
        summary: "adversarial regression",
        evidence: evidence(2)
      },
      {
        round: 3,
        score: 10,
        p0: 0,
        p1: 0,
        p2: 0,
        summary: "final release audit",
        evidence: evidence(3)
      }
    ],
    verification: {
      testsPassed: 70,
      testsFailed: 0,
      integrityChecksPassed: 21,
      secretFindings: 0,
      npmAuditVulnerabilities: 0,
      localMcpTools: 13,
      publicMcpTools: 9
    },
    externalGates: {
      universalDirectoryApproved: false,
      remaining: ["production endpoint"]
    }
  };
}

test("quality gate requires an exact hash-pinned three-round 9.9 closeout", async () => {
  const fileSet =
    await calculateReviewedFileSetHash(pluginRoot);
  const gate = validGate(fileSet);
  assert.equal(
    validateQualityGate(gate, fileSet).status,
    "passed"
  );
  assert.throws(
    () =>
      validateQualityGate(
        {
          ...gate,
          reviewRounds: gate.reviewRounds.slice(0, 2)
        },
        fileSet
      ),
    /exactly three/
  );
  assert.throws(
    () =>
      validateQualityGate(
        {
          ...gate,
          reviewedFileSet: {
            ...fileSet,
            hash: "b".repeat(64)
          }
        },
        fileSet
      ),
    /hash is stale/
  );
  assert.throws(
    () =>
      validateQualityGate(
        {
          ...gate,
          reviewRounds: gate.reviewRounds.map(
            (round, index) =>
              index === 2
                ? {
                    ...round,
                    score: 9.9
                  }
                : round
          )
        },
        fileSet
      ),
    /scoring policy/
  );
  assert.throws(
    () =>
      validateQualityGate(
        {
          ...gate,
          approvedBy: "fabricated-approval"
        },
        fileSet
      ),
    /must contain exactly/
  );
  const tamperedEvidence = structuredClone(gate);
  tamperedEvidence.reviewRounds[2]
    .evidence[0].output += " forged";
  assert.throws(
    () =>
      validateQualityGate(
        tamperedEvidence,
        fileSet
      ),
    /content-addressed evidence/
  );
  for (const unsafeOutput of [
    "C:\\Users\\Administrator\\private\\review.log",
    "Leak at /workspace/internal/review.log",
    "Leak at /root/internal/review.log",
    "Leak at /tmp/internal/review.log",
    "Leak at /mnt/c/internal/review.log",
    "Leak at /var/internal/review.log",
    "Leak at /private/internal/review.log",
    "Leak at /Applications/internal/review.log",
    "Leak at /Volumes/internal/review.log",
    "Leak at /builds/internal/review.log",
    "Leak at /repo/internal/review.log",
    "Leak at /alice/private/review.log",
    "cwd=/project/report.json",
    "path=/app/data/out",
    "source:/src/internal/file.mjs",
    "artifact=/data/reports/private.log",
    "Leak at file:///workspace/internal/review.log",
    "cwd=/workspace/internal/review.log",
    "PWD=/workspace/internal",
    "--output=/tmp/report.log",
    "path:/root/private",
    "OPENAI_API_KEY=nonstandard-secret-value-123456789",
    "AWS_SECRET_ACCESS_KEY=nonstandard-secret-value-123456789",
    "K_TECH_RADAR_BEARER_TOKEN=1234567890abcdef1234567890abcdef",
    "access_token=1234567890abcdef1234567890abcdef",
    "Cookie: sessionid=1234567890abcdef1234567890abcdef",
    "X-API-Key: 1234567890abcdef1234567890abcdef",
    "Authorization: Bearer example-placeholder-token"
  ]) {
    const unsafe = structuredClone(gate);
    const item =
      unsafe.reviewRounds[2].evidence[0];
    item.output = unsafeOutput;
    item.outputBytes = Buffer.byteLength(
      unsafeOutput,
      "utf8"
    );
    item.outputSha256 = sha256(unsafeOutput);
    assert.throws(
      () => validateQualityGate(unsafe, fileSet),
      /public-safe sanitized review report/
    );
  }
  const unsafeCommand = structuredClone(gate);
  unsafeCommand.reviewRounds[1].evidence[0].command =
    "review OPENAI_API_KEY=nonstandard-secret-value-123456789";
  assert.throws(
    () => validateQualityGate(unsafeCommand, fileSet),
    /public-safe sanitized review report/
  );
  for (const [field, unsafeText] of [
    [
      "summary",
      "Internal source AWS_SECRET_ACCESS_KEY=nonstandard-secret-value-123456789"
    ],
    [
      "externalGate",
      "Cookie: sessionid=1234567890abcdef1234567890abcdef"
    ]
  ]) {
    const unsafe = structuredClone(gate);
    if (field === "summary") {
      unsafe.reviewRounds[0].summary = unsafeText;
    } else {
      unsafe.externalGates.remaining[0] = unsafeText;
    }
    assert.throws(
      () => validateQualityGate(unsafe, fileSet),
      /public-safe sanitized review report/
    );
  }
  const safeUrl = structuredClone(gate);
  const safeOutput =
    "Reviewed https://example.com/workspace/internal/report and public endpoints /mcp and /health.";
  const safeItem =
    safeUrl.reviewRounds[2].evidence[0];
  safeItem.output = safeOutput;
  safeItem.outputBytes = Buffer.byteLength(
    safeOutput,
    "utf8"
  );
  safeItem.outputSha256 = sha256(safeOutput);
  assert.equal(
    validateQualityGate(safeUrl, fileSet).status,
    "passed"
  );
});

test("review score is deterministic and cachebuster versions hash identically", () => {
  assert.equal(
    calculateNegativeReviewScore({
      p0: 2,
      p1: 7,
      p2: 4
    }),
    5.22
  );
  const base = normalizeReviewedContent(
    ".codex-plugin/plugin.json",
    Buffer.from(
      JSON.stringify({
        name: "k-tech-radar",
        version: "0.3.0"
      })
    )
  );
  const cached = normalizeReviewedContent(
    ".codex-plugin/plugin.json",
    Buffer.from(
      JSON.stringify({
        name: "k-tech-radar",
        version: "0.3.0+codex.20260730084310"
      })
    )
  );
  assert.deepEqual(cached, base);
});
