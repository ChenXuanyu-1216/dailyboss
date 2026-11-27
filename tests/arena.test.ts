import { describe, expect, it } from 'vitest';
import {
  ARENA_RULES,
  NO_ARENA_INPUT,
  angleTo,
  createArena,
  dist,
  inShape,
  stepArena,
  type ArenaEvent,
  type ArenaFightDefinition,
  type ArenaInput,
  type ArenaMove,
  type ArenaState,
  type Vec,
} from '../src/game/arena';
import { ARENA_FIGHTS, ARENA_FIGHT_IDS, getArenaFight } from '../src/game/arenaFights';
import {
  FRAME_MS,
  arenaChaosPolicy,
  arenaKeyboardPolicy,
  arenaIdlePolicy,
  arenaMashPolicy,
  arenaSkilledPolicy,
  runArena,
  type ArenaPolicy,
} from './arenaBot';

const WAIT: ArenaMove = { kind: 'wait', ms: 60_000 };

/** A small one-stage arena that repeats `cycle`: boss at the centre, player 2 units in front of it. */
function testArena(cycle: ArenaMove[], over: Partial<ArenaFightDefinition> = {}): ArenaFightDefinition {
  return {
    id: 'test',
    maxHp: 10,
    introMs: 100,
    stageIntroMs: 0,
    abilities: ['move', 'attack', 'dash'],
    newAbilities: [],
    floor: { halfW: 6, halfH: 6 },
    bossRadius: 1,
    bossStart: { x: 0, y: 0 },
    playerStart: { x: 0, y: -2 },
    sockets: [
      { x: -5, y: 5 },
      { x: 5, y: 5 },
    ],
    armorDeg: 70,
    bodyDamage: 1,
    weakDamage: 3,
    unplugDownMs: 2000,
    stages: [{ title: 's', atHp: 10, gapMs: 100, turnDegPerS: 90, cycle }],
    copy: { briefing: 'b', weakPoint: 'w', charge: 'c', progress: 'p' },
    ...over,
  };
}

/** Steps `ms` of fight time in frames, holding `move`; commands go into the first frame only. */
function run(def: ArenaFightDefinition, s: ArenaState, ms: number, input: Partial<ArenaInput> = {}) {
  const events: ArenaEvent[] = [];
  let first = true;
  for (let t = 0; t < ms; t += FRAME_MS) {
    const dt = Math.min(FRAME_MS, ms - t);
    const r = stepArena(def, s, { ...NO_ARENA_INPUT, ...input, commands: first ? (input.commands ?? []) : [] }, dt);
    first = false;
    s = r.state;
    events.push(...r.events);
  }
  return { s, events, types: events.map((e) => e.type) };
}

const at = (s: ArenaState, pos: Vec): ArenaState => ({ ...s, pos });

