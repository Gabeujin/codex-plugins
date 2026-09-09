#!/usr/bin/env node

import {
  createMcpRuntime,
  jsonRpcError
} from "./runtime.mjs";

const runtime = createMcpRuntime();
const maxStdinBytes = 1_048_576;
let buffer = "";
let processing = Promise.resolve();

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function invalidLineError() {
  const error = new Error(
    `JSON-RPC line exceeds ${maxStdinBytes} byte limit`
  );
  error.code = -32600;
  return error;
}

async function processLine(line) {
  if (!line.trim()) {
    return;
  }
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    writeMessage({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" }
    });
    return;
  }
  if (
    request.method?.startsWith("notifications/") ||
    request.id == null
  ) {
    return;
  }
  try {
    const result = await runtime.handleRequest(request);
    writeMessage({
      jsonrpc: "2.0",
      id: request.id,
      result
    });
  } catch (error) {
    writeMessage(jsonRpcError(error, request.id));
  }
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  if (Buffer.byteLength(buffer, "utf8") > maxStdinBytes) {
    writeMessage(jsonRpcError(invalidLineError()));
    buffer = "";
    return;
  }
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() ?? "";
  processing = processing
    .then(async () => {
      for (const line of lines) {
        await processLine(line);
      }
    })
    .catch((error) => {
      writeMessage(jsonRpcError(error));
    });
});

process.stdin.resume();
