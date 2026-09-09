import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { createPublicHttpServer } from "../mcp/http-transport.mjs";

async function startServer(options = {}) {
  const server = createPublicHttpServer(options);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function stopServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function initializeSession(baseUrl, extraHeaders = {}) {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...extraHeaders
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-11-25" }
    })
  });
  return {
    response,
    sessionId: response.headers.get("mcp-session-id")
  };
}

test("public HTTP accepts the body limit and rejects larger requests", async (t) => {
  const maxBodyBytes = 1_024;
  const { server, baseUrl } = await startServer({
    maxBodyBytes
  });
  t.after(() => stopServer(server));

  const initialize = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-11-25" }
  });
  const exactBody =
    initialize +
    " ".repeat(
      maxBodyBytes - Buffer.byteLength(initialize, "utf8")
    );
  const accepted = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: exactBody
  });
  assert.equal(accepted.status, 200);
  assert.equal(
    (await accepted.json()).result.serverInfo.name,
    "k-tech-radar"
  );
  assert.ok(accepted.headers.get("mcp-session-id"));

  const rejected = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: " ".repeat(maxBodyBytes + 1)
  });
  assert.equal(rejected.status, 413);
});

test("public HTTP rejects unsupported methods, media, encoding, and malformed JSON", async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => stopServer(server));

  const getResponse = await fetch(`${baseUrl}/mcp`);
  assert.equal(getResponse.status, 405);
  assert.equal(getResponse.headers.get("allow"), "POST");

  const mediaResponse = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "{}"
  });
  assert.equal(mediaResponse.status, 415);

  const encodedResponse = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-encoding": "gzip"
    },
    body: "{}"
  });
  assert.equal(encodedResponse.status, 415);

  const malformedResponse = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not-json"
  });
  assert.equal(malformedResponse.status, 400);
  assert.equal(
    (await malformedResponse.json()).error.code,
    -32700
  );
});

test("public HTTP exposes only read tools", async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => stopServer(server));

  const initialized = await initializeSession(baseUrl);
  const call = (body) =>
    fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "mcp-session-id": initialized.sessionId
      },
      body: JSON.stringify(body)
    });
  const listed = await call({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  });
  const payload = await listed.json();
  const names = payload.result.tools.map((tool) => tool.name);

  assert.ok(!names.includes("refresh_catalog"));
  assert.ok(!names.includes("record_dictionary_entry"));
  assert.ok(
    payload.result.tools.every(
      (tool) => tool.annotations.readOnlyHint === true
    )
  );

  const hiddenWrite = await call({
    jsonrpc: "2.0",
    id: 42,
    method: "tools/call",
    params: {
      name: "record_dictionary_entry",
      arguments: {}
    }
  });
  const hiddenPayload = await hiddenWrite.json();
  assert.equal(hiddenPayload.id, 42);
  assert.equal(hiddenPayload.error.code, -32602);

  const invalidInput = await call({
    jsonrpc: "2.0",
    id: 43,
    method: "tools/call",
    params: {
      name: "search_articles",
      arguments: {
        query: "x".repeat(513)
      }
    }
  });
  const invalidPayload = await invalidInput.json();
  assert.equal(invalidPayload.id, 43);
  assert.equal(invalidPayload.error.code, -32602);
});

test("public HTTP caps concurrency and times out slow handlers", async (t) => {
  let observedAbort = false;
  const runtime = {
    async handleRequest(request, { signal }) {
      if (request.method === "initialize") {
        return {
          protocolVersion: "2025-11-25",
          serverInfo: {
            name: "test-runtime",
            version: "1"
          }
        };
      }
      signal.addEventListener(
        "abort",
        () => {
          observedAbort = true;
        },
        { once: true }
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
      return {};
    }
  };
  const { server, baseUrl } = await startServer({
    runtime,
    maxConcurrentRequests: 1,
    requestTimeoutMs: 50
  });
  t.after(() => stopServer(server));
  const initialized = await initializeSession(baseUrl);
  const request = (id) =>
    fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "mcp-session-id": initialized.sessionId
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "ping"
      })
    });

  const slowResponsePromise = request(1);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const busyResponse = await request(2);
  const slowResponse = await slowResponsePromise;

  assert.equal(busyResponse.status, 429);
  assert.equal(slowResponse.status, 504);
  assert.equal(observedAbort, true);
});

test("public HTTP requires an isolated MCP session", async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => stopServer(server));
  const missingSession = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/list",
      params: {}
    })
  });
  const missingPayload = await missingSession.json();
  assert.equal(missingSession.status, 400);
  assert.equal(missingPayload.error.code, -32001);

  const first = await initializeSession(baseUrl);
  const second = await initializeSession(baseUrl);
  assert.ok(first.sessionId);
  assert.ok(second.sessionId);
  assert.notEqual(first.sessionId, second.sessionId);
});

test("id-less initialize cannot consume a public session slot", async (t) => {
  const { server, baseUrl } = await startServer({
    maxSessions: 1
  });
  t.after(() => stopServer(server));

  const notification = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "initialize",
      params: { protocolVersion: "2025-11-25" }
    })
  });
  const notificationPayload = await notification.json();
  assert.equal(notification.status, 400);
  assert.equal(notificationPayload.error.code, -32600);
  assert.equal(
    notification.headers.get("mcp-session-id"),
    null
  );

  const initialized = await initializeSession(baseUrl);
  assert.equal(initialized.response.status, 200);
  assert.ok(initialized.sessionId);
});

test("public HTTP can require SHA-256 bearer authentication", async (t) => {
  const { createHash } = await import("node:crypto");
  const token = "local-test-token-123";
  const digest = createHash("sha256")
    .update(token)
    .digest("hex");
  const { server, baseUrl } = await startServer({
    requireAuthentication: true,
    bearerTokenHashes: [digest]
  });
  t.after(() => stopServer(server));
  const denied = await initializeSession(baseUrl);
  assert.equal(denied.response.status, 401);
  const allowed = await initializeSession(baseUrl, {
    authorization: `Bearer ${token}`
  });
  assert.equal(allowed.response.status, 200);
  assert.ok(allowed.sessionId);
});
