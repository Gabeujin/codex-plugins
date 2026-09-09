import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INITIALIZE = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } };
const LIST_TOOLS = { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} };
const EXPECTED_TOOLS = [
  "adopt_imported_entry",
  "export_sanitized_dictionary",
  "get_dictionary_entry",
  "get_dictionary_health",
  "get_ontology",
  "list_design_runs",
  "list_pending_imports",
  "list_pending_inferences",
  "prepare_design_application",
  "record_design_run",
  "record_dictionary_entry",
  "review_inferred_entry",
  "search_dictionary",
  "verify_integrity"
];
const READ_ONLY_TOOLS = new Set([
  "export_sanitized_dictionary",
  "get_dictionary_entry",
  "get_dictionary_health",
  "get_ontology",
  "list_design_runs",
  "list_pending_imports",
  "list_pending_inferences",
  "prepare_design_application",
  "search_dictionary",
  "verify_integrity"
]);

async function exchange(requests) {
  const child = spawn(process.execPath, [path.join(ROOT, "mcp", "server.mjs")], {
    cwd: ROOT,
    stdio: ["pipe", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  for (const request of requests) child.stdin.write(`${JSON.stringify(request)}\n`);
  child.stdin.end();
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  assert.equal(exitCode, 0, stderr);
  return { stdout, stderr, lines: stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) };
}

test("stdio initialization binds the manifest identity", async () => {
  const { lines } = await exchange([INITIALIZE]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].jsonrpc, "2.0");
  assert.equal(lines[0].id, 1);
  assert.equal(lines[0].result.serverInfo.name, "kgj-design");
  const manifest = JSON.parse(await fs.readFile(path.join(ROOT, ".codex-plugin", "plugin.json"), "utf8"));
  assert.equal(lines[0].result.serverInfo.version, manifest.version);
});

test("stdio tools/list exposes the closed fourteen-tool contract", async () => {
  const { lines } = await exchange([INITIALIZE, LIST_TOOLS]);
  const tools = lines[1].result.tools;
  assert.equal(tools.length, EXPECTED_TOOLS.length);
  assert.deepEqual(tools.map((tool) => tool.name).sort(), EXPECTED_TOOLS);
  for (const tool of tools) {
    assert.equal(tool.inputSchema.type, "object");
    assert.equal(tool.inputSchema.additionalProperties, false);
  }
});

test("stdio tools/list classifies every tool with closed-world safety annotations", async () => {
  const { lines } = await exchange([INITIALIZE, LIST_TOOLS]);
  const tools = lines[1].result.tools;
  assert.deepEqual(tools.map((tool) => tool.name).sort(), EXPECTED_TOOLS);
  for (const tool of tools) {
    assert.deepEqual(Object.keys(tool.annotations).sort(), [
      "destructiveHint",
      "idempotentHint",
      "openWorldHint",
      "readOnlyHint"
    ]);
    assert.equal(tool.annotations.readOnlyHint, READ_ONLY_TOOLS.has(tool.name), tool.name);
    assert.equal(tool.annotations.destructiveHint, false, tool.name);
    assert.equal(tool.annotations.idempotentHint, true, tool.name);
    assert.equal(tool.annotations.openWorldHint, false, tool.name);
  }
});

test("stdio transport emits one JSON-RPC response per request without protocol noise", async () => {
  const { stdout, stderr, lines } = await exchange([INITIALIZE, LIST_TOOLS]);
  assert.equal(stderr, "");
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map((line) => line.id), [1, 2]);
  assert.ok(lines.every((line) => line.jsonrpc === "2.0"));
  assert.equal(stdout.trim().split(/\r?\n/).length, 2);
});
