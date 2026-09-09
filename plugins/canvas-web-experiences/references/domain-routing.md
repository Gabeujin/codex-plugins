# Domain and rendering route

## Start with the experience, not the API

Choose the lowest-complexity medium that preserves the required experience.

| Need | Default route | Escalate when |
|---|---|---|
| Text, forms, navigation, documents | Semantic DOM + CSS | Large retained graphics or pixel processing dominates |
| Accessible vector diagrams with modest node counts | SVG + DOM controls | Node count, animation, or interaction causes measurable DOM cost |
| Pixel drawing, filters, image editing, custom charts | Canvas 2D | GPU batching, shaders, or very large scenes are required |
| Sprite-heavy 2D, particles, games | PixiJS or Phaser | Custom renderer or 3D becomes the primary requirement |
| General 3D scenes and portfolios | Three.js | Integrated editor/physics/product stack favors Babylon.js or PlayCanvas |
| Integrated 3D games/product experiences | Babylon.js or PlayCanvas | A small low-level layer is more appropriate |
| Browser-first GPU compute/next-gen rendering | WebGPU with WebGL fallback | Target environment is controlled enough for WebGPU-only operation |
| Web maps | MapLibre GL JS or OpenLayers | Global 3D terrain/tiles favors CesiumJS; analytical overlays favor deck.gl |
| Infinite canvas/whiteboard | Excalidraw, tldraw, or custom Canvas/SVG hybrid | License, collaboration, rendering scale, or specialized geometry requires another stack |
| CAD/BIM/floor plans | Hybrid DOM chrome + Canvas/WebGL scene | Pure SVG is sufficient for small 2D drawings |
| HTML controls inside GPU scenes | DOM overlay first; experimental HTML-in-Canvas where it creates unique value | The target browser is controlled and the early-adopter lane is explicit |

## Routing questions

Answer only what changes the architecture:

1. Is the primary artifact pixels, vectors, semantic content, or a spatial world?
2. What is the largest expected object, vertex, sprite, tile, or label count?
3. Which interactions require keyboard, focus, text selection, IME, forms, or assistive technology?
4. Is SEO, browser find, translation, printing, or server rendering required?
5. What device, browser, DPR, memory, and power envelope matters?
6. Does the scene need shaders, post-processing, lighting, physics, spatial audio, geospatial precision, or XR?
7. Is collaboration, undo/redo, deterministic replay, export, or offline use required?
8. Can the deployment control a Chrome channel or origin-trial cohort?

## Hybrid architecture patterns

### DOM shell + Canvas scene

Best default for editors, maps, games, visualizers, and portfolios. DOM owns navigation, forms, accessibility, and panels. Canvas owns high-frequency spatial visuals.

### Canvas base + DOM overlay

Use for labels, tooltips, accessible controls, media, and forms that need world-space anchoring. Centralize world-to-screen transforms and overlay occlusion rules.

### SVG interaction layer + Canvas raster layer

Use when a limited set of semantic handles or labels needs direct DOM interaction over a large raster or particle field.

### Experimental HTML capture + fallback

Use for HTML composited into Canvas/WebGL/WebGPU when it unlocks a demonstrable feature. Route through the early-adopter playbook and preserve a DOM-overlay or raster fallback.

## Domain-specific gates

- Games: deterministic time step, pause/resume, input remapping, asset lifecycle, audio unlock, visibility change, save state.
- Maps: coordinate reference system, attribution, tile/source license, precision, antimeridian, clustering, offline policy.
- Diagrams: hit testing, snapping, selection model, undo granularity, copy/paste, serialization, accessibility alternative.
- CAD/BIM: units, tolerances, origin strategy, hierarchy, clipping, measurement accuracy, level-of-detail, large-model streaming.
- Portfolios: content fallback, loading budget, reduced motion, direct navigation, shareable URLs, meaningful mobile composition.
- Data visualization: semantic table or textual alternative, scale integrity, legends, annotations, export parity, locale formatting.
