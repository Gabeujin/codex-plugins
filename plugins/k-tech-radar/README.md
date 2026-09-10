# K-Tech Insight Radar 0.3

K-Tech Radar is a local Codex plugin for discovering and applying evidence from official Korean technology blogs. It indexes metadata and short publisher-provided excerpts, never a private mirror of full posts.

The repository supports two deliberately different distributions:

- **Private/local source** can retain a user-collected metadata snapshot for fast local search.
- **Public marketplace bundle** is produced by `npm run build:public` with zero article records, excerpts, local Dictionary entries, or review receipts. A local user refreshes after installation. A hosted read-only service receives only an explicitly exported, validated public snapshot.

The model has three layers:

1. **Physical publisher partitions** under `data/partitions/<sourceId>/articles.json` isolate every company's raw records and recovery boundary.
2. **Derived catalog and index** expose the exact union of those partitions without becoming a new source of record.
3. **Shared domain/problem nodes** prepare cross-company evidence matrices. A synthesis remains a derived Dictionary entry whose claims link back to every contributing article.

This lets Codex compare ideas without flattening distinct operating contexts. Passing source diversity, freshness, a non-generic shared query anchor, a shared causal or verification mechanism, a shared ontology concept, and independently curated original work from every selected contributing company/source lane produces only `metadata-comparable`. Confirmed works concentrated in one company cannot satisfy another company's lane. The result is never evidence-ready until the material primary-source passages, context lanes, counter-evidence, and revision pins are reviewed. Generic migration language, Korean or English negation, one shared product name, stale/non-success/future-dated partitions, translations, reposts, same-company subpartitions, and uncurated work identity remain held or review-only. Exact title/summary matches derive one work family for deduplication but stay `review-required`; only an explicit official-URL-confined `workRelations` curation can mark a record `confirmed-original`, a translation, or a repost.

## Included official sources

Toss Tech, LY Corporation Tech Blog (Korean), NAVER D2, Kakao Tech, Kurly, SOCAR, Kakao Pay, Banksalad, and Woowahan Brothers. Velopers is recorded only as a product-discovery reference; its data is not ingested.

## Local use

Requirements: Node.js 20 or later. No Docker installation, package installation, OpenAI API key, or Codex Security approval is required.

```powershell
npm run refresh -- --mode latest
npm run query -- --query "기술 부채 관측성" --fusion
npm run verify
```

`npm run refresh -- --mode backfill` follows configured official feeds, sitemaps, and listing pages. It evaluates robots rules, permits only HTTPS requests to each source's exact host allowlist, serializes requests per host, isolates source failures, atomically replaces data files, stores only metadata/excerpts, and rebuilds the local lexical index. Use `--dry-run` to inspect deltas without acquiring a persistent mutation lease, creating a mutation receipt, or writing catalog data.

The local stdio MCP server exposes 13 tools: nine public-safe reads plus catalog refresh, Dictionary recording, local InsightRun history, and InsightRun recording. `prepare_application_plan` compares a reviewed Dictionary revision against the caller's real scale, workload, stack, SLO, team, and regulatory context. Every tool has a title, bounded input schema, concrete structured output schema, and behavior annotations. Publisher excerpts are marked as untrusted third-party data and cannot authorize commands or writes.

Managed Codex installs write mutable state outside the plugin cache:

- Windows: `%LOCALAPPDATA%\KTechRadar\data`
- macOS: `~/Library/Application Support/KTechRadar/data`
- Linux: `$XDG_DATA_HOME/k-tech-radar` or `~/.local/share/k-tech-radar`

Set `K_TECH_RADAR_DATA_DIR` for an explicit data directory. Refreshes commit one integrity-addressed `snapshot.json`; compatibility files are secondary views. The snapshot identity binds configuration, taxonomy, publisher partitions, every persisted source-state field, collection outcome, commit metadata, and the exact derived catalog/index. Validation also deterministically rebuilds the lexical index from the catalog and rejects a re-signed but semantically forged posting list. Closed schemas distinguish a missing field from an explicit `null`. Dictionary and InsightRun writes use idempotency receipts, immutable revisions, optimistic revisions, globally contiguous commit ledgers, and cross-process leases acquired in the fixed `catalog -> Dictionary -> InsightRun` order.

