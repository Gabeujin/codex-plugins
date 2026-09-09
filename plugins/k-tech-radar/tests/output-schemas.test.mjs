import assert from "node:assert/strict";
import test from "node:test";
import {
  allTools,
  createMcpRuntime,
  validateSchema
} from "../mcp/runtime.mjs";
import {
  reviewEvidenceOutputRefSchema
} from "../lib/review-evidence.mjs";

function assertClosedSchema(schema, path) {
  if (!schema || typeof schema !== "object") {
    assert.fail(`${path} must be a schema object`);
  }
  const types = Array.isArray(schema.type)
    ? schema.type
    : schema.type
      ? [schema.type]
      : [];
  if (types.includes("object")) {
    assert.ok(
      schema.additionalProperties === false ||
        (schema.additionalProperties &&
          typeof schema.additionalProperties === "object"),
      `${path} must close or type additional properties`
    );
  }
  if (types.includes("array")) {
    assert.ok(schema.items, `${path} must type array items`);
  }
  for (const [name, child] of Object.entries(
    schema.properties ?? {}
  )) {
    assertClosedSchema(child, `${path}.properties.${name}`);
  }
  if (
    schema.additionalProperties &&
    typeof schema.additionalProperties === "object"
  ) {
    assertClosedSchema(
      schema.additionalProperties,
      `${path}.additionalProperties`
    );
  }
  if (schema.items) {
    assertClosedSchema(schema.items, `${path}.items`);
  }
  for (const keyword of ["anyOf", "oneOf", "allOf"]) {
    (schema[keyword] ?? []).forEach((child, index) =>
      assertClosedSchema(
        child,
        `${path}.${keyword}[${index}]`
      )
    );
  }
}

test("all MCP output object and array schemas are closed and typed", () => {
  assert.equal(allTools.length, 13);
  for (const tool of allTools) {
    assertClosedSchema(
      tool.outputSchema,
      `${tool.name}.outputSchema`
    );
  }
});

test("runtime rejects an undeclared nested response field", async () => {
  const runtime = createMcpRuntime({
    handlers: {
      get_source_status: async () => ({
        snapshotId: "snapshot:test",
        snapshotVisibility: "local",
        snapshotCommittedAt: "2026-07-30T00:00:00.000Z",
        collection: {
          status: "ok"
        },
        changeSet: {},
        catalogRefreshedAt: null,
        totalArticles: 0,
        sources: [
          {
            sourceId: "source-a",
            companyId: "company-a",
            displayName: "Source A",
            homepage: "https://example.com",
            authority: "official",
            adapterType: "feed",
            articleCount: 0,
            excludedRecordCount: 0,
            collection: {
              status: "ok"
            },
            partition: {
              snapshotId: "snapshot:test",
              dataAsOf: null,
              sourceHash: null
            },
            privateNotes: "must never escape"
          }
        ],
        nonIngestedReferences: []
      })
    }
  });
  await runtime.handleRequest({
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25"
    }
  });
  const response = await runtime.handleRequest({
    method: "tools/call",
    params: {
      name: "get_source_status",
      arguments: {}
    }
  });
  assert.equal(response.isError, true);
  assert.match(
    response.content[0].text,
    /unsupported properties: privateNotes/
  );
});

test("runtime oneOf validates local and public review receipts exactly", () => {
  const base = {
    artifactId: `review-artifact:${"a".repeat(64)}`,
    kind: "review-report",
    sha256: "a".repeat(64),
    bytes: 12,
    subjectHash: "b".repeat(64),
    round: 1
  };
  assert.doesNotThrow(() =>
    validateSchema(
      { ...base, content: "review bytes" },
      reviewEvidenceOutputRefSchema,
      "result.evidenceRef"
    )
  );
  assert.doesNotThrow(() =>
    validateSchema(
      { ...base, contentWithheld: true },
      reviewEvidenceOutputRefSchema,
      "result.evidenceRef"
    )
  );
  assert.throws(
    () =>
      validateSchema(
        {
          ...base,
          content: "review bytes",
          privatePath: "C:\\private\\review.txt"
        },
        reviewEvidenceOutputRefSchema,
        "result.evidenceRef"
      ),
    /exactly one allowed schema/
  );
  assert.throws(
    () =>
      validateSchema(
        {
          ...base,
          content: "review bytes",
          contentWithheld: true
        },
        reviewEvidenceOutputRefSchema,
        "result.evidenceRef"
      ),
    /exactly one allowed schema/
  );
});

test("refresh_catalog output accepts structured warning objects end to end", async () => {
  const runtime = createMcpRuntime({
    handlers: {
      refresh_catalog: async () => ({
        checkedAt: "2026-07-30T00:00:00.000Z",
        mode: "latest",
        dryRun: true,
        sourceReports: [
          {
            sourceId: "source-a",
            status: "partial",
            articleCountSeen: 1,
            durationMs: 12,
            warnings: [
              {
                stage: "article-metadata",
                candidateUrl:
                  "https://example.com/article",
                error: "metadata unavailable"
              }
            ]
          }
        ],
        delta: {
          newCount: 0,
          updatedCount: 0,
          reclassifiedCount: 0,
          migratedCount: 0,
          unchangedCount: 1,
          newArticleIds: [],
          updatedArticleIds: [],
          reclassifiedArticleIds: [],
          migratedArticleIds: []
        },
        catalogRecordCount: 1,
        activeArticleCount: 1,
        countsBySource: {
          "source-a": 1
        },
        status: "partial",
        snapshotId: "snapshot:test",
        integrityHash: "a".repeat(64),
        taxonomyChanged: false
      })
    }
  });
  await runtime.handleRequest({
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25"
    }
  });
  const response = await runtime.handleRequest({
    method: "tools/call",
    params: {
      name: "refresh_catalog",
      arguments: {
        dryRun: true
      }
    }
  });
  assert.equal(response.isError, false);
  assert.equal(
    response.structuredContent.sourceReports[0]
      .warnings[0].stage,
    "article-metadata"
  );
});
