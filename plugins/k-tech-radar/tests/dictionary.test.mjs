import assert from "node:assert/strict";
import test from "node:test";

import {
  dictionaryPublicationGate,
  validateDictionaryEntry
} from "../lib/dictionary.mjs";
import { calculateNegativeReviewScore } from "../lib/quality-score.mjs";

const catalog = {
  articles: [
    {
      articleId: "source-a:a1",
      sourceId: "source-a",
      companyId: "a",
      canonicalWorkId: "work:source-a:a1",
      workIndependenceStatus: "confirmed-original"
    },
    {
      articleId: "source-b:b1",
      sourceId: "source-b",
      companyId: "b",
      canonicalWorkId: "work:source-b:b1",
      workIndependenceStatus: "confirmed-original"
    }
  ]
};

function baseEntry() {
  return {
    kind: "cross-source-synthesis",
    title: "기술 부채를 줄이는 점진적 전환",
    summary: "관측성, 작은 배치, 롤백을 결합하는 가설",
    sourceIds: ["source-a", "source-b"],
    articleIds: ["source-a:a1", "source-b:b1"],
    evidence: [
      {
        sourceId: "source-a",
        articleId: "source-a:a1",
        claim: "점진적 전환을 관찰했다.",
        locator: "section-a",
        evidenceLevel: "article-observation",
        role: "observed"
      },
      {
        sourceId: "source-b",
        articleId: "source-b:b1",
        claim: "롤백 기준을 권고했다.",
        locator: "section-b",
        evidenceLevel: "author-claim",
        role: "recommended"
      }
    ],
    counterEvidence: ["두 사례의 런타임과 규모는 다르다."],
    contextComparisons: [
      {
        sourceId: "source-a",
        comparability: "conditional",
        note: "스택 재검증 필요"
      },
      {
        sourceId: "source-b",
        comparability: "conditional",
        note: "트래픽 재검증 필요"
      }
    ],
    status: "reviewed"
  };
}

test("cross-source Dictionary entries preserve evidence partitions", () => {
  const entry = validateDictionaryEntry(baseEntry(), catalog);
  assert.deepEqual(entry.sourceIds, ["source-a", "source-b"]);
  assert.equal(entry.evidence[1].role, "recommended");
});

test("cross-source Dictionary entries reject one-source evidence", () => {
  const entry = baseEntry();
  entry.sourceIds = ["source-a"];
  entry.articleIds = ["source-a:a1"];
  entry.evidence = [entry.evidence[0]];

  assert.throws(
    () => validateDictionaryEntry(entry, catalog),
    /at least two distinct source partitions|contextComparisons references/
  );
});

test("cross-source Dictionary entries reject two partitions from one company", () => {
  const sameCompanyCatalog = structuredClone(catalog);
  sameCompanyCatalog.articles[1].companyId = "a";
  assert.throws(
    () =>
      validateDictionaryEntry(
        baseEntry(),
        sameCompanyCatalog
      ),
    /at least two distinct companies/
  );
});

test("cross-source Dictionary entries reject syndicated or translated work", () => {
  const sameWorkCatalog = structuredClone(catalog);
  sameWorkCatalog.articles[0].canonicalWorkId =
    "work:shared";
  sameWorkCatalog.articles[1].translationOf =
    "work:shared";
  assert.throws(
    () =>
      validateDictionaryEntry(
        baseEntry(),
        sameWorkCatalog
      ),
    /confirmed-original independent canonical works/
  );
});

test("cross-source Dictionary entries reject uncurated derived work identities", () => {
  const uncuratedCatalog = structuredClone(catalog);
  for (const article of uncuratedCatalog.articles) {
    article.workIndependenceStatus = "review-required";
  }
  assert.throws(
    () =>
      validateDictionaryEntry(
        baseEntry(),
        uncuratedCatalog
      ),
    /confirmed-original independent canonical works/
  );
});

test("cross-source Dictionary entries require confirmed work from every contributing company", () => {
  const asymmetricCatalog = structuredClone(catalog);
  asymmetricCatalog.articles.push({
    ...asymmetricCatalog.articles[0],
    articleId: "source-a:a2",
    canonicalWorkId: "work:source-a:a2"
  });
  asymmetricCatalog.articles[1].workIndependenceStatus =
    "review-required";
  const entry = baseEntry();
  entry.articleIds.splice(1, 0, "source-a:a2");
  entry.evidence.splice(1, 0, {
    sourceId: "source-a",
    articleId: "source-a:a2",
    claim: "두 번째 독립 원문도 같은 회사에서 관찰됐다.",
    locator: "section-a2",
    evidenceLevel: "article-observation",
    role: "observed"
  });
  assert.throws(
    () =>
      validateDictionaryEntry(
        entry,
        asymmetricCatalog
      ),
    /every contributing company and source partition/
  );
});

