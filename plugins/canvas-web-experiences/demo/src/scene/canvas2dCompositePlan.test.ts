import { describe, expect, it } from 'vitest';
import { createInitialState, DEMO_BY_ID } from '../catalog';
import { resolveSurfaceBinding } from '../runtime/surfaceBindings';
import type { DemoId, DemoState, SceneRuntimeState } from '../types';
import { buildCanvas2dCompositePlan } from './canvas2dCompositePlan';

const ids: DemoId[] = ['portfolio', 'game', 'map', 'diagram', 'data', 'science'];

function planFor(id: DemoId, statePatch: DemoState = {}, runtime: SceneRuntimeState = {}) {
  const demo = DEMO_BY_ID.get(id)!;
  const state = { ...createInitialState(demo), ...statePatch };
  const binding = resolveSurfaceBinding(id, 'canvas-2d', 1_280, 720, { surfaceAnchorX: 640, surfaceAnchorY: 360, ...runtime }, state, 'native-2d');
  return buildCanvas2dCompositePlan(id, state, { surfaceAnchorX: 640, surfaceAnchorY: 360, ...runtime }, binding);
}

describe('Canvas 2D HTML scene-composition plans', () => {
  it('gives all six 2D domains deterministic scene fragments and a foreground occluder', () => {
    for (const id of ids) {
      const first = planFor(id);
      const second = planFor(id);
      expect(first).toEqual(second);
      expect(first.id).toBe(`${id}-scene-composite-v1`);
      expect(first.fragments.length).toBeGreaterThan(0);
      expect(first.claim.length).toBeGreaterThan(64);
      expect(first.fragments.every((fragment) => fragment.alpha > 0 && fragment.alpha <= 1)).toBe(true);
    }
  });

  it('changes the gate aperture only after the durable authentication state changes', () => {
    const locked = planFor('game', { gateOpen: false });
    const open = planFor('game', { gateOpen: true });
    expect(locked.revision).not.toBe(open.revision);
    expect(locked.fragments[0].id).toBe('gate-portal-locked');
    expect(open.fragments[0].id).toBe('gate-portal-open');
    expect(open.foreground.active).toBe(true);
  });

  it('turns the selected portfolio artifact into three active constellation fragments', () => {
    const closed = planFor('portfolio', { selectedArtifact: 'Prototype', artifactOpen: false });
    const opened = planFor('portfolio', { selectedArtifact: 'System map', artifactOpen: true });
    expect(closed.fragments).toHaveLength(3);
    expect(opened.fragments).toHaveLength(3);
    expect(closed.revision).not.toBe(opened.revision);
    expect(closed.fragments.every((fragment) => fragment.alpha === .52)).toBe(true);
    expect(opened.fragments.every((fragment) => fragment.alpha === .9)).toBe(true);
    expect(closed.foreground.active).toBe(false);
    expect(opened.foreground.active).toBe(true);
  });

  it('maps language and severity into a different route ribbon plan', () => {
    const korean = planFor('map', { incidentSeverity: 'delay', routeLanguage: 'ko', mapPinned: true });
    const arabic = planFor('map', { incidentSeverity: 'evacuation', routeLanguage: 'ar', mapPinned: true });
    expect(korean.revision).not.toBe(arabic.revision);
    expect(korean.fragments[0].id).toContain('delay-ltr');
    expect(arabic.fragments[0].id).toContain('evacuation-rtl');
  });

  it('binds the data lens to durable keyboard-adjustable brush endpoints', () => {
    const narrow = planFor('data', { brushStartPercent: 32, brushEndPercent: 48 }, { chartLeft: 40, chartRight: 1_000, chartTop: 52, chartHeight: 320 });
    const wide = planFor('data', { brushStartPercent: 12, brushEndPercent: 82 }, { chartLeft: 40, chartRight: 1_000, chartTop: 52, chartHeight: 320 });
    expect(narrow.fragments[0].id).toBe('semantic-brush-32-48');
    expect(wide.foreground.extent).toBeGreaterThan(narrow.foreground.extent);
  });

  it('maps diagram validity and saved revision into node and edge composition', () => {
    const invalid = planFor('diagram', { schemaDraft: 'ElementImage SceneContract', nodeHealthy: true, nodeSaved: false, editRevision: 2 });
    const saved = planFor('diagram', { schemaDraft: 'ElementImage → SceneContract', nodeHealthy: true, nodeSaved: true, editRevision: 3 });
    expect(invalid.fragments[0].id).toBe('contract-node-invalid');
    expect(invalid.foreground.color).toBe('#ff6b55');
    expect(invalid.foreground.active).toBe(false);
    expect(saved.fragments[0].id).toBe('contract-node-valid');
    expect(saved.foreground.active).toBe(true);
    expect(saved.revision).not.toBe(invalid.revision);
  });

  it('adds a saved formula stamp without replacing the interactive primary surface', () => {
    const draft = planFor('science', { orbitHistory: '' });
    const saved = planFor('science', { orbitHistory: 'G100-V92-S1' });
    expect(draft.fragments).toHaveLength(1);
    expect(saved.fragments).toHaveLength(2);
    expect(saved.primaryPlacement).toEqual(draft.primaryPlacement);
  });
});
