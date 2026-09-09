import {
  dictionaryPath,
  loadDictionary,
  writeJson
} from "./paths.mjs";
import {
  publisherContentTrust,
  stableJson,
  taxonomyHash as computeTaxonomyHash
} from "./integrity.mjs";
import {
  workFamily,
  workIndependenceStatus
} from "./work-identity.mjs";
import { withMutationLease } from "./mutations.mjs";
import {
  assertNegativeReviewScore,
  calculateNegativeReviewScore
} from "./quality-score.mjs";
import {
  hasPublicReviewEvidenceReceipts,
  hasVerifiableReviewEvidence,
  normalizePublicReviewEvidenceRefs,
  normalizeReviewRoundsEvidence,
  PUBLIC_REVIEW_EVIDENCE_MODE,
  reviewSubjectHash
} from "./review-evidence.mjs";
import {
  normalizeSearchText,
  sha256,
  slugify,
  tokenize
} from "./text.mjs";

const MAX_DICTIONARY_ENTRIES = 2_000;
const MAX_DICTIONARY_BYTES = 15_000_000;
const MAX_DICTIONARY_REVISIONS = 8_000;
const MAX_IDEMPOTENCY_KEYS = 8_000;

const allowedKinds = new Set([
  "article-summary",
  "source-insight",
  "cross-source-synthesis",
  "application-note"
]);
const allowedStatuses = new Set([
  "candidate",
  "reviewed",
  "verified",
  "superseded"
]);
const allowedEvidenceLevels = new Set([
  "metadata",
  "article-observation",
  "measured-result",
  "author-claim"
]);
const allowedClaimRoles = new Set([
  "observed",
  "recommended",
  "inferred",
  "tested-locally"
]);
const allowedVisibility = new Set(["local", "public"]);
const allowedIndependence = new Set([
  "provider-self",
  "independent",
  "mixed",
  "unknown"
]);
const allowedDirectness = new Set(["direct", "indirect", "unknown"]);
const allowedStudyDesign = new Set([
  "experience-report",
  "incident-review",
  "benchmark",
  "architecture-rationale",
  "experiment",
  "unknown"
]);
const statusRank = new Map([
  ["candidate", 0],
  ["reviewed", 1],
  ["verified", 2],
  ["superseded", 3]
]);

function dictionaryReviewSubjectPayload(entry) {
  return {
    kind: entry.kind,
    title: entry.title,
    question: entry.question,
    finding: entry.finding,
    summary: entry.summary,
    sourceIds: entry.sourceIds,
    articleIds: entry.articleIds,
    domainIds: entry.domainIds,
    problemTypeIds: entry.problemTypeIds,
    evidence: entry.evidence,
    preconditions: entry.preconditions,
    tradeoffs: entry.tradeoffs,
    counterEvidence: entry.counterEvidence,
    contextComparisons: entry.contextComparisons,
    application: entry.application,
    verification: {
      primarySourcesChecked:
        entry.verification?.primarySourcesChecked ?? false,
      counterEvidenceReviewed:
        entry.verification?.counterEvidenceReviewed ?? false
    },
    visibility: entry.visibility,
    status: entry.status
  };
}

export function dictionaryReviewSubjectHash(entry) {
  return reviewSubjectHash(
    "dictionary-entry",
    dictionaryReviewSubjectPayload(entry)
  );
}

export function dictionaryPublicationGate(entry) {
  const publicProjection =
    entry?.qualityReview?.evidenceMode ===
    PUBLIC_REVIEW_EVIDENCE_MODE;
  const rounds = Array.isArray(
    entry?.qualityReview?.rounds
  )
    ? entry.qualityReview.rounds
    : [];
  const orderedRounds =
    rounds.length === 3 &&
    rounds.every((round, index) => {
      try {
        return (
          Number(round?.round) === index + 1 &&
          Number(round?.score) ===
            calculateNegativeReviewScore(round) &&
          (publicProjection
            ? hasPublicReviewEvidenceReceipts
            : hasVerifiableReviewEvidence)(round, {
              subjectHash:
                dictionaryReviewSubjectHash(entry),
              roundNumber: index + 1
            })
        );
      } catch {
        return false;
      }
    });
  const finalRound = orderedRounds
    ? {
        score: Number(rounds[2].score),
        p0: Number(rounds[2].p0),
        p1: Number(rounds[2].p1),
        p2: Number(rounds[2].p2)
      }
    : null;
  const reasons = [];
  if (entry?.visibility !== "public") {
    reasons.push("visibility-not-public");
  }
  if (entry?.status !== "verified") {
    reasons.push("status-not-verified");
  }
  if (!orderedRounds) {
    reasons.push("invalid-three-round-review");
  } else {
    if (finalRound.score < 9.9) {
      reasons.push("final-score-below-9.9");
    }
    if (finalRound.p0 !== 0) {
      reasons.push("final-p0-not-zero");
    }
    if (finalRound.p1 !== 0) {
      reasons.push("final-p1-not-zero");
    }
  }
  return {
    passed: reasons.length === 0,
    reasons,
    finalRound
  };
}

function boundedString(
  value,
  field,
  { required = false, maxLength = 1_000 } = {}
) {
  const text = String(value ?? "").trim();
  if (required && !text) {
    throw new Error(`${field} is required`);
  }
  if (text.length > maxLength) {
    throw new Error(`${field} must be at most ${maxLength} characters`);
  }
  return text;
}

const canonicalInstantPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export function canonicalInstant(
  value,
  field,
  { required = false } = {}
) {
  if (value === null || value === undefined) {
    if (required) {
      throw new Error(
        `${field} must be a canonical ISO-8601 UTC instant with milliseconds`
      );
    }
    return null;
  }
  if (
    typeof value !== "string" ||
    !canonicalInstantPattern.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    throw new Error(
      `${field} must be a canonical ISO-8601 UTC instant with milliseconds`
    );
  }
  return value;
}

export const canonicalReviewInstant = canonicalInstant;

function validateDictionaryTimestampEnvelope(
  value,
  field,
  { revision = false } = {}
) {
  const createdAt = canonicalInstant(
    value?.createdAt,
    `${field}.createdAt`,
    { required: true }
  );
  const updatedAt = canonicalInstant(
    value?.updatedAt,
    `${field}.updatedAt`,
    { required: true }
  );
  const recordedAt = revision
    ? canonicalInstant(
        value?.recordedAt,
        `${field}.recordedAt`,
        { required: true }
      )
    : null;
  if (
    Date.parse(createdAt) > Date.parse(updatedAt) ||
    (recordedAt !== null &&
      Date.parse(updatedAt) > Date.parse(recordedAt))
  ) {
    throw new Error(
      `${field} timestamps must be monotonic`
    );
  }
  return { createdAt, updatedAt, recordedAt };
}

function uniqueStrings(
  value,
  field,
  {
    required = false,
    maxItems = 50,
    maxItemLength = 500
  } = {}
) {
  if (!Array.isArray(value)) {
    if (required) {
      throw new Error(`${field} must be an array`);
    }
    return [];
  }
  if (value.length > maxItems) {
    throw new Error(`${field} must contain at most ${maxItems} values`);
  }
  const result = [
    ...new Set(
      value
        .map((item, index) =>
          boundedString(item, `${field}[${index}]`, {
            maxLength: maxItemLength
          })
        )
        .filter(Boolean)
    )
  ];
  if (required && !result.length) {
    throw new Error(`${field} must contain at least one value`);
  }
  return result;
}

function nonEmptyString(value, field) {
  return boundedString(value, field, {
    required: true,
    maxLength: 1_500
  });
}

