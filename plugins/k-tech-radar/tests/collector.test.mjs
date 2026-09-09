import assert from "node:assert/strict";
import test from "node:test";

import {
  coordinateCatalogRefresh,
  fetchMetadataCandidates,
  finalizeCandidates,
  mergeArticles
} from "../lib/collector.mjs";
import { sha256 } from "../lib/text.mjs";
import {
  configuredWorkIdentity
} from "../lib/work-identity.mjs";

test("dry-run refresh uses only the in-process queue and never a persistent mutation lease", async () => {
  const calls = [];
  const result = await coordinateCatalogRefresh(
    { dryRun: true, mode: "latest" },
    {
      execute: async (args) => {
        calls.push(["execute", args]);
        return { dryRun: true };
      },
      queue: async (name, task) => {
        calls.push(["queue", name]);
        return task();
      },
      lease: async () => {
        throw new Error(
          "persistent mutation lease must not run"
        );
      }
    }
  );
  assert.deepEqual(result, { dryRun: true });
  assert.deepEqual(calls, [
    ["queue", "catalog-refresh"],
    ["execute", { dryRun: true, mode: "latest" }]
  ]);
});

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

function article(overrides = {}) {
  const base = {
    articleId: "source-a:a1",
    sourceId: "source-a",
    canonicalUrl: "https://example.com/a1",
    title: "레거시 개선",
    summary: "작은 경계부터 개선한다.",
    publishedAt: "2026-01-01T00:00:00.000Z",
    publisherUpdatedAt: null,
    authors: ["Author"],
    rawPublisherTags: ["Backend"],
    tags: ["Backend"],
    domainIds: ["backend-distributed-systems"],
    problemTypeIds: ["technical-debt"],
    ontologyHash: "ontology-v1",
    revisions: [],
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    lastSeenAt: "2026-01-01T00:00:00.000Z"
  };
  const result = { ...base, ...overrides };
  result.contentHash ??= sha256(
    JSON.stringify(publisherSnapshot(result))
  );
  result.revisionHash ??= result.contentHash;
  return result;
}

test("ontology-only changes reclassify without publisher revisions", () => {
  const previous = article();
  const discovered = article({
    domainIds: ["quality-reliability"],
    ontologyHash: "ontology-v2"
  });

  const result = mergeArticles(
    [previous],
    [discovered],
    "2026-02-01T00:00:00.000Z"
  );

  assert.deepEqual(result.articles[0].domainIds, ["quality-reliability"]);
  assert.deepEqual(result.articles[0].revisions, []);
  assert.deepEqual(result.delta.updatedArticleIds, []);
  assert.deepEqual(result.delta.reclassifiedArticleIds, ["source-a:a1"]);
});

test("legacy hash migration does not masquerade as publisher update", () => {
  const previous = article({ contentHash: "legacy-classifier-coupled-hash" });
  const discovered = article();

  const result = mergeArticles(
    [previous],
    [discovered],
    "2026-02-01T00:00:00.000Z"
  );

  assert.deepEqual(result.articles[0].revisions, []);
  assert.deepEqual(result.delta.updatedArticleIds, []);
  assert.deepEqual(result.delta.migratedArticleIds, ["source-a:a1"]);
});

test("publisher changes retain the prior publisher snapshot", () => {
  const previous = article();
  const discovered = article({
    title: "레거시 개선 후속",
    contentHash: undefined,
    revisionHash: undefined
  });

  const result = mergeArticles(
    [previous],
    [discovered],
    "2026-02-01T00:00:00.000Z"
  );

  assert.equal(result.articles[0].revisions.length, 1);
  assert.equal(result.articles[0].revisions[0].title, "레거시 개선");
  assert.deepEqual(result.delta.updatedArticleIds, ["source-a:a1"]);
});

test("strict article metadata policy skips unverified URLs instead of inventing records", async () => {
  const source = {
    id: "source-a",
    homepage: "https://example.com",
    adapter: {
      requireArticleMetadata: true
    },
    policy: {}
  };
  const result = await fetchMetadataCandidates(
    {},
    source,
    [
      {
        loc: "https://example.com/posts/one",
        lastmod: null
      },
      {
        loc: "https://example.com/category/backend",
        lastmod: null
      }
    ],
    1,
    async () => {
      throw new Error("upstream timeout");
    }
  );
  assert.deepEqual(result.candidates, []);
  assert.equal(result.warnings.length, 2);
  assert.deepEqual(
    result.warnings.map((warning) => warning.stage),
    ["metadata-fetch", "metadata-limit"]
  );
});

test("one malformed article candidate does not abort a healthy source batch", async () => {
  const source = {
    id: "source-a",
    companyId: "company-a",
    companyName: "Company A",
    displayName: "Company A Tech",
    homepage: "https://example.com",
    language: "ko",
    adapter: {
      articleUrlPattern:
        "^https://example\\.com/posts/"
    },
    policy: {
      authority: "official-primary",
      storesFullText: false,
      contentFetch: "on-demand"
    }
  };
  const result = await finalizeCandidates(
    source,
    [
      {
        canonicalUrl:
          "https://example.com/posts/healthy",
        title: "정상 글",
        summary: "정상 요약",
        tags: []
      },
      {
        canonicalUrl:
          "https://attacker.example/posts/unsafe",
        title: "경계 밖 글",
        summary: "저장되면 안 됨",
        tags: []
      }
    ],
    "2026-07-30T00:00:00.000Z",
    {
      domains: [],
      problemTypes: []
    },
    "e".repeat(64)
  );
  assert.equal(result.articles.length, 1);
  assert.equal(result.warnings.length, 1);
  assert.equal(
    result.articles[0].sourceId,
    "source-a"
  );
});

test("curated translation relations stay inside the official source boundary", () => {
  const source = {
    id: "source-a",
    adapter: {
      articleUrlPattern:
        "^https://example\\.com/posts/"
    },
    workRelations: [
      {
        canonicalUrl:
          "https://example.com/posts/translated",
        canonicalWorkId: "work:translated-copy",
        translationOf: "work:original"
      }
    ]
  };
  assert.deepEqual(
    configuredWorkIdentity(
      source,
      "https://example.com/posts/translated",
      {
        title: "Translated",
        summary: "A translation"
      }
    ),
    {
      canonicalWorkId: "work:translated-copy",
      translationOf: "work:original",
      workIdentityBasis: "curated",
      workIndependenceStatus: "related-copy"
    }
  );
  const malicious = structuredClone(source);
  malicious.workRelations[0].canonicalUrl =
    "https://attacker.example/posts/copied";
  assert.throws(
    () =>
      configuredWorkIdentity(
        malicious,
        malicious.workRelations[0].canonicalUrl,
        { title: "Copied" }
      ),
    /outside the official article boundary/
  );
});
