# Task-first Canvas improvement contract

Use this contract when changing an existing Canvas experience or choosing the scope for a new one. It keeps the primary task legible while retaining the experimental and evidence boundaries that matter.

## Scope routing

| Mode | Use when | Required outcome | Do not imply |
|---|---|---|---|
| Prototype | The user needs an architecture decision, a visual direction, or one reversible slice. | One meaningful task surface, semantic DOM alternative, stated fallback, and an explicit unknowns list. | Browser execution, package install, 9.9 score, or release readiness. |
| Feature | The user asks to build or improve a bounded task in an existing experience. | The user can discover the task, act, see a durable result, and reset/cancel/return when the feature offers it. Check the intended desktop/mobile layouts and browser behavior when available. | Cross-domain completion, installed-plugin proof, or a release gate. |
| Release | The user asks for a shippable plugin or release-ready Canvas experience. | The complete evidence chain, exactly three scored negative rounds, package/install readback, and learning receipt. | Stable or cross-browser support for an experimental API. |

If the request does not say release, choose Prototype or Feature based on whether code must change. A fixed process is not a substitute for a user task.

## Task-first UI rules

1. Start with the selected task, its instruction, and its next meaningful action. Do not make a capability count, a frame metric, or a receipt the visual focal point.
2. Keep navigation in semantic DOM and make every visually available destination identifiable without relying on an arbitrary icon. For a large route set, show a compact named set plus an explicit all-destinations list or sheet.
3. Preserve one interactive task surface in each runtime state. A native experiment may enhance rendering but must not replace the semantic fallback or make its state diverge.
4. Place raw API capability, paint/upload counters, worker ownership, and alignment data under an explicit **Evidence** or **Developer** disclosure. Keep a concise, truthful user-facing state such as “experimental preview” or “fallback active.”
5. A modal must manage focus: move focus inside on open, constrain keyboard focus while open, restore the invoking control on close, and support Escape where dismissal is allowed.

## Assertions that earn evidence

Visual presence, a port, a feature check, a green badge, and a screenshot are not enough. For every changed primary task path, capture:

`pre-state -> named user action -> durable post-state -> evidence artifact`

Also assert the actual recovery path that exists in the UI:

- reset restores the defined initial state;
- cancel leaves the prior durable state unchanged;
- navigation returns to the expected route/task state and focus;
- a fallback transition preserves the same business state;
- a responsive layout remains usable at the specific viewports affected by the change.

Use keyboard assertions for keyboard-reachable tasks. Record an unavailable browser or tool as a bounded gap rather than replacing the assertion with a static claim.

## Real-object 3D acceptance

When an experience presents a central product or sculpture as 3D, it must be a volumetric mesh with meaningful depth and normals that respond to lighting. A scaled, skewed, or displaced raster is not 3D proof.

- Keep the background immutable while the object orbits, so camera/object movement is distinguishable from a screen-plane animation.
- Exercise direct-drag full yaw and pitch. Capture the front, side, back, and top/rear-oblique states; the latter views must reveal geometry that cannot be explained by a flattened image.
- Return to the front and assert that the source task state is preserved. Then operate a real HTML button after orbiting and assert its durable state change. This proves both orbit recovery and that the visual layer did not intercept the task control.
- Inspect the actual event target and focus/hit path for the post-orbit control. A visible label, an optimistic badge, or a click on an overlay is not equivalent to the intended HTML control receiving the interaction.
- When an HTML texture is projected into a 3D material, account for texture-coordinate Y inversion explicitly. CSS `backface-visibility` describes DOM painting and cannot substitute for a world-space mesh normal, material-side, depth-test, or hit-test assertion.

Record the mesh/source identity, browser/version, viewport, drag path, view artifacts, before/after task state, and the observed target. Missing any of these leaves the 3D claim bounded; this section does not assign a quality score.

## Experimental API generation guard

HTML-in-Canvas proposals evolve. Before relying on an upstream name or sample, record its official source, revision/date, browser/version/channel, exact method signature, and observed execution result. A capability detection result does not authorize migration.

Current external discussion may refer to a later API generation using names including `drawable`, `updateElementGeometry`, `texElementSubImage2D`, and `drawElementImageToTexture`. Treat those as a verification trigger, not a mechanical rename of the pinned implementation. Do not change documented calls, renderer bindings, or fallback behavior until the chosen generation is pinned and exact browser execution is proven. If that proof is absent, retain the existing documented path and label the result bounded.

## Dated release evidence

Attach release claims to the exact source hash, browser/version/channel, API revision, and test date. Existing receipts are historical evidence only. They may inform a new run, but cannot automatically set a new source or release to 9.9/10, `passed`, production-ready, or cross-browser compatible. Refresh the official status and run the proportionate browser assertions before making a new claim.
