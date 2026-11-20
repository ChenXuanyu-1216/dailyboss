import { describe, expect, it } from 'vitest';
import { loadLevel } from '../src/app/levels';
import { createArena } from '../src/game/arena';
import { ARENA_FIGHT_IDS, ARENA_FIGHTS } from '../src/game/arenaFights';
import type { GameEvent, GameState, LevelDefinition } from '../src/game/contracts';
import { createInitialState, getBossHealth, transition } from '../src/game/engine';
import { ALL_FIGHT_IDS, fightKind } from '../src/game/fightCatalog';
import { FIGHT_IDS } from '../src/game/fights';
import { SCENE_CATALOG } from '../src/scenes/catalog';
import { arenaSoundsFor } from '../src/ui/audio';
import { sceneCopy } from '../src/ui/copy';
import { addArenaFrame, arenaTip, emptyStats, totalHits } from '../src/ui/runStats';
import { codesOf, rawShipped } from './helpers';

/** Boss #2 wired into the game: level content, protocol, engine and presentation helpers. */

function vending(): LevelDefinition {
  const result = loadLevel('vending-machine');
  if (!result.ok) throw new Error(JSON.stringify(result.errors, null, 2));
  return result.value;
}

describe('fight catalog', () => {
  it('fight IDs are unique across the lane and arena registries', () => {
    expect(new Set(ALL_FIGHT_IDS).size).toBe(FIGHT_IDS.length + ARENA_FIGHT_IDS.length);
  });

  it('tells which simulation runs a fight', () => {
    expect(fightKind('printer-boss')).toBe('lane');
    expect(fightKind('vending-boss')).toBe('arena');
    expect(fightKind('vending-dance-off')).toBeUndefined();
  });
});

describe('vending machine level', () => {
  it('validates, uses the vending scene and runs three arena fights', () => {
    const level = vending();
    expect(level.sceneId).toBe('vending');
    expect(level.phases.map((p) => p.fight?.id)).toEqual(['vending-pay', 'vending-change', 'vending-boss']);
    expect(level.phases.map((p) => p.intensity)).toEqual(['calm', 'warning', 'critical']);
    for (const p of level.phases) {
      expect(fightKind(p.fight!.id)).toBe('arena');
      expect(SCENE_CATALOG.vending.cues).toContain(p.cue);
    }
  });

  it('a phase may name an arena fight without a new protocol version', () => {
    const raw = rawShipped();
    raw.phases[2].fight.id = 'vending-boss';
    expect(raw.schemaVersion).toBe('0.4');
    expect(codesOf(raw)).toEqual([]);
  });
});

describe('engine with arena hits', () => {
  const level = vending();
  const run = (events: GameEvent[]) =>
    events.reduce<GameState>((s, e) => transition(level, s, e), createInitialState(level));

  it('accepts every arena hit kind and charges one patience each', () => {
    const kinds = ['coins', 'soda', 'hop', 'rattle'] as const;
    const s = run(kinds.map((attack) => ({ type: 'HIT', attack })));
    expect(s.patience).toBe(1);
    expect(s.turns.map((t) => t.actionId)).toEqual([...kinds]);
    expect(run([{ type: 'HIT', attack: 'topple' }]).patience).toBe(4);
  });

  it('wins through the three fights; a hit makes the win normal', () => {
    const WON: GameEvent = { type: 'FIGHT_WON' };
    expect(run([WON, WON, WON]).outcome).toBe('perfect');
    expect(getBossHealth(level, run([WON, WON]))).toBe(1);
    expect(run([WON, { type: 'HIT', attack: 'soda' }, WON, WON]).outcome).toBe('normal');
  });

  it('still ignores unknown hit kinds', () => {
    const s = createInitialState(level);
    expect(transition(level, s, { type: 'HIT', attack: 'vend' } as unknown as GameEvent)).toBe(s);
  });
});