test("verified entries reject metadata-only evidence", () => {
  const entry = baseEntry();
  entry.status = "verified";
  entry.verification = {
    primarySourcesChecked: true,
    counterEvidenceReviewed: true
  };
  entry.evidence[0].evidenceLevel = "metadata";

  assert.throws(
    () => validateDictionaryEntry(entry, catalog),
    /non-metadata/
  );
});

test("cross-source Dictionary entries reject listed articles with no claims", () => {
  const entry = baseEntry();
  entry.evidence = [entry.evidence[0]];

  assert.throws(
    () => validateDictionaryEntry(entry, catalog),
    /Every listed article must contribute/
  );
});

test("Dictionary entries reject fabricated source partitions", () => {
  const entry = baseEntry();
  entry.sourceIds.push("fabricated-source");

  assert.throws(
    () => validateDictionaryEntry(entry, catalog),
    /sources with no listed article evidence/
  );
});

test("Dictionary entries validate ontology ids when taxonomy is provided", () => {
  const entry = baseEntry();
  entry.domainIds = ["not-a-domain"];
  const taxonomy = {
    domains: [{ id: "architecture" }],
    problemTypes: [{ id: "technical-debt" }]
  };

  assert.throws(
    () => validateDictionaryEntry(entry, catalog, taxonomy),
    /Unknown ontology ids/
  );
});

test("Dictionary validation rejects oversized prose and evidence arrays", () => {
  const oversizedTitle = baseEntry();
  oversizedTitle.title = "가".repeat(181);
  assert.throws(
    () => validateDictionaryEntry(oversizedTitle, catalog),
    /at most 180 characters/
  );

  const tooManyClaims = baseEntry();
  tooManyClaims.evidence = Array.from(
    { length: 51 },
    (_, index) => ({
      ...tooManyClaims.evidence[index % 2],
      claim: `claim ${index}`
    })
  );
  assert.throws(
    () => validateDictionaryEntry(tooManyClaims, catalog),
    /at most 50 claims/
  );
});

test("Dictionary review timestamps require canonical ISO-8601 instants", () => {
  for (const [field, mutate] of [
    [
      "qualityReview.reviewedAt",
      (entry, value) => {
        entry.qualityReview = {
          rounds: [],
          reviewedAt: value
        };
      }
    ],
    [
      "verification.reviewedAt",
      (entry, value) => {
        entry.verification = {
          primarySourcesChecked: false,
          counterEvidenceReviewed: false,
          reviewedAt: value
        };
      }
    ]
  ]) {
    for (const value of [
      "SECRET=sk-proj-abcdefghijkl",
      "2026-02-30T00:00:00.000Z",
      "2026-07-30T00:00:00Z"
    ]) {
      const entry = baseEntry();
      mutate(entry, value);
      assert.throws(
        () => validateDictionaryEntry(entry, catalog),
        new RegExp(
          `${field.replaceAll(".", "\\.")} must be a canonical ISO-8601`
        )
      );
    }
  }
});

test("Dictionary review rounds require non-empty content-addressed evidence", () => {
  const rounds = [1, 2, 3].map((round) => {
    const counts = {
      p0: 0,
      p1: 0,
      p2: 0
    };
    return {
      round,
      ...counts,
      score: calculateNegativeReviewScore(counts),
      summary: `review ${round}`
    };
  });
  const entry = {
    ...baseEntry(),
    qualityReview: {
      rounds
    }
  };
  assert.throws(
    () => validateDictionaryEntry(entry, catalog),
    /content-addressed review artifacts/
  );
  assert.equal(
    dictionaryPublicationGate({
      visibility: "public",
      status: "verified",
      qualityReview: {
        rounds
      }
    }).passed,
    false
  );
});

test("Dictionary review artifacts are materialized and reject claimed-hash tampering", () => {
  const entry = {
    ...baseEntry(),
    qualityReview: {
      rounds: [1, 2, 3].map((round) => {
        const counts = { p0: 0, p1: 0, p2: 0 };
        return {
          round,
          ...counts,
          score: calculateNegativeReviewScore(counts),
          summary: `review ${round}`,
          evidenceRefs: [
            {
              kind: "review-report",
              content: `review artifact ${round}`
            }
          ]
        };
      })
    }
  };
  const validated =
    validateDictionaryEntry(entry, catalog);
  assert.match(
    validated.qualityReview.rounds[0]
      .evidenceRefs[0].artifactId,
    /^review-artifact:[a-f0-9]{64}$/u
  );
  const tampered = structuredClone(validated);
  tampered.qualityReview.rounds[0]
    .evidenceRefs[0].content += " tampered";
  assert.throws(
    () => validateDictionaryEntry(tampered, catalog),
    /canonical review artifact/
  );
});
