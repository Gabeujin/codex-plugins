import { describe, expect, it, vi } from 'vitest';
import { formatQuantity, parseFormattedQuantity } from './format';
import {
  alignmentToleranceForLane,
  callReceipt,
  classifyHtmlCanvasError,
  closeElementImageOnce,
  createAlignmentReceipt,
  createSurfaceDiagnostics,
  currentPaintReceipt,
  drawElementImage2D,
  HTML_CANVAS_SECURITY_POLICY,
  HTML_CANVAS_PROPOSAL_SNAPSHOT,
  installPaintLifecycle,
  isLaneNativeReady,
  projectedUnitQuadBounds,
  resolveHtmlCanvasMode,
  serializeChangedElements,
  uploadElementImageWebGL,
  uploadElementImageWebGpu,
  type ExperimentalCanvas2DContext,
  type ExperimentalGpuQueue,
  type ExperimentalWebGL2Context,
  type HtmlCanvasCapabilities,
} from './htmlInCanvas';

const capabilities = (patch: Partial<HtmlCanvasCapabilities> = {}): HtmlCanvasCapabilities => ({
  layoutSubtree: false,
  paintEvent: false,
  requestPaint: false,
  captureElementImage: false,
  getElementTransform: false,
  drawElementImage2D: false,
  texElementImage2D: false,
  webGpuAdvertised: false,
  copyElementImageToTexture: 'unsupported',
  offscreenCanvas: false,
  transferableElementImage: false,
  userAgent: 'test',
  detectedAt: '2026-08-24T00:00:00.000Z',
  ...patch,
});

function directChildFixture() {
  const canvas = { setAttribute: vi.fn() } as unknown as HTMLCanvasElement;
  const element = {
    parentElement: canvas,
    getClientRects: () => [{ width: 320, height: 240 }],
    style: { transform: '' },
  } as unknown as HTMLElement;
  return { canvas, element };
}

describe('locale-aware quantities', () => {
  it('groups Korean-display quantities without changing decimals or signs', () => {
    expect(formatQuantity(18420)).toBe('18,420');
    expect(formatQuantity(-11000000.25)).toBe('-11,000,000.25');
  });

  it('normalizes grouped editable quantities and rejects unsafe text', () => {
    expect(parseFormattedQuantity('11,000,000.25')).toBe(11000000.25);
    expect(parseFormattedQuantity('2026-08-21')).toBeNull();
    expect(parseFormattedQuantity('<script>1</script>')).toBeNull();
  });
});

