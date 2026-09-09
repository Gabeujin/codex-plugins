import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSearchIndex,
  prepareFusionEvidence,
  searchCatalog
} from "../lib/index.mjs";

const catalog = {
  articles: [
    {
      articleId: "source-a:a1",
      sourceId: "source-a",
      companyId: "a",
      sourceName: "A",
      title: "레거시 배포 병목을 점진적으로 마이그레이션",
      summary: "관측 지표와 롤백을 둔 점진적 전환",
      tags: ["migration"],
      domainIds: ["architecture"],
      problemTypeIds: ["technical-debt", "delivery-speed"],
      canonicalUrl: "https://a.example/post",
      workIdentityBasis: "curated",
      workIndependenceStatus: "confirmed-original",
      publishedAt: "2026-07-20T00:00:00.000Z"
    },
    {
      articleId: "source-b:b1",
      sourceId: "source-b",
      companyId: "b",
      sourceName: "B",
      title: "레거시 시스템 관측성과 안전한 롤백",
      summary: "마이그레이션 전에 SLO와 실패 기준을 정의",
      tags: ["observability"],
      domainIds: ["architecture", "quality-reliability"],
      problemTypeIds: ["technical-debt", "observability"],
      canonicalUrl: "https://b.example/post",
      workIdentityBasis: "curated",
      workIndependenceStatus: "confirmed-original",
      publishedAt: "2026-07-18T00:00:00.000Z"
    }
  ]
};
const index = buildSearchIndex(catalog.articles, "2026-07-28T00:00:00.000Z");

test("partitioned source filters never erase article provenance", () => {
  const results = searchCatalog("레거시", catalog, index, {
    sourceIds: ["source-a"],
    limit: 10
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].sourceId, "source-a");
  assert.equal(results[0].articleId, "source-a:a1");
});

test("fusion evidence requires distinct source partitions", () => {
  const insufficient = prepareFusionEvidence(
    "레거시",
    catalog,
    index,
    { sourceIds: ["source-a"], minSources: 2 }
  );
  assert.equal(
    insufficient.status,
    "insufficient-source-diversity"
  );

  const comparable = prepareFusionEvidence("레거시 롤백", catalog, index, {
    minSources: 2
  });
  assert.equal(comparable.status, "metadata-comparable");
  assert.equal(comparable.sourceCount, 2);
  assert.ok(
    comparable.sharedQueryAnchors.some(
      (anchor) => anchor.term === "롤백" && anchor.sourceCount === 2
    )
  );
  assert.ok(
    comparable.sharedMechanisms.some(
      (mechanism) => mechanism.id === "rollback"
    )
  );
  assert.equal(
    comparable.synthesisContract.physicalMergeOfSourceRecords,
    false
  );
  assert.ok(
    comparable.sharedProblems.some((problem) => problem.id === "technical-debt")
  );
  assert.equal(
    comparable.nextGate,
    "evidence-review-required"
  );
});

test("unmatched queries do not return recent unrelated articles", () => {
  const results = searchCatalog(
    "qzxvplmno987654",
    catalog,
    index,
    { limit: 10 }
  );
  assert.deepEqual(results, []);

  const fusion = prepareFusionEvidence(
    "qzxvplmno987654",
    catalog,
    index,
    { minSources: 2 }
  );
  assert.equal(fusion.status, "insufficient-source-diversity");
  assert.equal(fusion.sourceCount, 0);
});

test("invalid date filters fail closed", () => {
  assert.throws(
    () =>
      searchCatalog("레거시", catalog, index, {
        since: "not-a-date"
      }),
    /valid ISO-8601 date/
  );
});

