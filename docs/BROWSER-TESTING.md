# Browser verification

Install optional tooling in a **new directory outside the repository**:

```text
npm install --prefix ../canvas-browser-tools --ignore-scripts --no-audit --no-fund --save-exact @playwright/test@1.58.2
node ../canvas-browser-tools/node_modules/playwright/cli.js install chromium firefox webkit
node scripts/test-canvas-browser.mjs ../canvas-browser-tools
```

Install the demo's locked dependencies first as described in CONTRIBUTING.md. Linux may require Playwright's documented OS dependencies (`install --with-deps`). The runner creates unique retained result/starter folders and starts a loopback-only Vite server; it refuses to reuse an existing server on the test port. Browser binaries, traces, videos, screenshots, and test receipts are not source assets.

If browser binaries were installed to a custom directory, set `PLAYWRIGHT_BROWSERS_PATH` to that same directory for both installation and the test runner. Otherwise Playwright uses its normal per-user browser cache.

The 21-case matrix checks three representative domains (Commerce, Map, Diagram), stable/experiment/stable state preservation, keyboard use at a narrow viewport with reduced motion, all three generated starter interactions, and forced WebGL fallback. It does not certify all twelve demo domains, native Safari devices, screen-reader behavior, or experimental HTML-in-Canvas paint/capture/upload. Those remain separately named manual or native-browser evidence.

## Headless Linux Firefox capability

Some Linux Firefox runners cannot create a WebGL context. The suite probes a separate canvas: only in that exact environment does the representative 3D task verify the visible semantic fallback and its keyboard action, while the dedicated WebGL rendering test reports an explicit skip. Other engines and context-capable Firefox still require WebGL. A context-capable browser whose starter fails rendering must fail. Do not count this skip as WebGL proof or describe the Linux result as 21 rendered-path passes.
