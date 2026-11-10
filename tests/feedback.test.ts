import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/game/contracts';
import { createInitialState, transition } from '../src/game/engine';
import { describeLastTurn } from '../src/ui/feedback';
import { validPrinter } from './helpers';

const level = validPrinter();
const play = (ids: string[]): GameState =>
  ids.reduce<GameState>((s, actionId) => transition(level, s, { type: 'ACT', actionId }), createInitialState(level));

describe('describeLastTurn', () => {
  it('returns null before any action', () => {
    expect(describeLastTurn(level, createInitialState(level))).toBeNull();
  });

  it('describes progress to a new phase using config text', () => {
    const f = describeLastTurn(level, play(['reconnect']))!;
    expect(f.tone).toBe('progress');
    expect(f.text).toContain('检查连接');
    expect(f.text).toContain('队列堵塞');
    expect(f.text).toContain('耐心未消耗');
  });

  it('describes a costly retry that stays in place', () => {
    const f = describeLastTurn(level, play(['print-again']))!;
    expect(f.tone).toBe('hurt');
    expect(f.text).toContain('耐心 −1，剩余 2');
    expect(f.text).toContain('打印机离线');
  });

  it('names the ending for success and failure', () => {
    expect(describeLastTurn(level, play(['reconnect', 'clear-queue', 'release-paper']))).toMatchObject({
      tone: 'success',
      text: expect.stringContaining(level.endings.perfect.title),
    });
    expect(describeLastTurn(level, play(['print-again', 'print-again', 'print-again']))).toMatchObject({
      tone: 'failure',
      text: expect.stringContaining(level.endings.failure.title),
    });
  });

  it('is unchanged by an ignored invalid action', () => {
    const s = play(['reconnect']);
    const after = transition(level, s, { type: 'ACT', actionId: 'nope' });
    expect(describeLastTurn(level, after)).toEqual(describeLastTurn(level, s));
  });
});
