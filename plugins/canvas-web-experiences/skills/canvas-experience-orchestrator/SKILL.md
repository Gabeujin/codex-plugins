---
name: canvas-experience-orchestrator
description: Complete a Canvas web experience in one invocation from discovery, product DNA, evidence, three diverse visual concepts, ontology, architecture, implementation, real-browser correction, exactly three negative quality rounds, packaging, and evidence-backed learning. Use for broad build requests where the user wants a finished high-quality portfolio, game, map, diagram, plan, visualization, spatial product, digital twin, or experimental HTML-in-Canvas feature without manually chaining multiple skills.
---

# Canvas Experience Orchestrator

Own the whole outcome. Do not return a plan when safe in-scope implementation and verification remain possible.

## Choose a proportional engagement

Read [the task-first improvement contract](../../references/task-first-improvement-contract.md) before selecting scope.

- **Prototype**: choose a rendering approach and deliver one semantic, fallback-capable task slice. Do not require three concepts, package installation, learning, or a 9.9 score unless the user asks for them.
- **Feature**: implement and correct a bounded user task. Verify the changed task, actual reset/return behavior, and the target layout in a browser when one is available. Keep evidence scoped to the changed feature.
- **Release**: use the complete workflow below, including the three-round gate, package/readback, and learning receipt.

If scope is unclear, start at Feature rather than silently treating a small request as a release. Escalate only when the user asks for release readiness or the change materially affects the experimental runtime contract.

## Required references

For every mode, read:

- `../../references/work-ontology.md`
- `../../references/domain-routing.md`
- `../../references/design-quality-system.md`

For Feature or Release, also read `../../references/architecture-patterns.md` and `../../references/qa-gates.md`. Read `../../references/one-shot-operating-system.md` only for Release.

For experimental HTML-in-Canvas, also read `../../references/official-sources.md`, `../../references/html-in-canvas-recipes.md`, `../../references/html-in-canvas-capability-contract-v2.md`, `../../references/demo-modernization-ledger-v3.md`, and `../../references/early-adopter-playbook.md`. Pin the exact proposal/API generation tested. Upstream may use names such as `drawable`, `updateElementGeometry`, `texElementSubImage2D`, or `drawElementImageToTexture`; do not rename or migrate existing calls from an unverified document or capability check. Record the pinned source/date and verify exact execution before changing an API generation.

For a bundled reference implementation, read `../../demo/README.md` and use `$canvas-demo-lab` patterns internally; the user does not need to invoke another skill.

## Workflow

### 1. Discover and materialize intent

Inspect the target project, design system, dirty work, build/runtime commands, supported browsers, and existing evidence. Create or update a project-local `canvas-experience.json` with `scripts/canvas_experience.py init`. Record outcome, audience, non-goals, Product DNA, host invariants, device/accessibility constraints, budgets, and the experimental fallback boundary.

### 2. Research only what can change the decision

Prefer official specifications/status, original papers, official project docs/repos, and primary design sources. Capture dates, license boundaries, maturity, and uncertainty. Do not let research replace implementation.

### 3. Produce three diverse concepts (Release only)

Use ImageGen for a substantial interface. Create `Aligned`, `Stretch`, and `Frontier` full-screen or state-board directions with desktop and mobile/state detail. Score task clarity, host identity, interaction legibility, accessibility, implementation fit, and creative distinction. Select one and record why the others were rejected.

### 4. Build the concept-to-code ledger (Feature and Release)

Map at least five defining concept details to exact code owners, responsive behavior, interaction states, semantic equivalents, and screenshot acceptance checks. Freeze copy, tokens, renderer/fallback decisions, and performance budgets.

### 5. Implement the vertical slice and expand

Build the dominant scene and primary interaction first, then alternate states and domain adapters. Keep navigation, task instructions, forms, settings, and status in semantic DOM; make the task surface and its next action more prominent than diagnostics. Put capability matrices, frame counters, receipts, and experimental switches behind an explicit Evidence/Developer disclosure. Keep semantic app chrome in DOM, isolate high-frequency state, cap DPR, dispose runtime resources, and keep HTML-in-Canvas behind a trusted-content adapter with DOM fallback and kill switch.

