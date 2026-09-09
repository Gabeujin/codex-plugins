import {
  lstat,
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile
} from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  dirname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve
} from "node:path";
import { fileURLToPath } from "node:url";

import { seedPublicData } from "./seed-public-data.mjs";
import {
  checkQualityGate
} from "./check-quality-gate.mjs";

const moduleRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  ".."
);
const releaseFilePolicyPath =
  "config/public-release-files.json";
const obviousSecretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/u,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/u,
  /(?:password|passwd|api[_-]?key|secret)\s*[:=]\s*["'][^"'\r\n]{8,}["']/iu
];

function fixedTimestamp() {
  return new Date(
    process.env.SOURCE_DATE_EPOCH
      ? Number.isFinite(
          Number(process.env.SOURCE_DATE_EPOCH)
        )
        ? Number(process.env.SOURCE_DATE_EPOCH) * 1000
        : process.env.SOURCE_DATE_EPOCH
      : "2026-07-30T00:00:00.000Z"
  ).toISOString();
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8"
  );
}

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, {
    withFileTypes: true
  })) {
    const path = join(directory, entry.name);
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink()) {
      throw new Error(
        `Public release rejects symbolic links: ${path}`
      );
    }
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else if (entry.isFile()) {
      files.push(path);
    } else {
      throw new Error(
        `Public release rejects unsupported filesystem entries: ${path}`
      );
    }
  }
  return files;
}

export async function approvedSourceFiles(pluginRoot) {
  const policy = await readFile(
    join(pluginRoot, releaseFilePolicyPath),
    "utf8"
  ).then(JSON.parse);
  if (
    policy?.schemaVersion !== 1 ||
    policy?.policy !== "exact-files-v1" ||
    !Array.isArray(policy.files) ||
    !policy.files.length
  ) {
    throw new Error(
      "Public release exact-file policy is invalid"
    );
  }
  const normalizedFiles = policy.files.map((value) => {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(
        "Public release exact-file policy contains an invalid path"
      );
    }
    const slashPath = value.replaceAll("\\", "/");
    const normalizedPath = normalize(slashPath).replaceAll(
      "\\",
      "/"
    );
    if (
      isAbsolute(value) ||
      normalizedPath !== slashPath ||
      normalizedPath === ".." ||
      normalizedPath.startsWith("../") ||
      normalizedPath.startsWith("data/") ||
      normalizedPath === "data"
    ) {
      throw new Error(
        `Public release exact-file policy contains an unsafe path: ${value}`
      );
    }
    return normalizedPath;
  });
  if (
    new Set(normalizedFiles).size !== normalizedFiles.length
  ) {
    throw new Error(
      "Public release exact-file policy contains duplicate paths"
    );
  }
  if (!normalizedFiles.includes(releaseFilePolicyPath)) {
    throw new Error(
      "Public release exact-file policy must list itself"
    );
  }
  const inventory = (await listFiles(pluginRoot))
    .map((path) =>
      relative(pluginRoot, path).replaceAll("\\", "/")
    )
    .filter(
      (path) =>
        path !== "data" &&
        !path.startsWith("data/")
    )
    .sort();
  const expected = [...normalizedFiles].sort();
  const expectedSet = new Set(expected);
  const inventorySet = new Set(inventory);
  const unexpected = inventory.filter(
    (path) => !expectedSet.has(path)
  );
  const missing = expected.filter(
    (path) => !inventorySet.has(path)
  );
  if (unexpected.length || missing.length) {
    throw new Error(
      [
        unexpected.length
          ? `unexpected files: ${unexpected.join(", ")}`
          : null,
        missing.length
          ? `missing files: ${missing.join(", ")}`
          : null
      ]
        .filter(Boolean)
        .join("; ")
    );
  }
  const approved = [];
  for (const normalizedPath of expected) {
    const path = join(pluginRoot, normalizedPath);
    const metadata = await lstat(path);
    if (
      metadata.isSymbolicLink() ||
      !metadata.isFile()
    ) {
      throw new Error(
        `Required public release file is unsafe: ${path}`
      );
    }
    approved.push(path);
  }
  return approved.sort((left, right) =>
    left.localeCompare(right)
  );
}

export async function snapshotApprovedFiles(
  pluginRoot,
  files
) {
  const snapshot = [];
  for (const source of files) {
    const metadata = await lstat(source);
    if (
      metadata.isSymbolicLink() ||
      !metadata.isFile()
    ) {
      throw new Error(
        `Approved source changed type during snapshot: ${source}`
      );
    }
    snapshot.push({
      path: relative(pluginRoot, source).replaceAll(
        "\\",
        "/"
      ),
      bytes: await readFile(source)
    });
  }
  return snapshot;
}

export async function copyApprovedSnapshot(
  destination,
  snapshot
) {
  for (const item of snapshot) {
    const target = join(
      destination,
      item.path
    );
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, item.bytes);
  }
}

async function assertNoObviousSecrets(root) {
  const findings = [];
  for (const path of await listFiles(root)) {
    const metadata = await stat(path);
    if (metadata.size > 8_000_000) {
      throw new Error(
        `Public release rejects unscanned files larger than 8 MB: ${path}`
      );
    }
    const text = await readFile(path, "utf8");
    for (const pattern of obviousSecretPatterns) {
      if (pattern.test(text)) {
        findings.push(
          relative(root, path).replaceAll("\\", "/")
        );
        break;
      }
    }
  }
  if (findings.length) {
    throw new Error(
      `Public release contains potential secret material: ${findings.join(", ")}`
    );
  }
}

