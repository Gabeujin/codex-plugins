---
name: audit-kgj-design
description: Run the KGJ Design release audit for a plugin, web experience, HTML report, Markdown system, or design-system mutation. Use when production readiness, adversarial review, package/install proof, or the explicit 9.9 quality gate is requested.
---

# Audit KGJ Design

Read [quality gates](../../references/quality-gates.md) completely. Also read the output-specific
contract and the product DNA used by the artifact.

## Evidence first

Run the project contract doctor and inventory declared core flows and typed evidence proof levels.
Static validation, build, browser interaction, local
installation, and deployment are separate claims. Every pass must bind to a real command, artifact,
viewport, browser/runtime, and post-condition. Failed evidence remains recorded and is resolved only by
an explicit later passing item.

## Exactly three negative rounds

1. Architecture, security, product-DNA boundaries, data trust, compatibility, and recovery.
2. Browser or renderer UX, accessibility, language, responsive behavior, and performance.
3. Reproducibility, deterministic package, manifest, marketplace, install, and readback.

Fix and retest inside the affected round. Do not add a fourth scored round. Later regressions attach to
the original round. In strict mode, every ledger reference must resolve to an active evidence registry
record and every declared local hash must match. Use the exact 15 checks in
`references/quality-rubric.json`; the ledger may bind evidence and findings but may not author scores.
Evidence may be reused by multiple checks inside one round, but never across different rounds.

## Release decision

Report findings before strengths. PASS requires a weighted score of at least 9.9/10, exactly three
recorded rounds, zero unresolved P0 or P1, and every declared core flow supported by the required proof
level. Scores are derived from missing checks and finding penalties, so a handwritten 9.9 is invalid.
Otherwise return HOLD with the exact missing evidence and next safe action. Validate the ledger
with `python scripts/kgj_design.py quality <ledger.json> --evidence-registry <registry.json>`.