describe('arena rules', () => {
  it('hit circles graze the corners of strips and cones only when they overlap', () => {
    const strip = { type: 'strip', o: { x: 0, y: 0 }, dir: 0, length: 5, width: 2 } as const;
    expect(inShape(strip, { x: 5.1, y: 1.2 }, 0.3)).toBe(true);
    expect(inShape(strip, { x: 5.25, y: 1.25 }, 0.3)).toBe(false);

    const cone = { type: 'cone', o: { x: 0, y: 0 }, dir: -Math.PI / 4, half: Math.PI / 4, range: 4 } as const;
    expect(inShape(cone, { x: 4.1, y: 0.2 }, 0.3)).toBe(true);
    expect(inShape(cone, { x: 4.2, y: 0.25 }, 0.3)).toBe(false);
  });

  it('is pure and deterministic: same seed and inputs give the same state', () => {
    const def = ARENA_FIGHTS['vending-boss']!;
    const a = runArena(def, 42, arenaSkilledPolicy(def, 350));
    const b = runArena(def, 42, arenaSkilledPolicy(def, 350));
    expect(a).toEqual(b);
    const s = createArena(def, 1);
    const copy = structuredClone(s);
    stepArena(def, s, { move: { x: 1, y: 0 }, commands: ['attack', 'dash'] }, 500);
    expect(s).toEqual(copy);
  });

  it('a strike hits whoever stands in its shape while it is active, once', () => {
    const def = testArena([{ kind: 'rattle', telegraphMs: 500, radius: 2.5 }, WAIT]);
    const stay = run(def, createArena(def, 1), 1200);
    expect(stay.s.hits).toBe(1);
    expect(stay.events).toContainEqual({ type: 'hit', attack: 'rattle' });

    const far = run(def, at(createArena(def, 1), { x: 0, y: -3.5 }), 1200);
    expect(far.s.hits).toBe(0);
  });

  it('leaving a warned area before it strikes is an evade', () => {
    const def = testArena([{ kind: 'rattle', telegraphMs: 500, radius: 2.5 }, WAIT]);
    let s = run(def, createArena(def, 1), 200).s; // warning showing, player inside it
    expect(s.hazards).toHaveLength(1);
    expect(inShape(s.hazards[0]!.shape, s.pos)).toBe(true);
    const out = run(def, s, 1000, { move: { x: 0, y: -1 } });
    expect(out.s.hits).toBe(0);
    expect(out.events).toContainEqual({ type: 'evade', attack: 'rattle' });
  });

  it('aimed attacks lock on when the warning starts and never follow the player', () => {
    const def = testArena([{ kind: 'coins', telegraphMs: 600, range: 8, halfAngleDeg: 20, fanDeg: [0] }, WAIT]);
    let s = run(def, createArena(def, 1), 150).s;
    const cone = s.hazards[0]!.shape;
    expect(cone.type).toBe('cone');
    // Sidestep: the cone stays where it was aimed.
    const out = run(def, s, 1000, { move: { x: 1, y: 0 } });
    expect(out.s.hits).toBe(0);
    expect(inShape(cone, out.s.pos, ARENA_RULES.hurtRadius)).toBe(false);
  });

  it('a dash moves fast and its brief invulnerability lets a strike pass through', () => {
    const def = testArena([{ kind: 'rattle', telegraphMs: 500, radius: 3.2 }, WAIT], {
      floor: { halfW: 6, halfH: 2.4 },
    });
    // Pinned against the near wall, inside the rattle: the dash cannot carry the player out.
    const start = at(createArena(def, 1), { x: 0, y: -2 });
    const strikeAt = def.introMs + 500;
    const before = run(def, start, strikeAt - 20).s;
    const dashed = run(def, before, 600, { move: { x: 0, y: -1 }, commands: ['dash'] });
    expect(dashed.types).toContain('dash');
    expect(dashed.s.hits).toBe(0);
    expect(run(def, before, 600).s.hits).toBe(1);

    // Speed: 3 units in 200 ms, against about 1 unit walking.
    const open = testArena([WAIT]);
    const s0 = createArena(open, 1);
    const dash = run(open, s0, 200, { move: { x: 1, y: 0 }, commands: ['dash'] }).s;
    expect(dist(dash.pos, s0.pos)).toBeCloseTo(ARENA_RULES.dashDistance, 1);
    // The dash is on a cooldown.
    const again = stepArena(open, dash, { move: { x: 1, y: 0 }, commands: ['dash'] }, FRAME_MS);
    expect(again.events.map((e) => e.type)).not.toContain('dash');
  });

  it('walking resumes for the rest of a step when the dash expires', () => {
    const def = testArena([WAIT]);
    const move = { x: 1, y: 0 };
    const start = stepArena(def, createArena(def, 1), { move, commands: ['dash'] }, 197).state;
    const walked = stepArena(def, start, { move: { x: 0, y: -1 }, commands: [] }, 10).state;
    expect(walked.pos.x).toBeCloseTo(3);
    expect(walked.pos.y).toBeCloseTo(-2.0364, 6);
  });

  it('a strike can hit at the exact instant the dash expires', () => {
    const def = testArena([{ kind: 'rattle', telegraphMs: 500, radius: 3.2 }, WAIT], {
      floor: { halfW: 6, halfH: 2.4 },
    });
    const before = stepArena(def, createArena(def, 1), NO_ARENA_INPUT, 400).state;
    const impact = stepArena(def, before, { move: { x: 0, y: -1 }, commands: ['dash'] }, 200);
    expect(impact.events).toContainEqual({ type: 'hit', attack: 'rattle' });
  });

  it('the armoured front makes hits bounce; from behind they land, then it spins round and braces', () => {
    const def = testArena([WAIT]);
    let s = createArena(def, 1); // player 2 units in front, boss facing them
    const front = run(def, at(s, { x: 0, y: -1.6 }), FRAME_MS, { commands: ['attack'] });
    expect(front.types).toContain('clank');
    expect(front.s.hp).toBe(def.maxHp);

    const back = run(def, at(s, { x: 0, y: 1.6 }), FRAME_MS, { commands: ['attack'] });
    expect(back.events).toContainEqual({ type: 'damage', amount: 1, weak: false });
    expect(back.s.hp).toBe(def.maxHp - 1);
    expect(back.s.bossFacing).toBeCloseTo(angleTo(back.s.boss, back.s.pos));
    // Braced: a second hit right after the attack cooldown still bounces, even from the side.
    s = run(def, back.s, ARENA_RULES.attackCooldownMs + 20).s;
    const side = run(def, at(s, { x: 1.6, y: 0 }), FRAME_MS, { commands: ['attack'] });
    expect(side.types).toContain('clank');
  });

  it('attacking out of reach whiffs, and attacks are on a cooldown', () => {
    const def = testArena([WAIT]);
    const s = createArena(def, 1);
    expect(run(def, at(s, { x: 0, y: -4 }), FRAME_MS, { commands: ['attack'] }).types).toEqual(['whiff']);
    const once = stepArena(def, at(s, { x: 0, y: 1.6 }), { move: { x: 0, y: 0 }, commands: ['attack', 'attack'] }, FRAME_MS);
    expect(once.events.filter((e) => e.type === 'damage')).toHaveLength(1);
  });

  it('walls and the standing boss block the way', () => {
    const def = testArena([WAIT]);
    const wall = run(def, createArena(def, 1), 3000, { move: { x: 0, y: -1 } }).s;
    expect(wall.pos.y).toBeCloseTo(-def.floor.halfH + ARENA_RULES.playerRadius);
    const into = run(def, createArena(def, 1), 1000, { move: { x: 0, y: 1 } }).s;
    expect(dist(into.pos, into.boss)).toBeGreaterThanOrEqual(def.bossRadius + ARENA_RULES.playerRadius - 1e-9);
  });

  it('a hop lands where the player stood, and never too close to a wall', () => {
    const def = testArena([{ kind: 'hop', telegraphMs: 500, radius: 1.5 }, WAIT]);
    const corner = at(createArena(def, 1), { x: 5.6, y: -5.6 });
    const r = run(def, corner, 1000);
    expect(r.s.hits).toBe(1);
    const inset = def.bossRadius + 2 * ARENA_RULES.playerRadius;
    expect(Math.abs(r.s.boss.x)).toBeLessThan(def.floor.halfW - inset);
    expect(Math.abs(r.s.boss.y)).toBeLessThan(def.floor.halfH - inset);
  });

  it('a hop hits before moving the player out of the landing spot', () => {
    const def = testArena([{ kind: 'hop', telegraphMs: 500, radius: 1 }, WAIT]);
    const impact = stepArena(def, createArena(def, 1), NO_ARENA_INPUT, 600);
    expect(impact.events).toContainEqual({ type: 'hit', attack: 'hop' });
    expect(dist(impact.state.pos, impact.state.boss)).toBeCloseTo(1.4);
  });

  it('a topple falls towards the player and leaves the boss down with its weak point out', () => {
    const def = testArena([{ kind: 'topple', telegraphMs: 500, length: 5, width: 2, downMs: 2000 }, WAIT]);
    let s = run(def, createArena(def, 1), 200).s;
    const strip = s.hazards[0]!.shape;
    expect(strip.type === 'strip' && strip.dir).toBeCloseTo(-Math.PI / 2); // towards the player (−y)
    const r = run(def, s, 600, { move: { x: 1, y: 0 } }); // step out of the strip
    expect(r.s.hits).toBe(0);
    expect(r.types).toContain('down');
    const down = r.s.down!;
    expect(down.cause).toBe('topple');
    expect(down.weak.y).toBeLessThan(-3); // near the far end, towards where the player was

    // Away from the weak point, a downed boss shrugs hits off.
    const body = run(def, at(r.s, { x: r.s.boss.x + 1.2, y: r.s.boss.y }), FRAME_MS, { commands: ['attack'] });
    expect(body.types).toContain('clank');
    // On the weak point: big damage once, and it gets up.
    const weak = run(def, at(r.s, { x: down.weak.x + 0.5, y: down.weak.y }), FRAME_MS, { commands: ['attack'] });
    expect(weak.events).toContainEqual({ type: 'damage', amount: def.weakDamage, weak: true });
    expect(weak.s.down).toBeNull();
    // Left alone, it gets up by itself.
    const alone = run(def, r.s, 2100);
    expect(alone.types).toContain('up');
    expect(alone.s.down).toBeNull();
  });

  it('a maintenance charge heals unless the plug is pulled; pulling it powers the boss down', () => {
    const def = testArena([{ kind: 'maintenance', chargeMs: 3000, heal: 2 }, WAIT]);
    let s = createArena(def, 1);
    s = { ...s, hp: 7 };
    s = run(def, s, 200).s;
    const charge = s.charge!;
    expect(charge).not.toBeNull();
    expect(def.sockets).toContainEqual(charge.socket);

    // Left alone: heals, but never past the stage's starting HP.
    const healed = run(def, s, 3200).s;
    expect(healed.hp).toBe(9);
    const capped = run(def, { ...s, hp: 9 }, 3200).s;
    expect(capped.hp).toBe(10);

    // At the socket: the press pulls the plug.
    const plug = run(def, at(s, { x: charge.socket.x * 0.9, y: charge.socket.y * 0.9 }), FRAME_MS, { commands: ['attack'] });
    expect(plug.types).toEqual(['interrupt', 'down']);
    expect(plug.s.charge).toBeNull();
    expect(plug.s.down?.cause).toBe('unplug');
    // The weak point is behind the dark glass, at its front.
    expect(Math.abs(angleTo(plug.s.boss, plug.s.down!.weak) - plug.s.bossFacing)).toBeLessThan(1e-9);
    expect(run(def, plug.s, 3300).s.hp).toBe(7);
  });

  it('a weak-point hit moves the player out of the boss as it stands up', () => {
    const def = testArena([{ kind: 'maintenance', chargeMs: 3000, heal: 2 }, WAIT]);
    const attack: ArenaInput = { ...NO_ARENA_INPUT, commands: ['attack'] };
    const charged = stepArena(def, createArena(def, 1), NO_ARENA_INPUT, 100).state;
    const unplugged = stepArena(def, at(charged, charged.charge!.socket), attack, 400).state;
    const weak = unplugged.down!.weak;
    const insideBoss = { x: weak.x / 2, y: weak.y / 2 };
    const hit = stepArena(def, at(unplugged, insideBoss), attack, 0);
    expect(hit.events).toContainEqual({ type: 'damage', amount: 3, weak: true });
    expect(dist(hit.state.pos, hit.state.boss)).toBeCloseTo(1.4);
  });

  it('a charge never draws from the socket nearest the player', () => {
    const def = testArena([{ kind: 'maintenance', chargeMs: 3000, heal: 1 }, WAIT]);
    for (let seed = 1; seed <= 10; seed++) {
      const s = run(def, at(createArena(def, seed), { x: 4.5, y: 4.5 }), 200).s;
      expect(s.charge!.socket).toEqual({ x: -5, y: 5 });
    }
  });

  it('abilities a fight does not allow ignore their input', () => {
    const def = ARENA_FIGHTS['vending-pay']!;
    expect(def.abilities).not.toContain('dash');
    const r = run(def, createArena(def, 1), 100, { commands: ['dash'] });
    expect(r.types).not.toContain('dash');
  });

  it('stages advance with HP; reaching 0 HP wins and clears the floor', () => {
    const def = testArena([{ kind: 'rattle', telegraphMs: 5000, radius: 2 }], {
      stages: [
        { title: 'a', atHp: 10, gapMs: 100, turnDegPerS: 90, cycle: [WAIT] },
        { title: 'b', atHp: 9, gapMs: 100, turnDegPerS: 90, cycle: [{ kind: 'rattle', telegraphMs: 5000, radius: 2 }] },
      ],
    });
    let s = at(createArena(def, 1), { x: 0, y: 1.6 });
    const hit = run(def, s, FRAME_MS, { commands: ['attack'] });
    expect(hit.events).toContainEqual({ type: 'stage', stage: 1 });
    s = run(def, hit.s, 500).s;
    expect(s.hazards.length).toBeGreaterThan(0);
    const behind = { x: s.boss.x - Math.cos(s.bossFacing) * 1.6, y: s.boss.y - Math.sin(s.bossFacing) * 1.6 };
    const win = run(def, at({ ...s, hp: 1, braceUntil: 0 }, behind), FRAME_MS, { commands: ['attack'] });
    expect(win.types).toContain('won');
    expect(win.s.hazards).toEqual([]);
    expect(stepArena(def, win.s, { move: { x: 1, y: 0 }, commands: ['attack'] }, 500).events).toEqual([]);
  });

  it('the killing blow ends the fight before any later commands in the frame', () => {
    const def = testArena([WAIT], { maxHp: 1 });
    const start = at(createArena(def, 1), { x: 0, y: 1.6 });
    const win = stepArena(def, start, { ...NO_ARENA_INPUT, commands: ['attack', 'dash'] }, 16);
    expect(win.events.map((event) => event.type)).toEqual(['damage', 'won']);
    expect(win.state.dashFrom).toBeNull();
  });
});

