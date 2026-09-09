import { describe, expect, it } from 'vitest';
import { createInitialState, DEMO_BY_ID } from '../catalog';
import { liveMetricValue } from './demoMetrics';

const telemetry = { fps: 60, frameMs: 16.7, dpr: 1, width: 1_280, height: 720, renderer: 'WebGL' as const };

describe('commerce quantity metric', () => {
  it('keeps the scene metric equal to the semantic configurator total', () => {
    const demo = DEMO_BY_ID.get('commerce')!;
    const initial = createInitialState(demo);
    expect(liveMetricValue(demo, initial, {}, telemetry, 2)).toBe('₩248,000');
    expect(liveMetricValue(demo, { ...initial, quantity: 3 }, {}, telemetry, 2)).toBe('₩744,000');
    expect(liveMetricValue(demo, { ...initial, quantity: 99 }, {}, telemetry, 2)).toBe('₩2,232,000');
  });
});
