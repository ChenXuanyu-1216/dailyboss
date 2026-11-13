import { FIGHT_HIT_COST } from './contracts';
import type {
  ActionDefinition,
  ActionTarget,
  GameEvent,
  GameState,
  Intensity,
  LevelDefinition,
  PhaseDefinition,
  SkillResult,
  TurnRecord,
} from './contracts';
import { ATTACK_KINDS, type AttackKind } from './fight';

/**
 * Pure rule engine. No timers, randomness, rendering or I/O.
 * Assumes `level` passed validateLevel().
 *
 * Resolution order for an accepted action (docs/ARCHITECTURE.md):
 * 1. Terminal states only accept RESTART; unknown action IDs leave state unchanged.
 *    A skill action needs a skill result ('success' | 'fail'); a non-skill action must not carry one.
 * 2. Choose the branch: a failed skill check uses `skill.onFail` (cost + target), otherwise the
 *    action's own cost and target.
 * 3. Deduct patience (floored at 0), accumulate cost, record the action.
 * 4. Patience 0 → failure, taking precedence over a resolve target.
 * 5. Otherwise a phase target moves to that phase; resolve ends in success.
 * 6. Success with zero total cost → perfect, else normal.
 * 7. RESTART restores the initial state.
 *
 * Fight phases (v0.3) have no actions. The real-time fight runs in the presentation layer and
 * reports only two things: HIT (costs FIGHT_HIT_COST patience, step 3–4 apply) and FIGHT_WON
 * (free, follows `fight.target`, steps 5–6 apply). Both are ignored outside a fight phase.
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
      return act(level, state, event.actionId, event.skill);
    case 'HIT':
      return hit(level, state, event.attack);
    case 'FIGHT_WON':
      return fightWon(level, state);
    default:
      return state;
  }
}

function isSkillResult(v: unknown): v is SkillResult {
  return v === 'success' || v === 'fail';
}

/** The cost and target an action resolves to, given the skill result. */
export function resolveBranch(
  action: ActionDefinition,
  skill: SkillResult | undefined,
): { patienceCost: number; target: ActionTarget } {
  if (action.skill && skill === 'fail') return action.skill.onFail;
  return { patienceCost: action.patienceCost, target: action.target };
}

function act(level: LevelDefinition, state: GameState, actionId: string, skill: unknown): GameState {
  if (state.outcome !== null) return state;
  const phase = findPhase(level, state.phaseId);
  if (!phase) return state;
  const action = findAction(phase, actionId);
  if (!action) return state;
  if (action.skill ? !isSkillResult(skill) : skill !== undefined) return state;

  const branch = resolveBranch(action, skill as SkillResult | undefined);
  const patience = Math.max(0, state.patience - branch.patienceCost);
  const patienceSpent = state.patienceSpent + branch.patienceCost;
  const next: GameState = {
    phaseId: state.phaseId,
    patience,
    patienceSpent,
    history: [...state.history, action.id],
    turns: [
      ...state.turns,
      {
        phaseId: phase.id,
        actionId: action.id,
        patienceCost: branch.patienceCost,
        patienceAfter: patience,
        ...(action.skill ? { skill: skill as SkillResult } : {}),
      },
    ],
    outcome: null,
  };

  if (patience === 0) return { ...next, outcome: 'failure' };
  if (branch.target.type === 'resolve') {
    return { ...next, outcome: patienceSpent === 0 ? 'perfect' : 'normal' };
  }
  return { ...next, phaseId: branch.target.id };
}

function isAttackKind(v: unknown): v is AttackKind {
  return (ATTACK_KINDS as readonly unknown[]).includes(v);
}

function record(state: GameState, turn: TurnRecord, patience: number, patienceSpent: number): GameState {
  return { ...state, patience, patienceSpent, turns: [...state.turns, turn] };
}

function hit(level: LevelDefinition, state: GameState, attack: unknown): GameState {
  if (state.outcome !== null || !isAttackKind(attack)) return state;
  const phase = findPhase(level, state.phaseId);
  if (!phase?.fight) return state;
  const patience = Math.max(0, state.patience - FIGHT_HIT_COST);
  const next = record(
    state,
    { phaseId: phase.id, actionId: attack, fight: 'hit', patienceCost: FIGHT_HIT_COST, patienceAfter: patience },
    patience,
    state.patienceSpent + FIGHT_HIT_COST,
  );
  return patience === 0 ? { ...next, outcome: 'failure' } : next;
}

function fightWon(level: LevelDefinition, state: GameState): GameState {
  if (state.outcome !== null) return state;
  const phase = findPhase(level, state.phaseId);
  const fight = phase?.fight;
  if (!phase || !fight) return state;
  const next = record(
    state,
    { phaseId: phase.id, actionId: fight.id, fight: 'won', patienceCost: 0, patienceAfter: state.patience },
    state.patience,
    state.patienceSpent,
  );
  if (fight.target.type === 'resolve') {
    return { ...next, outcome: next.patienceSpent === 0 ? 'perfect' : 'normal' };
  }
  return { ...next, phaseId: fight.target.id };
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

/** Escalation tier of a phase: declared (v0.2) or derived from position (first calm, last critical). */
export function getPhaseIntensity(level: LevelDefinition, phaseId: string): Intensity {
  const i = level.phases.findIndex((p) => p.id === phaseId);
  const declared = level.phases[i]?.intensity;
  if (declared) return declared;
  const total = level.phases.length;
  if (total <= 1) return 'critical';
  if (i <= 0) return 'calm';
  if (i === total - 1) return 'critical';
  return 'warning';
}

export function getIntensity(level: LevelDefinition, state: GameState): Intensity {
  return getPhaseIntensity(level, state.phaseId);
}

/** The boss rounds: `critical` phases in level order. */
export function getBossPhases(level: LevelDefinition): readonly PhaseDefinition[] {
  return level.phases.filter((p) => getPhaseIntensity(level, p.id) === 'critical');
}

/**
 * Boss health for presentation, in [0, 1]: 1 when entering the first boss round, dropping by one
 * share per round reached, 0 after a win. Null before the boss appears. Not used by any rule.
 */
export function getBossHealth(level: LevelDefinition, state: GameState): number | null {
  const rounds = getBossPhases(level);
  if (rounds.length === 0) return null;
  if (state.outcome === 'perfect' || state.outcome === 'normal') return 0;
  const round = rounds.findIndex((p) => p.id === state.phaseId);
  if (round === -1) return null;
  return 1 - round / rounds.length;
}
