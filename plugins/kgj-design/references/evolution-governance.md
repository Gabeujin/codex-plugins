# Evolution governance

## Lifecycle

Use `experimental -> candidate -> stable -> deprecated -> removed`. Every state names an owner,
scope, evidence, compatibility, review date, and reversal condition. History is append-only; current
state is a projection of explicit revisions.

## Admission

Before adding a shared token, component, pattern, or Dictionary candidate, answer:

- What observed user or maker problem exists?
- Is an existing primitive, composition, or product-local pattern sufficient?
- Which distinct contexts demonstrate the same semantic job?
- What is unique, and what would be duplicated?
- Who owns behavior, accessibility, content, migration, and support?
- Which worst-case states, devices, browsers, and assistive technologies were tested?
- What is the removal or deprecation plan?

A product-local pattern may exist for one context. Promotion to shared `stable` requires all six
criteria in `pattern-lifecycle.md` to pass and at least two active evidence records. Distinct contexts
remain preferred; a documented exception may cover a foundational safety or accessibility primitive.

## Extension and forks

Use a bounded variant for a stable semantic difference and composition for structural flexibility.
Avoid open-ended style or behavior overrides. When markup, semantics, state, or interaction materially
diverge, create a separately named and owned component or pattern. Do not disguise a fork as a theme.

## Compatibility

- Semantic token names, public component contracts, Dictionary schemas, and phenotype requirements use SemVer.
- Deprecate before removal and publish machine-readable migration notes.
- Test every registered DNA pack against candidate changes with zero unreviewed breaking differences.
- A breaking semantic change requires a major version; a value-only DNA change may be minor or patch
  depending on visible impact and contract.
- Resolve parent DNA to a content-addressed lock, run `diff-dna`, and preserve a four-stage migration
  plan that separates conversion, preserved behavior, differential probes, and canary rollback.
- A migration remains `hold` until both profiles use the closed v1.2 genome, the product identity is
  unchanged, no breaking token or lineage-contract path remains, and a named owner, concrete rollback
  target, verified registry, lineage/genome review, conversion, preserved behavior, differential probe,
  browser regression, and rollback rehearsal evidence are present. Only then may it become `ready-for-canary`.

## Evidence and source drift

Record the source title, publisher, date, URL, adapted principle, rejected context, and current-check date.
Company cases are conditional evidence, not guarantees. Keep sources partitioned and label KGJ synthesis
as inference. If cross-source comparability is not established, record a hold.

## Dictionary evolution

Local rules and rejections outrank shared patterns. A shared pattern is a non-binding candidate, never a
pooled personality. Publication needs de-identification, purpose-matched consent, provenance, disagreement
and diversity checks, accessibility/privacy review, version, owner, expiry, and rollback. Vote count or
engagement alone cannot make a pattern stable.

In v1, `consented-candidate` is not a boolean shortcut: the local entry must carry a current grant for
`cross-user-candidate-export`, policy version, canonical grant time, and a mandatory expiry within 366
days. The export omits
the grant, local entry ID, product scope, and all raw provenance. Revoke by recording a new private or
revoked revision; exports read only the current projection.

An imported entry starts with `adoptionStatus: pending`. Pending, review-overdue, expired, rejected, or
revoked entries appear only in the review queue and never influence default resolution or export.
`adopt_imported_entry` creates a new append-only revision with explicit confirmation and an adoption note.
An inferred entry starts with `inferenceStatus: pending` and follows an equivalent but separate
`review_inferred_entry` path. A verified inference may influence only its scoped context; a pending or
rejected inference never binds, even when its entry type is `rule`.
