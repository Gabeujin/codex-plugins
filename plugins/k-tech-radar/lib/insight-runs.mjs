import {
  insightRunsPath,
  loadInsightRuns,
  writeJson
} from "./paths.mjs";
import {
  assertCurrentDictionaryRevision,
  assertDictionaryRevisionCommit,
  canonicalInstant,
  dictionaryEvidenceStatus,
  validateDictionaryRevisionChain
} from "./dictionary.mjs";
import { stableJson } from "./integrity.mjs";
import { withMutationLease } from "./mutations.mjs";
import { assertNegativeReviewScore } from "./quality-score.mjs";
import {
  normalizeReviewRoundsEvidence,
  reviewSubjectHash
} from "./review-evidence.mjs";
import {
  normalizeSearchText,
  sha256
} from "./text.mjs";

const MAX_RUNS = 5_000;
const MAX_RUN_BYTES = 12_000_000;
const MAX_IDEMPOTENCY_KEYS = 10_000;

function boundedText(
  value,
  field,
  { required = false, maxLength = 1_000 } = {}
) {
  const text = String(value ?? "").trim();
  if (required && !text) {
    throw new Error(`${field} is required`);
  }
  if (text.length > maxLength) {
    throw new Error(
      `${field} must be at most ${maxLength} characters`
    );
  }
  return text;
}

function uniqueTextArray(
  value,
  field,
  { required = false, maxItems = 50 } = {}
) {
  if (!Array.isArray(value)) {
    if (required) {
      throw new Error(`${field} must be an array`);
    }
    return [];
  }
  if (value.length > maxItems) {
    throw new Error(
      `${field} must contain at most ${maxItems} items`
    );
  }
  const values = [
    ...new Set(
      value
        .map((item, index) =>
          boundedText(item, `${field}[${index}]`, {
            maxLength: 500
          })
        )
        .filter(Boolean)
    )
  ];
  if (required && !values.length) {
    throw new Error(
      `${field} must contain at least one item`
    );
  }
  return values;
}

function validateReviewRounds(value) {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(
      "reviewRounds must contain exactly three negative-review rounds"
    );
  }
  return value.map((round, index) => {
    const normalized = {
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
      summary: boundedText(
        round.summary,
        `reviewRounds[${index}].summary`,
        { required: true, maxLength: 1_500 }
      ),
      evidenceRefs: structuredClone(
        round.evidenceRefs
      )
    };
    if (
      normalized.round !== index + 1 ||
      !Number.isFinite(normalized.score) ||
      normalized.score < 0 ||
      normalized.score > 10 ||
      ![normalized.p0, normalized.p1, normalized.p2].every(
        Number.isInteger
      )
    ) {
      throw new Error(
        "reviewRounds must be ordered 1..3 with scores from 0 to 10 and integer P0/P1/P2 counts"
      );
    }
    assertNegativeReviewScore(
      normalized,
      `reviewRounds[${index}]`
    );
    return normalized;
  });
}

function insightRunReviewSubjectPayload(run) {
  return {
    status: run.status,
    query: run.query,
    queryFingerprint: run.queryFingerprint,
    snapshotId: run.snapshotId,
    sourceIds: run.sourceIds,
    acceptedEntryIds: run.acceptedEntryIds,
    acceptedEntryRevisions:
      run.acceptedEntryRevisions,
    observedDictionaryRevision:
      run.observedDictionaryRevision,
    heldReasons: run.heldReasons,
    candidateDecisions: run.candidateDecisions,
    notes: run.notes
  };
}

export function insightRunReviewSubjectHash(run) {
  return reviewSubjectHash(
    "insight-run",
    insightRunReviewSubjectPayload(run)
  );
}

function acceptedRevisionPin(
  revision,
  dictionaryCommittedRevision
) {
  return {
    entryId: revision.entryId,
    entryRevision: revision.entryRevision,
    revisionId: revision.revisionId,
    provenanceHash: revision.provenanceHash,
    payloadHash: revision.payloadHash,
    evidenceSnapshotId:
      revision.evidenceSnapshot?.snapshotId ?? null,
    statusAtAcceptance: revision.status,
    dictionaryCommittedRevision
  };
}

