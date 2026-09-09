# Data governance and ontology boundaries

## Partition model

Each official publisher is a physical evidence partition:

`Publisher -> Article -> Publisher metadata`

The derived catalog is a union view, not a new source of truth. Every article keeps `sourceId`, `companyId`, canonical URL, and content hash. Exact normalized title/summary matches share a derived work id for deduplication, but every automatically derived identity remains `review-required`. Per-source `workRelations` may curate a record as `confirmed-original`, translation, or repost only when each configured URL matches that publisher's official HTTPS article boundary. Translations, reposts, uncurated identities, and business units must not inflate independent-source or independent-work counts. Each selected contributing company/source partition must own at least one independent `confirmed-original`; surplus confirmed works in one company never satisfy another partition.

## Shared ontology

Cross-company discovery uses:

`Article -> Domain`

`Article -> ProblemType`

`Article -> MechanismSignal`

These edges do not merge articles. A Dictionary synthesis remains derived and retains every evidence edge.

## Fusion gate

`metadata-comparable` requires all of:

1. at least two official publisher partitions;
2. a non-generic shared query anchor;
3. a concrete shared causal or verification mechanism;
4. a shared canonical domain or problem;
5. current `status=ok`, non-future source partitions;
6. at least two independent companies, with an independently owned curated `confirmed-original` canonical work in every selected contributing company/source lane after translation/repost deduplication.

Generic migration, legacy, architecture, upgrade, or technical-debt language is diagnostic only. A shared product or stack token, a negated mechanism, stale source data, two partitions from one company, or records whose original-work identity is not curated is also insufficient. Otherwise the result is held as `needs-freshness-review`, `insufficient-source-diversity`, `needs-work-independence-review`, or `needs-comparability-review`.

`metadata-comparable` permits an evidence-review workflow, not an automatic synthesis. Material claims still require bounded primary-source evidence, locators, context comparison, counter-evidence, and immutable revision pins.

## Knowledge states

- `candidate`: unreviewed working note;
- `reviewed`: primary evidence and counter-evidence reviewed with source contexts;
- `verified`: trusted local-admin state after non-metadata primary evidence and counter-evidence review;
- `superseded`: retained history whose meaning has been replaced.

Dictionary updates are append-only immutable revisions with stable entry identity, contiguous supersedes links, evidence pins, idempotency receipts, a globally contiguous commit position, and monotonic status. Every revision's canonical payload, provenance, claim, and revision hashes are replayed before acceptance; review timestamps must be canonical UTC ISO-8601 instants with milliseconds, duplicate receipts must follow their owning original commit, and `verified` cannot be downgraded.

InsightRun records accepted, held, and no-change outcomes separately from Dictionary knowledge. An accepted run requires exactly three negative-review rounds and a final score of at least 9.9 with P0=0 and P1=0. Each local round embeds actual review text in a canonical content-addressed envelope bound to the normalized subject and round; caller-supplied hash/size claims are never trusted. Accepted runs pin exact verified Dictionary revisions, the observed Dictionary ledger revision, and a globally contiguous InsightRun commit position. Replay resolves the exact historical target and fails closed if it is missing or changed. Weak evidence should produce a held/no-change receipt, not a forced synthesis.

Public HTTP mode cannot create or update any state. A public snapshot contains only current, verified, explicitly public Dictionary entries, replaces their raw review artifacts and round summaries with content-withheld hash receipts, validates its reduced article-revision projection against a closed public schema, and never exports InsightRun history. Its collection-wide publisher excerpt policy is enforced against every article: metadata-only projections have empty summaries, and rights-confirmed excerpts remain bounded.
