---
name: canvas-2d-graphics
description: Build and optimize Canvas 2D experiences including illustration, animation, image tools, data graphics, particle systems, sprite games, vector editors, and creative portfolios. Use when selecting or implementing Canvas 2D, PixiJS, Phaser, Paper.js, Fabric.js, Konva, p5.js, or a custom 2D renderer.
---

# Canvas 2D Graphics

Deliver expressive 2D rendering without sacrificing semantics, input quality, lifecycle, or representative performance.

## Required references

Read the 2D sections of:

- `../../references/domain-routing.md`
- `../../references/codebase-catalog.md`
- `../../references/architecture-patterns.md`

Use `../../references/design-quality-system.md` for user-facing work and `../../references/qa-gates.md` before release.

## Choose the 2D model

- Raw Canvas 2D: direct pixel/path control, image tools, custom charts, compact dependencies.
- PixiJS: renderer-first sprites, filters, particles, and dense visual scenes.
- Phaser: games needing scenes, input, assets, cameras, physics, and game-loop structure.
- Paper.js: path geometry, Bézier editing, drawing and vector operations.
- Fabric.js/Konva: retained interactive objects, handles, grouping, serialization; benchmark scale and verify current license/version.
- p5.js: creative coding, teaching, sketches; review distribution license implications.

Do not combine frameworks unless each owns a distinct layer and the integration cost is measured.

## Workflow

### 1. Define scale and fidelity

Record the maximum objects, sprites, pixels, paths, layers, filters, image sizes, export resolution, and target devices. Establish whether crisp vector output, exact pixel output, deterministic simulation, or visual approximation matters.

### 2. Design shell, scene, and assets

Keep navigation, settings, text-heavy inspectors, forms, status, and accessible alternatives in DOM. Define the scene coordinate system, camera, layers, hit regions, selection, cursors, and asset pipeline.

For games and visual portfolios, use intentional art direction and production-appropriate assets. Placeholder primitives are suitable for mechanics spikes, not final visual claims.

### 3. Implement rendering correctly

- Size the backing store from CSS dimensions and effective DPR.
- Reset or manage transforms explicitly on resize.
- Bound frame delta; use fixed-step simulation when determinism matters.
- Avoid per-frame object allocation and redundant state changes.
- Batch sprites and filters, use atlases, cache expensive paths, and cull only after profiling.
- Build hit testing with color picking, geometry tests, or a spatial index according to scale.
- Keep hover/pointer state out of broad UI rerenders.
- Dispose textures, sources, listeners, observers, timers, and animation loops.

Use OffscreenCanvas or workers only for a measured transferable workload with a versioned message and cancellation protocol.

### 4. Build editor/game semantics

For editors: stable IDs, selection model, commands, undo/redo, copy/paste, snapping, guides, serialization, migration, and export.

For games: scene lifecycle, input remapping, visibility pause, audio unlock, save state, loading failure, asset ownership, collision/physics step, and mobile controls.

For data graphics: scale integrity, labels, legends, annotations, locale formatting, and a semantic table/text alternative.

### 5. Verify

Test representative scene size, DPR, long sessions, resize, lost assets, hidden/visible transitions, pointer/touch/keyboard paths, reduced motion, export output, and teardown. Inspect desktop and about 390 CSS pixels in a real browser.

## Deliverable

Report the selected engine and version/license check, state/renderer boundary, interaction and asset plan, measured budgets, tests, browser evidence, and remaining risks.
