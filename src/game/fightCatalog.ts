import { ARENA_FIGHT_IDS } from './arenaFights';
import { FIGHT_IDS } from './fights';

/**
 * Every fight a level phase can name in `fight.id`: the three-lane fights (fights.ts, the printer)
 * and the open-arena fights (arenaFights.ts, the vending machine). IDs are unique across both, so
 * the ID alone says which simulation runs the phase.
 */
export type FightKind = 'lane' | 'arena';

export const ALL_FIGHT_IDS: readonly string[] = [...FIGHT_IDS, ...ARENA_FIGHT_IDS];

export function fightKind(id: string): FightKind | undefined {
  if (FIGHT_IDS.includes(id)) return 'lane';
  if (ARENA_FIGHT_IDS.includes(id)) return 'arena';
  return undefined;
}
