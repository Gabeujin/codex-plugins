#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
const value = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : null;
const required = ["--transcripts", "--output", "--model", "--version", "--settings"];
if (required.some((name) => !value(name))) throw new Error(`Usage: node run-transcript-evaluation.mjs ${required.join(" ")} [--manual-verdict file]`);
const here = new URL(".", import.meta.url);
const fixture = JSON.parse(await readFile(new URL("./scenarios.json", here), "utf8"));
const transcripts = JSON.parse(await readFile(value("--transcripts"), "utf8"));
const settings = JSON.parse(await readFile(value("--settings"), "utf8"));
const manual = value("--manual-verdict") ? JSON.parse(await readFile(value("--manual-verdict"), "utf8")) : null;
const known = new Set(fixture.scenarios.map((item) => item.id));
for (const item of transcripts) if (!known.has(item.scenarioId) || typeof item.transcript !== "string") throw new Error("Each transcript needs a known scenarioId and a transcript string");
if(new Set(transcripts.map(x=>x.scenarioId)).size!==transcripts.length)throw new Error('Duplicate scenario transcripts');
const result = { schemaVersion: "1.0", status: manual ? "manual-verdict-recorded" : "pending-manual-verdict", fixture: "scenarios.json", model: { name: value("--model"), version: value("--version"), settings }, transcripts: transcripts.map((item) => ({ scenarioId: item.scenarioId, sha256: createHash("sha256").update(item.transcript, "utf8").digest("hex") })), manualVerdict: manual, warning: "This runner records actual transcripts and manual review metadata. It does not score lexical matches and is not a model evaluation." };
await writeFile(value("--output"), `${JSON.stringify(result, null, 2)}\n`, {encoding:"utf8",flag:"wx"});
console.log(JSON.stringify({ status: result.status, transcriptCount: result.transcripts.length, model: result.model.name }, null, 2));