export function validateDictionaryEntry(
  input,
  catalog,
  taxonomy = null,
  {
    allowPublicReviewProjection = false
  } = {}
) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("entry must be an object");
  }
  const kind = nonEmptyString(input.kind, "kind");
  if (!allowedKinds.has(kind)) {
    throw new Error(`Unsupported dictionary kind: ${kind}`);
  }
  const status = input.status ? String(input.status) : "candidate";
  if (!allowedStatuses.has(status)) {
    throw new Error(`Unsupported dictionary status: ${status}`);
  }
  const sourceIds = uniqueStrings(input.sourceIds, "sourceIds", {
    required: true,
    maxItems: 9,
    maxItemLength: 64
  });
  const articleIds = uniqueStrings(input.articleIds, "articleIds", {
    required: true,
    maxItems: 50,
    maxItemLength: 220
  });
  const articles = new Map(
    catalog.articles.map((article) => [article.articleId, article])
  );
  const missingArticles = articleIds.filter((id) => !articles.has(id));
  if (missingArticles.length) {
    throw new Error(
      `Dictionary evidence references unknown articles: ${missingArticles.join(", ")}`
    );
  }
  const actualSources = new Set(
    articleIds.map((id) => articles.get(id).sourceId)
  );
  for (const sourceId of actualSources) {
    if (!sourceIds.includes(sourceId)) {
      throw new Error(
        `sourceIds is missing source ${sourceId} from article evidence`
      );
    }
  }
  const extraSources = sourceIds.filter(
    (sourceId) => !actualSources.has(sourceId)
  );
  if (extraSources.length) {
    throw new Error(
      `sourceIds contains sources with no listed article evidence: ${extraSources.join(", ")}`
    );
  }
  if (kind === "cross-source-synthesis" && actualSources.size < 2) {
    throw new Error(
      "cross-source-synthesis requires evidence from at least two distinct source partitions"
    );
  }
  if (kind === "cross-source-synthesis") {
    const synthesisArticles = articleIds.map((id) =>
      articles.get(id)
    );
    const companies = new Set(
      synthesisArticles.map((article) => article.companyId)
    );
    if (companies.size < 2) {
      throw new Error(
        "cross-source-synthesis requires at least two distinct companies"
      );
    }
    const confirmedIndependentWorks = new Set(
      synthesisArticles
        .filter(
          (article) =>
            workIndependenceStatus(article) ===
            "confirmed-original"
        )
        .map(workFamily)
    );
    const confirmedArticles = synthesisArticles.filter(
      (article) =>
        workIndependenceStatus(article) ===
        "confirmed-original"
    );
    const companiesByWorkFamily = new Map();
    for (const article of confirmedArticles) {
      const family = workFamily(article);
      const familyCompanies =
        companiesByWorkFamily.get(family) ?? new Set();
      familyCompanies.add(article.companyId);
      companiesByWorkFamily.set(
        family,
        familyCompanies
      );
    }
    const independentlyOwnedArticles =
      confirmedArticles.filter(
        (article) =>
          companiesByWorkFamily.get(
            workFamily(article)
          )?.size === 1
      );
    const confirmedCompanies = new Set(
      independentlyOwnedArticles.map(
        (article) => article.companyId
      )
    );
    const confirmedSources = new Set(
      independentlyOwnedArticles.map(
        (article) => article.sourceId
      )
    );
    const independentlyOwnedWorks = new Set(
      independentlyOwnedArticles.map(workFamily)
    );
    if (
      confirmedCompanies.size !== companies.size ||
      confirmedSources.size !== actualSources.size ||
      independentlyOwnedWorks.size < companies.size ||
      confirmedIndependentWorks.size < companies.size
    ) {
      throw new Error(
        "cross-source-synthesis requires confirmed-original independent canonical works from every contributing company and source partition"
      );
    }
  }

  if (!Array.isArray(input.evidence) || !input.evidence.length) {
    throw new Error("evidence must contain at least one claim");
  }
  if (input.evidence.length > 50) {
    throw new Error("evidence must contain at most 50 claims");
  }
  const evidence = input.evidence.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`evidence[${index}] must be an object`);
    }
    const articleId = nonEmptyString(
      item.articleId,
      `evidence[${index}].articleId`
    );
    const sourceId = nonEmptyString(
      item.sourceId,
      `evidence[${index}].sourceId`
    );
    const article = articles.get(articleId);
    if (!article) {
      throw new Error(`evidence[${index}] references unknown article ${articleId}`);
    }
    if (article.sourceId !== sourceId) {
      throw new Error(
        `evidence[${index}] source ${sourceId} does not match article partition ${article.sourceId}`
      );
    }
    if (!articleIds.includes(articleId)) {
      throw new Error(
        `evidence[${index}] article ${articleId} is not declared in articleIds`
      );
    }
    const evidenceLevel = item.evidenceLevel ?? "article-observation";
    if (!allowedEvidenceLevels.has(evidenceLevel)) {
      throw new Error(
        `Unsupported evidence level at evidence[${index}]: ${evidenceLevel}`
      );
    }
    const role = item.role ?? "observed";
    if (!allowedClaimRoles.has(role)) {
      throw new Error(
        `Unsupported claim role at evidence[${index}]: ${role}`
      );
    }
    const independence = item.independence ?? "provider-self";
    if (!allowedIndependence.has(independence)) {
      throw new Error(
        `Unsupported evidence independence at evidence[${index}]: ${independence}`
      );
    }
    const directness = item.directness ?? "direct";
    if (!allowedDirectness.has(directness)) {
      throw new Error(
        `Unsupported evidence directness at evidence[${index}]: ${directness}`
      );
    }
    const studyDesign = item.studyDesign ?? "experience-report";
    if (!allowedStudyDesign.has(studyDesign)) {
      throw new Error(
        `Unsupported evidence studyDesign at evidence[${index}]: ${studyDesign}`
      );
    }
    return {
      sourceId,
      articleId,
      claim: boundedString(item.claim, `evidence[${index}].claim`, {
        required: true,
        maxLength: 1_500
      }),
      locator: boundedString(item.locator, `evidence[${index}].locator`, {
        maxLength: 500
      }),
      evidenceLevel,
      role,
      independence,
      directness,
      studyDesign,
      causalScope: boundedString(
        item.causalScope,
        `evidence[${index}].causalScope`,
        { maxLength: 1_000 }
      )
    };
  });
  const evidenceArticleIds = new Set(
    evidence.map((item) => item.articleId)
  );
  const articlesWithoutClaims = articleIds.filter(
    (articleId) => !evidenceArticleIds.has(articleId)
  );
  if (articlesWithoutClaims.length) {
    throw new Error(
      `Every listed article must contribute an evidence claim: ${articlesWithoutClaims.join(", ")}`
    );
  }
  const evidenceSources = new Set(
    evidence.map((item) => item.sourceId)
  );
  if (
    kind === "cross-source-synthesis" &&
    evidenceSources.size < 2
  ) {
    throw new Error(
      "cross-source-synthesis requires claims from at least two distinct source partitions"
    );
  }

  const domainIds = uniqueStrings(input.domainIds, "domainIds", {
    maxItems: 24,
    maxItemLength: 80
  });
  const problemTypeIds = uniqueStrings(
    input.problemTypeIds,
    "problemTypeIds",
    {
      maxItems: 24,
      maxItemLength: 80
    }
  );
  if (taxonomy) {
    const validDomains = new Set(
      (taxonomy.domains ?? []).map((item) => item.id)
    );
    const validProblems = new Set(
      (taxonomy.problemTypes ?? []).map((item) => item.id)
    );
    const invalidDomains = domainIds.filter(
      (id) => !validDomains.has(id)
    );
    const invalidProblems = problemTypeIds.filter(
      (id) => !validProblems.has(id)
    );
    if (invalidDomains.length || invalidProblems.length) {
      throw new Error(
        `Unknown ontology ids: ${[
          ...invalidDomains,
          ...invalidProblems
        ].join(", ")}`
      );
    }
  }

  const counterEvidence = uniqueStrings(
    input.counterEvidence,
    "counterEvidence",
    {
      maxItems: 20,
      maxItemLength: 1_000
    }
  );
  if (
    Array.isArray(input.contextComparisons) &&
    input.contextComparisons.length > 9
  ) {
    throw new Error(
      "contextComparisons must contain at most 9 source contexts"
    );
  }
  const contextComparisons = Array.isArray(input.contextComparisons)
    ? input.contextComparisons.map((context, index) => ({
        sourceId: nonEmptyString(
          context.sourceId,
          `contextComparisons[${index}].sourceId`
        ),
        scale: boundedString(
          context.scale,
          `contextComparisons[${index}].scale`,
          { maxLength: 500 }
        ),
        workload: boundedString(
          context.workload,
          `contextComparisons[${index}].workload`,
          { maxLength: 500 }
        ),
        stackVersion: boundedString(
          context.stackVersion,
          `contextComparisons[${index}].stackVersion`,
          { maxLength: 500 }
        ),
        slo: boundedString(
          context.slo,
          `contextComparisons[${index}].slo`,
          { maxLength: 500 }
        ),
        teamShape: boundedString(
          context.teamShape,
          `contextComparisons[${index}].teamShape`,
          { maxLength: 500 }
        ),
        regulation: boundedString(
          context.regulation,
          `contextComparisons[${index}].regulation`,
          { maxLength: 500 }
        ),
        comparability:
          context.comparability === "not-comparable"
            ? "not-comparable"
            : context.comparability === "comparable"
              ? "comparable"
              : "conditional",
        note: boundedString(
          context.note,
          `contextComparisons[${index}].note`,
          { maxLength: 1_000 }
        )
      }))
    : [];
  const contextSources = new Set(
    contextComparisons.map((context) => context.sourceId)
  );
  const invalidContextSources = [...contextSources].filter(
    (sourceId) => !actualSources.has(sourceId)
  );
  if (invalidContextSources.length) {
    throw new Error(
      `contextComparisons references sources outside the evidence set: ${invalidContextSources.join(", ")}`
    );
  }
  if (
    kind === "cross-source-synthesis" &&
    ["reviewed", "verified"].includes(status)
  ) {
    const missingContextSources = [...actualSources].filter(
      (sourceId) => !contextSources.has(sourceId)
    );
    if (missingContextSources.length) {
      throw new Error(
        `Reviewed cross-source synthesis requires a context comparison for every source: ${missingContextSources.join(", ")}`
      );
    }
    if (!counterEvidence.length) {
      throw new Error(
        "Reviewed cross-source synthesis requires explicit counterEvidence"
      );
    }
    const weakEvidence = evidence.filter(
      (item) =>
        item.evidenceLevel === "metadata" ||
        item.directness !== "direct" ||
        !item.locator
    );
    if (weakEvidence.length) {
      throw new Error(
        "Reviewed cross-source synthesis requires non-metadata, direct evidence with a locator for every claim"
      );
    }
  }

  if (
    status === "verified" &&
    (!input.verification?.primarySourcesChecked ||
      !input.verification?.counterEvidenceReviewed ||
      evidence.some((item) => item.evidenceLevel === "metadata"))
  ) {
    throw new Error(
      "verified entries require primarySourcesChecked=true, counterEvidenceReviewed=true, and non-metadata evidence for every claim"
    );
  }

  const visibility = input.visibility
    ? String(input.visibility)
    : "local";
  if (!allowedVisibility.has(visibility)) {
    throw new Error(`Unsupported dictionary visibility: ${visibility}`);
  }
  const evidenceMode =
    input.qualityReview?.evidenceMode ?? null;
  if (
    evidenceMode !== null &&
    evidenceMode !== PUBLIC_REVIEW_EVIDENCE_MODE
  ) {
    throw new Error(
      "qualityReview.evidenceMode is unsupported"
    );
  }
  if (
    evidenceMode === PUBLIC_REVIEW_EVIDENCE_MODE &&
    !allowPublicReviewProjection
  ) {
    throw new Error(
      "Content-withheld review receipts are accepted only while validating a bound public projection"
    );
  }
  const qualityReview =
    input.qualityReview &&
    typeof input.qualityReview === "object"
      ? {
          rounds: Array.isArray(input.qualityReview.rounds)
            ? input.qualityReview.rounds.map((round, index) => ({
                round: Number(round.round),
                score: Number(round.score),
                p0:
                  round.p0 === undefined
                    ? Number.NaN
                    : Number(round.p0),
                p1:
                  round.p1 === undefined
                    ? Number.NaN
                    : Number(round.p1),
                p2:
                  round.p2 === undefined
                    ? Number.NaN
                    : Number(round.p2),
                summary: boundedString(
                  round.summary,
                  `qualityReview.rounds[${index}].summary`,
                  {
                    required: true,
                    maxLength: 1_000
                  }
                ),
                evidenceRefs: structuredClone(
                  round.evidenceRefs
                )
              }))
            : [],
          reviewedAt: canonicalReviewInstant(
            input.qualityReview.reviewedAt,
            "qualityReview.reviewedAt"
          ),
          ...(evidenceMode
            ? { evidenceMode }
            : {})
        }
      : {
          rounds: [],
          reviewedAt: null
        };
  if (qualityReview.rounds.length) {
    if (
      qualityReview.rounds.length !== 3 ||
      qualityReview.rounds.some(
        (round, index) =>
          round.round !== index + 1 ||
          !Number.isFinite(round.score) ||
          round.score < 0 ||
          round.score > 10 ||
          ![round.p0, round.p1, round.p2].every(
            (count) =>
              Number.isInteger(count) && count >= 0
          )
      )
    ) {
      throw new Error(
        "qualityReview must contain exactly rounds 1, 2, and 3 with scores from 0 to 10 and non-negative integer finding counts"
      );
    }
    qualityReview.rounds.forEach((round, index) =>
      assertNegativeReviewScore(
        round,
        `qualityReview.rounds[${index}]`
      )
    );
  }
  const validated = {
    entryId: input.entryId
      ? boundedString(input.entryId, "entryId", {
          required: true,
          maxLength: 180
        })
      : null,
    kind,
    title: boundedString(input.title, "title", {
      required: true,
      maxLength: 180
    }),
    question: boundedString(input.question, "question", {
      maxLength: 1_000
    }),
    finding: boundedString(input.finding, "finding", {
      maxLength: 3_000
    }),
    summary: boundedString(input.summary, "summary", {
      required: true,
      maxLength: 3_000
    }),
    sourceIds,
    articleIds,
    domainIds,
    problemTypeIds,
    evidence,
    preconditions: uniqueStrings(input.preconditions, "preconditions", {
      maxItems: 30,
      maxItemLength: 1_000
    }),
    tradeoffs: uniqueStrings(input.tradeoffs, "tradeoffs", {
      maxItems: 30,
      maxItemLength: 1_000
    }),
    counterEvidence,
    contextComparisons,
    application:
      input.application && typeof input.application === "object"
        ? {
            target: boundedString(
              input.application.target,
              "application.target",
              { maxLength: 1_000 }
            ),
            hypothesis: boundedString(
              input.application.hypothesis,
              "application.hypothesis",
              { maxLength: 1_500 }
            ),
            experiment: boundedString(
              input.application.experiment,
              "application.experiment",
              { maxLength: 2_000 }
            ),
            metrics: uniqueStrings(
              input.application.metrics,
              "application.metrics",
              {
                maxItems: 20,
                maxItemLength: 500
              }
            ),
            rollback: boundedString(
              input.application.rollback,
              "application.rollback",
              { maxLength: 1_500 }
            ),
            failureBoundary: boundedString(
              input.application.failureBoundary,
              "application.failureBoundary",
              { maxLength: 1_500 }
            ),
            changedAssumption: boundedString(
              input.application.changedAssumption,
              "application.changedAssumption",
              { maxLength: 1_500 }
            ),
            nextExperiment: boundedString(
              input.application.nextExperiment,
              "application.nextExperiment",
              { maxLength: 2_000 }
            ),
            reuseConditions: uniqueStrings(
              input.application.reuseConditions,
              "application.reuseConditions",
              {
                maxItems: 20,
                maxItemLength: 1_000
              }
            ),
            exceptions: uniqueStrings(
              input.application.exceptions,
              "application.exceptions",
              {
                maxItems: 20,
                maxItemLength: 1_000
              }
            )
          }
        : null,
    verification:
      input.verification && typeof input.verification === "object"
        ? {
            primarySourcesChecked: Boolean(
              input.verification.primarySourcesChecked
            ),
            counterEvidenceReviewed: Boolean(
              input.verification.counterEvidenceReviewed
            ),
            reviewedAt: canonicalReviewInstant(
              input.verification.reviewedAt,
              "verification.reviewedAt"
            )
          }
        : {
            primarySourcesChecked: false,
            counterEvidenceReviewed: false,
            reviewedAt: null
          },
    qualityReview,
    visibility,
    status
  };
  if (qualityReview.rounds.length) {
    if (
      evidenceMode === PUBLIC_REVIEW_EVIDENCE_MODE
    ) {
      const subjectHash =
        dictionaryReviewSubjectHash(validated);
      validated.qualityReview.rounds =
        qualityReview.rounds.map((round, index) => ({
          ...round,
          evidenceRefs:
            normalizePublicReviewEvidenceRefs(
              round.evidenceRefs,
              `qualityReview.rounds[${index}].evidenceRefs`,
              {
                subjectHash,
                round: index + 1
              }
            )
        }));
    } else {
      const normalizedReview =
        normalizeReviewRoundsEvidence(
          qualityReview.rounds,
          {
            subjectType: "dictionary-entry",
            payload:
              dictionaryReviewSubjectPayload(validated),
            field: "qualityReview.rounds"
          }
        );
      validated.qualityReview.rounds =
        normalizedReview.rounds;
    }
  }
  if (visibility === "public") {
    const gate = dictionaryPublicationGate(validated);
    if (!gate.passed) {
      throw new Error(
        `Public Dictionary entries require verified status and a three-round quality gate ending at >=9.9 with P0=0 and P1=0 (${gate.reasons.join(", ")})`
      );
    }
  }
  return validated;
}

