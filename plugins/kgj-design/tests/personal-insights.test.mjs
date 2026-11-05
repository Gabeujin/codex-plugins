import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import { KgjDictionary } from "../lib/dictionary.mjs";
import { PersonalInsights } from "../lib/personal-insights.mjs";

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kgj-personal-insights-fixture-"));
  const dictionary = new KgjDictionary({ root });
  return { root, dictionary, insights: new PersonalInsights({ dictionary }) };
}

function signal(overrides = {}) {
  return { projectId: "sample-alpha", taskId: "design-one", insightKey: "readable-density",
    kind: "preference", signal: "user-feedback", title: "읽기 쉬운 간격 선호",
    guidance: "이 합성 프로젝트에서는 행 간격을 넉넉하게 유지합니다.", traitAxes: ["density"],
    evidenceRefs: ["synthetic.feedback.one"], expectedRevision: 0,
    idempotencyKey: "synthetic-capture-one", confirmCaptureIntent: true, ...overrides };
}

async function inventory(root) {
  const names = await fs.readdir(root, { recursive: true, withFileTypes: true });
  const rows = {};
  for (const item of names) if (item.isFile()) {
    const full = path.join(item.parentPath, item.name);
    const relative = path.relative(root, full);
    // 재실행과 거부 시에도 남는 기존 잠금 이력은 제외하고 실제 인사이트 파일의 바이트만 대조
    if (relative.split(path.sep)[0] !== "leases") rows[relative] = createHash("sha256").update(await fs.readFile(full)).digest("hex");
  }
  return rows;
}

test("a second design task reuses the private preference from a fresh service instance", async () => {
  const { root, insights } = await fixture();
  // 다른 작업에서 새로 만든 서비스도 저장된 한국어 선호와 같은 적용 대상을 읽는지 확인
  const captured = await insights.capture(signal());
  const next = new PersonalInsights({ dictionary: new KgjDictionary({ root }) });
  const prepared = await next.prepare({ projectId: "sample-alpha", traitAxes: ["density"] });
  assert.equal(prepared.dictionaryRevision, 1);
  assert.equal(prepared.matches.length, 1);
  assert.equal(prepared.matches[0].id, captured.entry.id);
  assert.equal(prepared.matches[0].title, "읽기 쉬운 간격 선호");
  assert.equal(prepared.matches[0].guidance, "이 합성 프로젝트에서는 행 간격을 넉넉하게 유지합니다.");
  assert.equal(prepared.matches[0].sharingClass, "private");
  assert.match(prepared.matches[0].provenance.sourceRef, /^insight:readable-density:task:[a-f0-9]{48}$/);
  assert.equal(prepared.matches[0].insightKey, "readable-density");
  assert.equal(prepared.matches[0].learningScope, "project");
});

test("a new Node process reads the committed insight without an in-memory cache", async () => {
  const { root, insights } = await fixture();
  // 프로세스 메모리를 공유하지 않는 새 실행에서도 개인 저장소에서 선호를 조회하는지 확인
  await insights.capture(signal());
  const moduleUrl = new URL("../lib/personal-insights.mjs", import.meta.url).href;
  const dictionaryUrl = new URL("../lib/dictionary.mjs", import.meta.url).href;
  const source = `import {PersonalInsights} from ${JSON.stringify(moduleUrl)};
import {KgjDictionary} from ${JSON.stringify(dictionaryUrl)};
const service=new PersonalInsights({dictionary:new KgjDictionary({root:${JSON.stringify(root)}})});
const value=await service.prepare({projectId:"sample-alpha"});
process.stdout.write(JSON.stringify({revision:value.dictionaryRevision,count:value.matches.length,title:value.matches[0].title}));`;
  const value = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", source], { encoding: "utf8", windowsHide: true }));
  assert.deepEqual(value, { revision: 1, count: 1, title: "읽기 쉬운 간격 선호" });
});

