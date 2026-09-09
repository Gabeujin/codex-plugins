#!/usr/bin/env node

import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  ".."
);
const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "coverage"
]);
const patterns = [
  {
    id: "openai-api-key",
    expression: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g
  },
  {
    id: "github-token",
    expression: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g
  },
  {
    id: "aws-access-key",
    expression: /\bAKIA[0-9A-Z]{16}\b/g
  },
  {
    id: "private-key",
    expression:
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g
  }
];

async function filesBelow(directory) {
  const result = [];
  for (const entry of await readdir(directory, {
    withFileTypes: true
  })) {
    if (
      entry.isDirectory() &&
      ignoredDirectories.has(entry.name)
    ) {
      continue;
    }
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await filesBelow(path)));
    } else if (entry.isFile()) {
      result.push(path);
    }
  }
  return result;
}

const findings = [];
for (const path of await filesBelow(pluginRoot)) {
  const metadata = await stat(path);
  if (metadata.size > 8_000_000) {
    continue;
  }
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch {
    continue;
  }
  for (const pattern of patterns) {
    pattern.expression.lastIndex = 0;
    for (const match of text.matchAll(pattern.expression)) {
      const before = text.slice(0, match.index);
      findings.push({
        rule: pattern.id,
        file: relative(pluginRoot, path).replaceAll("\\", "/"),
        line: before.split(/\r?\n/).length
      });
    }
  }
}

console.log(
  JSON.stringify(
    {
      status: findings.length ? "failed" : "ok",
      filesScanned: (await filesBelow(pluginRoot)).length,
      findingCount: findings.length,
      findings
    },
    null,
    2
  )
);

if (findings.length) {
  process.exitCode = 1;
}
