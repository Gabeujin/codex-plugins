import { sha256, tokenize } from "./text.mjs";

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

export function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

export function configurationHash(config) {
  return sha256(stableJson(config));
}

export function taxonomyHash(taxonomy) {
  return sha256(stableJson(taxonomy));
}

export function publisherContentTrust() {
  return {
    kind: "untrusted-third-party-content",
    trustLevel: "untrusted-publisher-content",
    instructionsAllowed: false,
    mayContainPromptInjection: true
  };
}

const articleFields = new Set([
  "articleId",
  "sourceId",
  "companyId",
  "companyName",
  "sourceName",
  "sourceHomepage",
  "language",
  "evidenceAuthority",
  "storagePolicy",
  "businessUnitId",
  "canonicalUrl",
  "canonicalWorkId",
  "translationOf",
  "workIdentityBasis",
  "workIndependenceStatus",
  "title",
  "summary",
  "publishedAt",
  "publisherUpdatedAt",
  "authors",
  "tags",
  "rawPublisherTags",
  "namespacedTags",
  "domainIds",
  "problemTypeIds",
  "metadataState",
  "contentHash",
  "ontologyHash",
  "revisionHash",
  "recordStatus",
  "fetchedAt",
  "revisions",
  "firstSeenAt",
  "lastSeenAt",
  "lastChangedAt",
  "taxonomyHash"
]);

function articlePayload(article) {
  if (
    !article ||
    typeof article !== "object" ||
    Array.isArray(article)
  ) {
    throw new Error("Article records must be objects");
  }
  const unknown = Object.keys(article).filter(
    (field) => !articleFields.has(field)
  );
  if (unknown.length) {
    throw new Error(
      `Article ${article.articleId ?? "(missing id)"} contains unsupported persisted fields: ${unknown.join(", ")}`
    );
  }
  return structuredClone(article);
}

export function catalogFingerprint(articles) {
  return sha256(
    stableJson(
      articles
        .filter(
          (article) => (article.recordStatus ?? "active") === "active"
        )
        .map(articlePayload)
        .sort((left, right) =>
          left.articleId.localeCompare(right.articleId)
        )
    )
  );
}

function tokenFrequencies(tokens) {
  const result = new Map();
  for (const token of tokens) {
    result.set(token, (result.get(token) ?? 0) + 1);
  }
  return result;
}

function canonicalArticleTokens(article) {
  return [
    ...tokenize(article.title).flatMap((token) => [
      token,
      token,
      token
    ]),
    ...tokenize((article.tags ?? []).join(" ")).flatMap(
      (token) => [token, token]
    ),
    ...tokenize((article.domainIds ?? []).join(" ")),
    ...tokenize((article.problemTypeIds ?? []).join(" ")),
    ...tokenize(article.summary)
  ];
}

export function buildCanonicalSearchIndex(
  articles,
  builtAt = new Date().toISOString()
) {
  const activeArticles = articles.filter(
    (article) =>
      (article.recordStatus ?? "active") === "active"
  );
  const documents = [];
  const postings = {};
  let totalLength = 0;

  for (const [documentIndex, article] of activeArticles.entries()) {
    const tokens = canonicalArticleTokens(article);
    const termFrequency = tokenFrequencies(tokens);
    totalLength += tokens.length;
    documents.push({
      articleId: article.articleId,
      sourceId: article.sourceId,
      companyId: article.companyId,
      domainIds: article.domainIds ?? [],
      problemTypeIds: article.problemTypeIds ?? [],
      publishedAt: article.publishedAt,
      length: tokens.length
    });

    for (const [token, count] of termFrequency.entries()) {
      postings[token] ??= [];
      postings[token].push([documentIndex, count]);
    }
  }

  return {
    schemaVersion: 1,
    builtAt,
    catalogHash: catalogFingerprint(activeArticles),
    documentCount: documents.length,
    averageDocumentLength: documents.length
      ? totalLength / documents.length
      : 0,
    documents,
    postings
  };
}

