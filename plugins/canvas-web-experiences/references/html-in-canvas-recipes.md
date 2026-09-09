# HTML-in-Canvas implementation recipes

These are original starter patterns based on the current WICG explainer. They are deliberately narrow because the proposal and TypeScript DOM declarations may change. Re-check the explainer before each implementation.

## 1. Narrow capability probe

Avoid global `any` casts and user-agent checks. Extend only the experimental surface you need.

```ts
interface ExperimentalCanvas2D extends CanvasRenderingContext2D {
  drawElementImage(source: Element, dx: number, dy: number): DOMMatrix;
  drawElementImage(
    source: Element,
    dx: number,
    dy: number,
    destinationWidth: number,
    destinationHeight: number,
  ): DOMMatrix;
}

interface ExperimentalCanvasElement extends HTMLCanvasElement {
  requestPaint(): void;
}

export function detectHtmlCanvas2D(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  const candidate = context as Partial<ExperimentalCanvas2D> | null;
  const experimentalCanvas = canvas as Partial<ExperimentalCanvasElement>;

  if (
    !context ||
    typeof candidate?.drawElementImage !== "function" ||
    typeof experimentalCanvas.requestPaint !== "function"
  ) {
    return null;
  }

  return {
    canvas: canvas as ExperimentalCanvasElement,
    context: context as ExperimentalCanvas2D,
  };
}
```

Probe the actual context needed by the product. A Canvas 2D success does not prove the WebGL or WebGPU overload.

## 2. Canvas 2D adapter skeleton

The source must be a direct Canvas child with generated boxes. Keep the observer outside the paint handler, synchronize the returned transform, and retain a normal-DOM fallback.

```ts
type HtmlSurfaceMode = "html-capture" | "dom-fallback";

export function attachHtmlSurface(
  canvas: HTMLCanvasElement,
  source: HTMLElement,
  report: (event: { mode: HtmlSurfaceMode; reason?: string }) => void,
) {
  const capability = detectHtmlCanvas2D(canvas);
  if (!capability || source.parentElement !== canvas) {
    report({ mode: "dom-fallback", reason: "unsupported-or-invalid-source" });
    return { mode: "dom-fallback" as const, dispose() {} };
  }

  canvas.setAttribute("layoutsubtree", "");
  const { context } = capability;

  const paint = () => {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    const transform = context.drawElementImage(source, 0, 0);
    source.style.transform = transform.toString();
  };

  const resize = new ResizeObserver(([entry]) => {
    const deviceBox = entry.devicePixelContentBoxSize?.[0];
    const ratio = window.devicePixelRatio || 1;
    const width = deviceBox?.inlineSize ?? Math.round(entry.contentRect.width * ratio);
    const height = deviceBox?.blockSize ?? Math.round(entry.contentRect.height * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      capability.canvas.requestPaint();
    }
  });

  canvas.addEventListener("paint", paint);
  resize.observe(canvas, { box: "device-pixel-content-box" });
  capability.canvas.requestPaint();
  report({ mode: "html-capture" });

  return {
    mode: "html-capture" as const,
    dispose() {
      resize.disconnect();
      canvas.removeEventListener("paint", paint);
      source.style.removeProperty("transform");
    },
  };
}
```

Adapt the sizing and destination transform to the scene. Test browsers that do not expose `devicePixelContentBoxSize` and avoid overloading mobile GPUs with an unbounded DPR.

## 3. WebGL and WebGPU routing

Do not assume the conventional image upload signature applies. Follow the current IDL in the WICG explainer:

- WebGL uploads an `Element` or transferable `ElementImage` through `texElementImage2D` plus an optional crop/size configuration.
- WebGPU copies an `Element` or `ElementImage` source to a tagged texture destination through `copyElementImageToTexture`.
- A captured `ElementImage` can support a worker/OffscreenCanvas path; close or release transferable resources according to the current API contract.

Wrap each backend behind the same product adapter and report which backend activated. Test device/context loss, texture recreation, source resize, color/alpha behavior, and upload cost.

## 4. Framework integration routes

- Three.js: use the current `HTMLTexture` integration only after verifying renderer/backend support; dispose the texture and keep a DOM overlay route.
- PlayCanvas: check the engine's HTML-texture capability and preserve its documented fallback.
- PixiJS: own the `HTMLSource` lifecycle, paint listener, resource sizing, and destruction.
- Babylon.js: verify the current HTML Texture API and browser backend; do not infer support from the engine version alone.
- Canvas UI: study its per-component feature probes and WebGL-overlay fallbacks, but review its MIT + Commons Clause terms before distribution.

## 5. Required telemetry

Emit coarse technical signals rather than captured content:

- target browser/version/channel and adoption cohort;
- probe result and selected backend;
- fallback reason;
- first usable paint latency;
- paint/update/upload duration and slow-update count;
- context/device loss and recovery;
- adapter error category;
- kill-switch activation.

Do not log DOM text, form values, media, pixels, URLs containing secrets, or user content merely because it was captured.

## 6. Test doubles

Unit tests can inject a fake adapter and assert routing, cleanup, state continuity, and telemetry. They cannot prove Chromium painting, hit testing, transform synchronization, or privacy filtering. Preserve a real-browser test for those claims.

## V3 lane contract and truth labels

The app's 12-domain catalog plus `demo-modernization-ledger-v3.md` are the source of truth for lane assignment. Native paths remain experimental. A receipt is current only when its source hash, exact overload, browser profile, viewport, interaction postcondition, alignment tolerance, and package version all match the build under review.

| Domain | Lane / primitive | Semantic task and same-state fallback |
|---|---|---|
| Portfolio Atlas | Canvas 2D / `drawElementImage` | Select, copy, find, focus; DOM overlay |
| Motion Studio | WebGL / `texElementImage2D` | Edit motion spec; DOM overlay |
| Signal Runner | Canvas 2D / `drawElementImage` | Keyboard/IME terminal; DOM overlay |
| Spatial Gallery | WebGL / `texElementImage2D` | Curatorial action and hit test; DOM overlay |
| Living City Map | Canvas 2D / `drawElementImage` | Pan/zoom, RTL, selection; DOM overlay |
| Flowboard | Canvas 2D / `drawElementImage` | Drag/edit/focus node; DOM overlay |
| Plan Lab | Worker / `captureElementImage` | Transfer/resize/close review sheet; DOM overlay |
| Climate Lens | Canvas 2D / `drawElementImage` | Table, brush, locale, copy; DOM overlay |
| Shader Cinema | WebGPU / `copyElementImageToTexture` | Caption edit and device-loss recovery; DOM overlay |
| Orbit Classroom | Canvas 2D / `drawElementImage` | MathML, requestPaint, focus; DOM overlay |
| Spatial Commerce | WebGL / `texElementImage2D` | Product form to mesh and hit test; DOM overlay |
| Digital Twin | WebGL / `texElementImage2D` | Alarm/threshold/restore; DOM overlay |

The adapter must verify `layoutsubtree`, direct-child/generated-box constraints, initial snapshot, `paint`/`changedElements`, `requestPaint`, exact overload execution, resize/DPR, transform sync, transferable ownership, and context/device loss. Preserve stable source IDs in `changedElements`; close each captured `ElementImage` exactly once; measure alignment instead of counting transform calls; coalesce semantic repaint to meaningful content changes; retire RAF/upload work immediately after GPU or context loss. A feature check alone only permits a **candidate** native mode. Cross-origin/privacy filtering still requires an isolated browser fixture; until it is run, the trusted local DOM scope stays explicit.
