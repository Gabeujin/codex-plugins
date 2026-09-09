import { useEffect, useRef } from 'react';
import { SemanticDomainSurface } from '../surface/SemanticDomainSurface';
import {
  callReceipt,
  classifyHtmlCanvasError,
  configureLayoutSubtree,
  currentPaintReceipt,
  drawElementImage2D,
  installPaintLifecycle,
  measureCanvas2dAlignment,
  type ExperimentalCanvas2DContext,
  type HtmlCanvasMode,
  type HtmlSurfaceDiagnostics,
} from '../runtime/htmlInCanvas';
import type { SurfaceBinding } from '../runtime/surfaceBindings';
import type { DemoDefinition, DemoState, SceneRuntimeState } from '../types';
import { buildCanvas2dCompositePlan, type CompositeClip, type CompositeForeground, type HtmlCompositeFragment } from './canvas2dCompositePlan';

type Canvas2dSurfaceProps = {
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

function clipCompositeFragment(context: CanvasRenderingContext2D, clip: CompositeClip) {
  context.beginPath();
  if (clip.kind === 'circle') {
    context.arc(clip.x, clip.y, clip.radius, 0, Math.PI * 2);
  } else if (clip.kind === 'round-rect') {
    context.roundRect(clip.x, clip.y, clip.width, clip.height, clip.radius);
  } else {
    const points = clip.points;
    const half = clip.width / 2;
    const offsetPoint = (point: { x: number; y: number }, index: number, side: 1 | -1) => {
      const previous = points[Math.max(0, index - 1)];
      const next = points[Math.min(points.length - 1, index + 1)];
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      return { x: point.x - dy / length * half * side, y: point.y + dx / length * half * side };
    };
    points.forEach((point, index) => {
      const edge = offsetPoint(point, index, 1);
      if (index === 0) context.moveTo(edge.x, edge.y);
      else context.lineTo(edge.x, edge.y);
    });
    [...points].reverse().forEach((point, reverseIndex) => {
      const index = points.length - reverseIndex - 1;
      const edge = offsetPoint(point, index, -1);
      context.lineTo(edge.x, edge.y);
    });
    context.closePath();
  }
  context.clip();
}

function drawCompositeFragment(
  context: ExperimentalCanvas2DContext,
  source: HTMLElement,
  fragment: HtmlCompositeFragment,
) {
  context.save();
  clipCompositeFragment(context, fragment.clip);
  context.globalAlpha = fragment.alpha;
  context.filter = fragment.filter;
  drawElementImage2D(context, source, fragment.placement, false);
  context.restore();
}

function drawCompositeForeground(context: CanvasRenderingContext2D, foreground: CompositeForeground) {
  const { anchorX: x, anchorY: y, extent, color, active } = foreground;
  context.save();
  context.globalAlpha = active ? .96 : .68;
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = active ? 3 : 2;
  context.setLineDash(active ? [] : [8, 7]);

  if (foreground.kind === 'constellation') {
    for (let index = 0; index < 3; index += 1) {
      const angle = -2.35 + index * .86;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(angle) * extent * (1.35 + index * .18), y + Math.sin(angle) * extent * (1.02 + index * .12));
      context.stroke();
    }
    context.beginPath(); context.arc(x, y, active ? 14 : 9, 0, Math.PI * 2); context.stroke();
  } else if (foreground.kind === 'portal') {
    context.beginPath(); context.arc(x, y, extent, 0, Math.PI * 2); context.stroke();
    context.beginPath(); context.arc(x, y, extent * .76, 0, Math.PI * 2); context.stroke();
    for (let index = 0; index < 12; index += 1) {
      const angle = index * Math.PI / 6;
      context.beginPath();
      context.moveTo(x + Math.cos(angle) * extent * .78, y + Math.sin(angle) * extent * .78);
      context.lineTo(x + Math.cos(angle) * extent, y + Math.sin(angle) * extent);
      context.stroke();
    }
  } else if (foreground.kind === 'route') {
    context.beginPath();
    context.moveTo(x - extent * 1.5, y + extent * .56);
    context.bezierCurveTo(x - extent * .72, y - extent, x + extent * .5, y + extent, x + extent * 1.5, y - extent * .55);
    context.stroke();
    context.beginPath(); context.arc(x, y, active ? 11 : 7, 0, Math.PI * 2); context.fill();
  } else if (foreground.kind === 'contract') {
    context.beginPath();
    context.moveTo(x + extent * .62, y - extent * .12);
    context.lineTo(x + extent * 1.38, y - extent * .72);
    context.lineTo(x + extent * 1.88, y - extent * .4);
    context.moveTo(x + extent * .62, y + extent * .12);
    context.lineTo(x + extent * 1.44, y + extent * .64);
    context.stroke();
    if (!active) {
      context.beginPath();
      context.moveTo(x + extent * .78, y - extent * .28);
      context.lineTo(x + extent * 1.02, y + extent * .28);
      context.moveTo(x + extent * 1.02, y - extent * .28);
      context.lineTo(x + extent * .78, y + extent * .28);
      context.stroke();
    }
  } else if (foreground.kind === 'brush') {
    const halfHeight = (foreground.crossExtent ?? 232) / 2;
    context.strokeRect(x - extent / 2, y - halfHeight, extent, halfHeight * 2);
    context.beginPath();
    context.moveTo(x - extent / 2, y - halfHeight - 12); context.lineTo(x - extent / 2, y + halfHeight + 12);
    context.moveTo(x + extent / 2, y - halfHeight - 12); context.lineTo(x + extent / 2, y + halfHeight + 12);
    context.stroke();
  } else {
    context.beginPath();
    context.ellipse(x, y, extent * 1.45, extent * .58, -.28, 0, Math.PI * 2);
    context.stroke();
    context.beginPath(); context.arc(x, y, active ? 10 : 6, 0, Math.PI * 2); context.fill();
  }
  context.restore();
}

