/**
 * Personal records, kept in this browser only (localStorage). Every access is guarded: storage can
 * be missing, full or blocked (private windows, strict privacy settings), and the game must play
 * the same without it. Assist-mode runs are never recorded.
 */

export type RunMode = 'full' | 'boss';

export interface Best {
  /** Fastest win, fight time in ms. */
  timeMs: number | null;
  /** Fewest hits in a win. */
  hits: number | null;
}

export interface Records {
  full: Best;
  boss: Best;
  /** The player has reached the boss fight at least once (unlocks boss practice). */
  reachedBoss: boolean;
}

const EMPTY: Records = { full: { timeMs: null, hits: null }, boss: { timeMs: null, hits: null }, reachedBoss: false };

const key = (levelId: string) => `dailyboss:records:${levelId}`;

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

function best(v: unknown): Best {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { timeMs: num(o.timeMs), hits: num(o.hits) };
}

export function loadRecords(levelId: string): Records {
  try {
    const raw = window.localStorage.getItem(key(levelId));
    if (!raw) return structuredClone(EMPTY);
    const o = JSON.parse(raw) as Record<string, unknown>;
    return { full: best(o.full), boss: best(o.boss), reachedBoss: o.reachedBoss === true };
  } catch {
    return structuredClone(EMPTY);
  }
}

function save(levelId: string, records: Records): void {
  try {
    window.localStorage.setItem(key(levelId), JSON.stringify(records));
  } catch {
    // Storage unavailable: records last for this page only.
  }
}

export function markReachedBoss(levelId: string, records: Records): Records {
  if (records.reachedBoss) return records;
  const next = { ...records, reachedBoss: true };
  save(levelId, next);
  return next;
}

export interface RecordResult {
  records: Records;
  /** The previous best for this mode, before this run. */
  previous: Best;
  newTime: boolean;
  newHits: boolean;
}

/** Records a win (losses and assist runs keep the old records). */
export function recordWin(levelId: string, records: Records, mode: RunMode, timeMs: number, hits: number): RecordResult {
  const previous = records[mode];
  const newTime = previous.timeMs === null || timeMs < previous.timeMs;
  const newHits = previous.hits === null || hits < previous.hits;
  if (!newTime && !newHits) return { records, previous, newTime, newHits };
  const next: Records = {
    ...records,
    [mode]: { timeMs: newTime ? timeMs : previous.timeMs, hits: newHits ? hits : previous.hits },
  };
  save(levelId, next);
  return { records: next, previous, newTime, newHits };
}
