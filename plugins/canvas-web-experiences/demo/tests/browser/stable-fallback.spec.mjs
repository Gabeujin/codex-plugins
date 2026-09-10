import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

if (!process.env.CANVAS_PLAYWRIGHT_TEST_MODULE) throw new Error('Set CANVAS_PLAYWRIGHT_TEST_MODULE to the isolated @playwright/test module.');
const { test, expect } = await import(pathToFileURL(process.env.CANVAS_PLAYWRIGHT_TEST_MODULE).href);

const repoRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const starterGenerator = join(repoRoot, 'scripts', 'create_canvas_starter.py');
const starterRunRoot = process.env.CANVAS_STARTER_OUTPUT_ROOT ?? join(process.env.TEMP ?? process.env.TMP ?? '.', `canvas-starters-${Date.now()}`);
const mime = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

function starterServer(root) {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    let file = normalize(join(root, pathname === '/' ? 'index.html' : pathname));
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!file.startsWith(root) || !existsSync(file)) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolveServer) => server.listen(0, '127.0.0.1', () => resolveServer(server)));
}

test.describe('stable fallback across representative domains', () => {
  test('keeps Commerce, Maps, and Diagram task surfaces available without native proof', async ({ page }) => {
    for (const domain of ['commerce', 'map', 'diagram']) {
      await page.goto(`/#/${domain}`);
      await expect(page.locator('.app-shell')).toHaveAttribute('data-surface-mode', 'dom-overlay');
      await expect(page.locator('.experience-path-status')).toContainText('안정 경로');
    }

    await page.goto('/#/commerce');
    const material = page.getByLabel('표면 재질');
    await material.selectOption('Frosted');
    await expect(material).toHaveValue('Frosted');
    await page.getByRole('button', { name: '장면 도구' }).click();
    await page.getByText('개발자 설정 · 렌더 경로').click();
    await page.getByLabel('Canvas 사용 경로').selectOption('experiment');
    await expect(page.locator('.experience-path-status')).toContainText('대체 경로로 조작할 수 있습니다');
    await page.getByLabel('Canvas 사용 경로').selectOption('stable');
    await expect(material).toHaveValue('Frosted');

    await page.goto('/#/map');
    await page.getByLabel('장소 검색').fill('합정');
    await expect(page.getByLabel('장소 검색')).toHaveValue('합정');
    await page.goto('/#/diagram');
    await page.getByLabel('서비스 이름').fill('Fallback node');
    await expect(page.getByLabel('서비스 이름')).toHaveValue('Fallback node');
  });

  test('keeps the stable task keyboard reachable at a narrow reduced-motion viewport', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/commerce');
    await expect(page.getByRole('heading', { name: '3D 장면을 조작하고 안전한 대체 경로를 확인하세요' })).toBeVisible();
    await page.getByRole('button', { name: '안정 과업 시작' }).click();
    const scene = page.getByRole('region', { name: /빛과 재질을 직접 설계하세요/ }).first();
    await scene.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.experience-path-status')).toContainText('안정 경로');
    await expect(page.locator('.app-shell')).toHaveAttribute('data-surface-mode', 'dom-overlay');
  });
});

test.describe('generated starters', () => {
  let server;
  let baseURL;

  test.beforeAll(async ({}, testInfo) => {
    const projectRoot = join(starterRunRoot, `${testInfo.project.name}-${Date.now()}`);
    mkdirSync(projectRoot, { recursive: true });
    for (const kind of ['2d', '3d', 'map-diagram']) {
      execFileSync('python', [starterGenerator, '--kind', kind, '--output', join(projectRoot, kind)], { encoding: 'utf8' });
    }
    server = await starterServer(projectRoot);
    const address = server.address();
    baseURL = `http://127.0.0.1:${address.port}`;
  });

  test.afterAll(async () => {
    if (server) await new Promise((done) => server.close(done));
  });

  for (const kind of ['2d', '3d', 'map-diagram']) {
    test(`${kind} starter changes its representative task from button and keyboard input`, async ({ page }) => {
      await page.goto(`${baseURL}/${kind}/`);
      await expect(page.locator('#scene')).toBeVisible();
      await expect(page.locator('#fallback')).toBeHidden();
      const before = await page.locator('#status').textContent();
      await page.getByRole('button', { name: 'Advance task' }).click();
      await expect(page.locator('#status')).not.toHaveText(before ?? '');
      await page.locator('#scene').focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#status')).toContainText('2');
    });
  }

  test('the 3d starter paints a WebGL cube rather than a labelled 2D placeholder', async ({ page }) => {
    await page.goto(`${baseURL}/3d/`);
    await expect(page.locator('#scene')).toHaveAttribute('data-renderer', 'webgl');
    const before = await page.locator('#scene').getAttribute('data-rotation');
    await page.getByRole('button', { name: 'Advance task' }).click();
    const after = await page.locator('#scene').getAttribute('data-rotation');
    expect(after).not.toEqual(before);
  });

  test('a missing canvas context exposes the semantic fallback and retains its task action', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
    await page.goto(`${baseURL}/3d/`);
    await expect(page.locator('#scene')).toBeHidden();
    await expect(page.locator('#fallback')).toBeVisible();
    await page.getByRole('button', { name: 'Advance task without Canvas' }).click();
    await expect(page.locator('#status')).toHaveText('rotation: 1');
    await context.close();
  });
});
