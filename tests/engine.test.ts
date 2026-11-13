import { describe, expect, it } from 'vitest';
import type { GameEvent, GameState, LevelDefinition, SkillResult } from '../src/game/contracts';
import {
  createInitialState,
  getAvailableActions,
  getBossHealth,
  getIntensity,
  transition,
} from '../src/game/engine';
import { validateLevel } from '../src/game/validateLevel';
import { SCENE_CATALOG } from '../src/scenes/catalog';
import printerV01 from './fixtures/printer-v0.1.json';
import { rawPrinter, validPrinter, validShipped } from './helpers';

/** Steps are action IDs; a skill action is written `id:success` or `id:fail`. */
function event(step: string): GameEvent {
  const [actionId, skill] = step.split(':') as [string, SkillResult | undefined];
  return skill ? { type: 'ACT', actionId, skill } : { type: 'ACT', actionId };
}

function play(level: LevelDefinition, steps: string[], from?: GameState): GameState {
  return steps.reduce<GameState>((s, step) => transition(level, s, event(step)), from ?? createInitialState(level));
}

function deepFreeze<T>(v: T): T {
  if (typeof v === 'object' && v !== null) {
    Object.values(v).forEach(deepFreeze);
    Object.freeze(v);
  }
  return v;
}

const level = validPrinter();

const PERFECT = ['reconnect', 'clear-queue', 'open-lid:success', 'pull-steady:success', 'release-paper:success'];
const FAILURE = ['print-again', 'print-again', 'print-again'];

describe('createInitialState', () => {
  it('starts at the initial phase with full patience and no history', () => {
    expect(createInitialState(level)).toEqual({
      phaseId: 'offline',
      patience: 3,
      patienceSpent: 0,
      history: [],
      turns: [],
      outcome: null,
    });
  });
});

describe('outcomes', () => {
  it('perfect: every skill check succeeds and no patience is spent', () => {
    const s = play(level, PERFECT);
    expect(s.outcome).toBe('perfect');
    expect(s.patience).toBe(3);
    expect(s.patienceSpent).toBe(0);
    expect(s.history).toEqual(['reconnect', 'clear-queue', 'open-lid', 'pull-steady', 'release-paper']);
  });

  it('normal: one failed skill check costs patience but the run still wins', () => {
    const s = play(level, [
      'reconnect',
      'clear-queue',
      'open-lid:fail',
      'open-lid:success',
      'pull-steady:success',
      'release-paper:success',
    ]);
    expect(s.outcome).toBe('normal');
    expect(s.patience).toBe(2);
    expect(s.patienceSpent).toBe(1);
  });

  it('normal: the brute-force options win at a cost', () => {
    const s = play(level, ['reconnect', 'clear-queue', 'slap-side', 'pull-steady:success', 'unplug']);
    expect(s.outcome).toBe('normal');
    expect(s.patience).toBe(1);
  });

  it('failure: patience runs out while retrying in a phase', () => {
    const s = play(level, FAILURE);
    expect(s.outcome).toBe('failure');
    expect(s.patience).toBe(0);
    expect(s.phaseId).toBe('offline');
  });

  it('failure: patience runs out on failed skill checks in a boss round', () => {
    const s = play(level, ['reconnect', 'clear-queue', 'open-lid:fail', 'open-lid:fail', 'open-lid:fail']);
    expect(s.outcome).toBe('failure');
    expect(s.phaseId).toBe('jam');
  });

  it('failure takes precedence when the last patience is spent on a resolve action', () => {
    const s = play(level, [
      'print-again',
      'reconnect',
      'add-copy',
      'clear-queue',
      'open-lid:success',
      'pull-steady:success',
      'unplug',
    ]);
    expect(s.patience).toBe(0);
    expect(s.outcome).toBe('failure');
  });
});

