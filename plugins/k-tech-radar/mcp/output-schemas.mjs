import {
  reviewEvidenceOutputRefSchema
} from "../lib/review-evidence.mjs";

const text = { type: "string" };
const nullableText = { type: ["string", "null"] };
const canonicalInstant = {
  type: "string",
  maxLength: 24,
  pattern:
    "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"
};
const nullableCanonicalInstant = {
  type: ["string", "null"],
  maxLength: 24,
  pattern:
    "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"
};
const nullableReviewInstant =
  nullableCanonicalInstant;
const integer = { type: "integer" };
const nullableInteger = { type: ["integer", "null"] };
const number = { type: "number" };
const nullableNumber = { type: ["number", "null"] };
const boolean = { type: "boolean" };
const stringArray = {
  type: "array",
  items: text
};

function arrayOf(items) {
  return {
    type: "array",
    items
  };
}

function closed(properties, required = []) {
  return {
    type: "object",
    required,
    properties,
    additionalProperties: false
  };
}

const publisherContentTrustSchema = closed(
  {
    kind: text,
    trustLevel: text,
    instructionsAllowed: boolean,
    mayContainPromptInjection: boolean
  },
  [
    "kind",
    "trustLevel",
    "instructionsAllowed",
    "mayContainPromptInjection"
  ]
);

const storagePolicySchema = closed({
  storesFullText: boolean,
  contentFetch: text,
  publicSnapshot: text
});

const localArticleRevisionSchema = closed(
  {
    revisionHash: text,
    observedAt: nullableText,
    title: text,
    summary: text,
    publishedAt: nullableText,
    publisherUpdatedAt: nullableText,
    authors: stringArray,
    tags: stringArray
  },
  [
    "revisionHash",
    "observedAt",
    "title",
    "summary",
    "publishedAt",
    "publisherUpdatedAt",
    "authors",
    "tags"
  ]
);

const publicArticleRevisionSchema = closed(
  {
    revisionHash: nullableText,
    contentHash: nullableText,
    ontologyHash: nullableText,
    publisherUpdatedAt: nullableText,
    firstSeenAt: nullableText,
    lastSeenAt: nullableText,
    lastChangedAt: nullableText
  },
  [
    "revisionHash",
    "contentHash",
    "ontologyHash",
    "publisherUpdatedAt",
    "firstSeenAt",
    "lastSeenAt",
    "lastChangedAt"
  ]
);

const articleRevisionSchema = {
  oneOf: [
    localArticleRevisionSchema,
    publicArticleRevisionSchema
  ]
};

const articleBaseProperties = {
  articleId: text,
  sourceId: text,
  companyId: text,
  companyName: text,
  sourceName: text,
  sourceHomepage: text,
  language: text,
  evidenceAuthority: text,
  storagePolicy: storagePolicySchema,
  businessUnitId: text,
  canonicalUrl: text,
  canonicalWorkId: nullableText,
  translationOf: nullableText,
  workIdentityBasis: text,
  workIndependenceStatus: text,
  title: text,
  summary: text,
  publishedAt: nullableText,
  publisherUpdatedAt: nullableText,
  authors: stringArray,
  tags: stringArray,
  rawPublisherTags: stringArray,
  namespacedTags: stringArray,
  domainIds: stringArray,
  problemTypeIds: stringArray,
  metadataState: text,
  contentHash: text,
  ontologyHash: text,
  revisionHash: text,
  recordStatus: text,
  fetchedAt: nullableText,
  revisions: arrayOf(articleRevisionSchema),
  firstSeenAt: nullableText,
  lastSeenAt: nullableText,
  lastChangedAt: nullableText,
  taxonomyHash: nullableText,
  score: number,
  publisherContentTrust: publisherContentTrustSchema
};

