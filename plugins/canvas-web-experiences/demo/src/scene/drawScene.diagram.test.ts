import { describe, expect, it } from 'vitest';
import { diagramLayoutNodes, diagramLayoutSignature } from './drawScene';

describe('diagram layout reset inputs', () => {
  it('recomputes Flow node positions when spacing changes', () => {
    const compact = diagramLayoutNodes('Flow', 60, 1_280, 720);
    const spread = diagramLayoutNodes('Flow', 180, 1_280, 720);

    expect(compact).toHaveLength(8);
    expect(spread).toHaveLength(8);
    expect(spread[0].x).not.toBe(compact[0].x);
    expect(spread[0].y).not.toBe(compact[0].y);
    expect(diagramLayoutSignature('Flow', 180, 0, 1_280, 720)).not.toBe(
      diagramLayoutSignature('Flow', 60, 0, 1_280, 720),
    );
  });

  it('treats a new automatic-layout epoch as a reset request', () => {
    expect(diagramLayoutSignature('Flow', 110, 1, 1_280, 720)).not.toBe(
      diagramLayoutSignature('Flow', 110, 0, 1_280, 720),
    );
  });

  it('returns deterministic positions for every supported layout', () => {
    for (const layout of ['Flow', 'Radial', 'Stack']) {
      expect(diagramLayoutNodes(layout, 110, 1_280, 720)).toEqual(
        diagramLayoutNodes(layout, 110, 1_280, 720),
      );
    }
  });
});
