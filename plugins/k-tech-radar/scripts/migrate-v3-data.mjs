#!/usr/bin/env node

import {
  buildSearchIndex
} from "../lib/index.mjs";
import {
  buildSnapshotIdentity,
  completeSourceStateRecord,
  configurationHash,
  partitionFingerprint,
  taxonomyHash,
  validateSnapshotBundle
} from "../lib/integrity.mjs";
import {
  upgradeDictionaryDocument,
  validateDictionaryRevisionChain
} from "../lib/dictionary.mjs";
import {
  validateStoredInsightRun
} from "../lib/insight-runs.mjs";
import {
  catalogPath,
  dictionaryPath,
  insightRunsPath,
  loadCatalog,
  loadConfig,
  loadDictionary,
  loadInsightRuns,
  loadSearchIndex,
  loadSnapshotContext,
  loadSourcePartition,
  loadSourceState,
  searchIndexPath,
  snapshotBundlePath,
  sourcePartitionPath,
  sourceStatePath,
  writeJson
} from "../lib/paths.mjs";
import {
  classifyArticle,
  loadTaxonomy
} from "../lib/taxonomy.mjs";
import { sha256 } from "../lib/text.mjs";
import {
  configuredWorkIdentity
} from "../lib/work-identity.mjs";

const [
  config,
  taxonomy,
  loadedSnapshot,
  dictionary,
  legacyCatalog,
  legacySearchIndex,
  legacySourceState,
  insightRuns
] =
  await Promise.all([
    loadConfig(),
    loadTaxonomy(),
    loadSnapshotContext(),
    loadDictionary(),
    loadCatalog(),
    loadSearchIndex(),
    loadSourceState(),
    loadInsightRuns()
  ]);

const legacyPartitions = Object.fromEntries(
  await Promise.all(
    config.sources.map(async (source) => [
      source.id,
      await loadSourcePartition(
        source.id,
        legacyCatalog.articles.filter(
          (article) => article.sourceId === source.id
        )
      )
    ])
  )
);
const snapshot =
  loadedSnapshot ?? {
    schemaVersion: 1,
    snapshotId: legacyCatalog.snapshotId ?? null,
    committedAt:
      legacySourceState.updatedAt ??
      legacyCatalog.refreshedAt ??
      null,
    catalog: legacyCatalog,
    searchIndex: legacySearchIndex,
    sourceState: legacySourceState,
    partitions: legacyPartitions
  };

const currentConfigHash = configurationHash(config);
const currentTaxonomyHash = taxonomyHash(taxonomy);
const migratedArticles = [];
const sourceById = new Map(
  config.sources.map((source) => [source.id, source])
);

for (const article of snapshot.catalog.articles) {
  const classification = await classifyArticle(
    article,
    taxonomy
  );
  const ontologyHash = sha256(
    JSON.stringify({
      businessUnitId: article.businessUnitId,
      namespacedTags: article.namespacedTags ?? [],
      domainIds: classification.domainIds,
      problemTypeIds: classification.problemTypeIds
    })
  );
  const source = sourceById.get(article.sourceId);
  if (!source) {
    throw new Error(
      `Cannot migrate article from unknown source ${article.sourceId}`
    );
  }
  const workIdentity = configuredWorkIdentity(
    source,
    article.canonicalUrl,
    article
  );
  migratedArticles.push({
    ...article,
    ...classification,
    ...workIdentity,
    ontologyHash,
    taxonomyHash: currentTaxonomyHash
  });
}

const committedAt =
  snapshot.committedAt ??
  snapshot.sourceState?.updatedAt ??
  new Date().toISOString();
const sources = Object.fromEntries(
  config.sources.map((source) => {
    const prior = snapshot.sourceState?.sources?.[source.id] ?? {
      status: "never-checked",
      lastCheckedAt: null,
      lastSuccessAt: null
    };
    return [
      source.id,
      completeSourceStateRecord({
        ...prior,
        lastAttemptAt:
          prior.lastAttemptAt ??
          prior.lastCheckedAt ??
          null,
        dataAsOf:
          prior.dataAsOf ??
          prior.lastSuccessAt ??
          null,
        errorCode:
          prior.errorCode ??
          (prior.error
            ? "LEGACY_COLLECTION_ERROR"
            : null),
        warningCount: prior.warningCount ?? 0
      })
    ];
  })
);
const successfulSourceIds = Object.entries(sources)
  .filter(([, state]) =>
    ["ok", "partial"].includes(state.status)
  )
  .map(([sourceId]) => sourceId);
const failedSourceIds = Object.entries(sources)
  .filter(([, state]) => state.status === "error")
  .map(([sourceId]) => sourceId);
const collectionStatus = failedSourceIds.length
  ? successfulSourceIds.length
    ? "partial"
    : "failed"
  : successfulSourceIds.length === config.sources.length
    ? "ok"
    : "partial";