export const articleProjectionSchema = closed(
  {
    articleId: text,
    sourceId: text,
    companyId: text,
    sourceName: text,
    title: text,
    summary: text,
    canonicalUrl: text,
    publishedAt: nullableText,
    publisherUpdatedAt: nullableText,
    authors: stringArray,
    tags: stringArray,
    domainIds: stringArray,
    problemTypeIds: stringArray,
    metadataState: text,
    score: number,
    publisherContentTrust: publisherContentTrustSchema
  },
  [
    "articleId",
    "sourceId",
    "companyId",
    "sourceName",
    "title",
    "summary",
    "canonicalUrl",
    "authors",
    "tags",
    "domainIds",
    "problemTypeIds",
    "metadataState",
    "publisherContentTrust"
  ]
);

export const storedArticleSchema = closed(
  articleBaseProperties,
  [
    "articleId",
    "sourceId",
    "companyId",
    "sourceName",
    "canonicalUrl",
    "title",
    "summary",
    "authors",
    "tags",
    "domainIds",
    "problemTypeIds",
    "metadataState",
    "contentHash",
    "ontologyHash",
    "publisherContentTrust"
  ]
);

const contextSignalsSchema = closed({
  scaleMentions: stringArray,
  stackMentions: stringArray,
  mechanismIds: stringArray,
  ambiguousMechanismIds: stringArray
});

const fusionArticleSchema = closed(
  {
    ...articleBaseProperties,
    directQueryAnchors: stringArray,
    contextSignals: contextSignalsSchema
  },
  [
    "articleId",
    "sourceId",
    "companyId",
    "title",
    "canonicalUrl",
    "domainIds",
    "problemTypeIds",
    "directQueryAnchors",
    "contextSignals",
    "publisherContentTrust"
  ]
);

const freshnessSchema = closed(
  {
    status: text,
    usable: boolean,
    dataAsOf: nullableText,
    ageDays: nullableNumber
  },
  ["status", "usable", "dataAsOf", "ageDays"]
);

const articleGroupSchema = closed(
  {
    sourceId: text,
    companyId: text,
    sourceName: text,
    articles: arrayOf(articleProjectionSchema)
  },
  ["sourceId", "companyId", "sourceName", "articles"]
);

const fusionGroupSchema = closed(
  {
    sourceId: text,
    companyId: text,
    sourceName: text,
    articles: arrayOf(fusionArticleSchema),
    freshness: freshnessSchema
  },
  ["sourceId", "companyId", "sourceName", "articles", "freshness"]
);

const collectionSchema = closed(
  {
    status: text,
    attemptedAt: nullableText,
    mode: text,
    sourceSnapshotId: nullableText,
    publisherExcerptPolicy: text,
    requestedSourceIds: stringArray,
    succeededSourceIds: stringArray,
    failedSourceIds: stringArray,
    unselectedSourceIds: stringArray
  },
  ["status"]
);

const changeSetSchema = closed({
  newArticleIds: stringArray,
  updatedArticleIds: stringArray,
  reclassifiedArticleIds: stringArray,
  migratedArticleIds: stringArray
});

const collectionStateSchema = closed(
  {
    status: text,
    lastCheckedAt: nullableText,
    lastAttemptAt: nullableText,
    lastSuccessAt: nullableText,
    dataAsOf: nullableText,
    articleCountSeen: nullableInteger,
    endpoint: nullableText,
    etag: nullableText,
    lastModified: nullableText,
    durationMs: nullableInteger,
    error: nullableText,
    errorCode: nullableText,
    warningCount: nullableInteger
  },
  ["status"]
);

const sourceStatusItemSchema = closed(
  {
    sourceId: text,
    companyId: text,
    displayName: text,
    homepage: text,
    authority: text,
    adapterType: text,
    articleCount: integer,
    excludedRecordCount: integer,
    collection: collectionStateSchema,
    partition: closed(
      {
        snapshotId: nullableText,
        dataAsOf: nullableText,
        sourceHash: nullableText
      },
      ["snapshotId", "dataAsOf", "sourceHash"]
    )
  },
  [
    "sourceId",
    "companyId",
    "displayName",
    "homepage",
    "authority",
    "adapterType",
    "articleCount",
    "excludedRecordCount",
    "collection",
    "partition"
  ]
);

