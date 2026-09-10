import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { canonicalJson, hashObject, sha256 } from "./integrity.mjs";
import { resolveEvidenceRegistry } from "./evidence.mjs";
import { dataRoot, runtimePaths } from "./paths.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ONTOLOGY_PATH = path.resolve(HERE, "..", "ontology", "kgj-ontology.json");
const TYPES = new Set(["observation", "preference", "rule", "rejection", "experiment", "outcome", "candidate-pattern"]);
const PROVENANCE = new Set(["user-stated", "product-observation", "official-source", "inferred", "tested-locally", "import"]);
const TRAITS = new Set(["density", "hierarchy", "typography", "color", "shape", "depth", "motion", "imagery", "voice", "data", "interaction", "spatial-composition"]);
const AUTHORITY = new Map([["rule", 600], ["rejection", 500], ["outcome", 400], ["preference", 300], ["candidate-pattern", 200], ["observation", 100], ["experiment", 90]]);
const SCOPE_KEYS = new Set(["product", "domain", "surface", "task", "risk", "device", "locale"]);
const ENTRY_KEYS = new Set(["id", "type", "title", "guidance", "scope", "traitAxes", "provenance", "confidence", "status", "sharingClass", "consent", "counterevidence", "reviewAfter", "expiresAt", "supersedesRevision", "retention", "adoptionStatus", "adoptionNote", "inferenceStatus", "inferenceNote", "portablePrinciples"]);
const RECORD_ENTRY_KEYS = new Set(["entry", "expectedRevision", "idempotencyKey", "confirmRecordIntent"]);
const RECORD_RUN_KEYS = new Set(["run", "evidenceRegistryPath", "idempotencyKey", "confirmRecordIntent"]);
const RUN_KEYS = new Set(["runId", "productId", "phenotype", "dictionaryRevision", "appliedEntryIds", "rejectedEntryIds", "result", "evidenceRefs"]);
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,79}$/;
const EXPORT_SCOPE_KEYS = new Set(["domain", "surface", "task", "risk", "device", "locale"]);
const EXPORT_SCOPE_VALUE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ENTRY_TRANSITION = Symbol("kgj-entry-transition");
const PORTABLE_PRINCIPLES = new Set([
  "preserve-semantic-state",
  "surface-evidence-boundary",
  "use-progressive-disclosure",
  "adapt-density-to-task",
  "keep-recovery-visible",
  "separate-identity-from-learning",
  "prefer-product-local-pattern"
]);
const SENSITIVE = /(?:password|secret|api[_ -]?key|access[_ -]?token|diagnos|psycholog|race|religion|sexual|biometric|protected characteristic)/i;
const PERSONAL = /(?:[A-Z]:\\|\\\\[^\\]+\\|\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b|https?:\/\/[^\s]+)/i;
const execFileAsync = promisify(execFile);
let currentProcessStartIdentity;

function fail(message, code = "INVALID_ARGUMENT", data = {}) {
  const error = new Error(message);
  error.code = code;
  error.data = data;
  throw error;
}

function boundedText(value, field, min, max) {
  if (typeof value !== "string" || value.trim().length < min || value.length > max) {
    fail(`${field} must be ${min}-${max} characters`);
  }
  if (SENSITIVE.test(value)) fail(`${field} contains a forbidden sensitive category`, "PRIVACY_REJECTED");
  return value.trim();
}

