---
name: canvas-experience-design
description: Design and refine polished Canvas experiences, including app chrome, scene composition, interaction modes, responsive behavior, motion, Korean UX writing, accessibility, and product-specific visual identity. Use for portfolios, creative sites, editors, games, maps, dashboards, and spatial tools before or during implementation.
---

# Canvas Experience Design

Translate product intent into a coherent interaction and visual system without copying another product's surface style.

## Required reference

Read `../../references/design-quality-system.md`. For material implementation, also read `../../references/qa-gates.md`.

## Six-lens review

Evaluate every meaningful screen through six lenses:

1. web publishing: structure, responsive behavior, typography, overflow, asset fidelity;
2. Korean business language: names, labels, descriptions, and numeric display;
3. copy: clarity, consistency, tone, and action hierarchy;
4. UX writing: context, recovery, empty/error states, and confidence;
5. UI/UX engineering: interaction states, accessibility, performance, and browser behavior;
6. UI/UX design: hierarchy, composition, density, rhythm, color, depth, and motion.

## Workflow

### 1. Establish product DNA

Inspect existing design tokens, components, container rules, copy, icons, and interaction patterns. Write the user, task, tone, environment, and invariants. Preserve established product identity.

For each problem, use:

`observed friction -> principle -> adaptation to this product -> success check`

Treat outside design insights as reasoning inputs. Reject any pattern that makes the result feel like a copied template.

### 2. Define a visual target

For substantial greenfield or major redesign work, define composition, palette, typography, density, depth, motion, and asset direction before coding. Use a small design-system inventory and one strong visual concept rather than many unrelated effects.

If central artwork determines the product experience, create or source appropriate assets. Do not present placeholder shapes as final game, portfolio, map, or architectural art.

### 3. Design shell and scene together

Separate the semantic DOM shell from the renderer scene, then design their relationship:

- navigation, toolbar, properties, layers, status, help, modals, and notifications;
- viewport composition, camera, world origin, selection, handles, labels, minimap;
- panel docking/overlay/collapse rules;
- coordinate and focus handoff;
- loading, streaming, empty, error, offline, context-loss, and read-only states.

Keep the Canvas primary. Avoid stacking generic cards over it until little scene remains.

### 4. Specify interaction grammar

Define mouse, touch, pen, keyboard, focus, cancel, undo, selection, pan, zoom, edit, and tool-mode behavior. Make modes visible with shape/text/state, not color alone. Motion must explain causality or continuity and must have a reduced-motion alternative.

### 5. Implement or guide implementation

Reuse the host system first. Preserve accepted copy and colors unless the task authorizes change. Use real interactions, not decorative buttons. Keep high-frequency renderer state out of unnecessary component re-renders.

Format user-visible quantities with locale grouping from 1,000 upward, but do not group years, dates, versions, IDs, coordinates whose notation would change meaning, or other identifiers.

### 6. Prove quality

Inspect a real rendered result at wide desktop and about 390 CSS pixels. Exercise keyboard-only use, focus, overflow, long Korean text, dense content, error states, reduced motion, and representative scene interactions.

Run two exploratory design passes: one to break workflows and one to disprove visual quality. Feed both findings into the single browser UX/accessibility/performance round when the orchestrator's exactly-three-round gate applies; do not create extra scored rounds. Classify P0/P1/P2 and leave no unresolved P0/P1.

## Deliverable

Provide the product DNA, visual direction, interaction/state specification, responsive rules, asset plan, implementation changes, browser evidence, and unresolved P2 items. Do not call mockups or static review deployed proof.
