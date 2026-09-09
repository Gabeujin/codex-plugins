# Changelog

## 0.3.0 — 2026-07-30

- Bound every read to one schema-v2 snapshot identity covering visibility, source configuration, taxonomy, partition hashes, source freshness, collection outcome, catalog, and index.
- Added strict partition/official-host validation, exact union checks, taxonomy-drift reclassification, per-candidate failure isolation, honest partial freshness, and fail-closed public visibility.
- Replaced fusion readiness language with `metadata-comparable`; added independent-company, canonical-work, freshness, negation, anchor, mechanism, and ontology gates before primary-evidence review.
- Added explicit official-boundary `workRelations`, review-required derived canonical-work identities, curated confirmed-original status, and translation/repost deduplication; every selected company/source lane must now own an independent confirmed original, so surplus works in one company cannot satisfy another.
- Added immutable Dictionary revisions, complete historical-chain validation, stable identity, evidence pins, idempotency receipts, globally contiguous commit-ledger verification, legacy recommit migration, cross-process mutation leases, monotonic verification, and guarded public-visibility promotion.
- Added append-only accepted/held/no-change InsightRun receipts with exact mutation scope, globally contiguous commit-ledger verification, exact historical replay targets, Dictionary revision pins, and exactly three negative-review rounds.
- Materialized bounded review evidence as content-addressed artifacts bound to the reviewed subject and round; caller-declared hashes and unknown persisted fields now fail closed.
- Serialized catalog, Dictionary, and InsightRun commits under an explicit lock order and reloaded context inside the lock to prevent stale cross-ledger acceptance.
- Added `prepare_application_plan`, `list_insight_runs`, and `record_insight_run`; local stdio now exposes 13 tools and public HTTP exposes nine reads.
- Added isolated HTTP sessions, hashed bearer authentication, rate limiting, fail-closed non-loopback startup, and concrete per-tool output schemas.
- Replaced the public package denylist with an explicit allowlist, immutable source-byte snapshot, destination quality recheck, symlink/unexpected-file rejection, secret scanning, executable tests, empty public seed, SBOM, and release manifest.
- Added a metadata-minimizing local/admin-to-public snapshot exporter that withholds raw Dictionary review artifacts and round summaries, requires canonical review timestamps, validates reduced public article-revision projections, binds every public article to the collection-wide excerpt-rights policy, and corrected the optional Docker data mount to `/data`.
- Expanded regressions across closed snapshot schemas, deterministic catalog-to-index semantics, ledger ownership/order, legacy migration, per-company work independence, malformed numeric entities, ID-less HTTP initialization, public review privacy, generic-path quality-gate sanitization, and build-time mutation resistance; the release quality gate records the final executable counts.

## 0.2.0 — 2026-07-28

- Added a public read-only Streamable HTTP MCP endpoint with health checks, body/header limits, timeouts, concurrency caps, and Origin controls.
- Added titles, output schemas, behavior annotations, and runtime input validation for all ten tools.
- Split mutable installed data from managed plugin caches and added atomic snapshot commits.
- Hid refresh and Dictionary writes from public mode; added optimistic Dictionary revisions, entry/file limits, and a trusted-local gate for `verified`.
- Marked publisher excerpts as untrusted third-party content and removed bidi/zero-width control characters.
- Added DNS private/reserved-address rejection and streaming response limits.
- Tightened cross-company fusion: generic migration language and shared product names are insufficient without a concrete shared mechanism.
- Added a sanitized public marketplace builder with zero bundled article records, SBOM, and SHA-256 release manifest.
- Expanded regression coverage from 24 to 44 tests and added secret scanning.

## 0.1.0 — 2026-07-28

- Initial local plugin with nine official publisher partitions, 292 private/local metadata records, ontology, lexical search, Dictionary, three skills, and ten stdio MCP tools.
