#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import { exportPublicSnapshot } from "../lib/public-export.mjs";

const pluginRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  ".."
);
const sourceDataRoot = resolve(
  process.argv[2] ??
    process.env.K_TECH_RADAR_DATA_DIR ??
    join(pluginRoot, "data")
);
const outputDataRoot = resolve(
  process.argv[3] ??
    process.env.K_TECH_RADAR_PUBLIC_DATA_DIR ??
    join(
      pluginRoot,
      "..",
      `k-tech-radar-public-data-${Date.now()}`
    )
);

const result = await exportPublicSnapshot({
  pluginRoot,
  sourceDataRoot,
  outputDataRoot,
  includePublisherExcerpts:
    process.env.K_TECH_RADAR_PUBLIC_INCLUDE_EXCERPTS ===
    "1",
  rightsConfirmed:
    process.env.K_TECH_RADAR_PUBLIC_RIGHTS_CONFIRMED ===
    "1"
});

console.log(
  JSON.stringify(
    {
      status: "ok",
      outputDataRoot,
      ...result
    },
    null,
    2
  )
);