const discoveryReferenceSchema = closed(
  {
    id: text,
    url: text,
    role: text,
    ingest: boolean,
    reason: text
  },
  ["id", "url", "role", "ingest", "reason"]
);

const sourceReportFailureSchema = closed(
  {
    index: integer,
    error: text
  },
  ["index", "error"]
);

const sourceReportWarningSchema = closed(
  {
    stage: text,
    candidateUrl: nullableText,
    error: text
  },
  ["stage", "candidateUrl", "error"]
);

const sourceReportSchema = closed(
  {
    sourceId: text,
    status: text,
    articleCountSeen: integer,
    durationMs: integer,
    warnings: arrayOf(sourceReportWarningSchema),
    error: text,
    failures: arrayOf(sourceReportFailureSchema)
  },
  ["sourceId", "status", "articleCountSeen", "durationMs"]
);

const deltaSchema = closed(
  {
    newCount: integer,
    updatedCount: integer,
    reclassifiedCount: integer,
    migratedCount: integer,
    unchangedCount: integer,
    newArticleIds: stringArray,
    updatedArticleIds: stringArray,
    reclassifiedArticleIds: stringArray,
    migratedArticleIds: stringArray
  },
  [
    "newCount",
    "updatedCount",
    "reclassifiedCount",
    "migratedCount",
    "unchangedCount",
    "newArticleIds",
    "updatedArticleIds",
    "reclassifiedArticleIds",
    "migratedArticleIds"
  ]
);

export const refreshOutputSchema = closed(
  {
    checkedAt: text,
    mode: text,
    dryRun: boolean,
    sourceReports: arrayOf(sourceReportSchema),
    delta: deltaSchema,
    catalogRecordCount: integer,
    activeArticleCount: integer,
    countsBySource: {
      type: "object",
      properties: {},
      additionalProperties: integer
    },
    status: text,
    snapshotId: text,
    integrityHash: text,
    taxonomyChanged: boolean
  },
  [
    "checkedAt",
    "mode",
    "dryRun",
    "sourceReports",
    "delta",
    "catalogRecordCount",
    "activeArticleCount",
    "countsBySource",
    "status",
    "snapshotId",
    "integrityHash",
    "taxonomyChanged"
  ]
);

export const sourceStatusOutputSchema = closed(
  {
    snapshotId: text,
    snapshotVisibility: text,
    snapshotCommittedAt: text,
    collection: collectionSchema,
    changeSet: changeSetSchema,
    catalogRefreshedAt: nullableText,
    totalArticles: integer,
    sources: arrayOf(sourceStatusItemSchema),
    nonIngestedReferences: arrayOf(discoveryReferenceSchema)
  },
  [
    "snapshotId",
    "snapshotVisibility",
    "snapshotCommittedAt",
    "collection",
    "changeSet",
    "catalogRefreshedAt",
    "totalArticles",
    "sources",
    "nonIngestedReferences"
  ]
);

export const articleListOutputSchema = closed(
  {
    snapshotId: text,
    snapshotCommittedAt: text,
    since: text,
    count: integer,
    groups: arrayOf(articleGroupSchema)
  },
  [
    "snapshotId",
    "snapshotCommittedAt",
    "since",
    "count",
    "groups"
  ]
);

const searchPartitionedSchema = closed(
  {
    snapshotId: text,
    mode: {
      type: "string",
      const: "partitioned"
    },
    count: integer,
    groups: arrayOf(articleGroupSchema)
  },
  ["snapshotId", "mode", "count", "groups"]
);

const searchFlatSchema = closed(
  {
    snapshotId: text,
    mode: {
      type: "string",
      const: "flat"
    },
    count: integer,
    articles: arrayOf(articleProjectionSchema)
  },
  ["snapshotId", "mode", "count", "articles"]
);

const sharedAnchorSchema = closed(
  {
    term: text,
    sourceCount: integer,
    articleCount: integer
  },
  ["term", "sourceCount", "articleCount"]
);

const sharedConceptSchema = closed(
  {
    id: text,
    sourceCount: integer
  },
  ["id", "sourceCount"]
);

