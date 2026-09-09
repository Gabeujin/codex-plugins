#!/usr/bin/env node

import { refreshCatalog } from "../lib/engine.mjs";

function parseArgs(values) {
  const result = {
    sourceIds: [],
    mode: "latest",
    dryRun: false
  };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--mode") {
      result.mode = values[++index];
    } else if (value === "--source" || value === "--sources") {
      result.sourceIds.push(
        ...String(values[++index] ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      );
    } else if (value === "--dry-run") {
      result.dryRun = true;
    } else if (value === "--help" || value === "-h") {
      console.log(
        "Usage: node scripts/refresh-catalog.mjs [--mode latest|backfill] [--source id[,id]] [--dry-run]"
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  if (!result.sourceIds.length) {
    delete result.sourceIds;
  }
  return result;
}

try {
  const result = await refreshCatalog(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.stack ?? error.message ?? String(error));
  process.exitCode = 1;
}
