---
name: canvas-demo-lab
description: Run, inspect, extend, or adapt the bundled Canvas Futures Lab across portfolio, motion, 2D game, spatial gallery, map, diagram, floor plan, data, media, science, commerce, and digital-twin domains. Use when a user wants executable examples, a cross-domain prototype, a new domain added to the lab, or browser evidence for Canvas and experimental HTML-in-Canvas behavior.
---

# Canvas Demo Lab

Use the bundled reference app as an executable architecture sample, not a screenshot gallery.

## References

For every task, read `../../demo/README.md` and `../../references/domain-routing.md`.

Read the following only when the change needs them:

- `../../references/architecture-patterns.md` for a new renderer, state, worker, or resource boundary;
- `../../references/demo-modernization-ledger-v3.md` when adding or modernizing more than one domain;
- `../../references/qa-gates.md` for release work.

For an HTML surface, also read `../../references/html-in-canvas-recipes.md`, `../../references/html-in-canvas-capability-contract-v2.md`, and `../../references/official-sources.md`.

## Workflow

### 1. Pick the closest experiment

Choose one of the 12 registered domains by interaction and rendering needs, not by label alone. State which scene, input model, accessible alternative, and fallback are reusable.

### 2. Preserve the shared architecture

Keep durable React state separate from high-frequency pointer/model refs. Render app chrome and semantic controls in DOM. Keep the scene in Canvas 2D/WebGL and cap DPR at 2 desktop/1.5 mobile. Pause or simplify work for reduced motion, hidden pages, route changes, and unmounts.

### 3. Add or adapt a demo

Define one catalog entry, one renderer branch or isolated lazy module, meaningful domain controls, a unique interaction, semantic status/data, desktop and 390px behavior, and a reset path. Do not create a static card labeled as a demo.

For experimental HTML-in-Canvas, accept trusted code-native DOM only. Every registered domain must own a direct canvas-child source for its selected 2D, WebGL, WebGPU, or worker lane; a distinct reason the surface benefits from composition; an interactive task; current-IDL paint/upload code; measured transform synchronization; DOM-overlay equivalence; telemetry; and a kill switch. Keep source repaint bound to meaningful content changes, retire failed GPU loops, and record Worker transfer ownership. Never ingest arbitrary HTML. Do not count an ordinary Canvas scene plus a sibling overlay as native adoption.

### 4. Verify

Run `npm run check` in `demo/`. Exercise all 12 primary interactions in a real browser at desktop and representative Canvas 2D, WebGL, WebGPU, and Worker routes at approximately 390 CSS pixels. Check keyboard/touch use, at least 44 CSS-pixel mobile targets, no horizontal document overflow, console errors/warnings, accessible names, semantic alternative, paint coalescing, alignment tolerance, and sustained frame budget.

### 5. Report boundaries

Differentiate Canvas 2D, WebGL, WebGPU, worker capture, DOM overlay, and exact primitive execution. A stable browser showing the overlay fallback is evidence for fallback correctness, not proof of the experimental native path. The bundled lab's supported-browser result must say `task-ready fallback` until a named trial browser produces a `paint → upload → transform` receipt.

## Output

Report the chosen domain, architecture reuse, changed files, tests, browser matrix, performance observation, fallback mode, and any unproven browser/channel claim.