test("broad ontology overlap cannot bypass direct query comparability", () => {
  const falsePositiveCatalog = {
    articles: [
      {
        articleId: "source-a:shutdown",
        sourceId: "source-a",
        companyId: "a",
        sourceName: "A",
        title: "Node.js graceful shutdown과 SIGTERM",
        summary: "PID 1과 이벤트 루프를 안전하게 종료",
        tags: [],
        domainIds: ["backend-distributed-systems"],
        problemTypeIds: ["reliability", "performance-bottleneck"],
        canonicalUrl: "https://a.example/shutdown",
        publishedAt: "2026-07-20T00:00:00.000Z"
      },
      {
        articleId: "source-b:serving",
        sourceId: "source-b",
        companyId: "b",
        sourceName: "B",
        title: "Kubernetes LLM serving 기술 최적화",
        summary: "프로덕션 인프라의 GPU 처리량 개선",
        tags: [],
        domainIds: ["backend-distributed-systems"],
        problemTypeIds: ["reliability", "performance-bottleneck"],
        canonicalUrl: "https://b.example/serving",
        publishedAt: "2026-07-19T00:00:00.000Z"
      }
    ]
  };
  const falsePositiveIndex = buildSearchIndex(
    falsePositiveCatalog.articles,
    "2026-07-28T00:00:00.000Z"
  );
  const result = prepareFusionEvidence(
    "Node.js 서비스의 배포 중 장애와 graceful shutdown 병목 관련 기술 부채",
    falsePositiveCatalog,
    falsePositiveIndex,
    { minSources: 2 }
  );

  assert.equal(result.status, "needs-comparability-review");
  assert.deepEqual(result.sharedQueryAnchors, []);
});

test("generic migration language cannot fuse unrelated stacks", () => {
  const articles = [
    {
      articleId: "kurly:nx-bun",
      sourceId: "kurly",
      companyId: "kurly",
      sourceName: "Kurly",
      title: "Nx에서 Bun 더 잘 사용하기",
      summary: "Nx 18에서 21로 마이그레이션",
      tags: [],
      domainIds: ["architecture"],
      problemTypeIds: ["migration"],
      canonicalUrl: "https://a.example/nx",
      publishedAt: "2026-07-20T00:00:00.000Z"
    },
    {
      articleId: "ly:dbaas",
      sourceId: "ly",
      companyId: "ly",
      sourceName: "LY",
      title: "DBaaS 아키텍처와 데이터 마이그레이션",
      summary: "관리형 데이터베이스 전환",
      tags: [],
      domainIds: ["architecture"],
      problemTypeIds: ["migration"],
      canonicalUrl: "https://b.example/dbaas",
      publishedAt: "2026-07-19T00:00:00.000Z"
    },
    {
      articleId: "bank:hilt",
      sourceId: "bank",
      companyId: "bank",
      sourceName: "Bank",
      title: "Koin에서 Hilt로 마이그레이션",
      summary: "Android 의존성 주입 프레임워크 교체",
      tags: [],
      domainIds: ["architecture"],
      problemTypeIds: ["migration"],
      canonicalUrl: "https://c.example/hilt",
      publishedAt: "2026-07-18T00:00:00.000Z"
    },
    {
      articleId: "woo:react",
      sourceId: "woo",
      companyId: "woo",
      sourceName: "Woo",
      title: "React 19 마이그레이션과 타입 충돌",
      summary: "프런트엔드 런타임 업그레이드",
      tags: [],
      domainIds: ["architecture"],
      problemTypeIds: ["migration"],
      canonicalUrl: "https://d.example/react",
      publishedAt: "2026-07-17T00:00:00.000Z"
    }
  ];
  const unrelatedCatalog = { articles };
  const unrelatedIndex = buildSearchIndex(
    articles,
    "2026-07-28T00:00:00.000Z"
  );
  const result = prepareFusionEvidence(
    "기술 부채 레거시 마이그레이션",
    unrelatedCatalog,
    unrelatedIndex,
    { minSources: 2 }
  );

  assert.equal(result.status, "needs-comparability-review");
  assert.deepEqual(result.sharedQueryAnchors, []);
  assert.ok(
    result.excludedGenericQueryAnchors.some(
      (anchor) => anchor.term === "마이그레이션"
    )
  );
  assert.equal(result.synthesisContract, undefined);
});

