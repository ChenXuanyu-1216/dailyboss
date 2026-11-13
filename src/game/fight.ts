/**
 * Real-time boss fight simulation (protocol v0.3 `fight` phases).
 *
 * Pure and deterministic: `stepFight(def, state, input, dtMs)` returns the next state and the
 * events that happened during the step. No timers, no Math.random, no rendering. The presentation
 * layer owns the clock (performance.now() deltas) and the input devices; randomness comes from a
 * seeded generator carried in the state, so a seed plus an input log replays a fight exactly.
 *
 * The rules engine (engine.ts) never sees this state. It only receives the fight's consequences:
 * one HIT event per hit taken (costs patience) and FIGHT_WON when the boss's HP reaches 0.
 *
 * The player has four abilities, each the only good answer to one thing the printer does:
 * - dodge (move between 3 lanes): paper shots land in the lane that glowed;
 * - block (hold): toner spray covers every lane, it cannot be dodged;
 * - pull (press): the only way to deal damage, and only while paper sticks out of *your* lane;
 *   pulling at nothing leaves the hand stuck for a moment;
 * - reset (hold to channel): interrupts the "installing update" charge, which otherwise heals the
 *   printer; an interrupt stuns it and exposes a big weak point.
 * Blocking and channelling both root the player in place, so neither can be held "just in case".
 */

export const LANE_COUNT = 3;

export type AbilityId = 'dodge' | 'block' | 'pull' | 'reset';
export const ABILITY_IDS: readonly AbilityId[] = ['dodge', 'block', 'pull', 'reset'];

/** What hit the player. The engine records it; the UI describes it. */
export type AttackKind = 'paper' | 'toner';
export const ATTACK_KINDS: readonly AttackKind[] = ['paper', 'toner'];

/** Discrete inputs, applied at the start of the step in which they arrive. */
export type FightCommand = 'left' | 'right' | 'pull';

export interface FightInput {
  commands: readonly FightCommand[];
  /** Block key currently held. */
  block: boolean;
  /** Reset key currently held (channelling). */
  reset: boolean;
}

export const NO_INPUT: FightInput = { commands: [], block: false, reset: false };

/** Player-side rules shared by every fight. */
export const FIGHT_RULES = {
  /** Hold reset this long to finish the channel. */
  channelMs: 700,
  /** After a finished channel (useful or not), reset is unavailable for this long. */
  resetCooldownMs: 2500,
  /** Pulling when nothing is exposed in your lane locks pull for this long. */
  whiffLockMs: 600,
  /** After taking a hit, further hits are ignored for this long. */
  invulnerableMs: 1000,
  /** After a successful pull the printer recovers this fast at most before its next move. */
  recoverMs: 500,
  /** Internal step size; checks are evaluated at least this often regardless of frame rate. */
  substepMs: 10,
} as const;

/** One shot of a paper move: aimed at the player's lane, or a pair (player's lane + one other). */
export type Shot = 'aimed' | 'pair';

export type MoveSpec =
  | { kind: 'paper'; shots: readonly Shot[]; intervalMs: number; telegraphMs: number; travelMs: number }
  | { kind: 'toner'; telegraphMs: number; activeMs: number }
  | { kind: 'jam'; windowMs: number; lane: 'any' | 'away'; damage?: number }
  | { kind: 'update'; chargeMs: number; heal: number; parallel: boolean }
  | { kind: 'wait'; ms: number };

export interface FightStage {
  title: string;
  /** The stage starts once HP is at or below this value. The first stage uses maxHp. */
  atHp: number;
  /** Pause after every move. */
  gapMs: number;
  /** Moves, repeated in order. */
  cycle: readonly MoveSpec[];
}

export interface FightDefinition {
  id: string;
  maxHp: number;
  /** Time from the fight starting to the printer's first move. */
  introMs: number;
  /** Pause shown between stages. */
  stageIntroMs: number;
  /** Abilities this fight allows; others ignore their input and are shown as unavailable. */
  abilities: readonly AbilityId[];
  /** Abilities this fight introduces (highlighted in the briefing). */
  newAbilities: readonly AbilityId[];
  /** Weak point exposed after a reset interrupts a charge. */
  stun: { windowMs: number; damage: number };
  stages: readonly FightStage[];
  /** Fight-specific wording for the arena. */
  copy: {
    /** One-line briefing shown before the fight starts. */
    briefing: string;
    /** What sticks out when the printer is vulnerable. */
    weakPoint: string;
    /** What the printer is charging. */
    charge: string;
    /** Label for the fight's progress (the boss bar covers HP in the boss fight). */
    progress: string;
  };
}

