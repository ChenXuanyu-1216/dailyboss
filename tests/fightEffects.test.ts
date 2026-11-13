import { describe, expect, it } from 'vitest';
import { createFight, type FightState } from '../src/game/fight';
import { FIGHTS } from '../src/game/fights';
import { FightFx } from '../src/ui/fightEffects';

const def = FIGHTS['printer-queue']!;
const W = 360;
const H = 300;

function fx(): FightFx {
  const f = new FightFx();
  f.resize(W, H);
  return f;
}

const kinds = (f: FightFx) => f.particles.map((p) => p.kind);

/** A state with the toner spraying (active) at t = 1000. */
function spraying(over: Partial<FightState> = {}): FightState {
  return { ...createFight(def, 1), t: 1000, toner: { warnAt: 0, activeAt: 500, endAt: 2000, hit: false }, ...over };
}

describe('fight effects (presentation only)', () => {
  it('a toner hit splatters ink on the glass', () => {
    const f = fx();
    const s = createFight(def, 1);
    f.sync(s, s, [{ type: 'hit', attack: 'toner' }]);
    expect(kinds(f).filter((k) => k === 'splat').length).toBeGreaterThanOrEqual(6);
    expect(kinds(f)).toContain('text');
  });

  it('an active spray keeps a bounded cloud going and stops emitting when it ends', () => {
    const f = fx();
    const s = spraying();
    f.sync(s, s, []);
    for (let i = 0; i < 300; i++) f.step(1 / 60);
    const smoke = kinds(f).filter((k) => k === 'smoke').length;
    expect(smoke).toBeGreaterThan(40);
    expect(smoke).toBeLessThanOrEqual(140);
    expect(f.particles.length).toBeLessThanOrEqual(650);

    const after = { ...s, toner: null };
    f.sync(s, after, [{ type: 'block' }]);
    for (let i = 0; i < 180; i++) f.step(1 / 60);
    expect(f.busy).toBe(false);
  });

  it('while blocking, toner never gets inside the shield dome', () => {
    const f = fx();
    const s = spraying({ blocking: true });
    f.sync(s, s, []);
    const cx = f.laneX(s.lane);
    const cy = H - 46;
    for (let i = 0; i < 120; i++) {
      f.step(1 / 60);
      for (const p of f.particles) {
        if (p.kind !== 'drop' || p.y > cy) continue;
        expect(Math.hypot(p.x - cx, p.y - cy)).toBeGreaterThanOrEqual(61.9);
      }
    }
  });

  it('a pull bursts at the weak point that was pulled and shows the damage', () => {
    const f = fx();
    const before = { ...createFight(def, 1), exposure: { lane: 2, from: 0, until: 5000, damage: 2, stun: true } };
    f.sync(before, { ...before, exposure: null }, [{ type: 'damage', amount: 2, stun: true }]);
    const text = f.particles.find((p) => p.kind === 'text');
    expect(text?.text).toContain('2');
    expect(text?.x).toBeCloseTo(f.laneX(2));
  });

  it('does nothing before it knows its size', () => {
    const f = new FightFx();
    const s = createFight(def, 1);
    f.sync(s, s, [{ type: 'won' }]);
    expect(f.particles).toHaveLength(0);
  });
});