test("a shared product token without a shared mechanism remains review-only", () => {
  const articles = [
    {
      articleId: "source-a:kafka-api",
      sourceId: "source-a",
      companyId: "a",
      sourceName: "A",
      title: "Kafka Streams API 마이그레이션",
      summary: "애플리케이션 API 전환",
      tags: [],
      domainIds: ["backend-distributed-systems"],
      problemTypeIds: ["migration"],
      canonicalUrl: "https://a.example/kafka-api",
      publishedAt: "2026-07-20T00:00:00.000Z"
    },
    {
      articleId: "source-b:kafka-dc",
      sourceId: "source-b",
      companyId: "b",
      sourceName: "B",
      title: "Kafka 클러스터 데이터센터 마이그레이션",
      summary: "브로커를 다른 리전으로 이전",
      tags: [],
      domainIds: ["backend-distributed-systems"],
      problemTypeIds: ["migration"],
      canonicalUrl: "https://b.example/kafka-dc",
      publishedAt: "2026-07-19T00:00:00.000Z"
    }
  ];
  const kafkaCatalog = { articles };
  const kafkaIndex = buildSearchIndex(
    articles,
    "2026-07-28T00:00:00.000Z"
  );
  const result = prepareFusionEvidence(
    "Kafka 마이그레이션",
    kafkaCatalog,
    kafkaIndex,
    { minSources: 2 }
  );

  assert.equal(result.status, "needs-comparability-review");
  assert.ok(
    result.sharedQueryAnchors.some(
      (anchor) => anchor.term === "kafka"
    )
  );
  assert.deepEqual(result.sharedMechanisms, []);
});

test("a specific shared migration mechanism unlocks metadata comparability only", () => {
  const articles = [
    {
      articleId: "source-a:offset",
      sourceId: "source-a",
      companyId: "a",
      sourceName: "A",
      title: "Kafka consumer offset 마이그레이션",
      summary: "dual-read 검증과 rollback 기준",
      tags: [],
      domainIds: ["backend-distributed-systems"],
      problemTypeIds: ["migration", "reliability"],
      canonicalUrl: "https://a.example/offset",
      canonicalWorkId: "work:source-a:offset",
      workIdentityBasis: "curated",
      workIndependenceStatus: "confirmed-original",
      publishedAt: "2026-07-20T00:00:00.000Z"
    },
    {
      articleId: "source-b:offset",
      sourceId: "source-b",
      companyId: "b",
      sourceName: "B",
      title: "Kafka consumer offset 이전",
      summary: "reconciliation 이후 rollback",
      tags: [],
      domainIds: ["backend-distributed-systems"],
      problemTypeIds: ["migration", "reliability"],
      canonicalUrl: "https://b.example/offset",
      canonicalWorkId: "work:source-b:offset",
      workIdentityBasis: "curated",
      workIndependenceStatus: "confirmed-original",
      publishedAt: "2026-07-19T00:00:00.000Z"
    }
  ];
  const offsetCatalog = { articles };
  const offsetIndex = buildSearchIndex(
    articles,
    "2026-07-28T00:00:00.000Z"
  );
  const result = prepareFusionEvidence(
    "Kafka consumer offset migration",
    offsetCatalog,
    offsetIndex,
    { minSources: 2 }
  );

  assert.equal(result.status, "metadata-comparable");
  assert.ok(
    ["kafka", "consumer", "offset"].every((term) =>
      result.sharedQueryAnchors.some(
        (anchor) => anchor.term === term
      )
    )
  );
  assert.ok(
    result.sharedMechanisms.some(
      (mechanism) => mechanism.id === "consumer-offset"
    )
  );
  assert.equal(
    result.synthesisContract
      .metadataComparabilityIsNotEvidenceReadiness,
    true
  );
});

test("multiple source partitions from one company do not satisfy publisher diversity", () => {
  const articles = [
    {
      ...catalog.articles[0],
      sourceId: "company-a-ko",
      companyId: "company-a",
      articleId: "company-a-ko:one",
      contentHash: "a".repeat(64)
    },
    {
      ...catalog.articles[1],
      sourceId: "company-a-en",
      companyId: "company-a",
      articleId: "company-a-en:two",
      contentHash: "b".repeat(64)
    }
  ];
  const result = prepareFusionEvidence(
    "레거시 롤백",
    { articles },
    buildSearchIndex(articles),
    { minSources: 2 }
  );
  assert.equal(
    result.status,
    "insufficient-source-diversity"
  );
  assert.equal(result.publisherCount, 1);
});

