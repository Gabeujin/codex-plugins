# HTML-in-Canvas capability contract (v2)

Status: controlled Chromium experiment; this document is an evidence contract, not a support claim. The proposal text is pinned to WICG commit [`d4433e329697c4341a9f915f75dbd9608f3939fa`](https://github.com/WICG/html-in-canvas/commit/d4433e329697c4341a9f915f75dbd9608f3939fa) dated 2026-07-14 and was re-checked against live official sources on 2026-08-26. Chrome implementation status, the living WICG explainer, and WHATWG Stage-2 incubation are separate evidence layers.

## Capability matrix

| Surface | Current proposal contract | Required proof |
|---|---|---|
| Opt-in | `<canvas layoutsubtree>` (`layoutSubtree` reflected IDL) opts descendants into layout/hit testing; direct children become stacking contexts, containing blocks, and paint-contained. Pixels remain invisible until drawn. | Attribute is present in the latest rendering update; direct-child/generated-box constraints pass. |
| Canvas 2D | `drawElementImage()` snapshots a canvas child; current CTM and destination geometry apply; source CSS transforms are ignored for pixels; overflow is clipped to the border box. Returns a `DOMMatrix`. | Exact overload executes during `paint`; returned transform is applied to the source element. |
| WebGL | The proposal extends `WebGLRenderingContext`, while this lab verifies only a WebGL2 `texElementImage2D(target, internalformat, element, optional config)` subset. Older examples contain a legacy overload, so detect and record the exact signature used. | WebGL2 texture upload and rendered geometry are both verified; no WebGL1 or legacy-signature support is implied. |
| WebGPU | `GPUQueue.copyElementImageToTexture(source, destination)` uploads an element/`ElementImage`; placement is shader-dependent. | MVP-to-`DOMMatrix`, pixel-to-unit normalization, viewport mapping, Y inversion, and `getElementTransform()` alignment are asserted. |
| Worker | `captureElementImage(element)` returns transferable `ElementImage`; transfer to worker and draw via `OffscreenCanvas`. | Main-thread transform/state synchronization, transfer success, close/teardown, and fallback are recorded. |

## Pinned proposal-snapshot IDL

```idl
partial interface HTMLCanvasElement {
  [CEReactions, Reflect] attribute boolean layoutSubtree;
  attribute EventHandler onpaint;
  void requestPaint();
  ElementImage captureElementImage(Element element);
  DOMMatrix getElementTransform((Element or ElementImage) element, DOMMatrix drawTransform);
};
partial interface OffscreenCanvas {
  DOMMatrix getElementTransform((Element or ElementImage) element, DOMMatrix drawTransform);
};
interface mixin CanvasDrawElementImage {
  DOMMatrix drawElementImage((Element or ElementImage) element, unrestricted double dx, unrestricted double dy);
  DOMMatrix drawElementImage((Element or ElementImage) element, unrestricted double dx, unrestricted double dy, unrestricted double dwidth, unrestricted double dheight);
  DOMMatrix drawElementImage((Element or ElementImage) element, unrestricted double sx, unrestricted double sy, unrestricted double swidth, unrestricted double sheight, unrestricted double dx, unrestricted double dy);
  DOMMatrix drawElementImage((Element or ElementImage) element, unrestricted double sx, unrestricted double sy, unrestricted double swidth, unrestricted double sheight, unrestricted double dx, unrestricted double dy, unrestricted double dwidth, unrestricted double dheight);
};
CanvasRenderingContext2D includes CanvasDrawElementImage;
OffscreenCanvasRenderingContext2D includes CanvasDrawElementImage;
partial interface WebGLRenderingContext {
  void texElementImage2D(GLenum target, GLenum internalformat, (Element or ElementImage) element, optional WebGLCopyElementImageConfig config = {});
};
partial interface GPUQueue {
  void copyElementImageToTexture(GPUCopyElementImageSource source, GPUCopyElementImageDestination destination);
};
interface PaintEvent : Event { readonly attribute FrozenArray<Element> changedElements; };
[Exposed=(Window,Worker), Transferable] interface ElementImage {
  readonly attribute double width;
  readonly attribute double height;
  undefined close();
};
```

## Lifecycle and synchronization

The pinned proposal says the browser records a descendant snapshot immediately before `paint`. During `paint`, drawing commands use the current snapshot and appear in that frame; outside `paint`, the previous snapshot is used. Drawing before the first snapshot throws. `paint` fires after intersection-observer steps when child rendering changes and exposes `changedElements`; DOM changes made in the handler appear next frame. Nested canvases fire in reverse tree order.

`requestPaint()` is treated as an optional scheduler capability in this implementation, not as a native-readiness prerequisite. When unavailable, a semantic DOM invalidation plus the next rendering update is used; an exact first-paint receipt remains mandatory before the lane can become native-ready. Telemetry distinguishes `requestPaint` capability, exact invocation, DOM-invalidation scheduling, and first/current snapshot state.

For 2D, applying the returned `drawElementImage()` matrix to `element.style.transform` is a current Chromium prototype synchronization recipe. For 3D, this prototype derives a draw matrix from shader/model-view-projection math and calls `getElementTransform()`. These recipes are not stable normative hit-testing contracts while [#135](https://github.com/WICG/html-in-canvas/issues/135) and [#148](https://github.com/WICG/html-in-canvas/issues/148) remain open. Resize with `device-pixel-content-box` when available (otherwise CSS size × DPR); coalesce paint/upload work and keep observers outside paint callbacks.

## Security, privacy, and unsupported truth

The proposal is read-back-allowed rendering: pixels and invalidation must not reveal new sensitive information. Cross-origin embedded content/resources (including iframe, image, URL/CSS references, tainted canvas, and SVG external references) are omitted/restricted; same-origin iframe content may paint. Visited-link state, spellcheck markers, autofill previews, system theme/colors, subpixel text AA, caption preferences, and IME popups/distinctive formatting must not be exposed. Only fully active documents are supported.

Chrome’s launch article describes Chrome 148–150 origin-trial availability and Canary 149+ behind `chrome://flags/#canvas-draw-element`; live Chrome Status checked on 2026-08-26 records an extended 148–154 experiment, implementation `In development`, and no stable release. Therefore label any result `experimental controlled preview` or `prototype with bounded evidence`. A feature check, library wrapper, screenshot, or successful flag alone is not proof of stable support, accessibility, cross-origin behavior, deployment, or browser interoperability. Keep a semantically equivalent DOM/conventional-canvas fallback with state continuity and a kill switch.

## Instrumentation fields

Record: browser/engine, exact version/channel, OS, date, flag/origin-trial validity (never token), WICG commit/date and open-issue delta, selected context and exact overload, `typeof`/execution results for each primitive, initial-snapshot status, paint count and `changedElements`, `requestPaint` capability/execution/scheduling strategy, canvas CSS/grid/DPR dimensions, transform matrices, prototype provenance and measured alignment error, resize/scroll/animation timing, pointer/keyboard/focus/IME/selection/find assertions, same- and cross-origin outcomes, context/device loss, fallback reason, frame-time/upload/long-task/memory samples, teardown resource counts, console errors, and evidence artifact IDs.

## Acceptance tests

1. Run absent and present capability paths; exact overload execution must pass, with a visible fallback when unsupported.
2. Exercise initial snapshot, DOM invalidation, optional `requestPaint`, repeated updates, resize/DPR/zoom, scroll, animation, nested canvas, and teardown.
3. Prove pixel/event alignment after 2D transforms and WebGL/WebGPU shader transforms using click, hover, focus, keyboard, selection/copy, find-in-page, and accessibility checks.
4. Exercise long Korean/RTL/vertical text, forms, media, reduced motion, dark/high-contrast/forced-colors, and ~390 CSS px viewport.
5. Test same-origin and cross-origin descendants/resources; verify omission or safe failure rather than leaking or tainting sensitive pixels.
6. Exercise worker `ElementImage` transfer where used, context/device loss, failed assets, runtime kill switch, and state-preserving fallback.
7. Capture browser/version assertions, postconditions, screenshots, console, performance, and leak evidence. Do not call the demo production-ready without current live-status and deployment evidence.

## Known instability

The origin-trial window, flag behavior, API signatures, paint timing details, and browser support are unstable. Current upstream issue boundaries include RTL/corner placement [#146](https://github.com/WICG/html-in-canvas/issues/146), precise hit testing [#148](https://github.com/WICG/html-in-canvas/issues/148), nested scaling [#149](https://github.com/WICG/html-in-canvas/issues/149), responsive sizing [#151](https://github.com/WICG/html-in-canvas/issues/151), optional/missing `requestPaint` [#152](https://github.com/WICG/html-in-canvas/issues/152), and transform/input design [#135](https://github.com/WICG/html-in-canvas/issues/135). The WICG WebGL example explicitly carries a legacy-signature compatibility branch. Threaded auto-updating for native scroll/animation is a future consideration, not a current guarantee; cross-browser standardization is unresolved.

## Fixture evidence status (2026-08-26)

| Fixture | Current status | Claim boundary |
|---|---|---|
| Exact Canvas 2D, WebGL2, WebGPU and worker overloads | Controlled Chrome execution observed | Browser/profile-bound, not stable support |
| First paint and `requestPaint`-optional scheduler | Unit path plus controlled Chrome first-paint receipt | Missing `requestPaint` must use DOM invalidation; no silent pass |
| 2D/GPU transform alignment | Controlled desktop measurement | Prototype provenance only; not precise-hit-test conformance |
| CSS resize, DPR, zoom and 390px layout | Regression verification required for each release | No generalized responsive claim without current fixture receipt |
| RTL and alternate-corner placement | Route-level Arabic fixture required | Upstream #146 remains open |
| Nested canvas scaling/order | Unmeasured in this release | Upstream #149 remains open |
| Cross-origin/privacy filtering and fully-active document | Unmeasured in this release | Never infer safety from same-origin local demos |
