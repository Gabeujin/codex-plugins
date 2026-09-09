#!/usr/bin/env node

import { searchArticles } from "../lib/engine.mjs";

function parseArgs(values) {
  const result = {
    query: "",
    sourceIds: [],
    domainIds: [],
    problemTypeIds: [],
    limit: 20,
    crossSourceMode: "partitioned"
  };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const nextList = () =>
      String(values[++index] ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    if (value === "--query" || value === "-q") {
      result.query = values[++index] ?? "";
    } else if (value === "--source" || value === "--sources") {
      result.sourceIds.push(...nextList());
    } else if (value === "--domain" || value === "--domains") {
      result.domainIds.push(...nextList());
    } else if (value === "--problem" || value === "--problems") {
      result.problemTypeIds.push(...nextList());
    } else if (value === "--limit") {
      result.limit = Number(values[++index]);
    } else if (value === "--fusion") {
      result.crossSourceMode = "fusion-candidates";
    } else if (value === "--flat") {
      result.crossSourceMode = "flat";
    } else if (value === "--help" || value === "-h") {
      console.log(
        "Usage: node scripts/query-catalog.mjs --query text [--source id[,id]] [--domain id[,id]] [--problem id[,id]] [--fusion|--flat] [--limit N]"
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  for (const key of ["sourceIds", "domainIds", "problemTypeIds"]) {
    if (!result[key].length) {
      delete result[key];
    }
  }
  return result;
}

try {
  const result = await searchArticles(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.stack ?? error.message ?? String(error));
  process.exitCode = 1;
}
