import { describe, expect, it } from 'vitest';
import { resolveSurfaceBinding } from './surfaceBindings';

describe('mobile task surface expansion', () => {
  it('expands the docked surface without escaping the scene viewport', () => {
    const collapsed = resolveSurfaceBinding('portfolio', 'canvas-2d', 390, 656, {}, {}, 'native-2d');
    const expanded = resolveSurfaceBinding('portfolio', 'canvas-2d', 390, 656, {}, { sheetExpanded: true }, 'native-2d');

    expect(collapsed.docked).toBe(true);
    expect(expanded.placement.height).toBeGreaterThan(collapsed.placement.height);
    expect(expanded.placement.y).toBeGreaterThanOrEqual(12);
    expect(expanded.placement.y + expanded.placement.height).toBeLessThanOrEqual(656 - 12);
  });
});
