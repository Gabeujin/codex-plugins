import { createServer } from "node:http";
import {
  createHash,
  randomUUID,
  timingSafeEqual
} from "node:crypto";

import {
  createMcpRuntime,
  jsonRpcError,
  serverInfo
} from "./runtime.mjs";

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function sendJson(response, statusCode, value, headers = {}) {
  const body = `${JSON.stringify(value)}\n`;
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...headers
  });
  response.end(body);
}

async function readRequestBody(request, maxBodyBytes) {
  const declaredLength = Number(
    request.headers["content-length"] ?? 0
  );
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > maxBodyBytes
  ) {
    throw new HttpError(
      413,
      `Request body exceeds ${maxBodyBytes} byte limit`
    );
  }
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > maxBodyBytes) {
      throw new HttpError(
        413,
        `Request body exceeds ${maxBodyBytes} byte limit`
      );
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, totalBytes).toString("utf8");
}

function requestOriginAllowed(request, allowedOrigins) {
  const origin = request.headers.origin;
  if (!origin) {
    return true;
  }
  return allowedOrigins.has(origin);
}

function tokenDigest(value) {
  return createHash("sha256")
    .update(String(value), "utf8")
    .digest();
}

function requestAuthenticated(request, tokenHashes) {
  if (!tokenHashes.length) {
    return true;
  }
  const authorization = String(
    request.headers.authorization ?? ""
  );
  const match = /^Bearer\s+(.+)$/iu.exec(authorization);
  if (!match) {
    return false;
  }
  const supplied = tokenDigest(match[1]);
  return tokenHashes.some((expectedHex) => {
    if (!/^[a-f0-9]{64}$/iu.test(expectedHex)) {
      return false;
    }
    const expected = Buffer.from(expectedHex, "hex");
    return (
      expected.length === supplied.length &&
      timingSafeEqual(expected, supplied)
    );
  });
}

