import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { KgjDictionary } from "../lib/dictionary.mjs";
import { sha256 } from "../lib/integrity.mjs";
import { KgjMcpRuntime } from "../mcp/runtime.mjs";

async function testRoot(label) {
  return fs.mkdtemp(path.join(os.tmpdir(), `kgj-design-${label}-`));
}

function entry(overrides = {}) {
  return {
    id: "preference.compact-operations",
    type: "preference",
    title: "Compact operational scanning",
    guidance: "Use compact rows when experienced operators compare many live states.",
    scope: { domain: "operations", surface: "console" },
    traitAxes: ["density", "hierarchy"],
    provenance: { role: "user-stated", sourceRef: "explicit-design-brief-v1", evidenceRefs: [] },
    confidence: 0.9,
    sharingClass: "private",
    retention: "review-required",
    ...overrides
  };
}

function exportConsent(grantId) {
  return {
    grantId,
    purpose: "cross-user-candidate-export",
    policyVersion: "1.0",
    grantedAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    status: "granted"
  };
}

async function evidenceRegistry(root, productId, ids = ["browser-evidence-001"]) {
  const evidenceRoot = path.join(root, "evidence-fixture");
  await fs.mkdir(evidenceRoot, { recursive: true });
  const records = [];
  for (const id of ids) {
    const artifact = `${id}.json`;
    const body = `${JSON.stringify({ id, result: "pass" }, null, 2)}\n`;
    await fs.writeFile(path.join(evidenceRoot, artifact), body, "utf8");
    records.push({
      id,
      kind: "verification",
      proofLevel: "runtime",
      status: "active",
      locator: `evidence-fixture/${artifact}`,
      sha256: sha256(body),
      capturedAt: new Date().toISOString(),
      supersedes: null,
      limitations: [],
      action: "Execute the bounded test fixture.",
      result: "pass",
      exitStatus: 0,
      postCondition: "The expected fixture state was observed.",
      environment: { runtime: process.version, browser: null, browserVersion: null, viewport: null },
      claims: ["behavior-preservation"],
      coverage: ["dictionary-integrity"],
      findingRefs: [],
      attestation: {
        issuer: "kgj-test-runner",
        method: "command",
        startedAt: new Date(Date.now() - 1000).toISOString(),
        completedAt: new Date().toISOString(),
        toolVersion: "1.2.0",
        transcriptSha256: sha256(`transcript:${id}`)
      }
    });
  }
  const registryPath = path.join(root, "evidence-registry.json");
  await fs.writeFile(registryPath, `${JSON.stringify({ schemaVersion: "1.1", productId, records }, null, 2)}\n`, "utf8");
  return registryPath;
}

test("records explicit revisioned entries, preserves idempotency, and verifies integrity", async () => {
  const dictionary = new KgjDictionary({ root: await testRoot("ledger") });
  await assert.rejects(
    dictionary.recordEntry({ entry: entry(), expectedRevision: 0, idempotencyKey: "request-ledger-001" }),
    (error) => error.code === "CONFIRMATION_REQUIRED"
  );
  const first = await dictionary.recordEntry({
    entry: entry(), expectedRevision: 0, idempotencyKey: "request-ledger-001", confirmRecordIntent: true
  });
  assert.equal(first.revision, 1);
  assert.equal(first.replayed, false);
  const replay = await dictionary.recordEntry({
    entry: entry(), expectedRevision: 0, idempotencyKey: "request-ledger-001", confirmRecordIntent: true
  });
  assert.equal(replay.replayed, true);
  assert.equal(replay.eventHash, first.eventHash);
  const idempotency = JSON.parse(await fs.readFile(path.join(dictionary.root, "idempotency.json"), "utf8"));
  assert.equal("request-ledger-001" in idempotency.requests, false);
  assert.equal(Object.keys(idempotency.requests).every((key) => /^[a-f0-9]{64}$/.test(key)), true);
  await assert.rejects(
    dictionary.recordEntry({ entry: entry({ title: "A conflicting request" }), expectedRevision: 1, idempotencyKey: "request-ledger-001", confirmRecordIntent: true }),
    (error) => error.code === "IDEMPOTENCY_CONFLICT"
  );
  const verification = await dictionary.verify();
  assert.equal(verification.ok, true, verification.issues.join("\n"));
  assert.equal(verification.revision, 1);
  assert.equal(verification.counts.ledgerEvents, 1);
});

