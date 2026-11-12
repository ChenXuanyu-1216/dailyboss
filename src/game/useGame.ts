import { useCallback, useMemo, useReducer } from 'react';
import type { GameEvent, GameState, LevelDefinition, SkillResult } from './contracts';
import type { AttackKind } from './fight';
import {
  createInitialState,
  getAvailableActions,
  getBossHealth,
  getCurrentPhase,
  getIntensity,
  getPhaseProgress,
  transition,
} from './engine';

/** React binding for the pure engine. All rules live in engine.ts. */
export function useGame(level: LevelDefinition) {
  const reducer = useCallback(
    (state: GameState, event: GameEvent) => transition(level, state, event),
    [level],
  );
  const [state, dispatch] = useReducer(reducer, level, createInitialState);

  const act = useCallback(
    (actionId: string, skill?: SkillResult) =>
      dispatch(skill ? { type: 'ACT', actionId, skill } : { type: 'ACT', actionId }),
    [],
  );
  const hit = useCallback((attack: AttackKind) => dispatch({ type: 'HIT', attack }), []);
  const winFight = useCallback(() => dispatch({ type: 'FIGHT_WON' }), []);
  const restart = useCallback(() => dispatch({ type: 'RESTART' }), []);

  const derived = useMemo(
    () => ({
      phase: getCurrentPhase(level, state),
      actions: getAvailableActions(level, state),
      intensity: getIntensity(level, state),
      progress: getPhaseProgress(level, state),
      bossHealth: getBossHealth(level, state),
      lastTurn: state.turns.at(-1) ?? null,
    }),
    [level, state],
  );

  return { state, ...derived, act, hit, winFight, restart };
}

export type GameApi = ReturnType<typeof useGame>;