function entryIdentity(entry) {
  return sha256(
    stableJson({
      kind: entry.kind,
      title: normalizeSearchText(entry.title),
      sourceIds: [...entry.sourceIds].sort(),
      articleIds: [...entry.articleIds].sort()
    })
  ).slice(0, 14);
}

function generatedEntryId(entry) {
  return `dict-${slugify(entry.title).slice(0, 100)}-${entryIdentity(entry)}`;
}

function canonicalClaimHash(entry) {
  return sha256(
    stableJson({
      kind: entry.kind,
      question: normalizeSearchText(entry.question),
      finding: normalizeSearchText(entry.finding),
      summary: normalizeSearchText(entry.summary),
      domainIds: [...(entry.domainIds ?? [])].sort(),
      problemTypeIds: [...(entry.problemTypeIds ?? [])].sort(),
      sourceIds: [...(entry.sourceIds ?? [])].sort(),
      articleIds: [...(entry.articleIds ?? [])].sort()
    })
  );
}

export function dictionaryCanonicalClaimHash(entry) {
  return canonicalClaimHash(entry);
}

export function dictionaryPayloadHash(entry) {
  const payload = structuredClone(entry);
  delete payload.entryId;
  return sha256(stableJson(payload));
}

function tokenSimilarity(left, right) {
  const leftTokens = new Set(
    tokenize(
      `${left.title} ${left.question} ${left.finding} ${left.summary}`
    )
  );
  const rightTokens = new Set(
    tokenize(
      `${right.title} ${right.question} ${right.finding} ${right.summary}`
    )
  );
  const union = new Set([...leftTokens, ...rightTokens]);
  if (!union.size) {
    return 0;
  }
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }
  return intersection / union.size;
}

