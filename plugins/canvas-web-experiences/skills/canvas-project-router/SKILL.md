---
name: canvas-project-router
description: Route broad or ambiguous web Canvas requests to the right DOM, SVG, Canvas 2D, WebGL, WebGPU, map, diagram, game, or hybrid architecture. Use for new interactive sites, portfolios, visualizations, games, maps, plans, CAD/BIM views, and cross-domain Canvas features before a rendering stack is chosen.
---

# Canvas Project Router

Choose the least-complex rendering path that preserves the intended experience, then activate only the focused skills needed to build and verify it. For a broad request that expects a finished artifact, prefer `$canvas-experience-orchestrator`; the user should not need to chain the focused skills manually.

## Choose the engagement first

| Scope | Next skill | Minimum outcome | Required verification |
| --- | --- | --- | --- |
| Architecture decision or reversible spike | `$canvas-project-router` or `$canvas-experience-orchestrator` in Prototype mode | renderer, semantic boundary, fallback, and open questions | source/architecture evidence only unless a runtime changed |
| Bounded existing task | `$canvas-experience-orchestrator` in Feature mode | one task slice with durable post-condition and fallback | focused tests and target-browser exercise when available |
| Package or release readiness | `$canvas-experience-orchestrator` in Release mode, then `$canvas-quality-audit` | complete release receipt | exactly three scored rounds, package/readback, and declared core-flow proof |

Do not turn a small task into a release engagement. Preserve every safety, accessibility, fallback, and evidence boundary in all modes.

## References

Read `../../references/domain-routing.md` for every routing decision. Read the following only when they affect the selected path:

- `../../references/codebase-catalog.md` for a library/framework decision;
- `../../references/design-quality-system.md` for user-facing visual or interaction work;
- `../../references/qa-gates.md` for a Release audit.

For experimental HTML capture, also read `../../references/early-adopter-playbook.md` and `../../references/official-sources.md`.

## Workflow

### 1. Inspect before choosing

Inspect the current project, its container model, design tokens, framework, browser targets, data size, performance constraints, accessibility obligations, and existing rendering dependencies. Preserve accepted copy, colors, interaction patterns, and unrelated work.

If the request is greenfield, write a compact product DNA statement: audience, core task, emotional tone, environment, content, accessibility, and device constraints.

### 2. Classify the primary artifact

Distinguish semantic content, vector documents, pixel graphics, sprite worlds, GPU scenes, geospatial worlds, and editable spatial documents. Do not use Canvas merely because it looks visually advanced.

Prefer:

- DOM for text, forms, navigation, search, document content, and accessibility;
- SVG for modest semantic vector scenes;
- Canvas 2D for pixel manipulation and custom immediate-mode graphics;
- PixiJS or Phaser for dense 2D/game workloads;
- Three.js, Babylon.js, or PlayCanvas for 3D;
- MapLibre/OpenLayers, CesiumJS, or deck.gl for geospatial work;
- Excalidraw/tldraw or a custom hybrid for infinite canvas and diagrams;
- a DOM-shell + renderer-scene hybrid for most production applications.

### 3. Decide whether HTML-in-Canvas earns the risk

Use the experimental path actively when native HTML as Canvas/WebGL/WebGPU pixels unlocks a clear interaction or workflow that overlays cannot deliver cleanly. Choose an early-adopter lane, controlled browser target, fallback, success metric, telemetry, and kill switch.

Do not reject the experiment because it is new. Do not hide its browser/standard status either.

### 4. Produce a routing decision

State:

- user outcome and product DNA;
- chosen rendering model and why;
- rejected alternatives and kill criteria;
- library candidates and license checks;
- semantic DOM/accessibility boundary;
- state, scene, input, worker, resource, and export boundaries;
- responsive and performance budgets;
- experimental adoption lane if applicable;
- focused skills to use next.

Use `../../assets/templates/canvas-feature-brief.md` for material work.

### 5. Route implementation

- Use `$canvas-experience-orchestrator` when the request spans planning, visual concepts, implementation, browser verification, packaging, and learning.
- Use `$canvas-html-in-canvas` for experimental DOM capture/composition.
- Use `$canvas-experience-design` for visual direction, interaction grammar, app chrome, and motion.
- Use `$canvas-runtime-architecture` for state/renderer/worker/resource decisions.
- Use `$canvas-2d-graphics`, `$canvas-3d-spatial`, or `$canvas-maps-diagrams` for the selected domain.
- Use `$canvas-quality-audit` for an explicitly requested review or a risk-triggered focused audit. Release work must finish with the scored three-round audit; Prototype and Feature work do not inherit Release packaging or scoring by default.

## Stop conditions

Stop and surface a decision only when a missing browser contract, license constraint, data precision need, or product requirement would materially change the architecture and cannot be inferred safely. Otherwise proceed with explicit assumptions.
