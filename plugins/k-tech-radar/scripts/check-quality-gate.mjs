#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  lstat,
  readFile,
  readdir
} from "node:fs/promises";
import {
  dirname,
  join,
  relative,
  resolve
} from "node:path";
import { fileURLToPath } from "node:url";
import {
  calculateNegativeReviewScore,
  negativeReviewScoringPolicy as scoringPolicy
} from "../lib/quality-score.mjs";

const moduleRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reviewedRootFiles = [
  ".dockerignore",
  ".mcp.json",
  "CHANGELOG.md",
  "LICENSE",
  "package-lock.json",
  "package.json",
  "README.md",
  "SECURITY.md",
  "THIRD_PARTY_NOTICES.md"
];
const reviewedDirectories = [
  ".codex-plugin",
  ".github",
  "assets",
  "config",
  "deployment",
  "docs",
  "lib",
  "mcp",
  "ontology",
  "scripts",
  "skills",
  "submission",
  "tests"
];

async function listFiles(root) {
  const files = [];
  for (const entry of await readdir(root, {
    withFileTypes: true
  })) {
    const path = join(root, entry.name);
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink()) {
      throw new Error(
        `Quality gate rejects symbolic links: ${path}`
      );
    }
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

export function normalizeReviewedContent(
  normalizedPath,
  content
) {
  if (normalizedPath !== ".codex-plugin/plugin.json") {
    return content;
  }
  const manifest = JSON.parse(content.toString("utf8"));
  manifest.version = String(manifest.version ?? "").replace(
    /\+codex\.[0-9]+$/u,
    ""
  );
  return Buffer.from(
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
}

export async function calculateReviewedFileSetHash(
  pluginRoot = moduleRoot
) {
  const paths = [
    ...reviewedRootFiles.map((name) =>
      join(pluginRoot, name)
    ),
    ...(
      await Promise.all(
        reviewedDirectories.map((name) =>
          listFiles(join(pluginRoot, name))
        )
      )
    ).flat()
  ].sort((left, right) => left.localeCompare(right));
  const digest = createHash("sha256");
  for (const path of paths) {
    const normalized = relative(pluginRoot, path).replaceAll(
      "\\",
      "/"
    );
    digest.update(normalized, "utf8");
    digest.update("\0");
    digest.update(
      normalizeReviewedContent(
        normalized,
        await readFile(path)
      )
    );
    digest.update("\0");
  }
  return {
    algorithm: "sha256-path-and-normalized-content-v2",
    fileCount: paths.length,
    hash: digest.digest("hex")
  };
}

export { calculateNegativeReviewScore };

function assertInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
}

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
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${field} must contain exactly: ${expected.join(", ")}`
    );
  }
}

const publicEvidenceClassification =
  "public-sanitized-review-report";
const unsafePublicEvidencePatterns = [
  /(?<![A-Za-z])[a-z]:[\\/]/iu,
  /(?:^|[\s"'(=:,;])\/(?:Applications|Library|Network|System|Users|Volumes|__w|agent|bin|boot|builds|dev|etc|github|home|lib|lib64|media|mnt|opt|private|proc|root|run|sbin|srv|sys|tmp|usr|var|work|workspace)(?:\/|\b)/u,
  /(?:^|[\s"'(=:,;])\/(?!\/)(?:[A-Za-z0-9._~%-]+\/)+[A-Za-z0-9._~%+-]+(?:[/?#][^\s"'<>]*)?/u,
  /\bfile:(?:\/{2,3}|\\{2,3})/iu,
  /\\\\[A-Za-z0-9._-]+\\/u,
  /authorization\s*:\s*(?:bearer|basic)\b/iu,
  /\bbearer\s+[A-Za-z0-9._~+/-]{8,}/iu,
  /(?:^|[^A-Za-z0-9])(?:[A-Za-z0-9]+[_-])*(?:password|passwd|api[_-]?key|secret(?:[_-][A-Za-z0-9]+)*|token|credential)\s*[:=]\s*\S{8,}/iu,
  /\b(?:cookie|set-cookie|x-api-key)\s*:\s*\S+/iu,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/u,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/u
];

function assertPublicSafeEvidenceText(value, field) {
  const text = String(value ?? "");
  if (
    !text.trim() ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(
      text
    ) ||
    unsafePublicEvidencePatterns.some((pattern) =>
      pattern.test(text)
    )
  ) {
    throw new Error(
      `${field} must be a public-safe sanitized review report with no local paths, credentials, or control bytes`
    );
  }
}

export function validateQualityGate(
  gate,
  reviewedFileSet
) {
  assertExactKeys(
    gate,
    [
      "documentType",
      "schemaVersion",
      "pluginVersion",
      "scope",
      "officialCertificationClaimed",
      "scoringPolicy",
      "reviewedFileSet",
      "reviewRounds",
      "verification",
      "externalGates"
    ],
    "quality gate"
  );
  assertExactKeys(
    gate.scoringPolicy,
    [
      "id",
      "p0Weight",
      "p1Weight",
      "p2Weight",
      "decimals"
    ],
    "scoringPolicy"
  );
  assertExactKeys(
    gate.reviewedFileSet,
    ["algorithm", "fileCount", "hash"],
    "reviewedFileSet"
  );
  if (
    gate?.documentType !==
      "k-tech-radar.quality-gate" ||
    gate?.schemaVersion !== 1 ||
    gate?.pluginVersion !== "0.3.0"
  ) {
    throw new Error(
      "Quality gate identity/version is invalid"
    );
  }
  if (
    gate.scope !==
    "local-plugin-and-sanitized-distribution-candidate"
  ) {
    throw new Error("Quality gate scope is invalid");
  }
  if (gate.officialCertificationClaimed !== false) {
    throw new Error(
      "Quality gate must not claim official certification"
    );
  }
  if (
    gate.scoringPolicy?.id !== scoringPolicy.id ||
    gate.scoringPolicy?.p0Weight !==
      scoringPolicy.p0Weight ||
    gate.scoringPolicy?.p1Weight !==
      scoringPolicy.p1Weight ||
    gate.scoringPolicy?.p2Weight !==
      scoringPolicy.p2Weight ||
    gate.scoringPolicy?.decimals !==
      scoringPolicy.decimals
  ) {
    throw new Error(
      "Quality gate scoring policy is invalid"
    );
  }
  if (
    gate.reviewedFileSet?.algorithm !==
      reviewedFileSet.algorithm ||
    gate.reviewedFileSet?.fileCount !==
      reviewedFileSet.fileCount ||
    gate.reviewedFileSet?.hash !== reviewedFileSet.hash
  ) {
    throw new Error(
      "Quality gate reviewed file-set hash is stale"
    );
  }
  if (
    !Array.isArray(gate.reviewRounds) ||
    gate.reviewRounds.length !== 3
  ) {
    throw new Error(
      "Quality gate requires exactly three review rounds"
    );
  }
  gate.reviewRounds.forEach((round, index) => {
    assertExactKeys(
      round,
      [
        "round",
        "score",
        "p0",
        "p1",
        "p2",
        "summary",
        "evidence"
      ],
      `reviewRounds[${index}]`
    );
    if (
      round.round !== index + 1 ||
      !Number.isFinite(round.score) ||
      round.score < 0 ||
      round.score > 10
    ) {
      throw new Error(
        `Review round ${index + 1} has invalid identity or score`
      );
    }
    for (const field of ["p0", "p1", "p2"]) {
      assertInteger(
        round[field],
        `reviewRounds[${index}].${field}`
      );
    }
    if (
      round.score !== calculateNegativeReviewScore(round)
    ) {
      throw new Error(
        `Review round ${index + 1} score does not match the scoring policy`
      );
    }
    if (
      !String(round.summary ?? "").trim() ||
      String(round.summary).length > 2_000 ||
      !Array.isArray(round.evidence) ||
      !round.evidence.length ||
      round.evidence.length > 20 ||
      round.evidence.some(
        (item) =>
          (() => {
            try {
              assertExactKeys(
                item,
                [
                  "command",
                  "exitCode",
                  "outputSha256",
                  "outputBytes",
                  "output",
                  "classification"
                ],
                `reviewRounds[${index}].evidence`
              );
              return false;
            } catch {
              return true;
            }
          })() ||
          !String(item.command ?? "").trim() ||
          String(item.command).length > 2_000 ||
          item.classification !==
            publicEvidenceClassification ||
          item.exitCode !== 0 ||
          typeof item.output !== "string" ||
          !item.output.trim() ||
          Buffer.byteLength(
            item.output,
            "utf8"
          ) > 200_000 ||
          item.outputBytes !==
            Buffer.byteLength(
              item.output,
              "utf8"
            ) ||
          !/^[a-f0-9]{64}$/u.test(
            String(item.outputSha256 ?? "")
          ) ||
          item.outputSha256 !==
            createHash("sha256")
              .update(item.output, "utf8")
              .digest("hex")
      )
    ) {
      throw new Error(
        `Review round ${index + 1} lacks successful content-addressed evidence`
      );
    }
    assertPublicSafeEvidenceText(
      round.summary,
      `reviewRounds[${index}].summary`
    );
    for (const [evidenceIndex, item] of
      round.evidence.entries()) {
      assertPublicSafeEvidenceText(
        item.command,
        `reviewRounds[${index}].evidence[${evidenceIndex}].command`
      );
      assertPublicSafeEvidenceText(
        item.output,
        `reviewRounds[${index}].evidence[${evidenceIndex}].output`
      );
    }
  });
  const finalRound = gate.reviewRounds[2];
  if (
    finalRound.score < 9.9 ||
    finalRound.p0 !== 0 ||
    finalRound.p1 !== 0
  ) {
    throw new Error(
      "Final quality gate must be >=9.9 with P0=0 and P1=0"
    );
  }
  const verification = gate.verification ?? {};
  assertExactKeys(
    verification,
    [
      "testsPassed",
      "testsFailed",
      "integrityChecksPassed",
      "secretFindings",
      "npmAuditVulnerabilities",
      "localMcpTools",
      "publicMcpTools"
    ],
    "verification"
  );
  for (const [field, minimum] of Object.entries({
    testsPassed: 70,
    integrityChecksPassed: 21,
    localMcpTools: 13,
    publicMcpTools: 9
  })) {
    if (
      !Number.isInteger(verification[field]) ||
      verification[field] < minimum
    ) {
      throw new Error(
        `verification.${field} must be at least ${minimum}`
      );
    }
  }
  for (const field of [
    "testsFailed",
    "secretFindings",
    "npmAuditVulnerabilities"
  ]) {
    if (verification[field] !== 0) {
      throw new Error(`verification.${field} must be zero`);
    }
  }
  if (
    (() => {
      try {
        assertExactKeys(
          gate.externalGates,
          ["universalDirectoryApproved", "remaining"],
          "externalGates"
        );
        return false;
      } catch {
        return true;
      }
    })() ||
    gate.externalGates?.universalDirectoryApproved !==
      false ||
    !Array.isArray(gate.externalGates?.remaining) ||
    gate.externalGates.remaining.length < 1 ||
    gate.externalGates.remaining.length > 20 ||
    gate.externalGates.remaining.some(
      (item) =>
        !String(item ?? "").trim() ||
        String(item).length > 500
    )
  ) {
    throw new Error(
      "Quality gate must preserve external publication gates"
    );
  }
  gate.externalGates.remaining.forEach(
    (item, index) =>
      assertPublicSafeEvidenceText(
        item,
        `externalGates.remaining[${index}]`
      )
  );
  return {
    status: "passed",
    score: finalRound.score,
    p0: finalRound.p0,
    p1: finalRound.p1,
    p2: finalRound.p2,
    reviewedFileSet
  };
}

export async function checkQualityGate({
  pluginRoot = moduleRoot,
  gatePath = join(pluginRoot, "QUALITY-GATE.json")
} = {}) {
  const [gate, reviewedFileSet] = await Promise.all([
    readFile(gatePath, "utf8").then(JSON.parse),
    calculateReviewedFileSetHash(pluginRoot)
  ]);
  return validateQualityGate(gate, reviewedFileSet);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  console.log(
    JSON.stringify(await checkQualityGate(), null, 2)
  );
}
