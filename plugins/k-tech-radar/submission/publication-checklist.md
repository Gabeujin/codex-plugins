# Publication checklist

## Internal release gates

- [x] Plugin manifest version and package version are `0.3.0`.
- [x] All 13 local tools have title, bounded input schema, concrete output schema, and annotations.
- [x] Public HTTP mode exposes nine read-only tools and rejects all four local-only names, including direct calls.
- [x] Publisher excerpts carry an explicit untrusted-content envelope.
- [x] Generic migration and shared-product false fusion are regression-tested.
- [x] Uncurated derived work identities remain held, and every selected contributing company/source lane must own its own confirmed-original; surplus work in one company cannot satisfy another lane.
- [x] Runtime data is outside managed plugin caches.
- [x] Refresh uses an integrity-addressed snapshot that binds config, taxonomy, partition, freshness, collection, catalog, and index state, then deterministically rebuilds and compares index semantics.
- [x] Dictionary updates are append-only, idempotent, cross-process serialized, bounded, evidence-pinned, and optimistic-revision checked.
- [x] InsightRun records accepted, held, and no-change outcomes with exact mutation scope and exactly three negative-review rounds.
- [x] Outbound URLs use HTTPS allowlists, redirect checks, DNS private/reserved-address rejection, robots checks, rate queues, and bounded streaming bodies.
- [x] Public release builder bundles zero article records/excerpts.
- [x] Public release builder copies one immutable allowlisted byte snapshot and rechecks the copied destination.
- [x] Public snapshot export is metadata-minimizing, rights-gated for excerpts, non-overwriting, revalidates the 9.9 Dictionary publication gate plus revision hashes, accepts only canonical review timestamps, withholds raw review artifacts and summaries, validates both local and public article-revision shapes, and binds every article to the collection-wide excerpt policy.
- [x] Distributed quality evidence is separately sanitized; raw local review logs are not packaged.
- [x] Five positive and four negative evals exist.
- [x] Local secret scan reports zero findings.
- [x] Windows local verification passes with 130 adversarial tests; GitHub CI defines Windows, Linux, and macOS on Node 20 and 22.
- [x] SBOM and SHA-256 release manifest are generated.

## External universal-directory gates

- [ ] Publisher permission or documented legal basis exists for every centrally hosted field.
- [ ] Production public HTTPS Streamable HTTP URL is deployed and stable.
- [ ] Production endpoint has rate limits, logs/metrics, alerts, rollback, and VPC/container egress controls.
- [ ] Public website URL is final.
- [ ] Public support URL and monitored owner are final.
- [ ] Public privacy URL matches real hosting logs, retention, regions, and subprocessors.
- [ ] Public terms URL is reviewed and final.
- [ ] Individual or business identity is verified in the publishing OpenAI organization.
- [ ] Submitter has Apps Management write access in the same organization/project.
- [ ] Domain challenge is hosted at `/.well-known/openai-apps-challenge`.
- [ ] Submission-portal tool scan passes against the production endpoint.
- [ ] All nine evals pass in supported ChatGPT/Codex surfaces against the deployed endpoint.
- [ ] Availability regions and data-residency claims are confirmed.
- [ ] Reviewer materials and final release notes are uploaded.

## Decision

- Personal/local marketplace: **ready**
- Repository marketplace: **ready with sanitized bundle**
- Git marketplace: **ready with sanitized bundle and repository placeholders replaced**
- npm marketplace: **future option; 0.3.0 intentionally has no publishable registry package**
- Universal public directory: **blocked by the unchecked external gates**

Codex Security permission is not a gate for the first three channels and was not used. Do not claim official Codex Security certification.
