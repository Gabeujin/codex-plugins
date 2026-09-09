import { useEffect, useRef } from 'react';
import { SemanticDomainSurface } from '../surface/SemanticDomainSurface';
import {
  callReceipt,
  classifyHtmlCanvasError,
  closeElementImageOnce,
  configureLayoutSubtree,
  currentPaintReceipt,
  installPaintLifecycle,
  measureCanvas2dAlignment,
  type ElementImageLike,
  type HtmlCanvasMode,
  type HtmlSurfaceDiagnostics,
  type SurfacePlacement,
} from '../runtime/htmlInCanvas';
import type { SurfaceBinding } from '../runtime/surfaceBindings';
import type { DemoDefinition, DemoState, SceneRuntimeState } from '../types';

type WorkerSurfaceProps = {
  demo: DemoDefinition;
  state: DemoState;
  runtime: SceneRuntimeState;
  binding: SurfaceBinding;
  mode: HtmlCanvasMode;
  diagnostics: HtmlSurfaceDiagnostics;
  requestPaintToken: number;
  onControlChange: (key: string, value: string | number | boolean) => void;
  onAction: (key: string) => void;
  onDiagnostics: (diagnostics: HtmlSurfaceDiagnostics) => void;
};

type CaptureCanvas = HTMLCanvasElement & {
  captureElementImage?: (element: Element) => ElementImageLike;
  requestPaint?: () => void;
};

type WorkerResponse = {
  type: string;
  sequence?: number;
  transform?: DOMMatrix | string;
  placement?: SurfacePlacement;
  message?: string;
  closed?: boolean;
  closedSequences?: number[];
  pendingSequences?: number[];
};

export const WORKER_PAINT_WATCHDOG_MS = 1_500;
export const WORKER_RETIRE_GRACE_MS = 120;

export function workerTerminalOwnershipReceipt(outstanding: number, acknowledgedClosed = 0) {
  const normalizedOutstanding = Math.max(0, Math.floor(outstanding));
  const closed = Math.min(normalizedOutstanding, Math.max(0, Math.floor(acknowledgedClosed)));
  return {
    explicitlyClosed: closed,
    terminalReleased: normalizedOutstanding - closed,
    outstanding: 0,
  };
}

export function isDevWorkerFaultEnabled(isDevelopment: boolean, search: string): boolean {
  return isDevelopment && new URLSearchParams(search).get('qa-worker-fault') === '1';
}

export function isDevWorkerHardStallEnabled(isDevelopment: boolean, search: string): boolean {
  return isDevelopment && new URLSearchParams(search).get('qa-worker-hard-stall') === '1';
}

export function shouldReportDevWorkerFault(isArmed: boolean, alreadyReported: boolean): boolean {
  return isArmed && !alreadyReported;
}

export function shouldFailWorkerPaintWatchdog(
  inFlight: boolean,
  watchedSequence: number,
  latestPostedSequence: number,
  retired: boolean,
): boolean {
  return inFlight && !retired && watchedSequence === latestPostedSequence;
}

export function workerReceiptRetirement(
  transformValid: boolean,
  alignmentStatus: 'pass' | 'fail' | 'unmeasured',
  closed: boolean,
): { retire: boolean; failure: HtmlSurfaceDiagnostics['failure']; lastError: string | null } {
  if (!transformValid) return { retire: true, failure: 'upload-failed', lastError: 'worker-transform-rejected' };
  if (alignmentStatus !== 'pass') return { retire: true, failure: 'alignment-drift', lastError: 'worker-alignment-drift' };
  if (!closed) return { retire: true, failure: 'upload-failed', lastError: 'worker-element-image-close-unconfirmed' };
  return { retire: false, failure: 'none', lastError: null };
}

