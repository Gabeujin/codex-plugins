import fs from "node:fs/promises";
import path from "node:path";
import { hashObject, sha256 } from "./integrity.mjs";

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/;
const SHA256 = /^[a-f0-9]{64}$/;

function fail(message, code = "EVIDENCE_REJECTED", data = {}) {
  const error = new Error(message);
  error.code = code;
  error.data = data;
  throw error;
}

function inside(base, target) {
  const relative = path.relative(base, target);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function readRegistry(registryPath) {
  if (typeof registryPath !== "string" || registryPath.trim().length === 0) {
    fail("evidenceRegistryPath is required when evidence is referenced");
  }
  const resolved = path.resolve(registryPath);
  let raw;
  try {
    raw = await fs.readFile(resolved, "utf8");
  } catch (error) {
    fail("Evidence registry cannot be read", "EVIDENCE_NOT_FOUND", { cause: error.code });
  }
  let registry;
  try {
    registry = JSON.parse(raw);
  } catch {
    fail("Evidence registry is not valid JSON");
  }
  if (!registry || typeof registry !== "object" || !Array.isArray(registry.records)) fail("Evidence registry has an invalid shape");
  if (!["1.0", "1.1"].includes(registry.schemaVersion)) fail("Evidence registry schemaVersion is unsupported");
  if (typeof registry.productId !== "string" || !/^[a-z0-9][a-z0-9-]{2,63}$/.test(registry.productId)) fail("Evidence registry productId is invalid");
  return { registry, resolved, raw };
}

function validateAttestation(record) {
  const value = record.attestation;
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`Evidence ${record.id} is missing runner attestation`);
  if (typeof value.issuer !== "string" || value.issuer.length < 3 || value.issuer.length > 120) fail(`Evidence ${record.id} has an invalid attestation issuer`);
  if (!["command", "browser", "expert-review"].includes(value.method)) fail(`Evidence ${record.id} has an invalid attestation method`);
  if (!Number.isFinite(Date.parse(value.startedAt)) || !Number.isFinite(Date.parse(value.completedAt))) fail(`Evidence ${record.id} has invalid attestation timestamps`);
  if (Date.parse(value.completedAt) < Date.parse(value.startedAt)) fail(`Evidence ${record.id} attestation completed before it started`);
  if (typeof value.toolVersion !== "string" || value.toolVersion.length < 1 || value.toolVersion.length > 120) fail(`Evidence ${record.id} has an invalid attestation toolVersion`);
  if (!SHA256.test(value.transcriptSha256 ?? "")) fail(`Evidence ${record.id} has an invalid transcriptSha256`);
}

function validateRecord(record) {
  if (!record || typeof record !== "object" || !ID.test(record.id ?? "")) fail("Evidence record id is invalid");
  if (record.status !== "active" || record.result !== "pass" || record.exitStatus !== 0) {
    fail(`Evidence ${record.id} is not an active passing receipt`);
  }
  if (!SHA256.test(record.sha256 ?? "")) fail(`Evidence ${record.id} must bind a SHA-256 artifact`);
  if (typeof record.locator !== "string" || record.locator.length < 1 || record.locator.length > 500) fail(`Evidence ${record.id} locator is invalid`);
  validateAttestation(record);
}

export async function resolveEvidenceRegistry({ registryPath, productId, evidenceRefs }) {
  const refs = Array.isArray(evidenceRefs) ? evidenceRefs : [];
  const { registry, resolved, raw } = await readRegistry(registryPath);
  if (registry.productId !== productId) fail("Evidence registry productId does not match the design run", "EVIDENCE_PRODUCT_MISMATCH");
  const uniqueRefs = [...new Set(refs)];
  if (uniqueRefs.length !== refs.length) fail("evidenceRefs must be unique");
  const byId = new Map(registry.records.map((record) => [record.id, record]));
  if (byId.size !== registry.records.length) fail("Evidence registry ids must be unique");
  const base = path.dirname(resolved);
  const realBase = await fs.realpath(base);
  const summaries = [];
  for (const ref of uniqueRefs) {
    const record = byId.get(ref);
    if (!record) fail(`Unknown evidence reference: ${ref}`, "EVIDENCE_NOT_FOUND");
    validateRecord(record);
    if (path.isAbsolute(record.locator)) fail(`Evidence ${ref} locator must be relative to its registry`);
    const artifact = path.resolve(base, record.locator);
    if (!inside(base, artifact)) fail(`Evidence ${ref} locator escapes its registry directory`);
    let realArtifact;
    let bytes;
    try {
      realArtifact = await fs.realpath(artifact);
      if (!inside(realBase, realArtifact)) fail(`Evidence ${ref} resolves outside its registry directory`);
      bytes = await fs.readFile(realArtifact);
    } catch (error) {
      if (error.code === "EVIDENCE_REJECTED") throw error;
      fail(`Evidence artifact cannot be read: ${ref}`, "EVIDENCE_NOT_FOUND", { cause: error.code });
    }
    if (sha256(bytes) !== record.sha256) fail(`Evidence artifact hash mismatch: ${ref}`, "EVIDENCE_HASH_MISMATCH");
    summaries.push({ id: ref, proofLevel: record.proofLevel, claims: [...(record.claims ?? [])], coverage: [...(record.coverage ?? [])], artifactHash: record.sha256 });
  }
  return {
    registryHash: sha256(raw),
    semanticRegistryHash: hashObject(registry),
    evidence: summaries
  };
}
