/**
 * DailyBoss content protocol and runtime contracts.
 * See docs/ARCHITECTURE.md. This module contains types only — no React, no Three.js.
 *
 * v0.1: phases, actions, targets, endings.
 * v0.2: additive and backward compatible — optional action `feedback`, optional action `skill`
 *       (with `onFail`), optional phase `intensity`. v0.1 files load unchanged; the v0.2 fields
 *       are rejected in a v0.1 file so its meaning never silently changes.
 */

export const SUPPORTED_SCHEMA_VERSIONS = ['0.1', '0.2'] as const;
export type SchemaVersion = (typeof SUPPORTED_SCHEMA_VERSIONS)[number];

// ---------------------------------------------------------------------------
// Level definition (validated JSON content)
// ---------------------------------------------------------------------------

export type ActionTarget = { type: 'phase'; id: string } | { type: 'resolve' };

/** Kinds of skill check the UI can run. The engine only ever sees the result. */
export type SkillType = 'timing' | 'mash';
export const SKILL_TYPES: readonly SkillType[] = ['timing', 'mash'];

/** Result of a skill check, decided by the presentation layer and passed in the ACT event. */
export type SkillResult = 'success' | 'fail';

/** What happens when a skill check fails. Replaces the action's own cost and target. */
export interface SkillFailure {
  patienceCost: number;
  target: ActionTarget;
  feedback?: string;
}

export interface SkillDefinition {
  type: SkillType;
  onFail: SkillFailure;
}

export interface ActionDefinition {
  id: string;
  label: string;
  patienceCost: number;
  target: ActionTarget;
  /** v0.2: the printer's reaction, shown after the action succeeds. */
  feedback?: string;
  /** v0.2: the action requires a skill check; success follows `target`, failure follows `onFail`. */
  skill?: SkillDefinition;
}

/** Escalation tier. In v0.2 a phase may declare it; otherwise it is derived from phase order. */
export type Intensity = 'calm' | 'warning' | 'critical';
export const INTENSITIES: readonly Intensity[] = ['calm', 'warning', 'critical'];

export interface PhaseDefinition {
  id: string;
  title: string;
  description: string;
  cue: string;
  actions: readonly ActionDefinition[];
  /** v0.2: explicit escalation tier. `critical` phases are the boss rounds. */
  intensity?: Intensity;
}

export interface EndingDefinition {
  title: string;
  description: string;
}

export type Outcome = 'perfect' | 'normal' | 'failure';
export const OUTCOMES: readonly Outcome[] = ['perfect', 'normal', 'failure'];

export interface LevelDefinition {
  schemaVersion: SchemaVersion;
  id: string;
  title: string;
  objective: string;
  sceneId: string;
  initialPatience: number;
  initialPhaseId: string;
  phases: readonly PhaseDefinition[];
  endings: Readonly<Record<Outcome, EndingDefinition>>;
}

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export type ValidationCode =
  | 'invalid-type'
  | 'missing-field'
  | 'unknown-field'
  | 'unsupported-version'
  | 'invalid-value'
  | 'unknown-scene'
  | 'unsupported-cue'
  | 'duplicate-phase-id'
  | 'duplicate-action-id'
  | 'unknown-phase-ref'
  | 'invalid-target'
  | 'unreachable-phase'
  | 'no-reachable-resolve'
  | 'trap-phase';

export interface ValidationIssue {
  code: ValidationCode;
  /** JSON-path-like location, e.g. `phases[1].actions[0].target.id`. */
  path: string;
  /** Human-readable message (Chinese, matches player-facing copy). */
  message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; errors: ValidationIssue[] };

/** Scenes known to the runtime and the cues each supports. Supplied by src/scenes/catalog.ts. */
export type SceneCatalog = Readonly<Record<string, { readonly cues: readonly string[] }>>;

// ---------------------------------------------------------------------------
// Runtime state & events
// ---------------------------------------------------------------------------

export type GameEvent = { type: 'ACT'; actionId: string; skill?: SkillResult } | { type: 'RESTART' };

/** One accepted action. Extension to the documented GameState to support feedback and logs. */
export interface TurnRecord {
  /** Phase in which the action was taken. */
  phaseId: string;
  actionId: string;
  /** Patience actually charged for this turn (the skill failure cost if the check failed). */
  patienceCost: number;
  patienceAfter: number;
  /** Present only for actions with a skill check. */
  skill?: SkillResult;
}

export interface GameState {
  phaseId: string;
  patience: number;
  patienceSpent: number;
  /** IDs of accepted actions, in order. */
  history: string[];
  /** Same order as `history`, with the phase context each action needs to be described. */
  turns: TurnRecord[];
  outcome: Outcome | null;
}

// ---------------------------------------------------------------------------
// Scene contract — what a registered boss scene receives
// ---------------------------------------------------------------------------

export interface SceneProps {
  cue: string;
  outcome: Outcome | null;
  intensity: Intensity;
  patience: number;
  initialPatience: number;
  /** Number of accepted turns; changes on every action so scenes can play a one-shot reaction. */
  turnCount: number;
  /** Whether the latest accepted turn cost patience (the boss "hits back"). */
  lastTurnHurt: boolean;
  /**
   * Boss health in [0, 1] while in or after the boss rounds (`critical` phases); null before.
   * Derived from progress through the rounds — presentation only, not a rule.
   */
  bossHealth: number | null;
  reducedMotion: boolean;
}