export function assessDictionaryCandidate(validated, dictionary) {
  const entryId = validated.entryId ?? generatedEntryId(validated);
  const requestHash = dictionaryPayloadHash(validated);
  const claimHash = canonicalClaimHash(validated);
  const exact = (dictionary.entries ?? []).find(
    (entry) =>
      entry.payloadHash === requestHash ||
      entry.canonicalClaimHash === claimHash
  );
  const nearCandidates = (dictionary.entries ?? [])
    .map((entry) => ({
      entryId: entry.entryId,
      status: entry.status,
      similarity: Number(
        tokenSimilarity(validated, entry).toFixed(4)
      )
    }))
    .filter((candidate) => candidate.similarity >= 0.65)
    .sort(
      (left, right) =>
        right.similarity - left.similarity ||
        left.entryId.localeCompare(right.entryId)
    )
    .slice(0, 10);
  const existingIdentity = (dictionary.entries ?? []).find(
    (entry) => entry.entryId === entryId
  );
  return {
    entryId,
    requestHash,
    canonicalClaimHash: claimHash,
    decision: exact
      ? "exact-duplicate"
      : existingIdentity
        ? "update-existing"
        : "create",
    exactEntryId: exact?.entryId ?? null,
    nearCandidates,
    semanticSimilarityPolicy:
      "Review-only lexical receipt; never treated as truth, authority, or verified novelty."
  };
}

function normalizeDictionary(dictionary) {
  const normalized = {
    schemaVersion: 2,
    revision: Number(dictionary.revision) || 0,
    updatedAt: dictionary.updatedAt ?? null,
    entries: Array.isArray(dictionary.entries)
      ? structuredClone(dictionary.entries)
      : [],
    revisions: Array.isArray(dictionary.revisions)
      ? structuredClone(dictionary.revisions)
      : [],
    idempotency:
      dictionary.idempotency &&
      typeof dictionary.idempotency === "object"
        ? structuredClone(dictionary.idempotency)
        : {}
  };
  const knownRevisionIds = new Set(
    normalized.revisions.map((revision) => revision.revisionId)
  );
  for (const entry of normalized.entries) {
    if (!entry.entryRevision) {
      entry.entryRevision = 1;
    }
    if (!entry.revisionId) {
      entry.revisionId = `legacy:${sha256(
        stableJson({
          entryId: entry.entryId,
          provenanceHash: entry.provenanceHash ?? null,
          updatedAt: entry.updatedAt ?? null
        })
      ).slice(0, 24)}`;
    }
    entry.payloadHash ??= sha256(
      stableJson({
        ...entry,
        revisionId: undefined,
        entryRevision: undefined
      })
    );
    entry.canonicalClaimHash ??= canonicalClaimHash(entry);
    if (!knownRevisionIds.has(entry.revisionId)) {
      normalized.revisions.push({
        ...structuredClone(entry),
        revisionId: entry.revisionId,
        entryRevision: entry.entryRevision,
        supersedesRevisionId: null,
        recordedAt: entry.updatedAt ?? entry.createdAt ?? null,
        migration: "schema-v1-current-entry"
      });
      knownRevisionIds.add(entry.revisionId);
    }
  }
  return normalized;
}

function evidenceSnapshotFor(entry, catalog, taxonomy) {
  const articles = new Map(
    catalog.articles.map((article) => [article.articleId, article])
  );
  return {
    snapshotId: catalog.snapshotId ?? null,
    taxonomyHash: computeTaxonomyHash(taxonomy ?? {}),
    articles: entry.articleIds.map((articleId) => {
      const article = articles.get(articleId);
      return {
        articleId,
        sourceId: article.sourceId,
        contentHash: article.contentHash ?? null,
        revisionHash: article.revisionHash ?? article.contentHash ?? null,
        ontologyHash: article.ontologyHash ?? null
      };
    })
  };
}

function dictionaryRevisionProjection(revision) {
  const projected = structuredClone(revision);
  delete projected.recordedAt;
  delete projected.idempotencyKey;
  delete projected.noveltyAssessment;
  delete projected.migration;
  return projected;
}

function revisionProvenanceHash(
  validated,
  evidenceSnapshot
) {
  return sha256(
    stableJson({
      evidenceSnapshot,
      sourceIds: [...validated.sourceIds].sort(),
      articleIds: [...validated.articleIds].sort(),
      evidence: validated.evidence,
      contextComparisons:
        validated.contextComparisons,
      counterEvidence: validated.counterEvidence,
      application: validated.application,
      status: validated.status,
      visibility: validated.visibility
    })
  );
}

function legacyV1PayloadHash(validated) {
  return sha256(stableJson(validated));
}

function legacyV1ProvenanceHash(
  validated,
  evidenceSnapshot
) {
  return sha256(
    stableJson({
      evidenceSnapshot,
      evidence: validated.evidence,
      contextComparisons:
        validated.contextComparisons,
      counterEvidence: validated.counterEvidence,
      application: validated.application,
      status: validated.status,
      visibility: validated.visibility
    })
  );
}

function usesLegacyDictionaryHash(revision) {
  return [
    "schema-v1-to-v2",
    "schema-v1-current-entry"
  ].includes(revision?.migration);
}

export function isLegacyDictionaryRevision(revision) {
  return (
    usesLegacyDictionaryHash(revision) ||
    revision?.migration === "schema-v1-to-v2-v2"
  );
}

function revisionIdFor(
  entryId,
  entryRevision,
  payloadHash,
  provenanceHash,
  { legacy = false } = {}
) {
  return `dictrev:${sha256(
    stableJson({
      entryId,
      entryRevision,
      [legacy ? "payloadHash" : "requestHash"]:
        payloadHash,
      provenanceHash
    })
  ).slice(0, 24)}`;
}

function validateEvidenceSnapshot(
  snapshot,
  validated,
  entryId
) {
  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    Array.isArray(snapshot) ||
    !Array.isArray(snapshot.articles) ||
    snapshot.articles.length !==
      validated.articleIds.length
  ) {
    throw new Error(
      `Dictionary entry ${entryId} has an invalid evidence snapshot`
    );
  }
  const expectedIds = [...validated.articleIds].sort();
  const actualIds = snapshot.articles
    .map((article) => article.articleId)
    .sort();
  if (
    stableJson(expectedIds) !== stableJson(actualIds) ||
    new Set(actualIds).size !== actualIds.length
  ) {
    throw new Error(
      `Dictionary entry ${entryId} evidence snapshot does not exactly cover its articles`
    );
  }
}