describe('registered arena fights', () => {
  it('every fight is registered under its own id and getArenaFight ignores prototype keys', () => {
    for (const id of ARENA_FIGHT_IDS) expect(ARENA_FIGHTS[id]!.id).toBe(id);
    expect(getArenaFight('toString')).toBeUndefined();
    expect(getArenaFight('vending-boss')).toBe(ARENA_FIGHTS['vending-boss']);
  });

  it('stages are ordered by HP threshold, the first starts at max HP, and starts are on the floor', () => {
    for (const def of Object.values(ARENA_FIGHTS)) {
      expect(def.stages[0]!.atHp).toBe(def.maxHp);
      for (let i = 1; i < def.stages.length; i++) expect(def.stages[i]!.atHp).toBeLessThan(def.stages[i - 1]!.atHp);
      for (const p of [def.bossStart, def.playerStart, ...def.sockets]) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(def.floor.halfW);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(def.floor.halfH);
      }
    }
  });
});

describe('arena balance (scripted players, 20 seeds each)', () => {
  const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
  const PATIENCE = 5;
  const all = (def: ArenaFightDefinition, policy: () => ArenaPolicy, maxHits = Infinity) =>
    SEEDS.map((seed) => runArena(def, seed, policy(), { maxHits }));

  for (const def of Object.values(ARENA_FIGHTS)) {
    describe(def.id, () => {
      it('a careful player (350 ms reactions) wins without being hit', () => {
        for (const r of all(def, () => arenaSkilledPolicy(def, 350))) {
          expect(r.won).toBe(true);
          expect(r.hits).toBe(0);
        }
      });

      it('standing still loses all patience', () => {
        for (const r of all(def, () => arenaIdlePolicy, PATIENCE)) {
          expect(r.won).toBe(false);
          expect(r.hits).toBe(PATIENCE);
        }
      });

      it('walking straight at it and mashing attack loses all patience', () => {
        for (const r of all(def, () => arenaMashPolicy, PATIENCE)) {
          expect(r.won).toBe(false);
          expect(r.hits).toBe(PATIENCE);
        }
      });
    });
  }

  const boss = ARENA_FIGHTS['vending-boss']!;
  const avgTime = (rs: { t: number }[]) => rs.reduce((a, r) => a + r.t, 0) / rs.length;

  it('the warm-up that teaches the plug rewards it: pulling it is faster than chipping at the body', () => {
    const def = ARENA_FIGHTS['vending-change']!;
    const careful = all(def, () => arenaSkilledPolicy(def, 350));
    const noPlug = all(def, () => arenaSkilledPolicy(def, 350, { ignorePlug: true }));
    expect(careful.every((r) => r.interrupts > 0)).toBe(true);
    expect(avgTime(careful)).toBeLessThan(avgTime(noPlug));
  });

  it('the boss punishes slow reactions: 1100 ms reactions lose all patience', () => {
    for (const r of all(boss, () => arenaSkilledPolicy(boss, 1100), PATIENCE)) expect(r.won).toBe(false);
  });

  // Playtest #6: "practically impossible". Most people walk with WASD and rarely dash, so the boss
  // must be beatable that way at human reaction times, with dash as the skill that makes it easier.
  it('a keyboard player who never dashes beats the boss at human reaction times', () => {
    const walker = (rt: number) => () => arenaKeyboardPolicy(arenaSkilledPolicy(boss, rt), { dash: false });
    for (const r of all(boss, walker(550), PATIENCE)) expect(r.won).toBe(true);
    expect(all(boss, walker(650), PATIENCE).filter((r) => r.won).length).toBeGreaterThanOrEqual(16);
    // Without the dash, slow reactions still lose.
    expect(all(boss, walker(1000), PATIENCE).filter((r) => r.won).length).toBeLessThanOrEqual(2);
  });

  it('the dash is worth learning: with it, slower reactions still win', () => {
    const runs = all(boss, () => arenaKeyboardPolicy(arenaSkilledPolicy(boss, 750)), PATIENCE);
    expect(runs.every((r) => r.won)).toBe(true);
  });

  it('attacking well is not enough: a player who never dodges loses the boss fight', () => {
    for (const r of all(boss, () => arenaSkilledPolicy(boss, 350, { noDodge: true }), PATIENCE)) {
      expect(r.won).toBe(false);
    }
  });

  it('running in circles mashing attack and dash loses the boss fight', () => {
    for (const r of all(boss, () => arenaChaosPolicy, PATIENCE)) expect(r.won).toBe(false);
  });

  it('the weak point carries the fight: it deals more damage than hits on the body', () => {
    const runs = all(boss, () => arenaSkilledPolicy(boss, 350));
    const weak = runs.reduce((a, r) => a + r.weakDamage, 0);
    const body = runs.reduce((a, r) => a + r.bodyDamage, 0);
    expect(weak).toBeGreaterThan(body);
  });

  it('pulling the plug matters: ignoring it lets the boss heal but still loses no fight, only time', () => {
    const careful = all(boss, () => arenaSkilledPolicy(boss, 350));
    const noPlug = all(boss, () => arenaSkilledPolicy(boss, 350, { ignorePlug: true }));
    for (const r of noPlug) {
      expect(r.won).toBe(true);
      expect(r.hits).toBeLessThanOrEqual(1);
    }
    expect(noPlug.reduce((a, r) => a + r.heals, 0)).toBeGreaterThan(0);
    expect(avgTime(noPlug)).toBeGreaterThan(avgTime(careful) + 5000);
  });

  it('a flawless boss fight takes about a minute of fight time', () => {
    const avg = avgTime(all(boss, () => arenaSkilledPolicy(boss, 350)));
    expect(avg).toBeGreaterThan(40_000);
    expect(avg).toBeLessThan(75_000);
  });
});
