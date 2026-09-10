# Validation scope

Run `node scripts/verify-release.mjs` from a public checkout. It reports each plugin/group separately: Radar public synthetic core/mutation/protocol, KGJ Node and Python governance, Canvas public package, and common safety/evidence contracts. It isolates data roots and does not require personal history. Synthetic tests are not research evidence.

Canvas optional demo dependencies are installed separately in `plugins/canvas-web-experiences/demo` using `npm ci --ignore-scripts --no-audit --no-fund`; run `npm test` and `npm run build`. Browser runs and the human/model scenario kit under docs/evaluations are separate evidence. A fixture string assertion is not a model evaluation, and WebKit is not a real Safari device.

`node scripts/verify-public-source.mjs` checks Git-tracked working bytes, so ignored installed dependencies do not cause failure. Stage new source intentionally before using it as a release gate. `--directory DIRECTORY` scans every file of a final extracted bundle, including generated/private files that should not be present. `python scripts/package-release.py --check BUNDLE.zip` verifies the closed ZIP manifest, paths, member hashes, and complete-directory scan. Never weaken archive scanning by skipping node_modules there.

These are bounded heuristics plus regression tests, not a complete security guarantee. Secret scanning/push protection is also enabled on GitHub; review history and data classification before public publication. Test and build receipts belong outside the source tree. Live collection, remote authentication, native experimental paint, and voluntary user testing remain explicit opt-in/manual gates.