const sharedSignalSchema = sharedConceptSchema;

const coherentConceptSchema = closed(
  {
    kind: text,
    id: text
  },
  ["kind", "id"]
);

const coherentSupportSchema = closed(
  {
    anchor: text,
    mechanism: text,
    concept: coherentConceptSchema,
    publisherCount: integer,
    confirmedPublisherCount: integer,
    sourceCount: integer,
    confirmedSourceCount: integer,
    independentWorkCount: integer,
    distinctWorkCount: integer,
    unconfirmedWorkCount: integer,
    articleIds: stringArray,
    candidateArticleIds: stringArray
  },
  [
    "anchor",
    "mechanism",
    "concept",
    "publisherCount",
    "confirmedPublisherCount",
    "sourceCount",
    "confirmedSourceCount",
    "independentWorkCount",
    "distinctWorkCount",
    "unconfirmedWorkCount",
    "articleIds",
    "candidateArticleIds"
  ]
);

const sourceFreshnessSchema = closed(
  {
    sourceId: text,
    companyId: text,
    status: text,
    usable: boolean,
    dataAsOf: nullableText,
    ageDays: nullableNumber
  },
  [
    "sourceId",
    "companyId",
    "status",
    "usable",
    "dataAsOf",
    "ageDays"
  ]
);

const runReceiptCandidateSchema = closed(
  {
    status: text,
    decision: text,
    queryFingerprint: text,
    snapshotId: nullableText,
    checkedSourceIds: stringArray,
    eligibleSourceIds: stringArray,
    acceptedEntryIds: stringArray,
    heldReasons: stringArray,
    evidenceStatus: text
  },
  [
    "status",
    "decision",
    "queryFingerprint",
    "snapshotId",
    "checkedSourceIds",
    "eligibleSourceIds",
    "acceptedEntryIds",
    "heldReasons",
    "evidenceStatus"
  ]
);

const synthesisContractSchema = closed({
  retainArticleIds: boolean,
  distinguishAuthorClaimsFromInference: boolean,
  compareScaleStackAndOrganizationContext: boolean,
  surfaceContradictionsAndCounterEvidence: boolean,
  requireExperimentMetricsAndRollbackForApplication: boolean,
  physicalMergeOfSourceRecords: boolean,
  metadataComparabilityIsNotEvidenceReadiness: boolean,
  requireBoundedPrimaryEvidenceFromEveryPublisher: boolean,
  requireLocatorsAndNonMetadataClaims: boolean
});

export const fusionOutputSchema = closed(
  {
    snapshotId: text,
    mode: {
      type: "string",
      const: "fusion-candidates"
    },
    status: text,
    query: text,
    queryFingerprint: text,
    sourceCount: integer,
    publisherCount: integer,
    requiredPublisherCount: integer,
    candidateSourceCount: integer,
    independentWorkCount: integer,
    articleCount: integer,
    queryTerms: stringArray,
    sharedQueryAnchors: arrayOf(sharedAnchorSchema),
    excludedGenericQueryAnchors: arrayOf(sharedAnchorSchema),
    sharedMechanisms: arrayOf(sharedSignalSchema),
    ambiguousMechanisms: arrayOf(sharedSignalSchema),
    sharedStacks: arrayOf(sharedSignalSchema),
    sharedDomains: arrayOf(sharedConceptSchema),
    sharedProblems: arrayOf(sharedConceptSchema),
    coherentSupports: arrayOf(coherentSupportSchema),
    selectedSupport: coherentSupportSchema,
    evidenceMatrix: arrayOf(fusionGroupSchema),
    sourceFreshness: arrayOf(sourceFreshnessSchema),
    runReceiptCandidate: runReceiptCandidateSchema,
    nextGate: text,
    synthesisContract: synthesisContractSchema,
    guardrail: text
  },
  [
    "snapshotId",
    "status",
    "query",
    "queryFingerprint",
    "evidenceMatrix",
    "runReceiptCandidate",
    "guardrail"
  ]
);

