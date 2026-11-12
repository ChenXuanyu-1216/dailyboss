import type { GameState, LevelDefinition } from '../game/contracts';
import { findAction, findPhase, resolveBranch } from '../game/engine';

export type FeedbackTone = 'neutral' | 'progress' | 'hurt' | 'success' | 'failure';

export interface Feedback {
  text: string;
  tone: FeedbackTone;
}

/**
 * Describes the latest accepted turn using only data from the level definition.
 * v0.2 levels may supply the printer's reaction (`feedback`, or `skill.onFail.feedback` after a
 * failed check); otherwise a generic sentence names the action.
 */
export function describeLastTurn(level: LevelDefinition, state: GameState): Feedback | null {
  const turn = state.turns.at(-1);
  if (!turn) return null;
  const from = findPhase(level, turn.phaseId);
  const action = from && findAction(from, turn.actionId);
  if (!from || !action) return null;

  const failedCheck = turn.skill === 'fail';
  const branch = resolveBranch(action, turn.skill);
  const reaction = failedCheck ? action.skill?.onFail.feedback : action.feedback;
  const cost =
    turn.patienceCost > 0 ? `耐心 −${turn.patienceCost}，剩余 ${turn.patienceAfter}。` : '耐心未消耗。';
  const did = reaction ?? (failedCheck ? `「${action.label}」失败了。` : `你选择了「${action.label}」。`);

  if (state.outcome === 'failure') {
    return { text: `${did}${cost}${level.endings.failure.title}。`, tone: 'failure' };
  }
  if (state.outcome) {
    return { text: `${did}${cost}${level.endings[state.outcome].title}。`, tone: 'success' };
  }
  if (branch.target.type === 'phase' && branch.target.id !== from.id) {
    const to = findPhase(level, branch.target.id);
    return {
      text: `${did}${cost}局面变化：${to?.title ?? branch.target.id}。`,
      tone: turn.patienceCost > 0 ? 'hurt' : 'progress',
    };
  }
  return {
    text: `${did}${cost}${reaction ? '' : '没有起作用，'}仍然是「${from.title}」。`,
    tone: turn.patienceCost > 0 ? 'hurt' : 'neutral',
  };
}
