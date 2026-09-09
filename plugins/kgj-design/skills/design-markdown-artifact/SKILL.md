---
name: design-markdown-artifact
description: Structure or refine a KGJ Markdown artifact for repositories, operational handoffs, knowledge bases, or decision records. Use when meaning must survive plain text and multiple renderers while keeping a recognizable product voice, strong hierarchy, and trustworthy evidence labeling.
---

# Design a Markdown Artifact

Read [typography and content](../../references/typography-and-content.md) and
[web output contracts](../../references/web-output-contracts.md).

## Preserve meaning without CSS

Use one clear title, short framing copy, predictable heading levels, and lists only when they improve
scanability. Use tables for exact mappings or comparisons, not for prose. Keep code, paths, statuses,
dates, identifiers, assumptions, and evidence boundaries mechanically distinguishable.

Express DNA through editorial rhythm, vocabulary, naming, hierarchy, and restraint rather than HTML
styling tricks. Prefer familiar Korean wording, one action per instruction, and explicit consequences.
Format quantitative values with locale-aware grouping while leaving identifiers unchanged.

## Verify portability

Check CommonMark/GitHub rendering, heading order, link targets, fenced code language, long-line behavior,
and copy/paste usability. Avoid raw HTML unless the target renderer and security model explicitly allow
it. Do not represent an unverified result as complete merely because the Markdown format is valid.
