#!/usr/bin/env node
import { KgjDictionary } from "../lib/dictionary.mjs";

const command = process.argv[2] || "verify";
const dictionary = new KgjDictionary();

if (command === "verify") {
  const result = await dictionary.verify();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 1;
} else if (command === "health") {
  const result = await dictionary.health();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else if (command === "pending-imports") {
  const result = await dictionary.pendingImports({ limit: 200 });
  process.stdout.write(`${JSON.stringify({ entries: result }, null, 2)}\n`);
} else if (command === "seed") {
  const projection = await dictionary.projection();
  const result = await dictionary.recordEntry({
    expectedRevision: projection.revision,
    idempotencyKey: "kgj-design-seed-candidate-v1",
    confirmRecordIntent: true,
    entry: {
      id: "candidate.explain-impact-before-style",
      type: "candidate-pattern",
      title: "Explain impact before style",
      guidance: "State the user or domain impact before prescribing a visual treatment, then name a visible success check.",
      scope: {},
      traitAxes: ["hierarchy", "voice"],
      provenance: { role: "official-source", sourceRef: "kgj-source-adaptation-records-v1", evidenceRefs: ["toss-design-system-guide", "govuk-contribution-criteria"] },
      confidence: 0.82,
      sharingClass: "private",
      retention: "review-required"
    }
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else if (command === "recover" && process.argv.includes("--confirm")) {
  const result = await dictionary.recover({ confirmRecoveryIntent: true });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  process.stderr.write("Usage: node scripts/kgj_dictionary.mjs verify | health | pending-imports | seed | recover --confirm\n");
  process.exitCode = 2;
}
