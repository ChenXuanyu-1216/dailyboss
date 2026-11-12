import { describe, expect, it } from 'vitest';
import {
  FIGHT_RULES,
  NO_INPUT,
  createFight,
  stepFight,
  type FightDefinition,
  type FightEvent,
  type FightInput,
  type FightState,
  type MoveSpec,
} from '../src/game/fight';
import { FIGHTS, FIGHT_IDS, getFight } from '../src/game/fights';
import {
  FRAME_MS,
  chaosPolicy,
  idlePolicy,
  mashPolicy,
  runFight,
  skilledPolicy,
  turtlePolicy,
} from './fightBot';

/** A one-stage fight that repeats `cycle`, for checking single rules in isolation. */
function testFight(cycle: MoveSpec[], over: Partial<FightDefinition> = {}): FightDefinition {
  return {
    id: 'test',
    maxHp: 3,
    introMs: 100,
    stageIntroMs: 0,
    abilities: ['dodge', 'block', 'pull', 'reset'],
    newAbilities: [],
    stun: { windowMs: 1000, damage: 2 },
    stages: [{ title: 's', atHp: 3, gapMs: 100, cycle }],
    copy: { briefing: 'b', weakPoint: 'w', charge: 'c', progress: 'p' },
    ...over,
  };
}

/** Steps `ms` of fight time in 16 ms frames with a fixed input; commands go into the first frame only. */
function run(def: FightDefinition, s: FightState, ms: number, input: Partial<FightInput> = {}) {
  const events: FightEvent[] = [];
  let first = true;
  for (let t = 0; t < ms; t += FRAME_MS) {
    const r = stepFight(def, s, { ...NO_INPUT, ...input, commands: first ? (input.commands ?? []) : [] }, FRAME_MS);
    first = false;
    s = r.state;
    events.push(...r.events);
  }
  return { s, events, types: events.map((e) => e.type) };
}

const PAPER: MoveSpec = { kind: 'paper', shots: ['aimed'], intervalMs: 0, telegraphMs: 500, travelMs: 300 };
const TONER: MoveSpec = { kind: 'toner', telegraphMs: 500, activeMs: 400 };
const JAM: MoveSpec = { kind: 'jam', windowMs: 1000, lane: 'away' };
const WAIT: MoveSpec = { kind: 'wait', ms: 10_000 };

