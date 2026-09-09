import type { SurfaceBinding } from '../runtime/surfaceBindings';
import type { DemoId, DemoState, SceneRuntimeState } from '../types';

export type CompositeClip =
  | { kind: 'circle'; x: number; y: number; radius: number }
  | { kind: 'round-rect'; x: number; y: number; width: number; height: number; radius: number }
  | { kind: 'route'; points: Array<{ x: number; y: number }>; width: number };

export type HtmlCompositeFragment = {
  id: string;
  placement: { x: number; y: number; width: number; height: number };
  clip: CompositeClip;
  alpha: number;
  filter: string;
};

export type CompositeForeground = {
  kind: 'constellation' | 'portal' | 'route' | 'contract' | 'brush' | 'orbit';
  color: string;
  anchorX: number;
  anchorY: number;
  extent: number;
  crossExtent?: number;
  active: boolean;
};

export type Canvas2dCompositePlan = {
  id: string;
  revision: string;
  primaryPlacement: SurfaceBinding['placement'];
  fragments: HtmlCompositeFragment[];
  foreground: CompositeForeground;
  claim: string;
};

const numberValue = (record: DemoState | SceneRuntimeState, key: string, fallback: number) => {
  const value = Number(record[key]);
  return Number.isFinite(value) ? value : fallback;
};

const stringValue = (state: DemoState, key: string, fallback: string) => String(state[key] ?? fallback);
const boolValue = (state: DemoState, key: string, fallback = false) => Boolean(state[key] ?? fallback);
const round = (value: number) => Math.round(value * 100) / 100;

function revisionOf(id: DemoId, state: DemoState, runtime: SceneRuntimeState): string {
  if (id === 'portfolio') return `${Math.floor(numberValue(runtime, 'selectedNode', 0))}:${stringValue(state, 'selectedArtifact', 'Prototype')}:${boolValue(state, 'artifactOpen')}`;
  if (id === 'game') return `${Math.floor(numberValue(runtime, 'collected', 0))}:${stringValue(state, 'callSign', 'canvas-01')}:${boolValue(state, 'gateOpen')}`;
  if (id === 'map') return `${stringValue(state, 'placeQuery', '성수')}:${stringValue(state, 'incidentSeverity', 'delay')}:${stringValue(state, 'routeLanguage', 'ko')}:${boolValue(state, 'mapPinned')}`;
  if (id === 'diagram') return `${Math.floor(numberValue(runtime, 'selectedNode', 4))}:${stringValue(state, 'schemaDraft', '')}:${numberValue(state, 'editRevision', 0)}:${boolValue(state, 'nodeSaved')}`;
  if (id === 'data') return `${numberValue(state, 'brushStartPercent', numberValue(runtime, 'brushStartPercent', 22))}:${numberValue(state, 'brushEndPercent', numberValue(runtime, 'brushEndPercent', 64))}:${stringValue(state, 'metric', '온도')}`;
  return `${numberValue(state, 'gravity', 100)}:${numberValue(state, 'velocity', 92)}:${numberValue(state, 'orbitStep', 0)}:${stringValue(state, 'orbitHistory', '')}`;
}

