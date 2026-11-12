import { describe, expect, it } from 'vitest';
import {
  MASH,
  TIMING,
  inTimingZone,
  mashProgress,
  mashResult,
  needlePosition,
  timingResult,
  timingTimeoutMs,
} from '../src/ui/skills';

const P = TIMING.periodMs;

describe('needlePosition', () => {
  it('is a triangle wave: 0, then 1 at half a period, then back to 0', () => {
    expect(needlePosition(0, P)).toBe(0);
    expect(needlePosition(P / 4, P)).toBeCloseTo(0.5);
    expect(needlePosition(P / 2, P)).toBeCloseTo(1);
    expect(needlePosition((3 * P) / 4, P)).toBeCloseTo(0.5);
    expect(needlePosition(P, P)).toBeCloseTo(0);
    expect(needlePosition(P + P / 4, P)).toBeCloseTo(0.5);
  });

  it('stays in [0, 1] and tolerates a zero period', () => {
    for (let t = -500; t < 5000; t += 37) {
      const v = needlePosition(t, P);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(needlePosition(100, 0)).toBe(0);
  });
});

describe('timing check', () => {
  it('succeeds inside the zone and fails outside', () => {
    expect(inTimingZone(0.5)).toBe(true);
    expect(inTimingZone(TIMING.zoneStart)).toBe(true);
    expect(inTimingZone(TIMING.zoneEnd)).toBe(true);
    expect(inTimingZone(0.39)).toBe(false);
    expect(inTimingZone(0.95)).toBe(false);
    expect(timingResult(P / 4, P)).toBe('success'); // needle at 0.5 on the way out
    expect(timingResult((3 * P) / 4, P)).toBe('success'); // and on the way back
    expect(timingResult(0, P)).toBe('fail');
    expect(timingResult(P / 2, P)).toBe('fail');
  });

  it('fails after the allowed number of sweeps even if the needle is in the zone', () => {
    const timeout = timingTimeoutMs(P);
    expect(timeout).toBe(P * TIMING.maxSweeps);
    expect(timingResult(timeout + P / 4, P)).toBe('fail');
    expect(timingResult(timeout - P + P / 4, P)).toBe('success');
  });

  it('the reduced-motion needle is slower', () => {
    expect(TIMING.reducedPeriodMs).toBeGreaterThan(TIMING.periodMs);
  });
});

describe('mash check', () => {
  it('is pending until the first tap', () => {
    expect(mashResult(0, null, 99999)).toBe('pending');
  });

  it('succeeds with enough taps inside the window, counted from the first tap', () => {
    expect(mashResult(MASH.taps - 1, 1000, 1000 + MASH.windowMs - 1)).toBe('pending');
    expect(mashResult(MASH.taps, 1000, 1000 + MASH.windowMs)).toBe('success');
    expect(mashResult(MASH.taps, 1000, 1200)).toBe('success');
  });

  it('fails once the window closes without enough taps', () => {
    expect(mashResult(MASH.taps - 1, 1000, 1000 + MASH.windowMs)).toBe('fail');
    expect(mashResult(MASH.taps, 1000, 1000 + MASH.windowMs + 1)).toBe('fail');
  });

  it('reports progress in [0, 1]', () => {
    expect(mashProgress(0)).toBe(0);
    expect(mashProgress(MASH.taps / 2)).toBe(0.5);
    expect(mashProgress(MASH.taps * 3)).toBe(1);
  });
});
