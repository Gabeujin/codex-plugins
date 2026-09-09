# Canvas experience design quality system

## 1. Product DNA before styling

Write a short product DNA statement before choosing a visual style:

- user and environment;
- primary task and desired emotional tone;
- existing brand, component, spacing, typography, color, and container rules;
- accessibility and device constraints;
- what must remain unmistakably part of the host product.

For each observed friction, record:

`friction -> design principle -> product-specific adaptation -> measurable success check`

Patterns learned from another product are raw material. Do not copy its surface appearance, branding, card grammar, or motion signature. Reject any pattern that weakens the host product's identity or task.

Three Toss Tech Design lessons inform this system without importing Toss branding: validate material interaction through a working prototype instead of a still mockup; use motion to explain feedback and state; and treat components as a governed product with documentation and a feedback loop. In this plugin those lessons become live Canvas experiments, explicit motion tokens/reduced-motion behavior, and shared runtime/quality contracts.

## 2. Separate app chrome from the scene

The Canvas viewport is not the entire application.

- Keep global navigation, forms, settings, search, permissions, status, help, and rich text in semantic DOM when possible.
- Put scene-relative marks, meshes, sprites, tiles, paths, selection outlines, and high-frequency visual feedback in the renderer.
- Define explicit bridges for pointer coordinates, selection state, focus, keyboard commands, announcements, and responsive layout.
- Avoid overlay drift by choosing one coordinate owner and one transform pipeline.

## 3. Build a design system inventory

Before implementation, inventory tokens and primitives:

- typography roles and Korean text behavior;
- color roles, contrast, selection, warning, disabled, and focus colors;
- spacing, radii, stroke widths, elevation, and z-order;
- icon source and minimum target size;
- viewport, panel, toolbar, inspector, minimap, tooltip, toast, modal, and command palette;
- cursor and gesture grammar;
- animation durations, easing, interruption, and reduced-motion alternatives;
- quantity formatting with locale-aware grouping while leaving IDs, dates, versions, and coordinates semantically correct.

Reuse existing project tokens. When the project lacks them, create the smallest coherent set needed by the feature.

## 4. Interaction grammar

Define every applicable state:

- idle, hover, pressed, selected, focused, dragging, panning, zooming, editing;
- loading, streaming, empty, error, offline, context-lost, permission-denied;
- locked, hidden, read-only, conflict, undoable, saved, unsaved;
- keyboard-only and touch-only paths.

Tool mode must remain visible without relying only on color. Escape should predictably cancel or step back. Destructive actions need a recoverable path. Zoom should preserve the user's point of interest. Panning and selection gestures must not fight browser scrolling without an explicit reason.

## 5. Visual direction and assets

For a substantial greenfield experience, define a visual target before code: composition, density, type hierarchy, palette, depth, motion, and the relationship between app chrome and scene.

- Use real or generated visual assets when central artwork makes the product; do not present placeholder geometry as finished game or portfolio art.
- Keep text, controls, and status live in HTML unless the renderer genuinely needs them as pixels.
- Avoid generic dashboard cards, arbitrary gradients, excessive glow, decorative particles, or cinematic motion that does not reinforce task or identity.
- Motion must communicate causality, hierarchy, continuity, or state. Provide a reduced-motion path.

## 6. Responsive behavior

Verify at a representative wide desktop and around 390 CSS pixels.

- Define which panels dock, overlay, collapse, or become sheets.
- Preserve the scene's important point while chrome changes.
- Keep touch targets usable and prevent controls from covering core content.
- Test long Korean strings, 200% text zoom, browser zoom, safe areas, virtual keyboard, and orientation changes.
- Cap device pixel ratio only when profiling shows a need; never distort CSS-to-device coordinate mapping.

## 7. Exactly three negative rounds

Use the scored sequence in `qa-gates.md`: architecture/security, browser UX/accessibility/performance, then reproducibility/package/install. Do not merge or add rounds. Within the browser round, try keyboard-only, touch, rapid resize, zoom extremes, long content, context loss, failed assets, route changes, clipped labels, overlay drift, jitter, weak focus, contrast loss, occlusion, generic styling, and mobile regressions.

Completion requires at least 9.9/10, exactly three recorded rounds, and no unresolved P0 or P1.
