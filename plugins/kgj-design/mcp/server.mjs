#!/usr/bin/env node
import readline from "node:readline";
import fs from "node:fs";
import { KgjMcpRuntime } from "./runtime.mjs";

const runtime = new KgjMcpRuntime();
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
const MAX_MESSAGE = 1024 * 1024;
const SERVER_VERSION = JSON.parse(fs.readFileSync(new URL("../.codex-plugin/plugin.json", import.meta.url), "utf8")).version;

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function result(id, value) {
  send({ jsonrpc: "2.0", id, result: value });
}

function failure(id, code, message, data) {
  send({ jsonrpc: "2.0", id, error: { code, message, ...(data ? { data } : {}) } });
}

rl.on("line", async (line) => {
  if (!line.trim()) return;
  if (Buffer.byteLength(line, "utf8") > MAX_MESSAGE) {
    failure(null, -32600, "Message exceeds 1 MiB");
    return;
  }
  let request;
  try { request = JSON.parse(line); } catch { failure(null, -32700, "Parse error"); return; }
  const { id = null, method, params = {} } = request;
  try {
    if (method === "initialize") {
      result(id, { protocolVersion: params.protocolVersion || "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "kgj-design", version: SERVER_VERSION } });
    } else if (method === "notifications/initialized") {
      return;
    } else if (method === "ping") {
      result(id, {});
    } else if (method === "tools/list") {
      result(id, { tools: runtime.tools() });
    } else if (method === "tools/call") {
      const content = await runtime.call(params.name, params.arguments ?? {});
      result(id, { content: [{ type: "text", text: JSON.stringify(content, null, 2) }], structuredContent: content, isError: false });
    } else {
      failure(id, -32601, `Method not found: ${method}`);
    }
  } catch (error) {
    const code = error.code === "METHOD_NOT_FOUND" ? -32601 : -32000;
    result(id, {
      content: [{ type: "text", text: `${error.code || "KGJ_ERROR"}: ${error.message}` }],
      structuredContent: { error: error.code || "KGJ_ERROR", message: error.message, details: error.data ?? {} },
      isError: true
    });
    if (code === -32601 && method !== "tools/call") failure(id, code, error.message);
  }
});

rl.on("close", () => process.exit(0));
