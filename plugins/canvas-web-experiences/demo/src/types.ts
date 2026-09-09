export type DemoId =
  | 'portfolio'
  | 'motion'
  | 'game'
  | 'spatial'
  | 'map'
  | 'diagram'
  | 'floorplan'
  | 'data'
  | 'media'
  | 'science'
  | 'commerce'
  | 'twin';

export type RendererKind = 'Canvas 2D' | 'SVG + Canvas' | 'WebGL' | 'WebGPU' | 'Hybrid';

export type DemoDefinition = {
  id: DemoId;
  index: string;
  eyebrow: string;
  title: string;
  shortTitle: string;
  icon: string;
  renderer: RendererKind;
  description: string;
  instruction: string;
  accent: string;
  metrics: Array<{ label: string; value: string }>;
  controls: ControlDefinition[];
};

export type ControlDefinition =
  | { type: 'range'; key: string; label: string; min: number; max: number; step: number; value: number; suffix?: string }
  | { type: 'select'; key: string; label: string; value: string; options: string[] }
  | { type: 'toggle'; key: string; label: string; value: boolean }
  | { type: 'button'; key: string; label: string };

export type DemoState = Record<string, string | number | boolean>;

export type PointerState = {
  x: number;
  y: number;
  pressX: number;
  pressY: number;
  down: boolean;
  pressed: boolean;
  released: boolean;
  dragX: number;
  dragY: number;
};

export type SceneRuntimeState = Record<string, number>;

export type SceneTelemetry = {
  fps: number;
  frameMs: number;
  dpr: number;
  width: number;
  height: number;
  renderer: RendererKind;
  frameSampleCount?: number;
  frameP50Ms?: number;
  frameP95Ms?: number;
  frameP99Ms?: number;
  frameMaxMs?: number;
  droppedFrameRatio?: number;
  rawFrameSampleCount?: number;
  rawFrameP95Ms?: number;
  rawFrameMaxMs?: number;
  suspensionGapCount?: number;
  longTaskCount?: number;
  longTaskTotalMs?: number;
  longTaskMaxMs?: number;
  jsHeapUsedBytes?: number | null;
};
