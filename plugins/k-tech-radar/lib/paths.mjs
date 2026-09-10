import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));

export const pluginRoot = resolve(moduleDir, "..");
export const configPath = join(pluginRoot, "config", "sources.json");
export const taxonomyPath = join(pluginRoot, "ontology", "domain-taxonomy.json");
export const ontologySchemaPath = join(pluginRoot, "ontology", "ontology.schema.json");
export const bundledDataRoot = join(pluginRoot, "data");

export function isManagedInstallPath(value) {
  const normalized = resolve(String(value))
    .replaceAll("\\", "/")
    .toLowerCase();
  return (
    normalized.includes("/.codex/plugins/cache/") ||
    normalized.includes("/.agents/plugins/cache/")
  );
}

export function resolveDefaultDataRoot({
  environment = process.env,
  platform = process.platform,
  userHome = homedir(),
  root = pluginRoot
} = {}) {
  if (environment.K_TECH_RADAR_DATA_DIR) {
    return resolve(environment.K_TECH_RADAR_DATA_DIR);
  }
  if (
    environment.K_TECH_RADAR_USE_BUNDLED_DATA === "1"
  ) {
    return join(root, "data");
  }
  if (platform === "win32") {
    const localAppData =
      environment.LOCALAPPDATA ??
      join(userHome, "AppData", "Local");
    return join(localAppData, "KTechRadar", "data");
  }
  if (platform === "darwin") {
    return join(
      userHome,
      "Library",
      "Application Support",
      "KTechRadar",
      "data"
    );
  }
  const xdgDataHome =
    environment.XDG_DATA_HOME ?? join(userHome, ".local", "share");
  return join(xdgDataHome, "k-tech-radar");
}

export const dataRoot = resolveDefaultDataRoot();

export const catalogPath = join(dataRoot, "catalog.json");
export const dictionaryPath = join(dataRoot, "dictionary.json");
export const insightRunsPath = join(dataRoot, "insight-runs.json");
export const searchIndexPath = join(dataRoot, "search-index.json");
export const sourceStatePath = join(dataRoot, "source-state.json");
export const snapshotBundlePath = join(dataRoot, "snapshot.json");
export const partitionsRoot = join(dataRoot, "partitions");

export function sourcePartitionPath(sourceId) {
  const value = String(sourceId);
  if (!/^[a-z0-9-]+$/.test(value)) {
    throw new Error(`Invalid source partition id: ${value}`);
  }
  return join(partitionsRoot, value, "articles.json");
}

export function bundledSourcePartitionPath(sourceId) {
  const value = String(sourceId);
  if (!/^[a-z0-9-]+$/.test(value)) {
    throw new Error(`Invalid source partition id: ${value}`);
  }
  return join(bundledDataRoot, "partitions", value, "articles.json");
}

export async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT" && fallback !== undefined) {
      return structuredClone(fallback);
    }
    throw error;
  }
}

async function readRuntimeOrBundled(runtimePath, bundledPath, fallback) {
  try {
    return await readJson(runtimePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
  return readJson(bundledPath, fallback);
}

export async function loadSnapshotBundle() {
  return readRuntimeOrBundled(
    snapshotBundlePath,
    join(bundledDataRoot, "snapshot.json"),
    null
  );
}

export async function loadSnapshotContext({
  requireVisibility
} = {}) {
  const snapshot = await loadSnapshotBundle();
  if (!snapshot) {
    return null;
  }
  const visibility = snapshot.visibility ?? "local";
  if (
    requireVisibility &&
    visibility !== requireVisibility
  ) {
    throw new Error(
      `Snapshot visibility ${visibility} cannot be used as ${requireVisibility} data`
    );
  }
  return {
    ...snapshot,
    visibility
  };
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(
    temporaryPath,
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8"
  );
  await rename(temporaryPath, path);
}

export async function loadConfig() {
  return readJson(configPath);
}

export async function loadCatalog() {
  const snapshot = await loadSnapshotBundle();
  if (snapshot?.catalog) {
    return snapshot.catalog;
  }
  return readRuntimeOrBundled(
    catalogPath,
    join(bundledDataRoot, "catalog.json"),
    {
    schemaVersion: 1,
    refreshedAt: null,
    articles: []
    }
  );
}

export async function loadDictionary() {
  return readRuntimeOrBundled(
    dictionaryPath,
    join(bundledDataRoot, "dictionary.json"),
    {
    schemaVersion: 2,
    revision: 0,
    updatedAt: null,
    entries: [],
    revisions: [],
    idempotency: {}
    }
  );
}

export async function loadInsightRuns() {
  return readRuntimeOrBundled(
    insightRunsPath,
    join(bundledDataRoot, "insight-runs.json"),
    {
      schemaVersion: 1,
      revision: 0,
      updatedAt: null,
      runs: [],
      idempotency: {}
    }
  );
}

export async function loadSearchIndex() {
  const snapshot = await loadSnapshotBundle();
  if (snapshot?.searchIndex) {
    return snapshot.searchIndex;
  }
  return readRuntimeOrBundled(
    searchIndexPath,
    join(bundledDataRoot, "search-index.json"),
    {
    schemaVersion: 1,
    builtAt: null,
    documentCount: 0,
    averageDocumentLength: 0,
    documents: [],
    postings: {}
    }
  );
}

export async function loadSourceState() {
  const snapshot = await loadSnapshotBundle();
  if (snapshot?.sourceState) {
    return snapshot.sourceState;
  }
  return readRuntimeOrBundled(
    sourceStatePath,
    join(bundledDataRoot, "source-state.json"),
    {
    schemaVersion: 1,
    updatedAt: null,
    sources: {}
    }
  );
}

export async function loadSourcePartition(sourceId, fallbackArticles = []) {
  const snapshot = await loadSnapshotBundle();
  if (snapshot?.partitions?.[sourceId]) {
    return snapshot.partitions[sourceId];
  }
  return readRuntimeOrBundled(
    sourcePartitionPath(sourceId),
    bundledSourcePartitionPath(sourceId),
    {
      schemaVersion: 1,
      sourceId,
      refreshedAt: null,
      articles: structuredClone(fallbackArticles)
    }
  );
}