describe('skill checks', () => {
  it('success follows the action target at the action cost', () => {
    const s = play(level, ['reconnect', 'clear-queue', 'open-lid:success']);
    expect(s.phaseId).toBe('jam-tug');
    expect(s.turns.at(-1)).toEqual({
      phaseId: 'jam',
      actionId: 'open-lid',
      patienceCost: 0,
      patienceAfter: 3,
      skill: 'success',
    });
  });

  it('failure follows onFail: its cost and its target', () => {
    const s = play(level, ['reconnect', 'clear-queue', 'open-lid:fail']);
    expect(s.phaseId).toBe('jam');
    expect(s.patience).toBe(2);
    expect(s.turns.at(-1)).toEqual({
      phaseId: 'jam',
      actionId: 'open-lid',
      patienceCost: 1,
      patienceAfter: 2,
      skill: 'fail',
    });
  });

  it('a failed final check does not resolve', () => {
    const s = play(level, ['reconnect', 'clear-queue', 'open-lid:success', 'pull-steady:success', 'release-paper:fail']);
    expect(s.outcome).toBeNull();
    expect(s.phaseId).toBe('jam-final');
    expect(s.patience).toBe(2);
  });

  it('a skill action without a result is ignored', () => {
    const s = play(level, ['reconnect', 'clear-queue']);
    expect(transition(level, s, { type: 'ACT', actionId: 'open-lid' })).toBe(s);
    expect(transition(level, s, { type: 'ACT', actionId: 'open-lid', skill: 'maybe' as SkillResult })).toBe(s);
  });

  it('a skill result on a non-skill action is ignored', () => {
    const s0 = createInitialState(level);
    expect(transition(level, s0, { type: 'ACT', actionId: 'reconnect', skill: 'success' })).toBe(s0);
  });

  it('non-skill turns carry no skill field', () => {
    expect(play(level, ['reconnect']).turns[0]).not.toHaveProperty('skill');
  });
});

describe('phase progression', () => {
  it('moves offline → queue → jam → jam-tug → jam-final and loops on retry actions', () => {
    const seen: string[] = [];
    let s = createInitialState(level);
    for (const step of ['print-again', 'reconnect', 'add-copy', 'clear-queue', 'open-lid:success', 'pull-steady:success']) {
      s = transition(level, s, event(step));
      seen.push(s.phaseId);
    }
    expect(seen).toEqual(['offline', 'queue', 'queue', 'jam', 'jam-tug', 'jam-final']);
    expect(s.outcome).toBeNull();
  });

  it('records turns with phase context for feedback', () => {
    const s = play(level, ['print-again', 'reconnect']);
    expect(s.turns).toEqual([
      { phaseId: 'offline', actionId: 'print-again', patienceCost: 1, patienceAfter: 2 },
      { phaseId: 'offline', actionId: 'reconnect', patienceCost: 0, patienceAfter: 2 },
    ]);
  });

  it('uses declared intensity: calm, warning, then critical for every boss round', () => {
    const states = [
      [],
      ['reconnect'],
      ['reconnect', 'clear-queue'],
      ['reconnect', 'clear-queue', 'open-lid:success'],
      ['reconnect', 'clear-queue', 'open-lid:success', 'pull-steady:success'],
    ].map((steps) => getIntensity(level, play(level, steps)));
    expect(states).toEqual(['calm', 'warning', 'critical', 'critical', 'critical']);
  });
});

describe('boss health', () => {
  it('is null before the boss, drops one share per round reached, and is 0 after a win', () => {
    const values = [
      [],
      ['reconnect'],
      ['reconnect', 'clear-queue'],
      ['reconnect', 'clear-queue', 'open-lid:success'],
      ['reconnect', 'clear-queue', 'open-lid:success', 'pull-steady:success'],
      PERFECT,
    ].map((steps) => getBossHealth(level, play(level, steps)));
    expect(values[0]).toBeNull();
    expect(values[1]).toBeNull();
    expect(values[2]).toBe(1);
    expect(values[3]).toBeCloseTo(2 / 3);
    expect(values[4]).toBeCloseTo(1 / 3);
    expect(values[5]).toBe(0);
  });

  it('does not drop on a failed check, and stays where it was after a failure ending', () => {
    const s = play(level, ['reconnect', 'clear-queue', 'open-lid:fail']);
    expect(getBossHealth(level, s)).toBe(1);
    const lost = play(level, ['reconnect', 'clear-queue', 'open-lid:fail', 'open-lid:fail', 'open-lid:fail']);
    expect(getBossHealth(level, lost)).toBe(1);
  });
});

