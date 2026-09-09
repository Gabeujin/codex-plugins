# Runtime architecture patterns

## Reference boundaries

```text
Product state / document model
            |
       scene projection
            |
 renderer adapter ---- resource manager
      |       |             |
 Canvas2D   WebGL/WebGPU   assets/GPU lifetime
      |
 input adapter <---- DOM chrome / accessibility bridge
      |
 history, collaboration, persistence, export, observability
```

Do not let the rendering library become the product's source of truth unless the product is truly ephemeral. Maintain stable domain IDs and derive render objects from the document or game state.

## State and update model

- Separate durable state, transient interaction state, and renderer-owned caches.
- Keep pointer positions, frame timestamps, and other high-frequency values out of reactive render loops when a mutable reference or engine state is sufficient.
- Batch state-to-scene projection and invalidate only what changed.
- For editors, define commands and inverse commands or snapshots before adding collaborative transport.
- For games, use a clock with bounded delta and define fixed-step simulation when determinism matters.
- For maps and large models, make streaming, eviction, and stale-request cancellation explicit.

## Main thread and workers

Use a worker only after identifying a transferable workload and messaging budget.

- Good candidates: geometry processing, image decoding where supported, layout, spatial indexing, pathfinding, simulation, tile parsing, and OffscreenCanvas rendering.
- Keep DOM, accessibility, input capture, and browser APIs that require the main thread at the shell boundary.
- Version worker messages; make cancellation and teardown first-class.
- Measure serialization and transfer costs. A worker is not automatically faster.

## Renderer lifecycle

Every renderer integration needs:

- initialization after a client-visible host exists;
- device-pixel-aware resize and CSS-to-device coordinate mapping;
- pause or reduced work when hidden;
- asset cancellation and explicit disposal;
- WebGL/WebGPU context/device loss behavior;
- hot reload or route transition cleanup;
- error and telemetry boundary;
- a deterministic test seam that does not require comparing every pixel.

For React/Next.js, load browser-only engines at the client boundary, dynamically import heavy optional modules, and avoid rebuilding the renderer because a component rendered. Do not use an entire scene graph as React state when the engine already owns transient render objects.

## Performance layers

Apply only after profiling:

1. choose the correct medium and object model;
2. eliminate unnecessary work and allocations per frame;
3. batch draw calls and state changes;
4. cull offscreen/occluded objects;
5. use level-of-detail, tiles, instancing, atlases, and spatial indexes;
6. move suitable work to workers;
7. cap DPR or quality adaptively with an explicit visual budget.

Record frame time distributions, long tasks, memory trend, draw calls, triangle/sprite count, texture memory, upload cost, and input latency. Avoid claiming “60 FPS” from a single idle reading.

## HTML-in-Canvas adapter

Treat experimental capture as a renderer plugin, not the data model.

- Check the exact context method and overload at runtime.
- Wait for a usable source snapshot and coalesce paint-triggered uploads.
- Own `ResizeObserver` outside the paint event.
- Synchronize source layout, destination geometry, pointer mapping, and CSS transforms.
- Classify failures: unsupported, not-painted, security/cross-origin, context/device loss, upload failure, or performance fallback.
- Preserve one conventional rendering path with equivalent task completion.

## Precision and coordinates

Define named coordinate spaces: client, viewport, device, world, local, model, geographic, tile, and texture. Provide explicit conversion functions and tests. For geospatial and CAD-scale worlds, use local origins, origin rebasing, double-precision techniques, or tiled coordinates as required. Never mix meters, millimeters, degrees, pixels, and normalized device coordinates implicitly.

## Export and reproducibility

Decide whether export means raster pixels, vector/document data, video/stream, scene package, or printable report. Preserve product data separately from renderer caches. Record font, image, cross-origin, color-space, and resolution restrictions. Test the exported artifact, not just the export button.

## Kill criteria

Switch architecture when evidence shows:

- critical semantics cannot be made accessible;
- target browser support cannot meet the deployment contract;
- frame or memory budgets fail under representative content;
- coordinate drift or precision breaks core tasks;
- export cannot reproduce required content;
- library license conflicts with distribution;
- fallback maintenance costs exceed the unique value of the experiment.
