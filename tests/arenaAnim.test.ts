import { describe, expect, it } from 'vitest';
import { ARENA_RULES, createArena, type ArenaState, type Hazard } from '../src/game/arena';
import { ARENA_FIGHTS } from '../src/game/arenaFights';
import {
  FALL_MS,
  HOP_HEIGHT,
  RISE_MS,
  SWING_MS,
  bodyCentre,
  machinePose,
  newMachineMemo,
  studentPose,
  toWorld,
  turnToward,
  yawToRotation,
} from '../src/scenes/arenaAnim';

/** Poses for the 3D arena (presentation only): they must agree with where the rules put things. */

const def = ARENA_FIGHTS['vending-boss']!;

function at(t: number, over: Partial<ArenaState> = {}): ArenaState {
  return { ...createArena(def, 1), t, ...over };
}

function hazard(over: Partial<Hazard>): Hazard {
  return {
    id: 1,
    kind: 'coins',
    shape: { type: 'circle', c: { x: 0, y: 0 }, r: 1 },
    warnAt: 1000,
    activeAt: 2000,
    endAt: 2150,
    hit: false,
    aimed: false,
    ...over,
  };
}

describe('machine pose', () => {
  it('stands calm and powered with nothing going on', () => {
    const s = at(500);
    const p = machinePose(def, s, newMachineMemo());
    expect(p).toMatchObject({ fall: 0, lift: 0, squash: 1, power: 1, mood: 'idle' });
    expect(p.anchor).toEqual(s.boss);
  });

  it('a hop crouches, then arcs to the landing spot and arrives as it strikes', () => {
    const land = { x: 3, y: -1 };
    const h = hazard({ kind: 'hop', landAt: land });
    const crouch = machinePose(def, at(1300, { hazards: [h] }), newMachineMemo());
    expect(crouch.squash).toBeLessThan(0.9);
    expect(crouch.lift).toBe(0);

    const mid = machinePose(def, at(1775, { hazards: [h] }), newMachineMemo());
    expect(mid.lift).toBeCloseTo(HOP_HEIGHT, 1);
    const late = machinePose(def, at(1999, { hazards: [h] }), newMachineMemo());
    expect(late.anchor.x).toBeCloseTo(land.x, 1);
    expect(late.anchor.y).toBeCloseTo(land.y, 1);
    expect(late.lift).toBeLessThan(0.05);
  });

  it('rears back before coins and snaps forward as they fly, with the slot heating up', () => {
    const h = hazard({ kind: 'coins' });
    const early = machinePose(def, at(1500, { hazards: [h] }), newMachineMemo());
    const late = machinePose(def, at(1990, { hazards: [h] }), newMachineMemo());
    expect(early.lean).toBeLessThan(0);
    expect(late.lean).toBeGreaterThan(0);
    expect(late.slotGlow).toBeGreaterThan(early.slotGlow);
  });

  it('shakes harder as a rattle nears', () => {
    const h = hazard({ kind: 'rattle' });
    const a = machinePose(def, at(1100, { hazards: [h] }), newMachineMemo()).shake;
    const b = machinePose(def, at(1900, { hazards: [h] }), newMachineMemo()).shake;
    expect(b).toBeGreaterThan(a);
  });

  it('a topple falls from where it stood and ends lying where the rules put its body', () => {
    const memo = newMachineMemo();
    const o = { x: -2, y: 0 };
    const strip = hazard({
      kind: 'topple',
      shape: { type: 'strip', o, dir: 0, length: 6, width: 2.4 },
      downMs: 2000,
    });
    const before = machinePose(def, at(1900, { boss: o, hazards: [strip] }), memo);
    expect(before.fall).toBe(0);

    // The rules move the boss to the middle of the strip as it strikes.
    const mid = { x: 1, y: 0 };
    const down = { cause: 'topple' as const, from: 2000, until: 4000, weak: { x: 3.1, y: 0 } };
    const falling = machinePose(def, at(2050, { boss: mid, bossFacing: 0, down, hazards: [strip] }), memo);
    expect(falling.fall).toBeGreaterThan(0);
    expect(falling.fall).toBeLessThan(1);
    expect(falling.anchor.x).toBeLessThan(mid.x);

    const lying = machinePose(def, at(2000 + FALL_MS + 100, { boss: mid, bossFacing: 0, down }), memo);
    expect(lying.fall).toBe(1);
    expect(lying.mood).toBe('dizzy');
    const c = bodyCentre(def, lying);
    expect(c.x).toBeCloseTo(mid.x);
    expect(c.y).toBeCloseTo(mid.y);
    expect(lying.drinkOut).toBeGreaterThan(0);

    const up = machinePose(def, at(4000, { boss: mid, bossFacing: 0, down }), memo);
    expect(up.fall).toBeCloseTo(0);
    expect(up.anchor.x).toBeCloseTo(mid.x);
    const rising = machinePose(def, at(4000 - RISE_MS / 2, { boss: mid, bossFacing: 0, down }), memo);
    expect(rising.fall).toBeGreaterThan(0);
    expect(rising.fall).toBeLessThan(1);
  });

  it('goes dark when unplugged and shows loading while it charges', () => {
    const off = machinePose(def, at(3000, { down: { cause: 'unplug', from: 2000, until: 5000, weak: { x: 0, y: 2 } } }), newMachineMemo());
    expect(off).toMatchObject({ power: 0, mood: 'off', fall: 0 });
    const charge = { from: 1000, until: 3000, heal: 4, socket: { x: 5, y: 3 } };
    const loading = machinePose(def, at(2000, { charge }), newMachineMemo());
    expect(loading.mood).toBe('loading');
    expect(loading.progress).toBeCloseTo(0.5);
  });

  it('is defeated once the fight is won', () => {
    expect(machinePose(def, at(9000, { won: true }), newMachineMemo()).mood).toBe('defeated');
  });
});

