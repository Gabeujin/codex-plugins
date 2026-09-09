# Interaction and motion

## Interaction grammar

Define applicable states before animation: idle, hover, pressed, focused, selected, expanded, dragging,
editing, loading, partial, error, offline, permission-denied, saved, unsaved, conflict, and complete.
State must not rely on color alone. Escape cancels or steps back predictably, destructive actions have a
recoverable path, and focus returns to a meaningful owner.

## Semantic motion

Choose motion by intent rather than raw duration:

- feedback: confirm a direct input without delaying it;
- orientation: reveal origin, destination, or hierarchy;
- continuity: preserve identity across a state or layout change;
- attention: direct focus to one meaningful change;
- expression: a rare product-owned brand moment after the task is safe.

Repeated interactions should usually be near-instant; entrances may orient, and exits should get out of
the way. All motion is interruptible and reversible when the underlying action is reversible. Critical
focus, errors, confirmations, and assistive announcements do not wait for animation.

`prefers-reduced-motion` must preserve task completion with motion removed or made functionally instant,
not merely slowed. Avoid flashing, large sweeps, parallax, and competing simultaneous animations.

## Spatial and Canvas boundary

Use DOM for navigation, forms, text, status, and accessibility. Use SVG/Canvas/WebGL for the semantic
artifact only when scale, pixels, vectors, or spatial interaction justify it. Define one coordinate
owner, state bridge, focus bridge, textual alternative, renderer fallback, lifecycle teardown, and
performance budget. Experimental APIs require feature detection, controlled-browser evidence, and a
kill switch.