const collection = {
  status: collectionStatus,
  attemptedAt: committedAt,
  mode: "schema-v2-migration",
  requestedSourceIds: config.sources.map(
    (source) => source.id
  ),
  succeededSourceIds: successfulSourceIds,
  failedSourceIds,
  unselectedSourceIds: []
};
const sourceState = {
  schemaVersion: 2,
  updatedAt:
    snapshot.sourceState?.updatedAt ?? committedAt,
  collectionStatus,
  snapshotId: null,
  sources
};
const catalog = {
  schemaVersion: 2,
  view: "derived-from-source-partitions",
  refreshedAt: snapshot.catalog.refreshedAt ?? null,
  lastAttemptAt:
    snapshot.catalog.lastAttemptAt ??
    snapshot.sourceState?.updatedAt ??
    null,
  collectionStatus,
  taxonomyHash: currentTaxonomyHash,
  configHash: currentConfigHash,
  snapshotId: null,
  catalogHash: null,
  articles: migratedArticles
};
const searchIndex = buildSearchIndex(
  migratedArticles,
  committedAt
);
searchIndex.snapshotId = null;
catalog.catalogHash = searchIndex.catalogHash;
const partitions = Object.fromEntries(
  config.sources.map((source) => {
    const articles = migratedArticles.filter(
      (article) => article.sourceId === source.id
    );
    const prior = snapshot.partitions?.[source.id] ?? {};
    const state = sources[source.id];
    const dataAsOf =
      state.dataAsOf ??
      prior.dataAsOf ??
      prior.refreshedAt ??
      null;
    return [
      source.id,
      {
        schemaVersion: 2,
        sourceId: source.id,
        companyId: source.companyId,
        snapshotId: null,
        refreshedAt: dataAsOf,
        dataAsOf,
        lastAttemptAt:
          state.lastAttemptAt ??
          prior.lastAttemptAt ??
          null,
        lastSuccessAt:
          state.lastSuccessAt ??
          prior.lastSuccessAt ??
          null,
        collectionStatus: state.status,
        recordCount: articles.length,
        sourceHash: partitionFingerprint(articles),
        articles
      }
    ];
  })
);
const changeSet = {
  newArticleIds: [],
  updatedArticleIds: [],
  reclassifiedArticleIds: migratedArticles
    .filter((article) => !article.taxonomyHash)
    .map((article) => article.articleId),
  migratedArticleIds: migratedArticles.map(
    (article) => article.articleId
  )
};
const identity = buildSnapshotIdentity({
  visibility: "local",
  configHash: currentConfigHash,
  taxonomyHash: currentTaxonomyHash,
  catalogHash: searchIndex.catalogHash,
  catalog,
  searchIndex,
  partitions,
  sourceState,
  collection,
  committedAt,
  changeSet
});
catalog.snapshotId = identity.snapshotId;
searchIndex.snapshotId = identity.snapshotId;
sourceState.snapshotId = identity.snapshotId;
for (const partition of Object.values(partitions)) {
  partition.snapshotId = identity.snapshotId;
}
const migratedSnapshot = {
  schemaVersion: 2,
  visibility: "local",
  snapshotId: identity.snapshotId,
  integrityHash: identity.integrityHash,
  committedAt,
  configHash: currentConfigHash,
  taxonomyHash: currentTaxonomyHash,
  collection,
  changeSet,
  catalog,
  searchIndex,
  sourceState,
  partitions
};
validateSnapshotBundle(
  migratedSnapshot,
  config,
  taxonomy
);
const migratedDictionary = upgradeDictionaryDocument(
  dictionary,
  catalog,
  taxonomy
);
for (const entry of migratedDictionary.entries) {
  validateDictionaryRevisionChain(
    entry,
    migratedDictionary,
    catalog,
    taxonomy
  );
}
for (const run of insightRuns.runs ?? []) {
  try {
    validateStoredInsightRun(run, {
      catalog,
      config,
      dictionary: migratedDictionary,
      taxonomy
    });
  } catch (error) {
    throw new Error(
      `Legacy InsightRun ${run.runId ?? "unknown"} requires explicit content-addressed review-artifact and committed-revision backfill before migration: ${error.message}`
    );
  }
}

await writeJson(snapshotBundlePath, migratedSnapshot);
await Promise.all([
  writeJson(catalogPath, catalog),
  writeJson(searchIndexPath, searchIndex),
  writeJson(sourceStatePath, sourceState),
  writeJson(dictionaryPath, migratedDictionary),
  writeJson(insightRunsPath, insightRuns),
  ...config.sources.map((source) =>
    writeJson(
      sourcePartitionPath(source.id),
      partitions[source.id]
    )
  )
]);

console.log(
  JSON.stringify(
    {
      status: "ok",
      snapshotId: identity.snapshotId,
      articleCount: migratedArticles.length,
      dictionaryEntries:
        migratedDictionary.entries.length,
      dictionaryRevisions:
        migratedDictionary.revisions.length
    },
    null,
    2
  )
);