test("resolves local rejection above preference while keeping the conflict visible", async () => {
  const dictionary = new KgjDictionary({ root: await testRoot("resolution") });
  await dictionary.recordEntry({ entry: entry(), expectedRevision: 0, idempotencyKey: "request-resolution-001", confirmRecordIntent: true });
  await dictionary.recordEntry({
    entry: entry({
      id: "rejection.color-only-status",
      type: "rejection",
      title: "Reject color-only status",
      guidance: "Do not encode operational state with color alone; pair it with text and shape.",
      traitAxes: ["color", "interaction"],
      confidence: 1
    }),
    expectedRevision: 1,
    idempotencyKey: "request-resolution-002",
    confirmRecordIntent: true
  });
  await dictionary.recordEntry({
    entry: entry({
      id: "preference.accent-status",
      title: "Prefer strong status accents",
      guidance: "Use a high-contrast accent to make live states quickly scannable.",
      traitAxes: ["color"],
      confidence: 0.95
    }),
    expectedRevision: 2,
    idempotencyKey: "request-resolution-003",
    confirmRecordIntent: true
  });
  const prepared = await dictionary.prepareApplication({ context: { domain: "operations", surface: "console" }, traitAxes: ["color"] });
  assert.equal(prepared.matches[0].type, "rejection");
  assert.equal(prepared.conflicts.length, 1);
  assert.equal(prepared.portableIdentityClaim, false);
});