export function validateDictionaryRevisionChain(
  entry,
  dictionary,
  catalog,
  taxonomy
) {
  const dictionaryUpdatedAt = canonicalInstant(
    dictionary?.updatedAt,
    "Dictionary.updatedAt",
    { required: Number(dictionary?.revision) > 0 }
  );
  const current = dictionary.entries.find(
    (candidate) => candidate.entryId === entry.entryId
  );
  const revisions = (dictionary.revisions ?? [])
    .filter(
      (revision) => revision.entryId === entry.entryId
    )
    .sort(
      (left, right) =>
        left.entryRevision - right.entryRevision
    );
  if (
    !current ||
    !revisions.length ||
    stableJson(current) !== stableJson(entry)
  ) {
    throw new Error(
      `Dictionary entry ${entry.entryId} is not the exact current entry`
    );
  }
  const currentTimestamps =
    validateDictionaryTimestampEnvelope(
      current,
      `Dictionary entry ${entry.entryId}`
    );
  const seenRevisionIds = new Set();
  let previous = null;
  for (const revision of revisions) {
    validateDictionaryTimestampEnvelope(
      revision,
      `Dictionary entry ${entry.entryId} revision ${revision.entryRevision ?? "(missing)"}`,
      { revision: true }
    );
    const expectedNumber =
      (previous?.entryRevision ?? 0) + 1;
    if (
      revision.entryRevision !== expectedNumber ||
      seenRevisionIds.has(revision.revisionId) ||
      revision.supersedesRevisionId !==
        (previous?.revisionId ?? null)
    ) {
      throw new Error(
        `Dictionary entry ${entry.entryId} has a broken immutable revision chain`
      );
    }
    seenRevisionIds.add(revision.revisionId);
    const validated = validateDictionaryEntry(
      revision,
      catalog,
      taxonomy
    );
    validateEvidenceSnapshot(
      revision.evidenceSnapshot,
      validated,
      entry.entryId
    );
    const legacyMigration =
      usesLegacyDictionaryHash(revision);
    const payloadHash = legacyMigration
      ? legacyV1PayloadHash(validated)
      : dictionaryPayloadHash(validated);
    const provenanceHash = legacyMigration
      ? legacyV1ProvenanceHash(
          validated,
          revision.evidenceSnapshot
        )
      : revisionProvenanceHash(
          validated,
          revision.evidenceSnapshot
        );
    const revisionId = revisionIdFor(
      entry.entryId,
      revision.entryRevision,
      payloadHash,
      provenanceHash,
      { legacy: legacyMigration }
    );
    const expectedProjection = {
      ...validated,
      entryId: entry.entryId,
      entryRevision: revision.entryRevision,
      revisionId,
      supersedesRevisionId:
        previous?.revisionId ?? null,
      provenanceHash,
      payloadHash,
      canonicalClaimHash:
        canonicalClaimHash(validated),
      evidenceSnapshot:
        structuredClone(revision.evidenceSnapshot),
      publisherContentTrust:
        publisherContentTrust(),
      createdAt: revision.createdAt ?? null,
      updatedAt: revision.updatedAt ?? null
    };
    if (
      (previous?.payloadHash === revision.payloadHash &&
        !isLegacyDictionaryRevision(previous)) ||
      stableJson(
        dictionaryRevisionProjection(revision)
      ) !== stableJson(expectedProjection)
    ) {
      throw new Error(
        `Dictionary entry ${entry.entryId} immutable revision ${revision.entryRevision} hashes or payload are invalid`
      );
    }
    previous = revision;
  }
  const terminal = revisions.at(-1);
  if (
    terminal.revisionId !== entry.revisionId ||
    terminal.entryRevision !== entry.entryRevision ||
    stableJson(
      dictionaryRevisionProjection(terminal)
    ) !== stableJson(entry)
  ) {
    throw new Error(
      `Dictionary entry ${entry.entryId} is not the exact current terminal immutable revision`
    );
  }
  if (
    dictionaryUpdatedAt !== null &&
    Date.parse(dictionaryUpdatedAt) <
      Date.parse(currentTimestamps.updatedAt)
  ) {
    throw new Error(
      `Dictionary.updatedAt precedes entry ${entry.entryId}`
    );
  }
  return {
    entryId: entry.entryId,
    entryRevision: entry.entryRevision,
    revisionId: entry.revisionId,
    provenanceHash: entry.provenanceHash,
    payloadHash: entry.payloadHash,
    evidenceSnapshotId:
      entry.evidenceSnapshot?.snapshotId ?? null,
    statusAtAcceptance: entry.status
  };
}

export function assertCurrentDictionaryRevision(
  entry,
  dictionary,
  catalog,
  taxonomy
) {
  return validateDictionaryRevisionChain(
    entry,
    dictionary,
    catalog,
    taxonomy
  );
}

function migrationReceiptInputHash(revision) {
  return sha256(
    stableJson({
      entryId: revision.entryId,
      revisionId: revision.revisionId,
      payloadHash: revision.payloadHash
    })
  );
}

export function validateDictionaryCommitLedger(dictionary) {
  const globalRevision = Number(dictionary?.revision);
  const idempotency =
    dictionary?.idempotency &&
    typeof dictionary.idempotency === "object" &&
    !Array.isArray(dictionary.idempotency)
      ? dictionary.idempotency
      : {};
  if (
    !Number.isSafeInteger(globalRevision) ||
    globalRevision < 0
  ) {
    throw new Error(
      "Dictionary global revision must be a non-negative integer"
    );
  }
  const dictionaryUpdatedAt = canonicalInstant(
    dictionary?.updatedAt,
    "Dictionary.updatedAt",
    { required: globalRevision > 0 }
  );
  for (const entry of dictionary?.entries ?? []) {
    const timestamps =
      validateDictionaryTimestampEnvelope(
        entry,
        `Dictionary entry ${entry?.entryId ?? "(missing id)"}`
      );
    if (
      dictionaryUpdatedAt !== null &&
      Date.parse(dictionaryUpdatedAt) <
        Date.parse(timestamps.updatedAt)
    ) {
      throw new Error(
        `Dictionary.updatedAt precedes entry ${entry?.entryId ?? "(missing id)"}`
      );
    }
  }
  const revisions = dictionary?.revisions ?? [];
  for (const revision of revisions) {
    const timestamps =
      validateDictionaryTimestampEnvelope(
        revision,
        `Dictionary revision ${revision?.revisionId ?? "(missing id)"}`,
        { revision: true }
      );
    if (
      dictionaryUpdatedAt !== null &&
      Date.parse(dictionaryUpdatedAt) <
        Date.parse(timestamps.recordedAt)
    ) {
      throw new Error(
        `Dictionary.updatedAt precedes revision ${revision?.revisionId ?? "(missing id)"}`
      );
    }
  }
  const receipts = Object.entries(idempotency);
  if (receipts.length !== globalRevision) {
    throw new Error(
      "Dictionary global commit ledger does not contain one receipt per revision"
    );
  }
  const positions = new Set();
  const owningPosition = new Map();
  for (const [key, receipt] of receipts) {
    const allowed = new Set([
      "inputHash",
      "requestHash",
      "entryId",
      "revisionId",
      "committedRevision",
      "action"
    ]);
    const unknown = Object.keys(receipt ?? {}).filter(
      (field) => !allowed.has(field)
    );
    const position = Number(receipt?.committedRevision);
    const target = revisions.find(
      (candidate) =>
        candidate.entryId === receipt?.entryId &&
        candidate.revisionId === receipt?.revisionId
    );
    if (
      unknown.length ||
      !target ||
      !/^[a-f0-9]{64}$/u.test(
        String(receipt?.inputHash ?? "")
      ) ||
      receipt.requestHash !== target.payloadHash ||
      !Number.isSafeInteger(position) ||
      position < 1 ||
      position > globalRevision ||
      positions.has(position)
    ) {
      throw new Error(
        `Dictionary commit receipt ${key} is invalid`
      );
    }
    positions.add(position);
    if (receipt.action === undefined) {
      if (
        isLegacyDictionaryRevision(target) ||
        target.idempotencyKey !== key ||
        owningPosition.has(target.revisionId)
      ) {
        throw new Error(
          `Dictionary commit receipt ${key} does not own exactly one canonical revision`
        );
      }
      owningPosition.set(target.revisionId, position);
    } else if (receipt.action === "legacy-migration") {
      if (
        !isLegacyDictionaryRevision(target) ||
        receipt.inputHash !==
          migrationReceiptInputHash(target) ||
        owningPosition.has(target.revisionId)
      ) {
        throw new Error(
          `Dictionary legacy migration receipt ${key} is invalid`
        );
      }
      owningPosition.set(target.revisionId, position);
    } else if (receipt.action === "exact-duplicate") {
      if (isLegacyDictionaryRevision(target)) {
        throw new Error(
          `Dictionary duplicate receipt ${key} cannot target a legacy revision`
        );
      }
    } else {
      throw new Error(
        `Dictionary commit receipt ${key} has an unsupported action`
      );
    }
  }
  for (let position = 1; position <= globalRevision; position += 1) {
    if (!positions.has(position)) {
      throw new Error(
        `Dictionary global commit ledger is missing revision ${position}`
      );
    }
  }
  for (const [key, receipt] of receipts) {
    if (receipt.action !== "exact-duplicate") {
      continue;
    }
    const originalPosition =
      owningPosition.get(receipt.revisionId);
    if (
      !originalPosition ||
      originalPosition >= receipt.committedRevision
    ) {
      throw new Error(
        `Dictionary duplicate receipt ${key} precedes its canonical commit`
      );
    }
  }
  for (const revision of revisions) {
    if (!owningPosition.has(revision.revisionId)) {
      throw new Error(
        `Dictionary revision ${revision.revisionId} lacks a unique global commit position`
      );
    }
  }
  const byEntry = new Map();
  for (const revision of revisions) {
    byEntry.set(
      revision.entryId,
      [...(byEntry.get(revision.entryId) ?? []), revision]
    );
  }
  for (const [entryId, history] of byEntry) {
    history.sort(
      (left, right) =>
        left.entryRevision - right.entryRevision
    );
    let previousPosition = 0;
    for (const revision of history) {
      const position = owningPosition.get(revision.revisionId);
      if (position <= previousPosition) {
        throw new Error(
          `Dictionary entry ${entryId} global commit positions are not monotonic`
        );
      }
      previousPosition = position;
    }
  }
  return {
    revision: globalRevision,
    receiptCount: receipts.length,
    owningPosition
  };
}

