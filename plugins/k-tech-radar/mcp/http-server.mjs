#!/usr/bin/env node

import { createPublicHttpServer } from "./http-transport.mjs";
import { getSourceStatus } from "../lib/engine.mjs";

const port = Number(process.env.PORT ?? 43783);
const host = process.env.HOST ?? "127.0.0.1";
const allowedOrigins = String(
  process.env.K_TECH_RADAR_ALLOWED_ORIGINS ?? ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const bearerTokenHashes = String(
  process.env.K_TECH_RADAR_BEARER_TOKEN_SHA256 ?? ""
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const loopbackHosts = new Set([
  "127.0.0.1",
  "::1",
  "localhost"
]);
const requireAuthentication =
  process.env.K_TECH_RADAR_REQUIRE_AUTH === "1" ||
  (!loopbackHosts.has(host) &&
    process.env
      .K_TECH_RADAR_ALLOW_UNAUTHENTICATED_PUBLIC !==
      "1");

if (
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65_535
) {
  throw new Error("PORT must be an integer from 1 to 65535");
}

await getSourceStatus({}, { publicMode: true });

const server = createPublicHttpServer({
  allowedOrigins,
  bearerTokenHashes,
  requireAuthentication
});

server.listen(port, host, () => {
  process.stderr.write(
    `${JSON.stringify({
      event: "k-tech-radar-http-ready",
      host,
      port,
      endpoint: `http://${host}:${port}/mcp`,
      mode: "public-read-only",
      authentication: bearerTokenHashes.length
        ? "bearer-sha256"
        : "none",
      tls:
        "Terminate HTTPS at the production reverse proxy or managed runtime."
    })}\n`
  );
});

function shutdown(signal) {
  server.close((error) => {
    if (error) {
      process.stderr.write(
        `${JSON.stringify({
          event: "k-tech-radar-http-stop-error",
          signal,
          error: error.message
        })}\n`
      );
      process.exitCode = 1;
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