function validateConsent(value, sharingClass) {
  if (sharingClass === "private") {
    if (value !== undefined && value !== null) fail("Private entries cannot carry an active export consent", "PRIVACY_REJECTED");
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("consent is required for a consented candidate", "PRIVACY_REJECTED");
  const keys = new Set(["grantId", "purpose", "policyVersion", "grantedAt", "expiresAt", "status"]);
  for (const key of Object.keys(value)) if (!keys.has(key)) fail(`entry.consent.${key} is not allowed`);
  if (!RUN_ID.test(value.grantId ?? "")) fail("entry.consent.grantId is invalid", "PRIVACY_REJECTED");
  if (value.purpose !== "cross-user-candidate-export") fail("entry.consent.purpose is not export-compatible", "PRIVACY_REJECTED");
  if (!/^\d+\.\d+$/.test(value.policyVersion ?? "")) fail("entry.consent.policyVersion is invalid", "PRIVACY_REJECTED");
  if (!ISO_INSTANT.test(value.grantedAt ?? "") || !Number.isFinite(Date.parse(value.grantedAt))) fail("entry.consent.grantedAt must be canonical UTC", "PRIVACY_REJECTED");
  if (!ISO_INSTANT.test(value.expiresAt ?? "") || !Number.isFinite(Date.parse(value.expiresAt))) fail("entry.consent.expiresAt must be canonical UTC", "PRIVACY_REJECTED");
  const grantedAt = Date.parse(value.grantedAt);
  const expiresAt = Date.parse(value.expiresAt);
  const now = Date.now();
  if (grantedAt > now + 300000) fail("entry.consent.grantedAt cannot be in the future", "PRIVACY_REJECTED");
  if (expiresAt <= grantedAt || expiresAt <= now) fail("entry.consent.expiresAt must be after grant time and still active", "PRIVACY_REJECTED");
  if (expiresAt - grantedAt > 366 * 24 * 60 * 60 * 1000) fail("entry.consent duration cannot exceed 366 days", "PRIVACY_REJECTED");
  if (value.status !== "granted") fail("entry.consent.status must be granted", "PRIVACY_REJECTED");
  return { grantId: value.grantId, purpose: value.purpose, policyVersion: value.policyVersion, grantedAt: value.grantedAt, expiresAt: value.expiresAt, status: value.status };
}

function validateEntry(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("entry must be an object");
  for (const key of Object.keys(input)) if (!ENTRY_KEYS.has(key)) fail(`entry.${key} is not allowed`);
  if (typeof input.id !== "string" || !/^[a-z0-9][a-z0-9._-]{2,79}$/.test(input.id)) fail("entry.id is invalid");
  if (!TYPES.has(input.type)) fail("entry.type is invalid");
  const scope = input.scope ?? {};
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) fail("entry.scope must be an object");
  for (const [key, value] of Object.entries(scope)) {
    if (!SCOPE_KEYS.has(key)) fail(`entry.scope.${key} is not allowed`);
    boundedText(value, `entry.scope.${key}`, 1, key === "locale" ? 20 : 80);
  }
  const traitAxes = input.traitAxes ?? [];
  if (!Array.isArray(traitAxes) || traitAxes.length > 12 || traitAxes.some((item) => !TRAITS.has(item))) fail("entry.traitAxes is invalid");
  const provenance = input.provenance;
  if (!provenance || typeof provenance !== "object" || !PROVENANCE.has(provenance.role)) fail("entry.provenance.role is invalid");
  for (const key of Object.keys(provenance)) if (!["role", "sourceRef", "evidenceRefs"].includes(key)) fail(`entry.provenance.${key} is not allowed`);
  boundedText(provenance.sourceRef, "entry.provenance.sourceRef", 3, 160);
  const evidenceRefs = provenance.evidenceRefs ?? [];
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length > 12) fail("entry.provenance.evidenceRefs is invalid");
  for (const ref of evidenceRefs) boundedText(ref, "entry.provenance.evidenceRefs[]", 1, 160);
  if (typeof input.confidence !== "number" || input.confidence < 0 || input.confidence > 1) fail("entry.confidence must be between 0 and 1");
  const status = input.status ?? "active";
  if (!["active", "revoked", "superseded"].includes(status)) fail("entry.status is invalid");
  const sharingClass = input.sharingClass ?? "private";
  if (!["private", "consented-candidate"].includes(sharingClass)) fail("entry.sharingClass is invalid");
  if (sharingClass === "consented-candidate" && !["candidate-pattern", "outcome"].includes(input.type)) {
    fail("Only candidate-pattern and outcome entries may be consented candidates", "PRIVACY_REJECTED");
  }
  if (input.type === "candidate-pattern" && provenance.role === "inferred") {
    fail("An inferred entry cannot be published as a candidate pattern", "PRIVACY_REJECTED");
  }
  const guidance = boundedText(input.guidance, "entry.guidance", 3, 600);
  const title = boundedText(input.title, "entry.title", 3, 120);
  if (sharingClass === "consented-candidate" && (PERSONAL.test(guidance) || PERSONAL.test(title))) {
    fail("Consented candidates cannot contain paths, email addresses, or URLs", "PRIVACY_REJECTED");
  }
  const portablePrinciples = input.portablePrinciples ?? [];
  if (!Array.isArray(portablePrinciples) || portablePrinciples.length > 8 || portablePrinciples.some((item) => !PORTABLE_PRINCIPLES.has(item))) {
    fail("entry.portablePrinciples must use the closed ontology vocabulary", "PRIVACY_REJECTED");
  }
  if (sharingClass === "consented-candidate" && portablePrinciples.length === 0) {
    fail("Consented candidates require at least one portablePrinciple", "PRIVACY_REJECTED");
  }
  const consent = validateConsent(input.consent, sharingClass);
  const retention = input.retention ?? "review-required";
  if (!["until-revoked", "review-required", "expires"].includes(retention)) fail("entry.retention is invalid");
  const reviewAfter = input.reviewAfter ?? null;
  if (reviewAfter !== null && (!ISO_DATE.test(reviewAfter) || !Number.isFinite(Date.parse(`${reviewAfter}T00:00:00.000Z`)))) {
    fail("entry.reviewAfter must be a valid ISO date");
  }
  const expiresAt = input.expiresAt ?? null;
  if (expiresAt !== null && (!ISO_INSTANT.test(expiresAt) || !Number.isFinite(Date.parse(expiresAt)))) fail("entry.expiresAt must be canonical UTC");
  if (retention === "expires" && expiresAt === null) fail("entry.expiresAt is required when retention is expires");
  const adoptionStatus = input.adoptionStatus ?? (provenance.role === "import" ? "pending" : "native");
  if (provenance.role === "import") {
    if (!["pending", "adopted", "rejected"].includes(adoptionStatus)) fail("Imported entries require pending, adopted, or rejected adoptionStatus");
  } else if (adoptionStatus !== "native") {
    fail("Non-imported entries must use native adoptionStatus");
  }
  let adoptionNote = input.adoptionNote ?? null;
  if (["adopted", "rejected"].includes(adoptionStatus)) adoptionNote = boundedText(adoptionNote, "entry.adoptionNote", 3, 240);
  else if (adoptionNote !== null) fail("entry.adoptionNote is only valid for reviewed imports");
  const inferenceStatus = input.inferenceStatus ?? (provenance.role === "inferred" ? "pending" : "native");
  if (provenance.role === "inferred") {
    if (!["pending", "verified", "rejected"].includes(inferenceStatus)) fail("Inferred entries require pending, verified, or rejected inferenceStatus");
  } else if (inferenceStatus !== "native") {
    fail("Non-inferred entries must use native inferenceStatus");
  }
  let inferenceNote = input.inferenceNote ?? null;
  if (["verified", "rejected"].includes(inferenceStatus)) inferenceNote = boundedText(inferenceNote, "entry.inferenceNote", 3, 240);
  else if (inferenceNote !== null) fail("entry.inferenceNote is only valid for reviewed inferences");
  return {
    id: input.id,
    type: input.type,
    title,
    guidance,
    scope,
    traitAxes: [...new Set(traitAxes)],
    provenance: { role: provenance.role, sourceRef: provenance.sourceRef.trim(), evidenceRefs },
    confidence: input.confidence,
    status,
    sharingClass,
    consent,
    counterevidence: Array.isArray(input.counterevidence) ? input.counterevidence.slice(0, 12) : [],
    reviewAfter,
    expiresAt,
    supersedesRevision: input.supersedesRevision ?? null,
    retention,
    adoptionStatus,
    adoptionNote,
    inferenceStatus,
    inferenceNote,
    portablePrinciples: [...new Set(portablePrinciples)]
  };
}

async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

async function hasEntries(directory) {
  try { return (await fs.readdir(directory)).length > 0; } catch { return false; }
}

async function readJson(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); } catch (error) {
    if (error.code === "ENOENT" && fallback !== null) return fallback;
    throw error;
  }
}

