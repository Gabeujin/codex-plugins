import type { DemoId, DemoState, SceneRuntimeState } from '../types';

export type SceneKeyboardInput = {
  id: DemoId;
  key: string;
  shiftKey: boolean;
  model: SceneRuntimeState;
  state: DemoState;
  width: number;
  height: number;
};

export type SceneKeyboardResult = {
  handled: boolean;
  changes: Array<{ key: string; value: string | number | boolean }>;
  action?: string;
};

const result = (handled = false): SceneKeyboardResult => ({ handled, changes: [] });
const numeric = (state: DemoState, key: string, fallback: number) => Number(state[key] ?? fallback);
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const wrap = (value: number, count: number) => (value % count + count) % count;

export const SCENE_KEYBOARD_HELP: Record<DemoId, string> = {
  portfolio: '좌우 방향키로 프로젝트를 선택하고 Shift와 방향키로 선택 노드를 이동합니다.',
  motion: '방향키로 모션 곡선의 제어점을 이동합니다.',
  game: '방향키 또는 WASD로 플레이어를 이동합니다.',
  spatial: '좌우 방향키로 작품 시점을 회전하고 위아래 방향키로 피치를 조절하며 Home으로 초기화합니다.',
  map: '방향키로 지도를 이동하고 더하기·빼기 키로 확대·축소합니다.',
  diagram: '좌우 방향키로 노드를 선택하고 Shift와 방향키로 선택 노드를 이동합니다.',
  floorplan: '방향키로 우하단 모서리를 그리드 단위로 조절합니다.',
  data: '좌우 방향키로 선택 구간을 이동하고 Shift와 좌우 방향키로 끝점을 조절합니다.',
  media: '좌우 방향키로 5초 이동하고 스페이스 키로 재생·정지합니다.',
  science: '좌우 방향키로 궤도 단계를 바꾸고 위아래 방향키로 속도를 조절합니다.',
  commerce: '좌우 방향키로 제품을 회전하고 위아래 방향키로 피치를 조절하며 Home으로 초기화합니다.',
  twin: '좌우 방향키로 설비를 선택하고 위아래 방향키로 임계값을 조절하며 Enter로 경보를 확인합니다.',
};

