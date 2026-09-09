import type { DemoDefinition, DemoState, SceneRuntimeState, SceneTelemetry } from '../types';

const DATA_METRICS: Record<string, [string, string, string]> = {
  '온도': ['4,380', '+1.7°C', '94%'],
  '강수': ['4,380', '+12.4mm', '91%'],
  '해수면': ['2,190', '+84mm', '93%'],
  '탄소': ['3,650', '421ppm', '97%'],
};

export function countTwinAlarms(threshold: number): number {
  return Array.from({ length: 18 }, (_, index) => 42 + ((index * 23) % 51)).filter((load) => load > threshold).length;
}

export function formatElapsed(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function countCollectedSignals(mask: number): number {
  return Math.max(0, Math.round(mask)).toString(2).split('').filter((bit) => bit === '1').length;
}

export function liveMetricValue(
  demo: DemoDefinition,
  state: DemoState,
  runtime: SceneRuntimeState,
  telemetry: SceneTelemetry,
  index: number,
): string {
  if (demo.id === 'motion' && index === 0) return `${Number(state.duration ?? 680).toLocaleString('ko-KR')}ms`;
  if (demo.id === 'game' && index === 0) return `${countCollectedSignals(runtime.collected ?? 0)} / 6`;
  if (demo.id === 'game' && index === 1) return formatElapsed(runtime.elapsedSeconds ?? 0);
  if (demo.id === 'spatial' && index === 1) return `${Math.round(Number(state.perspective ?? 42))}°`;
  if (demo.id === 'map' && index === 2) return `${(Number(state.zoom ?? 100) / 100).toFixed(1)}×`;
  if (demo.id === 'floorplan' && index === 0) return `${Number(runtime.areaSqm ?? 84.6).toFixed(1)}㎡`;
  if (demo.id === 'data') return (DATA_METRICS[String(state.metric ?? '온도')] ?? DATA_METRICS['온도'])[index];
  if (demo.id === 'media' && index === 1) return `${Math.max(1, Math.round(telemetry.width)).toLocaleString('ko-KR')} × ${Math.max(1, Math.round(telemetry.height)).toLocaleString('ko-KR')}`;
  if (demo.id === 'media' && index === 2) return Boolean(state.playing) ? `${Math.max(0, Math.round(telemetry.fps))} FPS` : '일시 정지';
  if (demo.id === 'science' && index === 0) {
    const gravity = Number(state.gravity ?? 100) / 100;
    const velocity = Number(state.velocity ?? 92) / 100;
    return `${(8.2 * Math.sqrt(1 / gravity) / Math.max(.45, velocity)).toFixed(1)}s`;
  }
  if (demo.id === 'science' && index === 1) {
    const gravity = Number(state.gravity ?? 100) / 100;
    const velocity = Number(state.velocity ?? 92) / 100;
    return Math.min(.98, Math.abs(1 - velocity / Math.sqrt(gravity))).toFixed(2);
  }
  if (demo.id === 'science' && index === 2) return String(Math.max(1, Math.round(Number(state.scienceAttempts ?? runtime.attempts ?? 1))));
  if (demo.id === 'commerce' && index === 0) return String(state.material ?? demo.metrics[index].value);
  if (demo.id === 'commerce' && index === 1) return `${Math.round(runtime.productAngle ?? 0)}°`;
  if (demo.id === 'commerce' && index === 2) {
    const quantity = Math.max(1, Math.min(9, Math.round(Number(state.quantity ?? 1))));
    return `₩${(248_000 * quantity).toLocaleString('ko-KR')}`;
  }
  if (demo.id === 'twin' && index === 2) return Boolean(state.acknowledged) ? '0' : String(Math.round(runtime.alarmCount ?? countTwinAlarms(Number(state.threshold ?? 72))));
  return demo.metrics[index].value;
}