When the requested experience spans multiple domains, maintain a per-domain modernization ledger. Each row must name the source DOM semantics, native lane, unique non-overlay value, fallback, primary interaction, responsive risk, and browser proof. Do not expand a reference pattern to the remaining domains until one Canvas 2D lane and one GPU lane correctly handle `paint`, current IDL upload, measured transform synchronization, meaningful-change repaint coalescing, failure retirement, and state continuity.

### 6. Correct in a real browser (Feature and Release)

Use the in-app Browser first and the user's Chrome when existing Chrome state or the experimental profile matters. Verify identity, nonblank rendering, console, asset loads, pointer/keyboard/touch alternatives, the target desktop/mobile layouts, overflow, reduced motion, fallback, and frame budget in proportion to scope. Assert actual actions rather than intended UI: each changed primary action needs a pre-state, action, durable post-state, and reset/cancel/return assertion when offered. Test navigation as a task path (selection, route/state return, and focus), not merely a visible active badge. Compare screenshots with the selected concept on at least five ledger items before Release scoring.

Browser evidence is fail-closed. Reacquire locators after every navigation, snapshot, rerender, or responsive change; never reuse stale element references. For each claimed interaction, record the successful action command, exit code, pre-state, asserted post-state, browser/version, viewport, and artifact. For experimental native lanes also record exact IDL arguments, snapshot phase, changed source IDs, measured alignment, and resource ownership. A failed click, keypress, navigation, screenshot, console check, or connection attempt remains a finding until a later successful command explicitly supersedes it. Intended actions and screenshots without a post-condition are not pass evidence.

### 7. Close exactly three negative rounds (Release only)

Run the 40/35/25 hard gate from `qa-gates.md`. Fix P0/P1 and retest within the same round. Final score must be at least 99/100. Later regression work attaches evidence to the existing round and never invents a fourth round.

### 8. Package and learn (Release only)

Run deterministic tests/build/package checks. If the task is a plugin, validate, cache-bust, reinstall, and read back enabled state. Create the pre-learning `one-call-receipt.json` from `../../assets/templates/one-call-receipt.json` with only the `learn` stage pending and `learning-append-pending` unresolved.

Bind learning to successful receipt evidence with `python scripts/canvas_experience.py learn --spec canvas-experience.json --receipt one-call-receipt.json --evidence-id <passed-id> ...`. The command validates the pre-learning graph, appends the learning, flips the learning stage and gate to passed, and clears the single pending boundary. Then run `python scripts/canvas_experience.py verify-receipt one-call-receipt.json`. Do not claim completion if either command fails. Every learning needs context, confidence, and a reuse boundary. Record tool substitutions, required governance backups, transport fallbacks, and proof boundaries in the receipt rather than hiding them.

## Fail-closed completion contract

- The ordered stages are `plan`, `design`, `implement`, `verify`, `package`, and `learn`.
- Required core claims cover ontology, concept fidelity, build, runtime, desktop primary flow, mobile, keyboard, fallback, final console health, and package/readback.
- Browser claims require a successful command plus a named post-condition and local evidence artifact.
- A failed command may remain only when `supersededBy` names a later successful command; its result must never support a passed claim.
- Any missing required proof makes the gate `bounded` or `failed`, never `passed`.
- A 99/100 score cannot override invalid evidence, a failed core claim, unresolved required proof, or open P0/P1.
- A demo count cannot include a domain whose native source, selected primitive, or interaction exists only in copy or configuration. Report fallback-only domains separately from native-proven domains.
- Dated evidence is historical unless its exact source hash, target browser/channel, and relevant official API status have been refreshed. A previous 9.9/10 receipt never automatically transfers to a changed source, a new browser generation, or a new release.

## Output

Lead with the working outcome. Link the experience spec, selected/rejected concept assets, fidelity ledger, browser screenshots, machine-validated `one-call-receipt.json`, package, and install readback. Explicitly bound anything not demonstrated in the target browser.