export function validateInsightRun(
  input,
  {
    catalog,
    config,
    dictionary,
    taxonomy,
    taxonomyHash: currentTaxonomyHash
  }
) {
  if (!input || typeof input !== "object") {
    throw new Error("run must be an object");
  }
  const status = String(input.status ?? "");
  if (!["accepted", "held", "no-change"].includes(status)) {
    throw new Error(
      "run.status must be accepted, held, or no-change"
    );
  }
  const sourceIds = uniqueTextArray(
    input.sourceIds,
    "sourceIds",
    { required: true, maxItems: 9 }
  );
  const knownSources = new Set(
    config.sources.map((source) => source.id)
  );
  const unknownSources = sourceIds.filter(
    (sourceId) => !knownSources.has(sourceId)
  );
  if (unknownSources.length) {
    throw new Error(
      `Insight run references unknown sources: ${unknownSources.join(", ")}`
    );
  }
  const acceptedEntryIds = uniqueTextArray(
    input.acceptedEntryIds,
    "acceptedEntryIds",
    { maxItems: 50 }
  );
  const knownEntries = new Set(
    dictionary.entries.map((entry) => entry.entryId)
  );
  const unknownEntries = acceptedEntryIds.filter(
    (entryId) => !knownEntries.has(entryId)
  );
  if (unknownEntries.length) {
    throw new Error(
      `Insight run references unknown Dictionary entries: ${unknownEntries.join(", ")}`
    );
  }
  const acceptedEntries = acceptedEntryIds.map((entryId) =>
    dictionary.entries.find(
      (entry) => entry.entryId === entryId
    )
  );
  const heldReasons = uniqueTextArray(
    input.heldReasons,
    "heldReasons",
    { maxItems: 50 }
  );
  if (status === "accepted" && !acceptedEntryIds.length) {
    throw new Error(
      "accepted insight runs require acceptedEntryIds"
    );
  }
  if (
    status !== "accepted" &&
    acceptedEntryIds.length
  ) {
    throw new Error(
      "held and no-change runs cannot claim accepted entries"
    );
  }
  if (status !== "accepted" && !heldReasons.length) {
    throw new Error(
      "held and no-change runs require explicit heldReasons"
    );
  }
  const reviewRounds = validateReviewRounds(
    input.reviewRounds
  );
  const finalRound = reviewRounds[2];
  if (
    status === "accepted" &&
    (finalRound.score < 9.9 ||
      finalRound.p0 !== 0 ||
      finalRound.p1 !== 0)
  ) {
    throw new Error(
      "accepted insight runs require final score >=9.9 with P0=0 and P1=0"
    );
  }
  const acceptedEntryRevisions =
    status === "accepted"
      ? acceptedEntries.map((entry) => {
          if (entry.status !== "verified") {
            throw new Error(
              `Accepted insight runs require verified Dictionary entries: ${entry.entryId}`
            );
          }
          const entryRounds = entry.qualityReview?.rounds;
          if (
            !Array.isArray(entryRounds) ||
            entryRounds.length !== 3
          ) {
            throw new Error(
              `Accepted Dictionary entry ${entry.entryId} lacks exactly three quality-review rounds`
            );
          }
          entryRounds.forEach((round, index) => {
            if (Number(round.round) !== index + 1) {
              throw new Error(
                `Accepted Dictionary entry ${entry.entryId} has unordered quality-review rounds`
              );
            }
            assertNegativeReviewScore(
              round,
              `${entry.entryId}.qualityReview.rounds[${index}]`
            );
          });
          const entryFinal = entryRounds[2];
          if (
            Number(entryFinal.score) < 9.9 ||
            Number(entryFinal.p0) !== 0 ||
            Number(entryFinal.p1) !== 0
          ) {
            throw new Error(
              `Accepted Dictionary entry ${entry.entryId} has not passed the 9.9 quality gate`
            );
          }
          const evidenceStatus = dictionaryEvidenceStatus(
            entry,
            catalog,
            currentTaxonomyHash
          );
          if (evidenceStatus.status !== "current") {
            throw new Error(
              `Accepted Dictionary entry ${entry.entryId} has ${evidenceStatus.status} evidence`
            );
          }
          const missingSources = (entry.sourceIds ?? []).filter(
            (sourceId) => !sourceIds.includes(sourceId)
          );
          if (missingSources.length) {
            throw new Error(
              `Accepted Dictionary entry ${entry.entryId} uses sources outside the insight run: ${missingSources.join(", ")}`
            );
          }
          const pin = assertCurrentDictionaryRevision(
            entry,
            dictionary,
            catalog,
            taxonomy
          );
          return {
            ...pin,
            dictionaryCommittedRevision:
              assertDictionaryRevisionCommit(
                pin,
                dictionary,
                {
                  observedRevision:
                    Number(dictionary.revision)
                }
              )
          };
        })
      : [];
  const snapshotId = boundedText(
    input.snapshotId,
    "snapshotId",
    { required: true, maxLength: 180 }
  );
  if (snapshotId !== catalog.snapshotId) {
    throw new Error(
      `Insight run snapshot conflict: expected current ${catalog.snapshotId}`
    );
  }
  const query = boundedText(input.query, "query", {
    required: true,
    maxLength: 512
  });
  const candidateDecisions = Array.isArray(
    input.candidateDecisions
  )
    ? input.candidateDecisions.map((decision, index) => ({
        candidateId: boundedText(
          decision.candidateId,
          `candidateDecisions[${index}].candidateId`,
          { required: true, maxLength: 180 }
        ),
        decision: boundedText(
          decision.decision,
          `candidateDecisions[${index}].decision`,
          { required: true, maxLength: 80 }
        ),
        reason: boundedText(
          decision.reason,
          `candidateDecisions[${index}].reason`,
          { required: true, maxLength: 1_500 }
        )
      }))
    : [];
  if (candidateDecisions.length > 100) {
    throw new Error(
      "candidateDecisions must contain at most 100 items"
    );
  }
  const validated = {
    status,
    query,
    queryFingerprint: sha256(
      normalizeSearchText(query)
    ),
    snapshotId,
    sourceIds,
    acceptedEntryIds,
    acceptedEntryRevisions,
    observedDictionaryRevision:
      Number(dictionary.revision) || 0,
    heldReasons,
    candidateDecisions,
    notes: boundedText(input.notes, "notes", {
      maxLength: 3_000
    })
  };
  const normalizedReview =
    normalizeReviewRoundsEvidence(
      reviewRounds,
      {
        subjectType: "insight-run",
        payload:
          insightRunReviewSubjectPayload(validated),
        field: "reviewRounds"
      }
    );
  return {
    ...validated,
    reviewRounds: normalizedReview.rounds
  };
}