export function WorkerSurface({
  demo,
  state,
  runtime,
  binding,
  mode,
  diagnostics,
  requestPaintToken,
  onControlChange,
  onAction,
  onDiagnostics,
}: WorkerSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLElement>(null);
  const requestRef = useRef<(() => void) | null>(null);
  const diagnosticsRef = useRef(diagnostics);
  const bindingRef = useRef(binding);
  diagnosticsRef.current = diagnostics;
  bindingRef.current = binding;
  const native = mode === 'native-worker';
  const interactive = native && binding.visible && !binding.occluded;

  useEffect(() => {
    const canvas = canvasRef.current as CaptureCanvas | null;
    const source = sourceRef.current;
    if (!canvas || !source || !interactive) return;
    configureLayoutSubtree(canvas);
    let lifecycle: ReturnType<typeof installPaintLifecycle> | null = null;
    let observer: ResizeObserver | null = null;
    let worker: Worker | null = null;
    let inFlight = false;
    const inFlightSequences = new Set<number>();
    let queued = false;
    let sequence = 0;
    let latestAppliedSequence = 0;
    let retired = false;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    let retirementTimer: ReturnType<typeof setTimeout> | null = null;
    let watchdogSequence = 0;
    let lastTransformGeometry = '';
    let disposed = false;
    const qaWorkerFault = isDevWorkerFaultEnabled(import.meta.env.DEV, window.location.search);
    const qaWorkerHardStall = isDevWorkerHardStallEnabled(import.meta.env.DEV, window.location.search);
    let onMessage: (event: MessageEvent<WorkerResponse>) => void = () => {};
    let onError: (event: ErrorEvent) => void = () => {};
    let onMessageError: () => void = () => {};

    const updateDiagnostics = (patch: Partial<HtmlSurfaceDiagnostics>) => {
      const next = { ...diagnosticsRef.current, ...patch };
      diagnosticsRef.current = next;
      onDiagnostics(next);
    };

    const clearWatchdog = () => {
      if (watchdog !== null) clearTimeout(watchdog);
      watchdog = null;
    };

    const clearRetirementTimer = () => {
      if (retirementTimer !== null) clearTimeout(retirementTimer);
      retirementTimer = null;
    };

    const finalizeWorkerOwnership = (closedSequences: number[] = [], report = true) => {
      clearRetirementTimer();
      const outstandingBefore = inFlightSequences.size;
      let acknowledgedClosed = 0;
      for (const closedSequence of closedSequences) {
        if (inFlightSequences.delete(closedSequence)) acknowledgedClosed += 1;
      }
      const receipt = workerTerminalOwnershipReceipt(outstandingBefore, acknowledgedClosed);
      inFlightSequences.clear();
      const retiringWorker = worker;
      worker = null;
      retiringWorker?.removeEventListener('message', onMessage);
      retiringWorker?.removeEventListener('error', onError);
      retiringWorker?.removeEventListener('messageerror', onMessageError);
      retiringWorker?.terminate();
      if (report && !disposed && outstandingBefore > 0) {
        updateDiagnostics({
          elementImagesClosed: diagnosticsRef.current.elementImagesClosed + receipt.explicitlyClosed,
          elementImagesTerminalReleased: diagnosticsRef.current.elementImagesTerminalReleased + receipt.terminalReleased,
          elementImagesOutstanding: Math.max(0, diagnosticsRef.current.elementImagesOutstanding - outstandingBefore),
        });
      }
    };

    const requestWorkerRetirement = (report = true) => {
      if (!worker) return;
      if (inFlightSequences.size === 0) {
        finalizeWorkerOwnership([], report);
        return;
      }
      try {
        worker.postMessage({ type: 'retire' });
        retirementTimer = setTimeout(() => finalizeWorkerOwnership([], report), WORKER_RETIRE_GRACE_MS);
      } catch {
        finalizeWorkerOwnership([], report);
      }
    };

    const retireToFallback = (
      reason: string,
      lastError: string,
      failure: HtmlSurfaceDiagnostics['failure'] = 'context-or-device-lost',
      receiptPatch: Partial<HtmlSurfaceDiagnostics> = {},
    ) => {
      if (retired) return;
      retired = true;
      inFlight = false;
      queued = false;
      clearWatchdog();
      lifecycle?.dispose();
      observer?.disconnect();
      requestRef.current = null;
      requestWorkerRetirement(true);
      updateDiagnostics({
        ...receiptPatch,
        ready: false,
        failure,
        reason,
        lastError,
      });
    };

    const armWatchdog = (postedSequence: number) => {
      clearWatchdog();
      watchdogSequence = postedSequence;
      watchdog = setTimeout(() => {
        if (shouldFailWorkerPaintWatchdog(inFlight, watchdogSequence, sequence, retired)) {
          retireToFallback(
            'Worker composition did not acknowledge the latest ElementImage within the bounded timeout; the task-safe DOM fallback is active.',
            `worker-paint-timeout:${watchdogSequence}`,
          );
        }
      }, WORKER_PAINT_WATCHDOG_MS);
    };

    try {
      worker = new Worker(new URL('../workers/htmlSurface.worker.ts', import.meta.url), { type: 'module' });
      const offscreen = canvas.transferControlToOffscreen();
      worker.postMessage({ type: 'init', canvas: offscreen, qaWorkerFault, qaWorkerHardStall }, [offscreen]);
      const onWorkerFailure = (kind: 'worker-error' | 'worker-messageerror', message: string) => {
        retireToFallback(
          `Worker composition encountered ${kind}; the task-safe DOM fallback is active.`,
          message,
        );
      };
      onMessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'retired') {
          finalizeWorkerOwnership(event.data.closedSequences ?? [], !disposed);
          return;
        }
        if (retired) {
          if ((event.data.type === 'painted' || event.data.type === 'error') && event.data.closed === true && event.data.sequence != null) {
            const closedCount = inFlightSequences.delete(event.data.sequence) ? 1 : 0;
            if (!disposed && closedCount) {
              updateDiagnostics({
                elementImagesClosed: diagnosticsRef.current.elementImagesClosed + closedCount,
                elementImagesOutstanding: Math.max(0, diagnosticsRef.current.elementImagesOutstanding - closedCount),
              });
            }
          }
          return;
        }
        if (event.data.type === 'fatal' || event.data.type === 'context-lost') {
          retireToFallback(
            event.data.type === 'context-lost'
              ? 'Worker OffscreenCanvas context was lost; the task-safe DOM fallback is active.'
              : 'Worker runtime failed; the task-safe DOM fallback is active.',
            event.data.message ?? event.data.type,
          );
          return;
        }
        if (event.data.type === 'painted' && event.data.transform) {
          inFlight = false;
          clearWatchdog();
          const paintedSequence = event.data.sequence ?? 0;
          if (paintedSequence >= latestAppliedSequence) {
            latestAppliedSequence = paintedSequence;
            const transformValue = typeof event.data.transform === 'string'
              ? event.data.transform
              : event.data.transform.toString();
            const paintedPlacement = event.data.placement ?? bindingRef.current.placement;
            const transformGeometry = [
              canvas.width, canvas.height, source.offsetWidth, source.offsetHeight,
              paintedPlacement.x, paintedPlacement.y,
              paintedPlacement.width, paintedPlacement.height,
            ].join(':');
            const transformChanged = transformGeometry !== lastTransformGeometry;
            if (transformChanged) {
              source.style.transform = transformValue;
              lastTransformGeometry = transformGeometry;
            }
            const transformValid = Boolean(source.style.transform && /^matrix(?:3d)?\(/.test(source.style.transform));
            if (!transformValid) {
              const retirement = workerReceiptRetirement(false, 'unmeasured', event.data.closed === true);
              retireToFallback(
                'Worker pixels were drawn, but their DOM hit-test transform was rejected; the task-safe fallback is active.',
                `${retirement.lastError}: ${transformValue}`,
                retirement.failure,
              );
              return;
            }
            const alignment = measureCanvas2dAlignment(canvas, source, paintedPlacement);
            const closedCount = event.data.closed && inFlightSequences.delete(paintedSequence) ? 1 : 0;
            const retirement = workerReceiptRetirement(true, alignment.status, event.data.closed === true);
            const receiptPatch: Partial<HtmlSurfaceDiagnostics> = {
              primitive: 'captureElementImage → ElementImage transfer → OffscreenCanvas.drawElementImage',
              apiSignature: 'captureElementImage(element) → transferable ElementImage',
              lastCallReceipt: callReceipt('OffscreenCanvasRenderingContext2D.drawElementImage', 'ElementImage, dx, dy, dwidth, dheight', 'DOMMatrix'),
              uploadCount: diagnosticsRef.current.uploadCount + 1,
              transformSyncCount: diagnosticsRef.current.transformSyncCount + (transformChanged ? 1 : 0),
              elementImagesClosed: diagnosticsRef.current.elementImagesClosed + closedCount,
              elementImagesOutstanding: Math.max(0, diagnosticsRef.current.elementImagesOutstanding - closedCount),
              alignmentErrorPx: alignment.maxErrorPx,
              alignmentTolerancePx: alignment.tolerancePx,
              alignmentStatus: alignment.status,
              alignmentReceipt: alignment,
            };
            if (retirement.retire) {
              retireToFallback(
                'Worker pixels returned without a complete close and alignment receipt; the task-safe fallback is active.',
                retirement.lastError ?? 'worker-receipt-incomplete',
                retirement.failure,
                receiptPatch,
              );
              return;
            }
            updateDiagnostics({
              ...receiptPatch,
              ready: true,
              failure: 'none',
              reason: 'ElementImage transferred, drawn, explicitly closed in the worker, and synchronized to the drawing coordinate.',
              lastError: null,
            });
          }
        }
        if (event.data.type === 'error') {
          const closedCount = event.data.closed && event.data.sequence != null && inFlightSequences.delete(event.data.sequence) ? 1 : 0;
          updateDiagnostics({
            elementImagesClosed: diagnosticsRef.current.elementImagesClosed + closedCount,
            elementImagesOutstanding: Math.max(0, diagnosticsRef.current.elementImagesOutstanding - closedCount),
          });
          retireToFallback(
            'Worker composition failed after a native paint request; the task-safe DOM fallback is active.',
            event.data.message ?? 'worker error',
          );
          return;
        }
        if (queued && !retired) {
          queued = false;
          queueMicrotask(() => requestRef.current?.());
        }
      };
      onError = (event: ErrorEvent) => onWorkerFailure('worker-error', event.message || 'Worker error event.');
      onMessageError = () => onWorkerFailure('worker-messageerror', 'Worker message could not be deserialized.');
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      worker.addEventListener('messageerror', onMessageError);
      lifecycle = installPaintLifecycle(canvas, (event) => {
        if (retired || inFlight) {
          if (!retired) queued = true;
          return;
        }
        const started = performance.now();
        let image: ElementImageLike | null = null;
        try {
          if (typeof canvas.captureElementImage !== 'function') throw new DOMException('captureElementImage is unavailable.', 'NotSupportedError');
          image = canvas.captureElementImage(source);
          const placement = bindingRef.current.placement;
          sequence += 1;
          inFlight = true;
          worker?.postMessage({ type: 'paint', sequence, image, placement }, [image as unknown as Transferable]);
          armWatchdog(sequence);
          image = null;
          inFlightSequences.add(sequence);
          const paintReceipt = currentPaintReceipt(diagnosticsRef.current, event, started);
          updateDiagnostics({
            paintCount: diagnosticsRef.current.paintCount + 1,
            ...paintReceipt,
            snapshotPhase: 'current',
            apiSignature: 'captureElementImage(element) → transferable ElementImage',
            lastCallReceipt: callReceipt('HTMLCanvasElement.captureElementImage', 'element', 'ElementImage'),
            elementImagesCaptured: diagnosticsRef.current.elementImagesCaptured + 1,
            elementImagesTransferred: diagnosticsRef.current.elementImagesTransferred + 1,
            elementImagesOutstanding: diagnosticsRef.current.elementImagesOutstanding + 1,
            lastPaintMs: performance.now() - started,
          });
        } catch (error) {
          const closed = image ? closeElementImageOnce(image) : false;
          inFlight = false;
          retireToFallback(
            'ElementImage capture failed; the task-safe DOM fallback is active.',
            error instanceof Error ? error.message : String(error),
            classifyHtmlCanvasError(error),
            {
            reason: 'ElementImage capture failed; the DOM fallback remains available.',
            elementImagesClosed: diagnosticsRef.current.elementImagesClosed + (closed ? 1 : 0),
            },
          );
        }
      }, () => updateDiagnostics({ requestPaintCount: diagnosticsRef.current.requestPaintCount + 1 }), source);
      requestRef.current = () => {
        try {
          const requestStrategy = lifecycle?.request();
          if (requestStrategy && diagnosticsRef.current.requestStrategy !== requestStrategy) updateDiagnostics({ requestStrategy });
        } catch (error) {
          retireToFallback(
            'Worker paint scheduling failed; the task-safe DOM fallback is active.',
            error instanceof Error ? error.message : String(error),
            classifyHtmlCanvasError(error),
          );
        }
      };

      const initialRect = canvas.getBoundingClientRect();
      const initialDpr = Math.min(window.devicePixelRatio || 1, initialRect.width < 620 ? 1.5 : 2);
      worker.postMessage({
        type: 'resize',
        width: Math.max(1, Math.round(initialRect.width * initialDpr)),
        height: Math.max(1, Math.round(initialRect.height * initialDpr)),
        dpr: initialDpr,
      });

      observer = new ResizeObserver(([entry]) => {
        const dpr = Math.min(window.devicePixelRatio || 1, entry.contentRect.width < 620 ? 1.5 : 2);
        worker?.postMessage({
          type: 'resize',
          width: Math.max(1, Math.round(entry.contentRect.width * dpr)),
          height: Math.max(1, Math.round(entry.contentRect.height * dpr)),
          dpr,
        });
        requestRef.current?.();
      });
      observer.observe(canvas);
      requestRef.current();
    } catch (error) {
      retireToFallback(
        'Worker lane initialization failed; the DOM fallback remains the authoritative surface.',
        error instanceof Error ? error.message : String(error),
        classifyHtmlCanvasError(error),
      );
    }

    return () => {
      disposed = true;
      lifecycle?.dispose();
      observer?.disconnect();
      requestRef.current = null;
      retired = true;
      clearWatchdog();
      requestWorkerRetirement(false);
    };
  }, [demo.id, interactive, onDiagnostics]);

  useEffect(() => {
    if (interactive) {
      requestRef.current?.();
    }
  }, [binding.anchor.x, binding.anchor.y, binding.placement.height, binding.placement.width, diagnostics.scopeId, interactive, requestPaintToken, state]);

  return (
    <canvas
      ref={canvasRef}
      className={`experimental-worker-surface ${native ? 'native-active' : 'fallback-active'}`}
      aria-label={native ? `${demo.shortTitle} worker HTML 스냅샷 장면` : `${demo.shortTitle} worker 대체 장면`}
      {...({ layoutsubtree: '' } as Record<string, string>)}
    >
      {interactive && (
        <SemanticDomainSurface
          ref={sourceRef}
          demo={demo}
          state={state}
          runtime={runtime}
          binding={binding}
          mode={mode}
          diagnostics={diagnostics}
          variant="native-source"
          onControlChange={onControlChange}
          onAction={onAction}
        />
      )}
    </canvas>
  );
}
