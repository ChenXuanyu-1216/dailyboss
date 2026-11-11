import type { SkillResult } from '../game/contracts';

/**
 * Pure rules for the skill-check mini-games. The UI measures time with `performance.now()`
 * timestamps (never frame counts), so results do not depend on the frame rate.
 * Only the result ('success' | 'fail') reaches the engine.
 */

export const TIMING = {
  /** One sweep: needle travels 0 → 1 → 0. */
  periodMs: 1600,
  /** Slower needle when the player prefers reduced motion. */
  reducedPeriodMs: 2600,
  /** Target zone, as a fraction of the track. */
  zoneStart: 0.4,
  zoneEnd: 0.6,
  /** Without a press, the check fails after this many sweeps. */
  maxSweeps: 3,
} as const;

export const MASH = {
  taps: 10,
  /** Time allowed, counted from the first tap. */
  windowMs: 3000,
} as const;

/** Needle position in [0, 1] as a triangle wave: 0 at t=0, 1 at half a period, 0 at a full period. */
export function needlePosition(elapsedMs: number, periodMs: number): number {
  if (periodMs <= 0) return 0;
  const t = (((elapsedMs % periodMs) + periodMs) % periodMs) / periodMs;
  return t < 0.5 ? t * 2 : 2 - t * 2;
}

export function inTimingZone(position: number): boolean {
  return position >= TIMING.zoneStart && position <= TIMING.zoneEnd;
}

/** Result of pressing at `elapsedMs` after the check started. */
export function timingResult(elapsedMs: number, periodMs: number): SkillResult {
  if (elapsedMs >= timingTimeoutMs(periodMs)) return 'fail';
  return inTimingZone(needlePosition(elapsedMs, periodMs)) ? 'success' : 'fail';
}

export function timingTimeoutMs(periodMs: number): number {
  return periodMs * TIMING.maxSweeps;
}

/**
 * Mash state after `taps` taps, the first at `firstTapAt`, evaluated at `now` (same clock).
 * Pending until either enough taps land inside the window or the window closes.
 */
export function mashResult(taps: number, firstTapAt: number | null, now: number): SkillResult | 'pending' {
  if (firstTapAt === null) return 'pending';
  if (taps >= MASH.taps && now - firstTapAt <= MASH.windowMs) return 'success';
  if (now - firstTapAt >= MASH.windowMs) return 'fail';
  return 'pending';
}

export function mashProgress(taps: number): number {
  return Math.min(1, Math.max(0, taps / MASH.taps));
}