export function validateStoredInsightRun(
  run,
  {
    catalog,
    config,
    dictionary,
    taxonomy
  }
) {
  if (
    !run ||
    typeof run !== "object" ||
    Array.isArray(run)
  ) {
    throw new Error("stored InsightRun must be an object");
  }
  const allowedFields = new Set([
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
  ]);
  const unknownFields = Object.keys(run).filter(
    (field) => !allowedFields.has(field)
  );
  if (unknownFields.length) {
    throw new Error(
      `stored InsightRun contains unsupported fields: ${unknownFields.join(", ")}`
    );
  }
  const status = String(run.status ?? "");
  if (!["accepted", "held", "no-change"].includes(status)) {
    throw new Error("stored InsightRun status is invalid");
  }
  const sourceIds = uniqueTextArray(
    run.sourceIds,
    "sourceIds",
    { required: true, maxItems: 9 }
  );
  const knownSources = new Set(
    config.sources.map((source) => source.id)
  );
  if (
    sourceIds.some(
      (sourceId) => !knownSources.has(sourceId)
    )
  ) {
    throw new Error(
      "stored InsightRun references an unknown source"
    );
  }
  const acceptedEntryIds = uniqueTextArray(
    run.acceptedEntryIds,
    "acceptedEntryIds",
    { maxItems: 50 }
  );
  const heldReasons = uniqueTextArray(
    run.heldReasons,
    "heldReasons",
    { maxItems: 50 }
  );
  const observedDictionaryRevision =
    Number(run.observedDictionaryRevision);
  if (
    !Number.isSafeInteger(
      observedDictionaryRevision
    ) ||
    observedDictionaryRevision < 0 ||
    observedDictionaryRevision >
      Number(dictionary.revision)
  ) {
    throw new Error(
      "stored InsightRun observed Dictionary revision is invalid"
    );
  }
  if (
    (status === "accepted") !==
    (acceptedEntryIds.length > 0)
  ) {
    throw new Error(
      "stored InsightRun accepted-entry scope is invalid"
    );
  }
  if (status !== "accepted" && !heldReasons.length) {
    throw new Error(
      "stored held/no-change InsightRun lacks a reason"
    );
  }
  const pins = Array.isArray(
    run.acceptedEntryRevisions
  )
    ? structuredClone(run.acceptedEntryRevisions)
    : [];
  if (
    pins.length !== acceptedEntryIds.length ||
    new Set(pins.map((pin) => pin.entryId)).size !==
      pins.length
  ) {
    throw new Error(
      "stored InsightRun revision pins do not exactly cover accepted entries"
    );
  }
  for (const entryId of acceptedEntryIds) {
    const current = dictionary.entries.find(
      (entry) => entry.entryId === entryId
    );
    if (!current) {
      throw new Error(
        `stored InsightRun references missing Dictionary entry ${entryId}`
      );
    }
    validateDictionaryRevisionChain(
      current,
      dictionary,
      catalog,
      taxonomy
    );
    const pin = pins.find(
      (candidate) => candidate.entryId === entryId
    );
    const revision = dictionary.revisions.find(
      (candidate) =>
        candidate.revisionId === pin.revisionId &&
        candidate.entryId === entryId
    );
    const dictionaryCommittedRevision =
      revision
        ? assertDictionaryRevisionCommit(
            {
              entryId,
              revisionId: revision.revisionId
            },
            dictionary,
            {
              observedRevision:
                observedDictionaryRevision
            }
          )
        : null;
    if (
      !revision ||
      revision.status !== "verified" ||
      stableJson(pin) !==
        stableJson(
          acceptedRevisionPin(
            revision,
            dictionaryCommittedRevision
          )
        )
    ) {
      throw new Error(
        `stored InsightRun has an invalid Dictionary revision pin for ${entryId}`
      );
    }
  }
  const candidateDecisions = Array.isArray(
    run.candidateDecisions
  )
    ? run.candidateDecisions.map(
        (decision, index) => ({
          candidateId: boundedText(
            decision.candidateId,
            `candidateDecisions[${index}].candidateId`,
            { required: true, maxLength: 180 }
          ),
          decision: boundedText(
            decision.decision,
            `candidateDecisions[${index}].decision`,
            { required: true, maxLength: 80 }
          ),
          reason: boundedText(
            decision.reason,
            `candidateDecisions[${index}].reason`,
            { required: true, maxLength: 1_500 }
          )
        })
      )
    : [];
  if (candidateDecisions.length > 100) {
    throw new Error(
      "stored InsightRun has too many candidate decisions"
    );
  }
  const query = boundedText(run.query, "query", {
    required: true,
    maxLength: 512
  });
  const queryFingerprint = sha256(
    normalizeSearchText(query)
  );
  if (run.queryFingerprint !== queryFingerprint) {
    throw new Error(
      "stored InsightRun query fingerprint is invalid"
    );
  }
  const semantic = {
    status,
    query,
    queryFingerprint,
    snapshotId: boundedText(
      run.snapshotId,
      "snapshotId",
      { required: true, maxLength: 180 }
    ),
    sourceIds,
    acceptedEntryIds,
    acceptedEntryRevisions: pins,
    observedDictionaryRevision:
      observedDictionaryRevision,
    heldReasons,
    candidateDecisions,
    notes: boundedText(run.notes, "notes", {
      maxLength: 3_000
    })
  };
  const rounds = validateReviewRounds(
    run.reviewRounds
  );
  const normalizedReview =
    normalizeReviewRoundsEvidence(rounds, {
      subjectType: "insight-run",
      payload:
        insightRunReviewSubjectPayload(semantic),
      field: "reviewRounds"
    }).rounds;
  const finalRound = normalizedReview[2];
  if (
    status === "accepted" &&
    (finalRound.score < 9.9 ||
      finalRound.p0 !== 0 ||
      finalRound.p1 !== 0)
  ) {
    throw new Error(
      "stored accepted InsightRun does not pass the 9.9 gate"
    );
  }
  const validated = {
    ...semantic,
    reviewRounds: normalizedReview
  };
  const requestHash = sha256(
    stableJson(validated)
  );
  const runId = `insight-run:${sha256(
    stableJson({
      requestHash,
      snapshotId: validated.snapshotId,
      status: validated.status
    })
  ).slice(0, 24)}`;
  const committedRevision =
    Number(run.committedRevision);
  if (
    !Number.isSafeInteger(committedRevision) ||
    committedRevision < 1
  ) {
    throw new Error(
      "stored InsightRun committed revision is invalid"
    );
  }
  const mutationRef = `insightRuns:${runId}`;
  const mutationFingerprint = sha256(
    stableJson({
      allowedMutationRefs: [mutationRef],
      expectedMutationRefs: [mutationRef],
      beforeRevision: committedRevision - 1,
      afterRevision: committedRevision,
      requestHash
    })
  );
  const expected = {
    ...validated,
    runId,
    requestHash,
    committedRevision,
    mutationFingerprint,
    allowedMutationRefs: [mutationRef],
    expectedMutationRefs: [mutationRef],
    createdAt: canonicalInstant(
      run.createdAt,
      "createdAt",
      { required: true }
    )
  };
  if (stableJson(run) !== stableJson(expected)) {
    throw new Error(
      "stored InsightRun immutable receipt is invalid"
    );
  }
  return expected;
}