test("negated mechanisms stay ambiguous and cannot unlock fusion", () => {
  const articles = [
    {
      ...catalog.articles[0],
      title: "Kafka rollback 검증",
      summary: "rollback 기준으로 안전한 전환",
      domainIds: ["backend"],
      problemTypeIds: ["migration"],
      contentHash: "c".repeat(64)
    },
    {
      ...catalog.articles[1],
      title: "Kafka rollback 회고",
      summary: "rollback은 불가능했고 별도 복구도 없었다",
      domainIds: ["backend"],
      problemTypeIds: ["migration"],
      contentHash: "d".repeat(64)
    }
  ];
  const result = prepareFusionEvidence(
    "Kafka rollback",
    { articles },
    buildSearchIndex(articles),
    { minSources: 2 }
  );
  assert.equal(result.status, "needs-comparability-review");
  assert.ok(
    result.ambiguousMechanisms.some(
      (mechanism) => mechanism.id === "rollback"
    )
  );
});

test("Korean attached, spaced, and noun-form negation cannot unlock fusion", () => {
  for (const negatedSummary of [
    "rollback하지 않았다",
    "rollback 없이 전환했다",
    "rollback 미사용 상태였다"
  ]) {
    const articles = [
      {
        ...catalog.articles[0],
        title: "Kafka rollback 검증",
        summary: "rollback 기준으로 안전한 전환",
        domainIds: ["backend"],
        problemTypeIds: ["migration"],
        canonicalWorkId: "work:positive-rollback"
      },
      {
        ...catalog.articles[1],
        title: "Kafka rollback 회고",
        summary: negatedSummary,
        domainIds: ["backend"],
        problemTypeIds: ["migration"],
        canonicalWorkId: `work:${negatedSummary}`
      }
    ];
    const result = prepareFusionEvidence(
      "Kafka rollback",
      { articles },
      buildSearchIndex(articles),
      { minSources: 2 }
    );
    assert.equal(
      result.status,
      "needs-comparability-review",
      negatedSummary
    );
    assert.ok(
      result.ambiguousMechanisms.some(
        (mechanism) => mechanism.id === "rollback"
      ),
      negatedSummary
    );
  }
});

test("every mechanism occurrence and conservative Korean or English negation blocks comparability", () => {
  for (const negatedSummary of [
    "rollback 절차를 거치지 않았다",
    "rollback 미구현 상태였다",
    "rollback 단계를 생략했다",
    "rollback 대신 즉시 전환했다",
    "rollback wasnt used in production",
    "rollback was mentioned but did not use it"
  ]) {
    const articles = [
      {
        ...catalog.articles[0],
        title: "Kafka rollback 운영 검증",
        summary: "rollback reconciliation 검증",
        domainIds: ["backend"],
        problemTypeIds: ["migration"],
        canonicalWorkId: "work:positive-rollback"
      },
      {
        ...catalog.articles[1],
        title: "Kafka rollback 운영 검토",
        summary: negatedSummary,
        domainIds: ["backend"],
        problemTypeIds: ["migration"],
        canonicalWorkId:
          `work:${negatedSummary}`
      }
    ];
    const result = prepareFusionEvidence(
      "Kafka rollback",
      { articles },
      buildSearchIndex(articles),
      { minSources: 2 }
    );
    assert.equal(
      result.status,
      "needs-comparability-review",
      negatedSummary
    );
    assert.ok(
      result.ambiguousMechanisms.some(
        (item) => item.id === "rollback"
      ),
      negatedSummary
    );
  }
});

test("stale or failed publisher partitions block comparability", () => {
  const now = Date.parse("2026-07-30T00:00:00.000Z");
  const result = prepareFusionEvidence(
    "레거시 롤백",
    catalog,
    index,
    {
      minSources: 2,
      now,
      maxStalenessDays: 30,
      sourceStates: {
        "source-a": {
          status: "ok",
          dataAsOf: "2026-07-29T00:00:00.000Z"
        },
        "source-b": {
          status: "error",
          dataAsOf: "2026-07-29T00:00:00.000Z"
        }
      }
    }
  );
  assert.equal(result.status, "needs-freshness-review");
  assert.equal(
    result.sourceFreshness.find(
      (source) => source.sourceId === "source-b"
    ).status,
    "degraded"
  );
});

