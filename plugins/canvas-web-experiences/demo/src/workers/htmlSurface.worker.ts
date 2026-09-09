import { closeElementImageOnce, type ElementImageLike, type ExperimentalCanvas2DContext, type SurfacePlacement } from '../runtime/htmlInCanvas';

type InitMessage = { type: 'init'; canvas: OffscreenCanvas; qaWorkerFault?: boolean; qaWorkerHardStall?: boolean };
type ResizeMessage = { type: 'resize'; width: number; height: number; dpr: number };
type PaintMessage = { type: 'paint'; sequence: number; image: ElementImageLike; placement: SurfacePlacement };
type RetireMessage = { type: 'retire' };
type WorkerMessage = InitMessage | ResizeMessage | PaintMessage | RetireMessage;
type WorkerFailure = { type: 'fatal' | 'context-lost'; message: string };

let context: ExperimentalCanvas2DContext | null = null;
let dpr = 1;
let qaWorkerFaultArmed = false;
let qaWorkerFaultReported = false;
let qaWorkerHardStallArmed = false;
let qaWorkerHardStallTriggered = false;
const ownedImages = new Map<number, ElementImageLike>();

function reportFailure(type: WorkerFailure['type'], message: string) {
  self.postMessage({ type, message } satisfies WorkerFailure);
}

function installLossListener(canvas: OffscreenCanvas) {
  canvas.addEventListener('contextlost', () => {
    reportFailure('context-lost', 'OffscreenCanvas 2D context was lost.');
  });
}

self.addEventListener('error', (event) => {
  reportFailure('fatal', event.message || 'Worker runtime error.');
});

self.addEventListener('unhandledrejection', () => {
  reportFailure('fatal', 'Worker unhandled promise rejection.');
});

self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  if (message.type === 'init') {
    context = message.canvas.getContext('2d') as unknown as ExperimentalCanvas2DContext | null;
    // Vite replaces DEV with false in production builds, removing this controlled-fault branch.
    qaWorkerFaultArmed = import.meta.env.DEV && message.qaWorkerFault === true;
    qaWorkerHardStallArmed = import.meta.env.DEV && message.qaWorkerHardStall === true;
    installLossListener(message.canvas);
    self.postMessage(context ? { type: 'ready' } : { type: 'error', message: 'Worker Canvas 2D context is unavailable.' });
    return;
  }
  if (message.type === 'retire') {
    const closedSequences: number[] = [];
    for (const [sequence, image] of ownedImages) {
      if (closeElementImageOnce(image)) {
        closedSequences.push(sequence);
        ownedImages.delete(sequence);
      }
    }
    self.postMessage({ type: 'retired', closedSequences, pendingSequences: [...ownedImages.keys()] });
    self.close();
    return;
  }
  if (!context) {
    if (message.type === 'paint') {
      const closed = closeElementImageOnce(message.image);
      self.postMessage({ type: 'error', sequence: message.sequence, closed, message: 'Worker Canvas 2D context is unavailable.' });
    }
    return;
  }
  if (message.type === 'resize') {
    context.canvas.width = message.width;
    context.canvas.height = message.height;
    dpr = message.dpr;
    return;
  }
  let closed = false;
  ownedImages.set(message.sequence, message.image);
  if (qaWorkerHardStallArmed && !qaWorkerHardStallTriggered) {
    qaWorkerHardStallTriggered = true;
    // Development-only fault injection: keep the transferred ElementImage owned
    // while the worker is unresponsive long enough to exercise watchdog,
    // retirement grace, forced termination, and terminal-release accounting.
    const releaseAt = performance.now() + 3_000;
    while (performance.now() < releaseAt) { /* intentional worker-only stall */ }
    return;
  }
  try {
    context.reset?.();
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, context.canvas.width / dpr, context.canvas.height / dpr);
    const draw = context.drawElementImage;
    if (!draw) throw new DOMException('Worker drawElementImage is unavailable.', 'NotSupportedError');
    const transform = draw.call(
      context,
      message.image,
      message.placement.x,
      message.placement.y,
      message.placement.width,
      message.placement.height,
    );
    closed = closeElementImageOnce(message.image);
    if (closed) ownedImages.delete(message.sequence);
    // Keep the DOMMatrix structured clone intact. Converting it in the worker can
    // produce a representation that the main-thread CSS parser rejects, leaving
    // hit testing at the element's undisplaced fallback position.
    self.postMessage({ type: 'painted', sequence: message.sequence, transform, placement: message.placement, closed });
    if (qaWorkerFaultArmed && !qaWorkerFaultReported) {
      qaWorkerFaultReported = true;
      queueMicrotask(() => reportFailure('fatal', 'qa-worker-fault: controlled development-only worker failure.'));
    }
  } catch (error) {
    if (!closed) closed = closeElementImageOnce(message.image);
    if (closed) ownedImages.delete(message.sequence);
    self.postMessage({ type: 'error', sequence: message.sequence, closed, message: error instanceof Error ? error.message : String(error) });
  }
});
