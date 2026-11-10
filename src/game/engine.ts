import type {
  ActionDefinition,
  GameEvent,
  GameState,
  Intensity,
  LevelDefinition,
  PhaseDefinition,
} from './contracts';

/**
 * Pure rule engine. No timers, randomness, rendering or I/O.
 * Assumes `level` passed validateLevel().
 *
 * Resolution order for an accepted action (docs/ARCHITECTURE.md):
 * 1. Terminal states only accept RESTART; unknown action IDs leave state unchanged.
 * 2. Deduct patience (floored at 0), accumulate cost, record the action.
 * 3. Patience 0 → failure, taking precedence over a resolve target.
 * 4. Otherwise a phase target moves to that phase; resolve ends in success.
 * 5. Success with zero total cost → perfect, else normal.
 * 6. RESTART restores the initial state.
 */

export function createInitialState(level: LevelDefinition): GameState {
  return {
    phaseId: level.initialPhaseId,
    patience: level.initialPatience,
    patienceSpent: 0,
    history: [],
    turns: [],
    outcome: null,
  };
}

export function findPhase(level: LevelDefinition, phaseId: string): PhaseDefinition | undefined {
  return level.phases.find((p) => p.id === phaseId);
}

export function findAction(phase: PhaseDefinition, actionId: string): ActionDefinition | undefined {
  return phase.actions.find((a) => a.id === actionId);
}

export function transition(level: LevelDefinition, state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case 'RESTART':
      return createInitialState(level);
    case 'ACT':
      return act(level, state, event.actionId);
    default:
      return state;
  }
}

function act(level: LevelDefinition, state: GameState, actionId: string): GameState {
  if (state.outcome !== null) return state;
  const phase = findPhase(level, state.phaseId);
  if (!phase) return state;
  const action = findAction(phase, actionId);
  if (!action) return state;

  const patience = Math.max(0, state.patience - action.patienceCost);
  const patienceSpent = state.patienceSpent + action.patienceCost;
  const next: GameState = {
    phaseId: state.phaseId,
    patience,
    patienceSpent,
    history: [...state.history, action.id],
    turns: [
      ...state.turns,
      { phaseId: phase.id, actionId: action.id, patienceCost: action.patienceCost, patienceAfter: patience },
    ],
    outcome: null,
  };

  if (patience === 0) return { ...next, outcome: 'failure' };
  if (action.target.type === 'resolve') {
    return { ...next, outcome: patienceSpent === 0 ? 'perfect' : 'normal' };
  }
  return { ...next, phaseId: action.target.id };
}

// ---------------------------------------------------------------------------
// Selectors (pure, derived data for UI and scenes)
// ---------------------------------------------------------------------------

export function getCurrentPhase(level: LevelDefinition, state: GameState): PhaseDefinition {
  // Validated levels and engine transitions guarantee the phase exists.
  return findPhase(level, state.phaseId) ?? level.phases[0]!;
}

/** Actions the player may take now: none once the game has ended. */
export function getAvailableActions(level: LevelDefinition, state: GameState): readonly ActionDefinition[] {
  if (state.outcome !== null) return [];
  return getCurrentPhase(level, state).actions;
}

/** 1-based position of the current phase and the total, e.g. 2 / 3. */
export function getPhaseProgress(level: LevelDefinition, state: GameState): { index: number; total: number } {
  const i = level.phases.findIndex((p) => p.id === state.phaseId);
  return { index: Math.max(0, i) + 1, total: level.phases.length };
}

/** First phase is calm, last phase is critical, everything between is a warning. */
export function getIntensity(level: LevelDefinition, state: GameState): Intensity {
  const { index, total } = getPhaseProgress(level, state);
  if (total <= 1) return 'critical';
  if (index === 1) return 'calm';
  if (index === total) return 'critical';
  return 'warning';
}
