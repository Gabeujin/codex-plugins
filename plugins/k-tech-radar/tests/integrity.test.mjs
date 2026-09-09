import assert from "node:assert/strict";
import test from "node:test";

import { buildSearchIndex } from "../lib/index.mjs";
import {
  buildSnapshotIdentity,
  completeSourceStateRecord,
  configurationHash,
  partitionFingerprint,
  taxonomyHash,
  validateSnapshotBundle
} from "../lib/integrity.mjs";
import { getSourceStatus } from "../lib/engine.mjs";

const config = {
  sources: [
    {
      id: "source-a",
      companyId: "company-a",
      homepage: "https://a.example",
      adapter: {
        url: "https://a.example/feed"
      }
    },
    {
      id: "source-b",
      companyId: "company-b",
      homepage: "https://b.example",
      adapter: {
        url: "https://b.example/feed"
      }
    }
  ]
};
const taxonomy = {
  domains: [],
  problemTypes: []
};

function article(sourceId, companyId, suffix) {
  return {
    articleId: `${sourceId}:${suffix}`,
    sourceId,
    companyId,
    canonicalUrl: `https://${suffix[0]}.example/${suffix}`,
    canonicalWorkId: `work:${suffix}`,
    title: `Article ${suffix}`,
    summary: `Summary ${suffix}`,
    authors: [],
    tags: [],
    domainIds: [],
    problemTypeIds: [],
    metadataState: "metadata-only",
    contentHash: suffix.padEnd(64, "a").slice(0, 64),
    ontologyHash: suffix.padEnd(64, "b").slice(0, 64),
    taxonomyHash: taxonomyHash(taxonomy),
    recordStatus: "active",
    publishedAt: "2026-07-30T00:00:00.000Z",
    revisions: [
      {
        revisionHash: suffix
          .padEnd(64, "c")
          .slice(0, 64),
        observedAt: "2026-07-29T00:00:00.000Z",
        title: `Prior ${suffix}`,
        summary: `Prior summary ${suffix}`,
        publishedAt: "2026-07-29T00:00:00.000Z",
        publisherUpdatedAt: null,
        authors: [],
        tags: []
      }
    ]
  };
}

function validBundle() {
  const committedAt = "2026-07-30T00:00:00.000Z";
  const articles = [
    article("source-a", "company-a", "a1"),
    article("source-b", "company-b", "b1")
  ];
  const index = buildSearchIndex(articles, committedAt);
  index.snapshotId = null;
  const partitions = Object.fromEntries(
    config.sources.map((source) => {
      const records = articles.filter(
        (item) => item.sourceId === source.id
      );
      return [
        source.id,
        {
          schemaVersion: 2,
          sourceId: source.id,
          companyId: source.companyId,
          snapshotId: null,
          refreshedAt: committedAt,
          dataAsOf: committedAt,
          lastAttemptAt: committedAt,
          lastSuccessAt: committedAt,
          collectionStatus: "ok",
          recordCount: records.length,
          sourceHash: partitionFingerprint(records),
          articles: records
        }
      ];
    })
  );
  const sourceState = {
    schemaVersion: 2,
    updatedAt: committedAt,
    collectionStatus: "ok",
    snapshotId: null,
    sources: Object.fromEntries(
      config.sources.map((source) => [
        source.id,
        completeSourceStateRecord({
          status: "ok",
          lastCheckedAt: committedAt,
          lastAttemptAt: committedAt,
          lastSuccessAt: committedAt,
          dataAsOf: committedAt,
          articleCountSeen: 1,
          endpoint: `${source.homepage}/feed`,
          durationMs: 10,
          warningCount: 0
        })
      ])
    )
  };
  const collection = {
    status: "ok",
    attemptedAt: committedAt,
    mode: "test",
    requestedSourceIds: ["source-a", "source-b"],
    succeededSourceIds: ["source-a", "source-b"],
    failedSourceIds: [],
    unselectedSourceIds: []
  };
  const changeSet = {
    newArticleIds: [],
    updatedArticleIds: [],
    reclassifiedArticleIds: [],
    migratedArticleIds: []
  };
  const catalog = {
    schemaVersion: 2,
    view: "derived-from-source-partitions",
    refreshedAt: committedAt,
    lastAttemptAt: committedAt,
    collectionStatus: "ok",
    taxonomyHash: taxonomyHash(taxonomy),
    configHash: configurationHash(config),
    snapshotId: null,
    catalogHash: index.catalogHash,
    articles
  };
  const identity = buildSnapshotIdentity({
    visibility: "local",
    configHash: configurationHash(config),
    taxonomyHash: taxonomyHash(taxonomy),
    catalogHash: index.catalogHash,
    catalog,
    searchIndex: index,
    partitions,
    sourceState,
    collection,
    committedAt,
    changeSet
  });
  catalog.snapshotId = identity.snapshotId;
  index.snapshotId = identity.snapshotId;
  sourceState.snapshotId = identity.snapshotId;
  for (const partition of Object.values(partitions)) {
    partition.snapshotId = identity.snapshotId;
  }
  return {
    schemaVersion: 2,
    visibility: "local",
    snapshotId: identity.snapshotId,
    integrityHash: identity.integrityHash,
    committedAt,
    configHash: configurationHash(config),
    taxonomyHash: taxonomyHash(taxonomy),
    collection,
    changeSet,
    catalog,
    searchIndex: index,
    sourceState,
    partitions
  };
}

