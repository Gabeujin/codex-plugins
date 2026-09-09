import {
  buildCanonicalSearchIndex,
  catalogFingerprint
} from "./integrity.mjs";
import { normalizeSearchText, sha256, tokenize } from "./text.mjs";
import {
  workFamily,
  workIndependenceStatus
} from "./work-identity.mjs";

export { catalogFingerprint };

export function buildSearchIndex(articles, builtAt = new Date().toISOString()) {
  return buildCanonicalSearchIndex(articles, builtAt);
}

function intersects(values, required) {
  return !required?.length || required.some((value) => values.includes(value));
}

function dateValue(value) {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function searchCatalog(
  query,
  catalog,
  index,
  {
    sourceIds,
    domainIds,
    problemTypeIds,
    since,
    limit = 20
  } = {}
) {
  const articlesById = new Map(
    catalog.articles.map((article) => [article.articleId, article])
  );
  const sourceSet = sourceIds?.length ? new Set(sourceIds) : null;
  const sinceTime = since ? Date.parse(since) : 0;
  if (since && !Number.isFinite(sinceTime)) {
    throw new Error("since must be a valid ISO-8601 date");
  }
  const queryTokens = [...new Set(tokenize(query))];
  const scores = new Map();
  const averageLength = index.averageDocumentLength || 1;
  const documentCount = index.documentCount || 1;
  const k1 = 1.2;
  const b = 0.75;

  for (const token of queryTokens) {
    const posting = index.postings[token] ?? [];
    const documentFrequency = posting.length;
    if (!documentFrequency) {
      continue;
    }
    const inverseDocumentFrequency = Math.log(
      1 + (documentCount - documentFrequency + 0.5) /
        (documentFrequency + 0.5)
    );
    for (const [documentIndex, termFrequency] of posting) {
      const document = index.documents[documentIndex];
      const denominator =
        termFrequency +
        k1 *
          (1 -
            b +
            b * ((document.length || 0) / averageLength));
      const contribution =
        inverseDocumentFrequency *
        ((termFrequency * (k1 + 1)) / denominator);
      scores.set(
        document.articleId,
        (scores.get(document.articleId) ?? 0) + contribution
      );
    }
  }

  const normalizedQuery = normalizeSearchText(query);
  const hasQuery = Boolean(normalizedQuery || queryTokens.length);
  const hasSemanticFilter = Boolean(
    domainIds?.length || problemTypeIds?.length
  );
  const candidates = catalog.articles
    .filter(
      (article) => (article.recordStatus ?? "active") === "active"
    )
    .filter((article) => !sourceSet || sourceSet.has(article.sourceId))
    .filter((article) => intersects(article.domainIds ?? [], domainIds))
    .filter((article) =>
      intersects(article.problemTypeIds ?? [], problemTypeIds)
    )
    .filter(
      (article) =>
        !sinceTime ||
        (article.publishedAt && dateValue(article.publishedAt) >= sinceTime)
    )
    .map((article) => {
      let relevanceScore = scores.get(article.articleId) ?? 0;
      if (
        normalizedQuery &&
        normalizeSearchText(article.title).includes(normalizedQuery)
      ) {
        relevanceScore += 4;
      }
      const matched =
        !hasQuery || relevanceScore > 0 || hasSemanticFilter;
      let score =
        relevanceScore ||
        (!hasQuery ? 1 : hasSemanticFilter ? 0.25 : 0);
      if (!matched) {
        return { article, score: 0, matched: false };
      }
      const ageDays = article.publishedAt
        ? Math.max(
            0,
            (Date.now() - dateValue(article.publishedAt)) /
              86_400_000
          )
        : 3650;
      score += Math.max(0, 0.35 - ageDays / 3650);
      return { article, score, matched: true };
    })
    .filter(({ score, matched }) => matched && score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        dateValue(right.article.publishedAt) -
          dateValue(left.article.publishedAt)
    )
    .slice(0, Math.max(1, Math.min(Number(limit) || 20, 1_000)))
    .map(({ article, score }) => ({
      ...article,
      score: Number(score.toFixed(4))
    }));

  return candidates.filter((article) =>
    articlesById.has(article.articleId)
  );
}

export function groupResultsBySource(results) {
  const groups = new Map();
  for (const article of results) {
    if (!groups.has(article.sourceId)) {
      groups.set(article.sourceId, {
        sourceId: article.sourceId,
        companyId: article.companyId,
        sourceName: article.sourceName,
        articles: []
      });
    }
    groups.get(article.sourceId).articles.push(article);
  }
  return [...groups.values()].sort(
    (left, right) =>
      (right.articles[0]?.score ?? 0) -
        (left.articles[0]?.score ?? 0) ||
      left.sourceId.localeCompare(right.sourceId)
  );
}

function distinctSourcesForConcept(results, field, conceptId) {
  return new Set(
    results
      .filter((article) => (article[field] ?? []).includes(conceptId))
      .map((article) => article.companyId)
  ).size;
}

function sharedConcepts(results, field, minPublishers = 2) {
  const concepts = new Set(results.flatMap((article) => article[field] ?? []));
  return [...concepts]
    .map((id) => ({
      id,
      sourceCount: distinctSourcesForConcept(results, field, id)
    }))
    .filter((item) => item.sourceCount >= minPublishers)
    .sort(
      (left, right) =>
        right.sourceCount - left.sourceCount ||
        left.id.localeCompare(right.id)
    );
}

const mechanismPatterns = [
  {
    id: "rollback",
    pattern: /\brollback\b|롤백|되돌리기|원복/iu
  },
  {
    id: "progressive-rollout",
    pattern:
      /\b(?:canary|progressive rollout|incremental rollout|feature flag)\b|카나리|점진적\s*(?:배포|전환)|기능\s*플래그/iu
  },
  {
    id: "shadow-or-dual-run",
    pattern:
      /\b(?:shadow traffic|shadowing|dual[- ]?(?:read|write|run))\b|섀도(?:잉)?|이중\s*(?:읽기|쓰기|운영)/iu
  },
  {
    id: "consumer-offset",
    pattern:
      /\bconsumer\s+offset\b|컨슈머\s*오프셋|소비자\s*오프셋/iu
  },
  {
    id: "reconciliation",
    pattern:
      /\breconciliation\b|정합성\s*(?:검증|대사)|데이터\s*대사/iu
  },
  {
    id: "graceful-shutdown",
    pattern:
      /\b(?:graceful shutdown|sigterm|pid\s*1)\b|우아한\s*종료|안전한\s*종료/iu
  },
  {
    id: "contract-compatibility",
    pattern:
      /\b(?:backward compatibility|contract test|schema evolution)\b|하위\s*호환|계약\s*테스트|스키마\s*진화/iu
  },
  {
    id: "slo-observation-gate",
    pattern:
      /\b(?:slo|error budget|success metric|failure threshold)\b|오류\s*예산|성공\s*지표|실패\s*기준/iu
  },
  {
    id: "automated-verification",
    pattern:
      /\b(?:automated verification|regression test|replay test)\b|자동\s*검증|회귀\s*테스트|리플레이\s*테스트/iu
  },
  {
    id: "traffic-shaping",
    pattern:
      /\b(?:rate limit|load shedding|backpressure|traffic splitting)\b|부하\s*차단|백프레셔|트래픽\s*분할/iu
  },
  {
    id: "partitioning",
    pattern:
      /\b(?:partitioning|sharding|consistent hashing)\b|파티셔닝|샤딩|일관된\s*해싱/iu
  }
];

function mechanismClause(text, index, length) {
  const before = text.slice(0, index);
  const after = text.slice(index + length);
  const leftBoundary = Math.max(
    before.lastIndexOf("\n"),
    before.lastIndexOf("."),
    before.lastIndexOf("!"),
    before.lastIndexOf("?"),
    before.lastIndexOf(";"),
    before.lastIndexOf("。"),
    before.lastIndexOf("！"),
    before.lastIndexOf("？"),
    before.lastIndexOf("；")
  );
  const rightOffsets = [
    after.indexOf("\n"),
    after.indexOf("."),
    after.indexOf("!"),
    after.indexOf("?"),
    after.indexOf(";"),
    after.indexOf("。"),
    after.indexOf("！"),
    after.indexOf("？"),
    after.indexOf("；")
  ].filter((offset) => offset >= 0);
  const rightBoundary = rightOffsets.length
    ? index + length + Math.min(...rightOffsets)
    : text.length;
  return text.slice(
    Math.max(leftBoundary + 1, index - 160),
    Math.min(rightBoundary, index + length + 160)
  );
}

const mechanismNegationPattern =
  /\b(?:no|not|never|without|impossible|failed to|cannot|can't|cant|wasn't|wasnt|weren't|werent|isn't|isnt|aren't|arent|didn't|didnt|doesn't|doesnt|omitted|skipped|bypassed|unused|unimplemented|instead of)\b|(?:하지|사용하지|적용하지|도입하지|지원하지|거치지|구현하지|포함하지|수행하지)\s*(?:않(?:았|는|다|음)?|못(?:했|한|함)?)|안\s*(?:했|함|하는|된)|(?:없(?:이|다|는|었|음)|불가능|미\s*(?:사용|적용|구현)|비\s*(?:사용|적용)|미사용|비사용|미적용|비적용|미구현|생략|제외|우회|대신|못(?:했|한|함))/iu;

function mechanismSignals(text) {
  const states = new Map();
  for (const mechanism of mechanismPatterns) {
    const flags = [
      ...new Set(
        `${mechanism.pattern.flags.replace(
          /[gy]/gu,
          ""
        )}g`
      )
    ].join("");
    const matches = text.matchAll(
      new RegExp(
      mechanism.pattern.source,
        flags
      )
    );
    let found = false;
    for (const match of matches) {
      found = true;
      const clause = mechanismClause(
        text,
        match.index,
        match[0].length
      );
      const state = states.get(mechanism.id) ?? {
        positive: false,
        negated: false
      };
      if (mechanismNegationPattern.test(clause)) {
        state.negated = true;
      } else {
        state.positive = true;
      }
      states.set(mechanism.id, state);
    }
    if (!found) {
      continue;
    }
  }
  return {
    mechanismIds: [...states]
      .filter(
        ([, state]) =>
          state.positive && !state.negated
      )
      .map(([id]) => id),
    ambiguousMechanismIds: [...states]
      .filter(([, state]) => state.negated)
      .map(([id]) => id)
  };
}

function contextSignals(article) {
  const text = [
    article.title,
    article.summary,
    (article.tags ?? []).join(" ")
  ].join("\n");
  const scaleMentions =
    text.match(
      /\b\d+(?:\.\d+)?\s*(?:k|m|b|tb|pb|eb|ms|rps|qps)\b|\d+\s*(?:만|억|천)\s*(?:건|명|개|회|대)?|대규모|글로벌/gi
    ) ?? [];
  const stackMentions =
    text.match(
      /\b(?:kafka|kubernetes|docker|spring|react|flutter|spark|hadoop|aws|gcp|node\.js|golang|kotlin|java|typescript|postgresql|mysql)\b/gi
    ) ?? [];
  const mechanisms = mechanismSignals(text);
  return {
    scaleMentions: [...new Set(scaleMentions)].slice(0, 8),
    stackMentions: [...new Set(stackMentions.map((item) => item.toLowerCase()))].slice(
      0,
      12
    ),
    mechanismIds: mechanisms.mechanismIds,
    ambiguousMechanismIds: mechanisms.ambiguousMechanismIds
  };
}

function sharedContextSignals(
  groups,
  field,
  minPublishers = 2
) {
  const counts = new Map();
  for (const group of groups) {
    const sourceSignals = new Set(
      group.articles.flatMap(
        (article) => article.contextSignals?.[field] ?? []
      )
    );
    for (const signal of sourceSignals) {
      counts.set(signal, counts.get(signal) ?? new Set());
      counts.get(signal).add(group.companyId);
    }
  }
  return [...counts.entries()]
    .map(([id, publishers]) => ({
      id,
      sourceCount: publishers.size
    }))
    .filter((item) => item.sourceCount >= minPublishers)
    .sort(
      (left, right) =>
        right.sourceCount - left.sourceCount ||
        left.id.localeCompare(right.id)
    );
}

const fusionStopwords = new Set([
  "관련",
  "개발",
  "개선",
  "국내",
  "기술",
  "기업",
  "내용",
  "도메인",
  "방법",
  "문제",
  "블로그",
  "비교",
  "사례",
  "서비스",
  "시스템",
  "신규",
  "분석",
  "사용",
  "회사",
  "운영",
  "적용",
  "참고",
  "포스팅",
  "해결",
  "환경",
  "blog",
  "case",
  "cases",
  "issue",
  "issues",
  "new",
  "post",
  "posts",
  "problem",
  "problems",
  "related",
  "service",
  "services",
  "system",
  "systems",
  "tech",
  "technology",
  "use",
  "using"
]);

const genericFusionAnchors = new Set([
  "architecture",
  "legacy",
  "migration",
  "refactor",
  "replatform",
  "upgrade",
  "교체",
  "기술부채",
  "레거시",
  "리팩터",
  "리팩터링",
  "마이그레이션",
  "부채",
  "아키텍처",
  "업그레이드",
  "전환"
]);

const koreanSuffixes = [
  "으로부터",
  "에서부터",
  "으로",
  "에서",
  "에게",
  "까지",
  "부터",
  "처럼",
  "보다",
  "하기",
  "하는",
  "되는",
  "되기",
  "들과",
  "들의",
  "와",
  "과",
  "을",
  "를",
  "이",
  "가",
  "은",
  "는",
  "의",
  "에",
  "로"
];

function stripKoreanSuffix(value) {
  if (!/^[가-힣]{3,}$/.test(value)) {
    return value;
  }
  const suffix = koreanSuffixes.find(
    (candidate) =>
      value.endsWith(candidate) &&
      value.length - candidate.length >= 2
  );
  return suffix ? value.slice(0, -suffix.length) : value;
}

export function fusionQueryTerms(query) {
  const chunks =
    normalizeSearchText(query).match(
      /[a-z0-9][a-z0-9.+#/_-]*|[가-힣]{2,}/g
    ) ?? [];
  return [
    ...new Set(
      chunks
        .map((chunk) => stripKoreanSuffix(chunk))
        .filter((term) => term.length >= 2)
        .filter((term) => !fusionStopwords.has(term))
    )
  ];
}

function articleMatchesFusionTerm(article, term) {
  const text = [
    article.title,
    article.summary,
    ...(article.tags ?? [])
  ].join(" ");
  if (/^[가-힣]+$/.test(term)) {
    return normalizeSearchText(text).includes(term);
  }
  return new Set(tokenize(text)).has(term);
}

function attachDirectQueryAnchors(groups, queryTerms) {
  return groups.map((group) => ({
    ...group,
    articles: group.articles.map((article) => ({
      ...article,
      directQueryAnchors: queryTerms.filter((term) =>
        articleMatchesFusionTerm(article, term)
      )
    }))
  }));
}

function sharedQueryAnchors(
  groups,
  queryTerms,
  minPublishers = 2
) {
  return queryTerms
    .map((term) => {
      const matchingSources = new Set();
      let articleCount = 0;
      for (const group of groups) {
        for (const article of group.articles) {
          if (article.directQueryAnchors.includes(term)) {
            matchingSources.add(group.companyId);
            articleCount += 1;
          }
        }
      }
      return {
        term,
        sourceCount: matchingSources.size,
        articleCount
      };
    })
    .filter((item) => item.sourceCount >= minPublishers)
    .sort(
      (left, right) =>
        right.sourceCount - left.sourceCount ||
        right.articleCount - left.articleCount ||
        left.term.localeCompare(right.term)
    );
}

function sourceFreshness(
  group,
  sourceStates,
  maxStalenessDays,
  now
) {
  if (!sourceStates) {
    return {
      status: "not-evaluated",
      usable: true,
      dataAsOf: null,
      ageDays: null
    };
  }
  const state = sourceStates[group.sourceId] ?? {};
  const dataAsOf =
    state.dataAsOf ?? state.lastSuccessAt ?? null;
  const parsed = dataAsOf ? Date.parse(dataAsOf) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return {
      status: "unknown",
      usable: false,
      dataAsOf,
      ageDays: null
    };
  }
  if (parsed > now) {
    return {
      status: "future-dated",
      usable: false,
      dataAsOf,
      ageDays: null
    };
  }
  const ageDays = Math.max(0, (now - parsed) / 86_400_000);
  if (ageDays > maxStalenessDays) {
    return {
      status: "stale",
      usable: false,
      dataAsOf,
      ageDays: Number(ageDays.toFixed(2))
    };
  }
  if (state.status !== "ok") {
    return {
      status: "degraded",
      usable: false,
      dataAsOf,
      ageDays: Number(ageDays.toFixed(2))
    };
  }
  return {
    status: "current",
    usable: true,
    dataAsOf,
    ageDays: Number(ageDays.toFixed(2))
  };
}

function publisherTrustBoundary() {
  return {
    kind: "untrusted-third-party-content",
    trustLevel: "untrusted-publisher-content",
    instructionsAllowed: false,
    mayContainPromptInjection: true
  };
}

function coherentSupports(groups, minPublishers) {
  const supports = new Map();
  for (const group of groups) {
    for (const article of group.articles) {
      const anchors = article.directQueryAnchors.filter(
        (term) => !genericFusionAnchors.has(term)
      );
      const mechanisms =
        article.contextSignals?.mechanismIds ?? [];
      const concepts = [
        ...(article.domainIds ?? []).map((id) => ({
          kind: "domain",
          id
        })),
        ...(article.problemTypeIds ?? []).map((id) => ({
          kind: "problem",
          id
        }))
      ];
      for (const anchor of anchors) {
        for (const mechanism of mechanisms) {
          for (const concept of concepts) {
            const key = [
              anchor,
              mechanism,
              concept.kind,
              concept.id
            ].join("\u001f");
            const support =
              supports.get(key) ?? {
                anchor,
                mechanism,
                concept,
                publishers: new Map(),
                sources: new Map(),
                articles: new Map()
              };
            support.publishers.set(group.companyId, true);
            support.sources.set(article.sourceId, true);
            support.articles.set(article.articleId, {
              articleId: article.articleId,
              sourceId: article.sourceId,
              companyId: article.companyId,
              workFamily: workFamily(article),
              workIndependenceStatus:
                workIndependenceStatus(article)
            });
            supports.set(key, support);
          }
        }
      }
    }
  }
  return [...supports.values()]
    .map((support) => {
      const articles = [...support.articles.values()];
      const confirmedArticles = articles.filter(
        (article) =>
          article.workIndependenceStatus ===
          "confirmed-original"
      );
      const companiesByWorkFamily = new Map();
      for (const article of confirmedArticles) {
        const companies =
          companiesByWorkFamily.get(article.workFamily) ??
          new Set();
        companies.add(article.companyId);
        companiesByWorkFamily.set(
          article.workFamily,
          companies
        );
      }
      const independentConfirmedArticles =
        confirmedArticles.filter(
          (article) =>
            companiesByWorkFamily.get(
              article.workFamily
            )?.size === 1
        );
      const confirmedWorkFamilies = new Set(
        independentConfirmedArticles
          .map((article) => article.workFamily)
      );
      const confirmedPublishers = new Set(
        independentConfirmedArticles.map(
          (article) => article.companyId
        )
      );
      const confirmedSources = new Set(
        independentConfirmedArticles.map(
          (article) => article.sourceId
        )
      );
      const distinctWorkFamilies = new Set(
        articles.map((article) => article.workFamily)
      );
      return {
        anchor: support.anchor,
        mechanism: support.mechanism,
        concept: support.concept,
        publisherCount: support.publishers.size,
        confirmedPublisherCount:
          confirmedPublishers.size,
        sourceCount: support.sources.size,
        confirmedSourceCount: confirmedSources.size,
        independentWorkCount:
          confirmedWorkFamilies.size,
        distinctWorkCount: distinctWorkFamilies.size,
        unconfirmedWorkCount:
          distinctWorkFamilies.size -
          confirmedWorkFamilies.size,
        articleIds: independentConfirmedArticles.map(
          (article) => article.articleId
        ),
        candidateArticleIds: articles.map(
          (article) => article.articleId
        )
      };
    })
    .filter(
      (support) =>
        support.publisherCount >= minPublishers
    )
    .sort(
      (left, right) =>
        right.publisherCount - left.publisherCount ||
        right.independentWorkCount - left.independentWorkCount ||
        right.articleIds.length - left.articleIds.length ||
        left.anchor.localeCompare(right.anchor) ||
        left.mechanism.localeCompare(right.mechanism) ||
        left.concept.id.localeCompare(right.concept.id)
    );
}

export function prepareFusionEvidence(
  query,
  catalog,
  index,
  {
    sourceIds,
    domainIds,
    problemTypeIds,
    minSources = 2,
    limitPerSource = 3,
    sourceStates,
    maxStalenessDays = 120,
    now = Date.now()
  } = {}
) {
  const requiredPublishers = Math.max(
    2,
    Math.min(Number(minSources) || 2, 9)
  );
  const results = searchCatalog(query, catalog, index, {
    sourceIds,
    domainIds,
    problemTypeIds,
    limit: Math.max(100, Math.min(catalog.articles.length, 1_000))
  });
  const queryTerms = fusionQueryTerms(query);
  const allGroups = attachDirectQueryAnchors(
    groupResultsBySource(results)
      .filter((group) => group.articles.length)
      .map((group) => ({
        ...group,
        articles: group.articles.map((article) => ({
          ...article,
          contextSignals: contextSignals(article),
          publisherContentTrust: publisherTrustBoundary()
        }))
      })),
    queryTerms
  ).map((group) => ({
    ...group,
    freshness: sourceFreshness(
      group,
      sourceStates,
      Math.max(1, Number(maxStalenessDays) || 120),
      Number(now) || Date.now()
    )
  }));
  const groups = allGroups.filter(
    (group) => group.freshness.usable
  );
  const publisherCount = new Set(
    groups.map((group) => group.companyId)
  ).size;
  const queryFingerprint = sha256(
    JSON.stringify({
      query: normalizeSearchText(query),
      sourceIds: [...(sourceIds ?? [])].sort(),
      domainIds: [...(domainIds ?? [])].sort(),
      problemTypeIds: [...(problemTypeIds ?? [])].sort(),
      requiredPublishers
    })
  );
  const boundedMatrix = (matrixGroups, articleIds = null) => {
    const allowed = articleIds ? new Set(articleIds) : null;
    return matrixGroups
      .map((group) => ({
        ...group,
        articles: group.articles
          .filter(
            (article) =>
              !allowed || allowed.has(article.articleId)
          )
          .slice(
            0,
            Math.max(
              1,
              Math.min(Number(limitPerSource) || 3, 8)
            )
          )
      }))
      .filter((group) => group.articles.length);
  };
  const heldReceipt = (status, reasons, matrixGroups = groups) => ({
    status: "held",
    decision: status,
    queryFingerprint,
    snapshotId: catalog.snapshotId ?? null,
    checkedSourceIds: allGroups.map((group) => group.sourceId),
    eligibleSourceIds: matrixGroups.map((group) => group.sourceId),
    acceptedEntryIds: [],
    heldReasons: reasons,
    evidenceStatus: "metadata-only"
  });

  if (
    sourceStates &&
    publisherCount < requiredPublishers &&
    allGroups.length >= requiredPublishers
  ) {
    return {
      status: "needs-freshness-review",
      query,
      queryFingerprint,
      publisherCount,
      requiredPublisherCount: requiredPublishers,
      sourceFreshness: allGroups.map((group) => ({
        sourceId: group.sourceId,
        companyId: group.companyId,
        ...group.freshness
      })),
      evidenceMatrix: boundedMatrix(allGroups),
      queryTerms,
      sharedQueryAnchors: [],
      sharedDomains: [],
      sharedProblems: [],
      runReceiptCandidate: heldReceipt(
        "needs-freshness-review",
        [
          "Too few current, successful publisher partitions remain after the freshness gate."
        ],
        groups
      ),
      guardrail:
        "Refresh failed, partial, unknown, or stale source partitions before cross-company synthesis."
    };
  }

  if (publisherCount < requiredPublishers) {
    return {
      status: "insufficient-source-diversity",
      query,
      queryFingerprint,
      sourceCount: groups.length,
      publisherCount,
      requiredPublisherCount: requiredPublishers,
      evidenceMatrix: boundedMatrix(groups),
      queryTerms,
      sharedQueryAnchors: [],
      sharedDomains: [],
      sharedProblems: [],
      runReceiptCandidate: heldReceipt(
        "insufficient-source-diversity",
        [
          "The query did not produce enough independent official publishers."
        ]
      ),
      guardrail:
        "Do not create a cross-company synthesis until enough distinct official publishers contribute independent works."
    };
  }

  const allDirectAnchors = sharedQueryAnchors(
    groups,
    queryTerms,
    requiredPublishers
  );
  const excludedGenericQueryAnchors = allDirectAnchors.filter((anchor) =>
    genericFusionAnchors.has(anchor.term)
  );
  const directAnchors = allDirectAnchors.filter(
    (anchor) => !genericFusionAnchors.has(anchor.term)
  );
  if (!directAnchors.length) {
    return {
      status: "needs-comparability-review",
      query,
      queryFingerprint,
      sourceCount: groups.length,
      publisherCount,
      articleCount: groups.flatMap((group) => group.articles).length,
      queryTerms,
      sharedQueryAnchors: [],
      excludedGenericQueryAnchors,
      sharedDomains: sharedConcepts(
        groups.flatMap((group) => group.articles),
        "domainIds",
        requiredPublishers
      ),
      sharedProblems: sharedConcepts(
        groups.flatMap((group) => group.articles),
        "problemTypeIds",
        requiredPublishers
      ),
      evidenceMatrix: boundedMatrix(groups),
      runReceiptCandidate: heldReceipt(
        "needs-comparability-review",
        [
          "Only generic architecture or migration language crossed the required publishers."
        ]
      ),
      guardrail:
        "Multiple publishers matched, but only generic migration or architecture language crosses source partitions. Add a concrete mechanism, runtime, workload, failure mode, or validation method before synthesis."
    };
  }

  const directAnchorTerms = new Set(
    directAnchors.map((item) => item.term)
  );
  const comparableGroups = groups
    .map((group) => ({
      ...group,
      articles: group.articles.filter((article) =>
        article.directQueryAnchors.some((term) =>
          directAnchorTerms.has(term)
        )
      )
    }))
    .filter((group) => group.articles.length);
  const comparablePublisherCount = new Set(
    comparableGroups.map((group) => group.companyId)
  ).size;
  if (comparablePublisherCount < requiredPublishers) {
    return {
      status: "needs-comparability-review",
      query,
      queryFingerprint,
      sourceCount: comparableGroups.length,
      publisherCount: comparablePublisherCount,
      candidateSourceCount: groups.length,
      articleCount: comparableGroups.flatMap(
        (group) => group.articles
      ).length,
      queryTerms,
      sharedQueryAnchors: directAnchors,
      excludedGenericQueryAnchors,
      sharedDomains: [],
      sharedProblems: [],
      evidenceMatrix: boundedMatrix(comparableGroups),
      runReceiptCandidate: heldReceipt(
        workIndependenceUnconfirmed
          ? "needs-work-independence-review"
          : "needs-comparability-review",
        [
          "Distinctive query anchors did not cross the required independent publishers."
        ],
        comparableGroups
      ),
      guardrail:
        "Distinctive query anchors do not support the required number of source partitions. Refine the query or verify comparability before synthesis."
    };
  }

  const selectedArticles = comparableGroups.flatMap(
    (group) => group.articles
  );
  const sharedMechanisms = sharedContextSignals(
    comparableGroups,
    "mechanismIds",
    requiredPublishers
  );
  const sharedStacks = sharedContextSignals(
    comparableGroups,
    "stackMentions",
    requiredPublishers
  );
  const ambiguousMechanisms = sharedContextSignals(
    comparableGroups,
    "ambiguousMechanismIds",
    1
  );
  if (!sharedMechanisms.length) {
    return {
      status: "needs-comparability-review",
      query,
      queryFingerprint,
      sourceCount: comparableGroups.length,
      publisherCount: comparablePublisherCount,
      articleCount: selectedArticles.length,
      queryTerms,
      sharedQueryAnchors: directAnchors,
      excludedGenericQueryAnchors,
      sharedMechanisms,
      ambiguousMechanisms,
      sharedStacks,
      sharedDomains: sharedConcepts(
        selectedArticles,
        "domainIds",
        requiredPublishers
      ),
      sharedProblems: sharedConcepts(
        selectedArticles,
        "problemTypeIds",
        requiredPublishers
      ),
      evidenceMatrix: boundedMatrix(comparableGroups),
      runReceiptCandidate: heldReceipt(
        "needs-comparability-review",
        [
          "No non-negated causal or verification mechanism crossed the required publishers."
        ],
        comparableGroups
      ),
      guardrail:
        "A shared product or stack term is not enough. At least one concrete causal or verification mechanism must cross two source partitions before synthesis."
    };
  }
  const sharedDomains = sharedConcepts(
    selectedArticles,
    "domainIds",
    requiredPublishers
  );
  const sharedProblems = sharedConcepts(
    selectedArticles,
    "problemTypeIds",
    requiredPublishers
  );
  if (!sharedDomains.length && !sharedProblems.length) {
    return {
      status: "needs-comparability-review",
      query,
      queryFingerprint,
      sourceCount: groups.length,
      publisherCount: comparablePublisherCount,
      articleCount: selectedArticles.length,
      queryTerms,
      sharedQueryAnchors: directAnchors,
      excludedGenericQueryAnchors,
      sharedMechanisms,
      ambiguousMechanisms,
      sharedStacks,
      sharedDomains,
      sharedProblems,
      evidenceMatrix: boundedMatrix(comparableGroups),
      runReceiptCandidate: heldReceipt(
        "needs-comparability-review",
        [
          "No canonical domain or engineering problem crossed the required publishers."
        ],
        comparableGroups
      ),
      guardrail:
        "Multiple publishers matched, but no shared canonical domain or problem crosses at least two source partitions. Refine the query or explicitly review comparability before synthesis."
    };
  }
  const coherentCandidates = coherentSupports(
    comparableGroups,
    requiredPublishers
  );
  const coherent = coherentCandidates.filter(
    (support) =>
      support.confirmedPublisherCount >=
        requiredPublishers &&
      support.independentWorkCount >=
      requiredPublishers
  );
  if (!coherent.length) {
    const workIndependenceUnconfirmed =
      coherentCandidates.some(
        (support) =>
          support.distinctWorkCount >=
            requiredPublishers &&
          (support.confirmedPublisherCount <
            requiredPublishers ||
            support.independentWorkCount <
              requiredPublishers)
      );
    return {
      status: workIndependenceUnconfirmed
        ? "needs-work-independence-review"
        : "needs-comparability-review",
      query,
      queryFingerprint,
      sourceCount: comparableGroups.length,
      publisherCount: comparablePublisherCount,
      articleCount: selectedArticles.length,
      queryTerms,
      sharedQueryAnchors: directAnchors,
      excludedGenericQueryAnchors,
      sharedMechanisms,
      ambiguousMechanisms,
      sharedStacks,
      sharedDomains,
      sharedProblems,
      coherentSupports:
        coherentCandidates.slice(0, 10),
      evidenceMatrix: boundedMatrix(comparableGroups),
      runReceiptCandidate: heldReceipt(
        workIndependenceUnconfirmed
          ? "needs-work-independence-review"
          : "needs-comparability-review",
        [
          workIndependenceUnconfirmed
            ? "Matching publisher records lack curated confirmation that they are independent original works rather than translations or reposts."
            : "Anchor, mechanism, and ontology overlap were supported by disjoint publisher subsets."
        ],
        comparableGroups
      ),
      guardrail:
        workIndependenceUnconfirmed
          ? "Review primary-source attribution and curate confirmed-original work identity before counting cross-company records as independent works."
          : "One coherent anchor-mechanism-concept intersection must be supported by every required independent publisher."
    };
  }
  const selectedSupport = coherent[0];
  const evidenceMatrix = boundedMatrix(
    comparableGroups,
    selectedSupport.articleIds
  );
  return {
    status: "metadata-comparable",
    query,
    queryFingerprint,
    sourceCount: evidenceMatrix.length,
    publisherCount:
      selectedSupport.confirmedPublisherCount,
    independentWorkCount: selectedSupport.independentWorkCount,
    articleCount: evidenceMatrix.flatMap(
      (group) => group.articles
    ).length,
    queryTerms,
    sharedQueryAnchors: directAnchors,
    excludedGenericQueryAnchors,
    sharedMechanisms,
    ambiguousMechanisms,
    sharedStacks,
    sharedDomains,
    sharedProblems,
    coherentSupports: coherent.slice(0, 10),
    selectedSupport,
    evidenceMatrix,
    sourceFreshness: evidenceMatrix.map((group) => ({
      sourceId: group.sourceId,
      companyId: group.companyId,
      ...group.freshness
    })),
    runReceiptCandidate: {
      status: "candidate",
      decision: "metadata-comparable",
      queryFingerprint,
      snapshotId: catalog.snapshotId ?? null,
      checkedSourceIds: allGroups.map((group) => group.sourceId),
      eligibleSourceIds: evidenceMatrix.map(
        (group) => group.sourceId
      ),
      acceptedEntryIds: [],
      heldReasons: [],
      evidenceStatus: "metadata-only"
    },
    nextGate: "evidence-review-required",
    synthesisContract: {
      retainArticleIds: true,
      distinguishAuthorClaimsFromInference: true,
      compareScaleStackAndOrganizationContext: true,
      surfaceContradictionsAndCounterEvidence: true,
      requireExperimentMetricsAndRollbackForApplication: true,
      physicalMergeOfSourceRecords: false,
      metadataComparabilityIsNotEvidenceReadiness: true,
      requireBoundedPrimaryEvidenceFromEveryPublisher: true,
      requireLocatorsAndNonMetadataClaims: true
    },
    guardrail:
      "This result proves metadata comparability only. Fetch bounded primary evidence from every publisher, review counter-evidence and context, then record a reviewed Dictionary revision before synthesis is considered evidence-ready."
  };
}
