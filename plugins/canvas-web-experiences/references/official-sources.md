# Official source map

## Current status: HTML-in-Canvas

Status checked: 2026-08-26 against live official pages and WICG main commit `d4433e329697c4341a9f915f75dbd9608f3939fa` (2026-07-14). The bundled v1.6 lab also has controlled-profile Chrome 151 execution evidence, but that observation does not identify the channel, flag, or activation mechanism and is not a stable-support claim.

HTML-in-Canvas is an experimental proposal, not a stable cross-browser Canvas API.

| Signal | Evidence | Safe interpretation |
|---|---|---|
| Chrome launch article | [Introducing the HTML-in-Canvas API origin trial](https://developer.chrome.com/blog/html-in-canvas-origin-trial), last updated 2026-05-19, originally announced Chrome 148–150 origin trial and Canary 149+ flag | A time-bounded experiment was announced; the Chrome Status entry now records an extension through milestone 154 |
| Incubation | [WICG explainer](https://github.com/WICG/html-in-canvas) describes the API behind a flag | Names and behavior can still change |
| Standards track | [WHATWG issue #10650](https://github.com/whatwg/html/issues/10650) is open at Stage 2; [draft PR #11588](https://github.com/whatwg/html/pull/11588) is not the living standard | Do not claim standardization from the existence of a draft PR |
| Living standard | [WHATWG Canvas chapter](https://html.spec.whatwg.org/multipage/canvas.html) does not contain these APIs | Existing Canvas accessibility and fallback obligations still apply |
| Chrome status | [Chrome Platform Status](https://chromestatus.com/feature/5172548013916160) reports implementation `In development`, no shipped stable milestone, and an origin-trial extension through milestone 154 | An extended experiment is not evidence of stable shipping; live verification and a production fallback remain mandatory |

Never collapse these signals into “Chrome now supports HTML in Canvas.” State the exact browser version, channel, flag or origin-trial token, API overload, test date, and fallback that were actually verified.

### Current lifecycle and IDL contract

The WICG README is a living explainer. `layoutsubtree` opts the canvas subtree into layout and hit testing. Its direct children are visible as if drawn into the canvas; rendering APIs sample those descendants, while normal DOM hit testing, focus, selection, scrolling, forms, and accessibility continue to target the source elements. CSS transforms are ignored when drawing the source snapshot but still affect hit testing and accessibility, so the transform returned by `getElementTransform()` must be applied back to the source element to keep interaction geometry aligned. A descendant snapshot is recorded immediately before `paint`; drawing during `paint` uses that frame, calls outside it use the previous snapshot, and calls before the first snapshot throw. `paint` carries `changedElements`; DOM mutations made inside it appear in the next frame; `requestPaint()` requests one paint even without invalidation; nested canvases fire in reverse tree order.

The current IDL names are `HTMLCanvasElement.layoutSubtree`, `onpaint`, `requestPaint()`, `captureElementImage(Element)`, and `getElementTransform(Element or ElementImage, DOMMatrix)`, transferable `ElementImage`, the four `drawElementImage` overload families on 2D/Offscreen contexts, `WebGLRenderingContext.texElementImage2D(target, internalformat, element, optional config)`, and `GPUQueue.copyElementImageToTexture(sourceMap, destinationMap)`. The launch article and some examples contain earlier signatures; exact overload execution must therefore be recorded rather than inferred from `typeof`.

For 2D, apply the returned draw matrix to `element.style.transform`. For WebGL/WebGPU, derive the draw matrix from shader/MVP math and use `getElementTransform`; normalize CSS pixels to unit geometry, map to viewport, and account for Y inversion. The official WebGPU example still leaves transform synchronization as a TODO, so it is an illustration rather than conformance proof. `captureElementImage()` can transfer to a worker/OffscreenCanvas, but transform/state synchronization returns to the main thread and every transferred `ElementImage` needs an exactly-once ownership receipt.

Read-back-allowed rendering excludes sensitive cross-origin/resource pixels and privacy signals (including visited links, spellcheck, autofill previews, system theme, IME popups, and similar data). Same-origin iframe content may paint; cross-origin iframe content does not. Main-thread scroll/animation updates are not a native threaded auto-update guarantee.

### Evidence boundary for the bundled lab

The v1.6 lab records exact current-IDL calls, paint snapshot phase, stable `changedElements` identities, measured edge alignment (Canvas/Worker at most 2 px; GPU at most 4 px), native-source hit testing, focus and form changes, Worker explicit-close/terminal-release ownership, first-frame promotion, direct-native task postconditions, and same-state fallback in the user's Chrome profile. Unit tests only prove adapter contracts. Privacy filtering, cross-origin omission, browser UI find highlighting, named assistive-technology products, and hardware context/device-loss sessions remain browser-product conformance checks and must not be inferred from the bundled trusted local DOM fixture.

## Exact experimental surface

The current proposal exposes these families:

- Canvas 2D: `CanvasRenderingContext2D.drawElementImage(...)`
- WebGL: `WebGLRenderingContext.texElementImage2D(...)` and WebGL2 equivalent
- WebGPU: `GPUQueue.copyElementImageToTexture(...)`
- Supporting primitives: reflected `HTMLCanvasElement.layoutSubtree` / markup `layoutsubtree`, `onpaint`, `requestPaint()`, `captureElementImage()`, and `getElementTransform()`

For the controlled developer trial, the WICG explainer currently names `chrome://flags/#canvas-draw-element`. Record the actual flag state and Chrome version rather than assuming a Canary build has it enabled.

Do not invent or use `drawElement` as the API name.

## Constraints that affect architecture

- The HTML source must satisfy the proposal's direct-child and generated-box constraints.
- CSS transforms on the source do not automatically become pixels in the destination; synchronize transforms with the proposed transform helper where supported.
- The source is clipped by overflow and only the latest painted snapshot is available.
- Capture before the first snapshot can throw.
- Cross-origin descendants are omitted or constrained for privacy and security.
- Main-thread scrolling and animation can race with texture updates.
- A feature-detection success is not proof that the selected overload, CSS behavior, keyboard interaction, or cross-origin composition works.
- `captureElementImage()` and transferable `ElementImage` belong to this proposal; stable OffscreenCanvas support does not imply stable DOM capture.

## Implementation guidance

Read the relevant guides from [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance):

- `interactive-content-in-3d-scenes`
- `apply-webgl-shaders`
- `export-html-media-from-canvas`
- `expose-canvas-content-to-browser-features`
- `accessibility`

Use `ResizeObserver` with device-pixel-aware sizing, but do not allocate observers inside the paint callback. Keep capture/update work bounded and coalesced. Export through `toBlob`, `captureStream`, or a server pipeline according to the product need rather than assuming DOM snapshots are portable.

## Official demos and engine integrations

- [Chrome HTML-in-Canvas demos](https://chrome.dev/html-in-canvas/)
- [Google Chrome Labs curated examples](https://github.com/GoogleChromeLabs/css-web-ui-demos/blob/main/html-in-canvas/awesome-html-in-canvas.md)
- [Chrome web UI overview](https://developer.chrome.com/blog/new-in-web-ui-io26)
- [Proposal security and privacy questionnaire](https://github.com/WICG/html-in-canvas/blob/main/security-privacy-questionnaire.md)
- [W3C TAG design review](https://github.com/w3ctag/design-reviews/issues/1204)
- [Mozilla position thread](https://github.com/mozilla/standards-positions/issues/1076) and [WebKit position thread](https://github.com/WebKit/standards-positions/issues/630)
- [Web Platform Test results](https://wpt.fyi/results/html/canvas/element/manual/draw-element-image)
- [Chromium implementation issue](https://issues.chromium.org/issues/500967896)
- [Three.js HTMLTexture docs](https://threejs.org/docs/pages/HTMLTexture.html) and [source](https://github.com/mrdoob/three.js/blob/dev/src/textures/HTMLTexture.js)
- [Three.js HTMLTexture example](https://threejs.org/examples/webgl_materials_texture_html.html)
- [PlayCanvas HTML-in-Canvas guide](https://developer.playcanvas.com/user-manual/graphics/advanced-rendering/html-in-canvas/)
- [PixiJS HTMLSource](https://pixijs.download/release/docs/rendering.HTMLSource.html)
- [Babylon.js HTML texture guide](https://doc.babylonjs.com/features/featuresDeepDive/materials/using/htmlTexture/)
- [Canvas UI project and fallback implementations](https://github.com/DavidHDev/canvas-ui)

These integrations remain subject to the underlying browser experiment. Library-level API availability does not make browser support stable.

## Stable Canvas and graphics foundations

- [MDN Canvas API](https://developer.mozilla.org/docs/Web/API/Canvas_API)
- [MDN Canvas tutorial](https://developer.mozilla.org/docs/Web/API/Canvas_API/Tutorial)
- [MDN Canvas optimization](https://developer.mozilla.org/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- [MDN OffscreenCanvas](https://developer.mozilla.org/docs/Web/API/OffscreenCanvas)
- [MDN WebGL API](https://developer.mozilla.org/docs/Web/API/WebGL_API)
- [MDN WebGPU API](https://developer.mozilla.org/docs/Web/API/WebGPU_API)
- [WebGPU specification](https://www.w3.org/TR/webgpu/)
- [Khronos WebGL specification registry](https://registry.khronos.org/webgl/)
- [Chrome origin trials documentation](https://developer.chrome.com/docs/web-platform/origin-trials)

## Accessibility baseline

The Canvas element needs equivalent fallback or adjacent semantic content for meaningful interaction. Preserve keyboard navigation, programmatic names, focus visibility, reduced-motion behavior, high-contrast resilience, and data alternatives. Treat [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) and the current WHATWG Canvas accessibility text as constraints, not optional polish.
