# Distribution guide

Version: 0.3.0  
Verified against the OpenAI plugin documentation on 2026-07-30.

Codex Security permission is not required to build, install, test, or share this plugin through a personal, repository, local-directory, ZIP, or Git marketplace. This release uses its own static/adversarial audit and runtime tests; it does not claim official Codex Security certification.

OpenAI documents local and repository marketplaces as authoring, testing, and private/team-distribution sources, while public plugins are published to one universal directory shared by ChatGPT and Codex:

- https://developers.openai.com/plugins/build/plugins
- https://developers.openai.com/plugins/deploy/connect-chatgpt
- https://developers.openai.com/plugins/deploy/submission
- https://developers.openai.com/plugins/build/mcp-server

## Choose a channel

| Channel | Audience | Hosting | External approval | Auto-update |
|---|---|---|---|---|
| Personal marketplace | One developer | Local stdio | None | Reinstall/refresh locally |
| Repository marketplace | One repository/team | Local stdio | Repository access only | Via repo updates |
| ZIP/local directory | Direct recipients | Local stdio | None | Manual |
| Git marketplace | Public or private Git users | Local stdio | Git repository access | `marketplace upgrade` |
| npm marketplace entry | Registry users | Local stdio | Not packaged in 0.3.0 | Semver/range refresh |
| Workspace sharing | Selected workspace members/groups | Desktop-managed | Workspace policy | Desktop-managed |
| Universal public directory | ChatGPT and Codex users | Public HTTPS MCP | Verified identity, Apps Management, domain/review | Directory release process |

The recommended first public channel for an individual is a sanitized Git marketplace. It is inspectable, versionable, does not require a hosted service, and does not require Codex Security permission.

## Build the sanitized marketplace

From the plugin root:

```powershell
npm run verify
npm run build:public
```

The build refuses to overwrite an existing destination and creates:

```text
k-tech-radar-marketplace-0.3.0/
  .agents/plugins/marketplace.json
  RELEASE-MANIFEST.json
  plugins/k-tech-radar/
    .codex-plugin/plugin.json
    .mcp.json
    QUALITY-GATE.json      # closed, hash-pinned public-sanitized audit projection; not official certification
    config/public-release-files.json
    skills/
    mcp/
    data/                 # public empty seed, zero private records
    tests/                # executable release verification
    sbom.cdx.json
```

Check `RELEASE-MANIFEST.json`, confirm `articleRecordsBundled: 0` in the build output, then publish that whole marketplace directory. Do not publish the private/local source snapshot.

The builder accepts no extension-wide wildcard. Every source file must appear exactly once in `config/public-release-files.json`, and the reviewed source hash in `QUALITY-GATE.json` must still match before anything is copied. It freezes all approved source bytes as one immutable in-memory snapshot, copies only that snapshot, and re-runs the quality gate against the destination after empty-data seeding and SBOM generation. A source mutation during the build is therefore either excluded from the artifact or caught as a stale destination hash.

The distributed quality gate contains only separately curated `public-sanitized-review-report` evidence. The validator rejects Windows, UNC, file-URI, and generic multi-segment POSIX absolute paths—not just a fixed directory list—plus credential-like values, control bytes, and unsafe free text in evidence commands/outputs, round summaries, and remaining external-gate notes. Public URLs and the route-only `/mcp` and `/health` values remain allowed. Raw local audit logs and internal finding text stay outside the public allowlist.

## Personal installation

The personal marketplace file is:

```text
~/.agents/plugins/marketplace.json
```

The official personal-marketplace convention is to store the plugin under `~/.codex/plugins/k-tech-radar`. A marketplace may also point to another plugin directory through a relative source path; those paths are resolved relative to the marketplace file. Keep host-specific absolute paths out of a distributed bundle.

Add the marketplace entry, then install or verify it in the desktop Plugins Directory. The current CLI is useful for marketplace registration and inspection; the desktop app is the documented install/test surface for a local plugin. Start a new task after install or update so its skills and MCP runtime are reloaded.

```powershell
codex plugin marketplace list
```

Restart the Codex/ChatGPT desktop app if the Plugins Directory does not refresh immediately.

## Repository marketplace

