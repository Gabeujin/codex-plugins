import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEMOS, createInitialState } from '../catalog';
import { DOMAIN_SURFACES } from '../runtime/surfaceCatalog';
import { createSurfaceDiagnostics, type HtmlCanvasCapabilities } from '../runtime/htmlInCanvas';
import { resolveSurfaceBinding } from '../runtime/surfaceBindings';
import { SemanticDomainSurface } from './SemanticDomainSurface';

const desktopRuntime = {
  surfaceAnchorX: 640,
  surfaceAnchorY: 360,
  surfaceAnchorZ: .25,
  surfaceVisible: 1,
  surfaceOccluded: 0,
};

const nativeCapabilities: HtmlCanvasCapabilities = {
  layoutSubtree: true,
  paintEvent: true,
  requestPaint: true,
  captureElementImage: true,
  getElementTransform: true,
  drawElementImage2D: true,
  texElementImage2D: true,
  webGpuAdvertised: true,
  copyElementImageToTexture: 'supported',
  offscreenCanvas: true,
  transferableElementImage: true,
  userAgent: 'test',
  detectedAt: 'test',
};

function renderDomain(id: (typeof DEMOS)[number]['id'], statePatch: Record<string, string | number | boolean> = {}, runtimePatch: Record<string, number> = {}) {
  const demo = DEMOS.find((candidate) => candidate.id === id)!;
  const state = Object.assign(createInitialState(demo), statePatch);
  const definition = DOMAIN_SURFACES[id];
  const runtime = { ...desktopRuntime, ...runtimePatch };
  const binding = resolveSurfaceBinding(id, definition.lane, 1_280, 720, runtime, state, 'dom-overlay');
  const markup = renderToStaticMarkup(
    <SemanticDomainSurface
      demo={demo}
      state={state}
      runtime={runtime}
      binding={binding}
      mode="dom-overlay"
      variant="fallback-overlay"
      onControlChange={vi.fn()}
      onAction={vi.fn()}
    />,
  );
  return { binding, markup };
}