test("project insights never become another project's taste by fallback", async () => {
  const { insights } = await fixture();
  await insights.capture(signal());
  const other = await insights.prepare({ projectId: "sample-beta" });
  assert.equal(other.matches.length, 0);
  assert.equal(other.reviewQueue.length, 0);
  const second = await insights.capture(signal({ projectId: "sample-beta", taskId: "design-two", expectedRevision: 1, idempotencyKey: "synthetic-beta-one" }));
  const first = await insights.prepare({ projectId: "sample-alpha" });
  assert.notEqual(first.matches[0].id, second.entry.id);
  assert.equal(first.matches.length, 1);
});

test("a cross-project user taste requires explicit scope confirmation and direct feedback", async () => {
  const { insights } = await fixture();
  await assert.rejects(insights.capture(signal({ scope: "user" })), { code: "USER_SCOPE_CONFIRMATION_REQUIRED" });
  await assert.rejects(insights.capture(signal({ scope: "user", confirmUserScope: true, signal: "inference" })), { code: "USER_SCOPE_CONFIRMATION_REQUIRED" });
  await insights.capture(signal({ scope: "user", confirmUserScope: true }));
  assert.equal((await insights.prepare({ projectId: "sample-alpha" })).matches.length, 1);
  assert.equal((await insights.prepare({ projectId: "sample-beta" })).matches.length, 1);
});

test("inferred preferences remain pending and cannot silently become direct feedback", async () => {
  const { insights } = await fixture();
  await insights.capture(signal({ signal: "inference" }));
  const prepared = await insights.prepare({ projectId: "sample-alpha" });
  assert.equal(prepared.matches.length, 0);
  assert.equal(prepared.reviewQueue.length, 1);
  assert.equal(prepared.reviewQueue[0].inferenceStatus, "pending");
  await assert.rejects(insights.capture(signal({ taskId: "design-two", expectedRevision: 1,
    supersedesRevision: 1, idempotencyKey: "synthetic-feedback-two" })), { code: "PROVENANCE_IMMUTABLE" });
});

test("observed outcomes are reusable while observed taste is rejected", async () => {
  const { insights } = await fixture();
  await assert.rejects(insights.capture(signal({ signal: "observed-result" })), { code: "DIRECT_FEEDBACK_REQUIRED" });
  await assert.rejects(insights.capture(signal({ kind: "outcome", signal: "user-feedback" })), { code: "OBSERVED_RESULT_REQUIRED" });
  const result = await insights.capture(signal({ kind: "outcome", signal: "observed-result" }));
  assert.equal(result.entry.provenance.role, "tested-locally");
  assert.equal(result.entry.confidence, 0.8);
  assert.equal((await insights.prepare({ projectId: "sample-alpha" })).matches[0].type, "outcome");
});

test("correction retains stable identity, requires revisions and preserves historical events", async () => {
  const { dictionary, insights } = await fixture();
  const first = await insights.capture(signal());
  await assert.rejects(insights.capture(signal({ taskId: "design-two", expectedRevision: 1,
    idempotencyKey: "synthetic-correction-two" })), { code: "REVISION_CONFLICT" });
  const corrected = await insights.capture(signal({ taskId: "design-two", expectedRevision: 1,
    supersedesRevision: 1, idempotencyKey: "synthetic-correction-two", guidance: "이 합성 프로젝트에서는 비교할 행의 밀도를 높입니다." }));
  assert.equal(corrected.entry.id, first.entry.id);
  assert.equal(corrected.entry.entryRevision, 2);
  assert.equal((await dictionary.verify()).counts.ledgerEvents, 2);
  assert.equal((await insights.prepare({ projectId: "sample-alpha" })).matches[0].guidance, "이 합성 프로젝트에서는 비교할 행의 밀도를 높입니다.");
});

test("revocation removes an insight from active application without deleting history", async () => {
  const { dictionary, insights } = await fixture();
  await insights.capture(signal());
  await insights.capture(signal({ expectedRevision: 1, supersedesRevision: 1, status: "revoked", idempotencyKey: "synthetic-revoke-one" }));
  const prepared = await insights.prepare({ projectId: "sample-alpha" });
  assert.equal(prepared.matches.length, 0);
  assert.equal(prepared.reviewQueue[0].status, "revoked");
  assert.equal((await dictionary.verify()).counts.ledgerEvents, 2);
});