describe('fight rules', () => {
  it('is pure and deterministic: same seed and inputs give the same state', () => {
    const def = FIGHTS['printer-boss']!;
    const a = runFight(def, 42, skilledPolicy());
    const b = runFight(def, 42, skilledPolicy());
    expect(a).toEqual(b);
    const s = createFight(def, 1);
    const copy = structuredClone(s);
    stepFight(def, s, { commands: ['left', 'pull'], block: true, reset: false }, 500);
    expect(s).toEqual(copy);
  });

  it('a paper shot hits whoever stands in its lane at impact, and only them', () => {
    const def = testFight([PAPER, WAIT]);
    const stay = run(def, createFight(def, 1), 1000);
    expect(stay.types).toContain('hit');
    expect(stay.s.hits).toBe(1);

    let s = run(def, createFight(def, 1), 300).s; // telegraph showing in the player's lane
    expect(s.papers.map((p) => p.lane)).toEqual([1]);
    const moved = run(def, s, 700, { commands: ['left'] });
    expect(moved.s.lane).toBe(0);
    expect(moved.types).toEqual(['dodge']);
  });

  it('toner cannot be dodged, only blocked for the whole spray', () => {
    const def = testFight([TONER, WAIT]);
    const s0 = run(def, createFight(def, 1), 200).s;
    expect(run(def, s0, 1000, { commands: ['left'] }).types).toContain('hit');
    expect(run(def, s0, 1000, { block: true }).types).toEqual(['block']);

    // Letting go halfway through the spray is a hit.
    const half = run(def, s0, 600, { block: true }).s;
    expect(run(def, half, 400).types).toContain('hit');
  });

  it('blocking roots the player in place', () => {
    const def = testFight([WAIT]);
    const { s } = run(def, createFight(def, 1), 100, { block: true, commands: ['left'] });
    expect(s.lane).toBe(1);
    expect(s.blocking).toBe(true);
  });

  it('pull damages only while the weak point is out in your lane; a whiff locks pull', () => {
    const def = testFight([JAM, WAIT]);
    let s = run(def, createFight(def, 1), 150).s;
    const exposed = s.exposure!;
    expect(exposed.lane).not.toBe(s.lane); // 'away' never opens under the player

    // Wrong lane: whiff, then pull is locked even in the right lane.
    const whiff = run(def, s, 32, { commands: ['pull'] });
    expect(whiff.types).toEqual(['whiff']);
    const toLane = exposed.lane < s.lane ? 'left' : 'right';
    const locked = run(def, whiff.s, 32, { commands: [toLane] });
    const stillLocked = run(def, locked.s, 32, { commands: ['pull'] });
    expect(stillLocked.s.hp).toBe(3);

    // After the lock, in the right lane: damage.
    s = run(def, stillLocked.s, FIGHT_RULES.whiffLockMs).s;
    const hit = run(def, s, 32, { commands: ['pull'] });
    expect(hit.events).toContainEqual({ type: 'damage', amount: 1, stun: false });
    expect(hit.s.hp).toBe(2);
    expect(hit.s.exposure).toBeNull();
  });

  it('the weak point retracts if nobody pulls it', () => {
    const def = testFight([JAM, WAIT]);
    expect(run(def, createFight(def, 1), 1300).types).toContain('window-missed');
  });

  it('a finished charge heals; a reset channel interrupts it and exposes a stun weak point', () => {
    const UPDATE: MoveSpec = { kind: 'update', chargeMs: 2000, heal: 2, parallel: false };
    const def = testFight([UPDATE, WAIT]);
    const hurt = { ...createFight(def, 1), hp: 1 };

    expect(run(def, hurt, 2300).s.hp).toBe(3);

    const charging = run(def, hurt, 300).s;
    expect(charging.charge).not.toBeNull();
    const reset = run(def, charging, FIGHT_RULES.channelMs + 50, { reset: true });
    expect(reset.types).toContain('interrupt');
    expect(reset.s.charge).toBeNull();
    expect(reset.s.exposure).toMatchObject({ stun: true, damage: 2 });
    expect(reset.s.resetReadyAt).toBeGreaterThan(reset.s.t);
  });

  it('letting go of reset early cancels the channel; a hit interrupts it too', () => {
    const UPDATE: MoveSpec = { kind: 'update', chargeMs: 5000, heal: 0, parallel: true };
    const def = testFight([UPDATE, PAPER, WAIT]);
    const s = run(def, createFight(def, 1), 150).s;
    const partial = run(def, s, FIGHT_RULES.channelMs / 2, { reset: true }).s;
    expect(partial.channelFrom).not.toBeNull();
    expect(run(def, partial, 32).s.channelFrom).toBeNull();

    // Channel started while a sheet is already falling into this lane: the hit lands first,
    // cancels the channel, and the charge goes on. (Paper spawns at 200 ms, lands at 1000 ms.)
    const late = run(def, s, 250).s;
    expect(late.papers).toHaveLength(1);
    const hit = run(def, late, 800, { reset: true });
    expect(hit.types).toContain('hit');
    expect(hit.types).not.toContain('interrupt');
  });

  it('a reset with nothing to interrupt is wasted and goes on cooldown', () => {
    const def = testFight([WAIT]);
    const r = run(def, createFight(def, 1), FIGHT_RULES.channelMs + 50, { reset: true });
    expect(r.types).toEqual(['reset-wasted']);
    expect(r.s.resetReadyAt).toBeGreaterThan(r.s.t);
  });

  it('a hit grants a short invulnerability', () => {
    const def = testFight([{ kind: 'paper', shots: ['aimed', 'aimed'], intervalMs: 200, telegraphMs: 400, travelMs: 200 }, WAIT]);
    const r = run(def, createFight(def, 1), 1500);
    expect(r.s.hits).toBe(1);
  });

  it('abilities a fight does not allow ignore their input', () => {
    const def = testFight([TONER, WAIT], { abilities: ['dodge', 'pull'] });
    const r = run(def, run(def, createFight(def, 1), 200).s, 1000, { block: true });
    expect(r.types).toContain('hit');
  });

  it('stages advance with HP and never go back', () => {
    const def = FIGHTS['printer-boss']!;
    const s = { ...createFight(def, 1), hp: 9, exposure: { lane: 1, from: 0, until: 5000, damage: 1, stun: false } };
    const r = run(def, s, 32, { commands: ['pull'] });
    expect(r.events).toContainEqual({ type: 'stage', stage: 1 });
    expect(r.s.stageBannerUntil).toBeGreaterThan(r.s.t);
  });

  it('reaching 0 HP wins and clears the arena; a won fight ignores further steps', () => {
    const def = testFight([JAM, WAIT], { maxHp: 1, stages: [{ title: 's', atHp: 1, gapMs: 100, cycle: [JAM, WAIT] }] });
    const s = { ...createFight(def, 1), exposure: { lane: 1, from: 0, until: 5000, damage: 1, stun: false } };
    const r = run(def, s, 32, { commands: ['pull'] });
    expect(r.types).toContain('won');
    expect(r.s.won).toBe(true);
    expect(stepFight(def, r.s, { commands: ['pull'], block: false, reset: false }, 1000).events).toEqual([]);
  });
});

