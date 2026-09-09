---
name: curate-kgj-dictionary
description: Search, explain, record, supersede, revoke, or export KGJ Design Ontology and Dictionary knowledge for a user's product-specific design preferences and verified outcomes. Use when design decisions should learn across sessions without flattening context or when the user asks how KGJ Design remembers and evolves.
---

# Curate the KGJ Dictionary

Read [ontology and dictionary](../../references/ontology-and-dictionary.md) and
[evolution governance](../../references/evolution-governance.md).

## Search before applying

Search with the current product, domain, surface, audience, risk, locale, and task frequency. Keep
conflicts visible. Resolve matching entries in this order:

`explicit local rule -> scoped local rejection -> verified local outcome -> explicit preference -> reviewed shared candidate -> unverified inference`

Specific scope beats general scope. Pending imports, review-overdue entries, and expired entries are
review-only and cannot influence the default result. Recency never erases history. Explain
which entry influenced the decision and how to disable or reject it.

## Record only with intent

Use `record_dictionary_entry` only when the user explicitly asks KGJ Design to remember, learn, record,
or update a preference or outcome. Require `confirmRecordIntent: true`, the current expected revision,
and a stable idempotency key. Classify the entry as exactly one of:

- `observation`: time-bounded evidence, not automatically a preference;
- `preference`: a user-stated inclination within a declared scope;
- `rule`: an explicit local instruction, subject to safety and product constraints;
- `rejection`: a first-class counterexample or do-not-use instruction;
- `experiment`: a reversible hypothesis with metric, window, and rollback;
- `outcome`: a measured result against declared criteria;
- `candidate-pattern`: de-identified, non-binding guidance imported or prepared for sharing.

Never record raw screenshots, credentials, private source bodies, sensitive traits, psychological
labels, or free-form content that is unnecessary for the decision. Personal entries remain local.

Inferred entries are a separate review queue, never rules by construction. Use
`list_pending_inferences`, inspect the exact source and evidence references, then call
`review_inferred_entry` with the current revision, a stable idempotency key, and an explicit
`verified` or `rejected` decision. Only a verified inference may become binding; a generic record or
raw MCP argument cannot bypass this transition.

## Share portable learning, not identity

Export only on explicit request. Require an allowlist of entry IDs and separate confirmation. Strip
identifiers, raw rationale, exact timestamps, private paths, and unsupported inferences. Imported
patterns remain namespaced `pending` candidates until the receiving user explicitly invokes
`adopt_imported_entry` with confirmation, current revision, idempotency key, and adoption note; they
never become another user's rule automatically. Use `get_dictionary_health` and
`list_pending_imports` or `list_pending_inferences` to expose review debt without mutating it. A
portable export contains only closed `portablePrinciples`; it excludes local titles, guidance,
rationale, timestamps, and paths even when the selected entry was consented.