Every local negative-review round carries one to five inline content-addressed artifacts. The runtime computes the canonical envelope SHA-256 and byte count itself and binds each artifact to the normalized subject plus its round; callers provide only `kind` and actual `content`. Review timestamps, when present, must be canonical UTC ISO-8601 instants with milliseconds; arbitrary strings are rejected at input, storage, export, and public-read boundaries. Accepted InsightRuns additionally pin the exact verified Dictionary revision, the observed Dictionary ledger revision, and their own committed ledger revision. Verification replays the entire Dictionary supersedes chain, both commit ledgers, and the exact historical target of each stored InsightRun receipt rather than trusting self-declared hashes. Public artifacts and round summaries contain only content-withheld or separately sanitized hash receipts, never raw local review text. Public article-revision projections retain only integrity and lifecycle hashes in a separately closed output shape; both local and public shapes are runtime-validated.

## Public read-only HTTP MCP

Run the session-aware Streamable HTTP endpoint locally against a public snapshot:

```powershell
$env:K_TECH_RADAR_DATA_DIR = "C:\approved\k-tech-radar-public-20260730"
$env:HOST = "127.0.0.1"
$env:PORT = "43783"
npm run start:http
```

Endpoints:

- `POST /mcp` — JSON-RPC MCP, read-only tool set
- `GET /health` — health check

The HTTP transport exposes only nine read tools. It never exposes `refresh_catalog`, `record_dictionary_entry`, `list_insight_runs`, or `record_insight_run`, including direct calls by name. It isolates MCP sessions, enforces request and header limits, timeouts, concurrency, per-address rate limits, optional Origin allowlists, and optional SHA-256 bearer-token verification. A non-loopback listener fails closed unless authentication is configured or the operator deliberately enables an unauthenticated public-data deployment behind external controls.

Production deployments must terminate HTTPS at a managed load balancer or reverse proxy and mount a durable read-only public snapshot. Docker is one optional packaging route; Node.js on a VM, managed process, or serverless container is equally valid.

## Public data plane

The release bundle intentionally starts empty. A trusted local/admin process performs collection and then exports a new, immutable public data directory:

```powershell
$adminData = Join-Path $env:LOCALAPPDATA "KTechRadar\data"
$env:K_TECH_RADAR_DATA_DIR = $adminData
npm run refresh -- --mode latest
npm run export:public-snapshot -- `
  $adminData `
  "C:\approved\k-tech-radar-public-20260730"
```

The default export retains official title, URL, dates, tags, ontology links, hashes, partition identity, public-safe article revision lineage, and only current/verified/explicitly-public Dictionary entries. It removes publisher excerpts, local-only Dictionary entries, Dictionary revision history, idempotency records, detailed errors, all InsightRun receipts, and raw Dictionary review content or round summaries; retained review references are content-withheld hash receipts. The public snapshot validator binds every article's storage policy and summary bytes to the collection-wide `metadata-only` or `bounded-rights-confirmed` policy, so a re-signed snapshot cannot claim metadata-only while carrying excerpts. Exporting bounded publisher excerpts requires both `K_TECH_RADAR_PUBLIC_INCLUDE_EXCERPTS=1` and `K_TECH_RADAR_PUBLIC_RIGHTS_CONFIRMED=1`. Each export refuses to overwrite an existing directory, so operators can validate a versioned snapshot and atomically switch the mounted path.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATA-GOVERNANCE.md](docs/DATA-GOVERNANCE.md), and [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md).

## Codex plugin packaging

This directory is the plugin root. Its `.codex-plugin/plugin.json` declares three skills and the local stdio MCP server. Build the sanitized Git/repository marketplace:

