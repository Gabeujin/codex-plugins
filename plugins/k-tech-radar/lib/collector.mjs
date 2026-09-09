import { buildSearchIndex } from "./index.mjs";
import {
  buildSnapshotIdentity,
  completeSourceStateRecord,
  configurationHash,
  partitionFingerprint,
  taxonomyHash as computeTaxonomyHash,
  validateSourcePartition
} from "./integrity.mjs";
import { assertAllowedUrl, fetchText } from "./http.mjs";
import {
  extractMatchingLinks,
  parseFeed,
  parseSitemap
} from "./parsers.mjs";
import {
  catalogPath,
  loadConfig,
  loadSnapshotContext,
  searchIndexPath,
  snapshotBundlePath,
  sourcePartitionPath,
  sourceStatePath,
  writeJson
} from "./paths.mjs";
import {
  classifyArticle,
  loadTaxonomy
} from "./taxonomy.mjs";
import {
  canonicalizeUrl,
  extractPageMetadata,
  sha256,
  titleFromUrl,
  truncate
} from "./text.mjs";
import {
  withMutationLease,
  withMutationQueue
} from "./mutations.mjs";
import {
  configuredWorkIdentity
} from "./work-identity.mjs";

function articlePattern(source) {
  return new RegExp(source.adapter.articleUrlPattern, "i");
}

export function sourceAllowedHosts(source) {
  const values = [
    source.homepage,
    source.adapter?.url,
    source.adapter?.backfillSitemapUrl,
    source.adapter?.latestListUrl,
    source.adapter?.fallbackListUrl
  ].filter(Boolean);
  return [
    ...new Set(values.map((value) => new URL(value).hostname.toLowerCase()))
  ];
}

function sourceFetchOptions(config, source) {
  return {
    sourceId: source.id,
    allowedHosts: sourceAllowedHosts(source),
    userAgent: config.userAgent,
    requestIntervalMs:
      source.policy?.requestIntervalMs ??
      config.defaultRequestIntervalMs ??
      650
  };
}

export function resolveArticleUrl(source, candidate) {
  const pattern = articlePattern(source);
  const allowedHosts = sourceAllowedHosts(source);
  const candidates = [
    candidate.canonicalUrl,
    candidate.discoveredUrl
  ].filter(Boolean);
  for (const value of candidates) {
    try {
      const canonical = canonicalizeUrl(value, source.homepage);
      assertAllowedUrl(canonical, allowedHosts);
      const matches = pattern.test(canonical);
      pattern.lastIndex = 0;
      if (matches) {
        return canonical;
      }
    } catch {
      // Try the source-discovered URL when publisher metadata is unsafe.
    }
  }
  throw new Error(
    `Article URL is outside the configured HTTPS source boundary: ${candidate.canonicalUrl}`
  );
}

function sourceProjection(source) {
  return {
    sourceId: source.id,
    companyId: source.companyId,
    companyName: source.companyName,
    sourceName: source.displayName,
    sourceHomepage: source.homepage,
    language: source.language,
    evidenceAuthority: source.policy.authority,
    storagePolicy: {
      storesFullText: false,
      contentFetch: source.policy.contentFetch
    }
  };
}

function detectBusinessUnit(source, candidate) {
  const haystack = [
    candidate.canonicalUrl,
    candidate.title,
    candidate.summary,
    ...(candidate.tags ?? [])
  ]
    .join(" ")
    .toLowerCase();
  const rule = source.businessUnitRules?.find((item) =>
    item.keywords.some((keyword) =>
      haystack.includes(String(keyword).toLowerCase())
    )
  );
  return rule?.id ?? source.companyId;
}

function publisherSnapshot(article) {
  return {
    canonicalUrl: article.canonicalUrl,
    title: article.title,
    summary: article.summary,
    publishedAt: article.publishedAt ?? null,
    publisherUpdatedAt: article.publisherUpdatedAt ?? null,
    authors: article.authors ?? [],
    rawPublisherTags: article.rawPublisherTags ?? article.tags ?? []
  };
}

