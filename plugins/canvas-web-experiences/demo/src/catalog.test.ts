import { describe, expect, it } from 'vitest';
import { DEMOS } from './catalog';

describe('12-domain demo accessibility contract', () => {
  it('ships 12 unique, addressable experiments', () => {
    expect(DEMOS).toHaveLength(12);
    expect(new Set(DEMOS.map((demo) => demo.id)).size).toBe(12);
    expect(new Set(DEMOS.map((demo) => demo.index)).size).toBe(12);
  });

  it('gives every canvas a text equivalent, instruction, metrics, and named controls', () => {
    for (const demo of DEMOS) {
      expect(demo.title.length).toBeGreaterThan(8);
      expect(demo.description.length).toBeGreaterThan(18);
      expect(demo.instruction.length).toBeGreaterThan(12);
      expect(demo.metrics.length).toBeGreaterThanOrEqual(3);
      expect(demo.controls.length).toBeGreaterThanOrEqual(3);
      expect(new Set(demo.controls.map((control) => control.label)).size).toBe(demo.controls.length);
      expect(demo.controls.every((control) => control.label.trim().length > 0)).toBe(true);
    }
  });

  it('keeps form primitives deterministic and keyboard-operable', () => {
    for (const control of DEMOS.flatMap((demo) => demo.controls)) {
      if (control.type === 'range') {
        expect(control.min).toBeLessThan(control.max);
        expect(control.value).toBeGreaterThanOrEqual(control.min);
        expect(control.value).toBeLessThanOrEqual(control.max);
        expect(control.step).toBeGreaterThan(0);
      }
      if (control.type === 'select') {
        expect(control.options).toContain(control.value);
        expect(new Set(control.options).size).toBe(control.options.length);
      }
    }
  });

  it('groups user-visible quantities with four or more whole-number digits', () => {
    const displayed = DEMOS.flatMap((demo) => demo.metrics.map((metric) => metric.value));
    expect(displayed).toContain('18,420');
    expect(displayed).toContain('4,380');
    expect(displayed).toContain('1,280 × 720');
    expect(displayed).toContain('₩248,000');
  });
});
