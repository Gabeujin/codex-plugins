# KGJ Expert Review Board

The board is an evidence-producing review protocol, not a decorative panel and not an approval authority.

## Role selection

Choose two to four roles from the artifact's actual risks. Common lenses include:

- architecture, ontology, lineage, and integrity;
- security, privacy, permission, and recovery;
- product strategy, domain fit, and content design;
- accessibility, interaction, responsive behavior, and localization;
- browser performance and runtime correctness;
- reproducibility, packaging, installation, and operational readback.

Each role owns one primary lens. Overlap is intentional only at a release-critical boundary such as evidence truth, destructive action, or accessibility equivalence.

## Three phases

### Independent review

Reviewers work from the same immutable artifact identity and evidence boundary without seeing one another's conclusions. Findings require a severity, exact source or state, impact, counterexample, and acceptance test.

### Cross-examination

Reviewers challenge severity, proof sufficiency, user impact, and hidden dependencies. Agreement and dissent are both retained. A rebuttal must point to evidence or a falsifying test.

### Convergence

The owner maps each surviving finding to one of the existing KGJ quality rounds, orders fixes by dependency, and names the proof required for closure. Convergence never creates a fourth scored round.

## Governance boundary

The board can propose an `insight` or `candidate-pattern`. It cannot make either binding. Dictionary inference review, imported knowledge adoption, pattern promotion, and release approval remain separate explicit operations with their own receipts.

## Minimum receipt

Record artifact hash, roles, independent findings, cross-review links, dissent, acceptance tests, round mapping, evidence references, limitations, and final `pass`, `hold`, or `fail` recommendation. Runner evidence—not consensus—closes the release gate.