async function finalizeArticle(
  source,
  candidate,
  checkedAt,
  taxonomy,
  currentTaxonomyHash
) {
  const canonicalUrl = resolveArticleUrl(source, candidate);
  const normalizedCandidate = {
    ...candidate,
    canonicalUrl
  };
  const classification = await classifyArticle(
    normalizedCandidate,
    taxonomy
  );
  const titleSuffixPattern = source.adapter.titleSuffixPattern
    ? new RegExp(source.adapter.titleSuffixPattern, "i")
    : null;
  const normalizedTitle = truncate(
    candidate.title || titleFromUrl(canonicalUrl),
    300
  ).replace(titleSuffixPattern ?? /$^/, "");
  const workIdentity = configuredWorkIdentity(
    source,
    canonicalUrl,
    {
      title: normalizedTitle,
      summary: truncate(candidate.summary ?? "", 600),
      canonicalUrl
    }
  );
  const core = {
    ...sourceProjection(source),
    businessUnitId: detectBusinessUnit(source, normalizedCandidate),
    canonicalUrl,
    ...workIdentity,
    title: normalizedTitle,
    summary: truncate(candidate.summary ?? "", 600),
    publishedAt: candidate.publishedAt ?? null,
    publisherUpdatedAt: candidate.publisherUpdatedAt ?? null,
    authors: [...new Set(candidate.authors ?? [])],
    tags: [...new Set(candidate.tags ?? [])],
    rawPublisherTags: [...new Set(candidate.tags ?? [])],
    namespacedTags: [
      ...new Set(
        (candidate.tags ?? []).map((tag) => `${source.id}:${tag}`)
      )
    ],
    domainIds: classification.domainIds,
    problemTypeIds: classification.problemTypeIds,
    taxonomyHash: currentTaxonomyHash,
    metadataState: candidate.metadataState ?? "url-only"
  };
  const contentHash = sha256(JSON.stringify(publisherSnapshot(core)));
  const ontologyHash = sha256(
    JSON.stringify({
      businessUnitId: core.businessUnitId,
      namespacedTags: core.namespacedTags,
      domainIds: core.domainIds,
      problemTypeIds: core.problemTypeIds
    })
  );
  return {
    articleId: `${source.id}:${sha256(canonicalUrl).slice(0, 16)}`,
    ...core,
    contentHash,
    ontologyHash,
    revisionHash: contentHash,
    recordStatus: "active",
    fetchedAt: checkedAt
  };
}

export async function finalizeCandidates(
  source,
  candidates,
  checkedAt,
  taxonomy,
  currentTaxonomyHash
) {
  const settled = await Promise.allSettled(
    candidates.map((candidate) =>
      finalizeArticle(
        source,
        candidate,
        checkedAt,
        taxonomy,
        currentTaxonomyHash
      )
    )
  );
  const articles = [];
  const warnings = [];
  for (const [index, result] of settled.entries()) {
    if (result.status === "fulfilled") {
      articles.push(result.value);
    } else {
      warnings.push({
        stage: "finalize-article",
        candidateUrl:
          candidates[index]?.canonicalUrl ??
          candidates[index]?.discoveredUrl ??
          null,
        error: result.reason?.message ?? String(result.reason)
      });
    }
  }
  return {
    articles,
    warnings
  };
}

function filterCandidates(source, candidates) {
  const pattern = articlePattern(source);
  return candidates.filter((candidate) => {
    const matches = pattern.test(candidate.canonicalUrl);
    pattern.lastIndex = 0;
    return matches;
  });
}

async function collectFeed(
  config,
  source,
  checkedAt,
  mode,
  taxonomy,
  currentTaxonomyHash
) {
  const response = await fetchText(
    source.adapter.url,
    sourceFetchOptions(config, source)
  );
  const candidates = filterCandidates(
    source,
    parseFeed(
      response.text,
      source.adapter.format,
      source.adapter.url
    )
  );
  const finalized = await finalizeCandidates(
    source,
    candidates,
    checkedAt,
    taxonomy,
    currentTaxonomyHash
  );
  const primary = {
    endpoint: response,
    articles: finalized.articles,
    warnings: finalized.warnings
  };
  if (mode !== "backfill" || !source.adapter.backfillSitemapUrl) {
    return primary;
  }
  const supplementalSource = {
    ...source,
    adapter: {
      type: "sitemap",
      url: source.adapter.backfillSitemapUrl,
      articleUrlPattern: source.adapter.articleUrlPattern,
      metadataFetchLimit: source.adapter.metadataFetchLimit ?? 24,
      requireArticleMetadata:
        source.adapter.requireArticleMetadata ?? false
    }
  };
  const supplemental = await collectSitemap(
    config,
    supplementalSource,
    checkedAt,
    "backfill",
    taxonomy,
    currentTaxonomyHash
  );
  const combined = new Map(
    supplemental.articles.map((article) => [article.articleId, article])
  );
  for (const article of primary.articles) {
    combined.set(article.articleId, article);
  }
  return {
    endpoint: primary.endpoint,
    articles: [...combined.values()],
    warnings: [
      ...(primary.warnings ?? []),
      ...(supplemental.warnings ?? [])
    ]
  };
}