test("exports only explicitly consented sanitized candidates", async () => {
  const dictionary = new KgjDictionary({ root: await testRoot("export") });
  await dictionary.recordEntry({ entry: entry(), expectedRevision: 0, idempotencyKey: "request-export-private", confirmRecordIntent: true });
  await assert.rejects(
    dictionary.exportSanitized({ entryIds: ["preference.compact-operations"], confirmExportIntent: true }),
    (error) => error.code === "PRIVACY_REJECTED"
  );
  await dictionary.recordEntry({
    entry: entry({
      id: "candidate.explain-impact-first",
      type: "candidate-pattern",
      title: "Kim Giljun review pattern",
      guidance: "Kim Giljun prefers impact context before a visual treatment is proposed.",
      scope: {},
      traitAxes: ["hierarchy", "voice"],
      provenance: { role: "official-source", sourceRef: "kgj-source-record-v1", evidenceRefs: ["official-system-criteria"] },
      confidence: 0.82,
      sharingClass: "consented-candidate",
      portablePrinciples: ["surface-evidence-boundary"],
      consent: exportConsent("consent-export-candidate-001")
    }),
    expectedRevision: 1,
    idempotencyKey: "request-export-candidate",
    confirmRecordIntent: true
  });
  const exported = await dictionary.exportSanitized({ entryIds: ["candidate.explain-impact-first"], confirmExportIntent: true });
  assert.equal(exported.payload.patterns.length, 1);
  assert.equal("title" in exported.payload.patterns[0], false);
  assert.equal("guidance" in exported.payload.patterns[0], false);
  assert.equal("committedAt" in exported.payload.patterns[0], false);
  assert.equal(JSON.stringify(exported).includes("Kim Giljun"), false);
  assert.notEqual(exported.payload.patterns[0].candidateId, "candidate.explain-impact-first");
  assert.match(exported.warning, /cannot become another user's rule/i);
});

test("sanitized export rejects unnormalized scope locators and missing consent", async () => {
  const dictionary = new KgjDictionary({ root: await testRoot("privacy") });
  await assert.rejects(
    dictionary.recordEntry({
      entry: entry({ id: "candidate.no-consent", type: "candidate-pattern", sharingClass: "consented-candidate", portablePrinciples: ["surface-evidence-boundary"] }),
      expectedRevision: 0,
      idempotencyKey: "request-privacy-no-consent",
      confirmRecordIntent: true
    }),
    (error) => error.code === "PRIVACY_REJECTED"
  );
  await dictionary.recordEntry({
    entry: entry({
      id: "candidate.private-locator",
      type: "candidate-pattern",
      scope: { domain: "C:\\Users\\named-user\\private-project" },
      sharingClass: "consented-candidate",
      portablePrinciples: ["surface-evidence-boundary"],
      consent: exportConsent("consent-private-locator-001")
    }),
    expectedRevision: 0,
    idempotencyKey: "request-private-locator-001",
    confirmRecordIntent: true
  });
  await assert.rejects(
    dictionary.exportSanitized({ entryIds: ["candidate.private-locator"], confirmExportIntent: true }),
    (error) => error.code === "PRIVACY_REJECTED"
  );
});

test("expired, invalid, and revoked consent paths fail closed", async () => {
  const dictionary = new KgjDictionary({ root: await testRoot("revocation") });
  const invalidConsent = exportConsent("consent-invalid-window-001");
  invalidConsent.expiresAt = invalidConsent.grantedAt;
  await assert.rejects(
    dictionary.recordEntry({
      entry: entry({ id: "candidate.invalid-window", type: "candidate-pattern", sharingClass: "consented-candidate", portablePrinciples: ["surface-evidence-boundary"], consent: invalidConsent }),
      expectedRevision: 0,
      idempotencyKey: "request-invalid-window-001",
      confirmRecordIntent: true
    }),
    (error) => error.code === "PRIVACY_REJECTED"
  );
  const active = entry({
    id: "candidate.revoked-pattern",
    type: "candidate-pattern",
    sharingClass: "consented-candidate",
    portablePrinciples: ["surface-evidence-boundary"],
    consent: exportConsent("consent-revoked-pattern-001")
  });
  await dictionary.recordEntry({ entry: active, expectedRevision: 0, idempotencyKey: "request-revoked-pattern-001", confirmRecordIntent: true });
  await dictionary.recordEntry({
    entry: { ...active, status: "revoked", supersedesRevision: 1 },
    expectedRevision: 1,
    idempotencyKey: "request-revoked-pattern-002",
    confirmRecordIntent: true
  });
  await assert.rejects(
    dictionary.exportSanitized({ entryIds: ["candidate.revoked-pattern"], confirmExportIntent: true }),
    (error) => error.code === "PRIVACY_REJECTED"
  );
});

test("semantic replay detects projection drift and explicit recovery rebuilds it", async () => {
  const dictionary = new KgjDictionary({ root: await testRoot("recovery") });
  await dictionary.recordEntry({ entry: entry(), expectedRevision: 0, idempotencyKey: "request-recovery-001", confirmRecordIntent: true });
  await fs.writeFile(path.join(dictionary.root, "dictionary.json"), `${JSON.stringify({ schemaVersion: "1.0", revision: 0, entries: {} }, null, 2)}\n`, "utf8");
  const broken = await dictionary.verify();
  assert.equal(broken.ok, false);
  assert.equal(broken.issues.some((issue) => /replayed ledger projection/.test(issue)), true);
  await assert.rejects(
    dictionary.recordEntry({ entry: entry({ id: "preference.blocked-by-corruption" }), expectedRevision: 0, idempotencyKey: "request-recovery-blocked-001", confirmRecordIntent: true }),
    (error) => error.code === "RECOVERY_REQUIRED"
  );
  const recovered = await dictionary.recover({ confirmRecoveryIntent: true });
  assert.equal(recovered.revision, 1);
  const verified = await dictionary.verify();
  assert.equal(verified.ok, true, verified.issues.join("\n"));
});

test("run receipts use a closed schema and are linked into integrity", async () => {
  const dictionary = new KgjDictionary({ root: await testRoot("runs") });
  const registryPath = await evidenceRegistry(dictionary.root, "kgj-design");
  await assert.rejects(
    dictionary.recordRun({ run: { runId: "bad-run" }, idempotencyKey: "request-bad-run-001", confirmRecordIntent: true }),
    /run\.productId is required/
  );
  const result = await dictionary.recordRun({
    run: {
      runId: "quality-run-001",
      productId: "kgj-design",
      phenotype: "demo",
      dictionaryRevision: 0,
      appliedEntryIds: [],
      rejectedEntryIds: [],
      result: "pass",
      evidenceRefs: ["browser-evidence-001"]
    },
    evidenceRegistryPath: registryPath,
    idempotencyKey: "request-quality-run-001",
    confirmRecordIntent: true
  });
  assert.equal(result.receipt.result, "pass");
  assert.match(result.receipt.projectionHash, /^[a-f0-9]{64}$/);
  assert.match(result.receipt.evidenceRegistryHash, /^[a-f0-9]{64}$/);
  const verified = await dictionary.verify();
  assert.equal(verified.ok, true, verified.issues.join("\n"));
});

test("design runs reject stale revisions, unknown or non-binding entries, and tampered evidence", async () => {
  const dictionary = new KgjDictionary({ root: await testRoot("run-refs") });
  await dictionary.recordEntry({ entry: entry(), expectedRevision: 0, idempotencyKey: "request-run-entry-001", confirmRecordIntent: true });
  const registryPath = await evidenceRegistry(dictionary.root, "kgj-design");
  const baseRun = {
    runId: "quality-run-ref-001",
    productId: "kgj-design",
    phenotype: "demo",
    dictionaryRevision: 1,
    appliedEntryIds: ["preference.compact-operations"],
    rejectedEntryIds: [],
    result: "pass",
    evidenceRefs: ["browser-evidence-001"]
  };
  await assert.rejects(
    dictionary.recordRun({ run: { ...baseRun, dictionaryRevision: 0 }, evidenceRegistryPath: registryPath, idempotencyKey: "request-run-stale-001", confirmRecordIntent: true }),
    (error) => error.code === "REVISION_CONFLICT"
  );
  await assert.rejects(
    dictionary.recordRun({ run: { ...baseRun, appliedEntryIds: ["rule.unknown-entry"] }, evidenceRegistryPath: registryPath, idempotencyKey: "request-run-unknown-001", confirmRecordIntent: true }),
    (error) => error.code === "RUN_REFERENCE_REJECTED"
  );
  await dictionary.recordEntry({
    entry: entry({ id: "rule.pending-inference", type: "rule", provenance: { role: "inferred", sourceRef: "analysis-session-002", evidenceRefs: [] } }),
    expectedRevision: 1,
    idempotencyKey: "request-run-inference-001",
    confirmRecordIntent: true
  });
  await assert.rejects(
    dictionary.recordRun({ run: { ...baseRun, runId: "quality-run-ref-002", dictionaryRevision: 2, appliedEntryIds: ["rule.pending-inference"] }, evidenceRegistryPath: registryPath, idempotencyKey: "request-run-nonbinding-001", confirmRecordIntent: true }),
    (error) => error.code === "RUN_REFERENCE_REJECTED"
  );
  await fs.writeFile(path.join(dictionary.root, "evidence-fixture", "browser-evidence-001.json"), "tampered\n", "utf8");
  await assert.rejects(
    dictionary.recordRun({ run: { ...baseRun, runId: "quality-run-ref-003", dictionaryRevision: 2 }, evidenceRegistryPath: registryPath, idempotencyKey: "request-run-tamper-001", confirmRecordIntent: true }),
    (error) => error.code === "EVIDENCE_HASH_MISMATCH"
  );
});

test("an expired lease owned by a live process is never stolen", async () => {
  const dictionary = new KgjDictionary({ root: await testRoot("lease") });
  await dictionary.init();
  await fs.writeFile(path.join(dictionary.root, "mutation.lease"), `${JSON.stringify({ token: "live-owner", pid: process.pid, acquiredAt: "2020-01-01T00:00:00.000Z", expiresAt: "2020-01-01T00:00:01.000Z" })}\n`, "utf8");
  await assert.rejects(
    dictionary.recordEntry({ entry: entry(), expectedRevision: 0, idempotencyKey: "request-live-lease-001", confirmRecordIntent: true }),
    (error) => error.code === "MUTATION_BUSY" && error.data.ownerPid === process.pid
  );
});

test("an expired lease with a reused PID is fenced by host and process start identity", async () => {
  const dictionary = new KgjDictionary({ root: await testRoot("lease-pid-reuse") });
  await dictionary.init();
  await fs.writeFile(path.join(dictionary.root, "mutation.lease"), `${JSON.stringify({
    schemaVersion: "1.1",
    token: "reused-owner",
    pid: process.pid,
    host: os.hostname(),
    processStart: "reused-process-start",
    acquiredAt: "2020-01-01T00:00:00.000Z",
    expiresAt: "2020-01-01T00:00:01.000Z"
  })}\n`, "utf8");
  const result = await dictionary.recordEntry({
    entry: entry({ id: "preference.pid-reuse-fenced" }),
    expectedRevision: 0,
    idempotencyKey: "request-pid-reuse-001",
    confirmRecordIntent: true
  });
  assert.equal(result.entry.id, "preference.pid-reuse-fenced");
});

test("an expired lease from a crashed writer is recoverable without weakening live-owner fencing", async () => {
  const dictionary = new KgjDictionary({ root: await testRoot("lease-writer-crash") });
  await dictionary.init();
  await fs.writeFile(path.join(dictionary.root, "mutation.lease"), `${JSON.stringify({
    schemaVersion: "1.1",
    token: "crashed-owner",
    pid: 2147483647,
    host: os.hostname(),
    processStart: "missing-process",
    acquiredAt: "2020-01-01T00:00:00.000Z",
    expiresAt: "2020-01-01T00:00:01.000Z"
  })}\n`, "utf8");
  const result = await dictionary.recordEntry({
    entry: entry({ id: "preference.crashed-writer-recovered" }),
    expectedRevision: 0,
    idempotencyKey: "request-writer-crash-001",
    confirmRecordIntent: true
  });
  assert.equal(result.entry.id, "preference.crashed-writer-recovered");
});

test("pending imports are review-only until an explicit revisioned adoption", async () => {
  const dictionary = new KgjDictionary({ root: await testRoot("adoption") });
  const imported = entry({
    id: "preference.imported-density",
    provenance: { role: "import", sourceRef: "kgj-candidate-remote-001", evidenceRefs: ["candidate-export-001"] }
  });
  const recorded = await dictionary.recordEntry({
    entry: imported, expectedRevision: 0, idempotencyKey: "request-import-pending-001", confirmRecordIntent: true
  });
  assert.equal(recorded.entry.adoptionStatus, "pending");
  assert.equal((await dictionary.search({ context: { domain: "operations", surface: "console" } })).length, 0);
  const prepared = await dictionary.prepareApplication({ context: { domain: "operations", surface: "console" } });
  assert.equal(prepared.matches.length, 0);
  assert.equal(prepared.reviewQueue[0].id, imported.id);
  const health = await dictionary.health();
  assert.equal(health.counts.pendingImports, 1);
  await assert.rejects(
    dictionary.recordEntry({
      entry: { ...recorded.entry, adoptionStatus: "adopted", adoptionNote: "Attempted raw transition.", supersedesRevision: 1 },
      expectedRevision: 1,
      idempotencyKey: "request-import-bypass-001",
      confirmRecordIntent: true,
      _adoptionTransition: true
    }),
    /_adoptionTransition is not allowed/
  );
  await assert.rejects(
    dictionary.adoptImportedEntry({ id: imported.id, expectedRevision: 1, idempotencyKey: "request-import-adopt-001", adoptionNote: "Validated against the local console workflow." }),
    (error) => error.code === "CONFIRMATION_REQUIRED"
  );
  const adopted = await dictionary.adoptImportedEntry({
    id: imported.id,
    expectedRevision: 1,
    idempotencyKey: "request-import-adopt-001",
    adoptionNote: "Validated against the local console workflow.",
    confirmAdoptionIntent: true
  });
  assert.equal(adopted.entry.adoptionStatus, "adopted");
  assert.equal((await dictionary.search({ context: { domain: "operations", surface: "console" } }))[0].id, imported.id);
});

test("inferred entries remain non-binding until a dedicated evidence-backed review", async () => {
  const dictionary = new KgjDictionary({ root: await testRoot("inference") });
  const inferred = entry({
    id: "rule.inferred-density",
    type: "rule",
    provenance: { role: "inferred", sourceRef: "analysis-session-001", evidenceRefs: [] }
  });
  const recorded = await dictionary.recordEntry({
    entry: inferred,
    expectedRevision: 0,
    idempotencyKey: "request-inference-pending-001",
    confirmRecordIntent: true
  });
  assert.equal(recorded.entry.inferenceStatus, "pending");
  assert.equal((await dictionary.search({ context: { domain: "operations", surface: "console" } })).length, 0);
  assert.equal((await dictionary.pendingInferences()).length, 1);
  await assert.rejects(
    dictionary.recordEntry({
      entry: { ...inferred, inferenceStatus: "verified", inferenceNote: "Attempted generic escalation.", supersedesRevision: 1 },
      expectedRevision: 1,
      idempotencyKey: "request-inference-bypass-001",
      confirmRecordIntent: true
    }),
    (error) => error.code === "INFERENCE_REVIEW_REQUIRED"
  );
  const reviewed = await dictionary.reviewInferredEntry({
    id: inferred.id,
    expectedRevision: 1,
    idempotencyKey: "request-inference-review-001",
    decision: "verified",
    inferenceNote: "Verified against the local density comparison receipt.",
    reviewEvidenceRefs: ["review.inference-density-001"],
    confirmInferenceReviewIntent: true
  });
  assert.equal(reviewed.entry.inferenceStatus, "verified");
  assert.equal((await dictionary.search({ context: { domain: "operations", surface: "console" } }))[0].id, inferred.id);
});

test("review-overdue and expired entries cannot influence resolution", async () => {
  const dictionary = new KgjDictionary({ root: await testRoot("lifecycle") });
  await dictionary.recordEntry({
    entry: entry({ id: "preference.review-overdue", reviewAfter: "2020-01-01" }),
    expectedRevision: 0,
    idempotencyKey: "request-lifecycle-review-001",
    confirmRecordIntent: true
  });
  await dictionary.recordEntry({
    entry: entry({ id: "preference.expired", retention: "expires", expiresAt: "2020-01-01T00:00:00.000Z" }),
    expectedRevision: 1,
    idempotencyKey: "request-lifecycle-expired-001",
    confirmRecordIntent: true
  });
  assert.equal((await dictionary.search({ context: { domain: "operations", surface: "console" } })).length, 0);
  const reviewOnly = await dictionary.search({ context: { domain: "operations", surface: "console" }, includeNonBinding: true });
  assert.equal(reviewOnly.length, 2);
  assert.equal(reviewOnly.every((item) => item.binding.binding === false), true);
  const health = await dictionary.health();
  assert.equal(health.counts.reviewOverdue, 1);
  assert.equal(health.counts.expired, 1);
});

test("MCP runtime exposes the bounded Codex tool contract", async () => {
  const runtime = new KgjMcpRuntime({ root: await testRoot("runtime") });
  const names = runtime.tools().map((tool) => tool.name);
  assert.deepEqual(names, [
    "get_ontology",
    "get_dictionary_health",
    "list_pending_imports",
    "list_pending_inferences",
    "search_dictionary",
    "get_dictionary_entry",
    "prepare_design_application",
    "record_dictionary_entry",
    "adopt_imported_entry",
    "review_inferred_entry",
    "list_design_runs",
    "record_design_run",
    "export_sanitized_dictionary",
    "verify_integrity"
  ]);
  const ontology = await runtime.call("get_ontology", {});
  assert.equal(ontology.promise, "portable-learning-not-portable-identity");
});

test("MCP runtime rejects undeclared mutation parameters before Dictionary code runs", async () => {
  const root = await testRoot("runtime-validation");
  const runtime = new KgjMcpRuntime({ root });
  await assert.rejects(
    runtime.call("record_dictionary_entry", {
      entry: entry(),
      expectedRevision: 0,
      idempotencyKey: "request-runtime-bypass-001",
      confirmRecordIntent: true,
      _adoptionTransition: true
    }),
    (error) => error.code === "INVALID_TOOL_ARGUMENTS"
  );
  const dictionary = new KgjDictionary({ root });
  assert.equal((await dictionary.projection()).revision, 0);
});
