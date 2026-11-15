import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addFrame, emptyStats, formatTime, improvementTip, totalHits } from '../src/ui/runStats';
import { loadRecords, markReachedBoss, recordWin } from '../src/ui/records';

describe('run statistics', () => {
  it('tallies fight time and events', () => {
    const s = emptyStats();
    addFrame(s, [{ type: 'hit', attack: 'toner' }, { type: 'perfect', defense: 'dodge', opened: true }], 16);
    addFrame(s, [{ type: 'damage', amount: 2, stun: false, heavy: true }, { type: 'heal', amount: 0 }], 16);
    addFrame(s, [{ type: 'damage', amount: 1, stun: false, counter: true }, { type: 'heal', amount: 1 }], 16);
    expect(s).toMatchObject({ fightMs: 48, perfects: 1, heavyPulls: 1, counters: 1, heals: 1 });
    expect(totalHits(s)).toBe(1);
  });

  it('formats times as m:ss.t', () => {
    expect(formatTime(0)).toBe('0:00.0');
    expect(formatTime(67_449)).toBe('1:07.4');
    expect(formatTime(59_960)).toBe('1:00.0');
  });

  it('the tip names what hurt most first', () => {
    const s = emptyStats();
    s.hits.paper = 1;
    s.hits.toner = 3;
    s.heals = 2;
    expect(improvementTip(s, 'normal', true)).toMatch(/^3 次被墨粉喷中/);
    s.hits.toner = 0;
    expect(improvementTip(s, 'normal', true)).toMatch(/^1 次被纸砸中/);
  });

  it('then what slowed the player down, then the next technique', () => {
    const s = emptyStats();
    s.heals = 2;
    expect(improvementTip(s, 'perfect', true)).toMatch(/更新/);
    s.heals = 0;
    expect(improvementTip(s, 'perfect', true)).toMatch(/纸快落地时才闪开/);
    s.perfects = 3;
    expect(improvementTip(s, 'perfect', true)).toMatch(/重拽/);
    expect(improvementTip(emptyStats(), 'perfect', false)).toMatch(/最佳时间/);
  });
});

describe('records (localStorage)', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('starts empty and keeps the best time and fewest hits per mode', () => {
    let r = loadRecords('lvl');
    expect(r).toEqual({ full: { timeMs: null, hits: null }, boss: { timeMs: null, hits: null }, reachedBoss: false });
    let res = recordWin('lvl', r, 'full', 90_000, 2);
    expect(res).toMatchObject({ newTime: true, newHits: true });
    r = res.records;
    res = recordWin('lvl', r, 'full', 80_000, 3);
    expect(res).toMatchObject({ newTime: true, newHits: false, previous: { timeMs: 90_000, hits: 2 } });
    expect(loadRecords('lvl').full).toEqual({ timeMs: 80_000, hits: 2 });
    expect(loadRecords('lvl').boss.timeMs).toBeNull();
    r = markReachedBoss('lvl', loadRecords('lvl'));
    expect(loadRecords('lvl').reachedBoss).toBe(true);
    expect(r.reachedBoss).toBe(true);
  });

  it('survives broken or blocked storage', () => {
    store.set('dailyboss:records:lvl', '{not json');
    expect(loadRecords('lvl').full.timeMs).toBeNull();
    store.set('dailyboss:records:lvl', JSON.stringify({ full: { timeMs: -5, hits: 'x' }, reachedBoss: 1 }));
    expect(loadRecords('lvl')).toMatchObject({ full: { timeMs: null, hits: null }, reachedBoss: false });
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      },
    };
    const r = loadRecords('lvl');
    expect(recordWin('lvl', r, 'boss', 1000, 0).records.boss.timeMs).toBe(1000);
  });
});
