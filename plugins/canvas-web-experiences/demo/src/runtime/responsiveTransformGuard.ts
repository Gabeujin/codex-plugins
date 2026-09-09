import type { HtmlCanvasFailure, HtmlCanvasMode, HtmlSurfaceLane, SnapshotPhase } from './htmlInCanvas';

export const CANVAS_2D_RESPONSIVE_GUARD_MAX_WIDTH = 360;
export const MOBILE_SCENE_BREAKPOINT = 820;

export function initialSceneSize(viewportWidth: number, viewportHeight: number): { width: number; height: number } {
  if (viewportWidth <= MOBILE_SCENE_BREAKPOINT) {
    return {
      width: Math.max(280, viewportWidth + 16),
      height: Math.max(360, viewportHeight - 247),
    };
  }
  return { width: 1_280, height: 720 };
}

export function applyResponsiveTransformGuard(
  mode: HtmlCanvasMode,
  lane: HtmlSurfaceLane,
  viewportWidth: number,
): HtmlCanvasMode {
  if (
    mode === 'native-2d'
    && lane === 'canvas-2d'
    && viewportWidth <= CANVAS_2D_RESPONSIVE_GUARD_MAX_WIDTH
  ) {
    return 'dom-overlay';
  }
  return mode;
}

export function isResponsiveTransformGuardActive(
  requestedMode: HtmlCanvasMode,
  resolvedMode: HtmlCanvasMode,
): boolean {
  return requestedMode === 'native-2d' && resolvedMode === 'dom-overlay';
}

export function shouldShowSemanticFallback(
  mode: HtmlCanvasMode,
  ready: boolean,
  snapshotPhase: SnapshotPhase,
  failure: HtmlCanvasFailure,
): boolean {
  if (mode === 'dom-overlay') return true;
  if (!mode.startsWith('native-')) return false;
  return !ready || snapshotPhase !== 'current' || failure !== 'none';
}
