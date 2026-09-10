#!/usr/bin/env node
import readline from "node:readline";
import fs from "node:fs";
import { KgjMcpRuntime } from "./runtime.mjs";

const runtime = new KgjMcpRuntime();
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
const MAX_MESSAGE = 1024 * 1024;
const SERVER_VERSION = JSON.parse(fs.readFileSync(new URL("../.codex-plugin/plugin.json", import.meta.url), "utf8")).version;
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18"];
const DEFAULT_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];
let initialized = false;
const pending = new Set();
let requestQueue = Promise.resolve();
let inputClosed = false;
let eofTimer = null;
const EOF_DRAIN_MS = 5_000;

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function result(id, value) {
  send({ jsonrpc: "2.0", id, result: value });
}

function failure(id, code, message, data) {
  send({ jsonrpc: "2.0", id, error: { code, message, ...(data ? { data } : {}) } });
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requestId(value) {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value)) || value === null;
}

function selectedProtocolVersion(value) {
  return SUPPORTED_PROTOCOL_VERSIONS.includes(value)
    ? value
    : DEFAULT_PROTOCOL_VERSION;
}

async function handleLine(line) {
  if (!line.trim()) return;
  if (Buffer.byteLength(line, "utf8") > MAX_MESSAGE) {
    failure(null, -32600, "Message exceeds 1 MiB");
    return;
  }
  let request;
  try { request = JSON.parse(line); } catch { failure(null, -32700, "Parse error"); return; }
  try {
    if (!isObject(request) || request.jsonrpc !== "2.0" || typeof request.method !== "string" || !request.method) {
      failure(null, -32600, "Invalid Request");
      return;
    }
    const hasId = Object.prototype.hasOwnProperty.call(request, "id");
    if (hasId && !requestId(request.id)) {
      failure(null, -32600, "Invalid Request");
      return;
    }
    if (request.params !== undefined && !isObject(request.params)) {
      if (hasId) failure(request.id, -32600, "Invalid Request");
      return;
    }
    const id = hasId ? request.id : null;
    const method = request.method;
    const params = request.params ?? {};
    const notify = !hasId;
    if (notify) {
      // This server has no request-like notification methods. Never let an
      // id-less tools/call execute a mutation without a response receipt.
      return;
    }
    if (method === "initialize") {
      if (params.protocolVersion !== undefined && typeof params.protocolVersion !== "string") {
        failure(id, -32602, "initialize.params.protocolVersion must be a string when supplied");
        return;
      }
      const protocolVersion = selectedProtocolVersion(params.protocolVersion);
      initialized = true;
      result(id, { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "kgj-design", version: SERVER_VERSION } });
    } else if (method === "ping") {
      result(id, {});
    } else if (!initialized) {
      failure(id, -32002, "Server not initialized");
    } else if (method === "tools/list") {
      if (!notify) result(id, { tools: runtime.tools() });
    } else if (method === "tools/call") {
      const content = await runtime.call(params.name, params.arguments ?? {});
      if (!notify) result(id, { content: [{ type: "text", text: JSON.stringify(content, null, 2) }], structuredContent: content, isError: false });
    } else {
      if (!notify) failure(id, -32601, `Method not found: ${method}`);
    }
  } catch (error) {
    const hasId = isObject(request) && Object.prototype.hasOwnProperty.call(request, "id");
    const id = hasId && requestId(request.id) ? request.id : null;
    if (!hasId) return;
    result(id, {
      content: [{ type: "text", text: `${error.code || "KGJ_ERROR"}: ${error.message}` }],
      structuredContent: { error: error.code || "KGJ_ERROR", message: error.message, details: error.data ?? {} },
      isError: true
    });
  }
}

function maybeExit() {
  if (inputClosed && pending.size === 0) {
    if (eofTimer) clearTimeout(eofTimer);
    eofTimer = null;
    process.exitCode = 0;
  }
}

rl.on("line", (line) => {
  // Stdio can close immediately after writing several requests.  Keep their
  // order and retain the work until the bounded EOF drain completes.
  const work = requestQueue.then(() => handleLine(line));
  requestQueue = work.catch(() => undefined);
  pending.add(work);
  work.finally(() => { pending.delete(work); maybeExit(); });
});

rl.on("close", () => {
  inputClosed = true;
  eofTimer = setTimeout(() => {
    if (pending.size > 0) {
      process.stderr.write(`KGJ MCP EOF drain timed out with ${pending.size} pending request(s)\n`);
      process.exitCode = 1;
    }
  }, EOF_DRAIN_MS);
  maybeExit();
});
