#!/usr/bin/env node

import { KgjMcpRuntime } from "../mcp/runtime.mjs";

const runtime = new KgjMcpRuntime({
  root: process.env.KGJ_VERIFY_ROOT ??
    "./.kgj-verify-runtime-not-created"
});
const tools = runtime.tools();
const ontology = await runtime.call("get_ontology", {});
let invalidRejected = false;
try {
  await runtime.call("not-a-tool", {});
} catch (error) {
  invalidRejected = error?.code === "METHOD_NOT_FOUND";
}

const annotationKeys = [
  "readOnlyHint",
  "destructiveHint",
  "idempotentHint",
  "openWorldHint"
];
const completeAnnotations = tools.every((tool) =>
  annotationKeys.every((key) =>
    typeof tool.annotations?.[key] === "boolean"
  )
);

const result = {
  status: tools.length === 14 &&
    completeAnnotations &&
    ontology?.version === "1.2.0" &&
    invalidRejected
    ? "ok"
    : "failed",
  toolCount: tools.length,
  completeAnnotations,
  ontologyVersion: ontology?.version ?? null,
  invalidToolRejected: invalidRejected,
  writesPerformed: false
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "ok") process.exitCode = 1;