export interface Paper {
  id: number;
  lane: number;
  /** Lane starts glowing. */
  spawnAt: number;
  /** Sheet leaves the printer. */
  launchAt: number;
  /** Sheet reaches the player row; hits whoever is in the lane. */
  impactAt: number;
}

interface PendingShot {
  at: number;
  shot: Shot;
  telegraphMs: number;
  travelMs: number;
}

export interface Toner {
  warnAt: number;
  activeAt: number;
  endAt: number;
  hit: boolean;
}

export interface Exposure {
  lane: number;
  from: number;
  until: number;
  damage: number;
  /** Opened by an interrupt (bigger and longer) rather than a jam move. */
  stun: boolean;
}

export interface Charge {
  from: number;
  until: number;
  heal: number;
}

export interface FightState {
  /** Fight time in ms (already scaled by the presentation layer, e.g. for assist mode). */
  t: number;
  hp: number;
  stage: number;
  cycleIndex: number;
  nextMoveAt: number;
  /** Seed of the next random draw. */
  rng: number;
  lane: number;
  blocking: boolean;
  /** When the current reset channel started, or null. */
  channelFrom: number | null;
  resetReadyAt: number;
  pullReadyAt: number;
  invulnerableUntil: number;
  pending: PendingShot[];
  papers: Paper[];
  toner: Toner | null;
  exposure: Exposure | null;
  charge: Charge | null;
  /** A stage banner is showing until this time; the printer holds its next move. */
  stageBannerUntil: number;
  hits: number;
  won: boolean;
  nextId: number;
}

export type FightEvent =
  | { type: 'hit'; attack: AttackKind }
  | { type: 'dodge' }
  | { type: 'block' }
  | { type: 'damage'; amount: number; stun: boolean }
  | { type: 'whiff' }
  | { type: 'interrupt' }
  | { type: 'reset-wasted' }
  | { type: 'heal'; amount: number }
  | { type: 'window-missed' }
  | { type: 'stage'; stage: number }
  | { type: 'won' };

// ---------------------------------------------------------------------------
// Seeded randomness (mulberry32)
// ---------------------------------------------------------------------------

