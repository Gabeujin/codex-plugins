# Reproducible local release

The repository is the source of truth. A marketplace bundle version, each plugin version, and data schema versions are separate identities. Never reuse an existing plugin version for different bytes or move a published tag. New features require a plugin minor version; compatible fixes use a patch. Data schema changes require an explicit migration and rollback decision.

## Mandatory readiness before a public PR

Privacy review must finish before the first public branch push or upload. Review the entire candidate
file/package inventory, hidden files, media content and metadata, and every new commit snapshot,
filename, message and author identity in `base..head`. A private file added then removed is still
public in that history. Independently read the actual changes for company work/domains, private work
context, accumulated personal memory, personal data and credentials. Never import a private original
and treat renamed identifiers as public provenance. Review PR/release text and attachments separately.

Freeze required checks and justified applicability exclusions before running them. Missing capability,
time or evidence cannot turn a required check into N/A. Any failed, pending, unrun or stale required
check means HOLD: do not create the PR. Keep raw logs, captures, configuration and personal-data
compatibility receipts outside the repository. Public summaries must omit sensitive values, private
paths and suspect private filenames. Record exact commit identity, commands, environment, results,
independent findings, covered scope and limitations in a private readiness record. A checklist, hash
or scanner is not a certificate of semantic privacy, rights or all possible runtime behavior.

1. Review the staged diff, source inventory/provenance, media and source scan. Run `node scripts/verify-release.mjs --report NEW_REPORT.json` with the report outside the repository. Its `passed` result leaves Canvas demo/build/browser work as `separate-command`; execute the required separate commands from [browser testing](BROWSER-TESTING.md) and CONTRIBUTING.md. A listed unexecuted required gate is a HOLD, not readiness.
2. Commit the reviewed tree locally. Build with `python -X utf8 -B scripts/package-release.py --commit COMMIT --output NEW_BUNDLE.zip`. The script reads only Git objects, includes a schema-versioned file/hash manifest, validates every ZIP member, and never uploads.
3. Run the same command from two fresh clones using the same Python/zlib runtime and commit. Compare SHA-256. ZIP timestamps and permissions are fixed; source order is canonical. Compression-runtime changes may change ZIP bytes, so retain runtime versions in external receipts.
4. Install the exact local marketplace in a fresh isolated CODEX_HOME, never the user's normal cache. Compare each installed plugin with `python scripts/verify-installed.py release-manifest.json PLUGIN INSTALLED_ROOT`. Reject any mismatch or unexpected file.
5. Rehearse update and compatible rollback against synthetic data. Compare release-manifest dataSchemas first. If unequal or unknown, stop: code rollback alone is not a data rollback. Preserve the store and prepare an explicit schema-compatible restore or migration.
6. Finish independent review and all local readiness checks, then push only the privacy-cleared branch. Wait for the exact candidate's **push CI** to complete all required OS/Node and browser/build jobs before opening the public PR. The workflow already runs on push; PR creation is not needed to obtain this evidence. Only then create the PR with the reviewed safe summary and completed results. PR CI is additional evidence and must pass before merge. Publish a new immutable tag/release only after the maintainer's authorized merge/release decision. These scripts never publish automatically.

Any source, input, inventory, dependency, test criterion, package or candidate change invalidates its
related PASS and downstream evidence. Retain failures and supersede them with new proof; do not reuse
an older receipt, weaken criteria, open a draft PR as a bypass, or describe later checks as completed
before the PR. Current personal stores are checked read-only and never bundled; nonempty update and
rollback behavior belongs in separate synthetic fixtures. Equal schema labels alone do not establish
compatibility. When local cross-platform execution is unavailable, the exact branch's push matrix can
provide that evidence before PR creation; do not claim an OS, physical device or assistive technology
that was not actually exercised.

The manifest does not assert tests passed: link exact-commit test receipts separately. Node/OS CI and human usability results must exist before claiming them. GitHub's private security channel is enabled; main requires a PR and the existing Ubuntu Node22 and Canvas CI check names. Admin bypass is limited to PR flow. Release tags cannot be updated/deleted under the active rule.

Optional manifest migration remains gated: current `.codex-plugin/plugin.json` is the single source, supported by the [official package documentation](https://developers.openai.com/plugins/build/plugins). Do not add a second hand-maintained manifest. A future migration must generate both from one source and prove old/new client discovery parity first.

Remote hosting remains conditional: GitHub installation works with local stdio. No production URL, operator, authentication, tenant isolation, or budget is established here. Keep KGJ private data local. Radar's optional read-only HTTP implementation is a candidate only after those operating decisions and tests. GitHub Pages does not host an MCP process.
