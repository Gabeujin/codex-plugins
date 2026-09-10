# KGJ Design

Install `kgj-design@gabeujin-plugins` using the [shared installation guide](https://github.com/Gabeujin/codex-plugins/blob/main/README.md). Existing users should read [updates and data preservation](https://github.com/Gabeujin/codex-plugins/blob/main/docs/INSTALL-AND-UPDATE.md). Copy-ready starter commands are in [First use](https://github.com/Gabeujin/codex-plugins/blob/main/docs/FIRST-USE.md).

KGJ Design is a product-DNA architecture for creating related products without making replicas.
It preserves semantic behavior, accessibility, data truth, and evidence boundaries while letting each
product re-express density, typography, color, shape, motion, voice, and signature moments. A local
Ontology and Dictionary learn each user's scoped preferences, rejections, experiments, and verified
outcomes without pooling personal identities.

## Architecture

```text
product evidence
  -> kgj.design.json project contract
  -> typed evidence registry
  -> closed seven-contract genome and lineage lock
  -> token graph
  -> product DNA expression pack
  -> components and domain patterns
  -> web, HTML report, Markdown, or spatial phenotype
  -> expert review board and compatibility ledger
  -> runner-attested three-round release gate
```

The mutable Dictionary lives outside the installed plugin. `KGJ_DESIGN_DATA_DIR` may override the
default per-user application-data directory. Recording is explicit, revisioned, idempotent, and
blocked whenever semantic replay detects interrupted state. Imported knowledge and inferred
knowledge both remain non-binding until their separate evidence-backed review transition;
personal entries are local by default. Distribution uses sanitized candidate-pattern exports only,
never another user's raw preference ledger or free-form title/guidance.

The MCP catalog classifies every tool with the standard read-only, destructive, idempotent, and
open-world hints. Static and Dictionary reads are closed-world and read-only. Revisioned writes are
closed-world, additive, and idempotent for the same request key. These hints improve Codex approval
routing; runtime confirmation fields, revision checks, privacy rules, and ledger integrity remain the
enforced safety boundary.

The primary entry point is `kgj-design-orchestrator`. Focused skills handle project adoption, DNA
discovery, web experiences, HTML reports, Markdown artifacts, pattern lifecycle, system evolution,
Dictionary curation, expert cross-review, and the three-round release audit.

## Deterministic tools

```powershell
python scripts/kgj_design.py validate .
python scripts/kgj_design.py init-project ./product --product-id product-id --name "Product" --domain "Domain" --owner "Owner" --confirm-create
python scripts/kgj_design.py doctor ./product/kgj.design.json
python scripts/kgj_design.py evidence-check ./product/design/evidence-registry.json --verify-files --source-root ./product
python scripts/kgj_design.py resolve-lineage examples/dna/regulated-operations.json --output ./artifacts/regulated-operations.lock.json
python scripts/kgj_design.py diff-dna ./product-v1.2.json ./product-next.json
python scripts/kgj_design.py migration-plan ./product-v1.2.json ./product-next.json --evidence-registry ./evidence-registry.json --evidence-ref migration.proof --owner "Product Design" --rollback-target "product@1.2"
python scripts/kgj_design.py pattern-check ./pattern.json --evidence-registry ./evidence-registry.json
python scripts/kgj_design.py compile examples/dna/operations-console.json examples/compiled/operations-console.css
python scripts/kgj_design.py compile examples/dna/regulated-operations.json ./artifacts/regulated-operations.css --lineage-lock ./artifacts/regulated-operations.lock.json
python -m unittest discover -s tests -v
python scripts/kgj_design.py tree-hash .
python scripts/kgj_design.py install-audit . ./installed-cache --package ./artifacts/kgj-design.zip
python scripts/kgj_design.py install-readback ./marketplace-source ./installed-cache --package ./artifacts/kgj-design.zip
python scripts/kgj_design.py package-compare ./artifacts/kgj-design-a.zip ./artifacts/kgj-design-b.zip
python scripts/kgj_design.py package . ./artifacts/kgj-design.zip
python scripts/kgj_attest.py --output ./evidence/python-tests.json --id evidence.r1.python-governance-tests --plan-id evidence.r1.python-governance-tests --cwd . -- python -B -m unittest discover -s tests -v
node scripts/kgj_dictionary.mjs verify
node scripts/kgj_dictionary.mjs health
python scripts/kgj_attest.py --output ./evidence/r2-browser-replay-execution.json --id evidence.r2.browser-replay-execution --plan-id evidence.r2.browser-replay-execution --cwd . -- pwsh -NoProfile -File ./scripts/Invoke-KgjBrowserReplay.ps1 -OutputDirectory ./evidence/r2-browser-replay -Port 8768
python scripts/kgj_design.py browser-envelope --source . --browser-receipt ./evidence/r2-browser-replay/browser-replay-receipt.json --execution-receipt ./evidence/r2-browser-replay-execution.json --output ./evidence/r2-browser-evidence-envelope.json
```

If verification detects an interrupted projection update and the immutable event files and ledgers are
valid, an operator can explicitly rebuild projection, idempotency, and snapshot state with
`node scripts/kgj_dictionary.mjs recover --confirm`. The command versions the prior state and refuses
recovery when immutable history fails semantic replay.

## Choose the smallest workflow

| Request | Skill or command | Minimum result | State change |
| --- | --- | --- | --- |
| Small screen or component improvement | `design-web-experience` | scoped design recommendation and proportionate checks | none unless separately authorized |
| Adopt KGJ in a product | `adopt-kgj-design` | project contract and lineage decision | creates only with the command's confirmation |
| Review a release | `audit-kgj-design` | evidence-bound three-round audit | records evidence only when explicitly requested |
| Compare DNA changes | `preview-dna current.json next.json --output <outside-project>` | static before/after preview, diff, and source hashes | writes a new preview folder only; never applies changes |

For a safe offline first result, inspect `examples/offline-mcp-example.json`. It is synthetic, needs no network or Dictionary write, and must never be treated as research or product evidence.

`preview-dna` compiles both inputs into a new output folder containing `index.html`, `before.css`, `after.css`, and `preview.json`. It rejects an existing output directory and can pin each input with `--expected-current-sha256` and `--expected-next-sha256`; a hash mismatch fails before writing the preview. The preview is informational and cannot apply a change to either source project. Direct and lineage inputs are re-hashed after generation; a concurrent change prevents publication of the requested folder and retains a failed staging directory with preview-status.json for inspection.

`package` is deterministic, rejects output inside the plugin tree, rejects symlinks, and excludes
runtime caches. `quality` accepts ledger schema 2.0 only; callers cannot provide scores. The runner
derives all three round scores from the versioned 15-check rubric, finding state, evidence proof level,
round ownership, coverage, artifact hash, and attestation. It fails below 9.9, on any unresolved P0/P1,
or when a core flow is unproven. Build, runtime, browser, install, and deployment are distinct proof
levels. A resolved finding's receipt must name that finding ID.

`kgj_attest.py` executes an argument vector without a shell, preserves stdout and stderr as hash-bound
nonce-scoped sidecars, refuses to overwrite an existing receipt, preserves partial sidecars without blocking
a clean retry, and treats output capture above 1,000,000 bytes as HOLD.
Scored Round 1 and Round 3 receipts also bind a closed plan ID; the verifier rejects a successful but
irrelevant command, insufficient test count, or malformed machine-readable result. Never put credentials
or secrets in the command arguments.

The Round 3 fresh-session plan launches an ephemeral Codex CLI task through
`Invoke-FreshCodexCli.ps1` in a read-only sandbox and captures JSONL. It accepts exactly one new task,
one successful `kgj-design/get_ontology` call with the structured ontology identity, one matching final
message, and no shell or file-change event. It also binds the immutable source, package, installed cache,
marketplace pin, and post-install timeline. Approval failures and narrative-only success claims fail closed.

Round 2 release evidence must come from `Invoke-KgjBrowserReplay.ps1`. It pins Playwright CLI, serves
the exact local source, preserves action/network/resource traces, semantic snapshots, console output,
two reduced-motion frames, and nine assertions. Six injected mutants prove that global-tab leakage,
stale phenotype data, dialog/mobile state drift, reduced-motion frame work, and zoom overflow make the replay fail. Narrative screenshots remain useful review evidence but do
not close the browser gate by themselves. The scored record is a browser evidence envelope that binds
the inner receipt to a `kgj-attest` execution receipt with the exact PowerShell script, source cwd,
output directory, port, exit status, raw stdout, inner receipt path, and transcript hash.

## Proof boundary

Static validation is not browser or deployment proof. A production claim also needs named-browser
interaction evidence at desktop and approximately 390 CSS pixels, keyboard and reduced-motion
checks including 200% zoom and long Korean content, a clean console, deterministic build evidence,
and distinct marketplace/install/version/source-cache readback. An install audit compares every cache
file with the package and fails on ignored executable residue. KGJ Design runs as an on-demand Codex
stdio MCP process and opens no listener; if it later becomes a persistent local service, publish that
service through the governed AX Store runtime workflow instead of desktop auto-start.

The optional fresh-session attestation workflow requires PowerShell and an operator-provided `Invoke-FreshCodexCli.ps1` under the user Codex scripts directory. This wrapper is not bundled. It is not required for ordinary local MCP use, DNA preview, or public unit tests; without it that particular attestation stays unverified.