export function validateInsightRunCommitLedger(ledger) {
  const revision = Number(ledger?.revision);
  const runs = Array.isArray(ledger?.runs)
    ? ledger.runs
    : [];
  const idempotency =
    ledger?.idempotency &&
    typeof ledger.idempotency === "object" &&
    !Array.isArray(ledger.idempotency)
      ? ledger.idempotency
      : {};
  if (
    !Number.isSafeInteger(revision) ||
    revision < 0
  ) {
    throw new Error(
      "InsightRun ledger revision must be a non-negative integer"
    );
  }
  const ledgerUpdatedAt = canonicalInstant(
    ledger?.updatedAt,
    "InsightRun ledger.updatedAt",
    { required: revision > 0 }
  );
  if (revision === 0 && ledgerUpdatedAt !== null) {
    throw new Error(
      "Empty InsightRun ledger.updatedAt must be null"
    );
  }
  for (const run of runs) {
    const createdAt = canonicalInstant(
      run?.createdAt,
      `InsightRun ${run?.runId ?? "(missing id)"}.createdAt`,
      { required: true }
    );
    if (
      ledgerUpdatedAt !== null &&
      Date.parse(createdAt) > Date.parse(ledgerUpdatedAt)
    ) {
      throw new Error(
        `InsightRun ${run?.runId ?? "(missing id)"} was created after ledger.updatedAt`
      );
    }
  }
  const receipts = Object.entries(idempotency);
  if (receipts.length !== revision) {
    throw new Error(
      "InsightRun commit ledger does not contain one receipt per revision"
    );
  }
  const positions = new Set();
  const owningPosition = new Map();
  for (const [key, receipt] of receipts) {
    const allowed = new Set([
      "inputHash",
      "requestHash",
      "runId",
      "committedRevision",
      "action"
    ]);
    const unknown = Object.keys(receipt ?? {}).filter(
      (field) => !allowed.has(field)
    );
    const target = runs.find(
      (run) => run.runId === receipt?.runId
    );
    const position = Number(receipt?.committedRevision);
    if (
      unknown.length ||
      !target ||
      !/^[a-f0-9]{64}$/u.test(
        String(receipt?.inputHash ?? "")
      ) ||
      receipt.requestHash !== target.requestHash ||
      !Number.isSafeInteger(position) ||
      position < 1 ||
      position > revision ||
      positions.has(position)
    ) {
      throw new Error(
        `InsightRun commit receipt ${key} is invalid`
      );
    }
    positions.add(position);
    if (receipt.action === undefined) {
      if (
        target.committedRevision !== position ||
        owningPosition.has(target.runId)
      ) {
        throw new Error(
          `InsightRun commit receipt ${key} does not uniquely own its run`
        );
      }
      owningPosition.set(target.runId, position);
    } else if (receipt.action !== "duplicate-content") {
      throw new Error(
        `InsightRun commit receipt ${key} has an unsupported action`
      );
    }
  }
  for (let position = 1; position <= revision; position += 1) {
    if (!positions.has(position)) {
      throw new Error(
        `InsightRun commit ledger is missing revision ${position}`
      );
    }
  }
  for (const run of runs) {
    if (!owningPosition.has(run.runId)) {
      throw new Error(
        `InsightRun ${run.runId} lacks a unique canonical commit receipt`
      );
    }
  }
  for (const [key, receipt] of receipts) {
    if (receipt.action !== "duplicate-content") {
      continue;
    }
    const originalPosition =
      owningPosition.get(receipt.runId);
    if (
      !originalPosition ||
      originalPosition >= receipt.committedRevision
    ) {
      throw new Error(
        `InsightRun duplicate receipt ${key} precedes its canonical commit`
      );
    }
  }
  return {
    revision,
    receiptCount: receipts.length
  };
}