export function partitionFingerprint(articles) {
  return sha256(
    stableJson(
      articles
        .map(articlePayload)
        .sort((left, right) =>
          left.articleId.localeCompare(right.articleId)
        )
    )
  );
}

export function searchIndexFingerprint(searchIndex) {
  if (
    !searchIndex ||
    typeof searchIndex !== "object" ||
    Array.isArray(searchIndex)
  ) {
    throw new Error("Search index must be an object");
  }
  const {
    snapshotId: _snapshotId,
    ...committedIndex
  } = searchIndex;
  return sha256(stableJson(committedIndex));
}

function configuredHosts(source) {
  return new Set(
    [
      source.homepage,
      source.adapter?.url,
      source.adapter?.backfillSitemapUrl,
      source.adapter?.latestListUrl,
      source.adapter?.fallbackListUrl
    ]
      .filter(Boolean)
      .map((value) => new URL(value).hostname.toLowerCase())
  );
}

function assertHexHash(value, field) {
  if (!/^[a-f0-9]{64}$/u.test(String(value ?? ""))) {
    throw new Error(`${field} must be a lowercase SHA-256 hash`);
  }
}

function assertExactKeys(value, expectedFields, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedFields].sort();
  if (stableJson(actual) !== stableJson(expected)) {
    const missing = expected.filter((field) => !actual.includes(field));
    const unexpected = actual.filter((field) => !expected.includes(field));
    throw new Error(
      `${label} fields must match the schema exactly` +
        `${missing.length ? `; missing: ${missing.join(", ")}` : ""}` +
        `${unexpected.length ? `; unsupported: ${unexpected.join(", ")}` : ""}`
    );
  }
}

function assertNullableString(value, label) {
  if (value !== null && typeof value !== "string") {
    throw new Error(`${label} must be a string or null`);
  }
}

function assertUniqueStringArray(value, label) {
  if (
    !Array.isArray(value) ||
    value.some(
      (item) =>
        typeof item !== "string" || item.length === 0
    ) ||
    new Set(value).size !== value.length
  ) {
    throw new Error(
      `${label} must be an array of unique non-empty strings`
    );
  }
}

const sourceStateFields = [
  "status",
  "lastCheckedAt",
  "lastAttemptAt",
  "lastSuccessAt",
  "dataAsOf",
  "articleCountSeen",
  "endpoint",
  "etag",
  "lastModified",
  "durationMs",
  "error",
  "errorCode",
  "warningCount"
];

export function completeSourceStateRecord(state = {}) {
  return {
    status: state.status ?? "never-checked",
    lastCheckedAt: state.lastCheckedAt ?? null,
    lastAttemptAt:
      state.lastAttemptAt ?? state.lastCheckedAt ?? null,
    lastSuccessAt: state.lastSuccessAt ?? null,
    dataAsOf:
      state.dataAsOf ?? state.lastSuccessAt ?? null,
    articleCountSeen:
      Number.isInteger(state.articleCountSeen)
        ? state.articleCountSeen
        : null,
    endpoint: state.endpoint ?? null,
    etag: state.etag ?? null,
    lastModified: state.lastModified ?? null,
    durationMs:
      Number.isFinite(state.durationMs)
        ? state.durationMs
        : null,
    error: state.error ?? null,
    errorCode: state.errorCode ?? null,
    warningCount:
      Number.isInteger(state.warningCount)
        ? state.warningCount
        : null
  };
}

