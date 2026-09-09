# Tool annotation justifications

## Read-only local-index tools

`get_source_status`, `list_recent_articles`, `search_articles`, `get_article`, `prepare_fusion_evidence`, `search_dictionary`, `prepare_application_plan`, `list_insight_runs`, and `get_ontology` are read-only, non-destructive, and idempotent. `list_insight_runs` is local-only; the remaining listed read tools except on-demand evidence are closed-world.

## On-demand evidence

`fetch_article_evidence` is read-only, non-destructive, and idempotent with respect to plugin state. It has `openWorldHint: true` because it performs a bounded HTTPS request to the selected official publisher URL.

## Local/admin refresh

`refresh_catalog` is not read-only and has `openWorldHint: true` because it checks official publisher endpoints and commits a new local snapshot. It is non-destructive: missing publisher responses do not delete records. It is not idempotent because freshness timestamps and remote data can change.

## Local/admin Dictionary

`record_dictionary_entry` is not read-only and is closed-world. It is non-destructive and idempotent: it appends an immutable revision, retains the superseded revision, uses an idempotency key, and cannot downgrade verified state. Public HTTP mode does not expose it.

## Local/admin InsightRun receipt

`record_insight_run` is not read-only and is closed-world. It is non-destructive and idempotent because it appends an accepted, held, or no-change receipt under an idempotency key. It requires exactly three negative-review rounds. Public HTTP mode exposes neither this write nor `list_insight_runs`.