Copy the sanitized bundle contents into the repository:

```text
repo/
  .agents/plugins/marketplace.json
  plugins/k-tech-radar/
```

Team members open the repository in the desktop app and choose that repository marketplace. This is appropriate for an internal standard plugin pinned to the same codebase.

## Local directory or ZIP

Distribute the sanitized marketplace directory as a ZIP. A recipient extracts it and registers the extracted root:

```powershell
codex plugin marketplace add C:\path\to\k-tech-radar-marketplace-0.3.0
```

Then install it from the desktop Plugins Directory or the Codex CLI `/plugins` browser and start a new task. ZIP is easy to transfer but has no automatic update channel. Include the release manifest and checksum beside it.

## Git marketplace

Publish the sanitized marketplace root to a public or private Git repository, tag the release, and have users run:

```powershell
codex plugin marketplace add owner/repo --ref v0.3.0
```

Other supported forms include:

```powershell
codex plugin marketplace add https://github.com/owner/repo.git --sparse .agents/plugins
codex plugin marketplace list
codex plugin marketplace upgrade k-tech-radar
```

Use immutable tags for reproducible installs. Publish `CHANGELOG.md`, `RELEASE-MANIFEST.json`, the SBOM, and the sanitized ZIP/TAR asset on each Git release.

After adding the marketplace, install it from the desktop Plugins Directory or the Codex CLI `/plugins` browser.

## Future npm marketplace entry

Current Codex marketplace metadata can point to an npm package without running lifecycle scripts. Version 0.3.0 does not publish an npm artifact: its package manifest is intentionally `private`, and a registry scope/name and owner identity have not been selected. Therefore npm is a reviewed future channel, not a release-ready claim.

To add it later, create a separate sanitized registry package with a non-private manifest, verify `npm pack --dry-run`, publish under the owner's scope, and use an entry such as:

```json
{
  "name": "k-tech-radar",
  "source": {
    "source": "npm",
    "package": "@your-scope/k-tech-radar",
    "version": "^0.3.0",
    "registry": "https://registry.npmjs.org"
  },
  "policy": {
    "installation": "AVAILABLE",
    "authentication": "ON_INSTALL"
  },
  "category": "Developer Tools"
}
```

The package registry URL must be HTTPS and contain no embedded credentials, query, or fragment. Registry authentication comes from npm configuration. An npm package is a distribution option, not a universal-directory approval.

## Workspace sharing

After installing the local plugin in the ChatGPT desktop app, its owner may share it with selected members or groups from **Plugins → Created by you → Share**, when workspace policy permits. This remains inside that workspace and does not publish the plugin publicly. Administrators can disable local plugin sharing.

## Public read-only MCP hosting

The universal directory requires a stable production HTTPS Streamable HTTP endpoint, normally ending in `/mcp`. Temporary tunnels and localhost are not public submission endpoints.

Docker is optional. For a Node-only deployment, run `node mcp/http-server.mjs` under a managed process on Node.js 20 or later, set `K_TECH_RADAR_DATA_DIR` to a read-only exported public snapshot, and terminate HTTPS at the hosting platform.

Before either deployment style, collect only in a trusted local/admin process and export a new versioned public data directory:

```powershell
$adminData = Join-Path $env:LOCALAPPDATA "KTechRadar\data"
$env:K_TECH_RADAR_DATA_DIR = $adminData
npm run refresh -- --mode latest
npm run export:public-snapshot -- `
  $adminData `
  "C:\approved\k-tech-radar-public-20260730"
```

The default is metadata-only. To include bounded publisher excerpts, the release owner must first establish the relevant rights and then set both flags for the export process:

```powershell
$env:K_TECH_RADAR_PUBLIC_INCLUDE_EXCERPTS = "1"
$env:K_TECH_RADAR_PUBLIC_RIGHTS_CONFIRMED = "1"
npm run export:public-snapshot -- C:\local-admin-data C:\approved\public-v2
```

