# KGJ release quality gates

## Proof levels

- **Static:** source, schema, lint, type, and deterministic checks.
- **Build:** production compilation or packaging completed.
- **Runtime:** the target loaded and executed the feature.
- **Browser interaction:** a named browser/version executed actions with asserted post-conditions.
- **Install:** marketplace source, installed cache, version, and content readback agree.
- **Deployment:** the intended deployed URL served and executed the intended build.

Higher levels are not implied by lower ones.

## Severity

- **P0:** data loss, privacy/security breach, inaccessible critical task, corrupt lineage, or unrecoverable failure.
- **P1:** core flow failure, misleading status/data, broken responsive or accessibility behavior, semantic DNA breach,
  non-deterministic release, or unsupported production claim.
- **P2:** material clarity, polish, efficiency, or maintainability defect that does not block the core flow.
- **P3:** optional refinement with no material user or release impact.

PASS requires zero unresolved P0 and P1. Record P2 owners or explicit deferrals.

## Exactly three rounds

| Round | Lens | Weight | Attack surface |
|---:|---|---:|---|
| 1 | Architecture and security | 40% | genome/expression boundary, Ontology/Dictionary privacy and integrity, compatibility, fallback, recovery |
| 2 | UX, accessibility, language, responsive, performance | 35% | main/alternate states, keyboard/touch, 200% zoom, ~390 px, long Korean text, reduced motion, console, budgets |
| 3 | Reproducibility, package, marketplace, install | 25% | deterministic source/package, manifest, skills, MCP, clean install, cache readback, proof receipts |

Fix and retest within the affected round. Do not add a fourth scored round; later checks attach to the
original round. Ledger schema 2.0 contains no caller-authored scores. The runner derives initial and
post-fix scores from the closed rubric in `quality-rubric.json` and the unresolved finding penalties.
The final score is the weighted sum of each round's post-fix score. PASS requires
`>= 9.9/10`, exactly three rounds, zero open P0/P1, and every declared core flow passing.

## Fail-closed evidence

Every check references a typed evidence-registry ID with command/action, timestamp, exit status, local
artifact path, SHA-256, result, post-condition, round, coverage taxonomy, and runner attestation.
Browser evidence adds browser/version and viewport. Command attestations must preserve and verify raw
stdout/stderr sidecars. Round 2 additionally requires the pinned KGJ browser replay, its complete trace
artifact manifest, exact nine checks, clean console/page-error set, and six mutation-detection controls.
Its scored envelope must also bind the exact replay-wrapper command, canonical source cwd, output
directory, bounded port, exit status, raw runner JSON, and inner browser transcript hash.
Only active, passing, locally stored, hash-matching records bind a release claim; URL assertions never do.
Failed evidence remains recorded and may only be resolved by a later active record that supersedes it.
Missing required proof sets the gate to HOLD regardless of score.

Claims have minimum proof levels and cannot self-promote: package determinism needs build; install
readback needs install; deployment readback needs deployment; browser regression needs browser;
lineage impact and genome review need their declared static/runtime or research proof. Evidence used for
closed-rubric checks cannot be reused across scored rounds. Binding evidence also requires `exitStatus: 0`;
metadata cannot relabel a nonzero or unknown exit as a pass. A resolved finding's evidence record must
name the finding in `findingRefs`.

The verifier recomputes each receipt's canonical transcript hash and binds its id, timestamps, tool
version, exit status, sidecars, and browser source/artifact manifests back to the registry. A narrative
JSON or screenshot alone cannot close a scored check. Scored command evidence must additionally match
its closed plan ID, allowed command vector, exact round/coverage boundary, and test-count or JSON output
contract; a successful `echo` cannot close a rubric check. The detached terminal release attestation then
binds the immutable marketplace source, complete installed cache, package bytes, ledger, registry,
marketplace pin, and final quality receipt outside the scored graph.

A fresh Codex MCP claim additionally requires a new ephemeral task event, an exact read-only tool
identity and empty argument object, a completed structured result, a matching final message, no shell or
file-change event, and a timestamp after creation of the exact installed cache. The verifier rechecks the
immutable source, deterministic package, full cache inventory, and marketplace pin. A generic review,
screenshot, resumed-task narrative, approval-blocked call, or model-only assertion cannot close it.

## Minimum release matrix

- plugin manifest and every skill validate with zero unfinished placeholders;
- Ontology, Dictionary projection/ledger/idempotency, and MCP protocol tests pass;
- all example DNA profiles resolve with no cycles or raw-value leaks;
- project contract doctor, evidence hashes, lineage locks, compatibility diff, and pattern lifecycle checks pass;
- pending imports, pending inferences, and overdue or expired Dictionary entries are proven non-binding;
- deterministic tests and two independently produced packages have identical hashes;
- desktop and approximately 390 px browser checks cover primary and alternate phenotypes;
- keyboard, focus, reduced motion, long Korean content, quantities/identifiers, overflow, and console are checked;
- personal data remains outside the plugin/cache and sanitized export is allowlisted;
- marketplace entry, installed enabled state, version, and installed source hash are read back;
- every MCP tool has an explicit closed-world safety classification, and a new Codex task completes one
  read-only ontology invocation without shell or file changes.

Validate a completed ledger with:

```powershell
python scripts/kgj_design.py quality <quality-ledger.json> --evidence-registry <evidence-registry.json>
```