function recommitBundle(bundle) {
  const identity = buildSnapshotIdentity({
    visibility: bundle.visibility,
    configHash: bundle.configHash,
    taxonomyHash: bundle.taxonomyHash,
    catalogHash: bundle.catalog.catalogHash,
    catalog: bundle.catalog,
    searchIndex: bundle.searchIndex,
    partitions: bundle.partitions,
    sourceState: bundle.sourceState,
    collection: bundle.collection,
    committedAt: bundle.committedAt,
    changeSet: bundle.changeSet,
    publicData: bundle.publicData ?? null
  });
  bundle.snapshotId = identity.snapshotId;
  bundle.integrityHash = identity.integrityHash;
  bundle.catalog.snapshotId = identity.snapshotId;
  bundle.searchIndex.snapshotId = identity.snapshotId;
  bundle.sourceState.snapshotId = identity.snapshotId;
  for (const partition of Object.values(bundle.partitions)) {
    partition.snapshotId = identity.snapshotId;
  }
  return bundle;
}

function validPublicBundle(
  publisherExcerptPolicy = "metadata-only"
) {
  const bundle = validBundle();
  bundle.visibility = "public";
  bundle.collection = {
    ...bundle.collection,
    sourceSnapshotId: bundle.snapshotId,
    publisherExcerptPolicy
  };
  bundle.publicData = {
    schemaVersion: 1,
    dictionaryHash: "d".repeat(64),
    dictionaryEntryCount: 0,
    insightRunsHash: "e".repeat(64),
    insightRunCount: 0
  };
  for (const article of bundle.catalog.articles) {
    article.storagePolicy = {
      storesFullText: false,
      contentFetch: "on-demand-excerpt",
      publicSnapshot: publisherExcerptPolicy
    };
    article.summary =
      publisherExcerptPolicy === "metadata-only"
        ? ""
        : `Bounded ${article.articleId}`;
  }
  for (const partition of Object.values(bundle.partitions)) {
    partition.sourceHash = partitionFingerprint(
      partition.articles
    );
  }
  bundle.searchIndex = {
    ...buildSearchIndex(
      bundle.catalog.articles,
      bundle.committedAt
    ),
    snapshotId: null
  };
  bundle.catalog.catalogHash =
    bundle.searchIndex.catalogHash;
  return recommitBundle(bundle);
}

test("snapshot validation rejects duplicated partition records", () => {
  const bundle = validBundle();
  bundle.partitions["source-b"].articles = [
    {
      ...bundle.partitions["source-a"].articles[0],
      sourceId: "source-b",
      companyId: "company-b"
    }
  ];
  bundle.partitions["source-b"].sourceHash =
    partitionFingerprint(
      bundle.partitions["source-b"].articles
    );
  assert.throws(
    () => validateSnapshotBundle(bundle, config, taxonomy),
    /namespace|exact multiset union|identity/
  );
});

test("snapshot identity changes when source freshness changes", () => {
  const bundle = validBundle();
  const changedState = structuredClone(bundle.sourceState);
  changedState.sources["source-b"].status = "error";
  changedState.sources["source-b"].errorCode =
    "UPSTREAM_TIMEOUT";
  const changed = buildSnapshotIdentity({
    visibility: bundle.visibility,
    configHash: bundle.configHash,
    taxonomyHash: bundle.taxonomyHash,
    catalogHash: bundle.catalog.catalogHash,
    catalog: bundle.catalog,
    searchIndex: bundle.searchIndex,
    partitions: bundle.partitions,
    sourceState: changedState,
    collection: {
      ...bundle.collection,
      status: "partial",
      failedSourceIds: ["source-b"]
    },
    committedAt: bundle.committedAt,
    changeSet: bundle.changeSet
  });
  assert.notEqual(changed.snapshotId, bundle.snapshotId);
});