function backfillLegacyMigrationReceipts(dictionary) {
  const receipts = dictionary.idempotency;
  const occupied = new Set(
    Object.values(receipts).map((receipt) =>
      Number(receipt.committedRevision)
    )
  );
  let globalRevision = Number(dictionary.revision) || 0;
  const missing = (dictionary.revisions ?? [])
    .filter(
      (revision) =>
        isLegacyDictionaryRevision(revision) &&
        !Object.values(receipts).some(
          (receipt) =>
            receipt.action === "legacy-migration" &&
            receipt.entryId === revision.entryId &&
            receipt.revisionId === revision.revisionId
        )
    )
    .sort(
      (left, right) =>
        String(left.recordedAt ?? "").localeCompare(
          String(right.recordedAt ?? "")
        ) ||
        left.entryId.localeCompare(right.entryId) ||
        left.entryRevision - right.entryRevision
    );
  for (const revision of missing) {
    let position = 1;
    while (occupied.has(position)) {
      position += 1;
    }
    if (position > globalRevision) {
      globalRevision = position;
    }
    const key =
      `migration:${revision.revisionId}`;
    if (Object.hasOwn(receipts, key)) {
      throw new Error(
        `Dictionary migration receipt key collision: ${key}`
      );
    }
    receipts[key] = {
      inputHash: migrationReceiptInputHash(revision),
      requestHash: revision.payloadHash,
      entryId: revision.entryId,
      revisionId: revision.revisionId,
      committedRevision: position,
      action: "legacy-migration"
    };
    occupied.add(position);
  }
  dictionary.revision = globalRevision;
  return globalRevision;
}

export function assertDictionaryRevisionCommit(
  pin,
  dictionary,
  {
    observedRevision = Number(dictionary?.revision)
  } = {}
) {
  const commitLedger =
    validateDictionaryCommitLedger(dictionary);
  const revision = (dictionary?.revisions ?? []).find(
    (candidate) =>
      candidate.entryId === pin?.entryId &&
      candidate.revisionId === pin?.revisionId
  );
  if (!revision) {
    throw new Error(
      `Dictionary revision ${pin?.revisionId ?? "(missing)"} does not resolve`
    );
  }
  if (isLegacyDictionaryRevision(revision)) {
    throw new Error(
      `Dictionary revision ${revision.revisionId} uses a historical migration hash and must be recommitted before acceptance or publication`
    );
  }
  const key = revision.idempotencyKey;
  const receipt =
    key && dictionary?.idempotency?.[key];
  const committedRevision =
    Number(receipt?.committedRevision);
  if (
    !key ||
    !receipt ||
    Object.hasOwn(receipt, "action") ||
    !/^[a-f0-9]{64}$/u.test(
      String(receipt.inputHash ?? "")
    ) ||
    receipt.requestHash !== revision.payloadHash ||
    receipt.entryId !== revision.entryId ||
    receipt.revisionId !== revision.revisionId ||
    !Number.isSafeInteger(committedRevision) ||
    committedRevision < 1 ||
    committedRevision > commitLedger.revision
  ) {
    throw new Error(
      `Dictionary revision ${revision.revisionId} lacks its canonical global-ledger commit receipt`
    );
  }
  if (
    !Number.isSafeInteger(Number(observedRevision)) ||
    Number(observedRevision) < committedRevision ||
    Number(observedRevision) > commitLedger.revision
  ) {
    throw new Error(
      `Dictionary revision ${revision.revisionId} was not committed by observed Dictionary revision ${observedRevision}`
    );
  }
  return committedRevision;
}

export function upgradeDictionaryDocument(
  dictionary,
  catalog,
  taxonomy
) {
  if (
    dictionary.schemaVersion >= 2 &&
    Array.isArray(dictionary.revisions) &&
    dictionary.entries.every(
      (entry) =>
        entry.revisionId &&
        entry.evidenceSnapshot
    )
  ) {
    return structuredClone(dictionary);
  }
  const entries = (dictionary.entries ?? []).map(
    (legacyEntry) => {
      const validated = validateDictionaryEntry(
        legacyEntry,
        catalog,
        taxonomy
      );
      const entryId =
        validated.entryId ?? generatedEntryId(validated);
      const evidenceSnapshot = evidenceSnapshotFor(
        validated,
        catalog,
        taxonomy
      );
      const payloadHash = dictionaryPayloadHash(validated);
      const provenanceHash = revisionProvenanceHash(
        validated,
        evidenceSnapshot
      );
      const revisionId = `dictrev:${sha256(
        stableJson({
          entryId,
          entryRevision: 1,
          requestHash: payloadHash,
          provenanceHash
        })
      ).slice(0, 24)}`;
      return {
        ...validated,
        entryId,
        entryRevision: 1,
        revisionId,
        supersedesRevisionId: null,
        provenanceHash,
        payloadHash,
        canonicalClaimHash:
          canonicalClaimHash(validated),
        evidenceSnapshot,
        publisherContentTrust: publisherContentTrust(),
        createdAt:
          legacyEntry.createdAt ??
          dictionary.updatedAt ??
          null,
        updatedAt:
          legacyEntry.updatedAt ??
          dictionary.updatedAt ??
          null
      };
    }
  );
  return {
    schemaVersion: 2,
    revision:
      Number(dictionary.revision) ||
      (entries.length ? 1 : 0),
    updatedAt: dictionary.updatedAt ?? null,
    entries,
    revisions: entries.map((entry) => ({
      ...structuredClone(entry),
      recordedAt: entry.updatedAt,
      migration: "schema-v1-to-v2"
    })),
    idempotency: {}
  };
}

function assertMonotonicStatus(previous, next, allowVerified) {
  if (!previous) {
    return;
  }
  if (previous.status === "superseded") {
    throw new Error(
      "A superseded Dictionary entry is terminal; create a new entry that references its history"
    );
  }
  if (
    previous.status === "verified" &&
    !allowVerified
  ) {
    throw new Error(
      "Updating a verified entry requires K_TECH_RADAR_ALLOW_VERIFIED_WRITES=1"
    );
  }
  if (
    next !== "superseded" &&
    statusRank.get(next) < statusRank.get(previous.status)
  ) {
    throw new Error(
      `Dictionary status cannot move backward from ${previous.status} to ${next}`
    );
  }
}

