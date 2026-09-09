# Output contracts

One product DNA may produce several phenotypes. Preserve the genome and voice while adapting composition
to the medium.

| Medium | Primary contract | Product expression | Required proof |
|---|---|---|---|
| Web app/service | semantic interaction, state, responsive task completion | density, hierarchy, signature interaction, live data grammar | named browser, desktop and ~390 px, keyboard, reduced motion, console |
| HTML report | evidence-led reading, source proximity, print integrity | editorial rhythm, report navigation, data annotation | browser, print preview/PDF where requested, links, overflow |
| Markdown | meaning survives plain text and multiple renderers | vocabulary, hierarchy, naming, restraint | CommonMark/GitHub render, links, code fences, copy/paste |
| Spatial/Canvas | renderer earns complexity; DOM owns semantics | scene grammar, spatial signature, input model | performance, fallback, lifecycle, textual alternative, browser |

## Web app/service

- Put the primary job and current status ahead of navigation chrome.
- Keep essential expert context visible; progressively disclose supporting detail.
- Define empty, loading, partial, error, permission, offline, saved, conflict, and complete states as applicable.
- Avoid page-level horizontal overflow at minimum width; make intentional data scrollers discoverable.
- Derive state from one source of truth; tabs, filters, totals, and completion cannot contradict each other.

## HTML report

- Lead with decision, scope, status, evidence boundary, and next action.
- Use headings and landmarks; tables only for exact mappings; `details` for secondary evidence.
- Prefer self-contained delivery when offline handoff is expected. Record any external dependency.
- Add print color, page-break, URL-wrap, and repeated-table-header behavior where relevant.
- Distinguish example, generated interpretation, static validation, browser proof, and deployment proof.

## Markdown

- One title, predictable heading order, concise framing, stable anchor names, and fenced code languages.
- Use lists for sequences or sets and tables for repeated fields; do not turn prose into a wall of bullets.
- Avoid raw HTML unless the renderer and security policy allow it.
- Keep paths, commands, identifiers, dates, assumptions, and evidence mechanically distinct.

## Evidence boundary

A passing parser or build proves structure. A browser screenshot proves one captured state. Interaction
proof requires the action and post-condition; deployment proof requires the intended deployed URL to
serve and execute the intended build.
