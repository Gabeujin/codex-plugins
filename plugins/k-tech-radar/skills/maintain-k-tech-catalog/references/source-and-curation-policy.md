# Source and curation policy

## Collection priority

1. Official RSS or Atom.
2. Official sitemap for missed-history recovery.
3. Low-rate official public list pages.
4. Documented public API only when the publisher presents it for external use.

Never use a blocked endpoint, authentication bypass, browser fingerprint evasion, or a third-party aggregator as the source of record.

## Storage boundary

Store title, author, company, business unit, publication and revision dates, canonical URL, publisher tags, a publisher excerpt capped at 600 characters, independent short analysis, content hash, and ontology links.

Do not persist complete article text, feed bodies, page HTML, images, diagrams, or substantial code. On-demand evidence is capped at 4,000 characters and 60% of readable text, whichever is smaller, and is not stored.

## Identity and revision

- Identify an article with `sourceId + canonicalUrl`.
- Keep GUID and content hash as auxiliary identity.
- Preserve `firstSeenAt`, `lastSeenAt`, `lastChangedAt`, and revision hashes.
- Keep translation and repost clusters separate from independent publisher evidence.
- Retain missing records until repeated checks justify a tombstone policy.

## Tag mapping

Preserve raw tags as `sourceId:rawTag`. Map them to canonical domains or problems as a separate overlay. Use `relatedTo` when equivalence is uncertain.

## Operational behavior

- One in-flight request per host.
- Evaluate robots rules before collection.
- Permit HTTPS only, validate every redirect, and stay within the source's exact host allowlist.
- Use source-specific delay and bounded responses.
- Stop on 403.
- Honor 429 `Retry-After` and use bounded backoff for transient failures.
- Isolate source failures and retain the previous good partition.
- Atomically replace files and commit the derived catalog only after all physical source partitions and the index are valid.
- Report partial freshness explicitly.

## Known boundaries

- Velopers: product-discovery reference only; do not ingest.
- NAVER D2: prefer Atom; do not depend on undocumented screen APIs.
- SOCAR: do not access robots-disallowed `/api/`.
- Banksalad: keep only canonical `/tech/` items in the technical index.
- Kakao Pay: preserve Kakao Pay, Securities, and Insurance business-unit signals.
- LY Corporation: preserve language and group-company signals; do not count translations as independent evidence.
- Woowahan Brothers: do not work around feed, robots, or API restrictions; fall back to low-rate public pages.