export const searchArticlesOutputSchema = closed(
  {
    ...searchPartitionedSchema.properties,
    ...searchFlatSchema.properties,
    ...fusionOutputSchema.properties,
    mode: text
  },
  []
);

const evidenceSchema = closed(
  {
    sourceId: text,
    articleId: text,
    claim: text,
    locator: text,
    evidenceLevel: text,
    role: text,
    independence: text,
    directness: text,
    studyDesign: text,
    causalScope: text
  },
  ["sourceId", "articleId", "claim"]
);

const contextComparisonSchema = closed(
  {
    sourceId: text,
    scale: text,
    workload: text,
    stackVersion: text,
    slo: text,
    teamShape: text,
    regulation: text,
    comparability: text,
    note: text
  },
  ["sourceId"]
);

const applicationSchema = closed({
  target: text,
  hypothesis: text,
  experiment: text,
  metrics: stringArray,
  rollback: text,
  failureBoundary: text,
  changedAssumption: text,
  nextExperiment: text,
  reuseConditions: stringArray,
  exceptions: stringArray
});

const verificationSchema = closed({
  primarySourcesChecked: boolean,
  counterEvidenceReviewed: boolean,
  reviewedAt: nullableReviewInstant
});

const reviewRoundSchema = closed(
  {
    round: integer,
    score: number,
    p0: integer,
    p1: integer,
    p2: integer,
    summary: text,
    evidenceRefs: arrayOf(
      reviewEvidenceOutputRefSchema
    )
  },
  [
    "round",
    "score",
    "p0",
    "p1",
    "p2",
    "summary",
    "evidenceRefs"
  ]
);

const qualityReviewSchema = closed({
  rounds: arrayOf(reviewRoundSchema),
  reviewedAt: nullableReviewInstant,
  evidenceMode: text
});

const evidenceSnapshotArticleSchema = closed(
  {
    articleId: text,
    sourceId: text,
    contentHash: nullableText,
    revisionHash: nullableText,
    ontologyHash: nullableText
  },
  [
    "articleId",
    "sourceId",
    "contentHash",
    "revisionHash",
    "ontologyHash"
  ]
);

const evidenceSnapshotSchema = closed(
  {
    snapshotId: nullableText,
    taxonomyHash: text,
    articles: arrayOf(evidenceSnapshotArticleSchema)
  },
  ["snapshotId", "taxonomyHash", "articles"]
);

const evidenceStatusSchema = closed(
  {
    status: text,
    staleArticleIds: stringArray,
    missingArticleIds: stringArray,
    taxonomyChanged: boolean
  },
  [
    "status",
    "staleArticleIds",
    "missingArticleIds",
    "taxonomyChanged"
  ]
);

const nearCandidateSchema = closed(
  {
    entryId: text,
    status: text,
    similarity: number
  },
  ["entryId", "status", "similarity"]
);

const noveltyAssessmentSchema = closed(
  {
    entryId: text,
    requestHash: text,
    canonicalClaimHash: text,
    decision: text,
    exactEntryId: nullableText,
    nearCandidates: arrayOf(nearCandidateSchema),
    semanticSimilarityPolicy: text
  },
  [
    "entryId",
    "requestHash",
    "canonicalClaimHash",
    "decision",
    "exactEntryId",
    "nearCandidates",
    "semanticSimilarityPolicy"
  ]
);

