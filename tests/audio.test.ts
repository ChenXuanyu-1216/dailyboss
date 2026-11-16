import { describe, expect, it } from 'vitest';
import { createFight } from '../src/game/fight';
import { FIGHTS } from '../src/game/fights';
import { soundsFor } from '../src/ui/audio';

const def = FIGHTS['printer-boss']!;

describe('fight sounds (presentation only)', () => {
  it('maps events to sounds: tears for pulls, a bigger one for heavy pulls, a ting only for openings', () => {
    const s = createFight(def, 1);
    expect(soundsFor(s, s, [{ type: 'damage', amount: 1, stun: false }])).toEqual(['pull']);
    expect(soundsFor(s, s, [{ type: 'damage', amount: 2, stun: false, heavy: true }])).toEqual(['pull-heavy']);
    expect(soundsFor(s, s, [{ type: 'perfect', defense: 'block', opened: false }])).toEqual([]);
    expect(soundsFor(s, s, [{ type: 'perfect', defense: 'block', opened: true }])).toEqual(['perfect']);
    expect(soundsFor(s, s, [{ type: 'hit', attack: 'pinch' }, { type: 'heal', amount: 0 }])).toEqual(['pinch']);
  });

  it('derives cues from state changes: a new sheet winds up, a launch whooshes, toner hisses then sprays', () => {
    const before = { ...createFight(def, 1), t: 100 };
    const paper = { id: 1, lane: 1, spawnAt: 100, launchAt: 500, impactAt: 900, round: 1 };
    const spawned = { ...before, t: 116, nextId: 2, papers: [paper] };
    expect(soundsFor(before, spawned, [])).toEqual(['telegraph']);
    expect(soundsFor({ ...spawned, t: 490 }, { ...spawned, t: 506 }, [])).toEqual(['launch']);

    const toner = { warnAt: 600, activeAt: 1000, endAt: 1500, hit: false, round: 1 };
    expect(soundsFor({ ...before, t: 590 }, { ...before, t: 606, toner }, [])).toEqual(['toner-warn']);
    expect(soundsFor({ ...before, t: 990, toner }, { ...before, t: 1006, toner }, [])).toEqual(['toner-spray']);
  });
});
