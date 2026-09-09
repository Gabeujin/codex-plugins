# Public release validation

The following checks passed locally on Windows with Node.js 22.18.0 for the public source assembled on 2026-09-09. CI runs the committed commands separately; see the corresponding Actions run for its result.

| Scope | Result |
|---|---|
| Radar core | 22 integrity checks and bundled secret scanner passed |
| Radar public transport/release suite | 24 tests passed |
| KGJ source validator | 11 skills and four DNA profiles passed |
| KGJ stdio contract | Four tests passed: initialization/version, 14-tool contract, annotations, protocol output |
| KGJ public runtime verifier | Static ontology read and unknown-tool rejection passed; no Dictionary write |
| Canvas public-source validator | Ten skills; zero errors and warnings |
| Canvas demo on freshly installed locked dependencies | 15 test files, 75 tests passed |
| Canvas production build | TypeScript and Vite build passed |
| New plugin manifests and skill frontmatter | Two manifests and 21 skills passed creator validation with UTF-8 mode |

Commands from the repository root:

```powershell
node scripts/verify-public-source.mjs
node scripts/verify-release.mjs
```

The source scanner expects a clean source tree, before restoring demo dependencies or generating build output. Run it in a clean checkout. Its checks are bounded heuristics, not a guarantee that every possible secret format is detected. The unchanged Radar parser fixture intentionally contains a replacement character as malformed input; its exact SHA-256 is allowlisted by the scanner.

From `plugins/kgj-design`:

```powershell
python -B scripts/kgj_design.py validate .
node scripts/verify-public-package.mjs
node --test tests/mcp.test.mjs
```

From `plugins/canvas-web-experiences`:

```powershell
python -B scripts/validate_canvas_plugin.py --public-source
```

From `plugins/canvas-web-experiences/demo` (Node 20.19+ or 22.12+):

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run build
```

## Coverage limits

- Radar's complete developer suite includes local/admin-history fixtures. Eleven tests were previously observed to fail against the deliberately empty public seed; the public workflow uses the verified subset above.
- KGJ's complete Python governance and Node Dictionary mutation suites were not rerun for this distribution. The listed source/read/negative/stdio checks are the executed scope.
- Canvas's separate Python receipt-validator suite passed five tests during staging. The 75 demo tests and production build were also rerun on the actual public source after a fresh dependency installation.
- Browser interaction, every experimental Canvas API, hosted MCP deployment, and Codex model-driven tool selection are separate checks. This release's automated checks do not claim them.
- Historical local release ledgers, recordings and installation receipts were omitted. The optional legacy Canvas evidence-validator branch still recognizes old receipt formats when separately supplied; it is not used by `--public-source` and is not a current result.

Install the plugin in a new Codex task and validate it against the user's target workflow. Keep secrets and private knowledge out of issue reports.