test("freshness accepts only successful non-future source states", () => {
  const now = Date.parse("2026-07-30T00:00:00.000Z");
  for (const [status, dataAsOf] of [
    ["failed", "2026-07-29T00:00:00.000Z"],
    ["partial", "2026-07-29T00:00:00.000Z"],
    ["error", "2026-07-29T00:00:00.000Z"],
    ["never-checked", "2026-07-29T00:00:00.000Z"],
    ["seed", "2026-07-29T00:00:00.000Z"],
    ["future-status", "2026-07-29T00:00:00.000Z"],
    ["ok", "2026-07-31T00:00:00.000Z"]
  ]) {
    const result = prepareFusionEvidence(
      "레거시 롤백",
      catalog,
      index,
      {
        minSources: 2,
        now,
        maxStalenessDays: 30,
        sourceStates: {
          "source-a": {
            status: "ok",
            dataAsOf: "2026-07-29T00:00:00.000Z"
          },
          "source-b": {
            status,
            dataAsOf
          }
        }
      }
    );
    assert.equal(
      result.status,
      "needs-freshness-review",
      `${status} ${dataAsOf}`
    );
    assert.equal(
      result.sourceFreshness.find(
        (source) => source.sourceId === "source-b"
      ).usable,
      false
    );
  }
});

test("syndicated or translated records do not satisfy independent-work diversity", () => {
  for (const relation of [
    {
      canonicalWorkId: "work:shared",
      translationOf: null
    },
    {
      canonicalWorkId: "work:translation-copy",
      translationOf: "work:shared"
    }
  ]) {
    const articles = [
      {
        ...catalog.articles[0],
        title: "Kafka rollback 전환",
        summary: "rollback reconciliation 검증",
        domainIds: ["backend"],
        problemTypeIds: ["migration"],
        canonicalWorkId: "work:shared",
        translationOf: null
      },
      {
        ...catalog.articles[1],
        title: "Kafka rollback 전환",
        summary: "rollback reconciliation 검증",
        domainIds: ["backend"],
        problemTypeIds: ["migration"],
        ...relation
      }
    ];
    const result = prepareFusionEvidence(
      "Kafka rollback",
      { articles },
      buildSearchIndex(articles),
      { minSources: 2 }
    );
    assert.equal(
      result.status,
      "needs-comparability-review"
    );
    assert.ok(
      (result.coherentSupports ?? []).every(
        (support) => support.independentWorkCount < 2
      )
    );
  }
});

test("differently worded or translated metadata remains held until original-work independence is curated", () => {
  const articles = [
    {
      ...catalog.articles[0],
      title: "Kafka rollback reconciliation",
      summary:
        "Consumer rollback reconciliation was verified.",
      language: "en",
      domainIds: ["backend"],
      problemTypeIds: ["migration"],
      canonicalWorkId: "work:derived-english",
      workIdentityBasis: "derived-metadata",
      workIndependenceStatus: "review-required"
    },
    {
      ...catalog.articles[1],
      title: "카프카 롤백 정합성 검증",
      summary:
        "컨슈머 롤백과 reconciliation을 검증했다.",
      language: "ko",
      domainIds: ["backend"],
      problemTypeIds: ["migration"],
      canonicalWorkId: "work:derived-korean",
      workIdentityBasis: "derived-metadata",
      workIndependenceStatus: "review-required"
    }
  ];
  const result = prepareFusionEvidence(
    "Kafka rollback reconciliation",
    { articles },
    buildSearchIndex(articles),
    { minSources: 2 }
  );
  assert.equal(
    result.status,
    "needs-work-independence-review"
  );
  assert.equal(
    result.runReceiptCandidate.decision,
    "needs-work-independence-review"
  );
  assert.equal(
    result.coherentSupports[0].independentWorkCount,
    0
  );
  assert.equal(
    result.coherentSupports[0].unconfirmedWorkCount,
    2
  );
});

