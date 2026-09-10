import type { HtmlCanvasMode, HtmlCanvasRequest } from './htmlInCanvas';

export type ExperiencePath = 'stable' | 'experiment';

export function effectiveSurfaceRequest(path: ExperiencePath, requested: HtmlCanvasRequest): HtmlCanvasRequest {
  return path === 'stable' ? 'dom-overlay' : requested;
}

export function experiencePathStatus(path: ExperiencePath, mode: HtmlCanvasMode, nativeReady: boolean): string {
  if (path === 'stable') return '안정 경로: 현재 브라우저에서 DOM 대체 경로로 과업을 조작할 수 있습니다.';
  if (mode === 'disabled') return '실험 경로가 꺼져 있습니다. 안정 DOM 경로로 돌아가 과업을 계속할 수 있습니다.';
  if (mode === 'dom-overlay') return '현재 브라우저에서는 대체 경로로 조작할 수 있습니다. 네이티브 실험은 아직 확인되지 않았습니다.';
  if (nativeReady) return '이 브라우저 세션에서 네이티브 paint 경로가 준비되었습니다. 릴리스 주장은 별도 실행 영수증이 필요합니다.';
  return '현재 브라우저에서는 대체 경로로 조작할 수 있습니다. 네이티브 실험은 아직 확인되지 않았습니다.';
}
