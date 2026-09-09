import {
  stableJson
} from "./integrity.mjs";
import { sha256 } from "./text.mjs";

const MAX_REVIEW_ARTIFACT_BYTES = 100_000;
export const PUBLIC_REVIEW_EVIDENCE_MODE =
  "content-withheld-public-projection";
const allowedArtifactKinds = new Set([
  "command-output",
  "review-report",
  "test-report",
  "source-scan"
]);

function boundedText(value, field, maxLength) {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new Error(`${field} is required`);
  }
  if (text.length > maxLength) {
    throw new Error(
      `${field} must be at most ${maxLength} characters`
    );
  }
  return text;
}

function exactContent(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} must contain review artifact text`);
  }
  const contentBytes = Buffer.byteLength(value, "utf8");
  if (
    contentBytes < 1 ||
    contentBytes > MAX_REVIEW_ARTIFACT_BYTES
  ) {
    throw new Error(
      `${field} must be 1 to ${MAX_REVIEW_ARTIFACT_BYTES} UTF-8 bytes`
    );
  }
  return value;
}

export function reviewSubjectHash(subjectType, payload) {
  return sha256(
    stableJson({
      schemaVersion: 1,
      subjectType: boundedText(
        subjectType,
        "review subject type",
        80
      ),
      payload
    })
  );
}

function materializeArtifact({
  kind,
  content,
  subjectHash,
  round
}) {
  const envelope = {
    schemaVersion: 1,
    subjectHash,
    round,
    kind,
    content
  };
  const serialized = stableJson(envelope);
  const digest = sha256(serialized);
  return {
    artifactId: `review-artifact:${digest}`,
    kind,
    sha256: digest,
    bytes: Buffer.byteLength(serialized, "utf8"),
    subjectHash,
    round,
    content
  };
}

export function normalizeReviewEvidenceRefs(
  value,
  field,
  {
    subjectHash,
    round
  } = {}
) {
  if (!/^[a-f0-9]{64}$/u.test(String(subjectHash ?? ""))) {
    throw new Error(
      `${field} requires a computed review subject hash`
    );
  }
  if (
    !Number.isInteger(round) ||
    round < 1 ||
    round > 3
  ) {
    throw new Error(
      `${field} requires review round 1, 2, or 3`
    );
  }
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 5
  ) {
    throw new Error(
      `${field} must contain 1 to 5 content-addressed review artifacts`
    );
  }
  const normalized = value.map((item, index) => {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      throw new Error(
        `${field}[${index}] must be an object`
      );
    }
    const unknown = Object.keys(item).filter(
      (key) =>
        ![
          "artifactId",
          "kind",
          "sha256",
          "bytes",
          "subjectHash",
          "round",
          "content"
        ].includes(key)
    );
    if (unknown.length) {
      throw new Error(
        `${field}[${index}] contains unsupported fields: ${unknown.join(", ")}`
      );
    }
    const kind = boundedText(
      item.kind,
      `${field}[${index}].kind`,
      40
    );
    if (!allowedArtifactKinds.has(kind)) {
      throw new Error(
        `${field}[${index}].kind is unsupported`
      );
    }
    const content = exactContent(
      item.content,
      `${field}[${index}].content`
    );
    const expected = materializeArtifact({
      kind,
      content,
      subjectHash,
      round
    });
    for (const key of [
      "artifactId",
      "sha256",
      "bytes",
      "subjectHash",
      "round"
    ]) {
      if (
        item[key] !== undefined &&
        item[key] !== expected[key]
      ) {
        throw new Error(
          `${field}[${index}].${key} does not match the canonical review artifact`
        );
      }
    }
    return expected;
  });
  if (
    new Set(
      normalized.map((item) => item.sha256)
    ).size !== normalized.length
  ) {
    throw new Error(
      `${field} must not reuse the same review artifact`
    );
  }
  return normalized;
}

export function projectPublicReviewEvidenceRefs(value) {
  if (!Array.isArray(value)) {
    throw new Error(
      "Local review evidence must be an array before public projection"
    );
  }
  return value.map((item, index) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.content !== "string"
    ) {
      throw new Error(
        `Local review evidence[${index}] is not materialized`
      );
    }
    return {
      artifactId: item.artifactId,
      kind: item.kind,
      sha256: item.sha256,
      bytes: item.bytes,
      subjectHash: item.subjectHash,
      round: item.round,
      contentWithheld: true
    };
  });
}

export function normalizePublicReviewEvidenceRefs(
  value,
  field,
  {
    subjectHash,
    round
  } = {}
) {
  if (!/^[a-f0-9]{64}$/u.test(String(subjectHash ?? ""))) {
    throw new Error(
      `${field} requires a computed review subject hash`
    );
  }
  if (
    !Number.isInteger(round) ||
    round < 1 ||
    round > 3
  ) {
    throw new Error(
      `${field} requires review round 1, 2, or 3`
    );
  }
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 5
  ) {
    throw new Error(
      `${field} must contain 1 to 5 public review receipts`
    );
  }
  const normalized = value.map((item, index) => {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      throw new Error(
        `${field}[${index}] must be an object`
      );
    }
    const expectedFields = [
      "artifactId",
      "kind",
      "sha256",
      "bytes",
      "subjectHash",
      "round",
      "contentWithheld"
    ].sort();
    if (
      stableJson(Object.keys(item).sort()) !==
      stableJson(expectedFields)
    ) {
      throw new Error(
        `${field}[${index}] must be an exact content-withheld public receipt`
      );
    }
    const kind = boundedText(
      item.kind,
      `${field}[${index}].kind`,
      40
    );
    if (!allowedArtifactKinds.has(kind)) {
      throw new Error(
        `${field}[${index}].kind is unsupported`
      );
    }
    const digest = String(item.sha256 ?? "");
    if (
      !/^[a-f0-9]{64}$/u.test(digest) ||
      item.artifactId !==
        `review-artifact:${digest}` ||
      !Number.isInteger(item.bytes) ||
      item.bytes < 1 ||
      item.bytes > MAX_REVIEW_ARTIFACT_BYTES * 2 ||
      item.subjectHash !== subjectHash ||
      item.round !== round ||
      item.contentWithheld !== true
    ) {
      throw new Error(
        `${field}[${index}] is not a valid content-withheld public receipt`
      );
    }
    return {
      artifactId: item.artifactId,
      kind,
      sha256: digest,
      bytes: item.bytes,
      subjectHash,
      round,
      contentWithheld: true
    };
  });
  if (
    new Set(
      normalized.map((item) => item.sha256)
    ).size !== normalized.length
  ) {
    throw new Error(
      `${field} must not reuse the same public review receipt`
    );
  }
  return normalized;
}

export function normalizeReviewRoundsEvidence(
  rounds,
  {
    subjectType,
    payload,
    field = "reviewRounds"
  }
) {
  const subjectHash = reviewSubjectHash(
    subjectType,
    payload
  );
  const seenArtifacts = new Set();
  const normalized = rounds.map((round, index) => {
    const evidenceRefs = normalizeReviewEvidenceRefs(
      round.evidenceRefs,
      `${field}[${index}].evidenceRefs`,
      {
        subjectHash,
        round: index + 1
      }
    );
    for (const evidence of evidenceRefs) {
      if (seenArtifacts.has(evidence.sha256)) {
        throw new Error(
          `${field} cannot reuse one review artifact across rounds`
        );
      }
      seenArtifacts.add(evidence.sha256);
    }
    return {
      ...round,
      evidenceRefs
    };
  });
  return {
    subjectHash,
    rounds: normalized
  };
}

export function hasVerifiableReviewEvidence(
  round,
  {
    subjectHash,
    roundNumber
  }
) {
  try {
    return (
      String(round?.summary ?? "").trim().length > 0 &&
      normalizeReviewEvidenceRefs(
        round?.evidenceRefs,
        "review evidence",
        {
          subjectHash,
          round: roundNumber
        }
      ).length > 0
    );
  } catch {
    return false;
  }
}

export function hasPublicReviewEvidenceReceipts(
  round,
  {
    subjectHash,
    roundNumber
  }
) {
  try {
    return (
      String(round?.summary ?? "").trim().length > 0 &&
      normalizePublicReviewEvidenceRefs(
        round?.evidenceRefs,
        "public review evidence",
        {
          subjectHash,
          round: roundNumber
        }
      ).length > 0
    );
  } catch {
    return false;
  }
}

export const reviewEvidenceInputSchema = {
  type: "object",
  required: ["kind", "content"],
  properties: {
    kind: {
      type: "string",
      enum: [...allowedArtifactKinds]
    },
    content: {
      type: "string",
      minLength: 1,
      maxLength: MAX_REVIEW_ARTIFACT_BYTES
    }
  },
  additionalProperties: false
};

export const reviewEvidenceRefSchema = {
  type: "object",
  required: [
    "artifactId",
    "kind",
    "sha256",
    "bytes",
    "subjectHash",
    "round",
    "content"
  ],
  properties: {
    artifactId: {
      type: "string",
      pattern: "^review-artifact:[a-f0-9]{64}$"
    },
    kind: {
      type: "string",
      enum: [...allowedArtifactKinds]
    },
    sha256: {
      type: "string",
      pattern: "^[a-f0-9]{64}$"
    },
    bytes: {
      type: "integer",
      minimum: 1,
      maximum: MAX_REVIEW_ARTIFACT_BYTES * 2
    },
    subjectHash: {
      type: "string",
      pattern: "^[a-f0-9]{64}$"
    },
    round: {
      type: "integer",
      minimum: 1,
      maximum: 3
    },
    content: {
      type: "string",
      minLength: 1,
      maxLength: MAX_REVIEW_ARTIFACT_BYTES
    }
  },
  additionalProperties: false
};

export const publicReviewEvidenceRefSchema = {
  type: "object",
  required: [
    "artifactId",
    "kind",
    "sha256",
    "bytes",
    "subjectHash",
    "round",
    "contentWithheld"
  ],
  properties: {
    artifactId: {
      type: "string",
      pattern: "^review-artifact:[a-f0-9]{64}$"
    },
    kind: {
      type: "string",
      enum: [...allowedArtifactKinds]
    },
    sha256: {
      type: "string",
      pattern: "^[a-f0-9]{64}$"
    },
    bytes: {
      type: "integer",
      minimum: 1,
      maximum: MAX_REVIEW_ARTIFACT_BYTES * 2
    },
    subjectHash: {
      type: "string",
      pattern: "^[a-f0-9]{64}$"
    },
    round: {
      type: "integer",
      minimum: 1,
      maximum: 3
    },
    contentWithheld: {
      type: "boolean",
      const: true
    }
  },
  additionalProperties: false
};

export const reviewEvidenceOutputRefSchema = {
  oneOf: [
    reviewEvidenceRefSchema,
    publicReviewEvidenceRefSchema
  ]
};