export function validateSourcePartition(partition, source) {
  if (!partition || typeof partition !== "object") {
    throw new Error(`Partition ${source.id} must be an object`);
  }
  if (partition.sourceId !== source.id) {
    throw new Error(
      `Partition ${source.id} declares sourceId=${partition.sourceId}`
    );
  }
  if (partition.companyId !== source.companyId) {
    throw new Error(
      `Partition ${source.id} declares companyId=${partition.companyId}`
    );
  }
  if (!Array.isArray(partition.articles)) {
    throw new Error(`Partition ${source.id} articles must be an array`);
  }
  if (partition.recordCount !== partition.articles.length) {
    throw new Error(
      `Partition ${source.id} recordCount does not match articles`
    );
  }
  const hosts = configuredHosts(source);
  const ids = new Set();
  for (const article of partition.articles) {
    if (
      typeof article.articleId !== "string" ||
      !article.articleId.startsWith(`${source.id}:`)
    ) {
      throw new Error(
        `Partition ${source.id} contains an article outside its namespace`
      );
    }
    if (ids.has(article.articleId)) {
      throw new Error(
        `Partition ${source.id} contains duplicate articleId ${article.articleId}`
      );
    }
    ids.add(article.articleId);
    if (
      article.sourceId !== source.id ||
      article.companyId !== source.companyId
    ) {
      throw new Error(
        `Article ${article.articleId} crosses its configured publisher partition`
      );
    }
    let canonicalUrl;
    try {
      canonicalUrl = new URL(article.canonicalUrl);
    } catch {
      throw new Error(
        `Article ${article.articleId} has an invalid canonical URL`
      );
    }
    if (
      canonicalUrl.protocol !== "https:" ||
      !hosts.has(canonicalUrl.hostname.toLowerCase())
    ) {
      throw new Error(
        `Article ${article.articleId} canonical URL is outside its official source boundary`
      );
    }
    assertHexHash(article.contentHash, `${article.articleId}.contentHash`);
    assertHexHash(article.ontologyHash, `${article.articleId}.ontologyHash`);
  }
  const computedHash = partitionFingerprint(partition.articles);
  if (partition.sourceHash !== computedHash) {
    throw new Error(
      `Partition ${source.id} sourceHash does not match its records`
    );
  }
  return {
    sourceId: source.id,
    companyId: source.companyId,
    recordCount: partition.articles.length,
    sourceHash: computedHash
  };
}

function snapshotStateProjection(sourceState) {
  const topLevelFields = [
    "schemaVersion",
    "updatedAt",
    "collectionStatus",
    "snapshotId",
    "sources"
  ];
  assertExactKeys(sourceState, topLevelFields, "Source state");
  if (
    !sourceState.sources ||
    typeof sourceState.sources !== "object" ||
    Array.isArray(sourceState.sources)
  ) {
    throw new Error("Source state sources must be an object");
  }
  if (sourceState.schemaVersion !== 2) {
    throw new Error("Source state schemaVersion must be 2");
  }
  assertNullableString(
    sourceState.updatedAt,
    "Source state updatedAt"
  );
  if (typeof sourceState.collectionStatus !== "string") {
    throw new Error(
      "Source state collectionStatus must be a string"
    );
  }
  return {
    schemaVersion: sourceState.schemaVersion,
    updatedAt: sourceState.updatedAt,
    collectionStatus: sourceState.collectionStatus,
    sources: Object.fromEntries(
      Object.entries(sourceState.sources)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([sourceId, state]) => {
          assertExactKeys(
            state,
            sourceStateFields,
            `Source state ${sourceId}`
          );
          if (typeof state.status !== "string") {
            throw new Error(
              `Source state ${sourceId}.status must be a string`
            );
          }
          for (const field of [
            "lastCheckedAt",
            "lastAttemptAt",
            "lastSuccessAt",
            "dataAsOf",
            "endpoint",
            "etag",
            "lastModified",
            "error",
            "errorCode"
          ]) {
            assertNullableString(
              state[field],
              `Source state ${sourceId}.${field}`
            );
          }
          for (const field of [
            "articleCountSeen",
            "warningCount"
          ]) {
            if (
              state[field] !== null &&
              (!Number.isSafeInteger(state[field]) ||
                state[field] < 0)
            ) {
              throw new Error(
                `Source state ${sourceId}.${field} must be a non-negative integer or null`
              );
            }
          }
          if (
            state.durationMs !== null &&
            (!Number.isFinite(state.durationMs) ||
              state.durationMs < 0)
          ) {
            throw new Error(
              `Source state ${sourceId}.durationMs must be a non-negative number or null`
            );
          }
          return [
            sourceId,
            {
              status: state.status,
              lastCheckedAt: state.lastCheckedAt,
              lastAttemptAt: state.lastAttemptAt,
              lastSuccessAt: state.lastSuccessAt,
              dataAsOf: state.dataAsOf,
              articleCountSeen: state.articleCountSeen,
              endpoint: state.endpoint,
              etag: state.etag,
              lastModified: state.lastModified,
              durationMs: state.durationMs,
              error: state.error,
              errorCode: state.errorCode,
              warningCount: state.warningCount
            }
          ];
        })
    )
  };
}

