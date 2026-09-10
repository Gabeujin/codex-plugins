# Canvas Web Experiences

Install `canvas-web-experiences@gabeujin-plugins` using the [shared installation guide](https://github.com/Gabeujin/codex-plugins/blob/main/README.md). Existing users should read [updates and data preservation](https://github.com/Gabeujin/codex-plugins/blob/main/docs/INSTALL-AND-UPDATE.md). Copy-ready starter commands are in [First use](https://github.com/Gabeujin/codex-plugins/blob/main/docs/FIRST-USE.md).

Canvas Web Experiences is a Codex plugin for planning, designing, implementing, and verifying accessible Canvas web products. It covers Canvas 2D, WebGL, WebGPU, maps, diagrams, game-like scenes, and experimental HTML-in-Canvas techniques.

The plugin keeps navigation, controls, forms, and status in semantic DOM. Experimental rendering paths require feature detection and a DOM or conventional-texture fallback.

## Skills

- `canvas-experience-orchestrator` completes a task-scoped Canvas workflow.
- `canvas-project-router` selects an appropriate rendering architecture.
- `canvas-html-in-canvas` handles experimental HTML-in-Canvas with fallbacks.
- `canvas-experience-design`, `canvas-runtime-architecture`, and `canvas-quality-audit` cover product design, runtime decisions, and review.
- `canvas-2d-graphics`, `canvas-3d-spatial`, `canvas-maps-diagrams`, and `canvas-demo-lab` cover focused domains.

## Start with the smallest useful path

| Request | Start with | Minimum input | Result and verification | State change |
| --- | --- | --- | --- | --- |
| Choose a renderer for a new feature | `canvas-project-router` | user task, content, supported browsers, and accessibility constraints | A rendering/fallback decision and a focused next skill. Static review is enough unless the decision changes an existing runtime. | None |
| Build or refine one bounded Canvas task | `canvas-experience-orchestrator` in **Feature** mode | changed task, host constraints, and acceptance behavior | One semantic, fallback-capable task slice with focused checks and browser exercise when available. | Project-local files only when implementation is authorized |
| Prototype a scene or interaction | `canvas-experience-orchestrator` in **Prototype** mode | intended task and device/accessibility constraints | One reversible slice and explicit unknowns. No release package, three concepts, or learning receipt by default. | Project-local files only when implementation is authorized |
| Evaluate HTML-in-Canvas | `canvas-html-in-canvas` | controlled browser/channel, clear non-overlay value, fallback, and kill condition | Narrow adapter and separate native-execution versus fallback evidence. | Project-local files only when implementation is authorized |
| Audit a release | `canvas-quality-audit` | declared core flows, browser targets, package target, and evidence | Three scored release rounds, package/readback checks, and a 99/100 gate. | Review artifacts only unless fixes are authorized |

The experimental path is optional. Keep task controls and semantic alternatives in DOM, and call a successful fallback a **task-ready fallback**, never proof of native or cross-browser HTML-in-Canvas support.

## Demo

The optional Vite demo is an executable architecture sample. From `demo/`, install the locked dependencies and run `npm test` or `npm run build`. Browser checks should be performed for the target browser, viewport, and feature availability before making release claims. Follow the reproducible [three-engine browser guide](https://github.com/Gabeujin/codex-plugins/blob/main/docs/BROWSER-TESTING.md); Playwright WebKit is separate from real Safari validation.

For a small independent starting point, use `scripts/create_canvas_starter.py` with `2d`, `3d`, or `map-diagram`. The generated folder has no experimental APIs or large image dependency and includes its own build, interaction, and fallback checks.

## Package asset policy

The detailed concept PNGs have one authoritative in-repository source: `demo/public/concepts/`, which is also the demo runtime path. Pre-consolidation originals are retained outside the distributed source tree with hash verification. Verify the archive and demo build before changing this asset boundary.

## Public-source boundary

This distribution contains source, reusable templates, public runtime assets, and generic validation tools. It intentionally excludes local service configuration, installed dependencies, build products, screenshots, recordings, historical receipts, and local browser evidence.
