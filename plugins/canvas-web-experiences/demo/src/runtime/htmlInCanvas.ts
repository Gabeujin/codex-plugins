export type HtmlSurfaceLane = 'canvas-2d' | 'webgl' | 'webgpu' | 'worker';

export type HtmlCanvasMode =
  | 'native-2d'
  | 'native-webgl'
  | 'native-webgpu'
  | 'native-worker'
  | 'dom-overlay'
  | 'disabled';

export type HtmlCanvasRequest = 'auto' | 'native' | 'dom-overlay' | 'disabled';

export type HtmlCanvasFailure =
  | 'none'
  | 'unsupported'
  | 'not-painted'
  | 'not-direct-child'
  | 'no-generated-box'
  | 'security-or-cross-origin'
  | 'context-or-device-lost'
  | 'alignment-drift'
  | 'upload-failed'
  | 'killed';

export type CapabilityState = 'supported' | 'unsupported' | 'unknown';

export type SnapshotPhase = 'not-applicable' | 'awaiting-first' | 'current' | 'next-frame-pending' | 'failed';

export type AlignmentStatus = 'not-run' | 'pass' | 'fail';

export type PaintRequestStrategy = 'requestPaint' | 'dom-invalidation';

export type TransformSyncProvenance = 'prototype-returned-dommatrix' | 'prototype-get-element-transform' | 'worker-main-thread-prototype' | 'dom-fallback';

export type SurfaceAlignmentReceipt = {
  expected: { left: number; top: number; right: number; bottom: number };
  actual: { left: number; top: number; right: number; bottom: number };
  maxErrorPx: number;
  tolerancePx: number;
  status: Exclude<AlignmentStatus, 'not-run'>;
};

export type ExperimentalCallReceipt = {
  primitive: string;
  overload: string;
  argumentShape: 'current';
  returned: 'DOMMatrix' | 'void' | 'ElementImage';
  executedAt: string;
  passed: boolean;
};

export type HtmlCanvasCapabilities = {
  layoutSubtree: boolean;
  paintEvent: boolean;
  requestPaint: boolean;
  captureElementImage: boolean;
  getElementTransform: boolean;
  drawElementImage2D: boolean;
  texElementImage2D: boolean;
  webGpuAdvertised: boolean;
  copyElementImageToTexture: CapabilityState;
  offscreenCanvas: boolean;
  transferableElementImage: boolean;
  userAgent: string;
  detectedAt: string;
};

export type HtmlSurfaceDiagnostics = {
  scopeId: string;
  lane: HtmlSurfaceLane;
  mode: HtmlCanvasMode;
  ready: boolean;
  failure: HtmlCanvasFailure;
  reason: string;
  primitive: string;
  paintCount: number;
  uploadCount: number;
  requestPaintCount: number;
  requestPaintCapability: CapabilityState;
  requestStrategy: PaintRequestStrategy;
  transformSyncCount: number;
  transformSyncProvenance: TransformSyncProvenance;
  compositePlanId: string | null;
  compositeOperationCount: number;
  compositionRevision: string | null;
  compositionStatus: 'not-run' | 'pass' | 'fail';
  changedElements: number;
  lastChangedElementIds: string[];
  paintSequence: number;
  snapshotPhase: SnapshotPhase;
  firstPaintAt: number | null;
  alignmentErrorPx: number | null;
  alignmentTolerancePx: number;
  alignmentStatus: AlignmentStatus;
  alignmentReceipt: SurfaceAlignmentReceipt | null;
  apiSignature: string;
  lastCallReceipt: ExperimentalCallReceipt | null;
  elementImagesCaptured: number;
  elementImagesTransferred: number;
  elementImagesClosed: number;
  elementImagesTerminalReleased: number;
  elementImagesOutstanding: number;
  privacyExpectation: 'trusted-same-origin-only';
  lastPaintMs: number | null;
  lastError: string | null;
};