describe('protocol v0.1 level (backward compatibility)', () => {
  const result = validateLevel(structuredClone(printerV01), SCENE_CATALOG);
  if (!result.ok) throw new Error('v0.1 fixture invalid');
  const v01 = result.value;

  it('plays exactly as before: perfect, normal and failure precedence', () => {
    expect(play(v01, ['reconnect', 'clear-queue', 'release-paper']).outcome).toBe('perfect');
    expect(play(v01, ['print-again', 'reconnect', 'clear-queue', 'release-paper']).outcome).toBe('normal');
    const last = play(v01, ['print-again', 'reconnect', 'add-copy', 'clear-queue', 'pull-hard']);
    expect([last.patience, last.outcome]).toEqual([0, 'failure']);
  });

  it('derives intensity from phase position and treats the last phase as the boss', () => {
    expect(getIntensity(v01, createInitialState(v01))).toBe('calm');
    expect(getIntensity(v01, play(v01, ['reconnect']))).toBe('warning');
    expect(getIntensity(v01, play(v01, ['reconnect', 'clear-queue']))).toBe('critical');
    expect(getBossHealth(v01, play(v01, ['reconnect', 'clear-queue']))).toBe(1);
    expect(getBossHealth(v01, play(v01, ['reconnect', 'clear-queue', 'release-paper']))).toBe(0);
  });
});

describe('patience floor', () => {
  it('never drops below zero even if a cost exceeds remaining patience', () => {
    const raw = rawPrinter();
    raw.phases[0].actions[1].patienceCost = 5;
    const result = validateLevel(raw, SCENE_CATALOG);
    if (!result.ok) throw new Error('fixture invalid');
    const s = play(result.value, ['print-again']);
    expect(s.patience).toBe(0);
    expect(s.patienceSpent).toBe(5);
    expect(s.outcome).toBe('failure');
  });
});

describe('invalid actions', () => {
  it('ignores unknown action IDs and returns the same state object', () => {
    const s0 = createInitialState(level);
    expect(transition(level, s0, { type: 'ACT', actionId: 'kick-printer' })).toBe(s0);
  });

  it('ignores actions that belong to another phase', () => {
    const s0 = createInitialState(level);
    expect(transition(level, s0, { type: 'ACT', actionId: 'unplug' })).toBe(s0);
    expect(transition(level, s0, { type: 'ACT', actionId: 'release-paper', skill: 'success' })).toBe(s0);
  });

  it('ignores unknown event types', () => {
    const s0 = createInitialState(level);
    expect(transition(level, s0, { type: 'EXPLODE' } as unknown as GameEvent)).toBe(s0);
  });

  it('ignores a state pointing at a phase that does not exist', () => {
    const broken: GameState = { ...createInitialState(level), phaseId: 'nowhere' };
    expect(transition(level, broken, { type: 'ACT', actionId: 'reconnect' })).toBe(broken);
  });
});

describe('terminal state protection', () => {
  it.each([
    ['perfect', PERFECT],
    ['failure', FAILURE],
  ])('after %s, further actions are ignored and nothing is offered', (_, path) => {
    const end = play(level, path);
    expect(getAvailableActions(level, end)).toEqual([]);
    for (const step of ['reconnect', 'print-again', 'clear-queue', 'release-paper:success', 'unplug', 'pull-hard']) {
      expect(transition(level, end, event(step))).toBe(end);
    }
  });
});

describe('restart', () => {
  it('restores the initial state after any outcome', () => {
    for (const path of [
      PERFECT,
      ['print-again', 'reconnect', 'clear-queue', 'slap-side', 'pull-steady:success', 'release-paper:success'],
      FAILURE,
    ]) {
      const end = play(level, path);
      expect(end.outcome).not.toBeNull();
      expect(transition(level, end, { type: 'RESTART' })).toEqual(createInitialState(level));
    }
  });

  it('works mid-run and a new run is independent of the previous one', () => {
    const mid = play(level, ['print-again', 'reconnect', 'clear-queue', 'open-lid:fail']);
    const fresh = transition(level, mid, { type: 'RESTART' });
    expect(fresh).toEqual(createInitialState(level));
    expect(play(level, PERFECT, fresh).outcome).toBe('perfect');
  });
});

