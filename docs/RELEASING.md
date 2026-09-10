# Reproducible local release

The repository is the source of truth. A marketplace bundle version, each plugin version, and data schema versions are separate identities. Never reuse an existing plugin version for different bytes or move a published tag. New features require a plugin minor version; compatible fixes use a patch. Data schema changes require an explicit migration and rollback decision.

1. Review the staged diff and source scan. Run `node scripts/verify-release.mjs --report NEW_REPORT.json` outside the repository, plus Canvas demo/browser commands. Record unexecuted gates.
2. Commit the reviewed tree locally. Build with `python -X utf8 -B scripts/package-release.py --commit COMMIT --output NEW_BUNDLE.zip`. The script reads only Git objects, includes a schema-versioned file/hash manifest, validates every ZIP member, and never uploads.
3. Run the same command from two fresh clones using the same Python/zlib runtime and commit. Compare SHA-256. ZIP timestamps and permissions are fixed; source order is canonical. Compression-runtime changes may change ZIP bytes, so retain runtime versions in external receipts.
4. Install the exact local marketplace in a fresh isolated CODEX_HOME, never the user's normal cache. Compare each installed plugin with `python scripts/verify-installed.py release-manifest.json PLUGIN INSTALLED_ROOT`. Reject any mismatch or unexpected file.
5. Rehearse update and compatible rollback against synthetic data. Compare release-manifest dataSchemas first. If unequal or unknown, stop: code rollback alone is not a data rollback. Preserve the store and prepare an explicit schema-compatible restore or migration.
6. A maintainer reviews the issue → PR → CI evidence and decides publication. Only then push the reviewed branch, obtain remote CI, and create a new immutable tag/release. These scripts never do that automatically.

The manifest does not assert tests passed: link exact-commit test receipts separately. Node/OS CI and human usability results must exist before claiming them. GitHub's private security channel is enabled; main requires a PR and the existing Ubuntu Node22 and Canvas CI check names. Admin bypass is limited to PR flow. Release tags cannot be updated/deleted under the active rule.

Optional manifest migration remains gated: current `.codex-plugin/plugin.json` is the single source, supported by the [official package documentation](https://developers.openai.com/plugins/build/plugins). Do not add a second hand-maintained manifest. A future migration must generate both from one source and prove old/new client discovery parity first.

Remote hosting remains conditional: GitHub installation works with local stdio. No production URL, operator, authentication, tenant isolation, or budget is established here. Keep KGJ private data local. Radar's optional read-only HTTP implementation is a candidate only after those operating decisions and tests. GitHub Pages does not host an MCP process.
