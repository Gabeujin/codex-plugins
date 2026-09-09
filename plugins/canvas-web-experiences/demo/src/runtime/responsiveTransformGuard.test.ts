import { describe, expect, it } from 'vitest';
import {
  applyResponsiveTransformGuard,
  CANVAS_2D_RESPONSIVE_GUARD_MAX_WIDTH,
  initialSceneSize,
  isResponsiveTransformGuardActive,
  shouldShowSemanticFallback,
} from './responsiveTransformGuard';

describe('responsive HTML-in-Canvas transform guard', () => {
  it('fails closed to the semantic DOM surface for native Canvas 2D at narrow widths', () => {
    const resolved = applyResponsiveTransformGuard('native-2d', 'canvas-2d', 320);

    expect(resolved).toBe('dom-overlay');
    expect(isResponsiveTransformGuardActive('native-2d', resolved)).toBe(true);
  });

  it('keeps the native Canvas 2D path above the guarded width', () => {
    expect(applyResponsiveTransformGuard(
      'native-2d',
      'canvas-2d',
      CANVAS_2D_RESPONSIVE_GUARD_MAX_WIDTH + 1,
    )).toBe('native-2d');
  });

  it('never changes explicit fallback, disabled, or non-Canvas-2D lanes', () => {
    expect(applyResponsiveTransformGuard('dom-overlay', 'canvas-2d', 320)).toBe('dom-overlay');
    expect(applyResponsiveTransformGuard('disabled', 'canvas-2d', 320)).toBe('disabled');
    expect(applyResponsiveTransformGuard('native-webgl', 'webgl', 320)).toBe('native-webgl');
    expect(applyResponsiveTransformGuard('native-webgpu', 'webgpu', 320)).toBe('native-webgpu');
    expect(applyResponsiveTransformGuard('native-worker', 'worker', 320)).toBe('native-worker');
  });

  it('bootstraps mobile bindings from the real viewport before telemetry arrives', () => {
    expect(initialSceneSize(390, 844)).toEqual({ width: 406, height: 597 });
    expect(initialSceneSize(320, 844)).toEqual({ width: 336, height: 597 });
    expect(initialSceneSize(1_920, 903)).toEqual({ width: 1_280, height: 720 });
  });

  it('classifies when native proof is unsettled without controlling companion visibility', () => {
    expect(shouldShowSemanticFallback('native-2d', false, 'awaiting-first', 'none')).toBe(true);
    expect(shouldShowSemanticFallback('native-webgpu', true, 'next-frame-pending', 'none')).toBe(true);
    expect(shouldShowSemanticFallback('native-worker', false, 'failed', 'upload-failed')).toBe(true);
    expect(shouldShowSemanticFallback('native-webgl', true, 'current', 'none')).toBe(false);
    expect(shouldShowSemanticFallback('dom-overlay', true, 'current', 'none')).toBe(true);
    expect(shouldShowSemanticFallback('disabled', false, 'failed', 'killed')).toBe(false);
  });
});
