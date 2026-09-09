import assert from "node:assert/strict";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  dirname,
  join,
  resolve
} from "node:path";
import test from "node:test";

import { pluginRoot } from "../lib/paths.mjs";
import { sha256 } from "../lib/text.mjs";
import {
  approvedSourceFiles,
  buildPublicRelease,
  copyApprovedSnapshot,
  snapshotApprovedFiles
} from "../scripts/build-public-release-v3.mjs";
import {
  calculateReviewedFileSetHash
} from "../scripts/check-quality-gate.mjs";

function reviewEvidence(round) {
  const output =
    `Fixture-only negative review round ${round} completed.`;
  return [
    {
      command: `fixture-round-${round}`,
      exitCode: 0,
      outputSha256: sha256(output),
      outputBytes: Buffer.byteLength(output, "utf8"),
      output,
      classification:
        "public-sanitized-review-report"
    }
  ];
}

async function writeFixtureQualityGate(fixtureRoot) {
  const reviewedFileSet =
    await calculateReviewedFileSetHash(fixtureRoot);
  await writeFile(
    join(fixtureRoot, "QUALITY-GATE.json"),
    `${JSON.stringify(
      {
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
            summary: "fixture baseline review",
            evidence: reviewEvidence(1)
          },
          {
            round: 2,
            score: 9.88,
            p0: 0,
            p1: 1,
            p2: 1,
            summary: "fixture regression review",
            evidence: reviewEvidence(2)
          },
          {
            round: 3,
            score: 10,
            p0: 0,
            p1: 0,
            p2: 0,
            summary: "fixture final review",
            evidence: reviewEvidence(3)
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
          remaining: [
            "Fixture intentionally preserves external publication gates."
          ]
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

async function createPublicReleaseFixture() {
  const fixtureRoot = await mkdtemp(
    join(tmpdir(), "k-tech-radar-release-source-")
  );
  const policy = JSON.parse(
    await readFile(
      join(
        pluginRoot,
        "config",
        "public-release-files.json"
      ),
      "utf8"
    )
  );
  for (const relativePath of policy.files) {
    if (relativePath === "QUALITY-GATE.json") {
      continue;
    }
    const source = resolve(pluginRoot, relativePath);
    const destination = resolve(
      fixtureRoot,
      relativePath
    );
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
  await writeFixtureQualityGate(fixtureRoot);
  return fixtureRoot;
}

test("public release is allowlist-built and contains zero private evidence records", async () => {
  const fixtureRoot = await createPublicReleaseFixture();
  const parent = await mkdtemp(
    join(tmpdir(), "k-tech-radar-release-")
  );
  const outputRoot = join(parent, "release");
  const result = await buildPublicRelease({
    pluginRoot: fixtureRoot,
    outputRoot,
    timestamp: "2026-07-30T00:00:00.000Z"
  });
  assert.equal(result.articleRecordsBundled, 0);
  assert.equal(result.dictionaryEntriesBundled, 0);
  assert.equal(result.insightRunsBundled, 0);
  assert.equal(result.publisherExcerptsBundled, 0);
  const snapshot = JSON.parse(
    await readFile(
      join(
        outputRoot,
        "plugins",
        "k-tech-radar",
        "data",
        "snapshot.json"
      ),
      "utf8"
    )
  );
  assert.equal(snapshot.visibility, "public");
  assert.equal(snapshot.schemaVersion, 2);
  const manifest = JSON.parse(
    await readFile(
      join(outputRoot, "RELEASE-MANIFEST.json"),
      "utf8"
    )
  );
  assert.equal(manifest.version, "0.3.0");
  assert.equal(manifest.dataInspection.articleRecords, 0);
  assert.ok(manifest.files.length > 60);
  const manifestPaths = new Set(
    manifest.files.map((item) => item.path)
  );
  assert.ok(
    manifestPaths.has(
      "plugins/k-tech-radar/.mcp.json"
    )
  );
  assert.ok(
    manifestPaths.has(
      "plugins/k-tech-radar/config/public-release-files.json"
    )
  );
});

test("public release exact manifest rejects decoys in every executable policy lane", async () => {
  for (const decoy of [
    "lib/debug.mjs",
    "config/local-copy.json",
    "scripts/internal-export.mjs"
  ]) {
    const fixture = await createPublicReleaseFixture();
    const decoyPath = join(fixture, decoy);
    await mkdir(dirname(decoyPath), { recursive: true });
    await writeFile(
      decoyPath,
      'api_' + 'key="do-not-package-this-value"\n',
      "utf8"
    );
    await assert.rejects(
      approvedSourceFiles(fixture),
      new RegExp(
        `unexpected files: ${decoy.replaceAll(
          "/",
          "\\/"
        )}`
      )
    );
  }
});

test("public release copies one immutable approved source snapshot", async () => {
  const fixture = await createPublicReleaseFixture();
  const files = await approvedSourceFiles(fixture);
  const snapshot = await snapshotApprovedFiles(
    fixture,
    files
  );
  const releaseNotes = join(
    fixture,
    "submission",
    "release-notes.md"
  );
  await writeFile(
    releaseNotes,
    `${await readFile(releaseNotes, "utf8")}\nUNREVIEWED_TOCTOU_BYTES\n`,
    "utf8"
  );
  const destination = await mkdtemp(
    join(tmpdir(), "k-tech-radar-snapshot-copy-")
  );
  await copyApprovedSnapshot(destination, snapshot);
  assert.equal(
    (
      await readFile(
        join(
          destination,
          "submission",
          "release-notes.md"
        ),
        "utf8"
      )
    ).includes("UNREVIEWED_TOCTOU_BYTES"),
    false
  );
});
