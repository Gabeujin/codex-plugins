import { KgjDictionary } from "../lib/dictionary.mjs";
import { validateJsonSchema } from "../lib/json-schema-lite.mjs";

const CLOSED_READ = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
});

const ADDITIVE_IDEMPOTENT_WRITE = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
});

const TOOL_SAFETY = new Map([
  ["get_ontology", CLOSED_READ],
  ["get_dictionary_health", CLOSED_READ],
  ["list_pending_imports", CLOSED_READ],
  ["list_pending_inferences", CLOSED_READ],
  ["search_dictionary", CLOSED_READ],
  ["get_dictionary_entry", CLOSED_READ],
  ["prepare_design_application", CLOSED_READ],
  ["record_dictionary_entry", ADDITIVE_IDEMPOTENT_WRITE],
  ["adopt_imported_entry", ADDITIVE_IDEMPOTENT_WRITE],
  ["review_inferred_entry", ADDITIVE_IDEMPOTENT_WRITE],
  ["list_design_runs", CLOSED_READ],
  ["record_design_run", ADDITIVE_IDEMPOTENT_WRITE],
  ["export_sanitized_dictionary", CLOSED_READ],
  ["verify_integrity", CLOSED_READ]
]);

const TOOL_DEFINITIONS = [
  {
    name: "get_ontology",
    description: "Read the static KGJ Design ontology and privacy/resolution contract.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} }
  },
  {
    name: "get_dictionary_health",
    description: "Read binding, pending-import, overdue-review, expired, and inactive counts without mutating the Dictionary.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} }
  },
  {
    name: "list_pending_imports",
    description: "List imported entries that remain non-binding until the local user explicitly adopts them.",
    inputSchema: { type: "object", additionalProperties: false, properties: { limit: { type: "integer", minimum: 1, maximum: 200 } } }
  },
  {
    name: "list_pending_inferences",
    description: "List inferred entries that remain non-binding until an evidence-backed local review verifies or rejects them.",
    inputSchema: { type: "object", additionalProperties: false, properties: { limit: { type: "integer", minimum: 1, maximum: 200 } } }
  },
  {
    name: "search_dictionary",
    description: "Search active local design knowledge. This is read-only and returns scoped matches with authority metadata.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string" },
        types: { type: "array", items: { type: "string" } },
        context: { type: "object" },
        includeCandidates: { type: "boolean" },
        includeNonBinding: { type: "boolean", description: "Include review-only entries that cannot influence resolution." },
        limit: { type: "integer", minimum: 1, maximum: 100 }
      }
    }
  },
  {
    name: "get_dictionary_entry",
    description: "Read one current Dictionary entry by stable ID.",
    inputSchema: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string" } } }
  },
  {
    name: "prepare_design_application",
    description: "Resolve scoped Dictionary matches for a product context while preserving conflicts and explaining influence.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        context: { type: "object" },
        traitAxes: { type: "array", items: { type: "string" } },
        limit: { type: "integer", minimum: 1, maximum: 50 }
      }
    }
  },
  {
    name: "record_dictionary_entry",
    description: "Explicitly append a revisioned preference, rule, rejection, experiment, outcome, observation, or candidate pattern. Never records implicitly.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["entry", "expectedRevision", "idempotencyKey", "confirmRecordIntent"],
      properties: {
        entry: { type: "object" },
        expectedRevision: { type: "integer", minimum: 0 },
        idempotencyKey: { type: "string", minLength: 8 },
        confirmRecordIntent: { const: true }
      }
    }
  },
  {
    name: "adopt_imported_entry",
    description: "Explicitly adopt one pending imported entry as local, binding knowledge through a revisioned receipt.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id", "expectedRevision", "idempotencyKey", "adoptionNote", "confirmAdoptionIntent"],
      properties: {
        id: { type: "string", pattern: "^[a-z0-9][a-z0-9._-]{2,79}$" },
        expectedRevision: { type: "integer", minimum: 0 },
        idempotencyKey: { type: "string", minLength: 8 },
        adoptionNote: { type: "string", minLength: 3, maxLength: 240 },
        confirmAdoptionIntent: { const: true }
      }
    }
  },
  {
    name: "review_inferred_entry",
    description: "Explicitly verify or reject one pending inference. Verification requires separate evidence references and a revisioned receipt.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id", "expectedRevision", "idempotencyKey", "decision", "inferenceNote", "reviewEvidenceRefs", "confirmInferenceReviewIntent"],
      properties: {
        id: { type: "string", pattern: "^[a-z0-9][a-z0-9._-]{2,79}$" },
        expectedRevision: { type: "integer", minimum: 0 },
        idempotencyKey: { type: "string", minLength: 8 },
        decision: { enum: ["verified", "rejected"] },
        inferenceNote: { type: "string", minLength: 3, maxLength: 240 },
        reviewEvidenceRefs: { type: "array", minItems: 1, maxItems: 12, uniqueItems: true, items: { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$" } },
        confirmInferenceReviewIntent: { const: true }
      }
    }
  },
  {
    name: "list_design_runs",
    description: "List recent append-only design application and quality receipts.",
    inputSchema: { type: "object", additionalProperties: false, properties: { limit: { type: "integer", minimum: 1, maximum: 200 } } }
  },
  {
    name: "record_design_run",
    description: "Explicitly append a bounded design application or review receipt.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["run", "evidenceRegistryPath", "idempotencyKey", "confirmRecordIntent"],
      properties: {
        run: {
          type: "object",
          additionalProperties: false,
          required: ["runId", "productId", "phenotype", "dictionaryRevision", "appliedEntryIds", "rejectedEntryIds", "result", "evidenceRefs"],
          properties: {
            runId: { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{2,79}$" },
            productId: { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{2,79}$" },
            phenotype: { type: "string", pattern: "^[a-z][a-z0-9-]{2,39}$" },
            dictionaryRevision: { type: "integer", minimum: 0 },
            appliedEntryIds: { type: "array", maxItems: 100, items: { type: "string" } },
            rejectedEntryIds: { type: "array", maxItems: 100, items: { type: "string" } },
            result: { enum: ["pass", "hold", "fail"] },
            evidenceRefs: { type: "array", maxItems: 50, items: { type: "string" } }
          }
        },
        evidenceRegistryPath: { type: "string", minLength: 1, maxLength: 500 },
        idempotencyKey: { type: "string", minLength: 8 },
        confirmRecordIntent: { const: true }
      }
    }
  },
  {
    name: "export_sanitized_dictionary",
    description: "Create an in-memory allowlisted export from explicitly consented candidate patterns or outcomes. Returns no personal ledger data.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["entryIds", "confirmExportIntent"],
      properties: { entryIds: { type: "array", minItems: 1, maxItems: 100, items: { type: "string" } }, confirmExportIntent: { const: true } }
    }
  },
  {
    name: "verify_integrity",
    description: "Verify Dictionary projection, immutable ledger sequence, hashes, idempotency state, and run receipts.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} }
  }
];