export function applySceneKeyboardCommand(input: SceneKeyboardInput): SceneKeyboardResult {
  const { id, key, shiftKey, model, state, width, height } = input;
  const output = result();
  const setChange = (changeKey: string, value: string | number | boolean) => {
    output.handled = true;
    output.changes.push({ key: changeKey, value });
  };

  if (id === 'portfolio') {
    const selected = Math.floor(model.selectedNode ?? 0);
    if (shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
      const dx = key === 'ArrowLeft' ? -12 : key === 'ArrowRight' ? 12 : 0;
      const dy = key === 'ArrowUp' ? -12 : key === 'ArrowDown' ? 12 : 0;
      model[`portfolioNode${selected}X`] = (model[`portfolioNode${selected}X`] ?? 0) + dx;
      model[`portfolioNode${selected}Y`] = (model[`portfolioNode${selected}Y`] ?? 0) + dy;
      return result(true);
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      model.selectedNode = wrap(selected + (key === 'ArrowRight' ? 1 : -1), 24);
      return result(true);
    }
  }

  if (id === 'motion' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
    const margin = Math.max(44, width * .09);
    model.motionHandleX = clamp((model.motionHandleX ?? width * .62) + (key === 'ArrowLeft' ? -14 : key === 'ArrowRight' ? 14 : 0), margin, width - margin);
    model.motionHandleY = clamp((model.motionHandleY ?? height * .28) + (key === 'ArrowUp' ? -14 : key === 'ArrowDown' ? 14 : 0), margin, height - margin);
    return result(true);
  }

  if (id === 'game') {
    const step = numeric(state, 'speed', 6) * 5;
    if (['ArrowLeft', 'a', 'A'].includes(key)) model.playerX = Math.max(24, (model.playerX ?? width * .2) - step);
    else if (['ArrowRight', 'd', 'D'].includes(key)) model.playerX = Math.min(width, (model.playerX ?? width * .2) + step);
    else if (['ArrowUp', 'w', 'W'].includes(key)) model.playerY = Math.max(24, (model.playerY ?? height * .62) - step);
    else if (['ArrowDown', 's', 'S'].includes(key)) model.playerY = Math.min(height, (model.playerY ?? height * .62) + step);
    else return output;
    return result(true);
  }

  if (id === 'spatial') {
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      model.orbit = (model.orbit ?? 0) + (key === 'ArrowRight' ? .12 : -.12);
      return result(true);
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      model.orbitPitch = clamp((model.orbitPitch ?? 0) + (key === 'ArrowUp' ? -.08 : .08), -1.45, 1.45);
      return result(true);
    }
    if (key === 'Home') { model.orbit = 0; model.orbitPitch = 0; return result(true); }
  }

  if (id === 'map') {
    if (key === '+' || key === '=') setChange('zoom', Math.min(240, numeric(state, 'zoom', 100) + 10));
    else if (key === '-' || key === '_') setChange('zoom', Math.max(50, numeric(state, 'zoom', 100) - 10));
    else if (key === 'ArrowLeft') { model.mapX = (model.mapX ?? 0) + 18; output.handled = true; }
    else if (key === 'ArrowRight') { model.mapX = (model.mapX ?? 0) - 18; output.handled = true; }
    else if (key === 'ArrowUp') { model.mapY = (model.mapY ?? 0) + 18; output.handled = true; }
    else if (key === 'ArrowDown') { model.mapY = (model.mapY ?? 0) - 18; output.handled = true; }
    return output;
  }

  if (id === 'diagram') {
    const selected = Math.floor(model.selectedNode ?? 4);
    if (shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
      const dx = key === 'ArrowLeft' ? -12 : key === 'ArrowRight' ? 12 : 0;
      const dy = key === 'ArrowUp' ? -12 : key === 'ArrowDown' ? 12 : 0;
      model[`node${selected}X`] = clamp((model[`node${selected}X`] ?? model.surfaceAnchorX ?? width / 2) + dx, 42, width - 42);
      model[`node${selected}Y`] = clamp((model[`node${selected}Y`] ?? model.surfaceAnchorY ?? height / 2) + dy, 24, height - 24);
      return result(true);
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      model.selectedNode = wrap(selected + (key === 'ArrowRight' ? 1 : -1), 8);
      return result(true);
    }
  }

  if (id === 'floorplan' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
    const step = Math.max(18, Math.min(58, numeric(state, 'grid', 500) / 12));
    model.cornerX = clamp((model.cornerX ?? width * .72) + (key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0), width * .16 + 150, width - 28);
    model.cornerY = clamp((model.cornerY ?? height * .72) + (key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0), height * .18 + 130, height - 28);
    return result(true);
  }

  if (id === 'data' && (key === 'ArrowLeft' || key === 'ArrowRight')) {
    const delta = key === 'ArrowRight' ? 2 : -2;
    const start = clamp(numeric(state, 'brushStartPercent', 22), 0, 99);
    const end = clamp(numeric(state, 'brushEndPercent', 64), start + 1, 100);
    if (shiftKey) setChange('brushEndPercent', clamp(end + delta, start + 1, 100));
    else {
      const widthPercent = end - start;
      const nextStart = clamp(start + delta, 0, 100 - widthPercent);
      setChange('brushStartPercent', nextStart);
      setChange('brushEndPercent', nextStart + widthPercent);
    }
    return output;
  }

  if (id === 'media') {
    if (key === 'ArrowLeft' || key === 'ArrowRight') setChange('currentTime', clamp(numeric(state, 'currentTime', 42) + (key === 'ArrowRight' ? 5 : -5), 0, 120));
    else if (key === ' ') setChange('playing', !Boolean(state.playing ?? true));
    return output;
  }

  if (id === 'science') {
    if (key === 'ArrowLeft' || key === 'ArrowRight') setChange('orbitStep', Math.max(0, numeric(state, 'orbitStep', 0) + (key === 'ArrowRight' ? 1 : -1)));
    else if (key === 'ArrowUp' || key === 'ArrowDown') setChange('velocity', clamp(numeric(state, 'velocity', 92) + (key === 'ArrowUp' ? 2 : -2), 45, 150));
    return output;
  }

  if (id === 'commerce') {
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      model.productRotation = (model.productRotation ?? 0) + (key === 'ArrowRight' ? .12 : -.12);
      return result(true);
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') { model.productPitch = clamp((model.productPitch ?? 0) + (key === 'ArrowUp' ? -.08 : .08), -1.45, 1.45); return result(true); }
    if (key === 'Home') { model.productRotation = 0; model.productPitch = 0; return result(true); }
    return output;
  }

  if (id === 'twin') {
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      model.selectedEquipment = wrap(Math.floor(model.selectedEquipment ?? 3) + (key === 'ArrowRight' ? 1 : -1), 18);
      return result(true);
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') setChange('threshold', clamp(numeric(state, 'threshold', 72) + (key === 'ArrowUp' ? 2 : -2), 40, 95));
    else if (key === 'Enter') { output.handled = true; output.action = 'acknowledge'; }
    return output;
  }

  return output;
}