Every export validates the source snapshot, keeps publisher partitions, deterministically rebuilds the index, converts visibility to `public`, retains only current/verified/explicitly-public Dictionary entries, replaces their raw review artifacts and round summaries with content-withheld hash receipts, requires canonical UTC review timestamps, emits closed public article-revision projections, removes local Dictionary revision/idempotency history, and exports zero InsightRun receipts. The read gate also enforces that each article's storage policy and summary match the collection-wide `metadata-only` or `bounded-rights-confirmed` policy. It refuses to overwrite an existing directory.

For an optional container build:

```powershell
docker build -f deployment/Dockerfile -t k-tech-radar:0.3.0 .

$token = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
$tokenHash = [Convert]::ToHexString(
  [Security.Cryptography.SHA256]::HashData(
    [Text.Encoding]::UTF8.GetBytes($token)
  )
).ToLowerInvariant()

docker run --read-only --cap-drop=ALL -p 8080:8080 `
  -e HOST=0.0.0.0 -e PORT=8080 `
  -e K_TECH_RADAR_BEARER_TOKEN_SHA256=$tokenHash `
  -v C:\approved\k-tech-radar-public-20260730:/data:ro `
  k-tech-radar:0.3.0
```

Keep `$token` in the deployment's secret manager and configure the MCP client with that bearer token; never store the plaintext token or its hash in the plugin or LocalDock. For an intentionally unauthenticated service containing only approved public data, set `K_TECH_RADAR_ALLOW_UNAUTHENTICATED_PUBLIC=1` and enforce rate limits, abuse controls, and client authentication at the edge. Do not use that override for private or user-specific data.

Put a managed HTTPS load balancer or reverse proxy in front of port 8080. Restrict egress at the VPC/container layer, set platform request and rate limits, keep logs free of queries where possible, and alert on failed initialization/tool calls.

The HTTP server always constructs a public read-only runtime. It exposes nine read tools and never exposes refresh, Dictionary writes, or local InsightRun history/writes. Populate `/data` only with a validated public export through a separate local/admin ingestion job. Do not run collection in the public request path.

Container, serverless-container, traditional VM, and managed application platforms can all work if they preserve Streamable HTTP behavior, stable URLs, low enough latency, HTTPS, rollback, logs/metrics, and the required data residency.

## Universal public directory

The code is technically prepared for a public read-only MCP endpoint, but submission must remain blocked until every external item below is real:

1. Secure publisher permission or a documented legal basis for every hosted article field. The safest default is title/canonical URL-only or no centrally hosted article data.
2. Deploy the production HTTPS `/mcp` endpoint and verify health, latency, logs, rollback, and egress controls.
3. Publish real website, support, privacy, and terms HTTPS URLs that match the operator and data handling.
4. Complete individual or business identity verification in the OpenAI Platform.
5. Submit from the same organization/project with Apps Management write access.
6. Host the domain-verification challenge at `/.well-known/openai-apps-challenge`.
7. Scan tools in the submission portal and confirm every discovered schema and annotation.
8. Run the five positive and four negative cases in `submission/evals.json` against the deployed endpoint and supported ChatGPT/Codex surfaces.
9. Add final release notes, regions, support owner, and reviewer-ready materials.

Apps Management and identity/domain verification are universal-directory publication requirements; they are separate from Codex Security permission. If you cannot obtain them, publish through Git/repository/personal marketplace channels instead.

Submitting does not publish immediately: OpenAI reviews the version, and the developer chooses when to publish after approval. Changes to published MCP tool metadata require a new scan, reviewed version, and publication step.

## Update, rollback, and compatibility

- Use semantic versions and immutable Git tags.
- Do not rename tools or remove fields in a patch release.
- Add optional result fields before making them required.
- Keep one prior tagged release available for rollback.
- A public MCP metadata change must be rescanned and submitted as a new reviewed version.
- For local updates, preserve the user data directory; it is intentionally outside the plugin cache.
- For Git marketplaces, publish the new tag and have users run `codex plugin marketplace upgrade`.

## Individual maintainer checklist

- Publish only the sanitized marketplace bundle.
- Replace all repository/support placeholders.
- Enable branch protection and the included OS/Node CI matrix.
- Create a private vulnerability-reporting path.
- Attach release manifest, SBOM, checksums, and changelog.
- State clearly whether the release is local/Git marketplace-ready or universal-directory approved.
- Never describe the local audit as an OpenAI or Codex Security certification.
