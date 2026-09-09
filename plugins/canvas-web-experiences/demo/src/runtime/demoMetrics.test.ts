import { describe, expect, it } from 'vitest';
import { DEMO_BY_ID, createInitialState } from '../catalog';
import { countCollectedSignals, countTwinAlarms, formatElapsed, liveMetricValue } from './demoMetrics';

const telemetry = { fps: 58.6, frameMs: 17.1, dpr: 1, width: 1200, height: 600, renderer: 'Canvas 2D' as const };

describe('live demo metrics', () => {
  it('counts collected game signals from the runtime bitmask', () => {
    expect(countCollectedSignals(1)).toBe(1);
    expect(countCollectedSignals(0b101011)).toBe(4);
    expect(countCollectedSignals(63)).toBe(6);
  });
  it('keeps game canvas state and semantic metrics synchronized', () => {
    const demo = DEMO_BY_ID.get('game')!;
    const state = createInitialState(demo);
    expect(liveMetricValue(demo, state, { collected: 0b111, elapsedSeconds: 65 }, telemetry, 0)).toBe('3 / 6');
    expect(liveMetricValue(demo, state, { collected: 0b111, elapsedSeconds: 65 }, telemetry, 1)).toBe('01:05');
  });

  it('switches data values and units with the selected metric', () => {
    const demo = DEMO_BY_ID.get('data')!;
    const state = { ...createInitialState(demo), metric: '탄소' };
    expect(liveMetricValue(demo, state, {}, telemetry, 1)).toBe('421ppm');
  });

  it('reports live media, floor-plan, science, commerce, and twin values', () => {
    const media = DEMO_BY_ID.get('media')!;
    expect(liveMetricValue(media, createInitialState(media), {}, telemetry, 2)).toBe('59 FPS');
    expect(liveMetricValue(media, { ...createInitialState(media), playing: false }, {}, telemetry, 2)).toBe('일시 정지');

    const floorplan = DEMO_BY_ID.get('floorplan')!;
    expect(liveMetricValue(floorplan, createInitialState(floorplan), { areaSqm: 72.345 }, telemetry, 0)).toBe('72.3㎡');

    const science = DEMO_BY_ID.get('science')!;
    expect(liveMetricValue(science, createInitialState(science), { attempts: 4 }, telemetry, 2)).toBe('4');

    const commerce = DEMO_BY_ID.get('commerce')!;
    expect(liveMetricValue(commerce, { ...createInitialState(commerce), material: 'Metal' }, { productAngle: 187.8 }, telemetry, 0)).toBe('Metal');
    expect(liveMetricValue(commerce, createInitialState(commerce), { productAngle: 187.8 }, telemetry, 1)).toBe('188°');

    const twin = DEMO_BY_ID.get('twin')!;
    expect(countTwinAlarms(72)).toBeGreaterThan(0);
    expect(liveMetricValue(twin, { ...createInitialState(twin), acknowledged: true }, {}, telemetry, 2)).toBe('0');
  });

  it('formats elapsed time without exposing invalid values', () => {
    expect(formatElapsed(-4)).toBe('00:00');
    expect(formatElapsed(3671)).toBe('61:11');
  });
});
