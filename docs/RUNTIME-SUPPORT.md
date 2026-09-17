# Runtime support

| Component | Policy | Evidence boundary |
|---|---|---|
| Node 22 and 24 | Maintained major versions; use latest security patch | Local Windows results are recorded per release; CI covers Linux, Windows, macOS after the commit is pushed |
| Node 20 | Existing MCP engines compatibility retained; upstream EOL | No new support promise; upgrade before reporting runtime issues |
| Python | 3.12+ for KGJ governance, Canvas generator, packaging | CI uses 3.12; local interpreter version is in the execution receipt |
| Canvas demo | Vite engine requirements in demo/package.json | Node 22.12+ or compatible newer maintained release; install optional locked dependencies |
| Daily Check | Python 3.12+; native notification uses Windows PowerShell/WinForms | Cross-platform offline logic CI is separate from real Windows/Chrome/IAB tests; no five-minute SLA or actual approval-flow certification |
| Codex CLI | Plugin-capable CLI; minimum version not established | Record `codex --version`, marketplace install and exact cache readback |
| Codex Desktop | Plugin-capable Desktop; minimum version not established | CLI installation does not prove a Desktop conversation or native browser API |

[Node release policy](https://nodejs.org/en/about/previous-releases) was checked on 2026-09-10. Node 24 is the preferred maintained LTS for new installations after local tests. Never infer that every patch, OS, Desktop build, or browser has been tested.

Set `K_TECH_RADAR_DATA_DIR` / `KGJ_DESIGN_DATA_DIR` explicitly for isolated tests. Radar now defaults to OS user data for all install paths, including custom CODEX_HOME and development checkouts. `K_TECH_RADAR_USE_BUNDLED_DATA=1` is an explicit development opt-in. The explicit data directory takes precedence. This changes the development default; no old data is moved or deleted.

## Daily Check environment adaptation

The diagnostic uses only routes actually exposed by its host. Desktop browser/native availability must be discovered separately from CLI/shell availability. The Windows form is Windows-only; do not launch it on macOS, Linux, WSL or cloud. Other platforms may use their exposed native provider with its own documented fixture. With no shell/Python, provide a text checklist and explicitly state that persistent helper receipts are unavailable. This is graceful diagnostic fallback, not proof that every host supports every feature.

PARTIAL describes incomplete coverage. Reports separately count observed FAIL, policy BLOCKED, unavailable session routes, and missing observation. The full READY gate is unchanged. A normal conversation reply does not prove an async question tool or an OS toast; a missing question tool in one session does not prove global notification failure.

Official setup and boundaries: [Computer Use](https://learn.chatgpt.com/docs/computer-use), [notifications](https://learn.chatgpt.com/docs/notifications). Notification controls differ between Desktop, web, CLI and IDE. These references are not local runtime test receipts.
