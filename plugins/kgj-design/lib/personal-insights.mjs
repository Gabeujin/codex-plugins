import { hashObject, sha256 } from "./integrity.mjs";
import { validateJsonSchema } from "./json-schema-lite.mjs";

const opaqueId = { type: "string", minLength: 3, maxLength: 64, pattern: "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$" };
const axes = ["density", "hierarchy", "typography", "color", "shape", "depth", "motion", "imagery", "voice", "data", "interaction", "spatial-composition"];
const traitList = { type: "array", minItems: 1, maxItems: 12, uniqueItems: true, items: { enum: axes } };
const revision = { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER };

export const captureSchema = {
  type: "object", additionalProperties: false,
  required: ["projectId", "taskId", "insightKey", "kind", "signal", "title", "guidance", "traitAxes", "evidenceRefs", "expectedRevision", "idempotencyKey", "confirmCaptureIntent"],
  properties: {
    projectId: opaqueId, taskId: opaqueId, insightKey: opaqueId,
    kind: { enum: ["preference", "rejection", "observation", "outcome"] },
    signal: { enum: ["user-feedback", "observed-result", "inference"] },
    title: { type: "string", minLength: 3, maxLength: 120 },
    guidance: { type: "string", minLength: 3, maxLength: 600 },
    traitAxes: traitList,
    evidenceRefs: { type: "array", minItems: 1, maxItems: 12, uniqueItems: true,
      items: { type: "string", minLength: 3, maxLength: 120, pattern: "^[a-zA-Z0-9][a-zA-Z0-9._:-]*$" } },
    expectedRevision: revision,
    idempotencyKey: { type: "string", minLength: 8, maxLength: 200, pattern: "^[A-Za-z0-9._:-]+$" },
    confirmCaptureIntent: { const: true },
    scope: { enum: ["project", "user"] },
    confirmUserScope: { type: "boolean" },
    supersedesRevision: { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
    status: { enum: ["active", "revoked"] }
  }
};

export const prepareSchema = {
  type: "object", additionalProperties: false, required: ["projectId"],
  properties: {
    projectId: opaqueId,
    traitAxes: { ...traitList, minItems: 0 },
    limit: { type: "integer", minimum: 1, maximum: 50 }
  }
};

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function validate(args, schema) {
  try {
    validateJsonSchema(args, schema);
  } catch {
    fail("INVALID_TOOL_ARGUMENTS");
  }
}

function privateSignalText(value) {
  const corrupt = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD\uD800-\uDFFF]/u;
  const personal = /(?:[A-Z]:[\\/]|\\\\[^\\]+\\|https?:\/\/|\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b|(?:^|\s)\/(?:[\w.-]+\/)+)/i;
  const credential = /(?:password|secret|api[_ -]?key|access[_ -]?token|-----BEGIN .*PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{20,})/i;
  if (corrupt.test(value) || personal.test(value) || credential.test(value)) fail("PRIVACY_REJECTED");
}

function explainInsight(entry) {
  const match = /^insight:([a-z][a-z0-9]*(?:-[a-z0-9]+)*):task:[a-f0-9]{48}$/.exec(entry.provenance?.sourceRef ?? "");
  if (!match || !entry.id?.startsWith("insight.")) return entry;
  const scopeKeys = Object.keys(entry.scope ?? {});
  const learningScope = scopeKeys.length === 0 ? "user" : scopeKeys.length === 1 && scopeKeys[0] === "product" ? "project" : null;
  if (!learningScope) return entry;
  const identity = { scope: learningScope, projectId: learningScope === "user" ? null : entry.scope.product, insightKey: match[1] };
  if (entry.id !== `insight.${hashObject(identity).slice(0, 48)}`) return entry;
  return { ...entry, insightKey: match[1], learningScope };
}

export class PersonalInsights {
  constructor({ dictionary }) {
    this.dictionary = dictionary;
  }

  async capture(args) {
    validate(args, captureSchema);
    // 추정이나 관찰 결과를 사용자가 직접 밝힌 취향으로 승격하지 않도록 신호와 범위를 함께 검사
    const userScope = args.scope === "user";
    const taste = args.kind === "preference" || args.kind === "rejection";
    if (args.signal === "observed-result" && taste) fail("DIRECT_FEEDBACK_REQUIRED");
    if (args.kind === "outcome" && args.signal === "user-feedback") fail("OBSERVED_RESULT_REQUIRED");
    if (userScope && !(args.confirmUserScope === true && args.signal === "user-feedback" && taste)) fail("USER_SCOPE_CONFIRMATION_REQUIRED");
    if (!userScope && args.confirmUserScope === true) fail("USER_SCOPE_CONFIRMATION_REQUIRED");
    for (const value of [args.projectId, args.taskId, args.insightKey, args.idempotencyKey, args.title, args.guidance, ...args.evidenceRefs]) privateSignalText(value);
    const identity = { scope: userScope ? "user" : "project", projectId: userScope ? null : args.projectId, insightKey: args.insightKey };
    const role = { "user-feedback": "user-stated", "observed-result": "tested-locally", inference: "inferred" }[args.signal];
    const entry = {
      id: `insight.${hashObject(identity).slice(0, 48)}`,
      type: args.kind,
      title: args.title,
      guidance: args.guidance,
      scope: userScope ? {} : { product: args.projectId },
      traitAxes: args.traitAxes,
      provenance: { role, sourceRef: `insight:${args.insightKey}:task:${sha256(args.taskId).slice(0, 48)}`, evidenceRefs: args.evidenceRefs },
      confidence: { "user-feedback": 0.95, "observed-result": 0.8, inference: 0.5 }[args.signal],
      status: args.status ?? "active",
      sharingClass: "private",
      retention: "review-required",
      supersedesRevision: args.supersedesRevision ?? null
    };
    // 재실행 때 최신 revision을 임의로 채우지 않고 최초 요청을 그대로 전달해 중복 기록과 덮어쓰기를 방지
    return this.dictionary.recordEntry({ entry, expectedRevision: args.expectedRevision,
      idempotencyKey: args.idempotencyKey, confirmRecordIntent: args.confirmCaptureIntent });
  }

  async prepare(args) {
    validate(args, prepareSchema);
    // 검색 도중 다른 기록이 추가되면 그 결과를 새 기록의 기준 revision으로 사용하지 않도록 거부
    const before = await this.dictionary.projection();
    const application = await this.dictionary.prepareApplication({ context: { product: args.projectId },
      traitAxes: args.traitAxes ?? [], limit: args.limit ?? 20 });
    const after = await this.dictionary.projection();
    if (before.revision !== after.revision) fail("REVISION_CONFLICT");
    return { ...application, matches: application.matches.map(explainInsight),
      reviewQueue: application.reviewQueue.map(explainInsight), dictionaryRevision: after.revision };
  }
}