async function sitemapRecords(config, source) {
  const root = await fetchText(
    source.adapter.url,
    sourceFetchOptions(config, source)
  );
  const parsed = parseSitemap(root.text);
  if (parsed.type === "urlset") {
    return { endpoint: root, records: parsed.records };
  }

  const records = [];
  for (const sitemap of parsed.records) {
    const response = await fetchText(
      sitemap.loc,
      sourceFetchOptions(config, source)
    );
    const child = parseSitemap(response.text);
    if (child.type === "urlset") {
      records.push(...child.records);
    }
  }
  return { endpoint: root, records };
}

export async function fetchMetadataCandidates(
  config,
  source,
  records,
  metadataFetchLimit,
  fetcher = fetchText
) {
  const candidates = [];
  const warnings = [];
  for (const [index, record] of records.entries()) {
    if (index >= metadataFetchLimit) {
      if (source.adapter.requireArticleMetadata) {
        warnings.push({
          stage: "metadata-limit",
          candidateUrl: record.loc,
          error:
            "Skipped because requireArticleMetadata=true and the bounded metadata verification limit was reached"
        });
        continue;
      }
      candidates.push({
        canonicalUrl: record.loc,
        title: titleFromUrl(record.loc),
        summary: "",
        publishedAt: record.lastmod,
        publisherUpdatedAt: record.lastmod,
        authors: [],
        tags: [],
        metadataState: "sitemap-only"
      });
      continue;
    }
    try {
      const page = await fetcher(
        record.loc,
        sourceFetchOptions(config, source)
      );
      const metadata = extractPageMetadata(page.text, record.loc);
      if (
        source.adapter.requireArticleMetadata &&
        metadata.pageKind !== "article"
      ) {
        warnings.push({
          stage: "article-kind",
          candidateUrl: record.loc,
          error:
            "Skipped because publisher metadata did not identify an article page"
        });
        continue;
      }
      candidates.push({
        ...metadata,
        discoveredUrl: record.loc,
        publishedAt: metadata.publishedAt ?? record.lastmod,
        publisherUpdatedAt:
          metadata.publisherUpdatedAt ?? record.lastmod
      });
    } catch (error) {
      warnings.push({
        stage: "metadata-fetch",
        candidateUrl: record.loc,
        error: error.message
      });
      if (source.adapter.requireArticleMetadata) {
        continue;
      }
      candidates.push({
        canonicalUrl: record.loc,
        title: titleFromUrl(record.loc),
        summary: "",
        publishedAt: record.lastmod,
        publisherUpdatedAt: record.lastmod,
        authors: [],
        tags: [],
        metadataState: "metadata-fetch-failed",
        collectionWarning: error.message
      });
    }
  }
  return {
    candidates,
    warnings
  };
}