export const dictionaryEntryOutputSchema = closed(
  {
    entryId: nullableText,
    kind: text,
    title: text,
    question: text,
    finding: text,
    summary: text,
    sourceIds: stringArray,
    articleIds: stringArray,
    domainIds: stringArray,
    problemTypeIds: stringArray,
    evidence: arrayOf(evidenceSchema),
    preconditions: stringArray,
    tradeoffs: stringArray,
    counterEvidence: stringArray,
    contextComparisons: arrayOf(contextComparisonSchema),
    application: {
      type: ["object", "null"],
      properties: applicationSchema.properties,
      additionalProperties: false
    },
    verification: verificationSchema,
    qualityReview: qualityReviewSchema,
    visibility: text,
    status: text,
    entryRevision: integer,
    revisionId: text,
    supersedesRevisionId: nullableText,
    provenanceHash: text,
    payloadHash: text,
    canonicalClaimHash: text,
    evidenceSnapshot: evidenceSnapshotSchema,
    publisherContentTrust: publisherContentTrustSchema,
    createdAt: canonicalInstant,
    updatedAt: canonicalInstant,
    recordedAt: nullableCanonicalInstant,
    idempotencyKey: text,
    noveltyAssessment: noveltyAssessmentSchema,
    migration: text,
    score: number,
    evidenceStatus: evidenceStatusSchema
  },
  [
    "entryId",
    "kind",
    "title",
    "summary",
    "sourceIds",
    "articleIds",
    "evidence",
    "visibility",
    "status"
  ]
);

export const dictionarySearchOutputSchema = closed(
  {
    snapshotId: text,
    revision: integer,
    updatedAt: nullableCanonicalInstant,
    count: integer,
    entries: arrayOf(dictionaryEntryOutputSchema),
    history: arrayOf(dictionaryEntryOutputSchema)
  },
  [
    "snapshotId",
    "revision",
    "updatedAt",
    "count",
    "entries",
    "history"
  ]
);

export const articleOutputSchema = closed(
  {
    snapshotId: text,
    article: storedArticleSchema,
    dictionaryEntries: arrayOf(dictionaryEntryOutputSchema)
  },
  ["snapshotId", "article", "dictionaryEntries"]
);

const acceptedEntryRevisionSchema = closed(
  {
    entryId: text,
    entryRevision: integer,
    revisionId: text,
    provenanceHash: text,
    payloadHash: text,
    evidenceSnapshotId: nullableText,
    statusAtAcceptance: text,
    dictionaryCommittedRevision: integer
  },
  [
    "entryId",
    "entryRevision",
    "revisionId",
    "provenanceHash",
    "payloadHash",
    "evidenceSnapshotId",
    "statusAtAcceptance",
    "dictionaryCommittedRevision"
  ]
);

const candidateDecisionSchema = closed(
  {
    candidateId: text,
    decision: text,
    reason: text
  },
  ["candidateId", "decision", "reason"]
);

export const insightRunSchema = closed(
  {
    status: text,
    query: text,
    queryFingerprint: text,
    snapshotId: text,
    sourceIds: stringArray,
    acceptedEntryIds: stringArray,
    acceptedEntryRevisions: arrayOf(
      acceptedEntryRevisionSchema
    ),
    observedDictionaryRevision: integer,
    heldReasons: stringArray,
    candidateDecisions: arrayOf(candidateDecisionSchema),
    reviewRounds: arrayOf(reviewRoundSchema),
    notes: text,
    runId: text,
    requestHash: text,
    committedRevision: integer,
    mutationFingerprint: text,
    allowedMutationRefs: stringArray,
    expectedMutationRefs: stringArray,
    createdAt: canonicalInstant
  },
  [
    "status",
    "query",
    "queryFingerprint",
    "snapshotId",
    "sourceIds",
    "acceptedEntryIds",
    "acceptedEntryRevisions",
    "observedDictionaryRevision",
    "heldReasons",
    "candidateDecisions",
    "reviewRounds",
    "notes",
    "runId",
    "requestHash",
    "committedRevision",
    "mutationFingerprint",
    "allowedMutationRefs",
    "expectedMutationRefs",
    "createdAt"
  ]
);

export const mutationOutputSchema = closed(
  {
    action: {
      type: "string",
      enum: ["created", "updated", "noop"]
    },
    reason: text,
    revision: integer,
    entryRevision: nullableInteger,
    revisionId: text,
    noveltyAssessment: noveltyAssessmentSchema,
    entry: {
      type: ["object", "null"],
      properties: dictionaryEntryOutputSchema.properties,
      additionalProperties: false
    },
    run: {
      type: ["object", "null"],
      properties: insightRunSchema.properties,
      required: insightRunSchema.required,
      additionalProperties: false
    }
  },
  ["action", "revision"]
);