export function buildCanvas2dCompositePlan(
  id: DemoId,
  state: DemoState,
  runtime: SceneRuntimeState,
  binding: SurfaceBinding,
): Canvas2dCompositePlan {
  if (!['portfolio', 'game', 'map', 'diagram', 'data', 'science'].includes(id)) {
    throw new DOMException(`${id} is not a Canvas 2D HTML-composition domain.`, 'NotSupportedError');
  }

  const anchorX = binding.anchor.x;
  const anchorY = binding.anchor.y;
  const revision = revisionOf(id, state, runtime);
  const common = {
    id: `${id}-scene-composite-v1`,
    revision,
    primaryPlacement: binding.placement,
  };

  if (id === 'portfolio') {
    const nodes = [
      { x: anchorX - 226, y: anchorY + 104 },
      { x: anchorX - 118, y: anchorY - 118 },
      { x: anchorX + 126, y: anchorY + 92 },
    ];
    return {
      ...common,
      fragments: nodes.map((node, index) => ({
        id: `artifact-fragment-${index + 1}`,
        placement: { x: node.x - 72, y: node.y - 52, width: 144, height: 104 },
        clip: { kind: 'circle', x: node.x, y: node.y, radius: 48 - index * 5 },
        alpha: boolValue(state, 'artifactOpen') ? .9 : .52,
        filter: index === 1 ? 'saturate(1.25)' : 'saturate(.85) contrast(1.08)',
      })),
      foreground: { kind: 'constellation', color: '#45d6e8', anchorX, anchorY, extent: 118, active: boolValue(state, 'artifactOpen') },
      claim: 'Selected case-study HTML is clipped into connected constellation nodes and then crossed by scene edges.',
    };
  }

  if (id === 'game') {
    const open = boolValue(state, 'gateOpen');
    return {
      ...common,
      fragments: [
        {
          id: open ? 'gate-portal-open' : 'gate-portal-locked',
          placement: { x: anchorX - 128, y: anchorY - 128, width: 256, height: 256 },
          clip: { kind: 'circle', x: anchorX, y: anchorY, radius: open ? 94 : 58 },
          alpha: open ? .96 : .42,
          filter: open ? 'saturate(1.45) contrast(1.12)' : 'grayscale(1) contrast(1.5)',
        },
      ],
      foreground: { kind: 'portal', color: open ? '#63e6be' : '#ffca6e', anchorX, anchorY, extent: open ? 104 : 68, active: open },
      claim: 'The live mission terminal becomes the gate aperture texture; authentication changes the actual portal geometry.',
    };
  }

  if (id === 'map') {
    const pinned = boolValue(state, 'mapPinned');
    const rtl = stringValue(state, 'routeLanguage', 'ko') === 'ar';
    const severity = stringValue(state, 'incidentSeverity', 'delay');
    const direction = rtl ? -1 : 1;
    const points = [
      { x: anchorX - direction * 210, y: anchorY + 76 },
      { x: anchorX - direction * 92, y: anchorY - 18 },
      { x: anchorX + direction * 76, y: anchorY + 42 },
      { x: anchorX + direction * 188, y: anchorY - 62 },
    ];
    return {
      ...common,
      fragments: [
        {
          id: `incident-ribbon-${severity}-${rtl ? 'rtl' : 'ltr'}`,
          placement: { x: anchorX - 248, y: anchorY - 92, width: 496, height: 184 },
          clip: { kind: 'route', points, width: severity === 'evacuation' ? 48 : 34 },
          alpha: pinned ? .94 : .62,
          filter: severity === 'closure' ? 'hue-rotate(318deg) saturate(1.5)' : severity === 'evacuation' ? 'hue-rotate(44deg) saturate(1.4)' : 'saturate(1.15)',
        },
        {
          id: 'incident-pin-lens',
          placement: { x: anchorX - 88, y: anchorY - 88, width: 176, height: 176 },
          clip: { kind: 'circle', x: anchorX, y: anchorY, radius: 72 },
          alpha: .88,
          filter: 'contrast(1.1)',
        },
      ],
      foreground: { kind: 'route', color: severity === 'closure' ? '#ff6b55' : severity === 'evacuation' ? '#ffca6e' : '#45d6e8', anchorX, anchorY, extent: 118, active: pinned },
      claim: 'Current multilingual incident HTML is clipped into the map route corridor and pin lens.',
    };
  }

  if (id === 'diagram') {
    const valid = Boolean(state.nodeHealthy ?? true) && stringValue(state, 'schemaDraft', 'PaintReceipt → SurfaceState').includes('→');
    return {
      ...common,
      fragments: [
        {
          id: valid ? 'contract-node-valid' : 'contract-node-invalid',
          placement: { x: anchorX - 112, y: anchorY - 64, width: 224, height: 128 },
          clip: { kind: 'round-rect', x: anchorX - 104, y: anchorY - 58, width: 208, height: 116, radius: valid ? 22 : 4 },
          alpha: .94,
          filter: valid ? 'saturate(1.25)' : 'grayscale(.7) contrast(1.6)',
        },
        {
          id: 'contract-edge-token',
          placement: { x: anchorX + 76, y: anchorY - 104, width: 156, height: 76 },
          clip: { kind: 'round-rect', x: anchorX + 88, y: anchorY - 94, width: 132, height: 54, radius: 12 },
          alpha: valid ? .82 : .38,
          filter: valid ? 'none' : 'grayscale(1)',
        },
      ],
      foreground: { kind: 'contract', color: valid ? '#ffca6e' : '#ff6b55', anchorX, anchorY, extent: 122, active: valid && boolValue(state, 'nodeSaved') },
      claim: 'Editable contract HTML fills the selected graph node and controls the foreground edge state.',
    };
  }

  if (id === 'data') {
    const chartLeft = numberValue(runtime, 'chartLeft', 44);
    const chartRight = numberValue(runtime, 'chartRight', Math.max(chartLeft + 160, anchorX * 1.55));
    const chartTop = numberValue(runtime, 'chartTop', 52);
    const chartHeight = numberValue(runtime, 'chartHeight', 300);
    const visibleChartHeight = binding.docked
      ? Math.max(120, Math.min(chartHeight, binding.placement.y - chartTop - 24))
      : chartHeight;
    const start = Math.max(0, Math.min(100, numberValue(state, 'brushStartPercent', numberValue(runtime, 'brushStartPercent', 22))));
    const end = Math.max(start + 1, Math.min(100, numberValue(state, 'brushEndPercent', numberValue(runtime, 'brushEndPercent', 64))));
    const x = chartLeft + (chartRight - chartLeft) * start / 100;
    const width = Math.max(56, (chartRight - chartLeft) * (end - start) / 100);
    const renderWidth = Math.min(520, Math.max(280, width + 36));
    const renderHeight = Math.min(340, visibleChartHeight + 44);
    return {
      ...common,
      fragments: [
        {
          id: `semantic-brush-${Math.round(start)}-${Math.round(end)}`,
          placement: { x: x + width / 2 - renderWidth / 2, y: chartTop + (visibleChartHeight - renderHeight) / 2, width: renderWidth, height: renderHeight },
          clip: { kind: 'round-rect', x, y: chartTop, width, height: visibleChartHeight, radius: 18 },
          alpha: .88,
          filter: 'saturate(1.22) contrast(1.08)',
        },
      ],
      foreground: { kind: 'brush', color: '#63e6be', anchorX: round(x + width / 2), anchorY: round(chartTop + visibleChartHeight / 2), extent: round(width), crossExtent: round(visibleChartHeight), active: boolValue(state, 'compare', true) },
      claim: 'The semantic table and rationale become the magnification material inside the exact selected chart interval.',
    };
  }

  const saved = stringValue(state, 'orbitHistory', '').length > 0;
  return {
    ...common,
    fragments: [
      {
        id: 'periapsis-derivation-lens',
        placement: { x: anchorX - 104, y: anchorY - 104, width: 208, height: 208 },
        clip: { kind: 'circle', x: anchorX, y: anchorY, radius: 86 },
        alpha: .9,
        filter: 'saturate(1.28) contrast(1.12)',
      },
      ...(saved ? [{
        id: 'saved-formula-stamp',
        placement: { x: anchorX - 214, y: anchorY + 62, width: 148, height: 92 },
        clip: { kind: 'round-rect' as const, x: anchorX - 202, y: anchorY + 72, width: 124, height: 68, radius: 34 },
        alpha: .62,
        filter: 'grayscale(.45) saturate(1.3)',
      }] : []),
    ],
    foreground: { kind: 'orbit', color: '#6ea8ff', anchorX, anchorY, extent: 98, active: saved },
    claim: 'Live MathML derivation pixels form a periapsis lens and each saved run leaves a formula stamp in orbit space.',
  };
}
