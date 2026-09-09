import { describe, expect, it } from 'vitest';
import {
  isDevWorkerFaultEnabled,
  isDevWorkerHardStallEnabled,
  shouldReportDevWorkerFault,
  shouldFailWorkerPaintWatchdog,
  workerTerminalOwnershipReceipt,
  WORKER_PAINT_WATCHDOG_MS,
  WORKER_RETIRE_GRACE_MS,
} from './WorkerSurface';

describe('worker HTML-in-Canvas recovery contract', () => {
  it('arms the controlled fault only for the explicit development query', () => {
    expect(isDevWorkerFaultEnabled(true, '?qa-worker-fault=1')).toBe(true);
    expect(isDevWorkerFaultEnabled(true, '?qa-worker-fault=0')).toBe(false);
    expect(isDevWorkerFaultEnabled(false, '?qa-worker-fault=1')).toBe(false);
    expect(isDevWorkerHardStallEnabled(true, '?qa-worker-hard-stall=1')).toBe(true);
    expect(isDevWorkerHardStallEnabled(true, '?qa-worker-hard-stall=0')).toBe(false);
    expect(isDevWorkerHardStallEnabled(false, '?qa-worker-hard-stall=1')).toBe(false);
  });

  it('reports the controlled fault exactly once after a native receipt', () => {
    expect(shouldReportDevWorkerFault(true, false)).toBe(true);
    expect(shouldReportDevWorkerFault(true, true)).toBe(false);
    expect(shouldReportDevWorkerFault(false, false)).toBe(false);
  });

  it('bounds a missing acknowledgement for the latest in-flight ElementImage', () => {
    expect(WORKER_PAINT_WATCHDOG_MS).toBeGreaterThan(0);
    expect(shouldFailWorkerPaintWatchdog(true, 7, 7, false)).toBe(true);
  });

  it('does not retire a completed, superseded, or already-retired worker route', () => {
    expect(shouldFailWorkerPaintWatchdog(false, 7, 7, false)).toBe(false);
    expect(shouldFailWorkerPaintWatchdog(true, 7, 8, false)).toBe(false);
    expect(shouldFailWorkerPaintWatchdog(true, 7, 7, true)).toBe(false);
  });

  it('accounts every transferred image when a worker must terminate', () => {
    expect(WORKER_RETIRE_GRACE_MS).toBeGreaterThan(0);
    expect(workerTerminalOwnershipReceipt(3, 2)).toEqual({
      explicitlyClosed: 2,
      terminalReleased: 1,
      outstanding: 0,
    });
    expect(workerTerminalOwnershipReceipt(2, 8)).toEqual({
      explicitlyClosed: 2,
      terminalReleased: 0,
      outstanding: 0,
    });
  });
});