export const applicationPlanOutputSchema = closed(
  {
    snapshotId: text,
    entryId: text,
    entryRevision: nullableInteger,
    status: text,
    evidenceStatus: evidenceStatusSchema,
    targetContext: closed(
      {
        scale: text,
        workload: text,
        stackVersion: text,
        slo: text,
        teamShape: text,
        regulation: text
      },
      [
        "scale",
        "workload",
        "stackVersion",
        "slo",
        "teamShape",
        "regulation"
      ]
    ),
    contextReview: closed(
      {
        missingTargetLanes: stringArray,
        nonComparableSources: stringArray,
        sourceContexts: arrayOf(contextComparisonSchema)
      },
      [
        "missingTargetLanes",
        "nonComparableSources",
        "sourceContexts"
      ]
    ),
    plan: {
      type: ["object", "null"],
      properties: {
        hypothesis: text,
        experiment: text,
        metrics: stringArray,
        rollback: text,
        failureBoundary: text,
        preconditions: stringArray,
        tradeoffs: stringArray,
        counterEvidence: stringArray,
        reuseConditions: stringArray,
        exceptions: stringArray
      },
      additionalProperties: false
    },
    guardrail: text
  },
  [
    "snapshotId",
    "entryId",
    "entryRevision",
    "status",
    "evidenceStatus",
    "targetContext",
    "contextReview",
    "plan",
    "guardrail"
  ]
);

export const insightRunListOutputSchema = closed(
  {
    revision: integer,
    updatedAt: nullableCanonicalInstant,
    count: integer,
    runs: arrayOf(insightRunSchema)
  },
  ["revision", "updatedAt", "count", "runs"]
);

const ontologyConceptSchema = closed(
  {
    id: text,
    labelKo: text,
    keywords: stringArray
  },
  ["id", "labelKo", "keywords"]
);

const ontologySourceSchema = closed(
  {
    sourceId: text,
    companyId: text,
    displayName: text,
    authority: text
  },
  ["sourceId", "companyId", "displayName", "authority"]
);

export const ontologyOutputSchema = closed(
  {
    schemaVersion: integer,
    snapshotId: text,
    taxonomyHash: text,
    configHash: text,
    model: closed(
      {
        sourcePartition: text,
        derivedCatalog: text,
        sharedSemanticLayer: text,
        derivedKnowledge: text,
        researchRun: text,
        synthesisRule: text
      },
      [
        "sourcePartition",
        "derivedCatalog",
        "sharedSemanticLayer",
        "derivedKnowledge",
        "researchRun",
        "synthesisRule"
      ]
    ),
    relations: stringArray,
    sources: arrayOf(ontologySourceSchema),
    domains: arrayOf(ontologyConceptSchema),
    problemTypes: arrayOf(ontologyConceptSchema),
    counts: closed(
      {
        articles: integer,
        dictionaryEntries: integer,
        dictionaryRevisions: integer,
        insightRuns: integer,
        sourcePartitions: integer
      },
      [
        "articles",
        "dictionaryEntries",
        "dictionaryRevisions",
        "insightRuns",
        "sourcePartitions"
      ]
    ),
    guardrails: stringArray
  },
  [
    "schemaVersion",
    "snapshotId",
    "taxonomyHash",
    "configHash",
    "model",
    "relations",
    "sources",
    "domains",
    "problemTypes",
    "counts",
    "guardrails"
  ]
);

export const outputSchemas = {
  refresh_catalog: refreshOutputSchema,
  get_source_status: sourceStatusOutputSchema,
  list_recent_articles: articleListOutputSchema,
  search_articles: searchArticlesOutputSchema,
  get_article: articleOutputSchema,
  prepare_fusion_evidence: fusionOutputSchema,
  search_dictionary: dictionarySearchOutputSchema,
  record_dictionary_entry: mutationOutputSchema,
  prepare_application_plan: applicationPlanOutputSchema,
  list_insight_runs: insightRunListOutputSchema,
  record_insight_run: mutationOutputSchema,
  get_ontology: ontologyOutputSchema
};