export async function recordInsightRun(
  input,
  context,
  {
    idempotencyKey,
    expectedRevision
  } = {}
) {
  const key = boundedText(
    idempotencyKey,
    "idempotencyKey",
    { required: true, maxLength: 180 }
  );
  const inputHash = sha256(stableJson(input));
  return withMutationLease("insight-runs", async () => {
    const ledger = await loadInsightRuns();
    ledger.schemaVersion = 1;
    ledger.revision = Number(ledger.revision) || 0;
    ledger.runs = Array.isArray(ledger.runs)
      ? ledger.runs
      : [];
    ledger.idempotency =
      ledger.idempotency &&
      typeof ledger.idempotency === "object"
        ? ledger.idempotency
        : {};
    validateInsightRunCommitLedger(ledger);
    const prior = ledger.idempotency[key];
    if (prior) {
      if (prior.inputHash !== inputHash) {
        throw new Error(
          `Idempotency key ${key} was already used for another insight run`
        );
      }
      const replayRun = ledger.runs.find(
        (run) => run.runId === prior.runId
      );
      const validatedReplay = replayRun
        ? validateStoredInsightRun(
            replayRun,
            context
          )
        : null;
      if (
        !validatedReplay ||
        validatedReplay.requestHash !==
          prior.requestHash ||
        !Number.isSafeInteger(
          Number(prior.committedRevision)
        ) ||
        Number(prior.committedRevision) < 1 ||
        Number(prior.committedRevision) >
          ledger.revision
      ) {
        throw new Error(
          `Idempotency receipt ${key} does not resolve to a valid InsightRun`
        );
      }
      return {
        action: "noop",
        reason: "idempotent-replay",
        revision: ledger.revision,
        run: validatedReplay
      };
    }
    const validated = validateInsightRun(input, context);
    const requestHash = sha256(stableJson(validated));
    if (
      expectedRevision !== undefined &&
      Number(expectedRevision) !== ledger.revision
    ) {
      throw new Error(
        `Insight-run revision conflict: expected ${expectedRevision}, current ${ledger.revision}`
      );
    }
    if (
      Object.keys(ledger.idempotency).length >=
      MAX_IDEMPOTENCY_KEYS
    ) {
      throw new Error(
        `Insight-run idempotency-key limit reached (${MAX_IDEMPOTENCY_KEYS})`
      );
    }
    const duplicate = ledger.runs.find(
      (run) =>
        run.requestHash === requestHash ||
        run.runId ===
          `insight-run:${sha256(
            stableJson({
              requestHash,
              snapshotId: validated.snapshotId,
              status: validated.status
            })
          ).slice(0, 24)}`
    );
    if (duplicate) {
      const validatedDuplicate =
        validateStoredInsightRun(
          duplicate,
          context
        );
      const now = new Date().toISOString();
      ledger.idempotency[key] = {
        inputHash,
        requestHash,
        runId: validatedDuplicate.runId,
        committedRevision: ledger.revision + 1,
        action: "duplicate-content"
      };
      ledger.revision += 1;
      ledger.updatedAt = now;
      validateInsightRunCommitLedger(ledger);
      const serialized = `${JSON.stringify(
        ledger,
        null,
        2
      )}\n`;
      if (
        Buffer.byteLength(serialized, "utf8") >
        MAX_RUN_BYTES
      ) {
        throw new Error(
          `Insight-run ledger would exceed ${MAX_RUN_BYTES} bytes`
        );
      }
      await writeJson(insightRunsPath, ledger);
      return {
        action: "noop",
        reason: "duplicate-content",
        revision: ledger.revision,
        run: validatedDuplicate
      };
    }
    if (ledger.runs.length >= MAX_RUNS) {
      throw new Error(
        `Insight-run limit reached (${MAX_RUNS})`
      );
    }
    const now = new Date().toISOString();
    const runId = `insight-run:${sha256(
      stableJson({
        requestHash,
        snapshotId: validated.snapshotId,
        status: validated.status
      })
    ).slice(0, 24)}`;
    const committedRevision = ledger.revision + 1;
    const mutationFingerprint = sha256(
      stableJson({
        allowedMutationRefs: [`insightRuns:${runId}`],
        expectedMutationRefs: [`insightRuns:${runId}`],
        beforeRevision: ledger.revision,
        afterRevision: committedRevision,
        requestHash
      })
    );
    const run = {
      ...validated,
      runId,
      requestHash,
      committedRevision,
      mutationFingerprint,
      allowedMutationRefs: [`insightRuns:${runId}`],
      expectedMutationRefs: [`insightRuns:${runId}`],
      createdAt: now
    };
    ledger.runs.push(run);
    ledger.idempotency[key] = {
      inputHash,
      requestHash,
      runId,
      committedRevision: ledger.revision + 1
    };
    ledger.revision += 1;
    ledger.updatedAt = now;
    validateInsightRunCommitLedger(ledger);
    const serialized = `${JSON.stringify(ledger, null, 2)}\n`;
    if (
      Buffer.byteLength(serialized, "utf8") >
      MAX_RUN_BYTES
    ) {
      throw new Error(
        `Insight-run ledger would exceed ${MAX_RUN_BYTES} bytes`
      );
    }
    await writeJson(insightRunsPath, ledger);
    return {
      action: "created",
      revision: ledger.revision,
      run
    };
  });
}

export function listInsightRuns(
  ledger,
  {
    statuses,
    sourceIds,
    limit = 30
  } = {}
) {
  const statusSet = statuses?.length
    ? new Set(statuses)
    : null;
  const sourceSet = sourceIds?.length
    ? new Set(sourceIds)
    : null;
  return [...(ledger.runs ?? [])]
    .filter(
      (run) => !statusSet || statusSet.has(run.status)
    )
    .filter(
      (run) =>
        !sourceSet ||
        run.sourceIds.some((sourceId) =>
          sourceSet.has(sourceId)
        )
    )
    .sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    )
    .slice(
      0,
      Math.max(1, Math.min(Number(limit) || 30, 100))
    );
}
