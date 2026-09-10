# Canvas Futures Lab

This optional Vite application demonstrates Canvas 2D, WebGL, WebGPU, Worker, and DOM-fallback architecture patterns across several interactive domains. It is source code, not a current browser-compatibility or release-validation claim.

Use the demo as an architecture sample. Keep task controls and semantic alternatives in DOM, feature-detect experimental browser APIs, and preserve a fallback path.

## Local development

Use Node.js 20.19+ or 22.12+ and npm. Node 22 and Node 24 have passed local Windows demo tests and builds. The Chromium, Firefox, and WebKit browser matrix has passed locally; consult the release-linked GitHub Actions run for the exact remote CI result and the browser guide for explicit capability skips. Node 20 compatibility is retained by the Vite dependency range, but Node 20 is not the recommended new-install runtime. From this directory:

```text
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run build
npm run dev
```

Open the loopback URL printed by Vite. The configured development port is 43120; if it is already in use, select another port with `npm run dev -- --port 43121`. Stop the foreground server with Ctrl+C when finished. This starts a development server only; it does not register automatic startup or hosting.

`npm run build` retains earlier ignored `dist/` artifacts (`emptyOutDir: false`) so local verification does not delete an existing build. Package creation still excludes `dist/`.

Use a target browser to validate actual interactions, accessibility, responsive behavior, and experimental API availability for any changed experience. The demo does not start automatically.

## First task: stable path

The default experience path is a task-ready DOM fallback. It deliberately does not claim native HTML-in-Canvas execution.

1. Run the development server and open `#/commerce`.
2. Keep **안정 과업 · DOM fallback** selected in **개발자 설정 · 렌더 경로**.
3. Drag the product, choose **정면**, then change a material in the configuration form. The form state is the completion signal.
4. Open **실행 증거**. Its result should say that the DOM fallback is usable; it must not be interpreted as native success.
5. Switch to **실험 경로 · native trial** only to evaluate the controlled experimental lane. If the browser cannot prove that lane, the same task remains available through the fallback.

The guided first task is optional and can be dismissed without changing keyboard navigation. Automated WebKit coverage, when run, is browser-engine coverage and is not a claim of real-device Safari testing. A native claim additionally needs the named browser/channel, API condition, and observed paint/upload evidence.