async function collectSitemap(
  config,
  source,
  checkedAt,
  mode,
  taxonomy,
  currentTaxonomyHash
) {
  if (mode === "latest" && source.adapter.latestListUrl) {
    const response = await fetchText(
      source.adapter.latestListUrl,
      sourceFetchOptions(config, source)
    );
    const records = extractMatchingLinks(
      response.text,
      source.adapter.latestListUrl,
      source.adapter.articleUrlPattern
    ).map((loc) => ({ loc, lastmod: null }));
    const metadata = await fetchMetadataCandidates(
      config,
      source,
      records,
      source.adapter.metadataFetchLimit ?? 20
    );
    const finalized = await finalizeCandidates(
      source,
      metadata.candidates,
      checkedAt,
      taxonomy,
      currentTaxonomyHash
    );
    return {
      endpoint: response,
      articles: finalized.articles,
      warnings: [
        ...metadata.warnings,
        ...finalized.warnings
      ]
    };
  }
  const { endpoint, records } = await sitemapRecords(config, source);
  const pattern = articlePattern(source);
  const filtered = records
    .map((record) => {
      try {
        return {
          ...record,
          loc: canonicalizeUrl(record.loc, source.homepage)
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((record) => {
      const matches = pattern.test(record.loc);
      pattern.lastIndex = 0;
      return matches;
    })
    .sort((left, right) => {
      const leftTime = left.lastmod ? Date.parse(left.lastmod) : 0;
      const rightTime = right.lastmod ? Date.parse(right.lastmod) : 0;
      return rightTime - leftTime || left.loc.localeCompare(right.loc);
    });
  const metadataFetchLimit = source.adapter.metadataFetchLimit ?? 20;
  const selected =
    mode === "latest" ? filtered.slice(0, metadataFetchLimit) : filtered;
  const metadata = await fetchMetadataCandidates(
    config,
    source,
    selected,
    metadataFetchLimit
  );
  const finalized = await finalizeCandidates(
    source,
    metadata.candidates,
    checkedAt,
    taxonomy,
    currentTaxonomyHash
  );
  return {
    endpoint,
    articles: finalized.articles,
    warnings: [
      ...metadata.warnings,
      ...finalized.warnings
    ]
  };
}

async function collectHtmlList(
  config,
  source,
  checkedAt,
  mode,
  taxonomy,
  currentTaxonomyHash
) {
  const maxPages =
    mode === "backfill" ? Math.max(1, source.adapter.maxPages ?? 1) : 1;
  const links = [];
  let endpoint;

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const url =
      pageNumber === 1
        ? source.adapter.url
        : source.adapter.pageUrlTemplate.replace(
            "{page}",
            String(pageNumber)
          );
    const response = await fetchText(
      url,
      sourceFetchOptions(config, source)
    );
    endpoint ??= response;
    links.push(
      ...extractMatchingLinks(
        response.text,
        url,
        source.adapter.articleUrlPattern
      )
    );
  }

  const records = [...new Set(links)].map((loc) => ({
    loc,
    lastmod: null
  }));
  const metadataFetchLimit = source.adapter.metadataFetchLimit ?? 20;
  const metadata = await fetchMetadataCandidates(
    config,
    source,
    records,
    metadataFetchLimit
  );
  const finalized = await finalizeCandidates(
    source,
    metadata.candidates,
    checkedAt,
    taxonomy,
    currentTaxonomyHash
  );
  return {
    endpoint,
    articles: finalized.articles,
    warnings: [
      ...metadata.warnings,
      ...finalized.warnings
    ]
  };
}

async function collectSource(
  config,
  source,
  checkedAt,
  mode,
  taxonomy,
  currentTaxonomyHash
) {
  switch (source.adapter.type) {
    case "feed": {
      let primary;
      let fallbackReason;
      try {
        primary = await collectFeed(
          config,
          source,
          checkedAt,
          mode,
          taxonomy,
          currentTaxonomyHash
        );
        if (primary.articles.length || !source.adapter.fallbackListUrl) {
          return primary;
        }
        fallbackReason = "Official feed returned zero matching articles";
      } catch (error) {
        if (!source.adapter.fallbackListUrl) {
          throw error;
        }
        fallbackReason = error.message;
      }
      const fallbackSource = {
        ...source,
        adapter: {
          type: "html-list",
          url: source.adapter.fallbackListUrl,
          articleUrlPattern: source.adapter.articleUrlPattern,
          metadataFetchLimit:
            source.adapter.metadataFetchLimit ?? 12,
          requireArticleMetadata:
            source.adapter.requireArticleMetadata ?? false,
          maxPages: 1
        }
      };
      const fallback = await collectHtmlList(
        config,
        fallbackSource,
        checkedAt,
        "latest",
        taxonomy,
        currentTaxonomyHash
      );
      return {
        ...fallback,
        fallbackReason
      };
    }
    case "sitemap":
      return collectSitemap(
        config,
        source,
        checkedAt,
        mode,
        taxonomy,
        currentTaxonomyHash
      );
    case "html-list":
      return collectHtmlList(
        config,
        source,
        checkedAt,
        mode,
        taxonomy,
        currentTaxonomyHash
      );
    default:
      throw new Error(`Unsupported adapter type: ${source.adapter.type}`);
  }
}

export function mergeArticles(existingArticles, discoveredArticles, checkedAt) {
  const merged = new Map(
    existingArticles.map((article) => [article.articleId, article])
  );
  const delta = {
    newArticleIds: [],
    updatedArticleIds: [],
    reclassifiedArticleIds: [],
    migratedArticleIds: [],
    unchangedArticleIds: []
  };

  for (const article of discoveredArticles) {
    const previous = merged.get(article.articleId);
    if (!previous) {
      merged.set(article.articleId, {
        ...article,
        revisions: [],
        firstSeenAt: checkedAt,
        lastSeenAt: checkedAt
      });
      delta.newArticleIds.push(article.articleId);
      continue;
    }
    const previousPublisherHash = sha256(
      JSON.stringify(publisherSnapshot(previous))
    );
    const publisherChanged = previousPublisherHash !== article.contentHash;
    const ontologyChanged = previous.ontologyHash !== article.ontologyHash;
    const hashSchemaChanged = previous.contentHash !== previousPublisherHash;
    if (publisherChanged || ontologyChanged || hashSchemaChanged) {
      const previousRevision = publisherChanged
        ? {
            revisionHash: previousPublisherHash,
            observedAt:
              previous.lastSeenAt ?? previous.fetchedAt ?? checkedAt,
            title: previous.title,
            summary: previous.summary,
            publishedAt: previous.publishedAt,
            publisherUpdatedAt: previous.publisherUpdatedAt,
            authors: previous.authors ?? [],
            tags: previous.rawPublisherTags ?? previous.tags ?? []
          }
        : null;
      const revisions = [
        ...(previous.revisions ?? []),
        ...(previousRevision ? [previousRevision] : [])
      ]
        .filter(
          (revision) =>
            sha256(
              JSON.stringify({
                canonicalUrl: previous.canonicalUrl,
                title: revision.title,
                summary: revision.summary,
                publishedAt:
                  revision.publishedAt ?? previous.publishedAt ?? null,
                publisherUpdatedAt:
                  revision.publisherUpdatedAt ?? null,
                authors: revision.authors ?? previous.authors ?? [],
                rawPublisherTags: revision.tags ?? []
              })
            ) !== article.contentHash
        )
        .filter(
          (revision, index, all) =>
            all.findIndex(
              (item) => item.revisionHash === revision.revisionHash
            ) === index
        );
      merged.set(article.articleId, {
        ...previous,
        ...article,
        revisions,
        firstSeenAt: previous.firstSeenAt ?? checkedAt,
        lastSeenAt: checkedAt,
        lastChangedAt: publisherChanged
          ? checkedAt
          : previous.lastChangedAt ?? null
      });
      if (publisherChanged) {
        delta.updatedArticleIds.push(article.articleId);
      }
      if (ontologyChanged) {
        delta.reclassifiedArticleIds.push(article.articleId);
      }
      if (hashSchemaChanged) {
        delta.migratedArticleIds.push(article.articleId);
      }
      continue;
    }
    merged.set(article.articleId, {
      ...previous,
      ...article,
      revisions: previous.revisions ?? [],
      firstSeenAt: previous.firstSeenAt ?? checkedAt,
      lastSeenAt: checkedAt,
      lastChangedAt: previous.lastChangedAt ?? null
    });
    delta.unchangedArticleIds.push(article.articleId);
  }

  return {
    articles: [...merged.values()].sort((left, right) => {
      const leftTime = left.publishedAt
        ? Date.parse(left.publishedAt)
        : 0;
      const rightTime = right.publishedAt
        ? Date.parse(right.publishedAt)
        : 0;
      return (
        rightTime - leftTime ||
        left.sourceId.localeCompare(right.sourceId) ||
        left.articleId.localeCompare(right.articleId)
      );
    }),
    delta
  };
}

function applyRecordPolicies(articles, config) {
  const sourceMap = new Map(
    config.sources.map((source) => [source.id, source])
  );
  return articles.map((article) => {
    const source = sourceMap.get(article.sourceId);
    const excluded = (source?.excludeTitlePatterns ?? []).some((pattern) =>
      new RegExp(pattern, "i").test(article.title)
    );
    return {
      ...article,
      recordStatus: excluded ? "excluded-non-article" : "active"
    };
  });
}

async function reclassifyForTaxonomy(
  articles,
  taxonomy,
  currentTaxonomyHash,
  shouldReclassify
) {
  if (!shouldReclassify) {
    return {
      articles,
      reclassifiedArticleIds: []
    };
  }
  const reclassifiedArticleIds = [];
  const reclassified = [];
  for (const article of articles) {
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
    if (
      ontologyHash !== article.ontologyHash ||
      article.taxonomyHash !== currentTaxonomyHash
    ) {
      reclassifiedArticleIds.push(article.articleId);
    }
    reclassified.push({
      ...article,
      ...classification,
      ontologyHash,
      taxonomyHash: currentTaxonomyHash
    });
  }
  return {
    articles: reclassified,
    reclassifiedArticleIds
  };
}

async function refreshCatalogInternal({
  sourceIds,
  mode = "latest",
  dryRun = false
} = {}) {
  if (!["latest", "backfill"].includes(mode)) {
    throw new Error("mode must be latest or backfill");
  }
  const checkedAt = new Date().toISOString();
  const [config, taxonomy, snapshot] = await Promise.all([
    loadConfig(),
    loadTaxonomy(),
    loadSnapshotContext()
  ]);
  const currentConfigHash = configurationHash(config);
  const currentTaxonomyHash = computeTaxonomyHash(taxonomy);
  const fallbackCatalog = snapshot?.catalog ?? {
    schemaVersion: 2,
    refreshedAt: null,
    articles: []
  };
  const sourceState = snapshot?.sourceState ?? {
    schemaVersion: 2,
    updatedAt: null,
    collectionStatus: "never-checked",
    snapshotId: null,
    sources: {}
  };
  const sourcePartitions = config.sources.map((source) => {
    const existing = snapshot?.partitions?.[source.id] ?? {
      schemaVersion: 2,
      sourceId: source.id,
      companyId: source.companyId,
      snapshotId: snapshot?.snapshotId ?? null,
      refreshedAt: null,
      dataAsOf: null,
      recordCount: 0,
      sourceHash: partitionFingerprint([]),
      articles: []
    };
    const normalized = {
      schemaVersion: 2,
      sourceId: source.id,
      companyId: source.companyId,
      snapshotId: existing.snapshotId ?? null,
      refreshedAt: existing.refreshedAt ?? null,
      dataAsOf:
        existing.dataAsOf ?? existing.refreshedAt ?? null,
      lastAttemptAt: existing.lastAttemptAt ?? null,
      lastSuccessAt: existing.lastSuccessAt ?? null,
      collectionStatus:
        existing.collectionStatus ?? "never-checked",
      recordCount: existing.articles?.length ?? 0,
      sourceHash: partitionFingerprint(
        existing.articles ?? []
      ),
      articles: structuredClone(existing.articles ?? [])
    };
    if ((snapshot?.schemaVersion ?? 1) >= 2) {
      validateSourcePartition(existing, source);
    }
    return normalized;
  });
  const catalog = {
    schemaVersion: 2,
    snapshotId: snapshot?.snapshotId ?? null,
    refreshedAt: fallbackCatalog.refreshedAt ?? null,
    articles: sourcePartitions.flatMap(
      (partition) => partition.articles
    )
  };
  const requested = sourceIds?.length
    ? new Set(sourceIds)
    : null;
  const selected = config.sources.filter(
    (source) => !requested || requested.has(source.id)
  );
  if (requested) {
    const unknown = [...requested].filter(
      (id) => !config.sources.some((source) => source.id === id)
    );
    if (unknown.length) {
      throw new Error(`Unknown source ids: ${unknown.join(", ")}`);
    }
  }

  const reports = [];
  const discovered = [];
  const nextState = {
    schemaVersion: 2,
    updatedAt: sourceState.updatedAt ?? null,
    collectionStatus:
      sourceState.collectionStatus ?? "never-checked",
    snapshotId: null,
    sources: Object.fromEntries(
      config.sources.map((source) => [
        source.id,
        completeSourceStateRecord(
          sourceState.sources?.[source.id] ?? {}
        )
      ])
    )
  };

  for (const source of selected) {
    const startedAt = Date.now();
    try {
      const result = await collectSource(
        config,
        source,
        checkedAt,
        mode,
        taxonomy,
        currentTaxonomyHash
      );
      discovered.push(...result.articles);
      const collectionStatus = result.warnings?.length
        ? "partial"
        : "ok";
      nextState.sources[source.id] = {
        status: collectionStatus,
        lastCheckedAt: checkedAt,
        lastAttemptAt: checkedAt,
        lastSuccessAt: checkedAt,
        dataAsOf: checkedAt,
        articleCountSeen: result.articles.length,
        endpoint: result.endpoint?.url ?? source.adapter.url,
        etag: result.endpoint?.etag ?? null,
        lastModified: result.endpoint?.lastModified ?? null,
        durationMs: Date.now() - startedAt,
        error: null,
        errorCode: null,
        warningCount: result.warnings?.length ?? 0
      };
      reports.push({
        sourceId: source.id,
        status: collectionStatus,
        articleCountSeen: result.articles.length,
        durationMs: Date.now() - startedAt,
        warnings: result.warnings ?? []
      });
    } catch (error) {
      nextState.sources[source.id] = {
        ...completeSourceStateRecord(
          nextState.sources[source.id] ?? {}
        ),
        status: "error",
        lastCheckedAt: checkedAt,
        lastAttemptAt: checkedAt,
        durationMs: Date.now() - startedAt,
        error: error.message,
        errorCode:
          error.code ?? error.name ?? "COLLECTION_ERROR",
        warningCount: 0
      };
      reports.push({
        sourceId: source.id,
        status: "error",
        articleCountSeen: 0,
        durationMs: Date.now() - startedAt,
        error: error.message
      });
    }
  }

  const merged = mergeArticles(catalog.articles, discovered, checkedAt);
  const taxonomyChanged =
    snapshot?.taxonomyHash !== currentTaxonomyHash ||
    merged.articles.some(
      (article) => article.taxonomyHash !== currentTaxonomyHash
    );
  const reclassified = await reclassifyForTaxonomy(
    merged.articles,
    taxonomy,
    currentTaxonomyHash,
    taxonomyChanged
  );
  const successfulSourceIds = reports
    .filter((report) =>
      ["ok", "partial"].includes(report.status)
    )
    .map((report) => report.sourceId);
  const failedSourceIds = reports
    .filter((report) => report.status === "error")
    .map((report) => report.sourceId);
  const collectionStatus = failedSourceIds.length
    ? successfulSourceIds.length
      ? "partial"
      : "failed"
    : reports.some((report) => report.status === "partial")
      ? "partial"
      : "ok";
  const collection = {
    status: collectionStatus,
    attemptedAt: checkedAt,
    mode,
    requestedSourceIds: selected.map((source) => source.id),
    succeededSourceIds: successfulSourceIds,
    failedSourceIds,
    unselectedSourceIds: config.sources
      .filter(
        (source) =>
          !selected.some((selectedSource) =>
            selectedSource.id === source.id
          )
      )
      .map((source) => source.id)
  };
  const nextCatalog = {
    schemaVersion: 2,
    view: "derived-from-source-partitions",
    refreshedAt: successfulSourceIds.length
      ? checkedAt
      : fallbackCatalog.refreshedAt ?? null,
    lastAttemptAt: checkedAt,
    collectionStatus,
    taxonomyHash: currentTaxonomyHash,
    configHash: currentConfigHash,
    snapshotId: null,
    catalogHash: null,
    articles: applyRecordPolicies(
      reclassified.articles,
      config
    )
  };
  const nextIndex = buildSearchIndex(nextCatalog.articles, checkedAt);
  nextIndex.snapshotId = null;
  nextCatalog.catalogHash = nextIndex.catalogHash;
  nextState.schemaVersion = 2;
  nextState.updatedAt = checkedAt;
  nextState.collectionStatus = collectionStatus;

  const priorPartitions = new Map(
    sourcePartitions.map((partition) => [
      partition.sourceId,
      partition
    ])
  );
  const nextPartitions = Object.fromEntries(
    config.sources.map((source) => {
      const articles = nextCatalog.articles.filter(
        (article) => article.sourceId === source.id
      );
      const prior = priorPartitions.get(source.id);
      const state = nextState.sources[source.id] ?? {};
      const dataAsOf =
        state.dataAsOf ??
        prior?.dataAsOf ??
        prior?.refreshedAt ??
        null;
      const partition = {
        schemaVersion: 2,
        sourceId: source.id,
        companyId: source.companyId,
        snapshotId: null,
        refreshedAt: dataAsOf,
        dataAsOf,
        lastAttemptAt:
          state.lastAttemptAt ??
          prior?.lastAttemptAt ??
          null,
        lastSuccessAt:
          state.lastSuccessAt ??
          prior?.lastSuccessAt ??
          null,
        collectionStatus:
          state.status ?? prior?.collectionStatus ?? "never-checked",
        recordCount: articles.length,
        sourceHash: partitionFingerprint(articles),
        articles
      };
      validateSourcePartition(partition, source);
      return [source.id, partition];
    })
  );
  const reclassifiedArticleIds = [
    ...new Set([
      ...merged.delta.reclassifiedArticleIds,
      ...reclassified.reclassifiedArticleIds
    ])
  ];
  const changeSet = {
    newArticleIds: merged.delta.newArticleIds,
    updatedArticleIds: merged.delta.updatedArticleIds,
    reclassifiedArticleIds,
    migratedArticleIds: merged.delta.migratedArticleIds
  };
  const identity = buildSnapshotIdentity({
    visibility: "local",
    configHash: currentConfigHash,
    taxonomyHash: currentTaxonomyHash,
    catalogHash: nextIndex.catalogHash,
    catalog: nextCatalog,
    searchIndex: nextIndex,
    partitions: nextPartitions,
    sourceState: nextState,
    collection,
    committedAt: checkedAt,
    changeSet
  });
  const { snapshotId, integrityHash } = identity;
  nextCatalog.snapshotId = snapshotId;
  nextIndex.snapshotId = snapshotId;
  nextState.snapshotId = snapshotId;
  for (const partition of Object.values(nextPartitions)) {
    partition.snapshotId = snapshotId;
  }

  const beforeCommit = await loadSnapshotContext();
  if (
    (beforeCommit?.snapshotId ?? null) !==
    (snapshot?.snapshotId ?? null)
  ) {
    const error = new Error(
      "Catalog snapshot changed during refresh; retry from the new generation"
    );
    error.code = "K_TECH_RADAR_SNAPSHOT_CONFLICT";
    throw error;
  }
  if (!dryRun) {
    await writeJson(snapshotBundlePath, {
      schemaVersion: 2,
      visibility: "local",
      snapshotId,
      integrityHash,
      committedAt: checkedAt,
      configHash: currentConfigHash,
      taxonomyHash: currentTaxonomyHash,
      collection,
      changeSet,
      catalog: nextCatalog,
      searchIndex: nextIndex,
      sourceState: nextState,
      partitions: nextPartitions
    });
    const compatibilityWrites = await Promise.allSettled([
      writeJson(searchIndexPath, nextIndex),
      writeJson(sourceStatePath, nextState),
      ...config.sources.map((source) =>
        writeJson(
          sourcePartitionPath(source.id),
          nextPartitions[source.id]
        )
      ),
      writeJson(catalogPath, nextCatalog)
    ]);
    const compatibilityWriteFailures = compatibilityWrites
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.status === "rejected")
      .map(({ result, index }) => ({
        index,
        error: result.reason?.message ?? String(result.reason)
      }));
    if (compatibilityWriteFailures.length) {
      reports.push({
        sourceId: "_compatibility-files",
        status: "warning",
        articleCountSeen: 0,
        durationMs: 0,
        error:
          "The atomic snapshot committed successfully, but one or more legacy compatibility files could not be refreshed.",
        failures: compatibilityWriteFailures
      });
    }
  }

  const countsBySource = Object.fromEntries(
    selected.map((source) => [
      source.id,
      nextCatalog.articles.filter(
        (article) =>
          article.sourceId === source.id &&
          article.recordStatus === "active"
      ).length
    ])
  );

  return {
    checkedAt,
    mode,
    dryRun,
    sourceReports: reports,
    delta: {
      newCount: merged.delta.newArticleIds.length,
      updatedCount: merged.delta.updatedArticleIds.length,
      reclassifiedCount: new Set([
        ...merged.delta.reclassifiedArticleIds,
        ...reclassified.reclassifiedArticleIds
      ]).size,
      migratedCount: merged.delta.migratedArticleIds.length,
      unchangedCount: merged.delta.unchangedArticleIds.length,
      newArticleIds: merged.delta.newArticleIds,
      updatedArticleIds: merged.delta.updatedArticleIds,
      reclassifiedArticleIds: [
        ...new Set([
          ...merged.delta.reclassifiedArticleIds,
          ...reclassified.reclassifiedArticleIds
        ])
      ],
      migratedArticleIds: merged.delta.migratedArticleIds
    },
    catalogRecordCount: nextCatalog.articles.length,
    activeArticleCount: nextCatalog.articles.filter(
      (article) => article.recordStatus === "active"
    ).length,
    countsBySource,
    status: collectionStatus,
    snapshotId,
    integrityHash,
    taxonomyChanged
  };
}

export function coordinateCatalogRefresh(
  args = {},
  {
    execute = refreshCatalogInternal,
    queue = withMutationQueue,
    lease = withMutationLease
  } = {}
) {
  if (args?.dryRun === true) {
    return queue("catalog-refresh", () => execute(args));
  }
  return lease("catalog-refresh", () => execute(args));
}

export function refreshCatalog(args = {}) {
  return coordinateCatalogRefresh(args);
}
