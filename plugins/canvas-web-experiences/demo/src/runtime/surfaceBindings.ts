import type { DemoId, DemoState, SceneRuntimeState } from '../types';
import type { HtmlCanvasMode, HtmlSurfaceLane, SurfacePlacement } from './htmlInCanvas';

export type SurfaceArchetype =
  | 'editorial-fragment'
  | 'token-sheet'
  | 'terminal'
  | 'provenance-label'
  | 'incident-route'
  | 'contract-node'
  | 'bim-issue'
  | 'data-lens'
  | 'caption-cue'
  | 'derivation-note'
  | 'product-plate'
  | 'alarm-runbook';

export type SurfaceTransformOwner =
  | 'canvas-2d-return'
  | 'canvas-gpu-helper'
  | 'worker-main-sync'
  | 'dom-fallback';

export type SurfaceBinding = {
  surfaceId: string;
  objectId: string;
  archetype: SurfaceArchetype;
  role: 'annotation' | 'editor' | 'terminal' | 'label' | 'control';
  anchor: { x: number; y: number; z: number };
  placement: SurfacePlacement;
  visible: boolean;
  occluded: boolean;
  docked: boolean;
  transformOwner: SurfaceTransformOwner;
};

type BindingDefinition = {
  archetype: SurfaceArchetype;
  role: SurfaceBinding['role'];
  objectPrefix: string;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
};

