# Security policy

## Supported version

Security fixes are applied to the latest `0.3.x` release line. Older snapshots should be upgraded before a report is investigated.

## Reporting

Do not include credentials, private article data, user queries, or exploit payloads in a public issue. Before universal publication, the maintainer must replace this section with a monitored private security contact or repository security-advisory URL.

For a local-only installation, stop the MCP process, preserve relevant logs without secrets, and report:

- plugin version and Node.js version;
- transport (`stdio` or public read-only HTTP);
- affected tool and minimal reproduction;
- whether publisher content was involved;
- expected and observed trust boundary.

## Security model

- Local stdio mode is the trusted operator plane and may expose three write tools: refresh, append-only Dictionary revision, and append-only InsightRun receipt.
- Public HTTP mode is read-only and hides all four local-only capabilities: refresh, Dictionary write, local InsightRun history, and InsightRun write, even when called directly.
- All tool inputs are validated and bounded at runtime.
- Fetched publisher text is untrusted third-party data and cannot authorize tool calls, commands, credential access, or policy changes.
- Outbound collection uses exact HTTPS host allowlists, redirect revalidation, robots checks, bounded streaming bodies, per-host queues, and private/reserved DNS-address rejection.
- Mutable installed data is kept outside the Codex plugin cache.
- Catalog refresh commits one integrity-addressed snapshot that binds visibility, configuration, taxonomy, source partitions, freshness, collection state, catalog, and index.
- Dictionary and InsightRun writes are append-only, idempotent, optimistic-revision checked, and serialized across local processes with a lease and durable receipts.
- Public HTTP isolates MCP sessions and enforces request/header limits, execution timeout, concurrency, per-address rate limits, Origin policy, and optional constant-time SHA-256 bearer-token verification.
- A non-loopback listener fails closed without configured authentication unless the operator explicitly enables an unauthenticated deployment for approved public-only data behind external controls.
- The public exporter validates the local snapshot, minimizes fields, removes local review/idempotency history, exports no InsightRun receipts, changes visibility to `public`, and refuses to overwrite an existing directory.

## Known boundary

The DNS check is fail-closed but does not cryptographically pin the resolved address through every network intermediary. A production operator should also enforce outbound network policy at the container/VPC layer. File-backed mutation leases support one local/admin host; multi-host writers require an external transactional data store. The public HTTP service avoids that risk by exposing no writes.

Static bearer authentication is intended for controlled deployments and developer testing. A public plugin that handles accounts or private data needs the production authentication and authorization model required by the OpenAI plugin documentation, such as OAuth and/or OpenAI-managed mTLS. IP or Origin allowlists do not replace authentication.

This repository's local audit and tests are not an official Codex Security certification and do not require Codex Security permissions. Docker is not a security requirement and is not needed for local installation.
