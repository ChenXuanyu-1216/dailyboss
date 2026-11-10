import { useCallback, useMemo, useReducer } from 'react';
import type { GameEvent, GameState, LevelDefinition } from './contracts';
import {
  createInitialState,
  getAvailableActions,
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

  const act = useCallback((actionId: string) => dispatch({ type: 'ACT', actionId }), []);
  const restart = useCallback(() => dispatch({ type: 'RESTART' }), []);

  const derived = useMemo(
    () => ({
      phase: getCurrentPhase(level, state),
      actions: getAvailableActions(level, state),
      intensity: getIntensity(level, state),
      progress: getPhaseProgress(level, state),
      lastTurn: state.turns.at(-1) ?? null,
    }),
    [level, state],
  );

  return { state, ...derived, act, restart };
}

export type GameApi = ReturnType<typeof useGame>;
