import { describe, expect, it } from 'vitest';
import type { GameEvent, GameState, LevelDefinition, SkillResult } from '../src/game/contracts';
import { createInitialState, transition } from '../src/game/engine';
import { validateLevel } from '../src/game/validateLevel';
import { SCENE_CATALOG } from '../src/scenes/catalog';
import { describeLastTurn } from '../src/ui/feedback';
import printerV01 from './fixtures/printer-v0.1.json';
import { validPrinter, validShipped } from './helpers';

const level = validPrinter();
const event = (step: string): GameEvent => {
  const [actionId, skill] = step.split(':') as [string, SkillResult | undefined];
  return skill ? { type: 'ACT', actionId, skill } : { type: 'ACT', actionId };
};
const play = (steps: string[], lv: LevelDefinition = level): GameState =>
  steps.reduce<GameState>((s, step) => transition(lv, s, event(step)), createInitialState(lv));

describe('describeLastTurn', () => {
  it('returns null before any action', () => {
    expect(describeLastTurn(level, createInitialState(level))).toBeNull();
  });

  it('uses the action feedback from the level and names the new phase', () => {
    const f = describeLastTurn(level, play(['reconnect']))!;
    expect(f.tone).toBe('progress');
    expect(f.text).toContain('你插紧了 USB 线');
    expect(f.text).toContain('队列堵塞');
    expect(f.text).toContain('耐心未消耗');
  });

  it('describes a costly retry that stays in place', () => {
    const f = describeLastTurn(level, play(['print-again']))!;
    expect(f.tone).toBe('hurt');
    expect(f.text).toContain('耐心 −1，剩余 2');
    expect(f.text).toContain('打印机离线');
  });

  it('uses the onFail feedback after a failed skill check', () => {
    const f = describeLastTurn(level, play(['reconnect', 'clear-queue', 'open-lid:fail']))!;
    expect(f.tone).toBe('hurt');
    expect(f.text).toContain('盖板猛地合上');
    expect(f.text).toContain('耐心 −1，剩余 2');
    expect(f.text).toContain('第一回合：盖板');
  });

  it('uses the success feedback after a passed skill check', () => {
    const f = describeLastTurn(level, play(['reconnect', 'clear-queue', 'open-lid:success']))!;
    expect(f.tone).toBe('progress');
    expect(f.text).toContain('盖板弹开了');
    expect(f.text).toContain('第二回合：拔河');
  });

  it('names the ending for success and failure', () => {
    const perfect = ['reconnect', 'clear-queue', 'open-lid:success', 'pull-steady:success', 'release-paper:success'];
    expect(describeLastTurn(level, play(perfect))).toMatchObject({
      tone: 'success',
      text: expect.stringContaining(level.endings.perfect.title),
    });
    expect(describeLastTurn(level, play(['print-again', 'print-again', 'print-again']))).toMatchObject({
      tone: 'failure',
      text: expect.stringContaining(level.endings.failure.title),
    });
  });

  it('falls back to generic text for levels without feedback (v0.1)', () => {
    const result = validateLevel(structuredClone(printerV01), SCENE_CATALOG);
    if (!result.ok) throw new Error('fixture invalid');
    const v01 = result.value;
    expect(describeLastTurn(v01, play(['reconnect'], v01))!.text).toBe(
      '你选择了「检查连接」。耐心未消耗。局面变化：队列堵塞。',
    );
    expect(describeLastTurn(v01, play(['print-again'], v01))!.text).toContain('没有起作用，仍然是「打印机离线」');
  });

  it('is unchanged by an ignored invalid action', () => {
    const s = play(['reconnect']);
    const after = transition(level, s, { type: 'ACT', actionId: 'nope' });
    expect(describeLastTurn(level, after)).toEqual(describeLastTurn(level, s));
  });
});

describe('describeLastTurn for fights', () => {
  const shipped = validShipped();
  const run = (events: GameEvent[]) =>
    events.reduce<GameState>((s, e) => transition(shipped, s, e), createInitialState(shipped));

  it('describes a hit with its cost', () => {
    const f = describeLastTurn(shipped, run([{ type: 'HIT', attack: 'toner' }]))!;
    expect(f).toEqual({ text: '你吸了一大口墨粉。耐心 −1，剩余 4。', tone: 'hurt' });
  });

  it('uses the fight feedback from the level and names the next phase', () => {
    const f = describeLastTurn(shipped, run([{ type: 'FIGHT_WON' }]))!;
    expect(f.tone).toBe('progress');
    expect(f.text).toContain('你把 USB 线插了回去');
    expect(f.text).toContain('局面变化：队列堵塞');
  });

  it('names the ending after the boss falls, or after the last patience goes', () => {
    const won = describeLastTurn(shipped, run([{ type: 'FIGHT_WON' }, { type: 'FIGHT_WON' }, { type: 'FIGHT_WON' }]))!;
    expect(won).toMatchObject({ tone: 'success' });
    expect(won.text).toContain('你打印了一张纸');
    const lost = describeLastTurn(shipped, run(Array.from({ length: 5 }, () => ({ type: 'HIT', attack: 'paper' }) as GameEvent)))!;
    expect(lost.tone).toBe('failure');
    expect(lost.text).toContain('耐心已耗尽');
  });
});