test("snapshot identity binds complete persisted source-state details", () => {
  for (const [field, value] of [
    ["endpoint", "https://a.example/changed-feed"],
    ["etag", "changed-etag"],
    ["lastModified", "Wed, 30 Jul 2026 00:00:00 GMT"],
    ["durationMs", 9999],
    ["error", "changed diagnostic"],
    ["warningCount", 4]
  ]) {
    const bundle = validBundle();
    bundle.sourceState.sources["source-a"][field] =
      value;
    assert.throws(
      () =>
        validateSnapshotBundle(
          bundle,
          config,
          taxonomy
        ),
      /identity/
    );
  }
});

test("snapshot source state rejects undeclared persisted fields", () => {
  const bundle = validBundle();
  bundle.sourceState.sources["source-a"].privateNotes =
    "must not become an unreviewed state field";
  assert.throws(
    () => validateSnapshotBundle(bundle, config, taxonomy),
    /unsupported/
  );
});

test("public reads fail closed against a local snapshot", async () => {
  await assert.rejects(
    getSourceStatus({}, { publicMode: true }),
    /visibility local cannot be used as public/
  );
});

test("snapshot validation binds title and summary payload bytes", () => {
  const bundle = validBundle();
  bundle.catalog.articles[0].title =
    "Tampered title with old hashes";
  bundle.catalog.articles[0].summary =
    "Tampered summary with old hashes";
  assert.throws(
    () => validateSnapshotBundle(bundle, config, taxonomy),
    /sourceHash|exact multiset union|fingerprint|identity/
  );
});

test("snapshot validation rejects undeclared persisted article fields", () => {
  const bundle = validBundle();
  bundle.catalog.articles[0].privateNotes =
    "not a persisted article field";
  bundle.partitions["source-a"].articles[0].privateNotes =
    "not a persisted article field";
  assert.throws(
    () => validateSnapshotBundle(bundle, config, taxonomy),
    /unsupported persisted fields/
  );
});

test("snapshot identity binds postings, documents, and average length", () => {
  for (const mutate of [
    (index) => {
      const token = Object.keys(index.postings)[0];
      index.postings[token][0][1] += 1;
    },
    (index) => {
      index.documents[0].length += 1;
    },
    (index) => {
      index.averageDocumentLength += 1;
    }
  ]) {
    const bundle = validBundle();
    mutate(bundle.searchIndex);
    assert.throws(
      () => validateSnapshotBundle(bundle, config, taxonomy),
      /identity|semantically match/
    );
  }
});

test("snapshot validation rejects a forged but re-signed search index", () => {
  const bundle = validBundle();
  bundle.searchIndex.postings.qzxvplmno987654 = [[0, 1]];
  const identity = buildSnapshotIdentity({
    visibility: bundle.visibility,
    configHash: bundle.configHash,
    taxonomyHash: bundle.taxonomyHash,
    catalogHash: bundle.catalog.catalogHash,
    catalog: bundle.catalog,
    searchIndex: bundle.searchIndex,
    partitions: bundle.partitions,
    sourceState: bundle.sourceState,
    collection: bundle.collection,
    committedAt: bundle.committedAt,
    changeSet: bundle.changeSet
  });
  bundle.snapshotId = identity.snapshotId;
  bundle.integrityHash = identity.integrityHash;
  bundle.catalog.snapshotId = identity.snapshotId;
  bundle.searchIndex.snapshotId = identity.snapshotId;
  bundle.sourceState.snapshotId = identity.snapshotId;
  for (const partition of Object.values(bundle.partitions)) {
    partition.snapshotId = identity.snapshotId;
  }

  assert.throws(
    () => validateSnapshotBundle(bundle, config, taxonomy),
    /semantically match the committed catalog/
  );
});

