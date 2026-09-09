import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { DEMOS, DEMO_BY_ID, createInitialState, demoFromHash } from './catalog';
import { Canvas2dSurface } from './scene/Canvas2dSurface';
import { WebGLSurface } from './scene/WebGLSurface';
import { WebGpuSurface } from './scene/WebGpuSurface';
import { WorkerSurface } from './scene/WorkerSurface';
import { drawScene } from './scene/drawScene';
import { SemanticDomainSurface } from './surface/SemanticDomainSurface';
import { SurfacePipelineHud } from './surface/SurfacePipelineHud';
import { liveMetricValue } from './runtime/demoMetrics';
import { formatQuantity } from './runtime/format';
import {
  createSurfaceDiagnostics,
  detectHtmlCanvasCapabilities,
  HTML_CANVAS_EXPERIMENT_LABEL,
  probeWebGpuCopyCapability,
  resolveHtmlCanvasMode,
  type HtmlCanvasCapabilities,
  type HtmlCanvasMode,
  type HtmlCanvasRequest,
  type HtmlSurfaceDiagnostics,
} from './runtime/htmlInCanvas';
import { DOMAIN_SURFACES, laneDisplayName } from './runtime/surfaceCatalog';
import { resolveSurfaceBinding, surfaceOwnedControlKeys, type SurfaceBinding } from './runtime/surfaceBindings';
import { createPointerState, nextScienceAttempts, updatePointerState, zoomAfterWheel } from './runtime/interactionContracts';
import { applySceneKeyboardCommand, SCENE_KEYBOARD_HELP } from './runtime/sceneKeyboard';
import { applyResponsiveTransformGuard, initialSceneSize, isResponsiveTransformGuardActive, shouldShowSemanticFallback } from './runtime/responsiveTransformGuard';
import type { ControlDefinition, DemoDefinition, DemoId, DemoState, PointerState, SceneRuntimeState, SceneTelemetry } from './types';

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function percentile(values: readonly number[], ratio: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function Icon({ value }: { value: string }) {
  return <span className="nav-icon" aria-hidden="true">{value}</span>;
}

type SceneCanvasProps = {
  demo: DemoDefinition;
  state: DemoState;
  runtime: SceneRuntimeState;
  resetToken: number;
  surfaceMode: HtmlCanvasMode;
  fallbackReason: string;
  diagnostics: HtmlSurfaceDiagnostics;
  capabilities: HtmlCanvasCapabilities;
  binding: SurfaceBinding;
  requestPaintToken: number;
  evidenceOpen: boolean;
  onTelemetry: (telemetry: SceneTelemetry) => void;
  onDomainRuntime: (id: DemoId, runtime: SceneRuntimeState) => void;
  onControlChange: (key: string, value: string | number | boolean) => void;
  onAction: (key: string) => void;
  onDiagnostics: (diagnostics: HtmlSurfaceDiagnostics) => void;
  onRequestPaint: () => void;
  onCloseEvidence: () => void;
  onOpenControls: () => void;
};

function SceneCanvas({
  demo,
  state,
  runtime,
  resetToken,
  surfaceMode,
  fallbackReason,
  diagnostics,
  capabilities,
  binding,
  requestPaintToken,
  evidenceOpen,
  onTelemetry,
  onDomainRuntime,
  onControlChange,
  onAction,
  onDiagnostics,
  onRequestPaint,
  onCloseEvidence,
  onOpenControls,
}: SceneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const stateRef = useRef(state);
  const runtimeRef = useRef(runtime);
  const pointerRef = useRef<PointerState>(createPointerState());
  const modelRef = useRef<SceneRuntimeState>({ ...runtime });
  const [taskPanelHidden, setTaskPanelHidden] = useState(false);
  const reducedMotion = useReducedMotion();
  const definition = DOMAIN_SURFACES[demo.id];
  stateRef.current = state;
  runtimeRef.current = runtime;

  useEffect(() => {
    modelRef.current = { ...runtimeRef.current };
  }, [demo.id, resetToken]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!context) return;
    let previous = performance.now();
    let lastReport = previous;
    let lastRuntimeReport = previous;
    let rollingFps = 60;
    const frameSamples: number[] = [];
    const rawFrameSamples: number[] = [];
    let longTaskCount = 0;
    let longTaskTotalMs = 0;
    let longTaskMaxMs = 0;
    const longTaskObserver = typeof PerformanceObserver === 'function' && PerformanceObserver.supportedEntryTypes.includes('longtask')
      ? new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          longTaskCount += 1;
          longTaskTotalMs += entry.duration;
          longTaskMaxMs = Math.max(longTaskMaxMs, entry.duration);
        });
      })
      : null;
    longTaskObserver?.observe({ type: 'longtask', buffered: true });

    const render = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      const mobile = rect.width < 620;
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
      const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
      const pixelHeight = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const pointer = pointerRef.current;
      drawScene({
        id: demo.id,
        ctx: context,
        width: rect.width,
        height: rect.height,
        time: now,
        state: stateRef.current,
        pointer,
        reducedMotion,
        model: modelRef.current,
      });

      const delta = Math.max(1, now - previous);
      rawFrameSamples.push(delta);
      if (rawFrameSamples.length > 300) rawFrameSamples.shift();
      if (delta < 250) {
        rollingFps = rollingFps * .88 + (1000 / delta) * .12;
        frameSamples.push(delta);
        if (frameSamples.length > 300) frameSamples.shift();
      }
      previous = now;
      pointer.dragX = 0;
      pointer.dragY = 0;
      pointer.pressed = false;
      pointer.released = false;

      if (now - lastRuntimeReport > 240) {
        onDomainRuntime(demo.id, { ...modelRef.current });
        lastRuntimeReport = now;
      }
      if (now - lastReport > 650) {
        const frameMs = frameSamples.length
          ? frameSamples.reduce((sum, sample) => sum + sample, 0) / frameSamples.length
          : delta;
        const heap = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize;
        onTelemetry({
          fps: Math.min(120, rollingFps),
          frameMs,
          dpr,
          width: rect.width,
          height: rect.height,
          renderer: demo.renderer,
          frameSampleCount: frameSamples.length,
          frameP50Ms: percentile(frameSamples, .5),
          frameP95Ms: percentile(frameSamples, .95),
          frameP99Ms: percentile(frameSamples, .99),
          frameMaxMs: Math.max(0, ...frameSamples),
          droppedFrameRatio: frameSamples.length ? frameSamples.filter((sample) => sample > 25).length / frameSamples.length : 0,
          rawFrameSampleCount: rawFrameSamples.length,
          rawFrameP95Ms: percentile(rawFrameSamples, .95),
          rawFrameMaxMs: Math.max(0, ...rawFrameSamples),
          suspensionGapCount: rawFrameSamples.filter((sample) => sample >= 250).length,
          longTaskCount,
          longTaskTotalMs,
          longTaskMaxMs,
          jsHeapUsedBytes: typeof heap === 'number' ? heap : null,
        });
        lastReport = now;
      }
      frameRef.current = requestAnimationFrame(render);
    };
    frameRef.current = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frameRef.current);
      longTaskObserver?.disconnect();
    };
  }, [demo.id, demo.renderer, onDomainRuntime, onTelemetry, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, button, [contenteditable="true"]')) return;
      const outcome = applySceneKeyboardCommand({
        id: demo.id,
        key: event.key,
        shiftKey: event.shiftKey,
        model: modelRef.current,
        state: stateRef.current,
        width: canvas.clientWidth,
        height: canvas.clientHeight,
      });
      if (!outcome.handled) return;
      outcome.changes.forEach((change) => onControlChange(change.key, change.value));
      if (outcome.action) onAction(outcome.action);
      event.preventDefault();
    };
    canvas.addEventListener('keydown', onKey);
    return () => canvas.removeEventListener('keydown', onKey);
  }, [demo.id, onAction, onControlChange]);

  const updatePointer = (event: React.PointerEvent<HTMLCanvasElement>, down?: boolean) => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current = updatePointerState(
      pointerRef.current,
      event.clientX - rect.left,
      event.clientY - rect.top,
      down,
    );
  };

  const onWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    if (event.target !== event.currentTarget || demo.id !== 'map') return;
    event.preventDefault();
    onControlChange('zoom', zoomAfterWheel(Number(stateRef.current.zoom ?? 100), event.deltaY));
  };

  const surfaceProps = {
    demo,
    state,
    runtime,
    binding,
    mode: surfaceMode,
    diagnostics,
    requestPaintToken,
    onControlChange,
    onAction,
    onDiagnostics,
  };
  const nativeProofUnsettled = shouldShowSemanticFallback(surfaceMode, diagnostics.ready, diagnostics.snapshotPhase, diagnostics.failure);
  // During capability/first-paint verification the ordinary DOM companion keeps
  // the task usable. Once the native snapshot is current, the canvas child
  // itself owns focus, hit testing, selection, scrolling, and form controls as
  // required by layoutsubtree; keeping a second overlay would only test DOM.
  const interactiveSurfaceVisible = surfaceMode === 'dom-overlay' || nativeProofUnsettled;
  const interactiveSurfaceVariant = surfaceMode === 'dom-overlay' ? 'fallback-overlay' : 'companion-overlay';
  const fallbackStyle = {
    '--binding-x': `${binding.placement.x}px`,
    '--binding-y': `${binding.placement.y}px`,
    '--binding-w': `${binding.placement.width}px`,
    '--binding-h': `${binding.placement.height}px`,
    '--anchor-x': `${binding.anchor.x}px`,
    '--anchor-y': `${binding.anchor.y}px`,
  } as CSSProperties;

  return (
    <div className="scene-stack" data-domain={demo.id} data-lane={definition.lane} data-surface-occluded={String(binding.occluded)}>
      <canvas
        ref={canvasRef}
        className="scene-canvas"
        tabIndex={0}
        role="region"
        aria-label={`${demo.title}. ${demo.instruction}`}
        aria-describedby={`scene-help-${demo.id}`}
        onPointerDown={(event) => { event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); updatePointer(event, true); }}
        onPointerMove={(event) => updatePointer(event)}
        onPointerUp={(event) => updatePointer(event, false)}
        onPointerCancel={(event) => updatePointer(event, false)}
        onWheel={onWheel}
      >{demo.description}</canvas>
      <span id={`scene-help-${demo.id}`} className="sr-only">장면에 포커스를 둔 뒤 포인터 또는 키보드로 조작하세요. {SCENE_KEYBOARD_HELP[demo.id]}</span>
      {(demo.id === 'commerce' || demo.id === 'spatial') && (
        <div className="orbit-views" role="toolbar" aria-label="객체 관찰 방향">
          <span>드래그로 회전 · 정면에서 HTML 편집</span>
          <button className="mobile-task-toggle" type="button" aria-expanded={!taskPanelHidden} onClick={() => setTaskPanelHidden((value) => !value)}>{taskPanelHidden ? '폼 열기' : '폼 숨김'}</button>
          {([['정면', 0, 0], ['좌측', -Math.PI/2, 0], ['후면', Math.PI, 0], ['우측', Math.PI/2, 0], ['위에서', 0, 1.4]] as const).map(([label, yaw, pitch]) => <button type="button" key={label} onClick={() => {
            if (demo.id === 'commerce') { modelRef.current.productRotation = yaw; modelRef.current.productPitch = pitch; }
            else { modelRef.current.orbit = yaw; modelRef.current.orbitPitch = pitch; }
            onRequestPaint();
          }}>{label}</button>)}
        </div>
      )}

      {definition.lane === 'canvas-2d' && <Canvas2dSurface {...surfaceProps} />}
      {definition.lane === 'webgl' && <WebGLSurface {...surfaceProps} sceneModelRef={modelRef} reducedMotion={reducedMotion} />}
      {definition.lane === 'webgpu' && <WebGpuSurface {...surfaceProps} reducedMotion={reducedMotion} />}
      {definition.lane === 'worker' && <WorkerSurface key={`${demo.id}-${surfaceMode}`} {...surfaceProps} />}

      {interactiveSurfaceVisible && binding.visible && !binding.occluded && (
        <div
          data-mobile-hidden={taskPanelHidden ? 'true' : undefined}
          className={`surface-host fallback-surface-position ${surfaceMode.startsWith('native-') ? 'surface-host--companion' : 'surface-host--fallback'} ${nativeProofUnsettled ? 'surface-host--proof-pending' : 'surface-host--proof-current'} ${binding.docked ? 'surface-host--docked' : ''} ${Boolean(state.sheetExpanded) ? 'surface-host--expanded' : ''}`}
          data-surface-id={binding.surfaceId}
          data-object-id={binding.objectId}
          data-task-surface-host="interactive-companion"
          data-native-proof-state={surfaceMode.startsWith('native-') ? nativeProofUnsettled ? 'pending-or-failed' : 'current' : 'not-applicable'}
          style={fallbackStyle}
        >
          <SemanticDomainSurface
            demo={demo}
            state={state}
            runtime={runtime}
            binding={binding}
            mode={surfaceMode}
            variant={interactiveSurfaceVariant}
            diagnostics={diagnostics}
            fallbackReason={fallbackReason}
            onControlChange={onControlChange}
            onAction={onAction}
          />
        </div>
      )}

      {binding.visible && binding.occluded && (
        <div className="occlusion-recovery" role="status" aria-live="polite">
          <span>선택 객체 뒤로 HTML 표면이 이동했습니다.</span>
          <button type="button" onClick={() => onAction('revealSurface')}>표면 다시 보기</button>
        </div>
      )}

      <SurfacePipelineHud
        capabilities={capabilities}
        diagnostics={diagnostics}
        definition={definition}
        onRequestPaint={onRequestPaint}
        open={evidenceOpen}
        onClose={onCloseEvidence}
      />
      <div className="binding-tether" aria-hidden="true" style={fallbackStyle}><i /><span>{binding.objectId}</span></div>
      <div className="scene-tool-rail" role="toolbar" aria-label="장면 도구">
        <button type="button" title="장면 선택" onClick={() => canvasRef.current?.focus()} aria-label="장면 선택 도구">↖</button>
        <button type="button" title="컨트롤" onClick={onOpenControls} aria-label="도메인 컨트롤 열기">≛</button>
        <button type="button" title="현재 Paint 요청" onClick={onRequestPaint} aria-label="현재 Paint 요청">◌</button>
        <span>{laneDisplayName(definition.lane)}</span>
      </div>
    </div>
  );
}

