# CLI update policy — command only

This skill uses notification and command guidance only for CLI version lag. Never execute a CLI updater or stop/restart the Desktop application as part of this skill, including its recovery phase.

Official source checked 2026-09-16: [Codex CLI installation and updating](https://developers.openai.com/codex/cli/). The npm method uses `npm install -g @openai/codex` for updates; this plugin may state `@latest` explicitly when comparing the stable npm latest tag. Different installation methods have different commands. Do not propose npm for a native installer/Homebrew installation without checking the actual source.

`probe.py --check-latest` only reads the official npm package registry metadata at `https://registry.npmjs.org/@openai/codex/latest`. It must not run npm install/update. Compare the successfully read stable version with a successfully measured standalone CLI version. A failed lookup is UNKNOWN. A local version newer than the registry is not 'outdated'. A prerelease needs an explicit channel decision.

When the measured standalone npm CLI is older, show the installed version, fetched latest version, and update command. Also provide `codex --version` to run in a fresh terminal after the user's update. Avoid claiming that package installation success alone proves an existing long-running process uses the new executable.

Desktop app, Desktop-bundled CLI and standalone npm CLI remain separate identities. The cited install page does not establish a universal rule that restarting Desktop updates its bundled CLI after an npm update. Let the user decide when to close and reopen Desktop, then remeasure the effective paths and versions. Never terminate the native app or its active tasks automatically.