export async function recordDictionaryEntry(
  input,
  catalog,
  taxonomy = null,
  {
    expectedRevision,
    idempotencyKey,
    allowVerified = false,
    allowPublication = false,
    recommitLegacy = false
  } = {}
) {
  const normalizedKey = boundedString(
    idempotencyKey,
    "idempotencyKey",
    {
      required: true,
      maxLength: 180
    }
  );
  const inputHash = sha256(stableJson(input));
  return withMutationLease("dictionary", async () => {
    const now = new Date().toISOString();
    const loaded = await loadDictionary();
    const dictionary = normalizeDictionary(loaded);
    const revision = Number(dictionary.revision) || 0;
    const priorIdempotency =
      dictionary.idempotency[normalizedKey];
    if (priorIdempotency) {
      if (
        priorIdempotency.inputHash !== inputHash
      ) {
        throw new Error(
          `Idempotency key ${normalizedKey} was already used for a different Dictionary payload`
        );
      }
      const replayEntry =
        dictionary.revisions.find(
          (entry) =>
            entry.entryId === priorIdempotency.entryId &&
            entry.revisionId === priorIdempotency.revisionId
        );
      const currentEntry = dictionary.entries.find(
        (entry) =>
          entry.entryId === priorIdempotency.entryId
      );
      if (
        !replayEntry ||
        !currentEntry ||
        priorIdempotency.requestHash !==
          replayEntry.payloadHash ||
        !Number.isSafeInteger(
          Number(priorIdempotency.committedRevision)
        ) ||
        Number(priorIdempotency.committedRevision) < 1 ||
        Number(priorIdempotency.committedRevision) >
          revision
      ) {
        throw new Error(
          `Idempotency receipt ${normalizedKey} does not resolve to its exact immutable Dictionary revision`
        );
      }
      validateDictionaryRevisionChain(
        currentEntry,
        dictionary,
        catalog,
        taxonomy
      );
      const replayPin = {
        entryId: replayEntry.entryId,
        revisionId: replayEntry.revisionId
      };
      if (
        priorIdempotency.action ===
        "exact-duplicate"
      ) {
        assertDictionaryRevisionCommit(
          replayPin,
          dictionary,
          {
            observedRevision:
              priorIdempotency.committedRevision
          }
        );
      } else {
        if (
          replayEntry.idempotencyKey !==
          normalizedKey
        ) {
          throw new Error(
            `Idempotency receipt ${normalizedKey} does not own its immutable Dictionary revision`
          );
        }
        assertDictionaryRevisionCommit(
          replayPin,
          dictionary,
          {
            observedRevision:
              priorIdempotency.committedRevision
          }
        );
      }
      return {
        action: "noop",
        reason: "idempotent-replay",
        revision,
        entryRevision: replayEntry?.entryRevision ?? null,
        entry: replayEntry
      };
    }
    const validated = validateDictionaryEntry(
      input,
      catalog,
      taxonomy
    );
    if (validated.status === "verified" && !allowVerified) {
      throw new Error(
        "verified writes require K_TECH_RADAR_ALLOW_VERIFIED_WRITES=1 in a trusted local admin process"
      );
    }
    if (validated.visibility === "public" && !allowPublication) {
      throw new Error(
        "public visibility requires K_TECH_RADAR_ALLOW_PUBLICATION=1 in a trusted local admin process"
      );
    }
    const assessment = assessDictionaryCandidate(
      validated,
      dictionary
    );
    if (
      expectedRevision !== undefined &&
      Number(expectedRevision) !== revision
    ) {
      throw new Error(
        `Dictionary revision conflict: expected ${expectedRevision}, current ${revision}`
      );
    }
    if (assessment.decision === "exact-duplicate") {
      const duplicate = dictionary.entries.find(
        (entry) => entry.entryId === assessment.exactEntryId
      );
      if (!duplicate) {
        throw new Error(
          "Exact-duplicate assessment lost its current Dictionary entry"
        );
      }
      const duplicateRevision = dictionary.revisions.find(
        (candidate) =>
          candidate.entryId === duplicate.entryId &&
          candidate.revisionId === duplicate.revisionId
      );
      if (isLegacyDictionaryRevision(duplicateRevision)) {
        if (recommitLegacy !== true) {
          throw new Error(
            `Dictionary entry ${duplicate.entryId} uses a historical migration hash; retry with recommitLegacy=true and expectedRevision=${revision}`
          );
        }
        if (
          expectedRevision === undefined ||
          Number(expectedRevision) !== revision
        ) {
          throw new Error(
            `Legacy Dictionary recommit requires expectedRevision=${revision}`
          );
        }
        const canonicalDuplicate =
          validateDictionaryEntry(
            duplicate,
            catalog,
            taxonomy
          );
        if (
          dictionaryPayloadHash(canonicalDuplicate) !==
          assessment.requestHash
        ) {
          throw new Error(
            "Legacy Dictionary recommit requires byte-equivalent canonical content; submit a normal reviewed update for semantic changes"
          );
        }
        if (
          dictionary.revisions.length >=
          MAX_DICTIONARY_REVISIONS
        ) {
          throw new Error(
            `Dictionary revision limit reached (${MAX_DICTIONARY_REVISIONS}); archive a hash-rooted segment before continuing`
          );
        }
        if (
          Object.keys(dictionary.idempotency).length >=
          MAX_IDEMPOTENCY_KEYS
        ) {
          throw new Error(
            `Dictionary idempotency-key limit reached (${MAX_IDEMPOTENCY_KEYS})`
          );
        }
        const commitBaseRevision =
          backfillLegacyMigrationReceipts(dictionary);
        if (
          Object.keys(dictionary.idempotency).length >=
          MAX_IDEMPOTENCY_KEYS
        ) {
          throw new Error(
            `Dictionary idempotency-key limit reached (${MAX_IDEMPOTENCY_KEYS})`
          );
        }
        const evidenceSnapshot = structuredClone(
          duplicateRevision.evidenceSnapshot
        );
        const provenanceHash = revisionProvenanceHash(
          validated,
          evidenceSnapshot
        );
        const entryRevision =
          duplicateRevision.entryRevision + 1;
        const revisionId = revisionIdFor(
          duplicate.entryId,
          entryRevision,
          assessment.requestHash,
          provenanceHash
        );
        const recorded = {
          ...validated,
          entryId: duplicate.entryId,
          entryRevision,
          revisionId,
          supersedesRevisionId:
            duplicateRevision.revisionId,
          provenanceHash,
          payloadHash: assessment.requestHash,
          canonicalClaimHash:
            assessment.canonicalClaimHash,
          evidenceSnapshot,
          publisherContentTrust:
            publisherContentTrust(),
          createdAt: duplicate.createdAt ?? null,
          updatedAt: now
        };
        const duplicateIndex =
          dictionary.entries.findIndex(
            (entry) =>
              entry.entryId === duplicate.entryId
          );
        dictionary.entries[duplicateIndex] = recorded;
        dictionary.revisions.push({
          ...structuredClone(recorded),
          recordedAt: now,
          idempotencyKey: normalizedKey,
          noveltyAssessment: assessment,
          migration: "historical-hash-recommit"
        });
        dictionary.idempotency[normalizedKey] = {
          inputHash,
          requestHash: assessment.requestHash,
          entryId: recorded.entryId,
          revisionId,
          committedRevision: commitBaseRevision + 1
        };
        dictionary.updatedAt = now;
        dictionary.revision = commitBaseRevision + 1;
        dictionary.entries.sort((left, right) =>
          right.updatedAt.localeCompare(left.updatedAt)
        );
        validateDictionaryRevisionChain(
          recorded,
          dictionary,
          catalog,
          taxonomy
        );
        validateDictionaryCommitLedger(dictionary);
        const serialized =
          `${JSON.stringify(dictionary, null, 2)}\n`;
        if (
          Buffer.byteLength(serialized, "utf8") >
          MAX_DICTIONARY_BYTES
        ) {
          throw new Error(
            `Dictionary would exceed ${MAX_DICTIONARY_BYTES} byte storage limit`
          );
        }
        await writeJson(dictionaryPath, dictionary);
        return {
          action: "updated",
          reason: "legacy-recommit",
          revision: dictionary.revision,
          entryRevision,
          revisionId,
          entry: recorded,
          noveltyAssessment: assessment
        };
      }
      const duplicatePin =
        validateDictionaryRevisionChain(
          duplicate,
          dictionary,
          catalog,
          taxonomy
        );
      assertDictionaryRevisionCommit(
        duplicatePin,
        dictionary,
        { observedRevision: revision }
      );
      if (
        Object.keys(dictionary.idempotency).length >=
        MAX_IDEMPOTENCY_KEYS
      ) {
        throw new Error(
          `Dictionary idempotency-key limit reached (${MAX_IDEMPOTENCY_KEYS})`
        );
      }
      dictionary.idempotency[normalizedKey] = {
        inputHash,
        requestHash: assessment.requestHash,
        entryId: duplicate.entryId,
        revisionId: duplicate.revisionId,
        committedRevision: revision + 1,
        action: "exact-duplicate"
      };
      dictionary.updatedAt = now;
      dictionary.revision = revision + 1;
      validateDictionaryCommitLedger(dictionary);
      const serialized = `${JSON.stringify(dictionary, null, 2)}\n`;
      if (
        Buffer.byteLength(serialized, "utf8") >
        MAX_DICTIONARY_BYTES
      ) {
        throw new Error(
          `Dictionary would exceed ${MAX_DICTIONARY_BYTES} byte storage limit`
        );
      }
      await writeJson(dictionaryPath, dictionary);
      return {
        action: "noop",
        reason: "exact-duplicate",
        revision: dictionary.revision,
        entryRevision: duplicate?.entryRevision ?? null,
        entry: duplicate,
        noveltyAssessment: assessment
      };
    }
    const entryId = assessment.entryId;
    const previousIndex = dictionary.entries.findIndex(
      (entry) => entry.entryId === entryId
    );
    const previous =
      previousIndex >= 0 ? dictionary.entries[previousIndex] : null;
    if (previous && expectedRevision === undefined) {
      throw new Error(
        `Updating ${entryId} requires expectedRevision=${revision}`
      );
    }
    assertMonotonicStatus(
      previous,
      validated.status,
      allowVerified
    );
    if (!previous && dictionary.entries.length >= MAX_DICTIONARY_ENTRIES) {
      throw new Error(
        `Dictionary entry limit reached (${MAX_DICTIONARY_ENTRIES})`
      );
    }
    if (
      dictionary.revisions.length >=
      MAX_DICTIONARY_REVISIONS
    ) {
      throw new Error(
        `Dictionary revision limit reached (${MAX_DICTIONARY_REVISIONS}); archive a hash-rooted segment before continuing`
      );
    }
    if (
      Object.keys(dictionary.idempotency).length >=
      MAX_IDEMPOTENCY_KEYS
    ) {
      throw new Error(
        `Dictionary idempotency-key limit reached (${MAX_IDEMPOTENCY_KEYS})`
      );
    }
    const evidenceSnapshot = evidenceSnapshotFor(
      validated,
      catalog,
      taxonomy
    );
    const provenanceHash = sha256(
      stableJson({
        evidenceSnapshot,
        sourceIds: [...validated.sourceIds].sort(),
        articleIds: [...validated.articleIds].sort(),
        evidence: validated.evidence,
        contextComparisons: validated.contextComparisons,
        counterEvidence: validated.counterEvidence,
        application: validated.application,
        status: validated.status,
        visibility: validated.visibility
      })
    );
    const entryRevision = (previous?.entryRevision ?? 0) + 1;
    const revisionId = `dictrev:${sha256(
      stableJson({
        entryId,
        entryRevision,
        requestHash: assessment.requestHash,
        provenanceHash
      })
    ).slice(0, 24)}`;
    const recorded = {
      ...validated,
      entryId,
      entryRevision,
      revisionId,
      supersedesRevisionId: previous?.revisionId ?? null,
      provenanceHash,
      payloadHash: assessment.requestHash,
      canonicalClaimHash: assessment.canonicalClaimHash,
      evidenceSnapshot,
      publisherContentTrust: publisherContentTrust(),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now
    };
    if (previousIndex >= 0) {
      dictionary.entries[previousIndex] = recorded;
    } else {
      dictionary.entries.push(recorded);
    }
    dictionary.revisions.push({
      ...structuredClone(recorded),
      recordedAt: now,
      idempotencyKey: normalizedKey,
      noveltyAssessment: assessment
    });
    dictionary.idempotency[normalizedKey] = {
      inputHash,
      requestHash: assessment.requestHash,
      entryId,
      revisionId,
      committedRevision: revision + 1
    };
    dictionary.schemaVersion = 2;
    dictionary.updatedAt = now;
    dictionary.revision = revision + 1;
    validateDictionaryCommitLedger(dictionary);
    dictionary.entries.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt)
    );
    const serialized = `${JSON.stringify(dictionary, null, 2)}\n`;
    if (Buffer.byteLength(serialized, "utf8") > MAX_DICTIONARY_BYTES) {
      throw new Error(
        `Dictionary would exceed ${MAX_DICTIONARY_BYTES} byte storage limit`
      );
    }
    await writeJson(dictionaryPath, dictionary);

    return {
      action: previous ? "updated" : "created",
      revision: dictionary.revision,
      entryRevision,
      revisionId,
      noveltyAssessment: assessment,
      entry: recorded
    };
  });
}