test("public snapshot policy is bound to every article projection", () => {
  for (const [policy, mutate] of [
    [
      "metadata-only",
      (article) => {
        article.summary = "publisher excerpt leak";
      }
    ],
    [
      "metadata-only",
      (article) => {
        article.storagePolicy.publicSnapshot =
          "bounded-rights-confirmed";
      }
    ],
    [
      "bounded-rights-confirmed",
      (article) => {
        article.summary = "x".repeat(601);
      }
    ]
  ]) {
    const bundle = validPublicBundle(policy);
    const articleId =
      bundle.catalog.articles[0].articleId;
    mutate(bundle.catalog.articles[0]);
    for (const partition of Object.values(
      bundle.partitions
    )) {
      const article = partition.articles.find(
        (candidate) =>
          candidate.articleId === articleId
      );
      if (article) {
        mutate(article);
      }
      partition.sourceHash = partitionFingerprint(
        partition.articles
      );
    }
    bundle.searchIndex = {
      ...buildSearchIndex(
        bundle.catalog.articles,
        bundle.committedAt
      ),
      snapshotId: bundle.snapshotId
    };
    bundle.catalog.catalogHash =
      bundle.searchIndex.catalogHash;
    recommitBundle(bundle);

    assert.throws(
      () => validateSnapshotBundle(bundle, config, taxonomy),
      /metadata-only policy|storage policy does not match|capped at 600/
    );
  }
});

test("snapshot identity binds nested article revision history", () => {
  const bundle = validBundle();
  for (const collection of [
    bundle.catalog.articles,
    bundle.partitions["source-a"].articles
  ]) {
    collection[0].revisions[0].summary =
      "Tampered prior summary";
  }
  const rebuiltIndex = buildSearchIndex(
    bundle.catalog.articles
  );
  bundle.catalog.catalogHash = rebuiltIndex.catalogHash;
  bundle.searchIndex = {
    ...rebuiltIndex,
    snapshotId: bundle.snapshotId
  };
  bundle.partitions["source-a"].sourceHash =
    partitionFingerprint(
      bundle.partitions["source-a"].articles
    );
  assert.throws(
    () => validateSnapshotBundle(bundle, config, taxonomy),
    /identity/
  );
});

test("snapshot validation rejects missing state fields instead of folding them to null", () => {
  for (const field of [
    "lastAttemptAt",
    "dataAsOf",
    "warningCount"
  ]) {
    const bundle = validBundle();
    delete bundle.sourceState.sources["source-a"][field];
    assert.throws(
      () => validateSnapshotBundle(bundle, config, taxonomy),
      /fields must match the schema exactly/
    );
  }
});

test("snapshot validation rejects forged self references", () => {
  for (const mutate of [
    (bundle) => {
      bundle.catalog.snapshotId = "snapshot:forged";
    },
    (bundle) => {
      bundle.searchIndex.snapshotId = "snapshot:forged";
    },
    (bundle) => {
      bundle.sourceState.snapshotId = "snapshot:forged";
    },
    (bundle) => {
      bundle.partitions["source-a"].snapshotId =
        "snapshot:forged";
    }
  ]) {
    const bundle = validBundle();
    mutate(bundle);
    assert.throws(
      () => validateSnapshotBundle(bundle, config, taxonomy),
      /self-reference/
    );
  }
});

test("snapshot identity binds commit metadata, change set, and catalog state", () => {
  for (const mutate of [
    (bundle) => {
      bundle.committedAt = "2026-07-31T00:00:00.000Z";
    },
    (bundle) => {
      bundle.changeSet.newArticleIds.push("source-a:forged");
    },
    (bundle) => {
      bundle.catalog.refreshedAt =
        "2026-07-31T00:00:00.000Z";
    },
    (bundle) => {
      bundle.catalog.collectionStatus = "partial";
    }
  ]) {
    const bundle = validBundle();
    mutate(bundle);
    assert.throws(
      () => validateSnapshotBundle(bundle, config, taxonomy),
      /identity|collection status commitments/
    );
  }
});

test("snapshot v2 rejects unknown fields at every persisted layer", () => {
  for (const mutate of [
    (bundle) => {
      bundle.privateNotes = "forged";
    },
    (bundle) => {
      bundle.catalog.privateNotes = "forged";
    },
    (bundle) => {
      bundle.searchIndex.privateNotes = "forged";
    },
    (bundle) => {
      bundle.partitions["source-a"].privateNotes = "forged";
    }
  ]) {
    const bundle = validBundle();
    mutate(bundle);
    assert.throws(
      () => validateSnapshotBundle(bundle, config, taxonomy),
      /fields must match the schema exactly/
    );
  }
});