describe('12-domain scene-bound HTML surface contract', () => {
  it('routes every domain to a declared native lane and covers all four proposal paths', () => {
    expect(Object.keys(DOMAIN_SURFACES)).toHaveLength(12);
    const lanes = new Set(Object.values(DOMAIN_SURFACES).map((surface) => surface.lane));
    expect([...lanes].sort()).toEqual(['canvas-2d', 'webgl', 'webgpu', 'worker']);
    for (const demo of DEMOS) {
      const surface = DOMAIN_SURFACES[demo.id];
      expect(surface.uniqueValue.length).toBeGreaterThan(48);
      expect(surface.proof.length).toBeGreaterThan(8);
      expect(surface.primitive).toMatch(/drawElementImage|texElementImage2D|copyElementImageToTexture|captureElementImage/);
    }
  });

  it('renders the 12 distinct V3 semantic task archetypes with stable proof selectors', () => {
    const archetypes = new Set<string>();
    for (const demo of DEMOS) {
      const state = createInitialState(demo);
      const definition = DOMAIN_SURFACES[demo.id];
      const binding = resolveSurfaceBinding(demo.id, definition.lane, 1_280, 720, desktopRuntime, state, 'dom-overlay');
      archetypes.add(binding.archetype);
      const markup = renderToStaticMarkup(
        <SemanticDomainSurface
          demo={demo}
          state={state}
          runtime={desktopRuntime}
          binding={binding}
          mode="dom-overlay"
          variant="fallback-overlay"
          onControlChange={vi.fn()}
          onAction={vi.fn()}
        />,
      );
      expect(markup).toContain(`data-domain="${demo.id}"`);
      expect(markup).toContain(`data-surface-id="${binding.surfaceId}"`);
      expect(markup).toContain(`data-object-id="${binding.objectId}"`);
      expect(markup).toContain(`data-surface-archetype="${binding.archetype}"`);
      expect(markup).toContain('data-task-surface-role="interactive-task"');
      expect(markup).toContain('data-surface-instance="fallback-overlay"');
      expect(markup).toContain('data-snapshot-phase="current"');
      expect(markup).toContain('data-fallback-reason="native-contract-unavailable"');
      expect(markup).toMatch(/<(button|input|select|textarea|table|a|math)\b/);
      expect(markup).not.toContain('dangerouslySetInnerHTML');
      expect(markup).not.toContain('<iframe');
    }
    expect(archetypes.size).toBe(12);
  });

  it('promotes the current native paint source into the single interactive semantic task', () => {
    for (const demo of DEMOS) {
      const state = createInitialState(demo);
      const definition = DOMAIN_SURFACES[demo.id];
      const nativeMode = definition.lane === 'canvas-2d' ? 'native-2d' : definition.lane === 'webgl' ? 'native-webgl' : definition.lane === 'webgpu' ? 'native-webgpu' : 'native-worker';
      const binding = resolveSurfaceBinding(demo.id, definition.lane, 1_280, 720, desktopRuntime, state, nativeMode);
      const diagnostics = { ...createSurfaceDiagnostics(definition.lane, nativeMode, nativeCapabilities), ready: true, failure: 'none' as const, snapshotPhase: 'current' as const };
      const nativeSurface = <SemanticDomainSurface demo={demo} state={state} runtime={desktopRuntime} binding={binding} mode={nativeMode} variant="native-source" diagnostics={diagnostics} onControlChange={vi.fn()} onAction={vi.fn()} />;
      const companionSurface = <SemanticDomainSurface demo={demo} state={state} runtime={desktopRuntime} binding={binding} mode={nativeMode} variant="companion-overlay" onControlChange={vi.fn()} onAction={vi.fn()} />;
      const nativeMarkup = renderToStaticMarkup(<canvas {...({ layoutsubtree: '' } as Record<string, string>)}>{nativeSurface}</canvas>);
      const companionMarkup = renderToStaticMarkup(<><canvas {...({ layoutsubtree: '' } as Record<string, string>)}>{nativeSurface}</canvas><div className="surface-host">{companionSurface}</div></>);
      expect(nativeMarkup).toMatch(/^<canvas[^>]*><article\b/);
      expect(nativeMarkup).toContain('class="semantic-surface');
      expect(nativeMarkup).toContain('data-task-surface-role="interactive-task"');
      expect(nativeMarkup).toContain('data-html-paint-source="true"');
      expect(nativeMarkup).toContain('data-surface-instance="interactive-native-source"');
      expect(nativeMarkup).toContain('tabindex="0"');
      const nativeOpeningTag = nativeMarkup.match(/^<canvas[^>]*>(<article[^>]*>)/)?.[1] ?? '';
      expect(nativeOpeningTag).not.toContain('aria-hidden="true"');
      expect(nativeOpeningTag).not.toContain('inert=""');
      expect(nativeOpeningTag).toContain('aria-label=');
      expect(nativeOpeningTag).toContain('aria-describedby=');
      expect(companionMarkup).toMatch(/^<canvas[^>]*><article\b[\s\S]*<\/canvas><div[^>]*><article\b/);
      expect(companionMarkup.match(/data-task-surface-role="interactive-task"/g)).toHaveLength(2);
      expect(companionMarkup.match(/data-html-paint-source="true"/g)).toHaveLength(1);
      expect(companionMarkup).toContain('data-surface-instance="interactive-companion"');
      expect(companionMarkup).toContain('HTML 조작면');
    }
  });

  it('keeps the source inert only until first native proof while the companion owns the task', () => {
    const demo = DEMOS[0];
    const definition = DOMAIN_SURFACES[demo.id];
    const state = createInitialState(demo);
    const binding = resolveSurfaceBinding(demo.id, definition.lane, 1_280, 720, desktopRuntime, state, 'native-2d');
    const markup = renderToStaticMarkup(<SemanticDomainSurface demo={demo} state={state} runtime={desktopRuntime} binding={binding} mode="native-2d" variant="native-source" diagnostics={createSurfaceDiagnostics(definition.lane, 'native-2d', nativeCapabilities)} onControlChange={vi.fn()} onAction={vi.fn()} />);
    expect(markup).toContain('data-task-surface-role="native-paint-source"');
    expect(markup).toContain('data-html-paint-source="true"');
    expect(markup).toContain('data-surface-instance="pending-native-source"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('inert=""');
    expect(markup).toContain('tabindex="-1"');
  });

  it('uses the actual 390px stage width without clipping the mobile sheet', () => {
    for (const demo of DEMOS) {
      const state = createInitialState(demo);
      const definition = DOMAIN_SURFACES[demo.id];
      for (const width of [390, 374, 280]) {
        const binding = resolveSurfaceBinding(demo.id, definition.lane, width, 616, {}, state, 'dom-overlay');
        expect(binding.placement.x).toBeGreaterThanOrEqual(0);
        expect(binding.placement.x + binding.placement.width).toBeLessThanOrEqual(Math.max(280, width));
        expect(binding.placement.y + binding.placement.height).toBeLessThanOrEqual(616);
      }
    }
  });

  it('renders the completed game, spatial, and worker task postconditions from durable state', () => {
    const game = renderDomain('game', { callSign: 'canvas-01', gateOpen: true }, { collected: 6, exitUnlocked: 1, escaped: 1 });
    expect(game.markup).toContain('ACCESS GRANTED');
    expect(game.markup).toContain('드론이 출구를 통과했습니다.');

    const spatial = renderDomain('spatial', { artworkPinned: true, artworkExpanded: true, artworkApproved: true });
    expect(spatial.markup).toContain('공간 고정 해제');
    expect(spatial.markup).toContain('요약 보기');
    expect(spatial.markup).toContain('APPROVED');

    const floorplan = renderDomain('floorplan', { reviewPacketReady: true, reviewPinned: true });
    expect(floorplan.markup).toContain('Worker 검토 패킷 준비됨');
    expect(floorplan.markup).toContain('worker 합성 패킷으로 고정되었습니다.');
  });

  it('preserves map severity, RTL language, and pin state as one semantic receipt', () => {
    const { binding, markup } = renderDomain('map', {
      placeQuery: '서울역',
      incidentSeverity: 'evacuation',
      routeLanguage: 'ar',
      mapPinned: true,
    });
    expect(markup).toContain('서울역 이동 창');
    expect(markup).toContain('dir="rtl"');
    expect(markup).toContain('lang="ar"');
    expect(markup).toContain('좌표 고정 해제');
    expect(binding.objectId).toBe('geo:서울역');
  });

  it('renders diagram validation, saved revision, and cancel/history controls', () => {
    const invalid = renderDomain('diagram', { schemaDraft: 'ElementImage SceneContract', nodeHealthy: true });
    expect(invalid.markup).toContain('INVALID');
    expect(invalid.markup).toMatch(/<button[^>]*disabled=""[^>]*>계약 저장<\/button>/);

    const saved = renderDomain('diagram', {
      schemaDraft: 'ElementImage → SceneContract',
      nodeSaved: true,
      editRevision: 4,
      savedNodeName: 'Capture adapter',
    });
    expect(saved.markup).toContain('편집 취소');
    expect(saved.markup).toContain('이전 저장본');
    expect(saved.markup).toContain('Revision 4 · Capture adapter');
  });

  it('renders keyboard brush endpoints and a bounded MathML calculation history', () => {
    const data = renderDomain('data', { brushStartPercent: 31, brushEndPercent: 78, metric: '온도' }, { brushStartPercent: 22, brushEndPercent: 64 });
    expect(data.markup).toContain('31% — 78% 구간');
    expect(data.markup).toContain('aria-label="브러시 시작"');
    expect(data.markup).toContain('aria-label="브러시 끝"');
    expect(data.markup).toContain('value="31"');
    expect(data.markup).toContain('value="78"');

    const science = renderDomain('science', {
      gravity: 150,
      velocity: 92,
      orbitStep: 1,
      hypothesisSaved: true,
      orbitHistory: 'G 100% · V 92% · STEP 0;G 120% · V 92% · STEP 1;G 140% · V 92% · STEP 1;G 150% · V 92% · STEP 1',
    });
    expect(science.markup).toContain('<math');
    expect(science.markup).toContain('aria-label="타원 궤도의 에너지 식"');
    expect(science.markup).toContain('aria-label="저장된 계산 이력"');
    expect(science.markup).toContain('G 150% · V 92% · STEP 1');
    expect(science.markup).not.toContain('G 100% · V 92% · STEP 0');
  });

  it('projects digital-twin LOD and occlusion into both binding and controls', () => {
    const twin = renderDomain('twin', { panelLod: 'compact', panelOccluded: true }, { selectedEquipmentLoad: 88 });
    expect(twin.binding.occluded).toBe(true);
    expect(twin.binding.placement.width).toBeLessThan(420);
    expect(twin.markup).toContain('상세 LOD 보기');
    expect(twin.markup).toContain('가림 해제');
    expect(twin.markup.match(/aria-pressed="true"/g)).toHaveLength(2);
  });
});