export function searchDictionaryEntries(
  query,
  dictionary,
  {
    kinds,
    statuses,
    visibility,
    sourceIds,
    domainIds,
    problemTypeIds,
    limit = 20
  } = {}
) {
  const queryTokens = [...new Set(tokenize(query))];
  const kindSet = kinds?.length ? new Set(kinds) : null;
  const statusSet = statuses?.length
    ? new Set(statuses)
    : null;
  const sourceSet = sourceIds?.length ? new Set(sourceIds) : null;
  const scoreEntry = (entry) => {
    const tokens = tokenize(
      [
        entry.title,
        entry.question,
        entry.finding,
        entry.summary,
        ...(entry.preconditions ?? []),
        ...(entry.tradeoffs ?? []),
        ...(entry.counterEvidence ?? [])
      ].join(" ")
    );
    const tokenSet = new Set(tokens);
    return queryTokens.reduce(
      (score, token) => score + (tokenSet.has(token) ? 1 : 0),
      queryTokens.length ? 0 : 1
    );
  };

  return dictionary.entries
    .filter((entry) => !kindSet || kindSet.has(entry.kind))
    .filter(
      (entry) =>
        !statusSet || statusSet.has(entry.status)
    )
    .filter(
      (entry) =>
        !visibility ||
        (entry.visibility ?? "local") === visibility
    )
    .filter(
      (entry) =>
        !sourceSet ||
        entry.sourceIds.some((sourceId) => sourceSet.has(sourceId))
    )
    .filter(
      (entry) =>
        !domainIds?.length ||
        domainIds.some((id) => entry.domainIds.includes(id))
    )
    .filter(
      (entry) =>
        !problemTypeIds?.length ||
        problemTypeIds.some((id) => entry.problemTypeIds.includes(id))
    )
    .map((entry) => ({ entry, score: scoreEntry(entry) }))
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.entry.updatedAt.localeCompare(left.entry.updatedAt)
    )
    .slice(0, Math.max(1, Math.min(Number(limit) || 20, 100)))
    .map(({ entry, score }) => ({ ...entry, score }));
}

export function dictionaryEvidenceStatus(
  entry,
  catalog,
  currentTaxonomyHash
) {
  const pinned = entry.evidenceSnapshot;
  if (!pinned) {
    return {
      status: "legacy-unpinned",
      staleArticleIds: [],
      missingArticleIds: [],
      taxonomyChanged: true
    };
  }
  const articles = new Map(
    catalog.articles.map((article) => [article.articleId, article])
  );
  const staleArticleIds = [];
  const missingArticleIds = [];
  for (const evidenceArticle of pinned.articles ?? []) {
    const current = articles.get(evidenceArticle.articleId);
    if (!current) {
      missingArticleIds.push(evidenceArticle.articleId);
      continue;
    }
    if (
      current.contentHash !== evidenceArticle.contentHash ||
      current.ontologyHash !== evidenceArticle.ontologyHash
    ) {
      staleArticleIds.push(evidenceArticle.articleId);
    }
  }
  const taxonomyChanged =
    Boolean(currentTaxonomyHash) &&
    pinned.taxonomyHash !== currentTaxonomyHash;
  return {
    status:
      missingArticleIds.length ||
      staleArticleIds.length ||
      taxonomyChanged
        ? "stale"
        : "current",
    staleArticleIds,
    missingArticleIds,
    taxonomyChanged
  };
}

export function dictionaryEntryHistory(entryId, dictionary) {
  const revisions = (dictionary.revisions ?? [])
    .filter((revision) => revision.entryId === entryId)
    .sort(
      (left, right) =>
        (left.entryRevision ?? 0) -
        (right.entryRevision ?? 0)
    );
  for (let index = 0; index < revisions.length; index += 1) {
    const revision = revisions[index];
    const previous = index ? revisions[index - 1] : null;
    if (
      revision.entryRevision !== index + 1 ||
      revision.supersedesRevisionId !==
        (previous?.revisionId ?? null)
    ) {
      throw new Error(
        `Dictionary revision chain is invalid for ${entryId}`
      );
    }
  }
  return revisions;
}
