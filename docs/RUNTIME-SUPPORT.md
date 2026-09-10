# Runtime support

| Component | Policy | Evidence boundary |
|---|---|---|
| Node 22 and 24 | Maintained major versions; use latest security patch | Local Windows results are recorded per release; CI covers Linux, Windows, macOS after the commit is pushed |
| Node 20 | Existing MCP engines compatibility retained; upstream EOL | No new support promise; upgrade before reporting runtime issues |
| Python | 3.12+ for KGJ governance, Canvas generator, packaging | CI uses 3.12; local interpreter version is in the execution receipt |
| Canvas demo | Vite engine requirements in demo/package.json | Node 22.12+ or compatible newer maintained release; install optional locked dependencies |
| Codex CLI | Plugin-capable CLI; minimum version not established | Record `codex --version`, marketplace install and exact cache readback |
| Codex Desktop | Plugin-capable Desktop; minimum version not established | CLI installation does not prove a Desktop conversation or native browser API |

[Node release policy](https://nodejs.org/en/about/previous-releases) was checked on 2026-09-10. Node 24 is the preferred maintained LTS for new installations after local tests. Never infer that every patch, OS, Desktop build, or browser has been tested.

Set `K_TECH_RADAR_DATA_DIR` / `KGJ_DESIGN_DATA_DIR` explicitly for isolated tests. Radar now defaults to OS user data for all install paths, including custom CODEX_HOME and development checkouts. `K_TECH_RADAR_USE_BUNDLED_DATA=1` is an explicit development opt-in. The explicit data directory takes precedence. This changes the development default; no old data is moved or deleted.
