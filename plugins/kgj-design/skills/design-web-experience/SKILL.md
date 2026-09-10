---
name: design-web-experience
description: Design, implement, or refine a distinctive web application, dashboard, local service, or interactive page from a KGJ product-DNA profile. Use when semantic DOM, responsive behavior, stateful interaction, accessibility, performance, and real-browser evidence are part of the deliverable.
---

# Design a Web Experience

Read [web output contracts](../../references/web-output-contracts.md),
[token system](../../references/token-system.md),
[interaction and motion](../../references/interaction-and-motion.md), and
[accessibility and data](../../references/accessibility-and-data.md).

## Rendering boundary

Use semantic DOM for text, navigation, forms, status, search, and accessible controls. Use SVG or
Canvas only when the artifact is genuinely vector, pixel, spatial, or performance-sensitive. For a
hybrid, keep one coordinate owner and an explicit state/focus bridge. A decorative renderer must
not become the only carrier of meaning.

## Express the product

Compile the selected DNA profile or map its semantic tokens into the host system. Preserve the
genome while letting density, hierarchy, palette, typography, shape, copy, and signature interaction
fit the product's domain. Avoid generic card grids, arbitrary gradients, ornamental glass, and motion
that exists only to appear advanced.

## Refinement mode

Use refinement mode for a bounded change to an existing surface, such as spacing, copy, one control,
or a localized accessibility fix. First read the existing token and contract files that govern that
surface, then change only the affected implementation. Do not create product DNA, record a KGJ
Dictionary entry, package a release, or run the release three-round gate for this mode.

Check the affected viewport and, when interaction or focus changed, complete the affected keyboard
path. Use the full required-state and browser checklist below for a new feature, a changed flow or
state model, a responsive redesign, or release work.

## Required states and proof

Implement applicable empty, loading, partial, error, permission, offline, saved, and completed
states. Format user-visible quantities with locale-aware grouping; never group identifiers, dates,
times, versions, or codes.

Verify the primary task in a named real browser at a representative desktop viewport and around
390 CSS pixels. Check keyboard completion, focus return, 200% text zoom, reduced motion, long Korean
content, touch targets, horizontal overflow, and console errors. Record what static checks do not
prove.
