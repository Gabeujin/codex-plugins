---
name: canvas-3d-spatial
description: Build WebGL or WebGPU 3D experiences for portfolios, product visualization, games, digital twins, CAD/BIM, architecture, spatial dashboards, and world-space HTML. Use when selecting or implementing Three.js, Babylon.js, PlayCanvas, luma.gl, raw WebGL/WebGPU, glTF assets, picking, lighting, LOD, or 3D UI.
---

# Canvas 3D Spatial

Build a spatial product with explicit units, performance budgets, interaction, accessibility, and graceful degradation.

## Required references

Read:

- `../../references/architecture-patterns.md`
- the 3D section of `../../references/codebase-catalog.md`
- `../../references/design-quality-system.md`

For DOM content on 3D surfaces, use `$canvas-html-in-canvas` and its required references. Finish with `../../references/qa-gates.md`.

## Choose the engine

- Three.js: flexible general 3D, custom portfolios, visualization, broad examples and ecosystem.
- Babylon.js: integrated engine systems for games, product and spatial applications.
- PlayCanvas: web-first engine/editor workflow and explicit HTML-texture integration.
- luma.gl or raw APIs: controlled low-level GPU/data layers where an engine would obstruct the architecture.

Prefer a WebGL fallback unless the deployment contract can require WebGPU. Treat engine examples as implementation references, not product architecture.

## Workflow

### 1. Define the world

Record units, handedness, up axis, origin strategy, coordinate precision, camera behavior, maximum geometry/material/texture counts, target devices, loading budget, and visual fidelity. For glTF and external models, inventory licenses, units, pivots, compression, animation, materials, and hierarchy.

### 2. Establish product and scene boundaries

Keep semantic navigation, search, forms, inspector panels, status, settings, and accessible alternatives in DOM. Let the scene own meshes, cameras, lights, world-space visuals, selection outlines, and spatial effects. Centralize world-to-screen projection for overlays.

### 3. Build interaction deliberately

Specify orbit/fly/first-person/touch camera modes, focus targets, picking/raycasting, selection, occlusion, clipping, measurement, gizmos, keyboard controls, controller support, and motion-sickness/reduced-motion behavior. Prevent camera gestures from fighting page scrolling without a clear mode and visible affordance.

### 4. Manage GPU work

- Dispose geometries, materials, textures, render targets, pipelines, bind groups, listeners, and animation loops.
- Use compressed assets, atlases, instancing, batching, culling, LOD, streaming, and adaptive DPR from profiling evidence.
- Bound shader variants and post-processing passes.
- Handle WebGL context or WebGPU device loss and restoration/fallback.
- Dynamically load heavy optional viewers or editors at the client boundary.
- Record draw calls, triangles, texture memory, upload spikes, frame-time distribution, input latency, and memory trend.

### 5. Domain requirements

- CAD/BIM: exact units, tolerances, hierarchy, origin rebasing, clipping/sections, measurement validation, very large-model streaming.
- Games: deterministic simulation where required, physics step, asset lifecycle, input remapping, pause/save/audio.
- Portfolios: direct navigation, content fallback, shareable URLs, mobile composition, reduced motion, fast first meaningful content.
- Architecture/visualization: camera storytelling, real asset provenance, lighting/color management, spatial scale, annotation and comparison modes.
- Digital twins: time/data synchronization, stale-state indication, permissions, event history, and failure isolation.

### 6. Verify

Test target hardware with representative assets, camera extremes, rapid resize, lost context/device, failed textures/models, long sessions, selection accuracy, accessibility bridge, mobile layout, and fallback. Inspect exported images/video/model state if offered.

## Deliverable

Provide engine/version/license decision, coordinate and data contracts, asset budget, lifecycle ownership, accessibility/fallback plan, measured browser evidence, and explicit limits.