describe('HTML-in-Canvas progressive enhancement', () => {
  it('falls back when the experimental primitive is unavailable', () => {
    expect(resolveHtmlCanvasMode('auto', 'canvas-2d', capabilities())).toBe('dom-overlay');
    expect(resolveHtmlCanvasMode('native', 'webgl', capabilities())).toBe('dom-overlay');
  });

  it('requires the complete lifecycle for each native lane', () => {
    const common = capabilities({ layoutSubtree: true, paintEvent: true, requestPaint: true });
    expect(isLaneNativeReady({ ...common, drawElementImage2D: true }, 'canvas-2d')).toBe(true);
    expect(isLaneNativeReady({ ...common, texElementImage2D: true }, 'webgl')).toBe(false);
    expect(isLaneNativeReady({ ...common, texElementImage2D: true, getElementTransform: true }, 'webgl')).toBe(true);
    expect(resolveHtmlCanvasMode('auto', 'webgl', { ...common, texElementImage2D: true, getElementTransform: true })).toBe('native-webgl');
  });

  it('treats requestPaint as an optional scheduler while still requiring an observed first paint', () => {
    const withoutRequestPaint = capabilities({ layoutSubtree: true, paintEvent: true, drawElementImage2D: true });
    expect(isLaneNativeReady(withoutRequestPaint, 'canvas-2d')).toBe(true);
    const diagnostics = createSurfaceDiagnostics('canvas-2d', 'native-2d', withoutRequestPaint);
    expect(diagnostics).toMatchObject({ ready: false, snapshotPhase: 'awaiting-first', requestPaintCapability: 'unsupported', requestStrategy: 'dom-invalidation' });

    const addEventListener = vi.fn();
    const canvas = { setAttribute: vi.fn(), addEventListener, removeEventListener: vi.fn() } as unknown as HTMLCanvasElement;
    const invalidationTarget = { getAttribute: vi.fn(() => null), setAttribute: vi.fn() } as unknown as HTMLElement;
    const lifecycle = installPaintLifecycle(canvas, vi.fn(), undefined, invalidationTarget);
    expect(lifecycle.request()).toBe('dom-invalidation');
    expect(invalidationTarget.setAttribute).toHaveBeenLastCalledWith('data-paint-invalidation', '1');
    expect(lifecycle.request()).toBe('dom-invalidation');
    expect(invalidationTarget.setAttribute).toHaveBeenLastCalledWith('data-paint-invalidation', '2');
    expect(addEventListener).toHaveBeenCalledWith('paint', expect.any(Function));
  });

  it('marks DOM fallback snapshots as not applicable', () => {
    const diagnostics = createSurfaceDiagnostics('canvas-2d', 'dom-overlay', capabilities());

    expect(diagnostics).toMatchObject({ ready: true, failure: 'none', snapshotPhase: 'not-applicable' });
  });

  it('arms the paint listener without requesting a frame before geometry is ready', () => {
    const requestPaint = vi.fn();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const canvas = {
      setAttribute: vi.fn(),
      addEventListener,
      removeEventListener,
      requestPaint,
    } as unknown as HTMLCanvasElement;
    const lifecycle = installPaintLifecycle(canvas, vi.fn());
    expect(addEventListener).toHaveBeenCalledWith('paint', expect.any(Function));
    expect(requestPaint).not.toHaveBeenCalled();
    expect(lifecycle.request()).toBe('requestPaint');
    expect(requestPaint).toHaveBeenCalledTimes(1);
    lifecycle.dispose();
    expect(removeEventListener).toHaveBeenCalledWith('paint', expect.any(Function));
  });

  it('keeps the semantic DOM task available when composition is explicitly disabled', () => {
    expect(resolveHtmlCanvasMode('auto', 'canvas-2d', capabilities(), true)).toBe('dom-overlay');
    expect(resolveHtmlCanvasMode('disabled', 'canvas-2d', capabilities())).toBe('dom-overlay');
    expect(createSurfaceDiagnostics('canvas-2d', 'dom-overlay', capabilities(), true)).toMatchObject({
      ready: true,
      failure: 'killed',
      snapshotPhase: 'not-applicable',
    });
    expect(HTML_CANVAS_SECURITY_POLICY.acceptsArbitraryHtml).toBe(false);
    expect(HTML_CANVAS_SECURITY_POLICY.trustedDomOnly).toBe(true);
    expect(HTML_CANVAS_SECURITY_POLICY.isHtmlSanitizer).toBe(false);
    expect(HTML_CANVAS_PROPOSAL_SNAPSHOT).toMatchObject({ commitDate: '2026-07-14', checkedAt: '2026-08-26' });
    expect(HTML_CANVAS_PROPOSAL_SNAPSHOT.unstableIssues).toEqual(expect.arrayContaining([135, 148, 149, 151, 152]));
  });

  it('executes the current Canvas 2D overload and applies the returned transform', () => {
    const { canvas, element } = directChildFixture();
    const transform = { toString: () => 'matrix(1, 0, 0, 1, 20, 30)' } as DOMMatrix;
    const draw = vi.fn(() => transform);
    const context = { canvas, drawElementImage: draw } as unknown as ExperimentalCanvas2DContext;
    drawElementImage2D(context, element, { x: 20, y: 30, width: 320, height: 240 });
    expect(draw).toHaveBeenCalledWith(element, 20, 30, 320, 240);
    expect(element.style.transform).toBe('matrix(1, 0, 0, 1, 20, 30)');
  });

  it('executes the current WebGL and WebGPU dictionary signatures', () => {
    const { canvas, element } = directChildFixture();
    const webGlUpload = vi.fn();
    const gl = {
      canvas,
      TEXTURE_2D: 3553,
      RGBA8: 32856,
      texElementImage2D: webGlUpload,
    } as unknown as ExperimentalWebGL2Context;
    uploadElementImageWebGL(gl, element, 640, 480);
    expect(webGlUpload).toHaveBeenCalledWith(3553, 32856, element, { width: 640, height: 480 });

    const gpuCopy = vi.fn();
    const queue = { copyElementImageToTexture: gpuCopy } as ExperimentalGpuQueue;
    const texture = { id: 'texture' };
    uploadElementImageWebGpu(canvas, queue, element, texture, 640, 480);
    expect(gpuCopy).toHaveBeenCalledWith(
      { source: element },
      { destination: { texture }, width: 640, height: 480 },
    );
  });

  it('classifies lifecycle and security failures without hiding them', () => {
    expect(classifyHtmlCanvasError(new Error('must be a direct child'))).toBe('not-direct-child');
    expect(classifyHtmlCanvasError(new Error('cross-origin resource omitted by security policy'))).toBe('security-or-cross-origin');
    expect(classifyHtmlCanvasError(new Error('initial snapshot not painted'))).toBe('not-painted');
  });

  it('uses lane-specific pixel tolerances and rejects boundary drift', () => {
    expect(alignmentToleranceForLane('canvas-2d')).toBe(2);
    expect(alignmentToleranceForLane('worker')).toBe(2);
    expect(alignmentToleranceForLane('webgl')).toBe(4);
    expect(alignmentToleranceForLane('webgpu')).toBe(4);
    expect(createAlignmentReceipt(
      { left: 10, top: 20, right: 110, bottom: 220 },
      { left: 12, top: 18, right: 112, bottom: 222 },
      2,
    ).status).toBe('pass');
    expect(createAlignmentReceipt(
      { left: 10, top: 20, right: 110, bottom: 220 },
      { left: 12.01, top: 20, right: 110, bottom: 220 },
      2,
    ).status).toBe('fail');
  });

  it('projects the GPU unit quad into the browser canvas rectangle', () => {
    const canvas = {
      getBoundingClientRect: () => ({ left: 100, top: 40, width: 200, height: 100 }),
    } as unknown as HTMLCanvasElement;
    expect(projectedUnitQuadBounds(canvas, [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ])).toEqual({ left: 150, top: 65, right: 250, bottom: 115 });
  });

  it('records changed element identities and current paint sequence without inventing readiness', () => {
    const surface = {
      id: '',
      tagName: 'ARTICLE',
      getAttribute: (name: string) => name === 'data-surface-id' ? 'map-surface:seongsu-window' : null,
    } as unknown as Element;
    const control = {
      id: 'map-query',
      tagName: 'INPUT',
      getAttribute: () => null,
    } as unknown as Element;
    expect(serializeChangedElements([surface, control])).toEqual(['map-surface:seongsu-window', 'map-query']);
    const diagnostics = createSurfaceDiagnostics('canvas-2d', 'native-2d', capabilities({ layoutSubtree: true, paintEvent: true, requestPaint: true, drawElementImage2D: true }));
    const first = currentPaintReceipt(diagnostics, { changedElements: [surface] } as unknown as Event & { changedElements: Element[] }, 100);
    expect(first).toMatchObject({ paintSequence: 1, snapshotPhase: 'current', firstPaintAt: 100, changedElements: 1, lastChangedElementIds: ['map-surface:seongsu-window'] });
    expect(diagnostics.ready).toBe(false);
    const second = currentPaintReceipt({ ...diagnostics, ...first }, { changedElements: [control] } as unknown as Event & { changedElements: Element[] }, 125);
    expect(second.paintSequence).toBe(2);
    expect(second.firstPaintAt).toBe(100);
  });

  it('closes each captured ElementImage at most once', () => {
    const close = vi.fn();
    const image = { width: 320, height: 240, close };
    expect(closeElementImageOnce(image)).toBe(true);
    expect(closeElementImageOnce(image)).toBe(false);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('rejects WebGPU sources outside the layout subtree before issuing a copy', () => {
    const { canvas, element } = directChildFixture();
    const gpuCopy = vi.fn();
    const queue = { copyElementImageToTexture: gpuCopy } as ExperimentalGpuQueue;
    (element as unknown as { parentElement: HTMLElement | null }).parentElement = null;
    expect(() => uploadElementImageWebGpu(canvas, queue, element, {}, 64, 64)).toThrow(/direct canvas children/i);
    expect(gpuCopy).not.toHaveBeenCalled();
  });

  it('emits a structured current-IDL receipt only after the primitive succeeds', () => {
    const receipt = callReceipt('GPUQueue.copyElementImageToTexture', 'sourceMap, destinationMap', 'void');
    expect(receipt).toMatchObject({ argumentShape: 'current', returned: 'void', passed: true });
    expect(Number.isNaN(Date.parse(receipt.executedAt))).toBe(false);
  });
});
