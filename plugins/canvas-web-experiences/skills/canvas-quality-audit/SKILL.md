---
name: canvas-quality-audit
description: Audit Canvas implementations for browser correctness, accessibility, UI/UX fidelity, responsive behavior, performance, security, privacy, lifecycle cleanup, export, compatibility, and experimental HTML-in-Canvas claims. Use for reviews, release readiness, regressions, and independent verification of 2D, 3D, game, map, diagram, CAD/BIM, or portfolio features.
---

# Canvas Quality Audit

Try to disprove the release claim with representative evidence, then report exactly what remains proven and unproven.

## Required references

Read completely:

- `../../references/qa-gates.md`
- `../../references/design-quality-system.md`

For HTML-in-Canvas, also read `../../references/official-sources.md`, `../../references/html-in-canvas-capability-contract-v2.md`, `../../references/demo-modernization-ledger-v3.md`, and `../../references/early-adopter-playbook.md`.

## Audit rules

- Review only; do not change code unless the user explicitly asks for fixes.
- Inspect source and diffs before running broad tests.
- Distinguish static, build, runtime, browser-interaction, and deployed evidence.
- Use P0/P1/P2 with tight file/line or reproduction evidence.
- Do not pass a release with unresolved P0/P1.
- Do not treat a listening port, build success, or feature check as visual/browser proof.

## Workflow

### 1. Establish claims and test surface

List the feature claims, supported browsers/devices, representative datasets/assets, interaction paths, performance budgets, accessibility contract, deployment target, and experimental flags/tokens. Check the working tree and preserve unrelated changes.

### 2. Static and build review

Inspect state/renderer ownership, coordinate conversions, resize/DPR logic, input cleanup, animation loops, observers, workers, asset cancellation, GPU disposal, context loss, cross-origin data, sanitization, export, SSR/client boundary, dynamic imports, and fallback code.

Run focused lint, types, unit, schema, and production build checks in proportion to risk. Record commands and outputs.

### 3. Real-browser matrix

Exercise the named supported browser/version at wide desktop and around 390 CSS pixels. Cover primary flow, alternate path, loading, empty, error, offline, permission, rapid resize, zoom extremes, background/foreground, route change, context loss, failed assets, long Korean content, browser zoom, and reduced motion.

Use keyboard-only, touch where relevant, visible focus, programmatic names, announcements, semantic alternatives, and high-contrast checks. Inspect pointer mapping, selection, overlay drift, clipping, z-order, tool modes, and gesture conflicts.

### 4. Representative performance and lifecycle

Measure frame-time distribution, long tasks, input latency, draw calls, scene size, texture/upload cost, memory trend, streaming/eviction, and teardown under representative data. Look for retained listeners, observers, workers, timers, RAF loops, GPU resources, and stale requests.

### 5. Experimental challenge

For HTML-in-Canvas, verify exact browser/channel/version/date, observable flag or token state, method/overload, present and absent paths, first/current snapshot behavior, stable changed-element IDs, resize, scroll, animation, measured transform sync, same/cross-origin content, interaction model, fallback state continuity, transferable ownership, telemetry, loss retirement, and kill switch. Re-check live official status. If channel, flag, privacy filtering, or hardware loss cannot be observed, keep it explicitly unproven instead of substituting capability presence.

An engine's `HTMLTexture` or feature boolean is not proof that the full product flow is supported.

For a multi-domain claim, audit every domain row. A `typeof` check, a configured lane, a direct child that was never painted, a texture API that was never called, a transform invocation without measured error, or an ordinary overlay is not a native pass. Require command → browser evidence → asserted post-condition for `paint`, upload/copy/capture, transform sync, resource ownership, and the domain's primary interaction. Stable-browser fallback evidence and trial-browser native evidence are separate claim sets.

### 6. Exactly three scored negative rounds

Run exactly three adversarial rounds and keep their scopes distinct:

1. Architecture and security, worth 40 points: runtime boundaries, trusted-content policy, progressive enhancement, fallback, lifecycle, recovery, and representative domain completeness.
2. Browser UX, accessibility, and performance, worth 35 points: wide desktop and approximately 390 CSS pixels, keyboard/touch, semantics, reduced motion, overflow, console, interaction, and frame budget.
3. Reproducibility, packaging, and installation, worth 25 points: deterministic tests/build, documentation, archive exclusions, manifest, marketplace source, local installation, and enabled readback.

Score only verified items. The release gate is at least 99/100 (9.9/10), exactly three recorded rounds, zero unresolved P0/P1, and all declared core flows passing. A later ordinary regression check is not a fourth negative round.

Record each finding with severity, evidence, impact, smallest safe correction, retest, and awarded points.

## Output

Use `../../assets/templates/canvas-qa-ledger.md`. Lead with findings, then coverage and evidence. State what was not tested and why. If no actionable findings remain, say so explicitly and list residual risks rather than inventing issues.
