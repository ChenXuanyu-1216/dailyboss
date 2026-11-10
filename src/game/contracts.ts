/**
 * DailyBoss content protocol v0.1 and runtime contracts.
 * See docs/ARCHITECTURE.md. This module contains types only — no React, no Three.js.
 */

export const SUPPORTED_SCHEMA_VERSIONS = ['0.1'] as const;
export type SchemaVersion = (typeof SUPPORTED_SCHEMA_VERSIONS)[number];

// ---------------------------------------------------------------------------
// Level definition (validated JSON content)
// ---------------------------------------------------------------------------

export type ActionTarget = { type: 'phase'; id: string } | { type: 'resolve' };

export interface ActionDefinition {
  id: string;
  label: string;
  patienceCost: number;
  target: ActionTarget;
}

export interface PhaseDefinition {
  id: string;
  title: string;
  description: string;
  cue: string;
  actions: readonly ActionDefinition[];
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

export type GameEvent = { type: 'ACT'; actionId: string } | { type: 'RESTART' };

/** One accepted action. Extension to the documented GameState to support feedback and logs. */
export interface TurnRecord {
  /** Phase in which the action was taken. */
  phaseId: string;
  actionId: string;
  patienceCost: number;
  patienceAfter: number;
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

/** Escalation tier derived from the phase's position in the level. */
export type Intensity = 'calm' | 'warning' | 'critical';

export interface SceneProps {
  cue: string;
  outcome: Outcome | null;
  intensity: Intensity;
  patience: number;
  initialPatience: number;
  /** Number of accepted turns; changes on every action so scenes can play a one-shot reaction. */
  turnCount: number;
  /** Whether the latest accepted turn cost patience. */
  lastTurnHurt: boolean;
  reducedMotion: boolean;
}
