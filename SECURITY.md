# Security

Report vulnerabilities privately through [GitHub private vulnerability reporting](https://github.com/Gabeujin/codex-plugins/security/advisories/new). This repository feature was enabled and read back on 2026-09-10. The repository owner handles reports; no response-time guarantee is implied.

Do not place API keys, private Dictionary entries, local paths, article bodies, or personal data in public issues. Share a minimal synthetic reproduction and the plugin/runtime versions. If a credential was exposed, revoke it through its issuer before sharing a redacted report.

The local MCP servers run with the permissions of the Codex process. Keep runtime data outside the repository and versioned plugin cache. The project does not operate a remote multi-user Dictionary service. Source and ZIP checks are bounded heuristics, not certification.

Use maintained Node 22/24 patch releases. Node 20 runtime compatibility is retained but is no longer maintained upstream. See docs/RUNTIME-SUPPORT.md.
