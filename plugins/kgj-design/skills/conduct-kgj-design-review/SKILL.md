---
name: conduct-kgj-design-review
description: Select and orchestrate evidence-bound expert reviewers for a KGJ Design artifact, then converge dissent into the existing three negative quality rounds without auto-adopting insights. Use for final design, architecture, accessibility, ontology, security, browser, or release review.
---

# Conduct a KGJ Design expert review

Use this skill when a product or plugin needs an independent, cross-examined expert review before the KGJ 9.9 gate.

## Required references

Read these files completely before starting:

- `../../references/expert-review-board.md`
- `../../references/quality-gates.md`
- `../../references/quality-rubric.json`
- `../../references/schemas/expert-review.schema.json`

## Workflow

1. Establish the artifact boundary, release target, immutable source identity, current evidence registry, and unresolved decisions.
2. Select two to four roles whose expertise matches the artifact and its highest-risk claims. Always include one adversarial trust reviewer and one product/accessibility reviewer for interactive products.
3. Give each reviewer a non-overlapping primary lens, shared acceptance criteria, read-only authority, exact evidence paths, and a required completion signal.
4. Run independent reviews before sharing conclusions. Every finding must name a source location, severity, user or governance impact, falsifiable acceptance test, and evidence needed to close it.
5. Cross-review findings. Record explicit agreement, rebuttal, narrowed severity, dependencies, and dissent; do not erase minority evidence.
6. Converge the review into the existing KGJ release rounds only:
   - Round 1: architecture, security, ontology, integrity, privacy, lineage, data contracts.
   - Round 2: browser behavior, UX, accessibility, responsive behavior, language, data truth, performance.
   - Round 3: deterministic build, package, install, version identity, clean readback, reproduction.
7. Record the board using the expert-review schema. A review may recommend Dictionary candidates, but it cannot adopt an import, verify an inference, promote a pattern, close a finding, or release an artifact by itself.
8. After fixes, reuse the same reviewers for a bounded verification pass. Attach new proof to the original finding and round; never create a fourth scored round.

## Release rules

- P0 or P1 unresolved: HOLD.
- Missing, stale, unhashed, self-attested, or wrong-proof-level evidence: HOLD.
- Disagreement about a release-critical claim: HOLD until a falsifying test resolves it.
- A consensus statement is advisory until runner-attested evidence satisfies the closed rubric.
- Preserve old failed or limited receipts and supersede them explicitly.

## Output contract

Return:

- selected roles and selection rationale;
- independent findings and their evidence boundaries;
- cross-review agreement, rebuttal, and dissent;
- converged fix order and acceptance tests;
- mapping to quality rounds 1–3;
- files changed, commands/tests run, residual risks, and a completion signal.

