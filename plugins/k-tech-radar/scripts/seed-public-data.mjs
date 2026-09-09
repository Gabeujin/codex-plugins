#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { buildSearchIndex } from "../lib/index.mjs";
import {
  buildSnapshotIdentity,
  completeSourceStateRecord,
  configurationHash,
  partitionFingerprint,
  stableJson,
  taxonomyHash,
  validateSnapshotBundle
} from "../lib/integrity.mjs";
import { readJson } from "../lib/paths.mjs";
import {
  buildPublicDataCommitment,
  validatePublicDataObjects
} from "../lib/public-data.mjs";
import { sha256 } from "../lib/text.mjs";

const moduleRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  ".."
);

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

export async function seedPublicData({
  pluginRoot = moduleRoot,
  dataRoot = join(pluginRoot, "data"),
  timestamp = fixedTimestamp()
} = {}) {
  const [config, taxonomy] = await Promise.all([
    readJson(join(pluginRoot, "config", "sources.json")),
    readJson(
      join(pluginRoot, "ontology", "domain-taxonomy.json")
    )
  ]);
  const configHash = configurationHash(config);
  const currentTaxonomyHash = taxonomyHash(taxonomy);
  const searchIndex = buildSearchIndex([], timestamp);
  const collection = {
    status: "seed",
    attemptedAt: null,
    mode: "public-empty-seed",
    sourceSnapshotId: null,
    publisherExcerptPolicy: "metadata-only",
    requestedSourceIds: [],
    succeededSourceIds: [],
    failedSourceIds: [],
    unselectedSourceIds: config.sources.map(
      (source) => source.id
    )
  };
  const sourceState = {
    schemaVersion: 2,
    updatedAt: null,
    collectionStatus: "seed",
    snapshotId: null,
    sources: Object.fromEntries(
      config.sources.map((source) => [
        source.id,
        completeSourceStateRecord({
          status: "never-checked",
          lastCheckedAt: null,
          lastAttemptAt: null,
          lastSuccessAt: null,
          dataAsOf: null,
          error: null,
          errorCode: null,
          warningCount: 0
        })
      ])
    )
  };
  const catalog = {
    schemaVersion: 2,
    view: "derived-from-source-partitions",
    refreshedAt: null,
    lastAttemptAt: null,
    collectionStatus: "seed",
    taxonomyHash: currentTaxonomyHash,
    configHash,
    snapshotId: null,
    catalogHash: searchIndex.catalogHash,
    articles: []
  };
  const partitions = Object.fromEntries(
    config.sources.map((source) => [
      source.id,
      {
        schemaVersion: 2,
        sourceId: source.id,
        companyId: source.companyId,
        snapshotId: null,
        refreshedAt: null,
        dataAsOf: null,
        lastAttemptAt: null,
        lastSuccessAt: null,
        collectionStatus: "never-checked",
        recordCount: 0,
        sourceHash: partitionFingerprint([]),
        articles: []
      }
    ])
  );
  const dictionary = {
    schemaVersion: 2,
    revision: 0,
    updatedAt: null,
    entries: [],
    revisions: [],
    idempotency: {}
  };
  const insightRuns = {
    schemaVersion: 1,
    revision: 0,
    updatedAt: null,
    runs: [],
    idempotency: {}
  };
  const publicData = buildPublicDataCommitment(
    dictionary,
    insightRuns
  );
  searchIndex.snapshotId = null;
  const changeSet = {
    newArticleIds: [],
    updatedArticleIds: [],
    reclassifiedArticleIds: [],
    migratedArticleIds: []
  };
  const identity = buildSnapshotIdentity({
    visibility: "public",
    configHash,
    taxonomyHash: currentTaxonomyHash,
    catalogHash: searchIndex.catalogHash,
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
    configHash,
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
    sourceSnapshotId: null,
    publicSnapshotId: identity.snapshotId,
    visibility: "public",
    publisherExcerptPolicy: "metadata-only",
    articleCount: 0,
    dictionaryEntryCount: 0,
    dictionaryHash: publicData.dictionaryHash,
    dictionaryRevisionPins: [],
    insightRunCount: 0,
    insightRunsHash: publicData.insightRunsHash,
    publicDataHash: sha256(stableJson(publicData)),
    configHash,
    taxonomyHash: currentTaxonomyHash,
    integrityHash: identity.integrityHash
  };
  validatePublicDataObjects(
    snapshot,
    dictionary,
    insightRuns,
    manifest
  );
  await Promise.all([
    writeJson(join(dataRoot, "snapshot.json"), snapshot),
    writeJson(join(dataRoot, "catalog.json"), catalog),
    writeJson(
      join(dataRoot, "search-index.json"),
      searchIndex
    ),
    writeJson(
      join(dataRoot, "source-state.json"),
      sourceState
    ),
    writeJson(
      join(dataRoot, "dictionary.json"),
      dictionary
    ),
    writeJson(
      join(dataRoot, "insight-runs.json"),
      insightRuns
    ),
    writeJson(
      join(dataRoot, "PUBLIC-SNAPSHOT-MANIFEST.json"),
      manifest
    ),
    ...config.sources.map((source) =>
      writeJson(
        join(
          dataRoot,
          "partitions",
          source.id,
          "articles.json"
        ),
        partitions[source.id]
      )
    )
  ]);
  return {
    snapshotId: identity.snapshotId,
    articleRecords: 0,
    dictionaryEntries: 0,
    insightRuns: 0,
    publisherExcerpts: 0
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const dataRoot = resolve(
    process.argv[2] ?? join(moduleRoot, "data")
  );
  console.log(
    JSON.stringify(
      await seedPublicData({
        pluginRoot: moduleRoot,
        dataRoot
      }),
      null,
      2
    )
  );
}