describe('purity', () => {
  it('does not mutate the previous state or the level', () => {
    const s0 = deepFreeze(createInitialState(level));
    const snapshot = structuredClone(s0);
    const s1 = transition(level, s0, { type: 'ACT', actionId: 'print-again' });
    expect(s0).toEqual(snapshot);
    expect(s1).not.toBe(s0);
    expect(Object.isFrozen(level)).toBe(true);
  });

  it('is deterministic for the same inputs', () => {
    const path = ['print-again', 'reconnect', 'add-copy', 'clear-queue', 'open-lid:fail', 'slap-side', 'pull-steady:success'];
    expect(play(level, path)).toEqual(play(level, path));
  });
});

describe('fight phases (v0.3)', () => {
  const shipped = validShipped();
  const HIT_PAPER: GameEvent = { type: 'HIT', attack: 'paper' };
  const WON: GameEvent = { type: 'FIGHT_WON' };
  const run = (events: GameEvent[], from = createInitialState(shipped)) =>
    events.reduce<GameState>((s, e) => transition(shipped, s, e), from);

  it('fight phases offer no actions and ignore ACT events', () => {
    const s = createInitialState(shipped);
    expect(getAvailableActions(shipped, s)).toEqual([]);
    expect(transition(shipped, s, { type: 'ACT', actionId: 'reconnect' })).toBe(s);
  });

  it('winning every fight without a hit is perfect', () => {
    const s = run([WON, WON, WON]);
    expect(s.outcome).toBe('perfect');
    expect(s.patience).toBe(5);
    expect(s.history).toEqual([]);
    expect(s.turns.map((t) => [t.phaseId, t.fight, t.actionId])).toEqual([
      ['offline', 'won', 'printer-offline'],
      ['queue', 'won', 'printer-queue'],
      ['jam', 'won', 'printer-boss'],
    ]);
  });

  it('each hit costs one patience and is recorded; any hit makes the win normal', () => {
    const s = run([HIT_PAPER, WON, { type: 'HIT', attack: 'toner' }, WON]);
    expect(s.patience).toBe(3);
    expect(s.phaseId).toBe('jam');
    expect(s.turns.filter((t) => t.fight === 'hit').map((t) => [t.actionId, t.patienceCost, t.patienceAfter])).toEqual([
      ['paper', 1, 4],
      ['toner', 1, 3],
    ]);
    expect(run([WON], s).outcome).toBe('normal');
  });

  it('the fifth hit ends the run in failure, and nothing is accepted afterwards', () => {
    const s = run(Array.from({ length: 5 }, () => HIT_PAPER));
    expect(s.outcome).toBe('failure');
    expect(s.patience).toBe(0);
    expect(run([WON, HIT_PAPER], s)).toBe(s);
  });

  it('ignores unknown attacks and fight events outside fight phases', () => {
    const s = createInitialState(shipped);
    expect(transition(shipped, s, { type: 'HIT', attack: 'stapler' } as unknown as GameEvent)).toBe(s);
    const menu = createInitialState(level);
    expect(transition(level, menu, HIT_PAPER)).toBe(menu);
    expect(transition(level, menu, WON)).toBe(menu);
  });

  it('RESTART returns to the first fight with full patience', () => {
    const s = run([HIT_PAPER, WON, { type: 'RESTART' }]);
    expect(s).toEqual(createInitialState(shipped));
  });

  it('boss health is null in the warm-ups and set once the boss fight starts', () => {
    expect(getBossHealth(shipped, run([]))).toBeNull();
    expect(getBossHealth(shipped, run([WON]))).toBeNull();
    expect(getBossHealth(shipped, run([WON, WON]))).toBe(1);
    expect(getBossHealth(shipped, run([WON, WON, WON]))).toBe(0);
    expect(getIntensity(shipped, run([WON, WON]))).toBe('critical');
  });
});