describe('registered fights', () => {
  it('every fight is registered under its own id and getFight ignores prototype keys', () => {
    for (const id of FIGHT_IDS) expect(getFight(id)?.id).toBe(id);
    expect(getFight('toString')).toBeUndefined();
  });

  it('stages are ordered by HP threshold and the first starts at max HP', () => {
    for (const def of Object.values(FIGHTS)) {
      expect(def.stages[0]!.atHp).toBe(def.maxHp);
      for (let i = 1; i < def.stages.length; i++) expect(def.stages[i]!.atHp).toBeLessThan(def.stages[i - 1]!.atHp);
    }
  });
});

/**
 * Balance: the answer to "it doesn't take skill". Every fight must be winnable without a single
 * hit at human reaction speed, and every no-skill strategy must lose all 5 patience first.
 */
describe('balance (scripted players, 20 seeds each)', () => {
  const seeds = Array.from({ length: 20 }, (_, i) => i + 1);
  const PATIENCE = 5;

  for (const def of Object.values(FIGHTS)) {
    describe(def.id, () => {
      it('a careful player (350 ms reactions) wins without being hit', () => {
        for (const seed of seeds) {
          const r = runFight(def, seed, skilledPolicy(350));
          expect(r, `seed ${seed}`).toMatchObject({ won: true, hits: 0 });
        }
      });

      it('standing still loses all patience', () => {
        for (const seed of seeds) {
          const r = runFight(def, seed, idlePolicy, { maxHits: PATIENCE });
          expect(r, `seed ${seed}`).toMatchObject({ won: false, hits: PATIENCE });
        }
      });

      it('mashing pull without dodging loses all patience', () => {
        for (const seed of seeds) {
          const r = runFight(def, seed, mashPolicy, { maxHits: PATIENCE });
          expect(r.won, `seed ${seed}`).toBe(false);
        }
      });
    });
  }

  it('holding block and mashing pull never wins the queue fight or the boss', () => {
    for (const id of ['printer-queue', 'printer-boss']) {
      for (const seed of seeds) {
        const r = runFight(FIGHTS[id]!, seed, turtlePolicy, { maxMs: 180_000, maxHits: PATIENCE });
        expect(r.won, `${id} seed ${seed}`).toBe(false);
      }
    }
  });

  it('mashing every key at once loses the boss fight', () => {
    for (const seed of seeds) {
      const r = runFight(FIGHTS['printer-boss']!, seed, chaosPolicy(), { maxHits: PATIENCE });
      expect(r.won, `seed ${seed}`).toBe(false);
    }
  });

  it('the boss punishes slow reactions: 900 ms reactions lose all patience', () => {
    for (const seed of seeds) {
      const r = runFight(FIGHTS['printer-boss']!, seed, skilledPolicy(900), { maxHits: PATIENCE });
      expect(r.won, `seed ${seed}`).toBe(false);
    }
  });

  it('a flawless boss fight takes about a minute of fight time', () => {
    const r = runFight(FIGHTS['printer-boss']!, 1, skilledPolicy(250));
    expect(r.t).toBeGreaterThan(45_000);
    expect(r.t).toBeLessThan(90_000);
  });
});
