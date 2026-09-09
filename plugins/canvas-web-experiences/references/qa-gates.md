# Canvas release quality gates

## Evidence levels

Keep evidence claims precise:

- Static: source review, type checks, lint, schema validation.
- Build: production compilation or bundling succeeded.
- Runtime: the target application loaded and the feature executed.
- Browser interaction: visible and interactive behavior was exercised in a named browser/version.
- Deployment: the intended deployed URL served and executed the intended build.

Higher levels are not implied by lower ones. A listening port is not browser evidence, and a browser screenshot of a local build is not deployment evidence.

## Fail-closed evidence protocol

- Every pass claim cites evidence IDs from `one-call-receipt.json`.
- Every evidence item cites a command whose exit code is 0 and whose status is `passed`.
- Browser evidence additionally records browser/version, viewport, assertion, post-condition, and an existing local artifact.
- A failed command remains in the receipt. It is resolved only when `supersededBy` names a later passing command; failed output never supports a claim.
- Refresh locators after rerenders and snapshots. A stale-reference failure is a failed interaction, not proof of intended behavior.
- A screenshot proves only its captured state. It does not prove the click, keypress, fallback, console, or deployment unless those post-conditions were independently asserted.
- Gate status is `bounded` or `failed` when any required core claim lacks valid proof, regardless of the numeric score.

## Severity

- P0: data loss, security/privacy breach, unrecoverable failure, inaccessible critical task, or crash in the supported path.
- P1: core workflow failure, broken fallback, serious visual/interaction defect, sustained budget failure, or unsupported compatibility claim.
- P2: material polish, maintainability, edge-case, or documentation issue that does not block the core supported path.

Release readiness requires zero unresolved P0 and P1. Record P2 owners or deferral reasons.

## Required verification matrix

### Functional

- primary workflow and at least one alternate path;
- empty, loading, error, offline, and permission states where relevant;
- rapid resize, route change, background/foreground, and teardown;
- context/device loss and failed assets;
- undo/redo, persistence, collaboration, or export where offered.

### Responsive and visual

- representative wide desktop and approximately 390 CSS pixels;
- browser zoom, long Korean text, locale number grouping, and dense content;
- focus, selection, hover, drag, tooltip, panel overlap, clipping, and z-order;
- reduced motion, dark/light or host theme variants where supported;
- screenshots or recordings tied to the tested build.

### Accessibility

- keyboard-only task completion and visible focus;
- programmatic names and status announcements;
- no critical information available only by color or pixels;
- semantic DOM/table/text alternative for meaningful Canvas content;
- 200% text zoom and high-contrast resilience;
- touch targets and gesture alternatives;
- browser find, translation, selection, and screen reader expectations recorded.

### Performance

- representative data and device, not an empty scene;
- frame-time distribution, long tasks, input latency, memory trend, texture/upload cost;
- sustained interaction and resize, not one idle frame;
- quality adaptation and DPR behavior;
- teardown leaves no listener, worker, animation loop, observer, or GPU-resource leak.

### Security and privacy

- cross-origin images, videos, iframes, fonts, and user content;
- tainted-canvas/export behavior;
- HTML sanitization and trusted content boundary;
- origin-trial token scope and expiry if used;
- telemetry contains no prohibited content;
- denial or omission is visible and falls back safely.

## Experimental HTML-in-Canvas gate

Record all of the following:

- browser name, exact version, channel, OS, test date;
- flag, origin-trial token, enterprise policy, or controlled environment;
- DevTools Application-panel trial-validity result without exposing the token value;
- exact available method on Canvas 2D, WebGL, or WebGPU;
- feature-detection and unsupported-path result;
- first-paint, resize, animation, scroll, transform, and cross-origin behavior;
- pointer, keyboard, focus, text selection, IME, and media behavior;
- fallback equivalence, runtime flag, telemetry, and kill-switch rehearsal;
- live official status re-check.

If any item is missing, label the result as a prototype with bounded evidence. Do not call it production-ready.

## Hard 9.9 review sequence

Run exactly three negative rounds:

1. Architecture/security (40 points): try to break boundaries, fallback, lifecycle, data trust, compatibility, and recovery.
2. Browser UX/accessibility/performance (35 points): try to disprove visual quality, responsiveness, keyboard/touch behavior, semantics, console health, and stated budgets.
3. Reproducibility/package/install (25 points): try to disprove deterministic setup, complete packaging, manifest validity, marketplace registration, and local enabled-state readback.

Fix and retest within each round. Do not create a fourth review round; later focused regression checks remain attached to the relevant round. The hard gate is `>=99/100` (`>=9.9/10`), exactly three rounds, zero open P0/P1, and every declared core flow passing.

Use `../assets/templates/canvas-qa-ledger.md` for the final record.
Also produce `../assets/templates/one-call-receipt.json` and pass `python scripts/canvas_experience.py verify-receipt one-call-receipt.json` before calling the one-shot workflow complete.
