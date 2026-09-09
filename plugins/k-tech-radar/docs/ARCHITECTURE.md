# Architecture

Version: 0.3.0

## Control plane and data plane

K-Tech Radar separates mutable local/admin work from public serving:

```text
official publisher endpoints
          |
          v
local/admin collector -- exact HTTPS hosts, robots, limits, failure isolation
          |
          v
local snapshot -- visibility=local, publisher partitions, Dictionary, InsightRuns
          |
          v
public snapshot exporter -- validation, minimization, visibility conversion
          |
          v
versioned public snapshot -- visibility=public, read-only mount
          |
          v
public Streamable HTTP MCP -- nine read tools, sessions, auth/rate/size limits
```

Collection and knowledge writes never execute in the public HTTP request path. The packaged public marketplace contains an empty fail-closed seed; a useful hosted service mounts a separately exported public snapshot.

## Publisher partitions and semantic overlay

Each configured official source owns one physical partition:

```text
PublisherPartition -> Article -> Publisher metadata
Article -> Domain
Article -> ProblemType
Article -> CanonicalWork
DictionaryRevision -> EvidenceSnapshot -> ArticleRevision
InsightRun -> accepted | held | no-change
```

The catalog and lexical index are derived views of the exact multiset union of physical partitions. A record cannot cross its configured `sourceId`, `companyId`, or official HTTPS host. Exact normalized title/summary matches derive one canonical work family for deduplication but remain `review-required`; a source may curate confirmed originals, translations, or reposts with `workRelations`, whose URLs must remain inside that source's official article pattern. Only curated `confirmed-original` records count toward work independence, and every selected contributing company/source lane must supply its own independently owned confirmed work. Confirmed works concentrated in one company cannot satisfy another lane. Business units, translations, reposts, uncurated identities, and multiple source partitions from the same company do not increase independent-publisher or independent-work diversity.

The shared ontology connects comparable concepts without physically merging publisher records. Cross-source output keeps article ids, source ids, company context, and canonical URLs.

## Integrity and freshness

A schema-v2 snapshot identity binds:

- visibility (`local` or `public`);
- source configuration and taxonomy hashes;
- each publisher partition hash, record count, and `dataAsOf`;
- source success, failure, and attempt state;
- collection scope and outcome;
- the exact catalog and search-index fingerprint.

Reads use one committed snapshot context. Corrupt partitions, duplicate records, config/taxonomy drift, a mismatched catalog union, a lexical index that does not deterministically rebuild from the catalog, a public article projection inconsistent with its collection-wide excerpt-rights policy, or a local snapshot opened by the public runtime fail closed.

Collection uses source and candidate failure boundaries. A malformed article does not abort healthy records, and a failed source retains its previous good partition without receiving a false freshness timestamp. All-source failure does not advance catalog freshness. Fusion freshness accepts only `status=ok` with a non-future `dataAsOf`; `partial`, `error`, unknown states, and clock-skewed future timestamps fail closed.

## Fusion state machine

Cross-company retrieval is deliberately staged:

1. `needs-freshness-review`, `insufficient-source-diversity`, `needs-work-independence-review`, or `needs-comparability-review` holds unsafe candidates.
2. `metadata-comparable` means the metadata supports a shared non-generic anchor, concrete non-negated mechanism, canonical concept, current source state, at least two independent companies, and one independently owned curated original work from every selected contributing company/source lane.
3. Primary evidence must then be fetched and bounded, claims located, source context compared, and counter-evidence recorded.
4. A reviewed Dictionary revision may be created.
5. `verified` and `public` require trusted local environment gates plus exactly three negative-review rounds, ending at score >=9.9, P0=0, and P1=0.

`metadata-comparable` is not a recommendation and must not be promoted to a readiness label.

## Append-only knowledge evolution

Dictionary identity is stable across dates. An update appends an immutable revision with a supersedes pointer, evidence pins for article content, ontology, and taxonomy hashes, and a globally contiguous commit position. Validation recomputes every revision payload/provenance/canonical-claim hash, requires a contiguous supersedes chain and exact commit ownership/order, and compares the terminal revision byte-for-byte with the current entry. Review timestamps are either null or canonical UTC ISO-8601 instants with milliseconds at the MCP input, persisted Dictionary, public export, and public read boundaries. Idempotency keys make replay a no-op; duplicate receipts must follow their original commit, and near duplicates remain review candidates. Verified state cannot be downgraded.

InsightRun is a separate append-only ledger for accepted, held, and no-change research. It records the exact snapshot, selected sources, candidate decisions, mutation scope, exact accepted Dictionary revision pins, the observed Dictionary ledger revision, its globally contiguous commit position, and three negative-review rounds. Each local round embeds one to five canonical artifact envelopes whose SHA-256/bytes are computed from actual content plus subject hash, round, and kind. Replay validates the exact historical target instead of falling back to a current revision. A held/no-change receipt is a successful outcome when evidence is insufficient.

File-backed mutations are serialized across processes with exclusive leases and durable committed/failed receipts. Cross-ledger writes use the fixed `catalog-refresh -> dictionary -> insight-runs` lock order and reload context under lock so acceptance cannot race a refresh or Dictionary update. This supports one local host. Multi-host admin writers require a transactional external store; public HTTP exposes no writes.

## Trust boundaries

Publisher text is untrusted third-party content. It may supply evidence but cannot authorize tools, commands, credentials, files, external messages, or policy changes. Stored publisher excerpts are capped at 600 characters; on-demand excerpts are capped at 4,000 characters or 60% of readable text and are not persisted.

The public exporter defaults to metadata-only. It removes local Dictionary content unless an entry is current, verified, explicitly public, and has passed its publication gate. For retained entries, raw review artifacts and round summaries are replaced with content-withheld hash receipts. Public article revisions use a separate closed integrity/lifecycle projection that the MCP output contract validates alongside the richer local shape. Snapshot validation requires each article's `storagePolicy.publicSnapshot` to equal the collection-wide rights policy; `metadata-only` requires an empty summary, while `bounded-rights-confirmed` still enforces the 600-character cap. The exporter emits no InsightRun history or idempotency receipts.

## Known deliberate boundaries

- No automatic tombstone is created after one or a few misses because feeds and latest-page adapters are incomplete views. Missing-record policy remains review-first.
- The lexical index is local and deterministic; it is not a semantic-vector claim.
- Public static bearer auth is suitable for controlled deployments, not a replacement for OAuth/mTLS where user identity or private data is involved.
- Official OpenAI review, publisher rights, identity, domain verification, production operations, and legal URLs are external release gates.
