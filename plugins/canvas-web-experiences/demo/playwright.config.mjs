import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const demoRoot = path.dirname(fileURLToPath(import.meta.url));
const runId = process.env.CANVAS_BROWSER_RUN_ID ?? `canvas-${Date.now()}`;

export default {
  testDir: './tests/browser',
  fullyParallel: false,
  timeout: 45_000,
  outputDir: process.env.CANVAS_PLAYWRIGHT_OUTPUT_DIR ?? path.join(os.tmpdir(), 'canvas-playwright', runId),
  reporter: [['list'], ['json', { outputFile: path.join(process.env.CANVAS_PLAYWRIGHT_OUTPUT_DIR ?? path.join(os.tmpdir(), 'canvas-playwright', runId), 'results.json') }]],
  use: {
    baseURL: process.env.CANVAS_DEMO_URL ?? 'http://127.0.0.1:43122',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', viewport: { width: 1280, height: 720 } } },
    { name: 'firefox', use: { browserName: 'firefox', viewport: { width: 1280, height: 720 } } },
    { name: 'webkit', use: { browserName: 'webkit', viewport: { width: 1280, height: 720 } } },
  ],
  webServer: process.env.CANVAS_DEMO_URL ? undefined : {
    command: 'node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 43122',
    cwd: demoRoot,
    url: 'http://127.0.0.1:43122',
    reuseExistingServer: false,
    timeout: 120_000,
  },
};
