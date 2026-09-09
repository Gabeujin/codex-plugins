# Public codebase catalog

Use this as a routing aid, not as a popularity ranking. Verify the exact locked version, maintenance state, browser support, and license before adoption. The machine-readable catalog is `source-catalog.json`.

`verified` means the project's official role and recorded license were cross-checked for this catalog; it is not a promise of current maintenance, security support, or a specific release. `candidate` means an additional current-version or adoption check is still required.

## Experimental HTML capture integrations

| Project | Role | License | Note |
|---|---|---|---|
| WICG html-in-canvas | Proposal, examples, discussions | Repository terms | Canonical incubation source; APIs may change |
| Chrome HTML-in-Canvas demos | Browser demos | Check repository/site terms | Use to reproduce target-browser behavior |
| Three.js `HTMLTexture` | DOM-to-texture integration | MIT | Experimental and dependent on browser support |
| PlayCanvas HTML-in-Canvas | Engine texture integration | MIT engine | Checks `device.supportsHtmlTextures`; keep fallback |
| PixiJS `HTMLSource` | DOM source for renderer texture | MIT | Experimental source lifecycle and paint updates |
| Babylon.js HTML Texture | Engine integration | Apache-2.0 | Experimental browser capability underneath |
| CanvasUI | Cross-renderer UI layer | MIT + Commons Clause per site | Review commercial restrictions before use |

## 2D, animation, games, and vector editing

| Project | Best fit | License | Architecture note |
|---|---|---|---|
| PixiJS | High-performance 2D renderer, sprites, filters | MIT | Renderer primitive; add app/game architecture yourself |
| Phaser | Full 2D game framework | MIT | Scene, input, asset, physics ecosystem |
| Paper.js | Vector paths, geometry, drawing tools | MIT | Strong for vector editors and path operations |
| Fabric.js | Interactive object model over Canvas | MIT | Candidate: verify current release/license before adoption |
| Konva | Retained 2D scene graph and interaction | MIT | Candidate: verify current release/license before adoption |
| p5.js | Creative coding, education, sketches | LGPL-2.1 family | Candidate: confirm distribution implications |

Choose Phaser when game systems matter; PixiJS when rendering flexibility matters. Choose Paper.js for path geometry, and Fabric/Konva for object editing after validating scale and serialization needs.

## 3D and GPU

| Project | Best fit | License | Architecture note |
|---|---|---|---|
| Three.js | General WebGL/WebGPU scenes and custom experiences | MIT | Broad ecosystem; application architecture remains yours |
| Babylon.js | Integrated 3D engine, game/product stack | Apache-2.0 | Rich engine systems and tooling |
| PlayCanvas Engine | Web-first integrated 3D engine | MIT | Strong editor/engine path and HTML texture guide |
| luma.gl | Low-level WebGL/WebGPU framework | MIT | Good foundation for custom GPU/data layers |
| regl | Functional WebGL command abstraction | MIT | Candidate for small custom renderers; verify current state |

Do not select WebGPU-only by default. Establish the deployment browser contract and a WebGL or non-3D fallback first.

### CAD/BIM engine gap

This plugin supplies the rendering, coordinate, streaming, interaction, and quality architecture for CAD/BIM-style experiences, but it does not nominate a universal geometry kernel or BIM viewer. Production CAD/BIM adoption requires a separate decision for file parsers, model semantics, geometry kernels, 3D Tiles/IFC conversion, measurement tolerances, and their licenses. Do not imply engineering-grade accuracy from a general 3D renderer alone.

## Maps, geospatial, digital twins

| Project | Best fit | License | Architecture note |
|---|---|---|---|
| MapLibre GL JS | Interactive vector web maps | BSD-3-Clause | Map renderer; tile/data licenses are separate |
| OpenLayers | Broad 2D web mapping and projections | BSD-2-Clause | Candidate: verify current release/license |
| CesiumJS | Globe, terrain, 3D Tiles, geospatial 3D | Apache-2.0 | Large spatial worlds and streaming |
| deck.gl | GPU analytical overlays and large data | MIT | Compose with map bases; not a tile-source license |
| luma.gl | GPU layer foundation | MIT | Used beneath visualization stacks |

Map rendering, basemap/style, tiles, geocoding, imagery, fonts, and user data have independent terms. Record them separately.

## Diagrams and infinite canvas

| Project | Best fit | License | Architecture note |
|---|---|---|---|
| Excalidraw | Hand-drawn whiteboard/editor foundation | MIT | Useful reference and embeddable editor stack |
| tldraw | Infinite canvas/editor platform | Custom production license | Review license terms before commercial deployment |
| Paper.js | Geometry-heavy custom diagrams | MIT | Build selection/history/collaboration layers explicitly |
| PixiJS/Konva/Fabric | Large interactive scenes | Mixed above | Benchmark hit testing, text, export, and accessibility |

## Evaluation checklist

For every candidate, record:

1. exact package/version and official repository;
2. license of package, examples, assets, fonts, maps, and data;
3. maintenance and security posture;
4. supported renderers and browsers;
5. accessibility model and DOM integration;
6. SSR/client-only boundary;
7. resource disposal, context loss, worker, and export behavior;
8. benchmark with representative content;
9. escape cost if the library or experimental API changes.