async function readLines(file) {
  try {
    const value = await fs.readFile(file, "utf8");
    return value.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function validateIdArray(value, field, max) {
  if (!Array.isArray(value) || value.length > max) fail(`${field} must be an array with at most ${max} values`);
  const normalized = value.map((item) => {
    if (typeof item !== "string" || !RUN_ID.test(item)) fail(`${field} contains an invalid identifier`);
    return item;
  });
  if (new Set(normalized).size !== normalized.length) fail(`${field} must contain unique identifiers`);
  return normalized;
}

function validateRun(run) {
  if (!run || typeof run !== "object" || Array.isArray(run)) fail("run must be an object");
  for (const key of Object.keys(run)) if (!RUN_KEYS.has(key)) fail(`run.${key} is not allowed`);
  for (const key of RUN_KEYS) if (!(key in run)) fail(`run.${key} is required`);
  if (!RUN_ID.test(run.runId ?? "")) fail("run.runId is invalid");
  if (!RUN_ID.test(run.productId ?? "")) fail("run.productId is invalid");
  if (typeof run.phenotype !== "string" || !/^[a-z][a-z0-9-]{2,39}$/.test(run.phenotype)) fail("run.phenotype is invalid");
  if (!Number.isInteger(run.dictionaryRevision) || run.dictionaryRevision < 0) fail("run.dictionaryRevision must be a non-negative integer");
  if (!["pass", "hold", "fail"].includes(run.result)) fail("run.result is invalid");
  const evidenceRefs = validateIdArray(run.evidenceRefs, "run.evidenceRefs", 50);
  const appliedEntryIds = validateIdArray(run.appliedEntryIds, "run.appliedEntryIds", 100);
  const rejectedEntryIds = validateIdArray(run.rejectedEntryIds, "run.rejectedEntryIds", 100);
  const overlap = appliedEntryIds.filter((id) => rejectedEntryIds.includes(id));
  if (overlap.length) fail("run appliedEntryIds and rejectedEntryIds must be disjoint", "RUN_REFERENCE_REJECTED", { overlap });
  if (run.result === "pass" && evidenceRefs.length === 0) fail("A passing design run requires evidenceRefs", "EVIDENCE_REQUIRED");
  return {
    schemaVersion: "1.0",
    runId: run.runId,
    productId: run.productId,
    phenotype: run.phenotype,
    dictionaryRevision: run.dictionaryRevision,
    appliedEntryIds,
    rejectedEntryIds,
    result: run.result,
    evidenceRefs,
    recordedAt: new Date().toISOString()
  };
}

function sanitizedScope(entry) {
  const output = {};
  for (const [key, value] of Object.entries(entry.scope ?? {})) {
    if (key === "product") continue;
    if (!EXPORT_SCOPE_KEYS.has(key) || !EXPORT_SCOPE_VALUE.test(value)) {
      fail(`Entry ${entry.id} has a scope value that is not a normalized export taxonomy slug`, "PRIVACY_REJECTED", { field: `scope.${key}` });
    }
    output[key] = value;
  }
  return output;
}

function expectedEntryIdempotency(event) {
  const { eventHash } = event;
  return {
    requestHash: event.requestHash,
    result: { revision: event.revision, entry: event.entry, eventHash },
    committedAt: event.committedAt
  };
}

function expectedRunIdempotency(event) {
  return {
    requestHash: event.requestHash,
    result: { receipt: event.receipt, receiptHash: event.receiptHash },
    committedAt: event.receipt.recordedAt
  };
}

async function replayLedger(paths, ledger, verifyEventFiles = true) {
  const issues = [];
  const entries = {};
  const entryHistory = {};
  const revisionHashes = { 0: hashObject({ schemaVersion: "1.0", revision: 0, entries: {} }) };
  for (let index = 0; index < ledger.length; index += 1) {
    const event = ledger[index];
    const expectedRevision = index + 1;
    if (event.event !== "dictionary-entry-recorded") issues.push(`ledger event type mismatch at revision ${expectedRevision}`);
    if (event.revision !== expectedRevision) issues.push(`ledger revision gap at line ${expectedRevision}`);
    if (event.previousRevision !== index) issues.push(`ledger previousRevision mismatch at revision ${expectedRevision}`);
    const { eventHash, ...source } = event;
    const calculatedHash = hashObject(source);
    if (eventHash !== calculatedHash) issues.push(`ledger event hash mismatch at revision ${expectedRevision}`);
    const entryId = event.entry?.id;
    const previous = entryId ? entries[entryId] ?? null : null;
    const expectedPreviousHash = previous ? hashObject(previous) : null;
    if (event.previousEntryHash !== expectedPreviousHash) issues.push(`ledger previousEntryHash mismatch at revision ${expectedRevision}`);
    if (!entryId || event.entry.revision !== expectedRevision) issues.push(`ledger entry payload mismatch at revision ${expectedRevision}`);
    if (typeof event.idempotencyKeyHash !== "string" || !/^[a-f0-9]{64}$/.test(event.idempotencyKeyHash)) issues.push(`ledger idempotency key hash missing at revision ${expectedRevision}`);
    if (typeof event.requestHash !== "string" || !/^[a-f0-9]{64}$/.test(event.requestHash)) issues.push(`ledger request hash missing at revision ${expectedRevision}`);
    if (verifyEventFiles && typeof eventHash === "string") {
      const eventFile = path.join(paths.events, `revision-${String(expectedRevision).padStart(8, "0")}-${eventHash.slice(0, 12)}.json`);
      if (!(await exists(eventFile))) issues.push(`event file missing at revision ${expectedRevision}`);
      else if (hashObject(await readJson(eventFile)) !== eventHash) issues.push(`event file content mismatch at revision ${expectedRevision}`);
    }
    if (entryId) {
      entries[entryId] = event.entry;
      entryHistory[entryId] = [...(entryHistory[entryId] ?? []), event.entry];
    }
    revisionHashes[expectedRevision] = hashObject({ schemaVersion: "1.0", revision: expectedRevision, entries });
  }
  return { projection: { schemaVersion: "1.0", revision: ledger.length, entries }, issues, entryHistory, revisionHashes };
}

function entryAtRevision(replay, id, revision) {
  return (replay.entryHistory[id] ?? []).filter((entry) => entry.revision <= revision).at(-1) ?? null;
}

function validateRunHistory(runEvents, replay) {
  const issues = [];
  const requests = {};
  for (let index = 0; index < runEvents.length; index += 1) {
    const event = runEvents[index];
    const line = index + 1;
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      issues.push(`run event must be an object at line ${line}`);
      continue;
    }
    if (event.event !== "design-run-recorded") issues.push(`run event type mismatch at line ${line}`);
    if (event.receiptHash !== hashObject(event.receipt)) issues.push(`run receipt hash mismatch at line ${line}`);
    if (typeof event.idempotencyKeyHash !== "string" || !/^[a-f0-9]{64}$/.test(event.idempotencyKeyHash)) issues.push(`run idempotency key hash missing at line ${line}`);
    const receipt = event.receipt ?? {};
    if (receipt.schemaVersion !== "1.1") issues.push(`run receipt schema mismatch at line ${line}`);
    if (!ISO_INSTANT.test(receipt.recordedAt ?? "") || !Number.isFinite(Date.parse(receipt.recordedAt))) issues.push(`run recordedAt invalid at line ${line}`);
    if (replay.revisionHashes[receipt.dictionaryRevision] !== receipt.projectionHash) issues.push(`run projection hash mismatch at line ${line}`);
    try {
      validateRun({
        runId: receipt.runId,
        productId: receipt.productId,
        phenotype: receipt.phenotype,
        dictionaryRevision: receipt.dictionaryRevision,
        appliedEntryIds: receipt.appliedEntryIds,
        rejectedEntryIds: receipt.rejectedEntryIds,
        result: receipt.result,
        evidenceRefs: receipt.evidenceRefs
      });
    } catch (error) {
      issues.push(`run receipt contract invalid at line ${line}: ${error.message}`);
    }
    for (const id of [...(receipt.appliedEntryIds ?? []), ...(receipt.rejectedEntryIds ?? [])]) {
      if (!entryAtRevision(replay, id, receipt.dictionaryRevision)) issues.push(`run references unknown entry ${id} at line ${line}`);
    }
    for (const id of receipt.appliedEntryIds ?? []) {
      const historical = entryAtRevision(replay, id, receipt.dictionaryRevision);
      if (historical && !bindingState(historical, new Date(receipt.recordedAt)).binding) issues.push(`run applied non-binding entry ${id} at line ${line}`);
    }
    const bindingIds = Array.isArray(receipt.evidenceBindings) ? receipt.evidenceBindings.map((item) => item?.id) : [];
    if (hashObject(bindingIds) !== hashObject(receipt.evidenceRefs ?? [])) issues.push(`run evidence bindings mismatch at line ${line}`);
    if ((receipt.evidenceRefs ?? []).length && !/^[a-f0-9]{64}$/.test(receipt.evidenceRegistryHash ?? "")) issues.push(`run evidence registry hash missing at line ${line}`);
    for (const binding of receipt.evidenceBindings ?? []) {
      if (!/^[a-f0-9]{64}$/.test(binding?.artifactHash ?? "")) issues.push(`run evidence artifact hash invalid at line ${line}`);
    }
    if (typeof event.idempotencyKeyHash === "string" && /^[a-f0-9]{64}$/.test(event.idempotencyKeyHash)) requests[event.idempotencyKeyHash] = expectedRunIdempotency(event);
  }
  return { issues, requests };
}

async function writeJsonVersioned(file, value, paths, label, boundary) {
  const temp = `${file}.next-${process.pid}-${crypto.randomUUID()}`;
  await writeFileDurable(temp, `${JSON.stringify(value, null, 2)}\n`, "wx");
  if (await exists(file)) {
    const archive = path.join(paths.versions, `${path.basename(file, ".json")}.${label}-${crypto.randomUUID()}.json`);
    await fs.rename(file, archive);
    paths.writeHook?.(boundary, "after-archive");
  }
  await fs.rename(temp, file);
}

async function writeFileDurable(file, value, flag = "w") {
  const handle = await fs.open(file, flag);
  try {
    await handle.writeFile(value, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function appendLineDurable(file, value) {
  const handle = await fs.open(file, "a");
  try {
    await handle.writeFile(value, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

async function processStartIdentity(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    if (process.platform === "win32") {
      const command = `$processValue = Get-Process -Id ${pid} -ErrorAction Stop; $processValue.StartTime.ToUniversalTime().Ticks`;
      const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
        windowsHide: true,
        timeout: 2000,
        maxBuffer: 4096
      });
      const ticks = String(stdout).trim();
      return /^\d+$/.test(ticks) ? `windows-ticks:${ticks}` : null;
    }
    if (process.platform === "linux") {
      const [stat, bootId] = await Promise.all([
        fs.readFile(`/proc/${pid}/stat`, "utf8"),
        fs.readFile("/proc/sys/kernel/random/boot_id", "utf8")
      ]);
      const closeParen = stat.lastIndexOf(")");
      const fields = closeParen >= 0 ? stat.slice(closeParen + 1).trim().split(/\s+/) : [];
      const startTicks = fields[19];
      return startTicks && /^\d+$/.test(startTicks) ? `linux-boot:${bootId.trim()}:ticks:${startTicks}` : null;
    }
    if (process.platform === "darwin") {
      const { stdout } = await execFileAsync("ps", ["-o", "lstart=", "-p", String(pid)], { timeout: 2000, maxBuffer: 4096 });
      const started = String(stdout).trim();
      return started ? `darwin-lstart:${started}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

async function localProcessIdentity() {
  if (currentProcessStartIdentity === undefined) currentProcessStartIdentity = await processStartIdentity(process.pid);
  return { host: os.hostname(), pid: process.pid, processStart: currentProcessStartIdentity };
}

async function acquireLease(paths) {
  const token = crypto.randomUUID();
  const now = Date.now();
  const identity = await localProcessIdentity();
  if (!identity.processStart) fail("Could not establish the Dictionary writer process identity", "PROCESS_IDENTITY_UNAVAILABLE");
  const payload = { schemaVersion: "1.1", token, ...identity, acquiredAt: new Date(now).toISOString(), expiresAt: new Date(now + 15000).toISOString() };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await writeFileDurable(paths.lease, `${JSON.stringify(payload)}\n`, "wx");
      return token;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const current = await readJson(paths.lease, {});
      const ownerPid = Number.isInteger(current.pid) ? current.pid : null;
      if (!current.expiresAt || Date.parse(current.expiresAt) > Date.now()) {
        fail("Dictionary mutation is busy", "MUTATION_BUSY", { ownerPid, ownerHost: typeof current.host === "string" ? current.host : null });
      }
      if (processIsAlive(current.pid)) {
        if (current.host !== identity.host || typeof current.processStart !== "string") {
          fail("Dictionary mutation is busy", "MUTATION_BUSY", { ownerPid, ownerHost: typeof current.host === "string" ? current.host : null });
        }
        const observedStart = await processStartIdentity(current.pid);
        if (!observedStart || observedStart === current.processStart) {
          fail("Dictionary mutation is busy", "MUTATION_BUSY", { ownerPid, ownerHost: current.host });
        }
      }
      const archived = path.join(paths.leaseArchive, `expired-${Date.now()}-${crypto.randomUUID()}.json`);
      await fs.rename(paths.lease, archived);
    }
  }
  fail("Could not acquire dictionary mutation lease", "MUTATION_BUSY");
}

async function releaseLease(paths, token) {
  const current = await readJson(paths.lease, {});
  if (current.token !== token) return;
  await fs.rename(paths.lease, path.join(paths.leaseArchive, `released-${Date.now()}-${token}.json`));
}

function scopeScore(entryScope, context) {
  let matched = 0;
  let specified = 0;
  for (const [key, value] of Object.entries(entryScope ?? {})) {
    specified += 1;
    if (context?.[key] === value) matched += 1;
    else return -1;
  }
  return matched * 25 + specified;
}

function entrySearchText(entry) {
  return [entry.id, entry.type, entry.title, entry.guidance, ...Object.values(entry.scope ?? {}), ...(entry.traitAxes ?? [])].join(" ").toLowerCase();
}

function bindingState(entry, now = new Date()) {
  const reasons = [];
  if (entry.status !== "active") reasons.push(`status-${entry.status}`);
  if (entry.provenance?.role === "import" && entry.adoptionStatus !== "adopted") reasons.push(`import-${entry.adoptionStatus ?? "pending"}`);
  if (entry.provenance?.role === "inferred" && entry.inferenceStatus !== "verified") reasons.push(`inference-${entry.inferenceStatus ?? "pending"}`);
  const today = now.toISOString().slice(0, 10);
  if (entry.retention === "review-required" && entry.reviewAfter && entry.reviewAfter <= today) reasons.push("review-overdue");
  if (entry.retention === "expires" && entry.expiresAt && Date.parse(entry.expiresAt) <= now.getTime()) reasons.push("expired");
  return { binding: reasons.length === 0, reasons };
}

const STORE_FILES = ["projection", "ledger", "idempotency", "runs", "snapshot"];

function emptyProjection() {
  return { schemaVersion: "1.0", revision: 0, entries: {} };
}

async function ensureStore(root, { create = false } = {}) {
  const paths = runtimePaths(root);
  const present = Object.fromEntries(await Promise.all(STORE_FILES.map(async (name) => [name, await exists(paths[name])] )));
  const presentCount = Object.values(present).filter(Boolean).length;
  if (presentCount === 0) {
    const hasImmutableHistory = await hasEntries(paths.events);
    if (hasImmutableHistory) return { paths, state: "recovery-required", missing: STORE_FILES };
    if (!create) return { paths, state: "empty", missing: [] };
    await Promise.all([paths.root, paths.events, paths.leaseArchive, paths.versions].map((dir) => fs.mkdir(dir, { recursive: true })));
    await fs.writeFile(paths.projection, `${JSON.stringify(emptyProjection(), null, 2)}\n`, { flag: "wx" });
    await fs.writeFile(paths.idempotency, `${JSON.stringify({ schemaVersion: "1.0", requests: {} }, null, 2)}\n`, { flag: "wx" });
    await fs.writeFile(paths.ledger, "", { flag: "wx" });
    await fs.writeFile(paths.runs, "", { flag: "wx" });
    const snapshot = await buildSnapshot(paths, emptyProjection());
    await fs.writeFile(paths.snapshot, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: "wx" });
    return { paths, state: "ready", missing: [] };
  }
  const missing = STORE_FILES.filter((name) => !present[name]);
  return { paths, state: missing.length ? "recovery-required" : "ready", missing };
}

async function buildSnapshot(paths, projection) {
  const ledgerText = await fs.readFile(paths.ledger, "utf8");
  const runsText = await fs.readFile(paths.runs, "utf8");
  const idempotency = await readJson(paths.idempotency);
  return {
    schemaVersion: "1.0",
    revision: projection.revision,
    entryCount: Object.keys(projection.entries).length,
    ledgerEvents: ledgerText.split(/\r?\n/).filter(Boolean).length,
    designRuns: runsText.split(/\r?\n/).filter(Boolean).length,
    hashes: {
      projection: hashObject(projection),
      ledger: sha256(ledgerText),
      idempotency: hashObject(idempotency),
      runs: sha256(runsText)
    }
  };
}

async function updateSnapshot(paths, projection, label) {
  await writeJsonVersioned(paths.snapshot, await buildSnapshot(paths, projection), paths, label, "snapshot");
}

export class KgjDictionary {
  constructor(options = {}) {
    this.root = options.root ? path.resolve(options.root) : dataRoot(options.env);
    this.failAt = options.failAt ?? null;
  }

  #inject(label) {
    if (this.failAt === label) fail(`Injected write-boundary failure: ${label}`, "TEST_WRITE_BOUNDARY");
  }

  async init({ create = false } = {}) {
    const store = await ensureStore(this.root, { create });
    this.paths = store.paths;
    this.paths.writeHook = (boundary, phase) => this.#inject(`${boundary}-${phase}`);
    this.store = store;
    return this;
  }

  async #readableStore() {
    await this.init();
    if (this.store.state === "recovery-required") {
      fail("Dictionary recovery is required before reading derived state", "RECOVERY_REQUIRED", { missing: this.store.missing });
    }
    if (this.store.state === "ready") {
      const integrity = await this.verify();
      if (!integrity.ok) fail("Dictionary recovery is required before reading derived state", "RECOVERY_REQUIRED", { issues: integrity.issues });
      return { ...this.store, integrity };
    }
    return this.store;
  }

  async ontology() {
    return readJson(ONTOLOGY_PATH);
  }

  async projection() {
    const store = await this.#readableStore();
    if (store.state === "empty") return emptyProjection();
    const projection = await readJson(this.paths.projection);
    if (store.integrity?.hashes?.projection && hashObject(projection) !== store.integrity.hashes.projection) {
      fail("Dictionary changed while being read; retry after verifying integrity", "RECOVERY_REQUIRED");
    }
    return projection;
  }

  async search({ query = "", types = [], context = {}, includeCandidates = true, includeNonBinding = false, limit = 20 } = {}) {
    const projection = await this.projection();
    const needle = String(query).trim().toLowerCase();
    const typeSet = new Set(types);
    return Object.values(projection.entries)
      .map((entry) => ({ entry, binding: bindingState(entry) }))
      .filter((item) => includeNonBinding || item.binding.binding)
      .map((item) => item.entry)
      .filter((entry) => includeCandidates || entry.type !== "candidate-pattern")
      .filter((entry) => typeSet.size === 0 || typeSet.has(entry.type))
      .filter((entry) => !needle || entrySearchText(entry).includes(needle))
      .map((entry) => ({ entry, scopeScore: scopeScore(entry.scope, context) }))
      .filter((item) => item.scopeScore >= 0)
      .sort((a, b) => (AUTHORITY.get(b.entry.type) + b.scopeScore + b.entry.confidence) - (AUTHORITY.get(a.entry.type) + a.scopeScore + a.entry.confidence))
      .slice(0, Math.max(1, Math.min(Number(limit) || 20, 100)))
      .map(({ entry, scopeScore: specificity }) => ({ ...entry, match: { specificity, authority: AUTHORITY.get(entry.type) ?? 0 }, binding: bindingState(entry) }));
  }

  async get(id) {
    const projection = await this.projection();
    return projection.entries[id] ?? null;
  }

  async prepareApplication({ context = {}, traitAxes = [], limit = 20 } = {}) {
    const matches = await this.search({ context, limit: Math.min(limit, 50) });
    const filtered = traitAxes.length ? matches.filter((entry) => entry.traitAxes.some((trait) => traitAxes.includes(trait))) : matches;
    const reviewCandidates = await this.search({ context, includeNonBinding: true, limit: 100 });
    const reviewQueue = reviewCandidates
      .filter((entry) => !entry.binding.binding)
      .filter((entry) => !traitAxes.length || entry.traitAxes.some((trait) => traitAxes.includes(trait)))
      .slice(0, Math.min(limit, 50));
    const conflicts = [];
    for (let left = 0; left < filtered.length; left += 1) {
      for (let right = left + 1; right < filtered.length; right += 1) {
        const a = filtered[left];
        const b = filtered[right];
        if (a.traitAxes.some((trait) => b.traitAxes.includes(trait)) && ((a.type === "rejection") !== (b.type === "rejection"))) {
          conflicts.push({ entryIds: [a.id, b.id], relation: "contradicts", resolution: "higher authority and specificity wins; keep both visible" });
        }
      }
    }
    return {
      context,
      matches: filtered,
      reviewQueue,
      conflicts,
      explanation: filtered.map((entry) => `${entry.id}: ${entry.type} matched at specificity ${entry.match.specificity}`),
      portableIdentityClaim: false
    };
  }

  async recordEntry(args = {}) {
    if (!args || typeof args !== "object" || Array.isArray(args)) fail("record entry arguments must be an object");
    for (const key of Object.keys(args)) if (!RECORD_ENTRY_KEYS.has(key)) fail(`record_dictionary_entry.${key} is not allowed`);
    return this.#recordEntry(args, null);
  }

  async #recordEntry({ entry, expectedRevision, idempotencyKey, confirmRecordIntent } = {}, transition = null) {
    if (confirmRecordIntent !== true) fail("confirmRecordIntent must be true", "CONFIRMATION_REQUIRED");
    if (typeof idempotencyKey !== "string" || !/^[A-Za-z0-9._:-]{8,200}$/.test(idempotencyKey)) fail("idempotencyKey is invalid");
    const normalized = validateEntry(entry);
    await this.init({ create: true });
    if (this.store.state === "recovery-required") {
      fail("Dictionary integrity must be recovered before mutation", "RECOVERY_REQUIRED", { missing: this.store.missing });
    }
    const lease = await acquireLease(this.paths);
    try {
      const integrity = await this.verify();
      if (!integrity.ok) fail("Dictionary integrity must be recovered before mutation", "RECOVERY_REQUIRED", { issues: integrity.issues });
      const projection = await readJson(this.paths.projection);
      const idempotency = await readJson(this.paths.idempotency);
      const requestHash = hashObject({ operation: "record-entry", entry: normalized, expectedRevision });
      const idempotencyKeyHash = sha256(idempotencyKey);
      const prior = idempotency.requests[idempotencyKeyHash];
      if (prior) {
        if (prior.requestHash !== requestHash) fail("idempotencyKey was used for a different request", "IDEMPOTENCY_CONFLICT");
        return { ...prior.result, replayed: true };
      }
      if (!Number.isInteger(expectedRevision) || expectedRevision !== projection.revision) {
        fail("expectedRevision does not match current revision", "REVISION_CONFLICT", { expectedRevision, currentRevision: projection.revision });
      }
      const previous = projection.entries[normalized.id] ?? null;
      if (!previous && normalized.provenance.role === "import" && normalized.adoptionStatus !== "pending") {
        fail("A new imported entry must start pending", "ADOPTION_REQUIRED");
      }
      if (!previous && normalized.provenance.role === "inferred" && normalized.inferenceStatus !== "pending") {
        fail("A new inferred entry must start pending", "INFERENCE_REVIEW_REQUIRED");
      }
      if (previous && previous.provenance?.role !== normalized.provenance.role) {
        fail("An entry provenance role is immutable; record a new entry instead", "PROVENANCE_IMMUTABLE");
      }
      if (previous?.provenance?.role === "import" && previous.adoptionStatus !== normalized.adoptionStatus && transition?.token !== ENTRY_TRANSITION) {
        fail("Use adopt_imported_entry for an import adoption transition", "ADOPTION_REQUIRED");
      }
      if (previous?.provenance?.role === "import" && previous.adoptionStatus !== normalized.adoptionStatus && transition?.kind !== "import") {
        fail("Import adoption transition token is invalid", "ADOPTION_REQUIRED");
      }
      if (previous?.provenance?.role === "inferred" && previous.inferenceStatus !== normalized.inferenceStatus && transition?.token !== ENTRY_TRANSITION) {
        fail("Use review_inferred_entry for an inference transition", "INFERENCE_REVIEW_REQUIRED");
      }
      if (previous?.provenance?.role === "inferred" && previous.inferenceStatus !== normalized.inferenceStatus && transition?.kind !== "inference") {
        fail("Inference review transition token is invalid", "INFERENCE_REVIEW_REQUIRED");
      }
      if (previous && normalized.supersedesRevision !== previous.revision) {
        fail("A replacement must name the current supersedesRevision", "REVISION_CONFLICT", { required: previous.revision });
      }
      if (!previous && normalized.supersedesRevision !== null) fail("supersedesRevision is only valid for an existing entry");
      const revision = projection.revision + 1;
      const committedAt = new Date().toISOString();
      const committed = { ...normalized, revision, entryRevision: (previous?.entryRevision ?? 0) + 1, committedAt };
      const event = { schemaVersion: "1.0", event: "dictionary-entry-recorded", revision, previousRevision: projection.revision, committedAt, entry: committed, previousEntryHash: previous ? hashObject(previous) : null, idempotencyKeyHash, requestHash };
      const eventHash = hashObject(event);
      const eventFile = path.join(this.paths.events, `revision-${String(revision).padStart(8, "0")}-${eventHash.slice(0, 12)}.json`);
      this.#inject("event");
      await writeFileDurable(eventFile, `${JSON.stringify(event, null, 2)}\n`, "wx");
      this.#inject("ledger");
      await appendLineDurable(this.paths.ledger, `${canonicalJson({ ...event, eventHash })}\n`);
      const nextProjection = { schemaVersion: "1.0", revision, entries: { ...projection.entries, [committed.id]: committed } };
      const result = { revision, entry: committed, eventHash };
      idempotency.requests[idempotencyKeyHash] = { requestHash, result, committedAt };
      this.#inject("projection");
      await writeJsonVersioned(this.paths.projection, nextProjection, this.paths, `r${revision}`, "projection");
      this.#inject("idempotency");
      await writeJsonVersioned(this.paths.idempotency, idempotency, this.paths, `r${revision}`, "idempotency");
      this.#inject("snapshot");
      await updateSnapshot(this.paths, nextProjection, `r${revision}`);
      return { ...result, replayed: false };
    } finally {
      await releaseLease(this.paths, lease);
    }
  }

  async pendingImports({ limit = 50 } = {}) {
    const projection = await this.projection();
    return Object.values(projection.entries)
      .filter((entry) => entry.status === "active" && entry.provenance?.role === "import" && entry.adoptionStatus === "pending")
      .sort((a, b) => b.revision - a.revision)
      .slice(0, Math.max(1, Math.min(Number(limit) || 50, 200)))
      .map((entry) => ({ ...entry, binding: bindingState(entry) }));
  }

  async pendingInferences({ limit = 50 } = {}) {
    const projection = await this.projection();
    return Object.values(projection.entries)
      .filter((entry) => entry.status === "active" && entry.provenance?.role === "inferred" && entry.inferenceStatus === "pending")
      .sort((a, b) => b.revision - a.revision)
      .slice(0, Math.max(1, Math.min(Number(limit) || 50, 200)))
      .map((entry) => ({ ...entry, binding: bindingState(entry) }));
  }

  async health() {
    await this.init();
    if (this.store.state === "recovery-required") {
      return {
        ok: false,
        status: "recovery-required",
        revision: null,
        counts: null,
        attention: ["run verify_integrity and explicitly recover only if immutable history is valid"],
        integrity: { ok: false, missing: this.store.missing },
        portableIdentityClaim: false
      };
    }
    if (this.store.state === "ready") {
      const integrity = await this.verify();
      if (!integrity.ok) {
        return { ok: false, status: "recovery-required", revision: integrity.revision, counts: integrity.counts, attention: ["run verify_integrity and explicitly recover only if immutable history is valid"], integrity: { ok: false, issues: integrity.issues }, portableIdentityClaim: false };
      }
    }
    const projection = this.store.state === "empty" ? emptyProjection() : await readJson(this.paths.projection);
    const entries = Object.values(projection.entries);
    const counts = { total: entries.length, binding: 0, pendingImports: 0, pendingInferences: 0, reviewOverdue: 0, expired: 0, inactive: 0 };
    for (const entry of entries) {
      const state = bindingState(entry);
      if (state.binding) counts.binding += 1;
      if (state.reasons.includes("import-pending")) counts.pendingImports += 1;
      if (state.reasons.includes("inference-pending")) counts.pendingInferences += 1;
      if (state.reasons.includes("review-overdue")) counts.reviewOverdue += 1;
      if (state.reasons.includes("expired")) counts.expired += 1;
      if (state.reasons.some((reason) => reason.startsWith("status-"))) counts.inactive += 1;
    }
    const attention = [];
    if (counts.pendingImports) attention.push("review pending imports before they can influence design resolution");
    if (counts.pendingInferences) attention.push("verify or reject pending inferences before they can influence design resolution");
    if (counts.reviewOverdue) attention.push("revalidate review-overdue entries");
    if (counts.expired) attention.push("replace or revoke expired entries");
    return { ok: true, status: this.store.state, revision: projection.revision, counts, attention, integrity: { ok: true, missing: [] }, portableIdentityClaim: false };
  }

  async adoptImportedEntry({ id, expectedRevision, idempotencyKey, adoptionNote, confirmAdoptionIntent } = {}) {
    if (confirmAdoptionIntent !== true) fail("confirmAdoptionIntent must be true", "CONFIRMATION_REQUIRED");
    const projection = await this.projection();
    const current = projection.entries[id];
    if (!current) fail(`Unknown entry: ${id}`);
    if (current.provenance?.role !== "import" || current.adoptionStatus !== "pending") fail("Only a pending imported entry can be adopted", "ADOPTION_REQUIRED");
    const { revision, entryRevision, committedAt, binding, match, ...entry } = current;
    return this.#recordEntry({
      entry: { ...entry, adoptionStatus: "adopted", adoptionNote, supersedesRevision: current.revision },
      expectedRevision,
      idempotencyKey,
      confirmRecordIntent: true
    }, { token: ENTRY_TRANSITION, kind: "import" });
  }

  async reviewInferredEntry({ id, expectedRevision, idempotencyKey, decision, inferenceNote, reviewEvidenceRefs, confirmInferenceReviewIntent } = {}) {
    if (confirmInferenceReviewIntent !== true) fail("confirmInferenceReviewIntent must be true", "CONFIRMATION_REQUIRED");
    if (!["verified", "rejected"].includes(decision)) fail("decision must be verified or rejected");
    const evidenceRefs = validateIdArray(reviewEvidenceRefs, "reviewEvidenceRefs", 12);
    if (evidenceRefs.length === 0) fail("reviewEvidenceRefs must contain at least one receipt", "EVIDENCE_REQUIRED");
    const projection = await this.projection();
    const current = projection.entries[id];
    if (!current) fail(`Unknown entry: ${id}`);
    if (current.provenance?.role !== "inferred" || current.inferenceStatus !== "pending") {
      fail("Only a pending inferred entry can be reviewed", "INFERENCE_REVIEW_REQUIRED");
    }
    const { revision, entryRevision, committedAt, binding, match, ...entry } = current;
    return this.#recordEntry({
      entry: {
        ...entry,
        inferenceStatus: decision,
        inferenceNote,
        provenance: { ...entry.provenance, evidenceRefs: [...new Set([...entry.provenance.evidenceRefs, ...evidenceRefs])] },
        supersedesRevision: current.revision
      },
      expectedRevision,
      idempotencyKey,
      confirmRecordIntent: true
    }, { token: ENTRY_TRANSITION, kind: "inference" });
  }

  async recordRun(args = {}) {
    if (!args || typeof args !== "object" || Array.isArray(args)) fail("record run arguments must be an object");
    for (const key of Object.keys(args)) if (!RECORD_RUN_KEYS.has(key)) fail(`record_design_run.${key} is not allowed`);
    const { run, evidenceRegistryPath, idempotencyKey, confirmRecordIntent } = args;
    if (confirmRecordIntent !== true) fail("confirmRecordIntent must be true", "CONFIRMATION_REQUIRED");
    if (typeof idempotencyKey !== "string" || !/^[A-Za-z0-9._:-]{8,200}$/.test(idempotencyKey)) fail("idempotencyKey is invalid");
    const normalizedRun = validateRun(run);
    await this.init({ create: true });
    if (this.store.state === "recovery-required") {
      fail("Dictionary integrity must be recovered before mutation", "RECOVERY_REQUIRED", { missing: this.store.missing });
    }
    const lease = await acquireLease(this.paths);
    try {
      const integrity = await this.verify();
      if (!integrity.ok) fail("Dictionary integrity must be recovered before mutation", "RECOVERY_REQUIRED", { issues: integrity.issues });
      const projection = await readJson(this.paths.projection);
      if (normalizedRun.dictionaryRevision !== projection.revision) {
        fail("run.dictionaryRevision does not match the current Dictionary revision", "REVISION_CONFLICT", { requestedRevision: normalizedRun.dictionaryRevision, currentRevision: projection.revision });
      }
      for (const id of [...normalizedRun.appliedEntryIds, ...normalizedRun.rejectedEntryIds]) {
        if (!projection.entries[id]) fail(`Design run references an unknown Dictionary entry: ${id}`, "RUN_REFERENCE_REJECTED");
      }
      for (const id of normalizedRun.appliedEntryIds) {
        const state = bindingState(projection.entries[id]);
        if (!state.binding) fail(`Design run cannot apply non-binding entry ${id}`, "RUN_REFERENCE_REJECTED", { reasons: state.reasons });
      }
      const evidenceState = normalizedRun.evidenceRefs.length
        ? await resolveEvidenceRegistry({ registryPath: evidenceRegistryPath, productId: normalizedRun.productId, evidenceRefs: normalizedRun.evidenceRefs })
        : null;
      const idempotency = await readJson(this.paths.idempotency);
      const requestHash = hashObject({
        operation: "record-run",
        run: { ...normalizedRun, recordedAt: null },
        projectionHash: hashObject(projection),
        evidenceRegistryHash: evidenceState?.registryHash ?? null
      });
      const idempotencyKeyHash = sha256(idempotencyKey);
      const prior = idempotency.requests[idempotencyKeyHash];
      if (prior) {
        if (prior.requestHash !== requestHash) fail("idempotencyKey was used for a different request", "IDEMPOTENCY_CONFLICT");
        return { ...prior.result, replayed: true };
      }
      const receipt = {
        ...normalizedRun,
        schemaVersion: "1.1",
        projectionHash: hashObject(projection),
        evidenceRegistryHash: evidenceState?.registryHash ?? null,
        evidenceBindings: evidenceState?.evidence ?? []
      };
      const receiptHash = hashObject(receipt);
      const runEvent = { schemaVersion: "1.0", event: "design-run-recorded", idempotencyKeyHash, requestHash, receipt, receiptHash };
      await appendLineDurable(this.paths.runs, `${canonicalJson(runEvent)}\n`);
      const result = { receipt, receiptHash };
      idempotency.requests[idempotencyKeyHash] = { requestHash, result, committedAt: receipt.recordedAt };
      await writeJsonVersioned(this.paths.idempotency, idempotency, this.paths, `run-${receipt.runId}`, "idempotency");
      await updateSnapshot(this.paths, projection, `run-${receipt.runId}`);
      return { ...result, replayed: false };
    } finally {
      await releaseLease(this.paths, lease);
    }
  }

  async listRuns({ limit = 50 } = {}) {
    const store = await this.#readableStore();
    if (store.state === "empty") return [];
    const runs = await readLines(this.paths.runs);
    return runs.slice(-Math.max(1, Math.min(Number(limit) || 50, 200))).reverse().map((item) => item.receipt ?? item);
  }

  async exportSanitized({ entryIds, confirmExportIntent } = {}) {
    if (confirmExportIntent !== true) fail("confirmExportIntent must be true", "CONFIRMATION_REQUIRED");
    if (!Array.isArray(entryIds) || entryIds.length === 0 || entryIds.length > 100) fail("entryIds must contain 1-100 IDs");
    const projection = await this.projection();
    const entries = entryIds.map((id) => projection.entries[id] ?? fail(`Unknown entry: ${id}`));
    for (const entry of entries) {
      if (entry.status !== "active") fail(`Entry ${entry.id} is not active and cannot be exported`, "PRIVACY_REJECTED");
      const binding = bindingState(entry);
      if (!binding.binding) fail(`Entry ${entry.id} is non-binding (${binding.reasons.join(", ")}) and cannot be exported`, "PRIVACY_REJECTED");
      if (entry.sharingClass !== "consented-candidate" || !["candidate-pattern", "outcome"].includes(entry.type)) {
        fail(`Entry ${entry.id} is not eligible for sanitized export`, "PRIVACY_REJECTED");
      }
      if (!Array.isArray(entry.portablePrinciples) || entry.portablePrinciples.length === 0 || entry.portablePrinciples.some((item) => !PORTABLE_PRINCIPLES.has(item))) {
        fail(`Entry ${entry.id} lacks reviewed portable principles`, "PRIVACY_REJECTED");
      }
      validateConsent(entry.consent, entry.sharingClass);
      if (entry.reviewAfter !== null && (!ISO_DATE.test(entry.reviewAfter) || !Number.isFinite(Date.parse(`${entry.reviewAfter}T00:00:00.000Z`)))) {
        fail(`Entry ${entry.id} has an invalid review date`, "PRIVACY_REJECTED");
      }
      sanitizedScope(entry);
    }
    const payload = {
      schemaVersion: "1.1",
      ontologyVersion: (await this.ontology()).version,
      owner: "local-user-controlled",
      reviewRequired: true,
      patterns: entries.map((entry) => ({
        candidateId: `kgj-candidate-${hashObject({ id: entry.id, revision: entry.revision }).slice(0, 16)}`,
        type: entry.type,
        scope: sanitizedScope(entry),
        traitAxes: entry.traitAxes,
        confidence: entry.confidence,
        evidenceClassCounts: { [entry.provenance.role]: 1 },
        portablePrinciples: entry.portablePrinciples,
        exclusions: ["identity", "raw-artifacts", "exact-timestamps", "private-paths", "local-history"],
        reviewAfter: entry.reviewAfter
      }))
    };
    return { payload, derivationHash: hashObject(payload), warning: "Candidates remain non-binding and cannot become another user's rule automatically." };
  }

  async verify() {
    await this.init();
    if (this.store.state === "empty") {
      return { ok: true, status: "empty", root: this.root, revision: 0, counts: { entries: 0, ledgerEvents: 0, designRuns: 0 }, hashes: null, issues: [] };
    }
    if (this.store.state === "recovery-required") {
      return { ok: false, status: "recovery-required", root: this.root, revision: null, counts: null, hashes: null, issues: this.store.missing.map((name) => `required derived store file is missing: ${name}`) };
    }
    let projection, ledger, runEvents, idempotency, snapshot;
    try {
      projection = await readJson(this.paths.projection);
      ledger = await readLines(this.paths.ledger);
      runEvents = await readLines(this.paths.runs);
      idempotency = await readJson(this.paths.idempotency);
      snapshot = await readJson(this.paths.snapshot);
    } catch (error) {
      return { ok: false, status: "recovery-required", root: this.root, revision: null, counts: null, hashes: null, issues: [`store parse/read failure: ${error.message}`] };
    }
    if (!projection || typeof projection !== "object" || !projection.entries || typeof projection.entries !== "object" || !Number.isInteger(projection.revision) || !idempotency || typeof idempotency !== "object" || !idempotency.requests || typeof idempotency.requests !== "object" || !snapshot || typeof snapshot !== "object") {
      return { ok: false, status: "recovery-required", root: this.root, revision: Number.isInteger(projection?.revision) ? projection.revision : null, counts: null, hashes: null, issues: ["derived store has an invalid structural shape"] };
    }
    const current = await buildSnapshot(this.paths, projection);
    const replay = await replayLedger(this.paths, ledger);
    const issues = [...replay.issues];
    const eventFiles = (await fs.readdir(this.paths.events)).filter((name) => /^revision-\d{8}-[a-f0-9]{12}\.json$/.test(name));
    if (eventFiles.length !== ledger.length) issues.push("immutable event files do not match ledger length");
    if (ledger.length !== projection.revision) issues.push(`ledger events ${ledger.length} != projection revision ${projection.revision}`);
    if (hashObject(replay.projection) !== hashObject(projection)) issues.push("replayed ledger projection does not match dictionary projection");
    const expectedRequests = {};
    for (const event of ledger) {
      if (event.idempotencyKeyHash) expectedRequests[event.idempotencyKeyHash] = expectedEntryIdempotency(event);
    }
    const runHistory = validateRunHistory(runEvents, replay);
    issues.push(...runHistory.issues);
    Object.assign(expectedRequests, runHistory.requests);
    for (const [key, expected] of Object.entries(expectedRequests)) {
      if (!idempotency.requests[key] || hashObject(idempotency.requests[key]) !== hashObject(expected)) issues.push(`idempotency receipt mismatch for ${key.slice(0, 12)}`);
    }
    for (const key of Object.keys(idempotency.requests)) {
      if (!(key in expectedRequests)) issues.push(`orphan idempotency receipt ${key.slice(0, 12)}`);
    }
    for (const key of ["projection", "ledger", "idempotency", "runs"]) {
      if (snapshot.hashes?.[key] !== current.hashes[key]) issues.push(`snapshot ${key} hash mismatch`);
    }
    if (snapshot.revision !== current.revision) issues.push("snapshot revision mismatch");
    return { ok: issues.length === 0, status: issues.length === 0 ? "ready" : "recovery-required", root: this.root, revision: projection.revision, counts: { entries: Object.keys(projection.entries).length, ledgerEvents: ledger.length, designRuns: current.designRuns }, hashes: current.hashes, issues };
  }

  async recover({ confirmRecoveryIntent } = {}) {
    if (confirmRecoveryIntent !== true) fail("confirmRecoveryIntent must be true", "CONFIRMATION_REQUIRED");
    await this.init();
    await Promise.all([this.paths.root, this.paths.events, this.paths.leaseArchive, this.paths.versions].map((dir) => fs.mkdir(dir, { recursive: true })));
    const lease = await acquireLease(this.paths);
    try {
      const ledger = await readLines(this.paths.ledger);
      const runEvents = await readLines(this.paths.runs);
      const replay = await replayLedger(this.paths, ledger);
      const issues = [...replay.issues];
      const eventFiles = (await fs.readdir(this.paths.events)).filter((name) => /^revision-\d{8}-[a-f0-9]{12}\.json$/.test(name));
      if (eventFiles.length !== ledger.length) issues.push("cannot recover when immutable event files do not match ledger length");
      const requests = {};
      for (const event of ledger) {
        if (!event.idempotencyKeyHash) issues.push(`cannot recover idempotency at revision ${event.revision}`);
        else requests[event.idempotencyKeyHash] = expectedEntryIdempotency(event);
      }
      const runHistory = validateRunHistory(runEvents, replay);
      issues.push(...runHistory.issues.map((issue) => `cannot recover ${issue}`));
      Object.assign(requests, runHistory.requests);
      if (issues.length) fail("Recovery blocked by invalid immutable history", "RECOVERY_BLOCKED", { issues });
      const idempotency = { schemaVersion: "1.0", requests };
      await writeJsonVersioned(this.paths.projection, replay.projection, this.paths, `recovery-r${replay.projection.revision}`, "projection");
      await writeJsonVersioned(this.paths.idempotency, idempotency, this.paths, `recovery-r${replay.projection.revision}`, "idempotency");
      await updateSnapshot(this.paths, replay.projection, `recovery-r${replay.projection.revision}`);
      return { ok: true, revision: replay.projection.revision, entries: Object.keys(replay.projection.entries).length, designRuns: runEvents.length };
    } finally {
      await releaseLease(this.paths, lease);
    }
  }
}

export { fail as dictionaryError };