export type SurfacePlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Bounds = { left: number; top: number; right: number; bottom: number };

type ExperimentalCanvas = HTMLCanvasElement & {
  layoutSubtree?: boolean;
  onpaint?: ((event: PaintEventLike) => void) | null;
  requestPaint?: () => void;
  captureElementImage?: (element: Element) => ElementImageLike;
  getElementTransform?: (element: Element | ElementImageLike, drawTransform: DOMMatrix) => DOMMatrix;
};

export type PaintEventLike = Event & { changedElements?: readonly Element[] };

export type ElementImageLike = {
  readonly width: number;
  readonly height: number;
  close?: () => void;
};

function boundsFromRect(rect: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>): Bounds {
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

function edgeError(expected: Bounds, actual: Bounds): number {
  return Math.max(
    Math.abs(expected.left - actual.left),
    Math.abs(expected.top - actual.top),
    Math.abs(expected.right - actual.right),
    Math.abs(expected.bottom - actual.bottom),
  );
}

export function alignmentToleranceForLane(lane: 'canvas-2d' | 'worker' | 'webgl' | 'webgpu'): number {
  return lane === 'webgl' || lane === 'webgpu' ? 4 : 2;
}

export function createAlignmentReceipt(
  expected: Bounds,
  actual: Bounds,
  tolerancePx: number,
): SurfaceAlignmentReceipt {
  const maxErrorPx = edgeError(expected, actual);
  return {
    expected,
    actual,
    maxErrorPx,
    tolerancePx,
    status: maxErrorPx <= tolerancePx ? 'pass' : 'fail',
  };
}

export function measureCanvas2dAlignment(
  canvas: HTMLCanvasElement,
  element: HTMLElement,
  placement: SurfacePlacement,
): SurfaceAlignmentReceipt {
  const canvasRect = canvas.getBoundingClientRect();
  const expected = {
    left: canvasRect.left + placement.x,
    top: canvasRect.top + placement.y,
    right: canvasRect.left + placement.x + placement.width,
    bottom: canvasRect.top + placement.y + placement.height,
  };
  return createAlignmentReceipt(
    expected,
    boundsFromRect(element.getBoundingClientRect()),
    alignmentToleranceForLane('canvas-2d'),
  );
}

function projectPoint(matrix: ArrayLike<number>, x: number, y: number): { x: number; y: number } {
  const clipX = matrix[0] * x + matrix[4] * y + matrix[12];
  const clipY = matrix[1] * x + matrix[5] * y + matrix[13];
  const clipW = matrix[3] * x + matrix[7] * y + matrix[15];
  const safeW = Math.abs(clipW) < 0.000_001 ? 0.000_001 : clipW;
  return { x: clipX / safeW, y: clipY / safeW };
}

export function projectedUnitQuadBounds(
  canvas: HTMLCanvasElement,
  modelViewProjection: ArrayLike<number>,
): Bounds {
  if (modelViewProjection.length !== 16) {
    throw new DOMException('A 4×4 model-view-projection matrix is required.', 'InvalidStateError');
  }
  const rect = canvas.getBoundingClientRect();
  const points = [
    projectPoint(modelViewProjection, -.5, -.5),
    projectPoint(modelViewProjection, .5, -.5),
    projectPoint(modelViewProjection, -.5, .5),
    projectPoint(modelViewProjection, .5, .5),
  ].map((point) => ({
    x: rect.left + (point.x * .5 + .5) * rect.width,
    y: rect.top + (-point.y * .5 + .5) * rect.height,
  }));
  return {
    left: Math.min(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    right: Math.max(...points.map((point) => point.x)),
    bottom: Math.max(...points.map((point) => point.y)),
  };
}

export function measureGpuAlignment(
  canvas: HTMLCanvasElement,
  element: HTMLElement,
  modelViewProjection: ArrayLike<number>,
): SurfaceAlignmentReceipt {
  const rect = canvas.getBoundingClientRect();
  return createAlignmentReceipt(
    projectedUnitQuadBounds(canvas, modelViewProjection),
    boundsFromRect(element.getBoundingClientRect()),
    alignmentToleranceForLane('webgpu'),
  );
}

export function serializeChangedElements(elements: readonly Element[] | undefined): string[] {
  if (!elements) return [];
  return elements.map((element, index) =>
    element.getAttribute('data-surface-id')
      ?? element.id
      ?? element.getAttribute('data-domain')
      ?? `${element.tagName.toLowerCase()}:${index}`,
  );
}

export function callReceipt(
  primitive: string,
  overload: string,
  returned: ExperimentalCallReceipt['returned'],
): ExperimentalCallReceipt {
  return {
    primitive,
    overload,
    argumentShape: 'current',
    returned,
    executedAt: new Date().toISOString(),
    passed: true,
  };
}

const closedElementImages = new WeakSet<object>();

export function closeElementImageOnce(image: ElementImageLike): boolean {
  if (closedElementImages.has(image as object)) return false;
  closedElementImages.add(image as object);
  image.close?.();
  return true;
}

export type ExperimentalCanvas2DContext = CanvasRenderingContext2D & {
  drawElementImage?: (
    element: Element | ElementImageLike,
    dx: number,
    dy: number,
    dwidth?: number,
    dheight?: number,
  ) => DOMMatrix;
};

export type ExperimentalWebGL2Context = WebGL2RenderingContext & {
  texElementImage2D?: (
    target: number,
    internalFormat: number,
    element: Element | ElementImageLike,
    config?: { sx?: number; sy?: number; swidth?: number; sheight?: number; width?: number; height?: number },
  ) => void;
};

export type ExperimentalGpuQueue = {
  copyElementImageToTexture?: (
    source: { source: Element | ElementImageLike; sx?: number; sy?: number; swidth?: number; sheight?: number },
    destination: { destination: { texture: unknown }; width?: number; height?: number },
  ) => void;
};

const emptyCapabilities = (): HtmlCanvasCapabilities => ({
  layoutSubtree: false,
  paintEvent: false,
  requestPaint: false,
  captureElementImage: false,
  getElementTransform: false,
  drawElementImage2D: false,
  texElementImage2D: false,
  webGpuAdvertised: false,
  copyElementImageToTexture: 'unknown',
  offscreenCanvas: false,
  transferableElementImage: false,
  userAgent: 'unavailable',
  detectedAt: new Date().toISOString(),
});

export function detectHtmlCanvasCapabilities(): HtmlCanvasCapabilities {
  const result = emptyCapabilities();
  if (typeof document === 'undefined') return result;

  const canvas = document.createElement('canvas') as ExperimentalCanvas;
  const canvasPrototype = typeof HTMLCanvasElement === 'undefined'
    ? ({} as ExperimentalCanvas)
    : (HTMLCanvasElement.prototype as ExperimentalCanvas);
  const context2d = canvas.getContext('2d') as ExperimentalCanvas2DContext | null;
  const webGlCanvas = document.createElement('canvas');
  const webgl = webGlCanvas.getContext('webgl2') as ExperimentalWebGL2Context | null;
  const texElementImage2D = typeof webgl?.texElementImage2D === 'function';
  webgl?.getExtension('WEBGL_lose_context')?.loseContext();
  const browserNavigator = typeof navigator === 'undefined' ? undefined : navigator as Navigator & { gpu?: unknown };
  const elementImagePrototype = (globalThis as typeof globalThis & { ElementImage?: { prototype?: object } }).ElementImage?.prototype;

  return {
    layoutSubtree: 'layoutSubtree' in canvasPrototype || 'layoutSubtree' in canvas,
    paintEvent: 'onpaint' in canvasPrototype || 'onpaint' in canvas,
    requestPaint: typeof canvas.requestPaint === 'function',
    captureElementImage: typeof canvas.captureElementImage === 'function',
    getElementTransform: typeof canvas.getElementTransform === 'function',
    drawElementImage2D: typeof context2d?.drawElementImage === 'function',
    texElementImage2D,
    webGpuAdvertised: Boolean(browserNavigator?.gpu),
    copyElementImageToTexture: browserNavigator?.gpu ? 'unknown' : 'unsupported',
    offscreenCanvas:
      typeof OffscreenCanvas !== 'undefined' &&
      typeof canvas.transferControlToOffscreen === 'function',
    transferableElementImage: Boolean(elementImagePrototype),
    userAgent: browserNavigator?.userAgent ?? 'unavailable',
    detectedAt: new Date().toISOString(),
  };
}

export async function probeWebGpuCopyCapability(
  capabilities: HtmlCanvasCapabilities,
): Promise<HtmlCanvasCapabilities> {
  if (typeof navigator === 'undefined') return capabilities;
  const gpu = (navigator as Navigator & {
    gpu?: {
      requestAdapter?: () => Promise<{
        requestDevice?: () => Promise<{ queue?: ExperimentalGpuQueue; destroy?: () => void }>;
      } | null>;
    };
  }).gpu;
  if (!gpu?.requestAdapter) {
    return { ...capabilities, copyElementImageToTexture: 'unsupported' };
  }

  try {
    const adapter = await gpu.requestAdapter();
    const device = await adapter?.requestDevice?.();
    const queue = device?.queue as ExperimentalGpuQueue | undefined;
    const supported = typeof queue?.copyElementImageToTexture === 'function';
    device?.destroy?.();
    return {
      ...capabilities,
      webGpuAdvertised: true,
      copyElementImageToTexture: supported ? 'supported' : 'unsupported',
    };
  } catch {
    return { ...capabilities, copyElementImageToTexture: 'unsupported' };
  }
}

export function isLaneNativeReady(
  capabilities: HtmlCanvasCapabilities,
  lane: HtmlSurfaceLane,
): boolean {
  const lifecycle =
    capabilities.layoutSubtree &&
    capabilities.paintEvent;
  if (!lifecycle) return false;
  if (lane === 'canvas-2d') return capabilities.drawElementImage2D;
  if (lane === 'webgl') {
    return capabilities.texElementImage2D && capabilities.getElementTransform;
  }
  if (lane === 'webgpu') {
    return capabilities.copyElementImageToTexture === 'supported' && capabilities.getElementTransform;
  }
  return capabilities.captureElementImage && capabilities.offscreenCanvas && capabilities.transferableElementImage;
}

export function nativeModeForLane(lane: HtmlSurfaceLane): HtmlCanvasMode {
  if (lane === 'canvas-2d') return 'native-2d';
  if (lane === 'webgl') return 'native-webgl';
  if (lane === 'webgpu') return 'native-webgpu';
  return 'native-worker';
}

export function resolveHtmlCanvasMode(
  requested: HtmlCanvasRequest,
  lane: HtmlSurfaceLane,
  capabilities: HtmlCanvasCapabilities,
  killSwitch = false,
): HtmlCanvasMode {
  // Disabling experimental composition must never remove the semantic task.
  // Both the emergency kill switch and the explicit Disabled option keep the
  // equivalent DOM control plane available; diagnostics retain the kill state.
  if (killSwitch || requested === 'disabled') return 'dom-overlay';
  if (requested === 'dom-overlay') return 'dom-overlay';
  return isLaneNativeReady(capabilities, lane) ? nativeModeForLane(lane) : 'dom-overlay';
}

export function createSurfaceDiagnostics(
  lane: HtmlSurfaceLane,
  mode: HtmlCanvasMode,
  capabilities: HtmlCanvasCapabilities,
  killSwitch = false,
  scopeId = 'unscoped',
): HtmlSurfaceDiagnostics {
  const nativeSelected = mode.startsWith('native-');
  const ready = mode === 'dom-overlay';
  const failure: HtmlCanvasFailure = killSwitch || mode === 'disabled'
    ? 'killed'
    : nativeSelected || mode === 'dom-overlay'
      ? 'none'
      : 'unsupported';
  const primitive = lane === 'canvas-2d'
    ? 'CanvasRenderingContext2D.drawElementImage'
    : lane === 'webgl'
      ? 'WebGL2RenderingContext.texElementImage2D'
      : lane === 'webgpu'
        ? 'GPUQueue.copyElementImageToTexture'
        : 'HTMLCanvasElement.captureElementImage';
  const apiSignature = lane === 'canvas-2d'
    ? 'drawElementImage(element, dx, dy, dwidth, dheight)'
    : lane === 'webgl'
      ? 'texElementImage2D(target, internalformat, element, config)'
      : lane === 'webgpu'
        ? 'copyElementImageToTexture(sourceMap, destinationMap)'
        : 'captureElementImage(element) → transferable ElementImage';

  return {
    scopeId,
    lane,
    mode,
    ready,
    failure,
    reason: killSwitch
      ? 'Native HTML-in-Canvas composition is disabled; the same semantic task remains available as a DOM overlay.'
      : nativeSelected
      ? 'Exact lane capability contract is present; waiting for the first paint and transform-sync receipt.'
      : mode === 'dom-overlay'
        ? `The ${lane} native contract is incomplete; the same semantic task is running as a DOM overlay.`
        : 'The experimental surface is disabled.',
    primitive,
    paintCount: 0,
    uploadCount: 0,
    requestPaintCount: 0,
    requestPaintCapability: capabilities.requestPaint ? 'supported' : 'unsupported',
    requestStrategy: capabilities.requestPaint ? 'requestPaint' : 'dom-invalidation',
    transformSyncCount: 0,
    transformSyncProvenance: mode === 'dom-overlay'
      ? 'dom-fallback'
      : lane === 'canvas-2d'
        ? 'prototype-returned-dommatrix'
        : lane === 'worker'
          ? 'worker-main-thread-prototype'
          : 'prototype-get-element-transform',
    compositePlanId: null,
    compositeOperationCount: 0,
    compositionRevision: null,
    compositionStatus: 'not-run',
    changedElements: 0,
    lastChangedElementIds: [],
    paintSequence: 0,
    snapshotPhase: nativeSelected ? 'awaiting-first' : 'not-applicable',
    firstPaintAt: null,
    alignmentErrorPx: null,
    alignmentTolerancePx: 2,
    alignmentStatus: 'not-run',
    alignmentReceipt: null,
    apiSignature,
    lastCallReceipt: null,
    elementImagesCaptured: 0,
    elementImagesTransferred: 0,
    elementImagesClosed: 0,
    elementImagesTerminalReleased: 0,
    elementImagesOutstanding: 0,
    privacyExpectation: 'trusted-same-origin-only',
    lastPaintMs: null,
    lastError: null,
  };
}

export function configureLayoutSubtree(canvas: HTMLCanvasElement): void {
  const experimental = canvas as ExperimentalCanvas;
  canvas.setAttribute('layoutsubtree', '');
  try {
    experimental.layoutSubtree = true;
  } catch {
    // Attribute reflection is still enough for implementations without the IDL property.
  }
}

export function assertDrawableChild(canvas: HTMLCanvasElement, element: HTMLElement): void {
  if (element.parentElement !== canvas) {
    throw new DOMException('HTML-in-Canvas sources must be direct canvas children.', 'InvalidStateError');
  }
  if (typeof element.getClientRects === 'function' && element.getClientRects().length === 0) {
    throw new DOMException('HTML-in-Canvas sources must generate a layout box.', 'InvalidStateError');
  }
}

export function drawElementImage2D(
  context: ExperimentalCanvas2DContext,
  element: HTMLElement,
  placement: SurfacePlacement,
  applyTransform = true,
): DOMMatrix {
  const canvas = context.canvas;
  assertDrawableChild(canvas, element);
  if (typeof context.drawElementImage !== 'function') {
    throw new DOMException('drawElementImage is unavailable.', 'NotSupportedError');
  }
  const transform = context.drawElementImage(
    element,
    placement.x,
    placement.y,
    placement.width,
    placement.height,
  );
  if (!transform || typeof transform.toString !== 'function') {
    throw new DOMException('drawElementImage did not return a DOMMatrix.', 'InvalidStateError');
  }
  if (applyTransform) {
    const cssTransform = transform.toString();
    if (element.style.transform !== cssTransform) element.style.transform = cssTransform;
  }
  return transform;
}

export function uploadElementImageWebGL(
  context: ExperimentalWebGL2Context,
  element: HTMLElement,
  width: number,
  height: number,
): void {
  const canvas = context.canvas as HTMLCanvasElement;
  if (typeof canvas?.setAttribute !== 'function') {
    throw new DOMException('texElementImage2D requires a main-thread HTMLCanvasElement source tree.', 'InvalidStateError');
  }
  assertDrawableChild(canvas, element);
  if (typeof context.texElementImage2D !== 'function') {
    throw new DOMException('texElementImage2D is unavailable.', 'NotSupportedError');
  }
  context.texElementImage2D(
    context.TEXTURE_2D,
    context.RGBA8,
    element,
    { width, height },
  );
}

export function uploadElementImageWebGpu(
  canvas: HTMLCanvasElement,
  queue: ExperimentalGpuQueue,
  element: HTMLElement,
  texture: unknown,
  width: number,
  height: number,
): void {
  assertDrawableChild(canvas, element);
  if (typeof queue.copyElementImageToTexture !== 'function') {
    throw new DOMException('copyElementImageToTexture is unavailable.', 'NotSupportedError');
  }
  queue.copyElementImageToTexture(
    { source: element },
    { destination: { texture }, width, height },
  );
}

export function calculateScreenSpaceTransform(
  canvas: HTMLCanvasElement,
  element: HTMLElement,
  modelViewProjection: ArrayLike<number>,
): DOMMatrix {
  const experimental = canvas as ExperimentalCanvas;
  if (typeof experimental.getElementTransform !== 'function') {
    throw new DOMException('getElementTransform is unavailable.', 'NotSupportedError');
  }
  if (typeof DOMMatrix === 'undefined' || modelViewProjection.length !== 16) {
    throw new DOMException('A 4×4 DOMMatrix is required for transform synchronization.', 'InvalidStateError');
  }

  const width = Math.max(1, element.offsetWidth);
  const height = Math.max(1, element.offsetHeight);
  const mvp = new DOMMatrix(Array.from(modelViewProjection));
  const cssToUnitSpace = new DOMMatrix()
    .scale(1 / width, -1 / height, 1)
    .translate(-width / 2, -height / 2);
  const clipToCanvasViewport = new DOMMatrix()
    .translate(canvas.width / 2, canvas.height / 2)
    .scale(canvas.width / 2, -canvas.height / 2, 1);
  const drawTransform = clipToCanvasViewport.multiply(mvp).multiply(cssToUnitSpace);
  const synchronized = experimental.getElementTransform(element, drawTransform);
  const cssTransform = synchronized.toString();
  if (element.style.transform !== cssTransform) element.style.transform = cssTransform;
  return synchronized;
}

export function currentPaintReceipt(
  diagnostics: HtmlSurfaceDiagnostics,
  event: PaintEventLike,
  timestamp = performance.now(),
): Pick<
  HtmlSurfaceDiagnostics,
  'paintSequence' | 'snapshotPhase' | 'firstPaintAt' | 'changedElements' | 'lastChangedElementIds'
> {
  const lastChangedElementIds = serializeChangedElements(event.changedElements);
  return {
    paintSequence: diagnostics.paintSequence + 1,
    snapshotPhase: 'current',
    firstPaintAt: diagnostics.firstPaintAt ?? timestamp,
    changedElements: lastChangedElementIds.length,
    lastChangedElementIds,
  };
}

export function installPaintLifecycle(
  canvas: HTMLCanvasElement,
  onPaint: (event: PaintEventLike) => void,
  onRequest?: () => void,
  invalidationTarget?: Element,
): { request: () => PaintRequestStrategy; dispose: () => void } {
  const experimental = canvas as ExperimentalCanvas;
  configureLayoutSubtree(canvas);
  const listener = (event: Event) => onPaint(event as PaintEventLike);
  canvas.addEventListener('paint', listener);
  let invalidationRevision = Number(invalidationTarget?.getAttribute('data-paint-invalidation') ?? 0) || 0;
  const request = () => {
    if (typeof experimental.requestPaint !== 'function') {
      // Current Chromium issue #152 shows requestPaint can be absent even when
      // the paint lifecycle and draw primitive are present. A trusted DOM
      // mutation still invalidates the layout subtree. The revision attribute
      // is consumed by a tiny painted pseudo-element in styles.css, so this is
      // a real rendering invalidation rather than a bookkeeping label. The
      // first-paint watchdog still decides whether the lifecycle is usable.
      const target = invalidationTarget ?? canvas.firstElementChild;
      if (!target) throw new DOMException('A direct canvas child is required for DOM paint invalidation.', 'InvalidStateError');
      invalidationRevision += 1;
      target.setAttribute('data-paint-invalidation', String(invalidationRevision));
      return 'dom-invalidation' as const;
    }
    onRequest?.();
    experimental.requestPaint();
    return 'requestPaint' as const;
  };
  return {
    request,
    dispose: () => canvas.removeEventListener('paint', listener),
  };
}

export function classifyHtmlCanvasError(error: unknown): HtmlCanvasFailure {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes('direct canvas child') || message.includes('direct child')) return 'not-direct-child';
  if (message.includes('layout box') || message.includes('generated')) return 'no-generated-box';
  if (message.includes('cross-origin') || message.includes('security')) return 'security-or-cross-origin';
  if (message.includes('context') || message.includes('device') || message.includes('lost')) return 'context-or-device-lost';
  if (message.includes('alignment') || message.includes('drift')) return 'alignment-drift';
  if (message.includes('snapshot') || message.includes('paint')) return 'not-painted';
  if (message.includes('unavailable') || message.includes('not supported')) return 'unsupported';
  return 'upload-failed';
}

export function mergeWebGpuCapability(
  capabilities: HtmlCanvasCapabilities,
  supported: boolean,
): HtmlCanvasCapabilities {
  return {
    ...capabilities,
    webGpuAdvertised: capabilities.webGpuAdvertised || supported,
    copyElementImageToTexture: supported ? 'supported' : 'unsupported',
  };
}

export const HTML_CANVAS_SECURITY_POLICY = Object.freeze({
  acceptsArbitraryHtml: false,
  acceptsRemoteMarkup: false,
  trustedDomOnly: true,
  fallbackRequired: true,
  crossOriginContentMayBeOmitted: true,
  isHtmlSanitizer: false,
  fullyActiveDocumentOnly: true,
});

export const HTML_CANVAS_EXPERIMENT_LABEL =
  'Controlled experimental preview — native execution requires the current Chromium flag or a valid origin trial.';

export const HTML_CANVAS_PROPOSAL_SNAPSHOT = Object.freeze({
  repository: 'https://github.com/WICG/html-in-canvas',
  commit: 'd4433e329697c4341a9f915f75dbd9608f3939fa',
  commitDate: '2026-07-14',
  checkedAt: '2026-08-26',
  status: 'Pinned WICG proposal snapshot; post-commit open issues remain unstable.',
  unstableIssues: [135, 146, 148, 149, 151, 152],
});