export function Canvas2dSurface({
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
}: Canvas2dSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLElement>(null);
  const requestRef = useRef<(() => void) | null>(null);
  const diagnosticsRef = useRef(diagnostics);
  const bindingRef = useRef(binding);
  const stateRef = useRef(state);
  const runtimeRef = useRef(runtime);
  diagnosticsRef.current = diagnostics;
  bindingRef.current = binding;
  stateRef.current = state;
  runtimeRef.current = runtime;
  const native = mode === 'native-2d';
  const interactive = native && binding.visible && !binding.occluded;

  useEffect(() => {
    const canvas = canvasRef.current;
    const source = sourceRef.current;
    if (!canvas || !source || !interactive) return;
    configureLayoutSubtree(canvas);
    const context = canvas.getContext('2d', { alpha: true }) as ExperimentalCanvas2DContext | null;
    if (!context) {
      onDiagnostics({
        ...diagnosticsRef.current,
        ready: false,
        failure: 'context-or-device-lost',
        reason: 'Canvas 2D context creation failed; the semantic DOM fallback is active.',
        lastError: 'canvas-2d-context-unavailable',
      });
      return;
    }
    let dpr = window.devicePixelRatio || 1;
    let observer: ResizeObserver | null = null;
    let lastTransformGeometry = '';
    const updateDiagnostics = (patch: Partial<HtmlSurfaceDiagnostics>) => {
      const next = { ...diagnosticsRef.current, ...patch };
      diagnosticsRef.current = next;
      onDiagnostics(next);
    };

    const lifecycle = installPaintLifecycle(canvas, (event) => {
      const started = performance.now();
      try {
        const rect = canvas.getBoundingClientRect();
        const placement = bindingRef.current.placement;
        const plan = buildCanvas2dCompositePlan(demo.id, stateRef.current, runtimeRef.current, bindingRef.current);
        context.reset?.();
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, rect.width, rect.height);
        const transformGeometry = [
          canvas.width, canvas.height, source.offsetWidth, source.offsetHeight,
          placement.x, placement.y, placement.width, placement.height,
        ].join(':');
        const transformChanged = transformGeometry !== lastTransformGeometry;
        if (transformChanged && source.style.transform) {
          // The prototype's returned matrix can be relative to the element's
          // current transform on narrow/resized viewports. Reset only when the
          // primary placement changes so matrices cannot compound across
          // anchor-only fragment paints (WICG issues #149/#151).
          source.style.transform = 'none';
          void source.offsetWidth;
        }
        plan.fragments.forEach((fragment) => drawCompositeFragment(context, source, fragment));
        drawElementImage2D(context, source, placement, transformChanged);
        drawCompositeForeground(context, plan.foreground);
        if (transformChanged) lastTransformGeometry = transformGeometry;
        const alignment = measureCanvas2dAlignment(canvas, source, placement);
        const paintReceipt = currentPaintReceipt(diagnosticsRef.current, event, started);
        updateDiagnostics({
          ready: alignment.status === 'pass' && plan.fragments.length > 0,
          failure: alignment.status === 'pass' && plan.fragments.length > 0 ? 'none' : alignment.status === 'pass' ? 'upload-failed' : 'alignment-drift',
          reason: alignment.status === 'pass' && plan.fragments.length > 0
            ? `${plan.claim} Primary returned DOMMatrix and hit-target alignment passed; clipped fragments remain decorative.`
            : `Canvas 2D pixels and the DOM hit target drifted by ${alignment.maxErrorPx.toFixed(2)} px; semantic fallback is active.`,
          primitive: 'CanvasRenderingContext2D.drawElementImage(element, dx, dy, dwidth, dheight)',
          apiSignature: 'drawElementImage(element, dx, dy, dwidth, dheight)',
          lastCallReceipt: callReceipt('CanvasRenderingContext2D.drawElementImage', 'element, dx, dy, dwidth, dheight', 'DOMMatrix'),
          paintCount: diagnosticsRef.current.paintCount + 1,
          uploadCount: diagnosticsRef.current.uploadCount + plan.fragments.length + 1,
          transformSyncCount: diagnosticsRef.current.transformSyncCount + (transformChanged ? 1 : 0),
          ...paintReceipt,
          alignmentErrorPx: alignment.maxErrorPx,
          alignmentTolerancePx: alignment.tolerancePx,
          alignmentStatus: alignment.status,
          alignmentReceipt: alignment,
          compositePlanId: plan.id,
          compositeOperationCount: plan.fragments.length + 2,
          compositionRevision: plan.revision,
          compositionStatus: plan.fragments.length > 0 ? 'pass' : 'fail',
          lastPaintMs: performance.now() - started,
          lastError: null,
        });
      } catch (error) {
        updateDiagnostics({
          ready: false,
          failure: classifyHtmlCanvasError(error),
          reason: 'Canvas 2D HTML paint failed; the semantic DOM fallback remains available.',
          lastError: error instanceof Error ? error.message : String(error),
        });
      }
    }, () => updateDiagnostics({ requestPaintCount: diagnosticsRef.current.requestPaintCount + 1 }), source);
    requestRef.current = () => {
      try {
        const requestStrategy = lifecycle.request();
        if (diagnosticsRef.current.requestStrategy !== requestStrategy) updateDiagnostics({ requestStrategy });
      } catch (error) {
        updateDiagnostics({
          ready: false,
          failure: classifyHtmlCanvasError(error),
          reason: 'Canvas 2D paint scheduling failed; the semantic DOM fallback is active.',
          lastError: error instanceof Error ? error.message : String(error),
        });
      }
    };

    const initialRect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, initialRect.width < 620 ? 1.5 : 2);
    canvas.width = Math.max(1, Math.round(initialRect.width * dpr));
    canvas.height = Math.max(1, Math.round(initialRect.height * dpr));

    observer = new ResizeObserver(([entry]) => {
      dpr = Math.min(window.devicePixelRatio || 1, entry.contentRect.width < 620 ? 1.5 : 2);
      const width = Math.round(entry.contentRect.width * dpr);
      const height = Math.round(entry.contentRect.height * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
      }
      requestRef.current?.();
    });
    const supportsDevicePixels =
      typeof ResizeObserverEntry !== 'undefined' &&
      'devicePixelContentBoxSize' in ResizeObserverEntry.prototype;
    observer.observe(canvas, supportsDevicePixels ? { box: 'device-pixel-content-box' } : undefined);
    requestRef.current();

    return () => {
      lifecycle.dispose();
      observer?.disconnect();
      requestRef.current = null;
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
      className={`experimental-2d-surface ${native ? 'native-active' : 'fallback-active'}`}
      data-compositor="scene-html-fragments"
      aria-label={native ? `${demo.shortTitle} Canvas 2D HTML 합성 장면` : `${demo.shortTitle} Canvas 2D 대체 장면`}
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