const TOOLS = TOOL_DEFINITIONS.map((tool) => {
  const annotations = TOOL_SAFETY.get(tool.name);
  if (!annotations) throw new Error(`Missing MCP safety classification: ${tool.name}`);
  return { ...tool, annotations: { ...annotations } };
});

if (TOOLS.length !== TOOL_SAFETY.size) {
  throw new Error("MCP safety classifications contain an unknown tool");
}

export class KgjMcpRuntime {
  constructor(options = {}) {
    this.dictionary = new KgjDictionary(options);
  }

  tools() {
    return TOOLS;
  }

  async call(name, args = {}) {
    const tool = TOOLS.find((item) => item.name === name);
    if (!tool) {
      const error = new Error(`Unknown tool: ${name}`);
      error.code = "METHOD_NOT_FOUND";
      throw error;
    }
    validateJsonSchema(args, tool.inputSchema);
    switch (name) {
      case "get_ontology": return this.dictionary.ontology();
      case "get_dictionary_health": return this.dictionary.health();
      case "list_pending_imports": return { entries: await this.dictionary.pendingImports(args) };
      case "list_pending_inferences": return { entries: await this.dictionary.pendingInferences(args) };
      case "search_dictionary": return { entries: await this.dictionary.search(args) };
      case "get_dictionary_entry": return { entry: await this.dictionary.get(args.id) };
      case "prepare_design_application": return this.dictionary.prepareApplication(args);
      case "record_dictionary_entry": return this.dictionary.recordEntry(args);
      case "adopt_imported_entry": return this.dictionary.adoptImportedEntry(args);
      case "review_inferred_entry": return this.dictionary.reviewInferredEntry(args);
      case "list_design_runs": return { runs: await this.dictionary.listRuns(args) };
      case "record_design_run": return this.dictionary.recordRun(args);
      case "export_sanitized_dictionary": return this.dictionary.exportSanitized(args);
      case "verify_integrity": return this.dictionary.verify();
      default: throw new Error(`Unreachable tool: ${name}`);
    }
  }
}
