import { describe, expect, it } from 'vitest';
import { applySceneKeyboardCommand, SCENE_KEYBOARD_HELP } from './sceneKeyboard';
import type { DemoId, SceneRuntimeState } from '../types';

describe('scene keyboard contracts', () => {
  it('documents and handles a primary keyboard command for all 12 domains', () => {
    const commands: Record<DemoId, { key: string; shiftKey?: boolean }> = {
      portfolio: { key: 'ArrowRight' },
      motion: { key: 'ArrowRight' },
      game: { key: 'd' },
      spatial: { key: 'ArrowRight' },
      map: { key: '+' },
      diagram: { key: 'ArrowRight' },
      floorplan: { key: 'ArrowRight' },
      data: { key: 'ArrowRight' },
      media: { key: ' ' },
      science: { key: 'ArrowRight' },
      commerce: { key: 'ArrowRight' },
      twin: { key: 'ArrowRight' },
    };

    for (const [id, command] of Object.entries(commands) as Array<[DemoId, { key: string; shiftKey?: boolean }]>) {
      const model: SceneRuntimeState = {};
      const outcome = applySceneKeyboardCommand({
        id,
        key: command.key,
        shiftKey: Boolean(command.shiftKey),
        model,
        state: {},
        width: 1_280,
        height: 720,
      });
      expect(SCENE_KEYBOARD_HELP[id].length, id).toBeGreaterThan(20);
      expect(outcome.handled, id).toBe(true);
      expect(Object.keys(model).length + outcome.changes.length + Number(Boolean(outcome.action)), id).toBeGreaterThan(0);
    }
  });

  it('supports geometry edits, bounded ranges, and the Twin acknowledgement action', () => {
    const portfolio: SceneRuntimeState = { selectedNode: 2 };
    expect(applySceneKeyboardCommand({ id: 'portfolio', key: 'ArrowUp', shiftKey: true, model: portfolio, state: {}, width: 800, height: 500 }).handled).toBe(true);
    expect(portfolio.portfolioNode2Y).toBe(-12);

    const data = applySceneKeyboardCommand({ id: 'data', key: 'ArrowRight', shiftKey: true, model: {}, state: { brushStartPercent: 31, brushEndPercent: 78 }, width: 800, height: 500 });
    expect(data.changes).toEqual([{ key: 'brushEndPercent', value: 80 }]);

    const twin = applySceneKeyboardCommand({ id: 'twin', key: 'Enter', shiftKey: false, model: {}, state: {}, width: 800, height: 500 });
    expect(twin).toMatchObject({ handled: true, action: 'acknowledge' });
  });

  it('controls WebGL-owned spatial and commerce orientation without changing business state', () => {
    const spatial: SceneRuntimeState = { selectedArtwork: 4 };
    expect(applySceneKeyboardCommand({ id: 'spatial', key: 'ArrowRight', shiftKey: false, model: spatial, state: {}, width: 800, height: 500 }).handled).toBe(true);
    expect(applySceneKeyboardCommand({ id: 'spatial', key: 'ArrowDown', shiftKey: false, model: spatial, state: {}, width: 800, height: 500 }).handled).toBe(true);
    expect(spatial).toMatchObject({ selectedArtwork: 4, orbit: .12, orbitPitch: .08 });
    applySceneKeyboardCommand({ id: 'spatial', key: 'Home', shiftKey: false, model: spatial, state: {}, width: 800, height: 500 });
    expect(spatial).toMatchObject({ orbit: 0, orbitPitch: 0 });

    const commerce: SceneRuntimeState = {};
    applySceneKeyboardCommand({ id: 'commerce', key: 'ArrowRight', shiftKey: false, model: commerce, state: {}, width: 800, height: 500 });
    applySceneKeyboardCommand({ id: 'commerce', key: 'ArrowUp', shiftKey: false, model: commerce, state: {}, width: 800, height: 500 });
    expect(commerce).toMatchObject({ productRotation: .12, productPitch: -.08 });
    applySceneKeyboardCommand({ id: 'commerce', key: 'Home', shiftKey: false, model: commerce, state: {}, width: 800, height: 500 });
    expect(commerce).toMatchObject({ productRotation: 0, productPitch: 0 });
  });
});
