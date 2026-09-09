# One-shot Canvas experience operating system

One call should complete a coherent vertical slice: clarify only material unknowns, define evidence and product DNA, create visual alternatives, select with explicit criteria, implement, run a real browser, close exactly three negative rounds, and leave a reusable ontology receipt.

## Stage 0 — Discover without ceremony

Inspect the project, existing design system, dirty work, build/runtime commands, supported browsers, and target feature. Make bounded assumptions when reversible. Ask only when a choice changes audience, irreversible data, external side effects, or core architecture.

## Stage 1 — Materialize the ontology

Run `python scripts/canvas_experience.py init ...` or create the equivalent `canvas-experience.json`. Populate `Intent`, `ProductDNA`, host invariants, evidence, budgets, accessibility, and fallback contracts before styling.

## Stage 2 — Diverge, then select

Create at least three materially different full-screen or state-board directions:

- `Aligned`: safest expression of the host product DNA.
- `Stretch`: a bolder composition or interaction grammar that preserves task clarity.
- `Frontier`: an experimental renderer or HTML-in-Canvas path with explicit fallback.

Use ImageGen for substantial visual work. Score each direction on task clarity, host identity, interaction legibility, accessibility, implementation fit, and creative distinction. Select one; preserve rejected insights with reasons so a later call does not repeat the same dead end.

## Stage 3 — Convert concept to an implementation ledger

For every important visual element, record:

`concept detail -> code owner -> responsive behavior -> interaction state -> accessibility equivalent -> acceptance check`

The selected concept must cover desktop, approximately 390 CSS pixels, default, hover/focus, active/drag, loading/fallback, reduced motion, and at least one dense/error state.

## Stage 4 — Build a vertical slice

Implement the dominant scene, primary interaction, semantic alternative, responsive chrome, fallback, telemetry, and reset path first. Keep the render loop isolated from React state churn. Load high-detail scene plates as progressive art assets while procedural layers retain real interaction.

## Stage 5 — Browser-driven correction

Use the in-app Browser before standalone Playwright. Inspect page identity, nonblank render, asset load, console, interactions, keyboard focus, wide desktop, 390px, overflow, and screenshots. Compare the latest screenshot with the accepted concept on at least five concrete points and fix the highest-impact gap.

Treat browser execution as an evidence transaction: snapshot or locate, act, assert the named post-condition, check console, and save the artifact. A new snapshot invalidates opaque element references. Preserve every failed action in `commands`; it can be closed only by a later successful command named in `supersededBy`.

## Stage 6 — Exactly three negative rounds

Use the fixed 40/35/25 gate in `qa-gates.md`. Further edits after the gate attach regression evidence to the appropriate round; they do not create a fourth round. Pass only at 99/100 or above with P0/P1 zero.

## Stage 7 — Learn without polluting global state

Create the pre-learning `one-call-receipt.json` from the bundled template. It must contain the ordered `plan → design → implement → verify → package → learn` stages, exact commands and exit codes, evidence, claims, substitutions, proof boundaries, and the three-round gate; only `learn` may be pending, with exactly `learning-append-pending` unresolved. Run the receipt-bound `learn` command, which closes that stage, then run `verify-receipt`. Promote a pattern into shared references only after it succeeds in more than one materially different context. Keep rejected directions and failed hypotheses so generation becomes faster without becoming repetitive.

## Stop conditions

- Do not emit a success receipt when the server is unreachable, a browser action fails without a successful replacement, or a post-condition is not asserted.
- Do not infer an interaction from a screenshot or infer deployment from a local runtime.
- Do not raise the score to compensate for missing browser, accessibility, fallback, or package proof.
- If a required tool is unavailable, record the substitution. If the equivalent claim remains unproved, set the gate to `bounded`.
- Verify the receipt before writing a learning or announcing completion.

## Speed and quality controls

- Reuse an ontology relation or verified component before rereading every source.
- Hash the selected concept and implementation receipt to detect stale comparisons.
- Prefer one shared render shell plus isolated domain adapters over 12 unrelated apps.
- Freeze exact copy, tokens, breakpoints, and quality budgets in the experience spec.
- Separate exploratory art assets from production assets; record which one the runtime actually loads.
- Never let a fast first render bypass semantic alternatives, fallback, or browser proof.