function draw(s: FightState): number {
  const a = (s.rng + 0x6d2b79f5) | 0;
  s.rng = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function randomLane(s: FightState, exclude?: number): number {
  if (exclude === undefined) return Math.floor(draw(s) * LANE_COUNT);
  const pick = Math.floor(draw(s) * (LANE_COUNT - 1));
  return pick >= exclude ? pick + 1 : pick;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export function createFight(def: FightDefinition, seed: number): FightState {
  return {
    t: 0,
    hp: def.maxHp,
    stage: 0,
    cycleIndex: 0,
    nextMoveAt: def.introMs,
    rng: seed | 0,
    lane: Math.floor(LANE_COUNT / 2),
    blocking: false,
    channelFrom: null,
    resetReadyAt: 0,
    pullReadyAt: 0,
    invulnerableUntil: 0,
    pending: [],
    papers: [],
    toner: null,
    exposure: null,
    charge: null,
    stageBannerUntil: 0,
    hits: 0,
    won: false,
    nextId: 1,
  };
}

function clone(s: FightState): FightState {
  return {
    ...s,
    pending: s.pending.slice(),
    papers: s.papers.slice(),
    toner: s.toner && { ...s.toner },
    exposure: s.exposure && { ...s.exposure },
    charge: s.charge && { ...s.charge },
  };
}

export function canUse(def: FightDefinition, ability: AbilityId): boolean {
  return def.abilities.includes(ability);
}

/** HP as a fraction of max, in [0, 1]. */
export function fightHealth(def: FightDefinition, s: FightState): number {
  return Math.min(1, Math.max(0, s.hp / def.maxHp));
}

/** Channel progress in [0, 1], or null when not channelling. */
export function channelProgress(s: FightState): number | null {
  if (s.channelFrom === null) return null;
  return Math.min(1, (s.t - s.channelFrom) / FIGHT_RULES.channelMs);
}

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

export function stepFight(
  def: FightDefinition,
  prev: FightState,
  input: FightInput,
  dtMs: number,
): { state: FightState; events: FightEvent[] } {
  const s = clone(prev);
  const events: FightEvent[] = [];
  if (s.won) return { state: s, events };

  applyHeld(def, s, input);
  for (const cmd of input.commands) applyCommand(def, s, cmd, events);

  let remaining = Math.max(0, dtMs);
  while (remaining > 0 && !s.won) {
    const dt = Math.min(FIGHT_RULES.substepMs, remaining);
    remaining -= dt;
    applyHeld(def, s, input);
    substep(def, s, dt, events);
  }
  return { state: s, events };
}

function applyHeld(def: FightDefinition, s: FightState, input: FightInput): void {
  s.blocking = canUse(def, 'block') && input.block;
  if (s.blocking || !input.reset || !canUse(def, 'reset')) {
    s.channelFrom = null;
  } else if (s.channelFrom === null && s.t >= s.resetReadyAt) {
    s.channelFrom = s.t;
  }
}

function rooted(s: FightState): boolean {
  return s.blocking || s.channelFrom !== null;
}

function applyCommand(def: FightDefinition, s: FightState, cmd: FightCommand, events: FightEvent[]): void {
  if (cmd === 'left' || cmd === 'right') {
    if (!canUse(def, 'dodge') || rooted(s)) return;
    s.lane = Math.min(LANE_COUNT - 1, Math.max(0, s.lane + (cmd === 'left' ? -1 : 1)));
    return;
  }
  // pull
  if (!canUse(def, 'pull') || rooted(s) || s.t < s.pullReadyAt) return;
  const e = s.exposure;
  if (e && s.t >= e.from && s.t < e.until && e.lane === s.lane) {
    s.exposure = null;
    s.hp = Math.max(0, s.hp - e.damage);
    s.nextMoveAt = Math.min(s.nextMoveAt, s.t + FIGHT_RULES.recoverMs);
    events.push({ type: 'damage', amount: e.damage, stun: e.stun });
    afterDamage(def, s, events);
  } else {
    s.pullReadyAt = s.t + FIGHT_RULES.whiffLockMs;
    events.push({ type: 'whiff' });
  }
}

function afterDamage(def: FightDefinition, s: FightState, events: FightEvent[]): void {
  if (s.hp <= 0) {
    s.won = true;
    s.pending = [];
    s.papers = [];
    s.toner = null;
    s.exposure = null;
    s.charge = null;
    s.channelFrom = null;
    s.blocking = false;
    events.push({ type: 'won' });
    return;
  }
  let stage = s.stage;
  def.stages.forEach((st, i) => {
    if (i > stage && s.hp <= st.atHp) stage = i;
  });
  if (stage > s.stage) {
    s.stage = stage;
    s.cycleIndex = 0;
    s.stageBannerUntil = s.t + def.stageIntroMs;
    s.nextMoveAt = Math.max(s.nextMoveAt, s.stageBannerUntil);
    events.push({ type: 'stage', stage });
  }
}

function takeHit(s: FightState, attack: AttackKind, at: number, events: FightEvent[]): boolean {
  if (at < s.invulnerableUntil) return false;
  s.invulnerableUntil = at + FIGHT_RULES.invulnerableMs;
  s.channelFrom = null;
  s.hits += 1;
  events.push({ type: 'hit', attack });
  return true;
}

function substep(def: FightDefinition, s: FightState, dt: number, events: FightEvent[]): void {
  const t0 = s.t;
  const t1 = t0 + dt;

  // 1. Shots due: lanes are chosen now, from where the player is standing.
  if (s.pending.length > 0) {
    const due = s.pending.filter((p) => p.at <= t1);
    s.pending = s.pending.filter((p) => p.at > t1);
    for (const p of due) {
      const lanes = p.shot === 'aimed' ? [s.lane] : [s.lane, randomLane(s, s.lane)];
      for (const lane of lanes) {
        const launchAt = p.at + p.telegraphMs;
        s.papers.push({ id: s.nextId++, lane, spawnAt: p.at, launchAt, impactAt: launchAt + p.travelMs });
      }
    }
  }

  // 2. Reset channel completes.
  if (s.channelFrom !== null && t1 - s.channelFrom >= FIGHT_RULES.channelMs) {
    s.channelFrom = null;
    s.resetReadyAt = t1 + FIGHT_RULES.resetCooldownMs;
    if (s.charge) {
      s.charge = null;
      // Stunned: the printer drops what it was winding up and exposes a big weak point.
      s.pending = [];
      if (s.toner && t1 < s.toner.activeAt) s.toner = null;
      s.exposure = {
        lane: randomLane(s),
        from: t1,
        until: t1 + def.stun.windowMs,
        damage: def.stun.damage,
        stun: true,
      };
      s.nextMoveAt = Math.max(s.nextMoveAt, s.exposure.until + currentStage(def, s).gapMs);
      events.push({ type: 'interrupt' });
    } else {
      events.push({ type: 'reset-wasted' });
    }
  }

  // 3. Paper impacts.
  if (s.papers.length > 0) {
    const landing = s.papers.filter((p) => p.impactAt <= t1);
    if (landing.length > 0) {
      s.papers = s.papers.filter((p) => p.impactAt > t1);
      // Both sheets of a paired shot land together and have one outcome.
      for (const impactAt of new Set(landing.map((paper) => paper.impactAt))) {
        const struck = landing.some((paper) => paper.impactAt === impactAt && paper.lane === s.lane);
        if (struck) takeHit(s, 'paper', impactAt, events);
        else events.push({ type: 'dodge' });
      }
    }
  }

  // 4. Toner spray: must be blocking for the whole active window.
  if (s.toner && t1 > s.toner.activeAt) {
    const tn = s.toner;
    if (t0 < tn.endAt && !s.blocking && !tn.hit) {
      // One hit per spray at most; a player still invulnerable from an earlier hit is spared.
      takeHit(s, 'toner', Math.max(t0, tn.activeAt), events);
      tn.hit = true;
    }
    if (t1 >= tn.endAt) {
      if (!tn.hit) events.push({ type: 'block' });
      s.toner = null;
    }
  }

  // 5. The weak point retracts.
  if (s.exposure && t1 >= s.exposure.until) {
    s.exposure = null;
    events.push({ type: 'window-missed' });
  }

  // 6. A charge that completes heals the printer, but never past the current stage's starting HP:
  // an update can stall the fight, not undo a stage the player already broke through.
  if (s.charge && t1 >= s.charge.until) {
    const cap = Math.min(def.maxHp, currentStage(def, s).atHp);
    const amount = Math.max(0, Math.min(cap - s.hp, s.charge.heal));
    s.hp += amount;
    s.charge = null;
    events.push({ type: 'heal', amount });
  }

  s.t = t1;

  // 7. The printer's next move.
  if (t1 >= s.nextMoveAt && t1 >= s.stageBannerUntil) startMove(def, s);
}

function currentStage(def: FightDefinition, s: FightState): FightStage {
  return def.stages[s.stage] ?? def.stages[def.stages.length - 1]!;
}

function startMove(def: FightDefinition, s: FightState): void {
  const stage = currentStage(def, s);
  const move = stage.cycle[s.cycleIndex % stage.cycle.length]!;
  s.cycleIndex = (s.cycleIndex + 1) % stage.cycle.length;
  const t = s.t;
  let duration = 0;
  switch (move.kind) {
    case 'paper':
      move.shots.forEach((shot, i) => {
        s.pending.push({ at: t + i * move.intervalMs, shot, telegraphMs: move.telegraphMs, travelMs: move.travelMs });
      });
      duration = (move.shots.length - 1) * move.intervalMs + move.telegraphMs + move.travelMs;
      break;
    case 'toner':
      s.toner = { warnAt: t, activeAt: t + move.telegraphMs, endAt: t + move.telegraphMs + move.activeMs, hit: false };
      duration = move.telegraphMs + move.activeMs;
      break;
    case 'jam': {
      const lane = move.lane === 'away' ? randomLane(s, s.lane) : randomLane(s);
      s.exposure = { lane, from: t, until: t + move.windowMs, damage: move.damage ?? 1, stun: false };
      duration = move.windowMs;
      break;
    }
    case 'update':
      if (!s.charge) {
        s.charge = { from: t, until: t + move.chargeMs, heal: move.heal };
        duration = move.parallel ? 0 : move.chargeMs;
      }
      break;
    case 'wait':
      duration = move.ms;
      break;
  }
  s.nextMoveAt = t + duration + stage.gapMs;
}
