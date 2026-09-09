import type { DemoId, DemoState, SceneRuntimeState } from '../types';
import type { HtmlCanvasMode, HtmlSurfaceLane, SurfacePlacement } from './htmlInCanvas';
import { resolveSurfaceBinding } from './surfaceBindings';

export type DomainSurfaceDefinition = {
  lane: HtmlSurfaceLane;
  kicker: string;
  title: string;
  uniqueValue: string;
  primitive: string;
  proof: string;
  tint: string;
  tiltX: number;
  tiltY: number;
};

export const DOMAIN_SURFACES: Record<DemoId, DomainSurfaceDefinition> = {
  portfolio: {
    lane: 'canvas-2d',
    kicker: 'SELECTABLE CASE STUDY',
    title: 'Signal Commons / 2026',
    uniqueValue: 'Responsive case-study HTML becomes a movable, searchable constellation surface.',
    primitive: 'drawElementImage',
    proof: 'native child · focus · click · selection target',
    tint: '#45d6e8', tiltX: -2, tiltY: -7,
  },
  motion: {
    lane: 'webgl',
    kicker: 'LIVE MOTION SPEC',
    title: 'Elastic arrival / token 04',
    uniqueValue: 'An editable motion specification is refracted as a real WebGL texture.',
    primitive: 'texElementImage2D',
    proof: 'native range · paint · texture upload',
    tint: '#b48cff', tiltX: 3, tiltY: -13,
  },
  game: {
    lane: 'canvas-2d',
    kicker: 'WORLD TERMINAL',
    title: 'Gate 06 / signal lock',
    uniqueValue: 'A keyboard-focusable quest terminal lives inside the game world without losing form semantics.',
    primitive: 'drawElementImage',
    proof: 'native input · form state · focus',
    tint: '#63e6be', tiltX: 1, tiltY: 8,
  },
  spatial: {
    lane: 'webgl',
    kicker: 'GALLERY PLANE',
    title: 'Untitled atmosphere / 08',
    uniqueValue: 'Curatorial HTML and actions are sampled onto an actual perspective mesh.',
    primitive: 'texElementImage2D',
    proof: 'native button · getElementTransform · hit test',
    tint: '#6ea8ff', tiltX: -3, tiltY: 16,
  },
  map: {
    lane: 'canvas-2d',
    kicker: 'GEO-ANCHORED PLACE CARD',
    title: 'Seongsu mobility window',
    uniqueValue: 'A multilingual, searchable place card follows the map coordinate pipeline.',
    primitive: 'drawElementImage',
    proof: 'native search · zoom · RTL · focus',
    tint: '#45d6e8', tiltX: 2, tiltY: -9,
  },
  diagram: {
    lane: 'canvas-2d',
    kicker: 'EDITABLE GRAPH NODE',
    title: 'Render adapter / healthy',
    uniqueValue: 'Rich form and code-node semantics move with the graph instead of becoming pixels-only UI.',
    primitive: 'drawElementImage',
    proof: 'native edit · validation · transform',
    tint: '#ffca6e', tiltX: 0, tiltY: 7,
  },
  floorplan: {
    lane: 'worker',
    kicker: 'BIM REVIEW SNAPSHOT',
    title: 'Grid C4 / revision 12',
    uniqueValue: 'A review sheet is captured as a transferable ElementImage and composed off the main thread.',
    primitive: 'captureElementImage',
    proof: 'transfer · explicit close · terminal release · transform',
    tint: '#ff6b55', tiltX: -1, tiltY: -5,
  },
  data: {
    lane: 'canvas-2d',
    kicker: 'SEMANTIC DATA SURFACE',
    title: 'Selected climate interval',
    uniqueValue: 'The same semantic table used by assistive technology is composited into the chart.',
    primitive: 'drawElementImage',
    proof: 'native range · semantic table · locale',
    tint: '#63e6be', tiltX: -2, tiltY: 5,
  },
  media: {
    lane: 'webgpu',
    kicker: 'LIVE CAPTION TEXTURE',
    title: 'Caption layer / shader pass',
    uniqueValue: 'Live captions and controls are copied to a GPU texture and distorted without losing DOM semantics.',
    primitive: 'copyElementImageToTexture',
    proof: 'native caption edit · GPU copy · device recovery',
    tint: '#b48cff', tiltX: 4, tiltY: -10,
  },
  science: {
    lane: 'canvas-2d',
    kicker: 'MATHML ORBIT NOTE',
    title: 'Stable ellipse hypothesis',
    uniqueValue: 'MathML, Korean explanation, and variables remain findable while orbiting with the simulation.',
    primitive: 'drawElementImage',
    proof: 'MathML · native range · requestPaint',
    tint: '#6ea8ff', tiltX: 2, tiltY: 6,
  },
  commerce: {
    lane: 'webgl',
    kicker: 'LIVE PRODUCT CONFIGURATOR',
    title: 'Aura 04 / composed material',
    uniqueValue: 'The real material and price form is sampled onto a 3D product plane, not a rotated bitmap.',
    primitive: 'texElementImage2D',
    proof: 'native form · paint · mesh · hit test',
    tint: '#ff6b55', tiltX: -4, tiltY: 18,
  },
  twin: {
    lane: 'webgl',
    kicker: 'WORLD-SPACE ALARM PANEL',
    title: 'AHU-04 / inspection required',
    uniqueValue: 'Acknowledge and threshold controls stay interactive on a spatial equipment panel.',
    primitive: 'texElementImage2D',
    proof: 'native range · focus · transform · restore',
    tint: '#ffca6e', tiltX: 3, tiltY: -15,
  },
};

export function getSurfacePlacement(
  id: DemoId,
  viewportWidth: number,
  viewportHeight: number,
  runtime: SceneRuntimeState = {},
  state: DemoState = {},
  mode: HtmlCanvasMode = 'dom-overlay',
): SurfacePlacement {
  return resolveSurfaceBinding(
    id,
    DOMAIN_SURFACES[id].lane,
    viewportWidth,
    viewportHeight,
    runtime,
    state,
    mode,
  ).placement;
}

export function laneDisplayName(lane: HtmlSurfaceLane): string {
  if (lane === 'canvas-2d') return 'Canvas 2D';
  if (lane === 'webgl') return 'WebGL texture';
  if (lane === 'webgpu') return 'WebGPU texture';
  return 'Worker snapshot';
}
