---
name: canvas-html-in-canvas
description: Prototype and implement experimental HTML-in-Canvas features using drawElementImage, texElementImage2D, or copyElementImageToTexture with controlled Chrome adoption, progressive fallbacks, interaction, security, and performance evidence. Use for DOM content composited into Canvas 2D, WebGL, WebGPU, Three.js, PlayCanvas, PixiJS, or Babylon.js.
---

# Canvas HTML in Canvas

Use the experiment as an innovation accelerator. Keep its browser dependency observable and replaceable.

## Required references

Read completely before implementation:

- `../../references/official-sources.md`
- `../../references/early-adopter-playbook.md`
- `../../references/html-in-canvas-recipes.md`
- `../../references/html-in-canvas-capability-contract-v2.md`
- `../../references/qa-gates.md`

For framework selection, also read the relevant entries in `../../references/codebase-catalog.md`.

## Non-negotiable truth boundary

As of the catalog's checked date, HTML-in-Canvas is experimental. Use the exact current method names:

- `CanvasRenderingContext2D.drawElementImage`
- `WebGLRenderingContext.texElementImage2D` / WebGL2 equivalent
- `GPUQueue.copyElementImageToTexture`

Never claim stable, standardized, or cross-browser support from a draft, library wrapper, origin-trial article, or successful feature check alone. Re-check live official status and the target runtime.

## Workflow

### 1. Define the leap

Identify what HTML capture makes newly possible or substantially better: live media, rich text, forms, accessible controls, responsive cards, spatial dashboards, editable world-space UI, or shader composition. Compare it with a DOM overlay and conventional rasterization.

Choose Lane 0, 1, 2, or 3 from the early-adopter playbook. Record browser/channel/version, flag or token, cohort, success metric, fallback, and kill condition.

### 2. Build a narrow adapter

Keep raw experimental calls behind a product-level interface such as `createHtmlTexture()` or `attachInteractiveSurface()`. The adapter owns:

- exact feature detection for context and overload;
- source-element creation and direct-child/layout constraints;
- first-paint readiness and meaningful-change paint-event coalescing;
- exact detection of `layoutSubtree`/`layoutsubtree`, `onpaint`, `requestPaint()`, `captureElementImage()`, and `getElementTransform()` when the chosen path needs them;
- device-pixel sizing and resize observation;
- CSS/world/destination transform synchronization;
- unsupported, security, cross-origin, upload, and context-loss fallbacks;
- resource and listener disposal;
- stable changed-element identities, measured alignment, transferable ownership receipts, activation/fallback telemetry, and runtime kill switch.

Do not scatter browser flags or raw prototype checks through product components.

Capability presence selects a candidate lane; it is not execution proof. Keep the lane `awaiting-native-proof` until a real `paint` callback executes the current IDL overload and the returned or calculated transform is applied. If upload or synchronization fails, expose that failure and recover to the task-equivalent DOM path instead of retaining a green native badge.

### 3. Preserve a conventional path

Maintain one task-equivalent route:

- semantic DOM overlay for interactive HTML;
- conventional Canvas text/shape rendering;
- pre-rendered or server-generated texture;
- non-spatial DOM representation;
- static preview for unsupported environments.

State may not be lost when switching paths. Critical content or transactions cannot exist only inside the experiment while support remains unsettled.

### 4. Respect capture constraints

Account for direct-child/generated-box requirements, overflow clipping, first snapshot timing, source transforms, cross-origin omission, scroll/animation timing, font/image readiness, taint/export effects, and main-thread upload cost. Create observers outside paint callbacks, keep renderer-only animation out of the semantic source, coalesce repeated work, and stop RAF/upload work on context or device loss. Never use capture as an HTML sanitizer or sandbox: build user content from a trusted data model or sanitized DOM under CSP, reject untrusted script/event-handler content, and test resource origins separately.

A raster fallback or ordinary texture alone has no DOM semantics. In the native experiment, the source DOM may preserve interaction, accessibility, selection, find, and related browser behavior when `layoutsubtree` and returned-transform synchronization are correct. Decide whether the product uses that source DOM, coordinate forwarding, or a separate semantic layer, then verify the exact behavior in the target browser.

### 5. Verify aggressively

In a named real browser/version, exercise:

- feature absent and feature present;
- DevTools origin-trial validity result without recording the token value, plus `typeof` for every needed primitive and an exact-overload execution test;
- first paint, current-versus-previous snapshot sequencing, stable `changedElements` IDs, resize, DPR, animation, scrolling, and transform changes;
- pointer, keyboard, focus, IME, selection, media, long Korean text, and reduced motion;
- same-origin and cross-origin descendants;
- measured hit-target alignment at the lane tolerance, Canvas 2D/WebGL/WebGPU context or device loss, and exactly-once Worker `ElementImage.close()`;
- performance under representative content;
- fallback, telemetry, kill switch, and state continuity.

Record evidence with `../../assets/templates/canvas-qa-ledger.md`.

For a multi-domain lab, read `../../references/demo-modernization-ledger-v3.md`. Count a domain as HTML-in-Canvas only when its own semantic source element, selected primitive, non-overlay value, fallback, primary interaction, and proof are all present. A conventional Canvas animation with a nearby DOM card does not count.

## Delivery language

Describe a successful controlled preview as such. Describe production use as progressive enhancement unless current live standards and stable-browser evidence prove otherwise. Include the exact remaining uncertainty.