const catalogFields = [
  "schemaVersion",
  "view",
  "refreshedAt",
  "lastAttemptAt",
  "collectionStatus",
  "taxonomyHash",
  "configHash",
  "snapshotId",
  "catalogHash",
  "articles"
];

const searchIndexFields = [
  "schemaVersion",
  "builtAt",
  "catalogHash",
  "documentCount",
  "averageDocumentLength",
  "documents",
  "postings",
  "snapshotId"
];

const partitionFields = [
  "schemaVersion",
  "sourceId",
  "companyId",
  "snapshotId",
  "refreshedAt",
  "dataAsOf",
  "lastAttemptAt",
  "lastSuccessAt",
  "collectionStatus",
  "recordCount",
  "sourceHash",
  "articles"
];

const localCollectionFields = [
  "status",
  "attemptedAt",
  "mode",
  "requestedSourceIds",
  "succeededSourceIds",
  "failedSourceIds",
  "unselectedSourceIds"
];

const publicCollectionFields = [
  ...localCollectionFields,
  "sourceSnapshotId",
  "publisherExcerptPolicy"
];

const changeSetFields = [
  "newArticleIds",
  "updatedArticleIds",
  "reclassifiedArticleIds",
  "migratedArticleIds"
];

function catalogStateProjection(catalog) {
  assertExactKeys(catalog, catalogFields, "Snapshot catalog");
  if (
    catalog.schemaVersion !== 2 ||
    catalog.view !== "derived-from-source-partitions"
  ) {
    throw new Error(
      "Snapshot catalog schemaVersion/view is invalid"
    );
  }
  for (const field of [
    "refreshedAt",
    "lastAttemptAt"
  ]) {
    assertNullableString(
      catalog[field],
      `Snapshot catalog.${field}`
    );
  }
  if (typeof catalog.collectionStatus !== "string") {
    throw new Error(
      "Snapshot catalog.collectionStatus must be a string"
    );
  }
  assertHexHash(catalog.taxonomyHash, "catalog.taxonomyHash");
  assertHexHash(catalog.configHash, "catalog.configHash");
  assertHexHash(catalog.catalogHash, "catalog.catalogHash");
  return {
    schemaVersion: catalog.schemaVersion,
    view: catalog.view,
    refreshedAt: catalog.refreshedAt,
    lastAttemptAt: catalog.lastAttemptAt,
    collectionStatus: catalog.collectionStatus,
    taxonomyHash: catalog.taxonomyHash,
    configHash: catalog.configHash,
    catalogHash: catalog.catalogHash
  };
}

function collectionProjection(collection, visibility) {
  assertExactKeys(
    collection,
    visibility === "public"
      ? publicCollectionFields
      : localCollectionFields,
    "Snapshot collection"
  );
  if (
    typeof collection.status !== "string" ||
    typeof collection.mode !== "string"
  ) {
    throw new Error(
      "Snapshot collection status and mode must be strings"
    );
  }
  assertNullableString(
    collection.attemptedAt,
    "Snapshot collection.attemptedAt"
  );
  for (const field of [
    "requestedSourceIds",
    "succeededSourceIds",
    "failedSourceIds",
    "unselectedSourceIds"
  ]) {
    assertUniqueStringArray(
      collection[field],
      `Snapshot collection.${field}`
    );
  }
  if (visibility === "public") {
    assertNullableString(
      collection.sourceSnapshotId,
      "Snapshot collection.sourceSnapshotId"
    );
    if (
      ![
        "metadata-only",
        "bounded-rights-confirmed"
      ].includes(collection.publisherExcerptPolicy)
    ) {
      throw new Error(
        "Snapshot collection.publisherExcerptPolicy is invalid"
      );
    }
  }
  return structuredClone(collection);
}

