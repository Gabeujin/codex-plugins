---
name: canvas-maps-diagrams
description: Build Canvas-based maps, GIS, globes, spatial analytics, whiteboards, diagrams, node editors, floor plans, technical drawings, and infinite canvases. Use when choosing or implementing MapLibre, OpenLayers, CesiumJS, deck.gl, Excalidraw, tldraw, Paper.js, or custom spatial editing and visualization.
---

# Canvas Maps Diagrams

Preserve coordinate truth, editing semantics, attribution, and accessibility while scaling spatial scenes.

## Required references

Read:

- the maps/diagrams sections of `../../references/codebase-catalog.md`
- `../../references/domain-routing.md`
- `../../references/architecture-patterns.md`
- `../../references/qa-gates.md`

Use `../../references/design-quality-system.md` for product-facing interfaces.

## Route the domain

- MapLibre GL JS: interactive vector basemaps and styled web maps.
- OpenLayers: broad 2D GIS formats and projection workflows; verify current version/license.
- CesiumJS: globe, terrain, 3D Tiles, and geospatial 3D.
- deck.gl: GPU analytical layers over map or globe foundations.
- Excalidraw: MIT whiteboard/editor foundation with hand-drawn visual grammar.
- tldraw: mature infinite-canvas platform with custom production license; review commercial terms.
- Paper.js/Fabric.js/Konva/custom hybrid: specialized geometry or editing when product semantics differ from general whiteboards.

## Workflow

### 1. Define coordinate and data truth

Record coordinate reference systems, units, projection, origin, precision, antimeridian/polar behavior, snapping tolerances, topology, source freshness, and maximum feature/node/shape/tile counts. Never mix geographic degrees, projected meters, drawing millimeters, CSS pixels, and device pixels implicitly.

### 2. Record independent licenses

Separate the renderer license from basemap styles, tiles, terrain, imagery, glyphs, icons, geocoding, routing, datasets, models, and user content. Implement required attribution where users can see it. Do not infer data rights from an open-source renderer.

### 3. Design the spatial shell

Use semantic DOM for search, layer controls, properties, filters, data tables, form entry, collaboration status, and help. Define viewport tools, selection, hover, snapping, measurement, minimap/overview, coordinates, scale, and mode indicators.

On mobile, decide which controls collapse, become sheets, or remain on-map. Preserve the user's focal feature while chrome changes.

### 4. Build map behavior

Handle tile/source cancellation, stale responses, caching policy, clustering, feature indexing, decluttering, label collision, terrain/3D occlusion, precision, source attribution, and offline limits. For analytical layers, retain a table/text route to important values.

### 5. Build diagram/editor behavior

Use stable IDs and a document model independent from renderer objects. Define selection sets, lasso, handles, hit slop, snapping, guides, z-order, groups, ports/edges, command history, undo granularity, clipboard, serialization migrations, collaboration conflicts, and export.

For floor plans/CAD-style drawings, validate units, dimensions, scale bars, tolerances, constraints, symbols, print/export accuracy, and origin strategy.

### 6. Scale and verify

Profile representative feature/node counts, zoom extremes, panning, edits, long sessions, collaboration, memory eviction, and teardown. Test keyboard-only workflows, focus, touch/pen, long Korean labels, high contrast, 390px layout, export, offline/error states, and coordinate round trips.

## Deliverable

Provide renderer/data/license choices, coordinate contract, document or source model, interaction grammar, attribution, accessibility alternative, scale evidence, and unresolved precision or licensing risks.