```powershell
npm run build:public
```

The build creates `k-tech-radar-marketplace-0.3.0` beside this directory with `.agents/plugins/marketplace.json`, `plugins/k-tech-radar`, executable tests, a CycloneDX SBOM, and SHA-256 release manifest. It requires the exact checked-in `config/public-release-files.json` inventory and a closed, current `QUALITY-GATE.json` containing only public-sanitized, content-addressed review reports. It rejects missing/extra files and symbolic links, scans for obvious secrets, freezes the approved source bytes before copying, seeds zero public data, rechecks the copied destination against its quality gate, validates the result, and refuses to overwrite an existing destination.

For a hand-built marketplace, place the sanitized plugin at `plugins/k-tech-radar` and add:

```json
{
  "name": "k-tech-radar",
  "source": {
    "source": "local",
    "path": "./plugins/k-tech-radar"
  },
  "policy": {
    "installation": "AVAILABLE",
    "authentication": "ON_INSTALL"
  },
  "category": "Developer Tools"
}
```

Then install it with the marketplace name configured for that root:

```powershell
codex plugin marketplace add C:\path\to\marketplace-root
```

Install it from the desktop Plugins Directory or the Codex CLI `/plugins` browser, then start a new task so the plugin runtime is reloaded.

Personal, repository, Git marketplace, and universal public directory paths have different requirements. See [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md) and [submission/publication-checklist.md](submission/publication-checklist.md).

## Data integrity rules

- Never remove `sourceId`, `companyId`, `canonicalUrl`, or `contentHash`.
- Never present a cross-company synthesis unless every selected contributing company/source lane supplies its own curated, independently owned `confirmed-original` canonical work.
- Require a non-generic query anchor and a concrete shared causal or verification mechanism across two source partitions; broad ontology overlap, generic migration terms, or one product token alone triggers comparability review.
- Require every listed source and article to contribute an evidence claim; reviewed syntheses also require per-source context and counter-evidence.
- Keep observed author claims separate from Codex inference.
- Record context mismatches, trade-offs, counter-evidence, success metrics, and rollback conditions.
- Treat `verified` as a trusted local-admin evidence state, not confidence generated from repetition. It requires `K_TECH_RADAR_ALLOW_VERIFIED_WRITES=1`; public visibility additionally requires `K_TECH_RADAR_ALLOW_PUBLICATION=1`, current evidence pins, three subject/round-bound content-addressed review artifacts, and an exact three-round negative review ending at score 9.9 or higher with P0=0 and P1=0.
- Record accepted, held, and no-change research outcomes as append-only InsightRun receipts. Do not force a weak cross-company synthesis merely to create a Dictionary entry.
- Cap persisted publisher excerpts at 600 characters. On-demand evidence returns no more than 4,000 characters or 60% of readable text, whichever is smaller, and is never persisted.

The MIT license covers plugin code, not third-party article metadata or excerpts. Never publish the private/local snapshot without confirming redistribution rights. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [docs/PRIVACY.md](docs/PRIVACY.md), and [SECURITY.md](SECURITY.md).

## Public candidate 0.4.0: first use and data paths

`node scripts/offline-demo.mjs` prints a clearly fictional example without network or data writes. Real catalogs remain empty until you explicitly refresh. `node scripts/watch-topic.mjs save "canvas"` stores an immutable watch baseline in user data; `brief "canvas"` compares the current validated snapshot with it. No subscription or scheduled task is created.

All installations now default to the OS user-data directory, including development checkouts and custom CODEX_HOME. Explicit `K_TECH_RADAR_DATA_DIR` wins; bundled development writes require `K_TECH_RADAR_USE_BUNDLED_DATA=1`. Existing data is never moved automatically. Choose an old data directory explicitly after checking it.

`npm test` creates a retained, isolated public fixture root. Historical submission/evaluation files describe 0.3.0; they are not a new certification. Maintained Node 22/24 is recommended. See the repository root's doctor, verification report, and releasing guide.