test("confirmed works concentrated in one company cannot satisfy cross-company independence", () => {
  const articles = [
    {
      ...catalog.articles[0],
      articleId: "source-a:confirmed-1",
      sourceId: "source-a",
      companyId: "company-a",
      title: "Kafka rollback reconciliation practice",
      summary:
        "Dual-read rollback and reconciliation were verified.",
      canonicalWorkId: "work:company-a:one",
      workIdentityBasis: "curated",
      workIndependenceStatus: "confirmed-original",
      domainIds: ["backend-distributed-systems"],
      problemTypeIds: ["migration"]
    },
    {
      ...catalog.articles[0],
      articleId: "source-a:confirmed-2",
      sourceId: "source-a",
      companyId: "company-a",
      title: "Kafka rollback reconciliation follow-up",
      summary:
        "A second dual-read rollback reconciliation was verified.",
      canonicalWorkId: "work:company-a:two",
      workIdentityBasis: "curated",
      workIndependenceStatus: "confirmed-original",
      domainIds: ["backend-distributed-systems"],
      problemTypeIds: ["migration"]
    },
    {
      ...catalog.articles[1],
      articleId: "source-b:uncurated",
      sourceId: "source-b",
      companyId: "company-b",
      title: "Kafka rollback reconciliation report",
      summary:
        "Dual-read rollback and reconciliation were described.",
      canonicalWorkId: "work:company-b:uncurated",
      workIdentityBasis: "derived-metadata",
      workIndependenceStatus: "review-required",
      domainIds: ["backend-distributed-systems"],
      problemTypeIds: ["migration"]
    }
  ];
  const result = prepareFusionEvidence(
    "Kafka rollback reconciliation",
    { articles },
    buildSearchIndex(articles),
    { minSources: 2 }
  );
  assert.equal(
    result.status,
    "needs-work-independence-review"
  );
  assert.equal(
    result.runReceiptCandidate.decision,
    "needs-work-independence-review"
  );
  assert.equal(
    result.coherentSupports[0].publisherCount,
    2
  );
  assert.equal(
    result.coherentSupports[0].confirmedPublisherCount,
    1
  );
  assert.equal(
    result.coherentSupports[0].independentWorkCount,
    2
  );
});

test("comparability is evaluated before per-source output truncation", () => {
  const articles = [
    {
      ...catalog.articles[0],
      articleId: "source-a:newer",
      title: "Kafka offset 개요",
      summary: "일반 소개",
      domainIds: ["backend"],
      problemTypeIds: ["migration"],
      publishedAt: "2026-07-30T00:00:00.000Z",
      contentHash: "e".repeat(64)
    },
    {
      ...catalog.articles[0],
      articleId: "source-a:mechanism",
      title: "Kafka consumer offset 전환",
      summary: "consumer offset reconciliation 검증",
      domainIds: ["backend"],
      problemTypeIds: ["migration"],
      publishedAt: "2026-07-20T00:00:00.000Z",
      contentHash: "f".repeat(64)
    },
    {
      ...catalog.articles[1],
      articleId: "source-b:newer",
      title: "Kafka offset 소개",
      summary: "운영 배경",
      domainIds: ["backend"],
      problemTypeIds: ["migration"],
      publishedAt: "2026-07-29T00:00:00.000Z",
      contentHash: "1".repeat(64)
    },
    {
      ...catalog.articles[1],
      articleId: "source-b:mechanism",
      title: "Kafka consumer offset 이전",
      summary: "consumer offset reconciliation 검증",
      domainIds: ["backend"],
      problemTypeIds: ["migration"],
      publishedAt: "2026-07-19T00:00:00.000Z",
      contentHash: "2".repeat(64)
    }
  ];
  const result = prepareFusionEvidence(
    "Kafka consumer offset",
    { articles },
    buildSearchIndex(articles),
    {
      minSources: 2,
      limitPerSource: 1
    }
  );
  assert.equal(result.status, "metadata-comparable");
  assert.deepEqual(
    result.evidenceMatrix.map(
      (group) => group.articles[0].articleId
    ),
    ["source-a:mechanism", "source-b:mechanism"]
  );
});
