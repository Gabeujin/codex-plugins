import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { join } from "node:path";
import test from "node:test";

import { pluginRoot } from "../lib/paths.mjs";
import { readFile } from "node:fs/promises";
import {
  allTools,
  createMcpRuntime
} from "../mcp/runtime.mjs";

test("MCP server initializes and exposes the expected tools", async (t) => {
  const child = spawn(process.execPath, [join(pluginRoot, "mcp", "server.mjs")], {
    cwd: pluginRoot,
    stdio: ["pipe", "pipe", "pipe"]
  });
  t.after(() => {
    if (!child.killed) {
      child.kill();
    }
  });

  let buffer = "";
  const responses = new Map();
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) {
        const message = JSON.parse(line);
        responses.set(message.id, message);
      }
    }
  });

  child.stdin.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "totally-unsupported" }
    })}\n`
  );
  child.stdin.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {}
    })}\n`
  );
  child.stdin.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "not_a_tool", arguments: {} }
    })}\n`
  );

  const deadline = Date.now() + 5000;
  while (
    (!responses.has(1) || !responses.has(2) || !responses.has(3)) &&
    Date.now() < deadline
  ) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  assert.equal(responses.get(1)?.result?.serverInfo?.name, "k-tech-radar");
  assert.equal(responses.get(1)?.result?.serverInfo?.version, "0.4.0");
  assert.equal(responses.get(1)?.result?.protocolVersion, "2025-11-25");
  assert.match(
    responses.get(1)?.result?.instructions ?? "",
    /untrusted third-party content/i
  );
  const names = responses
    .get(2)
    ?.result?.tools.map((tool) => tool.name);
  assert.ok(names.includes("search_articles"));
  assert.ok(names.includes("prepare_fusion_evidence"));
  assert.ok(names.includes("record_dictionary_entry"));
  assert.ok(
    responses
      .get(2)
      ?.result?.tools.every(
        (tool) => tool.title && tool.outputSchema && tool.annotations
      )
  );
  assert.equal(responses.get(3)?.error?.code, -32602);

  child.stdin.end();
  await Promise.race([
    once(child, "exit"),
    new Promise((resolve) => setTimeout(resolve, 1000))
  ]);
});

test("plugin manifest points to a canonical root MCP configuration", async () => {
  const manifest = JSON.parse(
    await readFile(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8")
  );
  assert.equal(manifest.mcpServers, "./.mcp.json");
  const servers = JSON.parse(
    await readFile(join(pluginRoot, ".mcp.json"), "utf8")
  );
  assert.equal(
    servers.mcpServers["k-tech-radar"].command,
    "node"
  );
  assert.deepEqual(servers.mcpServers["k-tech-radar"].args, [
    "./mcp/server.mjs"
  ]);
});

test("public mode hides write tools from listing and direct calls", async () => {
  const runtime = createMcpRuntime({ publicMode: true });
  await runtime.handleRequest({
    method: "initialize",
    params: { protocolVersion: "2025-11-25" }
  });
  const listed = await runtime.handleRequest({
    method: "tools/list",
    params: {}
  });
  const names = listed.tools.map((tool) => tool.name);

  assert.ok(!names.includes("refresh_catalog"));
  assert.ok(!names.includes("record_dictionary_entry"));
  assert.ok(!names.includes("record_insight_run"));
  assert.ok(!names.includes("list_insight_runs"));
  assert.ok(
    listed.tools.every(
      (tool) =>
        tool.annotations.readOnlyHint === true &&
        tool.annotations.destructiveHint === false
    )
  );
  await assert.rejects(
    runtime.handleRequest({
      method: "tools/call",
      params: {
        name: "record_dictionary_entry",
        arguments: {}
      }
    }),
    (error) => error.code === -32602
  );
});

test("local write tools have explicit non-read annotations", () => {
  const refresh = allTools.find(
    (tool) => tool.name === "refresh_catalog"
  );
  const record = allTools.find(
    (tool) => tool.name === "record_dictionary_entry"
  );

  assert.equal(refresh.annotations.readOnlyHint, false);
  assert.equal(refresh.annotations.openWorldHint, true);
  assert.equal(refresh.annotations.destructiveHint, false);
  assert.equal(record.annotations.readOnlyHint, false);
  assert.equal(record.annotations.openWorldHint, false);
  assert.equal(record.annotations.destructiveHint, false);
  assert.equal(record.annotations.idempotentHint, true);
  const evidenceInput =
    record.inputSchema.properties.entry.properties
      .qualityReview.properties.rounds.items.properties
      .evidenceRefs.items;
  assert.deepEqual(
    evidenceInput.required,
    ["kind", "content"]
  );
  assert.equal(
    evidenceInput.properties.sha256,
    undefined
  );
  const dictionaryOutput = allTools.find(
    (tool) => tool.name === "search_dictionary"
  ).outputSchema;
  const dictionaryEntry =
    dictionaryOutput.properties.entries.items.properties;
  for (const field of [
    dictionaryOutput.properties.updatedAt,
    dictionaryEntry.createdAt,
    dictionaryEntry.updatedAt,
    dictionaryEntry.recordedAt
  ]) {
    assert.equal(field.maxLength, 24);
    assert.match(
      field.pattern,
      /\\d\{4\}.*\\d\{3\}Z\$/u
    );
  }
  const insightRuns = allTools.find(
    (tool) => tool.name === "list_insight_runs"
  ).outputSchema;
  assert.equal(
    insightRuns.properties.updatedAt.maxLength,
    24
  );
  assert.equal(
    insightRuns.properties.runs.items.properties
      .createdAt.maxLength,
    24
  );
});

test("runtime enforces advertised tool input limits", async () => {
  let receivedQueryLength = null;
  const runtime = createMcpRuntime({
    publicMode: false,
    handlers: {
      search_articles: async (args) => {
        receivedQueryLength = args.query.length;
        return {
          snapshotId: "snapshot:test",
          mode: "flat",
          count: 0,
          articles: []
        };
      }
    }
  });
  await runtime.handleRequest({
    method: "initialize",
    params: { protocolVersion: "2025-11-25" }
  });
  const accepted = await runtime.handleRequest({
    method: "tools/call",
    params: {
      name: "search_articles",
      arguments: { query: "x".repeat(512) }
    }
  });
  assert.equal(accepted.isError, false);
  assert.equal(receivedQueryLength, 512);

  for (const argumentsValue of [
    { query: "x".repeat(513) },
    {
      query: "x",
      sourceIds: Array.from(
        { length: 10 },
        (_, index) => `source-${index}`
      )
    },
    { query: "x", limit: 101 },
    { query: "x", unexpected: true }
  ]) {
    await assert.rejects(
      runtime.handleRequest({
        method: "tools/call",
        params: {
          name: "search_articles",
          arguments: argumentsValue
        }
      }),
      (error) => error.code === -32602
    );
  }
});

test("runtime propagates request cancellation to tool handlers", async () => {
  let receivedSignal;
  const runtime = createMcpRuntime({
    handlers: {
      search_articles: async (_args, { signal }) => {
        receivedSignal = signal;
        return {};
      }
    }
  });
  await runtime.handleRequest({
    method: "initialize",
    params: { protocolVersion: "2025-11-25" }
  });
  const controller = new AbortController();
  await runtime.handleRequest(
    {
      method: "tools/call",
      params: {
        name: "search_articles",
        arguments: { query: "cancellation" }
      }
    },
    { signal: controller.signal }
  );
  assert.equal(receivedSignal, controller.signal);

  controller.abort(new Error("cancelled by transport"));
  await assert.rejects(
    runtime.handleRequest(
      {
        method: "tools/call",
        params: {
          name: "search_articles",
          arguments: { query: "cancelled" }
        }
      },
      { signal: controller.signal }
    ),
    /cancelled by transport/
  );
});
