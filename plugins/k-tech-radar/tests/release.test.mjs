import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { pluginRoot } from "../lib/paths.mjs";
import {
  allTools,
  createMcpRuntime
} from "../mcp/runtime.mjs";

const activeContractFiles = [
  "README.md",
  "SECURITY.md",
  "docs/ARCHITECTURE.md",
  "docs/DATA-GOVERNANCE.md",
  "docs/DISTRIBUTION.md",
  "submission/annotation-justifications.md",
  "submission/publication-checklist.md",
  "submission/release-notes.md",
  "skills/research-k-tech-blogs/SKILL.md",
  "skills/apply-k-tech-insights/SKILL.md",
  "skills/apply-k-tech-insights/references/fusion-and-application-contract.md",
  "skills/maintain-k-tech-catalog/SKILL.md"
];

test("submission eval pack has exactly five positive and four negative cases", async () => {
  const evals = JSON.parse(
    await readFile(
      join(pluginRoot, "submission", "evals.json"),
      "utf8"
    )
  );

  assert.equal(evals.positive.length, 5);
  assert.equal(evals.negative.length, 4);
  assert.equal(evals.pluginVersion, "0.3.0");
  assert.equal(
    new Set(
      [...evals.positive, ...evals.negative].map(
        (item) => item.id
      )
    ).size,
    9
  );
});

test("current runtime preserves tool contract and historical evaluation provenance", async () => {
  const [packageManifest, pluginManifest, evals, ...texts] =
    await Promise.all([
      readFile(join(pluginRoot, "package.json"), "utf8").then(
        JSON.parse
      ),
      readFile(
        join(
          pluginRoot,
          ".codex-plugin",
          "plugin.json"
        ),
        "utf8"
      ).then(JSON.parse),
      readFile(
        join(pluginRoot, "submission", "evals.json"),
        "utf8"
      ).then(JSON.parse),
      ...activeContractFiles.map((path) =>
        readFile(join(pluginRoot, path), "utf8")
      )
    ]);
  assert.equal(packageManifest.version, "0.4.0");
  assert.match(
    pluginManifest.version,
    /^0\.4\.0(?:\+codex\.[a-z0-9-]+)?$/u
  );
  assert.equal(evals.pluginVersion, "0.3.0");
  const localTools = createMcpRuntime().tools.map(
    (tool) => tool.name
  );
  const publicTools = createMcpRuntime({
    publicMode: true
  }).tools.map((tool) => tool.name);
  assert.equal(localTools.length, 13);
  assert.equal(publicTools.length, 9);
  for (const name of [
    "refresh_catalog",
    "record_dictionary_entry",
    "list_insight_runs",
    "record_insight_run"
  ]) {
    assert.ok(localTools.includes(name));
    assert.ok(!publicTools.includes(name));
  }
  const activeText = texts.join("\n");
  assert.doesNotMatch(activeText, /\b0\.2\.0\b/u);
  assert.doesNotMatch(activeText, /ready-for-synthesis/u);
  assert.doesNotMatch(
    activeText,
    /\b(?:ten|10) tools\b|\b(?:eight|8) read(?:-only)? tools\b/iu
  );
});

test("Docker and distribution contracts use the same fail-closed public data path", async () => {
  const [dockerfile, distribution] = await Promise.all([
    readFile(
      join(pluginRoot, "deployment", "Dockerfile"),
      "utf8"
    ),
    readFile(
      join(pluginRoot, "docs", "DISTRIBUTION.md"),
      "utf8"
    )
  ]);
  assert.match(
    dockerfile,
    /K_TECH_RADAR_DATA_DIR=\/data/u
  );
  assert.match(
    dockerfile,
    /K_TECH_RADAR_REQUIRE_AUTH=1/u
  );
  assert.match(
    distribution,
    /K_TECH_RADAR_BEARER_TOKEN_SHA256/u
  );
  assert.match(distribution, /:\/data:ro/u);
  assert.match(
    distribution,
    /export:public-snapshot/u
  );
  assert.match(
    distribution,
    /Docker is optional/u
  );
});

test("every MCP tool declares public-review metadata", () => {
  assert.equal(allTools.length, 13);
  for (const tool of allTools) {
    assert.ok(tool.title);
    assert.ok(tool.inputSchema);
    assert.ok(tool.outputSchema);
    assert.ok(
      Object.keys(tool.outputSchema.properties ?? {}).length >
        0
    );
    assert.equal(
      typeof tool.annotations.readOnlyHint,
      "boolean"
    );
    assert.equal(
      typeof tool.annotations.openWorldHint,
      "boolean"
    );
    assert.equal(
      typeof tool.annotations.destructiveHint,
      "boolean"
    );
  }
});