async function inspectPublicData(pluginDestination) {
  const dataRoot = join(pluginDestination, "data");
  const [snapshot, catalog, dictionary, insightRuns] =
    await Promise.all([
      readFile(join(dataRoot, "snapshot.json"), "utf8").then(
        JSON.parse
      ),
      readFile(join(dataRoot, "catalog.json"), "utf8").then(
        JSON.parse
      ),
      readFile(
        join(dataRoot, "dictionary.json"),
        "utf8"
      ).then(JSON.parse),
      readFile(
        join(dataRoot, "insight-runs.json"),
        "utf8"
      ).then(JSON.parse)
    ]);
  const partitionRecords = Object.values(
    snapshot.partitions ?? {}
  ).reduce(
    (count, partition) =>
      count + (partition.articles?.length ?? 0),
    0
  );
  const publisherExcerpts = [
    ...(catalog.articles ?? []),
    ...Object.values(snapshot.partitions ?? {}).flatMap(
      (partition) => partition.articles ?? []
    )
  ].filter(
    (article) =>
      String(article.summary ?? "").trim() ||
      String(article.excerpt ?? "").trim()
  ).length;
  const result = {
    visibility: snapshot.visibility,
    articleRecords:
      (catalog.articles?.length ?? 0) +
      partitionRecords,
    dictionaryEntries:
      dictionary.entries?.length ?? 0,
    dictionaryRevisions:
      dictionary.revisions?.length ?? 0,
    insightRuns: insightRuns.runs?.length ?? 0,
    publisherExcerpts
  };
  if (
    result.visibility !== "public" ||
    result.articleRecords !== 0 ||
    result.dictionaryEntries !== 0 ||
    result.dictionaryRevisions !== 0 ||
    result.insightRuns !== 0 ||
    result.publisherExcerpts !== 0
  ) {
    throw new Error(
      `Public data assertion failed: ${JSON.stringify(result)}`
    );
  }
  return result;
}

export async function buildPublicRelease({
  pluginRoot = moduleRoot,
  outputRoot = resolve(
    process.env.K_TECH_RADAR_RELEASE_DIR ??
      join(
        moduleRoot,
        "..",
        "k-tech-radar-marketplace-0.3.0"
      )
  ),
  timestamp = fixedTimestamp()
} = {}) {
  try {
    await stat(outputRoot);
    throw new Error(
      `Release destination already exists; choose a new K_TECH_RADAR_RELEASE_DIR: ${outputRoot}`
    );
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
  const pluginDestination = join(
    outputRoot,
    "plugins",
    "k-tech-radar"
  );
  await checkQualityGate({ pluginRoot });
  const marketplacePath = join(
    outputRoot,
    ".agents",
    "plugins",
    "marketplace.json"
  );
  const approvedFiles = await approvedSourceFiles(pluginRoot);
  const approvedSnapshot =
    await snapshotApprovedFiles(
      pluginRoot,
      approvedFiles
    );
  await copyApprovedSnapshot(
    pluginDestination,
    approvedSnapshot
  );
  const seed = await seedPublicData({
    pluginRoot: pluginDestination,
    dataRoot: join(pluginDestination, "data"),
    timestamp
  });
  await writeJson(marketplacePath, {
    name: "k-tech-radar",
    interface: {
      displayName: "K-Tech Radar"
    },
    plugins: [
      {
        name: "k-tech-radar",
        source: {
          source: "local",
          path: "./plugins/k-tech-radar"
        },
        policy: {
          installation: "AVAILABLE",
          authentication: "ON_INSTALL"
        },
        category: "Developer Tools"
      }
    ]
  });
  await writeJson(
    join(pluginDestination, "sbom.cdx.json"),
    {
      bomFormat: "CycloneDX",
      specVersion: "1.5",
      serialNumber:
        "urn:uuid:6070c65a-6adc-4be2-b5c2-4ba54e995c5e",
      version: 1,
      metadata: {
        timestamp,
        component: {
          type: "application",
          name: "k-tech-radar",
          version: "0.3.0",
          licenses: [
            {
              license: {
                id: "MIT"
              }
            }
          ]
        }
      },
      components: []
    }
  );
  await checkQualityGate({
    pluginRoot: pluginDestination
  });
  const dataInspection =
    await inspectPublicData(pluginDestination);
  await assertNoObviousSecrets(outputRoot);
  const releaseFiles = (await listFiles(outputRoot))
    .filter(
      (path) =>
        !path.endsWith("RELEASE-MANIFEST.json")
    )
    .sort();
  const manifestFiles = [];
  for (const path of releaseFiles) {
    const bytes = await readFile(path);
    manifestFiles.push({
      path: relative(outputRoot, path).replaceAll(
        "\\",
        "/"
      ),
      bytes: bytes.length,
      sha256: createHash("sha256")
        .update(bytes)
        .digest("hex")
    });
  }
  await writeJson(
    join(outputRoot, "RELEASE-MANIFEST.json"),
    {
      schemaVersion: 2,
      name: "k-tech-radar-marketplace",
      version: "0.3.0",
      builtAt: timestamp,
      contentPolicy:
        "Allowlist-built public bundle with an explicit public empty snapshot; no publisher article records, excerpts, private Dictionary entries, or local InsightRun receipts are bundled.",
      sourceFileCount: approvedFiles.length,
      dataInspection,
      fileCount: manifestFiles.length,
      files: manifestFiles
    }
  );
  return {
    status: "ok",
    outputRoot,
    marketplacePath,
    pluginDestination,
    articleRecordsBundled:
      dataInspection.articleRecords,
    dictionaryEntriesBundled:
      dataInspection.dictionaryEntries,
    insightRunsBundled:
      dataInspection.insightRuns,
    publisherExcerptsBundled:
      dataInspection.publisherExcerpts,
    manifestEntries: manifestFiles.length,
    seed
  };
}