function validatePublicArticleProjection(
  articles,
  publisherExcerptPolicy
) {
  const expectedStoragePolicy = {
    storesFullText: false,
    contentFetch: "on-demand-excerpt",
    publicSnapshot: publisherExcerptPolicy
  };
  for (const article of articles) {
    assertExactKeys(
      article.storagePolicy,
      [
        "storesFullText",
        "contentFetch",
        "publicSnapshot"
      ],
      `Public article ${article.articleId}.storagePolicy`
    );
    if (
      stableJson(article.storagePolicy) !==
      stableJson(expectedStoragePolicy)
    ) {
      throw new Error(
        `Public article ${article.articleId} storage policy does not match collection.publisherExcerptPolicy`
      );
    }
    if (
      typeof article.summary !== "string" ||
      article.summary.length > 600
    ) {
      throw new Error(
        `Public article ${article.articleId} summary must be a string capped at 600 characters`
      );
    }
    if (
      publisherExcerptPolicy === "metadata-only" &&
      article.summary !== ""
    ) {
      throw new Error(
        `Public article ${article.articleId} contains publisher text under a metadata-only policy`
      );
    }
  }
}

function changeSetProjection(changeSet) {
  assertExactKeys(changeSet, changeSetFields, "Snapshot changeSet");
  for (const field of changeSetFields) {
    assertUniqueStringArray(
      changeSet[field],
      `Snapshot changeSet.${field}`
    );
  }
  return structuredClone(changeSet);
}

