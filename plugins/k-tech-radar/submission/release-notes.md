# Submission release notes — 0.3.0

K-Tech Radar helps users discover and compare official Korean technology-blog evidence while retaining publisher provenance.

This release adds or hardens:

- a session-isolated public read-only Streamable HTTP MCP endpoint with optional hashed bearer authentication and rate limiting;
- complete tool titles, input/output schemas, and behavior annotations;
- strict runtime input, request-size, timeout, and concurrency limits;
- explicit untrusted-content envelopes for publisher excerpts;
- a comparability gate that blocks generic migration and product-name false fusion;
- integrity-addressed schema-v2 snapshots binding publisher partitions, freshness, collection outcome, taxonomy/configuration, catalog, and index;
- immutable idempotent Dictionary revisions with evidence pins, guarded public promotion, and a cross-process mutation lease;
- append-only accepted/held/no-change InsightRun receipts with exact three-round negative-review gates;
- metadata-comparable fusion that requires current independent companies, an independently owned curated confirmed-original work from every selected company/source lane, a non-generic anchor, a concrete non-negated mechanism, and a shared ontology concept before primary-evidence review;
- a product-context-aware `prepare_application_plan` tool;
- a sanitized public marketplace build with zero publisher article records, SBOM, and SHA-256 release manifest;
- a separate versioned public-snapshot exporter that defaults to metadata-only, replaces raw Dictionary review artifacts and round summaries with content-withheld receipts, validates canonical review timestamps and public article-revision projections, binds every article to the collection-wide excerpt-rights policy, and excludes local review history;
- an immutable allowlisted public build with a destination quality recheck and a public-sanitized audit projection that rejects generic local paths and credential-like values;
- deterministic catalog-to-index semantic validation, malformed numeric-entity containment, and rejection of ID-less initialization before public session allocation;
- five positive and four negative submission evals.

The local stdio plugin has 13 tools. The public HTTP service exposes only nine read-only tools and cannot refresh, write Dictionary state, or read/write local InsightRun history.

External publication remains blocked until the operator supplies a production HTTPS endpoint, publisher-rights basis, verified publisher identity, Apps Management access, verified domain, and final website/privacy/terms/support URLs.