const DEFINITIONS: Record<DemoId, BindingDefinition> = {
  portfolio: { archetype: 'editorial-fragment', role: 'annotation', objectPrefix: 'project-node', width: 356, height: 292, offsetX: 34, offsetY: -152 },
  motion: { archetype: 'token-sheet', role: 'editor', objectPrefix: 'motion-plane', width: 392, height: 306, offsetX: 42, offsetY: -166 },
  game: { archetype: 'terminal', role: 'terminal', objectPrefix: 'world-gate', width: 372, height: 300, offsetX: -400, offsetY: 28 },
  spatial: { archetype: 'provenance-label', role: 'label', objectPrefix: 'artwork', width: 318, height: 320, offsetX: 32, offsetY: -166 },
  map: { archetype: 'incident-route', role: 'annotation', objectPrefix: 'geo', width: 374, height: 294, offsetX: 32, offsetY: -148 },
  diagram: { archetype: 'contract-node', role: 'editor', objectPrefix: 'graph-node', width: 390, height: 332, offsetX: 38, offsetY: -172 },
  floorplan: { archetype: 'bim-issue', role: 'editor', objectPrefix: 'drawing-coordinate', width: 402, height: 348, offsetX: -426, offsetY: -182 },
  data: { archetype: 'data-lens', role: 'annotation', objectPrefix: 'brush-range', width: 410, height: 310, offsetX: 24, offsetY: -328 },
  media: { archetype: 'caption-cue', role: 'editor', objectPrefix: 'caption-cue', width: 520, height: 250, offsetX: -260, offsetY: -282 },
  science: { archetype: 'derivation-note', role: 'annotation', objectPrefix: 'orbital-event', width: 382, height: 330, offsetX: 36, offsetY: -170 },
  commerce: { archetype: 'product-plate', role: 'control', objectPrefix: 'product-surface', width: 420, height: 322, offsetX: 62, offsetY: -166 },
  twin: { archetype: 'alarm-runbook', role: 'control', objectPrefix: 'equipment', width: 392, height: 342, offsetX: 34, offsetY: -180 },
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function finite(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function selectedIndex(id: DemoId, runtime: SceneRuntimeState): number {
  if (id === 'portfolio') return Math.max(0, Math.floor(finite(runtime.selectedNode, 0)));
  if (id === 'spatial') return Math.max(0, Math.floor(finite(runtime.selectedArtwork, 4)));
  if (id === 'diagram') return Math.max(0, Math.floor(finite(runtime.selectedNode, 4)));
  if (id === 'twin') return Math.max(0, Math.floor(finite(runtime.selectedEquipment, 3)));
  return 0;
}

function objectSuffix(id: DemoId, runtime: SceneRuntimeState, state: DemoState): string {
  const index = selectedIndex(id, runtime);
  if (id === 'portfolio') return String(index + 1).padStart(2, '0');
  if (id === 'motion') return String(state.easing ?? 'Fluid').toLowerCase();
  if (id === 'game') return '06';
  if (id === 'spatial') return String(index + 1).padStart(2, '0');
  if (id === 'map') return String(state.placeQuery ?? 'seongsu-window').trim().replace(/\s+/g, '-').slice(0, 24) || 'unselected';
  if (id === 'diagram') return String(index + 1).padStart(2, '0');
  if (id === 'floorplan') return 'C4-2F';
  if (id === 'data') {
    const start = Math.round(finite(runtime.brushStartPercent, 22));
    const end = Math.round(finite(runtime.brushEndPercent, 64));
    return `${start}-${end}`;
  }
  if (id === 'media') return `${Math.floor(finite(runtime.currentTimeSeconds, 42))}s`;
  if (id === 'science') return 'periapsis';
  if (id === 'commerce') return 'aura-04';
  return `AHU-${String(index + 1).padStart(2, '0')}`;
}

function transformOwner(lane: HtmlSurfaceLane, mode: HtmlCanvasMode): SurfaceTransformOwner {
  if (mode === 'dom-overlay' || mode === 'disabled') return 'dom-fallback';
  if (lane === 'canvas-2d') return 'canvas-2d-return';
  if (lane === 'worker') return 'worker-main-sync';
  return 'canvas-gpu-helper';
}

export function resolveSurfaceBinding(
  id: DemoId,
  lane: HtmlSurfaceLane,
  viewportWidth: number,
  viewportHeight: number,
  runtime: SceneRuntimeState,
  state: DemoState,
  mode: HtmlCanvasMode,
): SurfaceBinding {
  const definition = DEFINITIONS[id];
  const mobile = viewportWidth < 620;
  const safeWidth = Math.max(280, viewportWidth);
  const safeHeight = Math.max(360, viewportHeight);
  const anchorX = clamp(finite(runtime.surfaceAnchorX, safeWidth * (id === 'game' ? .84 : .52)), 0, safeWidth);
  const anchorY = clamp(finite(runtime.surfaceAnchorY, safeHeight * (id === 'media' ? .72 : .48)), 0, safeHeight);
  const anchorZ = finite(runtime.surfaceAnchorZ, 0);
  const docked = mobile;

  let width = Math.min(definition.width, Math.max(268, safeWidth - 32));
  let height = Math.min(definition.height, Math.max(224, safeHeight - 64));
  if (id === 'twin' && String(state.panelLod ?? 'detail') === 'compact') {
    width = Math.min(width, 304);
    height = Math.min(height, 236);
  }
  let x: number;
  let y: number;

  if (docked) {
    width = Math.max(268, safeWidth - 24);
    height = Boolean(state.sheetExpanded)
      ? Math.min(Math.max(definition.height, safeHeight * .68), safeHeight - 24)
      : Math.min(definition.height, Math.max(224, safeHeight * .48));
    x = 12;
    y = Math.max(12, safeHeight - height - 12);
  } else {
    const rtlMap = id === 'map' && String(state.routeLanguage ?? 'ko') === 'ar';
    x = clamp(rtlMap ? anchorX - width - definition.offsetX : anchorX + definition.offsetX, 18, Math.max(18, safeWidth - width - 18));
    y = clamp(anchorY + definition.offsetY, 18, Math.max(18, safeHeight - height - 18));
  }

  const suffix = objectSuffix(id, runtime, state);
  return {
    surfaceId: `${id}-surface:${suffix}`,
    objectId: `${definition.objectPrefix}:${suffix}`,
    archetype: definition.archetype,
    role: definition.role,
    anchor: { x: anchorX, y: anchorY, z: anchorZ },
    placement: { x, y, width, height },
    visible: finite(runtime.surfaceVisible, 1) !== 0,
    occluded: Boolean(state.panelOccluded) || finite(runtime.surfaceOccluded, 0) !== 0,
    docked,
    transformOwner: transformOwner(lane, mode),
  };
}

export function surfaceArchetypes(): SurfaceArchetype[] {
  return Object.values(DEFINITIONS).map((definition) => definition.archetype);
}

export function surfaceOwnedControlKeys(id: DemoId): readonly string[] {
  const keys: Record<DemoId, readonly string[]> = {
    portfolio: ['selectedProject', 'selectedArtifact', 'artifactOpen', 'sheetExpanded'],
    motion: ['easing', 'duration', 'trail', 'sheetExpanded'],
    game: ['callSign', 'gateOpen', 'sheetExpanded'],
    spatial: ['selectedArtwork', 'artworkPinned', 'artworkExpanded', 'sheetExpanded'],
    map: ['placeQuery', 'mapPinned', 'incidentSeverity', 'routeLanguage', 'sheetExpanded'],
    diagram: ['nodeName', 'schemaDraft', 'nodeHealthy', 'nodeSaved', 'sheetExpanded'],
    floorplan: ['reviewNote', 'reviewPinned', 'reviewPacketReady', 'sheetExpanded'],
    data: ['compare', 'brushStartPercent', 'brushEndPercent', 'sheetExpanded'],
    media: ['distortion', 'chromatic', 'playing', 'caption', 'sheetExpanded'],
    science: ['gravity', 'velocity', 'hypothesisSaved', 'orbitHistory', 'sheetExpanded'],
    commerce: ['material', 'light', 'quantity', 'reserved', 'sheetExpanded'],
    twin: ['threshold', 'acknowledged', 'panelLod', 'panelOccluded', 'sheetExpanded'],
  };
  return keys[id];
}