describe('student pose', () => {
  it('swings for a moment after an attack', () => {
    const t = 5000;
    const attacked = at(t + 100, { attackReadyAt: t + ARENA_RULES.attackCooldownMs });
    expect(studentPose(attacked, true).swing).toBeCloseTo(100 / SWING_MS);
    const later = at(t + SWING_MS + 10, { attackReadyAt: t + ARENA_RULES.attackCooldownMs });
    expect(studentPose(later, true).swing).toBe(-1);
    expect(studentPose(at(10), true).swing).toBe(-1);
  });

  it('tracks a dash and a fresh hit', () => {
    const dashing = at(1100, { dashFrom: 1000 });
    expect(studentPose(dashing, true).dash).toBeCloseTo(100 / ARENA_RULES.dashMs);
    const hit = at(2100, { hits: 1, invulnerableUntil: 2000 + ARENA_RULES.invulnerableMs });
    const p = studentPose(hit, true);
    expect(p.hurt).toBeGreaterThan(0.5);
    expect(studentPose(hit, false).hidden).toBe(false);
  });
});

describe('coordinates', () => {
  it('maps the floor into a y-up world with the camera on +z', () => {
    expect(toWorld({ x: 2, y: 3 }, 1)).toEqual([2, 1, -3]);
    // Facing +x (angle 0) turns a +z-facing model a quarter turn.
    expect(yawToRotation(0)).toBeCloseTo(Math.PI / 2);
  });

  it('turns the short way round', () => {
    expect(turnToward(0.1, -0.1)).toBeCloseTo(-0.2);
    expect(turnToward(3, -3)).toBeCloseTo(2 * Math.PI - 6);
  });
});

describe('portrait and face', () => {
  it('poses the portrait from the cue and the outcome', async () => {
    const { portraitPose } = await import('../src/scenes/arenaAnim');
    expect(portraitPose('pay', null, null).mood).toBe('idle');
    expect(portraitPose('boss', null, 1).tone).toBe('danger');
    expect(portraitPose('boss', null, 0.2).shake).toBeGreaterThan(portraitPose('boss', null, 1).shake);
    expect(portraitPose('boss', 'perfect', 0)).toMatchObject({ mood: 'defeated', drinkOut: 1 });
    expect(portraitPose('boss', 'failure', 0.5).mood).toBe('smug');
  });

  it('redraws the face only when what it shows changes', async () => {
    const { faceKey } = await import('../src/scenes/kit/face');
    const base = { mood: 'idle' as const, blink: 0, progress: 0, time: 1, look: 0 };
    expect(faceKey(base)).toBe(faceKey({ ...base, time: 5 }));
    expect(faceKey(base)).not.toBe(faceKey({ ...base, blink: 1 }));
    const loading = { ...base, mood: 'loading' as const };
    expect(faceKey({ ...loading, progress: 0.5 })).not.toBe(faceKey({ ...loading, progress: 0.6 }));
  });
});