export function buildSnapshotIdentity({
  visibility,
  configHash,
  taxonomyHash: currentTaxonomyHash,
  catalogHash,
  catalog,
  searchIndex,
  partitions,
  sourceState,
  collection,
  committedAt,
  changeSet,
  publicData = null
}) {
  if (!["local", "public"].includes(visibility)) {
    throw new Error("Snapshot visibility must be local or public");
  }
  if (catalog?.catalogHash !== catalogHash) {
    throw new Error("Snapshot catalogHash argument does not match catalog");
  }
  assertExactKeys(
    searchIndex,
    searchIndexFields,
    "Snapshot search index"
  );
  if (
    searchIndex.schemaVersion !== 1 ||
    typeof searchIndex.builtAt !== "string" ||
    !Number.isSafeInteger(searchIndex.documentCount) ||
    searchIndex.documentCount < 0 ||
    !Number.isFinite(searchIndex.averageDocumentLength) ||
    searchIndex.averageDocumentLength < 0 ||
    !Array.isArray(searchIndex.documents) ||
    !searchIndex.postings ||
    typeof searchIndex.postings !== "object" ||
    Array.isArray(searchIndex.postings)
  ) {
    throw new Error("Snapshot search index shape is invalid");
  }
  assertHexHash(
    searchIndex.catalogHash,
    "searchIndex.catalogHash"
  );
  for (const [index, document] of searchIndex.documents.entries()) {
    assertExactKeys(
      document,
      [
        "articleId",
        "sourceId",
        "companyId",
        "domainIds",
        "problemTypeIds",
        "publishedAt",
        "length"
      ],
      `Search document ${index}`
    );
    for (const field of [
      "articleId",
      "sourceId",
      "companyId"
    ]) {
      if (typeof document[field] !== "string") {
        throw new Error(
          `Search document ${index}.${field} must be a string`
        );
      }
    }
    assertNullableString(
      document.publishedAt,
      `Search document ${index}.publishedAt`
    );
    assertUniqueStringArray(
      document.domainIds,
      `Search document ${index}.domainIds`
    );
    assertUniqueStringArray(
      document.problemTypeIds,
      `Search document ${index}.problemTypeIds`
    );
    if (
      !Number.isSafeInteger(document.length) ||
      document.length < 0
    ) {
      throw new Error(
        `Search document ${index}.length must be a non-negative integer`
      );
    }
  }
  for (const [token, posting] of Object.entries(
    searchIndex.postings
  )) {
    if (
      !token ||
      !Array.isArray(posting) ||
      posting.some(
        (pair) =>
          !Array.isArray(pair) ||
          pair.length !== 2 ||
          !Number.isSafeInteger(pair[0]) ||
          pair[0] < 0 ||
          pair[0] >= searchIndex.documents.length ||
          !Number.isSafeInteger(pair[1]) ||
          pair[1] < 1
      )
    ) {
      throw new Error(
        `Search index posting ${token || "(empty)"} is invalid`
      );
    }
  }
  if (
    !partitions ||
    typeof partitions !== "object" ||
    Array.isArray(partitions)
  ) {
    throw new Error("Snapshot partitions must be an object");
  }
  const partitionHashes = Object.fromEntries(
    Object.entries(partitions)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([sourceId, partition]) => {
        assertExactKeys(
          partition,
          partitionFields,
          `Partition ${sourceId}`
        );
        return [
          sourceId,
          {
            schemaVersion: partition.schemaVersion,
            sourceId: partition.sourceId,
            companyId: partition.companyId,
            sourceHash: partition.sourceHash,
            recordCount: partition.recordCount,
            refreshedAt: partition.refreshedAt,
            dataAsOf: partition.dataAsOf,
            lastAttemptAt: partition.lastAttemptAt,
            lastSuccessAt: partition.lastSuccessAt,
            collectionStatus: partition.collectionStatus
          }
        ];
      })
  );
  const integrityHash = sha256(
    stableJson({
      schemaVersion: 2,
      visibility,
      committedAt,
      configHash,
      taxonomyHash: currentTaxonomyHash,
      catalogHash,
      catalog: catalogStateProjection(catalog),
      searchIndexHash: searchIndexFingerprint(searchIndex),
      partitions: partitionHashes,
      sourceState: snapshotStateProjection(sourceState),
      collection: collectionProjection(collection, visibility),
      changeSet: changeSetProjection(changeSet),
      publicData
    })
  );
  return {
    snapshotId: `snapshot:${integrityHash.slice(0, 20)}`,
    integrityHash
  };
}