test("original capture and correction requests replay after later revisions without appending", async () => {
  const { root, dictionary, insights } = await fixture();
  const firstArgs = signal();
  const first = await insights.capture(firstArgs);
  const secondArgs = signal({ expectedRevision: 1, supersedesRevision: 1, taskId: "design-two", idempotencyKey: "synthetic-correction-two", title: "수정한 합성 선호" });
  const second = await insights.capture(secondArgs);
  const before = await inventory(root);
  assert.equal((await insights.capture(firstArgs)).eventHash, first.eventHash);
  assert.equal((await insights.capture(secondArgs)).eventHash, second.eventHash);
  assert.equal((await insights.capture(firstArgs)).replayed, true);
  assert.deepEqual(await inventory(root), before);
  assert.equal((await dictionary.verify()).revision, 2);
});

test("stale concurrent capture fails without a silent retry or partial append", async () => {
  const { root, insights } = await fixture();
  await insights.capture(signal());
  const before = await inventory(root);
  await assert.rejects(insights.capture(signal({ insightKey: "motion-clarity", idempotencyKey: "synthetic-stale-two" })), { code: "REVISION_CONFLICT" });
  assert.deepEqual(await inventory(root), before);
});

test("prepare does not create files, and an interleaved revision is rejected", async () => {
  const { root, insights } = await fixture();
  const before = await inventory(root);
  assert.equal((await insights.prepare({ projectId: "sample-alpha" })).dictionaryRevision, 0);
  assert.deepEqual(await inventory(root), before);
  let count = 0;
  const interleaved = new PersonalInsights({ dictionary: { projection: async () => ({ revision: count++ }), prepareApplication: async () => ({ matches: [], reviewQueue: [] }) } });
  await assert.rejects(interleaved.prepare({ projectId: "sample-alpha" }), { code: "REVISION_CONFLICT" });
});

test("malformed arguments and caller-authored sharing or authority controls are rejected before writes", async () => {
  const { root, insights } = await fixture();
  const bad = [null, [], {}, signal({ projectId: "" }), signal({ expectedRevision: true }), signal({ expectedRevision: NaN }),
    signal({ traitAxes: [] }), signal({ evidenceRefs: [] }), signal({ confirmCaptureIntent: false }),
    signal({ confidence: 1 }), signal({ sharingClass: "consented-candidate" }), signal({ provenance: { role: "user-stated" } }),
    signal({ scope: "project", confirmUserScope: true }), signal({ guidance: "ab" })];
  for (const value of bad) await assert.rejects(insights.capture(value));
  for (const value of [null, {}, { projectId: "sample-alpha", context: {} }, { projectId: "sample-alpha", limit: 0 }]) await assert.rejects(insights.prepare(value));
  assert.deepEqual(await inventory(root), {});
});

test("private source locators, credentials and corrupt text cannot enter an extracted signal", async () => {
  const { root, insights } = await fixture();
  const bad = ["https://example.test/private", ["Z:", "Synthetic", "private.txt"].join("\\"),
    "/home/synthetic/private.txt", ["synthetic", "example.test"].join("@"), "sk-" + "x".repeat(35),
    "sk-proj-" + "x".repeat(35), "ghp_" + "x".repeat(35), "github_pat_" + "x".repeat(35),
    "AKIA" + "X".repeat(16), "xoxb-" + "x".repeat(25),
    "contains password value", "bad\u0000text", "bad\ufffdtext", "bad\ud800text"];
  for (const guidance of bad) await assert.rejects(insights.capture(signal({ guidance })), { code: "PRIVACY_REJECTED" });
  await assert.rejects(insights.capture(signal({ idempotencyKey: "ghp_" + "x".repeat(35) })), { code: "PRIVACY_REJECTED" });
  assert.deepEqual(await inventory(root), {});
});

