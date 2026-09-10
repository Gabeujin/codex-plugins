import { describe, expect, it } from 'vitest';
import { effectiveSurfaceRequest, experiencePathStatus } from './experiencePath';

describe('experience path', () => {
  it('keeps the stable path on the task-equivalent DOM fallback', () => {
    expect(effectiveSurfaceRequest('stable', 'native')).toBe('dom-overlay');
    expect(effectiveSurfaceRequest('experiment', 'native')).toBe('native');
  });

  it('does not promote a fallback or transient native state into a release claim', () => {
    expect(experiencePathStatus('stable', 'dom-overlay', false)).toContain('DOM 대체 경로');
    expect(experiencePathStatus('experiment', 'dom-overlay', false)).toContain('네이티브 실험은 아직 확인되지 않았습니다');
    expect(experiencePathStatus('experiment', 'native-webgl', true)).toContain('별도 실행 영수증');
  });
});