function Control({
  control,
  value,
  onChange,
  onAction,
}: {
  control: ControlDefinition;
  value: unknown;
  onChange: (key: string, value: string | number | boolean) => void;
  onAction: (key: string) => void;
}) {
  if (control.type === 'range') {
    return (
      <label className="control-row">
        <span>{control.label}</span>
        <input aria-label={control.label} type="range" min={control.min} max={control.max} step={control.step} value={Number(value)} onChange={(event) => onChange(control.key, Number(event.currentTarget.value))} />
        <output>{formatQuantity(Number(value))}{control.suffix}</output>
      </label>
    );
  }
  if (control.type === 'select') {
    if (control.key === 'material') {
      return (
        <fieldset className="material-control">
          <legend>{control.label}</legend>
          <div>
            {control.options.map((option) => (
              <label key={option} data-material={option}>
                <input type="radio" name="material" value={option} checked={String(value) === option} onChange={() => onChange(control.key, option)} />
                <i aria-hidden="true" />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </fieldset>
      );
    }
    return (
      <label className="select-control">
        <span>{control.label}</span>
        <select value={String(value)} onChange={(event) => onChange(control.key, event.currentTarget.value)}>{control.options.map((option) => <option key={option}>{option}</option>)}</select>
      </label>
    );
  }
  if (control.type === 'toggle') {
    return (
      <label className="toggle-control">
        <span><strong>{control.label}</strong><small>{Boolean(value) ? '활성화됨' : '비활성화됨'}</small></span>
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(control.key, event.currentTarget.checked)} />
        <i aria-hidden="true" />
      </label>
    );
  }
  return <button type="button" className="action-control" onClick={() => onAction(control.key)}>{control.label}<span aria-hidden="true">↗</span></button>;
}

function CapabilityMatrix({ capabilities }: { capabilities: HtmlCanvasCapabilities }) {
  const rows = [
    ['layoutSubtree', capabilities.layoutSubtree],
    ['paint event', capabilities.paintEvent],
    ['requestPaint', capabilities.requestPaint],
    ['drawElementImage', capabilities.drawElementImage2D],
    ['texElementImage2D', capabilities.texElementImage2D],
    ['copyElementImageToTexture', capabilities.copyElementImageToTexture],
    ['captureElementImage', capabilities.captureElementImage],
    ['getElementTransform', capabilities.getElementTransform],
  ] as const;
  return (
    <details className="capability-matrix">
      <summary>브라우저 원시 IDL 감지 매트릭스</summary>
      <div>
        {rows.map(([name, supported]) => {
          const state = supported === true || supported === 'supported' ? 'supported' : supported === 'unknown' ? 'unknown' : 'unsupported';
          return <p key={name}><code>{name}</code><span className={state}>{state === 'supported' ? 'IDL 감지됨' : state === 'unknown' ? '실행 확인 중' : 'IDL 미감지'}</span></p>;
        })}
      </div>
      <small title={capabilities.userAgent}>{capabilities.userAgent}</small>
    </details>
  );
}

function AccessibleDetails({
  demo,
  state,
  runtime,
  telemetry,
  diagnostics,
}: {
  demo: DemoDefinition;
  state: DemoState;
  runtime: SceneRuntimeState;
  telemetry: SceneTelemetry;
  diagnostics: HtmlSurfaceDiagnostics;
}) {
  return (
    <details className="accessible-details">
      <summary id="accessible-details" tabIndex={-1}>접근 가능한 데이터와 실행 영수증</summary>
      <div>
        <p>{demo.description} 그래픽 합성 여부와 무관하게 아래 상태와 모든 컨트롤은 실제 DOM에서 유지됩니다.</p>
        <table>
          <caption>{demo.shortTitle} 현재 상태</caption>
          <tbody>
            {demo.metrics.map((metric, index) => <tr key={metric.label}><th scope="row">{metric.label}</th><td>{liveMetricValue(demo, state, runtime, telemetry, index)}</td></tr>)}
            {Object.entries(state).map(([key, value]) => <tr key={key}><th scope="row">{key}</th><td>{typeof value === 'boolean' ? (value ? '켜짐' : '꺼짐') : String(value)}</td></tr>)}
            {Object.entries(runtime).filter(([, value]) => Number.isFinite(value)).slice(0, 8).map(([key, value]) => <tr key={`runtime-${key}`}><th scope="row">runtime.{key}</th><td>{formatQuantity(value)}</td></tr>)}
          </tbody>
        </table>
        <dl className="receipt-list">
          <div><dt>선택 lane</dt><dd>{diagnostics.lane}</dd></div>
          <div><dt>실행 mode</dt><dd>{diagnostics.mode}</dd></div>
          <div><dt>원시 API</dt><dd>{diagnostics.primitive}</dd></div>
          <div><dt>paint / upload / sync</dt><dd>{formatQuantity(diagnostics.paintCount)} / {formatQuantity(diagnostics.uploadCount)} / {formatQuantity(diagnostics.transformSyncCount)}</dd></div>
          <div><dt>snapshot</dt><dd>{diagnostics.snapshotPhase} · sequence {formatQuantity(diagnostics.paintSequence)} · changed {diagnostics.lastChangedElementIds.join(', ') || 'none/manual'}</dd></div>
          <div><dt>정렬 오차</dt><dd>{diagnostics.alignmentErrorPx == null ? '측정 전' : `${diagnostics.alignmentErrorPx.toFixed(2)} px / 허용 ${diagnostics.alignmentTolerancePx.toFixed(0)} px · ${diagnostics.alignmentStatus}`}</dd></div>
          <div><dt>현재 IDL</dt><dd><code>{diagnostics.apiSignature}</code></dd></div>
          <div><dt>ElementImage 소유권</dt><dd>{formatQuantity(diagnostics.elementImagesCaptured)} captured · {formatQuantity(diagnostics.elementImagesTransferred)} transferred · {formatQuantity(diagnostics.elementImagesClosed)} closed · {formatQuantity(diagnostics.elementImagesTerminalReleased)} terminal release · {formatQuantity(diagnostics.elementImagesOutstanding)} outstanding</dd></div>
          <div><dt>최근 paint-upload-sync 비용</dt><dd>{diagnostics.lastPaintMs === null ? '측정 전' : `${diagnostics.lastPaintMs.toFixed(2)} ms`}</dd></div>
          <div><dt>프레임 분포</dt><dd>{formatQuantity(telemetry.frameSampleCount ?? 0)} samples · p50 {(telemetry.frameP50Ms ?? 0).toFixed(2)} ms · p95 {(telemetry.frameP95Ms ?? 0).toFixed(2)} ms · p99 {(telemetry.frameP99Ms ?? 0).toFixed(2)} ms</dd></div>
          <div><dt>브라우저 제어 중단 구간</dt><dd>{formatQuantity(telemetry.suspensionGapCount ?? 0)} / {formatQuantity(telemetry.rawFrameSampleCount ?? 0)} raw samples · raw p95 {(telemetry.rawFrameP95Ms ?? 0).toFixed(2)} ms</dd></div>
          <div><dt>Long task</dt><dd>{formatQuantity(telemetry.longTaskCount ?? 0)}회 · 합계 {(telemetry.longTaskTotalMs ?? 0).toFixed(2)} ms · 최대 {(telemetry.longTaskMaxMs ?? 0).toFixed(2)} ms</dd></div>
          <div><dt>JS heap</dt><dd>{telemetry.jsHeapUsedBytes == null ? '이 브라우저에서 비공개' : `${formatQuantity(telemetry.jsHeapUsedBytes)} bytes`}</dd></div>
          <div><dt>판정</dt><dd>{diagnostics.ready ? (diagnostics.mode === 'dom-overlay' ? '동일 작업 DOM 폴백 조작 가능' : `${diagnostics.mode} paint 영수증 확인 · 조작 가능`) : diagnostics.reason}</dd></div>
        </dl>
      </div>
    </details>
  );
}

export function App() {
  const [activeId, setActiveId] = useState<DemoId>(() => demoFromHash(location.hash));
  const [states, setStates] = useState<Record<DemoId, DemoState>>(() => Object.fromEntries(DEMOS.map((demo) => [demo.id, createInitialState(demo)])) as Record<DemoId, DemoState>);
  const [telemetry, setTelemetry] = useState<SceneTelemetry>({
    fps: 60,
    frameMs: 16.7,
    dpr: 1,
    width: 0,
    height: 0,
    renderer: 'Hybrid',
    frameSampleCount: 0,
    frameP50Ms: 0,
    frameP95Ms: 0,
    frameP99Ms: 0,
    frameMaxMs: 0,
    droppedFrameRatio: 0,
    rawFrameSampleCount: 0,
    rawFrameP95Ms: 0,
    rawFrameMaxMs: 0,
    suspensionGapCount: 0,
    longTaskCount: 0,
    longTaskTotalMs: 0,
    longTaskMaxMs: 0,
    jsHeapUsedBytes: null,
  });
  const [domainRuntime, setDomainRuntime] = useState<Record<DemoId, SceneRuntimeState>>(() => Object.fromEntries(DEMOS.map((item) => [item.id, {}])) as Record<DemoId, SceneRuntimeState>);
  const [resetToken, setResetToken] = useState(0);
  const [requestPaintToken, setRequestPaintToken] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [surfaceRequest, setSurfaceRequest] = useState<HtmlCanvasRequest>('auto');
  const [killSwitch, setKillSwitch] = useState(false);
  const [atlasOpen, setAtlasOpen] = useState(false);
  const [viewportSize, setViewportSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [capabilities, setCapabilities] = useState<HtmlCanvasCapabilities>(() => detectHtmlCanvasCapabilities());
  const atlasCloseRef = useRef<HTMLButtonElement>(null);
  const atlasDialogRef = useRef<HTMLDialogElement>(null);
  const demo = DEMO_BY_ID.get(activeId)!;
  const state = states[activeId];
  const surfaceDefinition = DOMAIN_SURFACES[activeId];
  const surfaceSuppressed = killSwitch || state.htmlSurface === false;
  const bootstrapSceneSize = initialSceneSize(viewportSize.width, viewportSize.height);
  const requestedSurfaceMode = useMemo(
    () => resolveHtmlCanvasMode(surfaceRequest, surfaceDefinition.lane, capabilities, surfaceSuppressed),
    [capabilities, surfaceDefinition.lane, surfaceRequest, surfaceSuppressed],
  );
  const surfaceMode = useMemo(
    () => applyResponsiveTransformGuard(requestedSurfaceMode, surfaceDefinition.lane, viewportSize.width),
    [requestedSurfaceMode, surfaceDefinition.lane, viewportSize.width],
  );
  const responsiveTransformGuard = isResponsiveTransformGuardActive(requestedSurfaceMode, surfaceMode);
  const surfaceBinding = useMemo(() => resolveSurfaceBinding(
    activeId,
    surfaceDefinition.lane,
    Math.max(280, telemetry.width || bootstrapSceneSize.width),
    Math.max(360, telemetry.height || bootstrapSceneSize.height),
    domainRuntime[activeId],
    state,
    surfaceMode,
  ), [activeId, bootstrapSceneSize.height, bootstrapSceneSize.width, domainRuntime, state, surfaceDefinition.lane, surfaceMode, telemetry.height, telemetry.width]);
  const diagnosticsIdentity = `${activeId}:${surfaceDefinition.lane}:${surfaceMode}:${surfaceSuppressed ? 'suppressed' : 'active'}`;
  const [diagnostics, setDiagnostics] = useState<HtmlSurfaceDiagnostics>(() =>
    createSurfaceDiagnostics(surfaceDefinition.lane, surfaceMode, capabilities, surfaceSuppressed, diagnosticsIdentity),
  );
  const fallbackReason = surfaceMode === 'dom-overlay'
    ? (responsiveTransformGuard ? 'responsive-transform-guard' : (diagnostics.failure === 'none' ? 'native-contract-unavailable' : diagnostics.failure))
    : surfaceMode.startsWith('native-') && diagnostics.failure !== 'none'
      ? diagnostics.failure
      : surfaceMode.startsWith('native-') && (!diagnostics.ready || diagnostics.snapshotPhase !== 'current')
        ? 'native-first-paint-pending'
        : 'none';
  const diagnosticsIdentityRef = useRef(diagnosticsIdentity);
  const activeDiagnosticsScopeRef = useRef(diagnosticsIdentity);
  activeDiagnosticsScopeRef.current = diagnosticsIdentity;

  useEffect(() => {
    const onResize = () => setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let active = true;
    void probeWebGpuCopyCapability(capabilities).then((next) => {
      if (active) setCapabilities(next);
    });
    return () => { active = false; };
    // Capability probing is intentionally one-shot per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setDiagnostics((current) => {
      const sameIdentity = diagnosticsIdentityRef.current === diagnosticsIdentity;
      diagnosticsIdentityRef.current = diagnosticsIdentity;
      if (sameIdentity && current.lane === surfaceDefinition.lane && current.mode === surfaceMode) return current;
      return createSurfaceDiagnostics(surfaceDefinition.lane, surfaceMode, capabilities, surfaceSuppressed, diagnosticsIdentity);
    });
  }, [capabilities, diagnosticsIdentity, surfaceDefinition.lane, surfaceMode, surfaceSuppressed]);

  useEffect(() => {
    if (!surfaceMode.startsWith('native-') || !surfaceBinding.visible || surfaceBinding.occluded) return;
    const timeout = window.setTimeout(() => {
      setDiagnostics((current) => {
        if (current.mode !== surfaceMode || current.ready || current.failure !== 'none') return current;
        return {
          ...current,
          failure: 'not-painted',
          reason: 'The native lane did not produce a paint receipt within 3.2 seconds; the same semantic task was restored as a DOM fallback.',
          lastError: 'native-paint-timeout',
        };
      });
    }, 3200);
    return () => window.clearTimeout(timeout);
  }, [activeId, surfaceBinding.occluded, surfaceBinding.visible, surfaceMode]);

  useEffect(() => {
    const onHash = () => setActiveId(demoFromHash(location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const mobile = matchMedia('(max-width: 820px)');
    const syncPanel = (event: MediaQueryListEvent) => { if (event.matches) setControlsOpen(false); };
    if (mobile.matches) setControlsOpen(false);
    mobile.addEventListener('change', syncPanel);
    return () => mobile.removeEventListener('change', syncPanel);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', demo.accent);
    document.title = `${demo.shortTitle} · HTML-in-Canvas Futures Lab`;
    document.querySelector<HTMLElement>(`.mobile-domain-strip [data-demo-target="${demo.id}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [demo]);

  useEffect(() => {
    if (!atlasOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    atlasDialogRef.current?.showModal();
    atlasCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setAtlasOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      previous?.focus();
    };
  }, [atlasOpen]);

  const navigate = (id: DemoId) => {
    setControlsOpen(false);
    setEvidenceOpen(false);
    location.hash = `/${id}`;
    setActiveId(id);
  };

  const updateState = useCallback((key: string, value: string | number | boolean) => setStates((current) => ({
    ...current,
    [activeId]: {
      ...current[activeId],
      [key]: value,
      ...(activeId === 'science' && ['gravity', 'velocity'].includes(key) ? { scienceAttempts: nextScienceAttempts(Number(current.science.scienceAttempts ?? 1)), hypothesisSaved: false } : {}),
      ...(activeId === 'twin' && ['threshold', 'zone', 'live'].includes(key) ? { acknowledged: false } : {}),
      ...(activeId === 'diagram' && ['nodeName', 'schemaDraft', 'nodeHealthy'].includes(key) ? { nodeSaved: false } : {}),
      ...(activeId === 'data' && key === 'brushStartPercent' ? { brushStartPercent: Math.max(0, Math.min(Number(value), Number(current.data.brushEndPercent ?? 64) - 1)), rationaleCopied: false } : {}),
      ...(activeId === 'data' && key === 'brushEndPercent' ? { brushEndPercent: Math.min(100, Math.max(Number(value), Number(current.data.brushStartPercent ?? 22) + 1)), rationaleCopied: false } : {}),
    },
  })), [activeId]);

  const reset = () => {
    setStates((current) => ({ ...current, [activeId]: createInitialState(demo) }));
    setDomainRuntime((current) => ({ ...current, [activeId]: {} }));
    setResetToken((value) => value + 1);
    setRequestPaintToken((value) => value + 1);
  };

  const action = useCallback((key: string) => {
    if (key === 'resetGame') {
      setStates((current) => ({ ...current, game: createInitialState(DEMO_BY_ID.get('game')!) }));
      setDomainRuntime((current) => ({ ...current, game: {} }));
      setResetToken((value) => value + 1);
      setRequestPaintToken((value) => value + 1);
      return;
    }
    if (key === 'acknowledge') {
      setStates((current) => ({ ...current, twin: { ...current.twin, acknowledged: true } }));
      return;
    }
    if (key === 'openArtifact') {
      setStates((current) => ({ ...current, portfolio: { ...current.portfolio, artifactOpen: true } }));
      return;
    }
    if (key === 'openProvenance') {
      setStates((current) => ({ ...current, spatial: { ...current.spatial, provenanceOpen: true } }));
      return;
    }
    if (key === 'undoNode') {
      setStates((current) => ({
        ...current,
        diagram: {
          ...current.diagram,
          nodeName: String(current.diagram.savedNodeName ?? 'Render adapter'),
          schemaDraft: String(current.diagram.savedSchema ?? 'PaintReceipt → SurfaceState'),
          nodeHealthy: true,
          nodeSaved: true,
        },
      }));
      return;
    }
    if (key === 'cancelNodeEdit') {
      setStates((current) => ({
        ...current,
        diagram: {
          ...current.diagram,
          nodeName: String(current.diagram.savedNodeName ?? 'Render adapter'),
          schemaDraft: String(current.diagram.savedSchema ?? 'PaintReceipt → SurfaceState'),
          nodeHealthy: true,
          nodeSaved: Number(current.diagram.editRevision ?? 0) > 0,
        },
      }));
      return;
    }
    if (key === 'saveNode') {
      setStates((current) => {
        const nextRevision = Number(current.diagram.editRevision ?? 0) + 1;
        const snapshot = `${nextRevision}:${String(current.diagram.nodeName ?? 'Render adapter')}=${String(current.diagram.schemaDraft ?? 'PaintReceipt → SurfaceState')}`;
        const previousHistory = String(current.diagram.nodeHistory ?? '').split(';').filter(Boolean);
        return {
          ...current,
          diagram: {
            ...current.diagram,
            savedNodeName: String(current.diagram.nodeName ?? 'Render adapter'),
            savedSchema: String(current.diagram.schemaDraft ?? 'PaintReceipt → SurfaceState'),
            editRevision: nextRevision,
            nodeHistory: [...previousHistory, snapshot].slice(-5).join(';'),
            nodeSaved: true,
          },
        };
      });
      return;
    }
    if (key === 'copyRationale') {
      setStates((current) => ({ ...current, data: { ...current.data, rationaleCopied: true } }));
      return;
    }
    if (key === 'stepOrbit') {
      setStates((current) => ({ ...current, science: { ...current.science, orbitStep: Number(current.science.orbitStep ?? 0) + 1 } }));
      return;
    }
    if (key === 'saveHypothesis') {
      setStates((current) => {
        const gravity = Number(current.science.gravity ?? 100);
        const velocity = Number(current.science.velocity ?? 92);
        const step = Number(current.science.orbitStep ?? 0);
        const signature = `G ${gravity}% · V ${velocity}% · STEP ${step}`;
        const history = String(current.science.orbitHistory ?? '').split(';').filter(Boolean);
        return {
          ...current,
          science: {
            ...current.science,
            savedOrbitSignature: signature,
            orbitHistory: [...history, signature].slice(-5).join(';'),
            hypothesisSaved: true,
          },
        };
      });
      return;
    }
    if (key === 'prepareReviewPacket') {
      setStates((current) => ({ ...current, floorplan: { ...current.floorplan, reviewPacketReady: true } }));
      return;
    }
    if (key === 'openRunbook') {
      setStates((current) => ({ ...current, twin: { ...current.twin, runbookOpen: true } }));
      return;
    }
    if (key === 'escalateAlarm') {
      setStates((current) => ({ ...current, twin: { ...current.twin, escalated: true } }));
      return;
    }
    if (key === 'revealSurface') {
      setStates((current) => ({ ...current, twin: { ...current.twin, panelOccluded: false } }));
      setResetToken((value) => value + 1);
      setRequestPaintToken((value) => value + 1);
      return;
    }
    if (key === 'autoLayout') {
      setStates((current) => ({ ...current, diagram: { ...current.diagram, layoutEpoch: Number(current.diagram.layoutEpoch ?? 0) + 1 } }));
    }
    setResetToken((value) => value + 1);
  }, []);

  const stableTelemetry = useCallback((next: SceneTelemetry) => setTelemetry(next), []);
  const stableDiagnostics = useCallback((next: HtmlSurfaceDiagnostics) => {
    if (next.scopeId === activeDiagnosticsScopeRef.current) setDiagnostics(next);
  }, []);
  const stableDomainRuntime = useCallback((id: DemoId, next: SceneRuntimeState) => {
    setDomainRuntime((current) => JSON.stringify(current[id]) === JSON.stringify(next) ? current : { ...current, [id]: next });
    if (id === 'game' && Number.isFinite(next.collected)) {
      setStates((current) => {
        const collectedMask = Math.max(0, Math.min(63, Math.floor(Number(next.collected))));
        const gameEscaped = Boolean(next.escaped);
        if (Number(current.game.collectedMask ?? 0) === collectedMask && Boolean(current.game.gameEscaped) === gameEscaped) return current;
        return { ...current, game: { ...current.game, collectedMask, gameEscaped } };
      });
    }
    if (id === 'data' && Number.isFinite(next.brushStartPercent) && Number.isFinite(next.brushEndPercent)) {
      setStates((current) => {
        const start = Math.max(0, Math.min(99, Math.round(next.brushStartPercent)));
        const end = Math.min(100, Math.max(start + 1, Math.round(next.brushEndPercent)));
        if (Number(current.data.brushStartPercent) === start && Number(current.data.brushEndPercent) === end) return current;
        return { ...current, data: { ...current.data, brushStartPercent: start, brushEndPercent: end, rationaleCopied: false } };
      });
    }
  }, []);

  const nativePrimitiveCount = [
    capabilities.drawElementImage2D,
    capabilities.texElementImage2D,
    capabilities.copyElementImageToTexture === 'supported',
    capabilities.captureElementImage,
  ].filter(Boolean).length;
  const surfaceOwnedKeys = surfaceOwnedControlKeys(activeId);
  const sceneControls = demo.controls.filter((control) => !surfaceOwnedKeys.includes(control.key));

  return (
    <div
      className="app-shell"
      data-active-demo={activeId}
      data-surface-lane={surfaceDefinition.lane}
      data-surface-mode={surfaceMode}
      data-narrow-transform-guard={String(responsiveTransformGuard)}
      data-surface-ready={diagnostics.ready ? 'true' : 'false'}
      data-surface-failure={diagnostics.failure}
      data-capability-detected-at={capabilities.detectedAt}
      data-cap-layout-subtree={String(capabilities.layoutSubtree)}
      data-cap-paint-event={String(capabilities.paintEvent)}
      data-cap-request-paint={String(capabilities.requestPaint)}
      data-cap-draw-element-image={String(capabilities.drawElementImage2D)}
      data-cap-tex-element-image-2d={String(capabilities.texElementImage2D)}
      data-cap-copy-element-image-to-texture={String(capabilities.copyElementImageToTexture)}
      data-cap-capture-element-image={String(capabilities.captureElementImage)}
      data-cap-get-element-transform={String(capabilities.getElementTransform)}
      data-frame-sample-count={telemetry.frameSampleCount ?? 0}
      data-frame-p50-ms={(telemetry.frameP50Ms ?? 0).toFixed(3)}
      data-frame-p95-ms={(telemetry.frameP95Ms ?? 0).toFixed(3)}
      data-frame-p99-ms={(telemetry.frameP99Ms ?? 0).toFixed(3)}
      data-frame-max-ms={(telemetry.frameMaxMs ?? 0).toFixed(3)}
      data-dropped-frame-ratio={(telemetry.droppedFrameRatio ?? 0).toFixed(5)}
      data-raw-frame-sample-count={telemetry.rawFrameSampleCount ?? 0}
      data-raw-frame-p95-ms={(telemetry.rawFrameP95Ms ?? 0).toFixed(3)}
      data-raw-frame-max-ms={(telemetry.rawFrameMaxMs ?? 0).toFixed(3)}
      data-suspension-gap-count={telemetry.suspensionGapCount ?? 0}
      data-long-task-count={telemetry.longTaskCount ?? 0}
      data-long-task-total-ms={(telemetry.longTaskTotalMs ?? 0).toFixed(3)}
      data-long-task-max-ms={(telemetry.longTaskMaxMs ?? 0).toFixed(3)}
      data-js-heap-used-bytes={telemetry.jsHeapUsedBytes ?? 'unavailable'}
      data-last-paint-ms={diagnostics.lastPaintMs === null ? 'unavailable' : diagnostics.lastPaintMs.toFixed(3)}
      data-paint-count={diagnostics.paintCount}
      data-upload-count={diagnostics.uploadCount}
      data-element-images-captured={diagnostics.elementImagesCaptured}
      data-element-images-transferred={diagnostics.elementImagesTransferred}
      data-element-images-closed={diagnostics.elementImagesClosed}
      data-element-images-terminal-released={diagnostics.elementImagesTerminalReleased}
      data-element-images-outstanding={diagnostics.elementImagesOutstanding}
      data-transform-sync-count={diagnostics.transformSyncCount}
      data-transform-sync-provenance={diagnostics.transformSyncProvenance}
      data-request-paint-capability={diagnostics.requestPaintCapability}
      data-request-strategy={diagnostics.requestStrategy}
      data-composite-plan-id={diagnostics.compositePlanId ?? 'not-applicable'}
      data-composite-operation-count={diagnostics.compositeOperationCount}
      data-composition-revision={diagnostics.compositionRevision ?? 'unmeasured'}
      data-composition-status={diagnostics.compositionStatus}
      data-alignment-status={diagnostics.alignmentStatus}
      data-surface-id={surfaceBinding.surfaceId}
      data-object-id={surfaceBinding.objectId}
      data-surface-archetype={surfaceBinding.archetype}
      data-binding-x={surfaceBinding.anchor.x.toFixed(2)}
      data-binding-y={surfaceBinding.anchor.y.toFixed(2)}
      data-domain-runtime={JSON.stringify(domainRuntime[activeId])}
      data-alignment-error-px={diagnostics.alignmentErrorPx == null ? 'unmeasured' : diagnostics.alignmentErrorPx.toFixed(3)}
      data-snapshot-phase={diagnostics.snapshotPhase}
      data-fallback-reason={fallbackReason}
    >
      <a className="skip-link" href="#workspace-title">본문으로 건너뛰기</a>
      <header className="topbar">
        <button type="button" className="brand" onClick={() => navigate('commerce')} aria-label="HTML-in-Canvas Futures Lab 홈">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <strong><span className="brand-full">HTML-in-Canvas Futures Lab</span><span className="brand-mobile">CANVAS LAB</span></strong>
          <span className="lab-chip">CONTROLLED PREVIEW</span>
        </button>
        <div className="top-actions">
          <button type="button" onClick={() => setControlsOpen((value) => !value)} aria-expanded={controlsOpen} aria-controls="task-controls" aria-label="장면 도구"><span aria-hidden="true">≛</span> 장면 도구</button>
          <button type="button" onClick={() => setEvidenceOpen((value) => !value)} aria-expanded={evidenceOpen}><span aria-hidden="true">◎</span> 실행 증거</button>
          <button type="button" onClick={() => setAtlasOpen(true)}><span aria-hidden="true">▦</span> 설계 방향</button>
          <a href="https://github.com/WICG/html-in-canvas" target="_blank" rel="noreferrer"><span aria-hidden="true">‹/›</span> WICG 제안서</a>
        </div>
      </header>

      {atlasOpen && (
        <dialog ref={atlasDialogRef} className="atlas-dialog reconcept-dialog" aria-labelledby="atlas-title" onCancel={() => setAtlasOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setAtlasOpen(false); }}>
            <header>
              <div><span>RESEARCH → CONCEPT → CODE</span><h2 id="atlas-title">HTML surface architecture</h2><p>Aligned 셸, Stretch 도메인, Frontier 네이티브 표면을 결합해 고정 카드가 아닌 장면 결합형 작업 공간을 설계했습니다.</p></div>
              <button ref={atlasCloseRef} type="button" onClick={() => setAtlasOpen(false)} aria-label="재설계 아틀라스 닫기">×</button>
            </header>
            <figure className="reconcept-board">
              <img src="/concepts/html-in-canvas-architecture-triptych-v3-20260824.png" alt="Aligned, Stretch, Frontier HTML-in-Canvas 작업 공간 설계 방향 비교" />
              <figcaption><strong>선택 방향: Aligned × Stretch × Frontier</strong><span>선택 객체 binding · 현재 IDL · paint trace · 정렬 오차 · 상태 보존 fallback</span></figcaption>
            </figure>
        </dialog>
      )}

      <nav className="mobile-domain-strip" aria-label="모바일 도메인 선택">{DEMOS.map((item) => <button key={item.id} type="button" data-demo-target={item.id} className={item.id === activeId ? 'active' : ''} onClick={() => navigate(item.id)} aria-current={item.id === activeId ? 'page' : undefined}><Icon value={item.icon} /><span>{item.shortTitle}</span></button>)}</nav>

      <aside className="domain-rail" aria-label="12개 데모 도메인">
        <p>EXPERIMENTS <span>12</span></p>
        <nav>
          {DEMOS.map((item) => {
            const lane = DOMAIN_SURFACES[item.id].lane;
            return <button type="button" key={item.id} data-demo-target={item.id} aria-label={`${item.shortTitle} · ${item.title}`} title={item.title} className={item.id === activeId ? 'active' : ''} onClick={() => navigate(item.id)} aria-current={item.id === activeId ? 'page' : undefined}><Icon value={item.icon} /><span>{item.shortTitle}<small>{lane === 'canvas-2d' ? '2D' : lane.toUpperCase()}</small></span><b>{item.index}</b></button>;
          })}
        </nav>
      </aside>

      <main className="workspace">
        <section className="workspace-heading">
          <div><p>{demo.eyebrow} <span>EXPERIMENT {demo.index} / 12</span></p><h1 id="workspace-title">{demo.title}</h1><p>{demo.instruction}</p></div>
          <div className="heading-badges"><span>{surfaceMode.startsWith('native-') ? '실험 API 실행 중' : '호환 모드'}</span><button type="button" onClick={reset}>처음부터</button></div>
        </section>
        <section className="stage-panel" data-testid="interactive-stage" aria-label={`${demo.shortTitle} HTML-in-Canvas 인터랙티브 스테이지`}>
          <SceneCanvas
            key={diagnosticsIdentity}
            demo={demo}
            state={state}
            runtime={domainRuntime[activeId]}
            resetToken={resetToken}
            surfaceMode={surfaceMode}
            fallbackReason={fallbackReason}
            diagnostics={diagnostics}
            capabilities={capabilities}
            binding={surfaceBinding}
            requestPaintToken={requestPaintToken}
            evidenceOpen={evidenceOpen}
            onTelemetry={stableTelemetry}
            onDomainRuntime={stableDomainRuntime}
            onControlChange={updateState}
            onAction={action}
            onDiagnostics={stableDiagnostics}
            onRequestPaint={() => setRequestPaintToken((value) => value + 1)}
            onCloseEvidence={() => setEvidenceOpen(false)}
            onOpenControls={() => setControlsOpen(true)}
          />
          <div className="stage-metrics" aria-label="데모 핵심 지표">{demo.metrics.map((metric, index) => <div key={metric.label}><span>{metric.label}</span><strong>{liveMetricValue(demo, state, domainRuntime[activeId], telemetry, index)}</strong></div>)}</div>
        </section>
        <AccessibleDetails demo={demo} state={state} runtime={domainRuntime[activeId]} telemetry={telemetry} diagnostics={diagnostics} />
      </main>

      <aside id="task-controls" className={`control-panel ${controlsOpen ? 'open' : ''}`} inert={!controlsOpen} aria-hidden={!controlsOpen} aria-label="실험 컨트롤">
        <button type="button" className="sheet-handle" aria-label={controlsOpen ? '컨트롤 접기' : '컨트롤 펼치기'} onClick={() => setControlsOpen((value) => !value)}><i /></button>
        <div className="panel-title"><div><span>{demo.shortTitle} · {demo.index} / 12</span><h2>장면을 조율하세요</h2></div><button type="button" aria-label="컨트롤 패널 접기" onClick={() => setControlsOpen(false)}>››</button></div>
        <div className="control-content">
          <p className="instruction">{demo.instruction}</p>
          <div className="control-group">
            {sceneControls.length > 0 ? sceneControls.map((control) => <Control key={control.key} control={control} value={state[control.key]} onChange={updateState} onAction={action} />) : <p className="surface-owned-note">이 도메인의 주요 컨트롤은 선택 객체에 결합된 HTML 표면 안에 있습니다.</p>}
          </div>
          <details className="developer-settings"><summary>개발자 설정 · 렌더 경로</summary><fieldset className="experimental-settings">
            <legend>HTML-in-Canvas 실행 계약</legend>
            <label><span>렌더 경로</span><select aria-label="HTML-in-Canvas 렌더 경로" value={surfaceRequest} onChange={(event) => setSurfaceRequest(event.currentTarget.value as HtmlCanvasRequest)}><option value="auto">Auto / exact detect</option><option value="native">Native trial</option><option value="dom-overlay">DOM fallback</option><option value="disabled">Disabled</option></select></label>
            <label className="kill-switch"><input type="checkbox" checked={killSwitch} onChange={(event) => setKillSwitch(event.currentTarget.checked)} /><span>실험 HTML API 끄기 · 기본 3D 유지</span></label>
            <p><span className={`status-dot ${surfaceMode}`} /> 현재: <strong>{surfaceMode}</strong> · 원시 lane {nativePrimitiveCount} / 4 감지</p>
            <p className="trial-warning">{HTML_CANVAS_EXPERIMENT_LABEL}</p>
          </fieldset>
          <CapabilityMatrix capabilities={capabilities} />
          </details>
        </div>
      </aside>

      <footer className="runtime-bar" aria-label="실시간 렌더링 상태">
        <span className="runtime-label">RUNTIME</span>
        <span><i className="cyan" />{laneDisplayName(surfaceDefinition.lane)}</span>
        <span><i className={diagnostics.ready ? 'mint' : 'amber'} />{diagnostics.ready ? 'TASK READY' : 'AWAITING NATIVE PROOF'}</span>
        <span>PAINT <strong>{formatQuantity(diagnostics.paintCount)}</strong></span>
        <span>UPLOAD <strong>{formatQuantity(diagnostics.uploadCount)}</strong></span>
        <span>SYNC <strong>{formatQuantity(diagnostics.transformSyncCount)}</strong></span>
        <span>FPS <strong>{telemetry.fps.toFixed(1)}</strong></span>
        <span>P95 <strong>{(telemetry.frameP95Ms ?? 0).toFixed(1)} ms</strong></span>
        <span>DPR <strong>{telemetry.dpr.toFixed(2)}</strong></span>
      </footer>

      <nav className="mobile-bottom-nav" aria-label="모바일 주요 메뉴"><button type="button" onClick={() => document.querySelector('.mobile-domain-strip')?.scrollIntoView({ behavior: 'smooth' })}><Icon value="◈" /><span>Explore</span></button><button className="active" type="button"><Icon value="◇" /><span>Stage</span></button><button type="button" onClick={() => setControlsOpen(true)}><Icon value="≛" /><span>Controls</span></button></nav>
      <div className="sr-only" aria-live="polite">{demo.shortTitle} 데모가 선택되었습니다. HTML 표면 경로는 {surfaceMode}, lane은 {surfaceDefinition.lane}입니다.</div>
    </div>
  );
}