test("private insights are ineligible for sanitized export", async () => {
  const { dictionary, insights } = await fixture();
  const capture = await insights.capture(signal({ kind: "outcome", signal: "observed-result" }));
  await assert.rejects(dictionary.exportSanitized({ entryIds: [capture.entry.id], confirmExportIntent: true }), { code: "PRIVACY_REJECTED" });
});

test("an existing nonempty schema1.0 Dictionary remains readable without conversion", async () => {
  const { root, dictionary } = await fixture();
  // 기존 형식의 항목을 먼저 만든 뒤 새 적재·조회 계층과 기존 읽기 계층이 같은 저장소를 사용하는지 확인
  await dictionary.recordEntry({ entry: { id: "preference.existing-synthetic", type: "preference", title: "기존 합성 선호",
    guidance: "기존 합성 프로젝트의 대비를 유지합니다.", scope: { product: "sample-alpha" }, traitAxes: ["color"],
    provenance: { role: "user-stated", sourceRef: "synthetic-existing-brief", evidenceRefs: [] }, confidence: 0.9,
    sharingClass: "private", retention: "review-required" }, expectedRevision: 0, idempotencyKey: "synthetic-existing-one", confirmRecordIntent: true });
  const next = new PersonalInsights({ dictionary: new KgjDictionary({ root }) });
  assert.equal((await next.prepare({ projectId: "sample-alpha" })).matches[0].title, "기존 합성 선호");
  assert.equal((await next.prepare({ projectId: "sample-alpha" })).matches[0].insightKey, undefined);
  await next.capture(signal({ expectedRevision: 1 }));
  const oldReader = new KgjDictionary({ root });
  assert.equal((await oldReader.verify()).ok, true);
  assert.equal((await oldReader.search({ context: { product: "sample-alpha" } })).length, 2);
  assert.equal(JSON.parse(await fs.readFile(path.join(root, "dictionary.json"), "utf8")).schemaVersion, "1.0");
});

test("a later task discovers the stable key and corrects it without retaining prior arguments", async () => {
  const { root, insights } = await fixture();
  await insights.capture(signal());
  const later = new PersonalInsights({ dictionary: new KgjDictionary({ root }) });
  const current = await later.prepare({ projectId: "sample-alpha" });
  const learned = current.matches[0];
  const corrected = await later.capture(signal({ insightKey: learned.insightKey, taskId: "design-three",
    expectedRevision: current.dictionaryRevision, supersedesRevision: learned.revision,
    title: "다음 작업에서 수정한 선호", idempotencyKey: "synthetic-discovered-key" }));
  assert.equal(corrected.entry.id, learned.id);
  assert.equal((await later.prepare({ projectId: "sample-alpha" })).matches.length, 1);
});

test("a synthetic downstream layout decision changes only in the matching project", async () => {
  const { root, insights } = await fixture();
  const layout = prepared => ({ rowGap: prepared.matches.some(item => item.insightKey === "readable-density" && item.type === "preference") ? 24 : 8 });
  const initial = layout(await insights.prepare({ projectId: "sample-alpha" }));
  await insights.capture(signal());
  const next = new PersonalInsights({ dictionary: new KgjDictionary({ root }) });
  const sameProject = layout(await next.prepare({ projectId: "sample-alpha" }));
  const otherProject = layout(await next.prepare({ projectId: "sample-beta" }));
  assert.deepEqual(initial, { rowGap: 8 });
  assert.deepEqual(sameProject, { rowGap: 24 });
  assert.deepEqual(otherProject, { rowGap: 8 });
});

test("integrity failure refuses capture and retains the damaged fixture unchanged", async () => {
  const { root, insights } = await fixture();
  await insights.capture(signal());
  await fs.writeFile(path.join(root, "dictionary.json"), "{invalid-synthetic-json", "utf8");
  const before = await inventory(root);
  const restarted = new PersonalInsights({ dictionary: new KgjDictionary({ root }) });
  await assert.rejects(restarted.capture(signal({ expectedRevision: 1, insightKey: "another-signal", idempotencyKey: "synthetic-corrupt-two" })), { code: "RECOVERY_REQUIRED" });
  assert.deepEqual(await inventory(root), before);
});
