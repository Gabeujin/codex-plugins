import { describe, expect, it } from 'vitest';
import { workerReceiptRetirement } from './WorkerSurface';

describe('worker receipt terminal retirement', () => {
  it('keeps the worker active only after transform, alignment, and close all pass', () => {
    expect(workerReceiptRetirement(true, 'pass', true)).toEqual({
      retire: false,
      failure: 'none',
      lastError: null,
    });
  });

  it.each([
    [false, 'unmeasured', true, 'upload-failed', 'worker-transform-rejected'],
    [true, 'fail', true, 'alignment-drift', 'worker-alignment-drift'],
    [true, 'pass', false, 'upload-failed', 'worker-element-image-close-unconfirmed'],
  ] as const)(
    'retires transform=%s alignment=%s closed=%s',
    (transformValid, alignmentStatus, closed, failure, lastError) => {
      expect(workerReceiptRetirement(transformValid, alignmentStatus, closed)).toEqual({
        retire: true,
        failure,
        lastError,
      });
    },
  );
});