export function validateSnapshotBundle(bundle, config, taxonomy) {
  if (!bundle || typeof bundle !== "object") {
    throw new Error("Snapshot bundle must be an object");
  }
  if (![1, 2].includes(bundle.schemaVersion)) {
    throw new Error(
      `Unsupported snapshot schemaVersion ${bundle.schemaVersion}`
    );
  }
  const partitions = bundle.partitions ?? {};
  const expectedSourceIds = config.sources
    .map((source) => source.id)
    .sort();
  const actualSourceIds = Object.keys(partitions).sort();
  if (stableJson(expectedSourceIds) !== stableJson(actualSourceIds)) {
    throw new Error(
      "Snapshot partitions do not exactly match configured official sources"
    );
  }
  const sourceStateIds = Object.keys(
    bundle.sourceState?.sources ?? {}
  ).sort();
  if (
    stableJson(expectedSourceIds) !==
    stableJson(sourceStateIds)
  ) {
    throw new Error(
      "Snapshot source state does not exactly match configured official sources"
    );
  }
  const seenArticleIds = new Set();
  const partitionArticles = [];
  for (const source of config.sources) {
    validateSourcePartition(partitions[source.id], source);
    for (const article of partitions[source.id].articles) {
      if (seenArticleIds.has(article.articleId)) {
        throw new Error(
          `Article ${article.articleId} appears in multiple partition records`
        );
      }
      seenArticleIds.add(article.articleId);
      partitionArticles.push(article);
    }
  }
  const catalogArticles = bundle.catalog?.articles;
  if (!Array.isArray(catalogArticles)) {
    throw new Error("Snapshot catalog articles must be an array");
  }
  const catalogProjection = catalogArticles
    .map(articlePayload)
    .sort((left, right) => left.articleId.localeCompare(right.articleId));
  const partitionProjection = partitionArticles
    .map(articlePayload)
    .sort((left, right) => left.articleId.localeCompare(right.articleId));
  if (stableJson(catalogProjection) !== stableJson(partitionProjection)) {
    throw new Error(
      "Derived catalog is not the exact multiset union of source partitions"
    );
  }
  const computedCatalogHash = catalogFingerprint(catalogArticles);
  if (
    bundle.catalog.catalogHash !== computedCatalogHash ||
    bundle.searchIndex?.catalogHash !== computedCatalogHash
  ) {
    throw new Error(
      "Catalog and search index fingerprints do not match snapshot records"
    );
  }
  if (
    bundle.searchIndex?.documentCount !==
    catalogArticles.filter(
      (article) => (article.recordStatus ?? "active") === "active"
    ).length
  ) {
    throw new Error(
      "Search index document count does not match active catalog records"
    );
  }
  const expectedSearchIndex = buildCanonicalSearchIndex(
    catalogArticles,
    bundle.searchIndex?.builtAt
  );
  const committedSearchIndex = Object.fromEntries(
    Object.keys(expectedSearchIndex).map((field) => [
      field,
      bundle.searchIndex?.[field]
    ])
  );
  if (
    stableJson(committedSearchIndex) !==
    stableJson(expectedSearchIndex)
  ) {
    throw new Error(
      "Search index does not semantically match the committed catalog"
    );
  }
  if (bundle.schemaVersion >= 2) {
    const visibility = bundle.visibility;
    if (!["local", "public"].includes(visibility)) {
      throw new Error(
        "Snapshot visibility must be local or public"
      );
    }
    assertExactKeys(
      bundle,
      visibility === "public"
        ? [
            "schemaVersion",
            "visibility",
            "snapshotId",
            "integrityHash",
            "committedAt",
            "configHash",
            "taxonomyHash",
            "collection",
            "publicData",
            "changeSet",
            "catalog",
            "searchIndex",
            "sourceState",
            "partitions"
          ]
        : [
            "schemaVersion",
            "visibility",
            "snapshotId",
            "integrityHash",
            "committedAt",
            "configHash",
            "taxonomyHash",
            "collection",
            "changeSet",
            "catalog",
            "searchIndex",
            "sourceState",
            "partitions"
          ],
      "Snapshot bundle"
    );
    if (
      !/^snapshot:[a-f0-9]{20}$/u.test(
        String(bundle.snapshotId ?? "")
      )
    ) {
      throw new Error("Snapshot snapshotId is invalid");
    }
    assertHexHash(
      bundle.integrityHash,
      "snapshot.integrityHash"
    );
    if (
      typeof bundle.committedAt !== "string" ||
      !Number.isFinite(Date.parse(bundle.committedAt))
    ) {
      throw new Error(
        "Snapshot committedAt must be an ISO-8601 timestamp"
      );
    }
    assertExactKeys(
      bundle.catalog,
      catalogFields,
      "Snapshot catalog"
    );
    assertExactKeys(
      bundle.searchIndex,
      searchIndexFields,
      "Snapshot search index"
    );
    snapshotStateProjection(bundle.sourceState);
    collectionProjection(bundle.collection, visibility);
    if (visibility === "public") {
      validatePublicArticleProjection(
        catalogArticles,
        bundle.collection.publisherExcerptPolicy
      );
    }
    changeSetProjection(bundle.changeSet);
    for (const [sourceId, partition] of Object.entries(partitions)) {
      assertExactKeys(
        partition,
        partitionFields,
        `Partition ${sourceId}`
      );
      if (partition.schemaVersion !== 2) {
        throw new Error(
          `Partition ${sourceId} schemaVersion must be 2`
        );
      }
    }
    for (const [label, snapshotId] of [
      ["catalog", bundle.catalog.snapshotId],
      ["search index", bundle.searchIndex.snapshotId],
      ["source state", bundle.sourceState.snapshotId],
      ...Object.entries(partitions).map(([sourceId, partition]) => [
        `partition ${sourceId}`,
        partition.snapshotId
      ])
    ]) {
      if (snapshotId !== bundle.snapshotId) {
        throw new Error(
          `Snapshot ${label} self-reference does not match snapshotId`
        );
      }
    }
    const expectedConfigHash = configurationHash(config);
    const expectedTaxonomyHash = taxonomyHash(taxonomy);
    if (bundle.configHash !== expectedConfigHash) {
      throw new Error("Snapshot configHash is stale or invalid");
    }
    if (bundle.taxonomyHash !== expectedTaxonomyHash) {
      throw new Error("Snapshot taxonomyHash is stale or invalid");
    }
    if (
      bundle.catalog.configHash !== bundle.configHash ||
      bundle.catalog.taxonomyHash !== bundle.taxonomyHash
    ) {
      throw new Error(
        "Snapshot catalog configuration commitments do not match the bundle"
      );
    }
    if (
      bundle.catalog.collectionStatus !==
        bundle.collection.status ||
      bundle.sourceState.collectionStatus !==
        bundle.collection.status
    ) {
      throw new Error(
        "Snapshot collection status commitments do not match"
      );
    }
    if (
      bundle.searchIndex.catalogHash !==
      bundle.catalog.catalogHash
    ) {
      throw new Error(
        "Snapshot search index catalogHash does not match the catalog"
      );
    }
    if (bundle.visibility === "public") {
      const publicData = bundle.publicData;
      assertExactKeys(
        publicData,
        [
          "schemaVersion",
          "dictionaryHash",
          "dictionaryEntryCount",
          "insightRunsHash",
          "insightRunCount"
        ],
        "Snapshot publicData"
      );
      if (
        publicData?.schemaVersion !== 1 ||
        !Number.isInteger(publicData.dictionaryEntryCount) ||
        publicData.dictionaryEntryCount < 0 ||
        !Number.isInteger(publicData.insightRunCount) ||
        publicData.insightRunCount < 0
      ) {
        throw new Error(
          "Public snapshot requires a bounded publicData commitment"
        );
      }
      assertHexHash(
        publicData.dictionaryHash,
        "publicData.dictionaryHash"
      );
      assertHexHash(
        publicData.insightRunsHash,
        "publicData.insightRunsHash"
      );
    } else if (bundle.publicData !== undefined) {
      throw new Error(
        "Local snapshots must not claim a public sidecar commitment"
      );
    }
    const identity = buildSnapshotIdentity({
      visibility: bundle.visibility,
      configHash: bundle.configHash,
      taxonomyHash: bundle.taxonomyHash,
      catalogHash: computedCatalogHash,
      catalog: bundle.catalog,
      searchIndex: bundle.searchIndex,
      partitions,
      sourceState: bundle.sourceState,
      collection: bundle.collection,
      committedAt: bundle.committedAt,
      changeSet: bundle.changeSet,
      publicData: bundle.publicData ?? null
    });
    if (
      bundle.snapshotId !== identity.snapshotId ||
      bundle.integrityHash !== identity.integrityHash
    ) {
      throw new Error("Snapshot identity does not match its committed state");
    }
  }
  return {
    schemaVersion: bundle.schemaVersion,
    snapshotId: bundle.snapshotId,
    visibility: bundle.visibility ?? "local",
    catalogHash: computedCatalogHash,
    sourceCount: actualSourceIds.length,
    articleCount: catalogArticles.length
  };
}
