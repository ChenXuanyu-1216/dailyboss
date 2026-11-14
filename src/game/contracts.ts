/**
 * DailyBoss content protocol and runtime contracts.
 * See docs/ARCHITECTURE.md. This module contains types only — no React, no Three.js.
 *
 * v0.1: phases, actions, targets, endings.
 * v0.2: additive and backward compatible — optional action `feedback`, optional action `skill`
 *       (with `onFail`), optional phase `intensity`. v0.1 files load unchanged; the v0.2 fields
 *       are rejected in a v0.1 file so its meaning never silently changes.
 * v0.3: additive — a phase may be a real-time `fight` (src/game/fight.ts) instead of a list of
 *       actions. Hits taken in the fight cost patience; winning it follows `fight.target`.
 * v0.4: additive — an optional level `intro`: a tagline for the title screen and a few story
 *       beats played before the first phase. No effect on rules.
 */

import type { AttackKind } from './fight';

/** Oldest first: a field introduced in one version is allowed in every later one. */
export const SUPPORTED_SCHEMA_VERSIONS = ['0.1', '0.2', '0.3', '0.4'] as const;
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

/** v0.3: a phase played as a real-time fight. */
export interface FightRef {
  /** A fight registered in src/game/fights.ts. */
  id: string;
  /** Where winning the fight leads. */
  target: ActionTarget;
  /** Shown after the fight is won. */
  feedback?: string;
}

/** Patience lost per hit taken in a fight. */
export const FIGHT_HIT_COST = 1;

export interface PhaseDefinition {
  id: string;
  title: string;
  description: string;
  cue: string;
  /** Empty for fight phases. */
  actions: readonly ActionDefinition[];
  /** v0.3: the phase is a real-time fight instead of a choice of actions. */
  fight?: FightRef;
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
  /** v0.4: title-screen tagline and opening story. Levels without one go straight to play. */
  intro?: IntroDefinition;
}

/**
 * v0.4: illustrations a story beat can show. Deliberately generic (not tied to one boss) so any
 * everyday-frustration level can use them; drawn by src/ui/IntroSequence.tsx.
 */
export type IntroArt = 'clock' | 'document' | 'error' | 'eyes';
export const INTRO_ARTS: readonly IntroArt[] = ['clock', 'document', 'error', 'eyes'];
export const MAX_INTRO_BEATS = 6;

export interface IntroBeat {
  text: string;
  art?: IntroArt;
}

export interface IntroDefinition {
  /** One line under the level name on the title screen. */
  tagline: string;
  /** Shown one at a time before the first phase; the player can skip. */
  beats: readonly IntroBeat[];
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
  | 'unknown-fight'
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

export type GameEvent =
  | { type: 'ACT'; actionId: string; skill?: SkillResult }
  /** v0.3: the player took a hit in the current fight phase. */
  | { type: 'HIT'; attack: AttackKind }
  /** v0.3: the player won the current fight phase. */
  | { type: 'FIGHT_WON' }
  | { type: 'RESTART' };

/** One accepted action. Extension to the documented GameState to support feedback and logs. */
export interface TurnRecord {
  /** Phase in which the action was taken. */
  phaseId: string;
  /** The action ID; for fight turns, the attack that hit (`hit`) or the fight ID (`won`). */
  actionId: string;
  /** Present only for fight turns. */
  fight?: 'hit' | 'won';
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
  /** IDs of accepted actions, in order (fight turns are only in `turns`). */
  history: string[];
  /** Every accepted turn — actions and fight hits / wins — with the context needed to describe it. */
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
