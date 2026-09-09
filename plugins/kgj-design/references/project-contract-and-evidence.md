# Project contract and evidence registry

`kgj.design.json` is the executable handshake between a Codex project and KGJ Design. It names the
product, owner, surfaces, themes, locales, DNA source, compiled token target, evidence registry, and
unresolved decisions. Paths are project-relative and cannot escape the project root.

Run `init-project` only with explicit create intent. It refuses to overwrite an existing contract or
design source. Run `doctor` before implementation and again before release. `ready` is accepted only
when unresolved decisions are empty, linked files exist, DNA validates, the evidence registry matches
the product, every local file hash named in the registry still matches, and the compiled token header
binds the current DNA source hash plus current resolved lineage-lock hash.

## Evidence graph

Each record has a stable ID, kind, proof level, status, locator, SHA-256, capture time, supersession
link, action, result, exit status, asserted post-condition, runtime/browser environment, bounded claim
types, coverage taxonomy, finding bindings, scored-round ownership, runner attestation, and explicit
limitations. Declaration, static, build, runtime, browser, install, deployment, and user-research are different
proof levels; a higher label must never be inferred from a lower one. Browser proof names browser,
version, and viewport. Runtime proof names its runtime.

The quality command requires `--evidence-registry`. Every review, finding, and core-flow reference must
resolve to an active, passing, locally stored, hash-matching record. URL-only assertions, missing IDs,
duplicate IDs, dangling supersession, missing hashes, hash drift, failed/held results, or inactive
records fail the gate. `doctor` additionally constrains local evidence files to the declared
`paths.evidenceRoot`.

Claim labels cannot promote weak proof. `package-determinism` requires build, `install-readback`
requires install, `deployment-readback` requires deployment, and `browser-regression` requires browser
proof with browser, version, and viewport. Lineage and genome reviews use their bounded static/runtime
or research proof. The quality gate resolves the exact 15 checks in `quality-rubric.json`, verifies each
check's required proof and coverage, and forbids reuse of one check receipt across scored rounds.
Any record used as binding evidence must be active, pass, and have `exitStatus: 0`; a nonzero or null
exit never binds even when its label says pass.

## Codex workflow

1. Inspect the repository and existing product language.
2. Initialize or read `kgj.design.json`.
3. Keep evidence records separate from design decisions and mutations.
4. Resolve DNA lineage before compiling tokens.
5. Run `doctor`, runner-attested deterministic tests, full browser evidence, clean install/readback,
   a fresh ephemeral Codex MCP probe for plugin releases, then the three-round quality gate.

The fresh-session receipt is a closed command plan, not a free-form review. It binds the new task ID,
successful `kgj-design/get_ontology` event, structured ontology result, final machine-readable answer,
immutable source, package, installed cache, marketplace pin, and post-install ordering. Only the static
ontology is requested; Dictionary entries, free-form personal content, shell actions, and file changes are
outside the plan.

This contract is local and portable. It contains no credentials and must not point outside the project.
