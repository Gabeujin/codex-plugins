import { describe, expect, it } from 'vitest';
import { createPointerState, nextScienceAttempts, updatePointerState, zoomAfterWheel } from './interactionContracts';

describe('interaction contracts', () => {
  it('accumulates a complete drag burst, including the release move, until render consumes it', () => {
    const down = updatePointerState(createPointerState(), 20, 30, true);
    const moved = updatePointerState(down, 80, 95);
    const released = updatePointerState(moved, 100, 120, false);

    expect(down).toMatchObject({ dragX: 0, dragY: 0 });
    expect(released).toMatchObject({ pressX: 20, pressY: 30, x: 100, y: 120, down: false, pressed: true, released: true, dragX: 80, dragY: 90 });
  });

  it('does not manufacture drag deltas for hover movement', () => {
    const hovered = updatePointerState(createPointerState(), 870, 350);
    const hoveredAgain = updatePointerState(hovered, 1_120, 425);

    expect(hoveredAgain).toMatchObject({ down: false, pressed: false, released: false, dragX: 0, dragY: 0 });
  });

  it('keeps wheel zoom on the declared 50 to 240 percent range', () => {
    expect(zoomAfterWheel(100, -120)).toBe(110);
    expect(zoomAfterWheel(240, -120)).toBe(240);
    expect(zoomAfterWheel(50, 120)).toBe(50);
  });

  it('counts each science parameter change as another experiment', () => {
    expect(nextScienceAttempts(undefined)).toBe(2);
    expect(nextScienceAttempts(4)).toBe(5);
  });
});