describe('arena run statistics', () => {
  it('tallies hits, clanks, weak hits, heals and interrupts', () => {
    const s = emptyStats();
    addArenaFrame(s, [{ type: 'hit', attack: 'coins' }, { type: 'clank' }, { type: 'whiff' }], 16);
    addArenaFrame(s, [{ type: 'damage', amount: 6, weak: true }, { type: 'damage', amount: 1, weak: false }], 16);
    addArenaFrame(s, [{ type: 'heal', amount: 0 }, { type: 'heal', amount: 4 }, { type: 'interrupt' }], 16);
    expect(s).toMatchObject({ fightMs: 48, clanks: 1, whiffs: 1, weakHits: 1, heals: 1, interrupts: 1 });
    expect(s.hits.coins).toBe(1);
    expect(totalHits(s)).toBe(1);
  });

  it('the tip names what hit most, then heals, then clanks, then the next technique', () => {
    const s = emptyStats();
    s.hits.soda = 2;
    s.hits.coins = 1;
    s.heals = 1;
    expect(arenaTip(s, 'normal')).toMatch(/^2 次踩进汽水/);
    s.hits = {};
    expect(arenaTip(s, 'perfect')).toMatch(/维护/);
    s.heals = 0;
    s.clanks = 6;
    expect(arenaTip(s, 'perfect')).toMatch(/玻璃正面/);
    s.clanks = 0;
    expect(arenaTip(s, 'perfect')).toMatch(/砸顶上的饮料/);
    s.weakHits = 3;
    expect(arenaTip(s, 'perfect')).toMatch(/冲刺/);
    expect(arenaTip(emptyStats(), 'failure')).toMatch(/辅助模式/);
  });
});

describe('arena sounds (presentation only)', () => {
  const def = ARENA_FIGHTS['vending-boss']!;

  it('maps events to sounds', () => {
    const s = createArena(def, 1);
    expect(arenaSoundsFor(s, s, [{ type: 'hit', attack: 'soda' }])).toEqual(['hit-toner']);
    expect(arenaSoundsFor(s, s, [{ type: 'hit', attack: 'coins' }, { type: 'clank' }])).toEqual(['hit-paper', 'block']);
    expect(arenaSoundsFor(s, s, [{ type: 'damage', amount: 6, weak: true }])).toEqual(['pull-heavy']);
    expect(arenaSoundsFor(s, s, [{ type: 'down', cause: 'unplug' }, { type: 'heal', amount: 0 }])).toEqual(['weak']);
  });

  it('derives warning and strike cues from state changes', () => {
    const before = { ...createArena(def, 1), t: 100 };
    const hazard = {
      id: before.nextId,
      kind: 'soda' as const,
      shape: { type: 'circle' as const, c: { x: 0, y: 0 }, r: 1 },
      warnAt: 100,
      activeAt: 600,
      endAt: 2000,
      hit: false,
      aimed: false,
    };
    const warned = { ...before, t: 110, nextId: before.nextId + 1, hazards: [hazard] };
    expect(arenaSoundsFor(before, warned, [])).toEqual(['telegraph']);
    expect(arenaSoundsFor({ ...warned, t: 590 }, { ...warned, t: 600 }, [])).toEqual(['toner-spray']);
    const coins = { ...hazard, kind: 'coins' as const };
    expect(arenaSoundsFor({ ...warned, t: 590, hazards: [coins] }, { ...warned, t: 600, hazards: [coins] }, [])).toEqual([
      'launch',
    ]);
  });
});

describe('scene copy', () => {
  it('names the device per scene and falls back to the printer', () => {
    expect(sceneCopy('vending').fallback).toBe('售货机示意');
    expect(sceneCopy('printer').fallback).toBe('打印机示意');
    expect(sceneCopy('unknown')).toBe(sceneCopy('printer'));
    expect(sceneCopy('vending').status.perfect).toBe('出货完成');
  });
});
