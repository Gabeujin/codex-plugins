import { describe, expect, it } from 'vitest';
import { DEMOS, createInitialState } from '../catalog';
import { DOMAIN_SURFACES } from './surfaceCatalog';
import { resolveSurfaceBinding, surfaceArchetypes } from './surfaceBindings';

describe('scene-bound semantic surfaces', () => {
  it('assigns all 12 domains a distinct semantic archetype', () => {
    const archetypes = surfaceArchetypes();
    expect(archetypes).toHaveLength(12);
    expect(new Set(archetypes).size).toBe(12);
  });

  it('keeps desktop bindings inside the scene while moving with the selected object', () => {
    for (const demo of DEMOS) {
      const first = resolveSurfaceBinding(
        demo.id,
        DOMAIN_SURFACES[demo.id].lane,
        1_280,
        720,
        { surfaceAnchorX: 300, surfaceAnchorY: 260 },
        createInitialState(demo),
        'dom-overlay',
      );
      const moved = resolveSurfaceBinding(
        demo.id,
        DOMAIN_SURFACES[demo.id].lane,
        1_280,
        720,
        { surfaceAnchorX: 760, surfaceAnchorY: 420 },
        createInitialState(demo),
        'dom-overlay',
      );
      expect(first.placement.x).toBeGreaterThanOrEqual(18);
      expect(first.placement.y).toBeGreaterThanOrEqual(18);
      expect(first.placement.x + first.placement.width).toBeLessThanOrEqual(1_262);
      expect(first.placement.y + first.placement.height).toBeLessThanOrEqual(702);
      expect([first.placement.x, first.placement.y]).not.toEqual([moved.placement.x, moved.placement.y]);
    }
  });

  it('uses a scene-first bounded sheet at 390px', () => {
    for (const demo of DEMOS) {
      const binding = resolveSurfaceBinding(
        demo.id,
        DOMAIN_SURFACES[demo.id].lane,
        390,
        640,
        {},
        createInitialState(demo),
        'dom-overlay',
      );
      expect(binding.docked).toBe(true);
      expect(binding.placement.x).toBe(12);
      expect(binding.placement.width).toBe(366);
      expect(binding.placement.height).toBeLessThanOrEqual(320);
      expect(binding.placement.y + binding.placement.height).toBeLessThanOrEqual(628);
    }
  });
});
