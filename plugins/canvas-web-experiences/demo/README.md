# Canvas Futures Lab

This optional Vite application demonstrates Canvas 2D, WebGL, WebGPU, Worker, and DOM-fallback architecture patterns across several interactive domains. It is source code, not a current browser-compatibility or release-validation claim.

Use the demo as an architecture sample. Keep task controls and semantic alternatives in DOM, feature-detect experimental browser APIs, and preserve a fallback path.

## Local development

Use Node.js 20.19+ or 22.12+ (Node 22.12+ recommended) and npm. From this directory:

```text
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run build
npm run dev
```

Open the loopback URL printed by Vite. The configured development port is 43120; if it is already in use, select another port with `npm run dev -- --port 43121`. Stop the foreground server with Ctrl+C when finished. This starts a development server only; it does not register automatic startup or hosting.

Use a target browser to validate actual interactions, accessibility, responsive behavior, and experimental API availability for any changed experience. The demo does not start automatically.
