import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
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
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "kgj-mcp-test-"));
  const child = spawn(process.execPath, [path.join(ROOT, "mcp", "server.mjs")], {
    cwd: ROOT,
    env: { ...process.env, KGJ_DESIGN_DATA_DIR: dataDir },
    stdio: ["pipe", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  for (const request of requests) child.stdin.write(`${request?.raw ?? JSON.stringify(request)}\n`);
  child.stdin.end();
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  assert.equal(exitCode, 0, stderr);
  return { stdout, stderr, dataDir, lines: stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) };
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

test("stdio survives invalid JSON-RPC shapes and negotiates to a supported version", async () => {
  const invalid = [null, [], "text", 1, {}];
  const unsupportedInitialize = {
    jsonrpc: "2.0",
    id: 9,
    method: "initialize",
    params: { protocolVersion: "2099-01-01" }
  };
  const notification = { jsonrpc: "2.0", method: "notifications/initialized", params: {} };
  const { stderr, lines } = await exchange([...invalid, unsupportedInitialize, notification, LIST_TOOLS]);
  assert.equal(stderr, "");
  assert.equal(lines.length, invalid.length + 2);
  for (const response of lines.slice(0, invalid.length)) {
    assert.equal(response.error.code, -32600);
    assert.equal(response.id, null);
  }
  assert.equal(lines[invalid.length].result.protocolVersion, "2025-11-25");
  assert.equal(lines.at(-1).result.tools.length, EXPECTED_TOOLS.length);
});

test("stdio rejects non-finite ids and malformed initialize parameters without activating", async () => {
  const nonFiniteId = { raw: '{"jsonrpc":"2.0","id":1e999,"method":"ping","params":{}}' };
  const badProtocol = { jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: 20250618 } };
  const preInitialize = { jsonrpc: "2.0", id: 3, method: "tools/list", params: {} };
  const omittedProtocol = { jsonrpc: "2.0", id: 4, method: "initialize", params: {} };
  const { lines } = await exchange([nonFiniteId, badProtocol, preInitialize, omittedProtocol]);
  assert.deepEqual(lines.map((line) => line.id), [null, 2, 3, 4]);
  assert.deepEqual(lines.slice(0, 3).map((line) => line.error.code), [-32600, -32602, -32002]);
  assert.equal(lines[3].result.protocolVersion, "2025-11-25");
});

test("stdio responds exactly once to id-bearing notification methods", async () => {
  const withId = { jsonrpc: "2.0", id: 8, method: "notifications/initialized", params: {} };
  const { lines } = await exchange([INITIALIZE, withId]);
  assert.equal(lines.length, 2);
  assert.equal(lines[1].id, 8);
  assert.equal(lines[1].error.code, -32601);
});

test("stdio rejects requests before initialize and keeps notifications silent", async () => {
  const preInitialize = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };
  const notification = { jsonrpc: "2.0", method: "ping", params: {} };
  const { lines } = await exchange([preInitialize, notification, INITIALIZE, LIST_TOOLS]);
  assert.equal(lines.length, 3);
  assert.equal(lines[0].error.code, -32002);
  assert.equal(lines[1].result.protocolVersion, "2025-06-18");
  assert.equal(lines[2].result.tools.length, EXPECTED_TOOLS.length);
});

test("stdio drains an in-flight read before EOF and ignores request-like notifications", async () => {
  const read = { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "get_ontology", arguments: {} } };
  const notification = { jsonrpc: "2.0", method: "tools/call", params: { name: "record_dictionary_entry", arguments: {} } };
  const unknownNotification = { jsonrpc: "2.0", method: "kgj/unknown-notification", params: {} };
  const { lines, dataDir } = await exchange([INITIALIZE, notification, unknownNotification, read]);
  assert.equal(lines.length, 2);
  assert.equal(lines[1].id, 7);
  assert.equal(lines[1].result.structuredContent.promise, "portable-learning-not-portable-identity");
  assert.deepEqual(await fs.readdir(dataDir), []);
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