export function createPublicHttpServer({
  runtime = null,
  runtimeFactory = () =>
    createMcpRuntime({ publicMode: true }),
  maxBodyBytes = 65_536,
  maxHeaderBytes = 16_384,
  maxConcurrentRequests = 32,
  requestTimeoutMs = 15_000,
  allowedOrigins = [],
  bearerTokenHashes = [],
  requireAuthentication = false,
  maxRequestsPerMinute = 120,
  sessionTtlMs = 30 * 60 * 1_000,
  maxSessions = 1_024,
  maxTrackedAddresses = 4_096
} = {}) {
  const originSet = new Set(
    allowedOrigins.map((origin) => String(origin).trim()).filter(Boolean)
  );
  const normalizedTokenHashes = bearerTokenHashes
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean);
  if (
    requireAuthentication &&
    !normalizedTokenHashes.length
  ) {
    throw new Error(
      "Authentication is required but no SHA-256 bearer-token hashes were configured"
    );
  }
  let inFlight = 0;
  const sessions = new Map();
  const requestWindows = new Map();
  const createRuntime = runtime
    ? () => runtime
    : runtimeFactory;

  const server = createServer(
    {
      maxHeaderSize: maxHeaderBytes,
      requestTimeout: requestTimeoutMs,
      headersTimeout: Math.min(requestTimeoutMs, 10_000)
    },
    async (request, response) => {
      if (request.url === "/health") {
        if (request.method !== "GET") {
          sendJson(
            response,
            405,
            { error: "Method not allowed" },
            { allow: "GET" }
          );
          return;
        }
        sendJson(response, 200, {
          status: "ok",
          server: serverInfo,
          mode: "public-read-only",
          authentication:
            normalizedTokenHashes.length
              ? "bearer-sha256"
              : "none"
        });
        return;
      }
      if (request.url !== "/mcp") {
        sendJson(response, 404, { error: "Not found" });
        return;
      }
      if (request.method !== "POST") {
        sendJson(
          response,
          405,
          { error: "Method not allowed" },
          { allow: "POST" }
        );
        return;
      }
      if (!requestOriginAllowed(request, originSet)) {
        sendJson(response, 403, { error: "Origin is not allowed" });
        return;
      }
      if (
        (requireAuthentication ||
          normalizedTokenHashes.length) &&
        !requestAuthenticated(
          request,
          normalizedTokenHashes
        )
      ) {
        sendJson(
          response,
          401,
          { error: "Authentication required" },
          { "www-authenticate": "Bearer" }
        );
        return;
      }
      const remoteAddress =
        request.socket.remoteAddress ?? "unknown";
      const windowNow = Date.now();
      for (const [address, window] of requestWindows) {
        if (windowNow - window.startedAt >= 60_000) {
          requestWindows.delete(address);
        }
      }
      if (
        !requestWindows.has(remoteAddress) &&
        requestWindows.size >= maxTrackedAddresses
      ) {
        sendJson(
          response,
          429,
          { error: "Rate-limit address capacity reached" },
          { "retry-after": "60" }
        );
        return;
      }
      const priorWindow = requestWindows.get(
        remoteAddress
      ) ?? {
        startedAt: windowNow,
        count: 0
      };
      const activeWindow =
        windowNow - priorWindow.startedAt >= 60_000
          ? {
              startedAt: windowNow,
              count: 0
            }
          : priorWindow;
      activeWindow.count += 1;
      requestWindows.set(remoteAddress, activeWindow);
      if (activeWindow.count > maxRequestsPerMinute) {
        sendJson(
          response,
          429,
          { error: "Request rate limit exceeded" },
          { "retry-after": "60" }
        );
        return;
      }
      const mediaType = String(
        request.headers["content-type"] ?? ""
      )
        .split(";", 1)[0]
        .trim()
        .toLowerCase();
      if (mediaType !== "application/json") {
        sendJson(response, 415, {
          error: "Content-Type must be application/json"
        });
        return;
      }
      const contentEncoding = String(
        request.headers["content-encoding"] ?? "identity"
      ).toLowerCase();
      if (!["", "identity"].includes(contentEncoding)) {
        sendJson(response, 415, {
          error: "Compressed request bodies are not accepted"
        });
        return;
      }
      if (inFlight >= maxConcurrentRequests) {
        sendJson(
          response,
          429,
          { error: "Too many concurrent MCP requests" },
          { "retry-after": "1" }
        );
        return;
      }

      inFlight += 1;
      const abortController = new AbortController();
      const timeoutError = new HttpError(
        504,
        "MCP request exceeded execution timeout"
      );
      const timeout = setTimeout(
        () => abortController.abort(timeoutError),
        requestTimeoutMs
      );
      let requestId = null;
      try {
        const body = await readRequestBody(request, maxBodyBytes);
        let rpcRequest;
        try {
          rpcRequest = JSON.parse(body);
        } catch {
          sendJson(
            response,
            400,
            jsonRpcError(
              Object.assign(new Error("Parse error"), {
                code: -32700
              })
            )
          );
          return;
        }
        requestId = rpcRequest.id ?? null;
        if (
          !rpcRequest ||
          typeof rpcRequest !== "object" ||
          Array.isArray(rpcRequest) ||
          rpcRequest.jsonrpc !== "2.0"
        ) {
          sendJson(
            response,
            400,
            jsonRpcError(
              Object.assign(new Error("Invalid JSON-RPC request"), {
                code: -32600
              }),
              requestId
            )
          );
          return;
        }
        if (
          rpcRequest.method === "initialize" &&
          rpcRequest.id == null
        ) {
          sendJson(
            response,
            400,
            jsonRpcError(
              Object.assign(
                new Error(
                  "Initialize must be a JSON-RPC request with an id"
                ),
                { code: -32600 }
              ),
              null
            )
          );
          return;
        }
        const sessionNow = Date.now();
        for (const [sessionId, session] of sessions) {
          if (
            sessionNow - session.lastSeenAt >
            sessionTtlMs
          ) {
            sessions.delete(sessionId);
          }
        }
        let sessionId;
        let activeRuntime;
        let responseHeaders = {};
        if (rpcRequest.method === "initialize") {
          if (sessions.size >= maxSessions) {
            sendJson(
              response,
              429,
              jsonRpcError(
                Object.assign(
                  new Error(
                    "MCP session capacity reached"
                  ),
                  { code: -32003 }
                ),
                requestId
              ),
              { "retry-after": "60" }
            );
            return;
          }
          sessionId = randomUUID();
          activeRuntime = createRuntime();
          sessions.set(sessionId, {
            runtime: activeRuntime,
            createdAt: sessionNow,
            lastSeenAt: sessionNow
          });
          responseHeaders = {
            "mcp-session-id": sessionId
          };
        } else {
          sessionId = String(
            request.headers["mcp-session-id"] ?? ""
          ).trim();
          const session = sessions.get(sessionId);
          if (!session) {
            sendJson(
              response,
              400,
              jsonRpcError(
                Object.assign(
                  new Error(
                    "A valid MCP session is required"
                  ),
                  { code: -32001 }
                ),
                requestId
              )
            );
            return;
          }
          session.lastSeenAt = sessionNow;
          activeRuntime = session.runtime;
          responseHeaders = {
            "mcp-session-id": sessionId
          };
        }
        if (
          rpcRequest.method?.startsWith("notifications/") ||
          rpcRequest.id == null
        ) {
          response.writeHead(202, {
            "cache-control": "no-store",
            "content-length": "0",
            ...responseHeaders
          });
          response.end();
          return;
        }
        const operation = activeRuntime.handleRequest(
          rpcRequest,
          { signal: abortController.signal }
        );
        const result = await Promise.race([
          operation,
          new Promise((_, reject) => {
            abortController.signal.addEventListener(
              "abort",
              () => reject(abortController.signal.reason ?? timeoutError),
              { once: true }
            );
          })
        ]);
        sendJson(response, 200, {
          jsonrpc: "2.0",
          id: rpcRequest.id,
          result
        }, responseHeaders);
      } catch (error) {
        if (!response.headersSent) {
          if (error instanceof HttpError) {
            sendJson(response, error.statusCode, {
              error: error.message
            });
          } else {
            sendJson(
              response,
              200,
              jsonRpcError(error, requestId)
            );
          }
        } else {
          response.end();
        }
      } finally {
        clearTimeout(timeout);
        inFlight -= 1;
      }
    }
  );

  return server;
}
