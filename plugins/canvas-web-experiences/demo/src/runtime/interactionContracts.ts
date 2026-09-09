import type { PointerState } from '../types';

export function createPointerState(): PointerState {
  return { x: 0, y: 0, pressX: 0, pressY: 0, down: false, dragX: 0, dragY: 0, pressed: false, released: false };
}

export function updatePointerState(previous: PointerState, x: number, y: number, down?: boolean): PointerState {
  const startedGesture = down === true;
  const endedGesture = down === false && previous.down;
  const gestureWasActive = previous.down && !startedGesture;
  const deltaX = gestureWasActive ? x - previous.x : 0;
  const deltaY = gestureWasActive ? y - previous.y : 0;
  return {
    x,
    y,
    // A pointer-down establishes the drag baseline. Subsequent movement is
    // accumulated until the render frame clears it, so a full down/move/up
    // burst received between two frames cannot lose its orbit delta.
    pressX: startedGesture ? x : previous.pressX,
    pressY: startedGesture ? y : previous.pressY,
    down: down ?? previous.down,
    dragX: startedGesture ? 0 : previous.dragX + deltaX,
    dragY: startedGesture ? 0 : previous.dragY + deltaY,
    pressed: startedGesture ? true : previous.pressed,
    released: endedGesture || previous.released,
  };
}

export function zoomAfterWheel(current: number, deltaY: number): number {
  return Math.max(50, Math.min(240, current + (deltaY > 0 ? -10 : 10)));
}

export function nextScienceAttempts(current: number | undefined): number {
  return Math.max(1, Math.round(current ?? 1)) + 1;
}
