import { describe, expect, it } from 'vitest';
import type { GameEvent, GameState, LevelDefinition } from '../src/game/contracts';
import {
  createInitialState,
  getAvailableActions,
  getIntensity,
  transition,
} from '../src/game/engine';
import { validateLevel } from '../src/game/validateLevel';
import { SCENE_CATALOG } from '../src/scenes/catalog';
import { rawPrinter, validPrinter } from './helpers';

function play(level: LevelDefinition, actions: string[], from?: GameState): GameState {
  return actions.reduce<GameState>(
    (s, actionId) => transition(level, s, { type: 'ACT', actionId }),
    from ?? createInitialState(level),
  );
}

function deepFreeze<T>(v: T): T {
  if (typeof v === 'object' && v !== null) {
    Object.values(v).forEach(deepFreeze);
    Object.freeze(v);
  }
  return v;
}

const level = validPrinter();

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
  it('perfect: resolves without spending any patience', () => {
    const s = play(level, ['reconnect', 'clear-queue', 'release-paper']);
    expect(s.outcome).toBe('perfect');
    expect(s.patience).toBe(3);
    expect(s.patienceSpent).toBe(0);
    expect(s.history).toEqual(['reconnect', 'clear-queue', 'release-paper']);
  });

  it('normal: resolves after a costly self-loop retry', () => {
    const s = play(level, ['print-again', 'reconnect', 'clear-queue', 'release-paper']);
    expect(s.outcome).toBe('normal');
    expect(s.patience).toBe(2);
    expect(s.patienceSpent).toBe(1);
  });

  it('normal: resolves via a costly resolve action', () => {
    const s = play(level, ['reconnect', 'add-copy', 'clear-queue', 'pull-hard']);
    expect(s.outcome).toBe('normal');
    expect(s.patience).toBe(1);
  });

  it('failure: patience runs out while retrying in a phase', () => {
    const s = play(level, ['print-again', 'print-again', 'print-again']);
    expect(s.outcome).toBe('failure');
    expect(s.patience).toBe(0);
    expect(s.phaseId).toBe('offline');
  });

  it('failure takes precedence when the last patience is spent on a resolve action', () => {
    const s = play(level, ['print-again', 'reconnect', 'add-copy', 'clear-queue', 'pull-hard']);
    expect(s.patience).toBe(0);
    expect(s.outcome).toBe('failure');
  });
});

describe('phase progression', () => {
  it('moves offline → queue → jam and loops on retry actions', () => {
    let s = createInitialState(level);
    s = transition(level, s, { type: 'ACT', actionId: 'print-again' });
    expect(s.phaseId).toBe('offline');
    s = transition(level, s, { type: 'ACT', actionId: 'reconnect' });
    expect(s.phaseId).toBe('queue');
    s = transition(level, s, { type: 'ACT', actionId: 'add-copy' });
    expect(s.phaseId).toBe('queue');
    s = transition(level, s, { type: 'ACT', actionId: 'clear-queue' });
    expect(s.phaseId).toBe('jam');
    expect(s.outcome).toBeNull();
  });

  it('records turns with phase context for feedback', () => {
    const s = play(level, ['print-again', 'reconnect']);
    expect(s.turns).toEqual([
      { phaseId: 'offline', actionId: 'print-again', patienceCost: 1, patienceAfter: 2 },
      { phaseId: 'offline', actionId: 'reconnect', patienceCost: 0, patienceAfter: 2 },
    ]);
  });

  it('maps phase position to escalation intensity', () => {
    const s0 = createInitialState(level);
    const s1 = play(level, ['reconnect']);
    const s2 = play(level, ['reconnect', 'clear-queue']);
    expect([getIntensity(level, s0), getIntensity(level, s1), getIntensity(level, s2)]).toEqual([
      'calm',
      'warning',
      'critical',
    ]);
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
    expect(transition(level, s0, { type: 'ACT', actionId: 'release-paper' })).toBe(s0);
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
    ['perfect', ['reconnect', 'clear-queue', 'release-paper']],
    ['failure', ['print-again', 'print-again', 'print-again']],
  ])('after %s, further actions are ignored and nothing is offered', (_, path) => {
    const end = play(level, path);
    expect(getAvailableActions(level, end)).toEqual([]);
    for (const actionId of ['reconnect', 'print-again', 'clear-queue', 'release-paper', 'pull-hard']) {
      expect(transition(level, end, { type: 'ACT', actionId })).toBe(end);
    }
  });
});

describe('restart', () => {
  it('restores the initial state after any outcome', () => {
    for (const path of [
      ['reconnect', 'clear-queue', 'release-paper'],
      ['print-again', 'reconnect', 'clear-queue', 'pull-hard'],
      ['print-again', 'print-again', 'print-again'],
    ]) {
      const end = play(level, path);
      expect(transition(level, end, { type: 'RESTART' })).toEqual(createInitialState(level));
    }
  });

  it('works mid-run and a new run is independent of the previous one', () => {
    const mid = play(level, ['print-again', 'reconnect']);
    const fresh = transition(level, mid, { type: 'RESTART' });
    expect(fresh).toEqual(createInitialState(level));
    expect(play(level, ['reconnect', 'clear-queue', 'release-paper'], fresh).outcome).toBe('perfect');
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
    const path = ['print-again', 'reconnect', 'add-copy', 'clear-queue', 'release-paper'];
    expect(play(level, path)).toEqual(play(level, path));
  });
});
