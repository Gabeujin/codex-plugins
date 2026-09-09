---
name: design-html-report
description: Create or refine a self-contained KGJ HTML report for code review, analysis, evidence, decisions, or executive reading. Use when the artifact must work in a browser, print cleanly, preserve source boundaries, and express a product-specific visual identity rather than a generic report template.
---

# Design an HTML Report

Read [web output contracts](../../references/web-output-contracts.md),
[typography and content](../../references/typography-and-content.md), and
[accessibility and data](../../references/accessibility-and-data.md).

## Build the reading contract

Start with the reader's decision, not decoration. Make status, scope, evidence boundary, key finding,
and next action scannable before supporting detail. Use semantic headings, landmarks, tables for exact
mappings, and progressive disclosure for secondary evidence.

Express the same product DNA as the source service while adapting density and typography for long-form
reading. A report may be editorial where an operations screen is dense, but it must retain the same
voice, semantic colors, and trust conventions.

## Portability and integrity

Prefer a self-contained artifact when offline handoff is expected. Do not embed secrets, private source
bodies, or external assets without a license and availability decision. Cite sources near claims. Mark
examples, generated interpretations, unverified findings, and verified evidence distinctly.

Include print styles, useful page breaks, selectable text, accessible table alternatives for charts,
long-URL wrapping, and locale-aware quantity formatting. Verify browser and print rendering; a valid
HTML file alone is not a readable report.
