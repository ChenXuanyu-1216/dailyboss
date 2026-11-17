/**
 * Open-arena boss fight simulation (boss #2: the vending machine).
 *
 * The lane fight (fight.ts) puts the player in one of three lanes. Here the player walks freely
 * around a rectangular floor and attacks the boss up close. The rules are still flat: positions
 * live on a 2D ground plane (x across, y away from the camera) and the 3D scene only draws them,
 * so the same state can be drawn top-down without WebGL.
 *
 * Like fight.ts it is pure and deterministic: `stepArena(def, state, input, dtMs)` returns the
 * next state and the events of the step, in fixed 10 ms substeps, with a seeded generator in the
 * state. The rules engine only ever hears about its consequences (HIT per hit taken, FIGHT_WON).
 *
 * What the player can do:
 * - move (held, analog): walk anywhere on the floor; the boss blocks the way while standing;
 * - attack (press): hit the boss from close by. Its front is armoured, so only hits from the
 *   sides and back land, and each one makes it brace and spin round to face you (one hit per
 *   opening; mid-windup it cannot turn). Next to the glowing socket during a maintenance charge,
 *   the same press pulls the plug instead. When the boss is down (toppled, or powered down by the
 *   plug), only its exposed weak point takes damage: one big hit, and it gets up;
 * - dash (press): a short burst with brief invulnerability, on a cooldown.
 *
 * Every boss attack is a shape on the floor with a warning (telegraph) before it becomes active;
 * whoever stands in it while it is active is hit once. The shape is aimed when the warning starts
 * and never follows the player after that. Between attacks the boss turns towards the player
 * faster than they can circle it, so its back opens up mainly while it is committed to an attack.
 * It never ends up close enough to a wall to block the way round it.
 *
 * Balance (tests/arena.test.ts, scripted players over 20 seeds): a careful player with 350 ms
 * reactions clears the boss with no hits in about 52 s; ignoring the plug still wins but takes
 * about 64 s; 900 ms reactions, never dodging, standing still and mashing all lose.
 */

export interface Vec {
  x: number;
  y: number;
}

export type ArenaAbility = 'move' | 'attack' | 'dash';
export const ARENA_ABILITY_IDS: readonly ArenaAbility[] = ['move', 'attack', 'dash'];

/** What hit the player (one per hazard kind). */
export type ArenaAttack = 'coins' | 'soda' | 'hop' | 'rattle' | 'topple';
export const ARENA_ATTACKS: readonly ArenaAttack[] = ['coins', 'soda', 'hop', 'rattle', 'topple'];

/** Discrete inputs, applied at the start of the step in which they arrive. */
export type ArenaCommand = 'attack' | 'dash';

export interface ArenaInput {
  /** Held movement direction; longer than 1 is clamped to 1. */
  move: Vec;
  commands: readonly ArenaCommand[];
}

export const NO_ARENA_INPUT: ArenaInput = { move: { x: 0, y: 0 }, commands: [] };

/** Player-side rules shared by every arena fight. Distances in floor units (about a metre). */
export const ARENA_RULES = {
  substepMs: 10,
  /** The player's body: keeps them off walls and out of the boss. */
  playerRadius: 0.4,
  /** The part of the player hazards test against (a little forgiving). */
  hurtRadius: 0.3,
  /** Walking speed, units per second. */
  speed: 5.2,
  dashMs: 200,
  dashDistance: 3,
  dashCooldownMs: 900,
  attackCooldownMs: 400,
  /** Attack reach, measured from the boss's surface. */
  reach: 1,
  /** Attack reach around the weak point of a downed boss. */
  weakReach: 1.1,
  /** How close to the socket the player must be to pull the plug. */
  plugReach: 1,
  /** After taking a hit, further hits are ignored for this long. */
  invulnerableMs: 1000,
  /** After its weak point is hit, the boss gets up and acts again this fast at most. */
  recoverMs: 600,
  /** After a hit on its body, further body hits bounce off for this long. */
  braceMs: 1000,
  /** How long instant attacks (coins, hop, rattle, topple) stay active. */
  strikeMs: 150,
  /** Up to this much extra pause after each move, drawn per move, so no two fights run alike. */
  gapJitterMs: 250,
} as const;

export type ArenaMove =
  /** A cone of coins from the slot, aimed at the player; `fanDeg` fires several cones at offsets. */
  | { kind: 'coins'; telegraphMs: number; range: number; halfAngleDeg: number; fanDeg: readonly number[] }
  /** Soda puddles: one where the player stands, the rest at random. They stay active a while. */
  | { kind: 'soda'; telegraphMs: number; activeMs: number; radius: number; count: number }
  /** Jumps onto where the player stood when it crouched, and stays there. */
  | { kind: 'hop'; telegraphMs: number; radius: number }
  /** Shakes itself: everything close around it is hit. Punishes hugging the boss. */
  | { kind: 'rattle'; telegraphMs: number; radius: number }
  /** Falls flat towards the player, then lies there with its weak point exposed. */
  | { kind: 'topple'; telegraphMs: number; length: number; width: number; downMs: number }
  /** Charges in parallel with its other moves and heals when done, unless the plug is pulled. */
  | { kind: 'maintenance'; chargeMs: number; heal: number }
  | { kind: 'wait'; ms: number };

export interface ArenaStage {
  title: string;
  /** The stage starts once HP is at or below this value. The first stage uses maxHp. */
  atHp: number;
  /** Pause after every move. */
  gapMs: number;
  /** How fast the boss turns to face the player between attacks, degrees per second. */
  turnDegPerS: number;
  /** Moves, repeated in order. */
  cycle: readonly ArenaMove[];
}

export interface ArenaFightDefinition {
  id: string;
  maxHp: number;
  /** Time from the fight starting to the boss's first move. */
  introMs: number;
  /** Pause shown between stages. */
  stageIntroMs: number;
  abilities: readonly ArenaAbility[];
  /** Abilities this fight introduces (highlighted in the briefing). */
  newAbilities: readonly ArenaAbility[];
  /** The floor spans [-halfW, halfW] × [-halfH, halfH]. */
  floor: { halfW: number; halfH: number };
  bossRadius: number;
  bossStart: Vec;
  playerStart: Vec;
  /** Wall sockets a maintenance charge can draw power from (one is picked per charge). */
  sockets: readonly Vec[];
  /** Half-angle of the armoured front: hits from within it bounce off. */
  armorDeg: number;
  /** Damage of a hit on the side or back of the standing boss. */
  bodyDamage: number;
  /** Damage of the one hit on the weak point of a downed boss (it gets up right after). */
  weakDamage: number;
  /** How long the boss stays powered down after the plug is pulled. */
  unplugDownMs: number;
  stages: readonly ArenaStage[];
  copy: {
    /** One-line briefing shown before the fight starts. */
    briefing: string;
    /** What is exposed when the boss is down. */
    weakPoint: string;
    /** What the boss is charging. */
    charge: string;
    /** Label for the fight's progress (the boss bar covers HP in the boss fight). */
    progress: string;
  };
}

export type Shape =
  | { type: 'circle'; c: Vec; r: number }
  /** A sector from `o`, centred on `dir` (radians), out to `range`. */
  | { type: 'cone'; o: Vec; dir: number; half: number; range: number }
  /** A rectangle from `o` along `dir` (radians): `length` long, `width` wide. */
  | { type: 'strip'; o: Vec; dir: number; length: number; width: number };

export interface Hazard {
  id: number;
  kind: ArenaAttack;
  shape: Shape;
  warnAt: number;
  activeAt: number;
  endAt: number;
  /** Already hit the player (each hazard hits at most once). */
  hit: boolean;
  /** The player stood in it when the warning appeared (so leaving it counts as an evade). */
  aimed: boolean;
  /** Where a hop lands (the boss moves there when it becomes active). */
  landAt?: Vec;
  /** A topple's time lying down. */
  downMs?: number;
}

export interface Down {
  cause: 'topple' | 'unplug';
  from: number;
  until: number;
  /** Where the weak point is: the bottle at the top of a toppled machine, or behind the dark glass. */
  weak: Vec;
}

export interface ArenaCharge {
  from: number;
  until: number;
  heal: number;
  socket: Vec;
}

export interface ArenaState {
  t: number;
  hp: number;
  stage: number;
  cycleIndex: number;
  nextMoveAt: number;
  rng: number;
  pos: Vec;
  /** Direction the player faces (radians), from the last movement. */
  facing: number;
  dashFrom: number | null;
  dashDir: number;
  dashReadyAt: number;
  attackReadyAt: number;
  invulnerableUntil: number;
  boss: Vec;
  /** Direction the boss faces (radians). */
  bossFacing: number;
  /** The boss holds its facing until this time (it is winding up or striking). */
  bossLockedUntil: number;
  /** Body hits bounce off until this time (it braced after the last one). */
  braceUntil: number;
  hazards: Hazard[];
  down: Down | null;
  charge: ArenaCharge | null;
  stageBannerUntil: number;
  hits: number;
  won: boolean;
  nextId: number;
  /** Attack rounds started so far: one per pass through the stage's cycle. */
  round: number;
}

export type ArenaEvent =
  | { type: 'hit'; attack: ArenaAttack }
  | { type: 'evade'; attack: ArenaAttack }
  | { type: 'dash' }
  | { type: 'damage'; amount: number; weak: boolean }
  /** An attack bounced off the armoured front (or off a downed boss away from its weak point). */
  | { type: 'clank' }
  | { type: 'whiff' }
  | { type: 'down'; cause: Down['cause'] }
  | { type: 'up' }
  | { type: 'interrupt' }
  | { type: 'heal'; amount: number }
  | { type: 'stage'; stage: number }
  | { type: 'won' };

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const DEG = Math.PI / 180;

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function angleTo(from: Vec, to: Vec): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/** Signed smallest difference a − b, in (−π, π]. */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

function along(o: Vec, dir: number, d: number): Vec {
  return { x: o.x + Math.cos(dir) * d, y: o.y + Math.sin(dir) * d };
}

/** Whether a circle of radius `margin` around `p` overlaps the shape. */
export function inShape(shape: Shape, p: Vec, margin = 0): boolean {
  switch (shape.type) {
    case 'circle':
      return dist(shape.c, p) < shape.r + margin;
    case 'cone': {
      const d = dist(shape.o, p);
      if (d > shape.range + margin) return false;
      if (d <= margin) return true;
      const off = Math.abs(angleDiff(angleTo(shape.o, p), shape.dir));
      if (off <= shape.half) return true;
      // Beside the cone: distance from p to the nearer edge ray.
      if (off - shape.half >= Math.PI / 2) return false;
      return d * Math.sin(off - shape.half) < margin;
    }
    case 'strip': {
      const dx = p.x - shape.o.x;
      const dy = p.y - shape.o.y;
      const u = dx * Math.cos(shape.dir) + dy * Math.sin(shape.dir);
      const v = -dx * Math.sin(shape.dir) + dy * Math.cos(shape.dir);
      return u > -margin && u < shape.length + margin && Math.abs(v) < shape.width / 2 + margin;
    }
  }
}

function clampToFloor(def: ArenaFightDefinition, p: Vec, inset: number): Vec {
  const w = def.floor.halfW - inset;
  const h = def.floor.halfH - inset;
  return { x: Math.min(w, Math.max(-w, p.x)), y: Math.min(h, Math.max(-h, p.y)) };
}

/** The boss never ends up closer to a wall than this: there is always room to walk round it. */
function bossInset(def: ArenaFightDefinition): number {
  return def.bossRadius + 2 * ARENA_RULES.playerRadius + 0.9;
}

// ---------------------------------------------------------------------------
// Seeded randomness (mulberry32, as in fight.ts)
// ---------------------------------------------------------------------------

function draw(s: ArenaState): number {
  const a = (s.rng + 0x6d2b79f5) | 0;
  s.rng = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export function createArena(def: ArenaFightDefinition, seed: number): ArenaState {
  return {
    t: 0,
    hp: def.maxHp,
    stage: 0,
    cycleIndex: 0,
    nextMoveAt: def.introMs,
    rng: seed | 0,
    pos: { ...def.playerStart },
    facing: angleTo(def.playerStart, def.bossStart),
    dashFrom: null,
    dashDir: 0,
    dashReadyAt: 0,
    attackReadyAt: 0,
    invulnerableUntil: 0,
    boss: { ...def.bossStart },
    bossFacing: angleTo(def.bossStart, def.playerStart),
    bossLockedUntil: 0,
    braceUntil: 0,
    hazards: [],
    down: null,
    charge: null,
    stageBannerUntil: 0,
    hits: 0,
    won: false,
    nextId: 1,
    round: 0,
  };
}

function clone(s: ArenaState): ArenaState {
  return {
    ...s,
    pos: { ...s.pos },
    boss: { ...s.boss },
    hazards: s.hazards.map((h) => ({ ...h })),
    down: s.down && { ...s.down },
    charge: s.charge && { ...s.charge },
  };
}

export function canUseArena(def: ArenaFightDefinition, ability: ArenaAbility): boolean {
  return def.abilities.includes(ability);
}

/** HP as a fraction of max, in [0, 1]. */
export function arenaHealth(def: ArenaFightDefinition, s: ArenaState): number {
  return Math.min(1, Math.max(0, s.hp / def.maxHp));
}

export function isDashing(s: ArenaState): boolean {
  return s.dashFrom !== null && s.t < s.dashFrom + ARENA_RULES.dashMs;
}

/** Whether the player stands within the boss's armoured front. */
export function inArmor(def: ArenaFightDefinition, s: ArenaState, p: Vec = s.pos): boolean {
  return Math.abs(angleDiff(angleTo(s.boss, p), s.bossFacing)) < def.armorDeg * DEG;
}

/** Whether an attack from `p` reaches the standing boss's body. */
export function inReach(def: ArenaFightDefinition, s: ArenaState, p: Vec = s.pos): boolean {
  return dist(p, s.boss) - def.bossRadius <= ARENA_RULES.reach;
}

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

export function stepArena(
  def: ArenaFightDefinition,
  prev: ArenaState,
  input: ArenaInput,
  dtMs: number,
): { state: ArenaState; events: ArenaEvent[] } {
  const s = clone(prev);
  const events: ArenaEvent[] = [];
  if (s.won) return { state: s, events };

  const move = canUseArena(def, 'move') ? clampLength(input.move) : { x: 0, y: 0 };
  for (const cmd of input.commands) applyCommand(def, s, cmd, move, events);

  let remaining = Math.max(0, dtMs);
  while (remaining > 0 && !s.won) {
    const dt = Math.min(ARENA_RULES.substepMs, remaining);
    remaining -= dt;
    substep(def, s, move, dt, events);
  }
  return { state: s, events };
}

function clampLength(v: Vec): Vec {
  const len = Math.hypot(v.x, v.y);
  if (!Number.isFinite(len) || len === 0) return { x: 0, y: 0 };
  return len > 1 ? { x: v.x / len, y: v.y / len } : { x: v.x, y: v.y };
}

function applyCommand(def: ArenaFightDefinition, s: ArenaState, cmd: ArenaCommand, move: Vec, events: ArenaEvent[]): void {
  if (cmd === 'dash') {
    if (!canUseArena(def, 'dash') || s.t < s.dashReadyAt) return;
    s.dashFrom = s.t;
    s.dashDir = Math.hypot(move.x, move.y) > 0.2 ? Math.atan2(move.y, move.x) : s.facing;
    s.facing = s.dashDir;
    s.dashReadyAt = s.t + ARENA_RULES.dashCooldownMs;
    events.push({ type: 'dash' });
    return;
  }
  // attack
  if (!canUseArena(def, 'attack') || s.t < s.attackReadyAt) return;
  s.attackReadyAt = s.t + ARENA_RULES.attackCooldownMs;

  if (s.charge && dist(s.pos, s.charge.socket) <= ARENA_RULES.plugReach) {
    unplug(def, s, events);
    return;
  }
  if (s.down) {
    if (dist(s.pos, s.down.weak) <= ARENA_RULES.weakReach) {
      s.down = null;
      events.push({ type: 'up' });
      s.nextMoveAt = Math.min(s.nextMoveAt, s.t + ARENA_RULES.recoverMs);
      dealDamage(def, s, def.weakDamage, true, events);
    } else if (inReach(def, s)) {
      events.push({ type: 'clank' });
    } else {
      events.push({ type: 'whiff' });
    }
    return;
  }
  if (!inReach(def, s)) {
    events.push({ type: 'whiff' });
  } else if (inArmor(def, s) || s.t < s.braceUntil) {
    events.push({ type: 'clank' });
  } else {
    dealDamage(def, s, def.bodyDamage, false, events);
    // Smacked from the side or back, it braces for a moment and (unless it is busy winding up)
    // spins round to face you: one hit per opening, not a flurry.
    s.braceUntil = s.t + ARENA_RULES.braceMs;
    if (!s.won && s.t >= s.bossLockedUntil) s.bossFacing = angleTo(s.boss, s.pos);
  }
}

/** Pulling the plug: the charge stops, the windup is dropped, and the boss powers down. */
function unplug(def: ArenaFightDefinition, s: ArenaState, events: ArenaEvent[]): void {
  s.charge = null;
  s.hazards = s.hazards.filter((h) => h.activeAt <= s.t);
  events.push({ type: 'interrupt' });
  if (s.down) return;
  s.down = {
    cause: 'unplug',
    from: s.t,
    until: s.t + def.unplugDownMs,
    weak: along(s.boss, s.bossFacing, def.bossRadius + 0.3),
  };
  s.bossLockedUntil = s.down.until;
  s.nextMoveAt = Math.max(s.nextMoveAt, s.down.until + currentStage(def, s).gapMs);
  events.push({ type: 'down', cause: 'unplug' });
}

function dealDamage(def: ArenaFightDefinition, s: ArenaState, amount: number, weak: boolean, events: ArenaEvent[]): void {
  s.hp = Math.max(0, s.hp - amount);
  events.push({ type: 'damage', amount, weak });
  if (s.hp <= 0) {
    s.won = true;
    s.hazards = [];
    s.down = null;
    s.charge = null;
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

function takeHit(s: ArenaState, attack: ArenaAttack, at: number, events: ArenaEvent[]): boolean {
  if (at < s.invulnerableUntil) return false;
  if (s.dashFrom !== null && at >= s.dashFrom && at < s.dashFrom + ARENA_RULES.dashMs) return false;
  s.invulnerableUntil = at + ARENA_RULES.invulnerableMs;
  s.hits += 1;
  events.push({ type: 'hit', attack });
  return true;
}

function substep(def: ArenaFightDefinition, s: ArenaState, move: Vec, dt: number, events: ArenaEvent[]): void {
  const t0 = s.t;
  const t1 = t0 + dt;

  // 1. The player moves: a dash overrides walking. Walls and the standing boss block the way.
  let step: Vec;
  if (s.dashFrom !== null && t0 < s.dashFrom + ARENA_RULES.dashMs) {
    const d = (ARENA_RULES.dashDistance / ARENA_RULES.dashMs) * Math.min(dt, s.dashFrom + ARENA_RULES.dashMs - t0);
    step = { x: Math.cos(s.dashDir) * d, y: Math.sin(s.dashDir) * d };
  } else {
    s.dashFrom = null;
    const d = (ARENA_RULES.speed * dt) / 1000;
    step = { x: move.x * d, y: move.y * d };
    if (move.x !== 0 || move.y !== 0) s.facing = Math.atan2(move.y, move.x);
  }
  s.pos = clampToFloor(def, { x: s.pos.x + step.x, y: s.pos.y + step.y }, ARENA_RULES.playerRadius);
  pushOutOfBoss(def, s);

  // 2. Hazards: strikes take effect, the player is hit, finished ones clear.
  for (const h of s.hazards) {
    if (t0 < h.activeAt && t1 >= h.activeAt) strike(def, s, h, events);
    if (t1 > h.activeAt && t0 < h.endAt && !h.hit && inShape(h.shape, s.pos, ARENA_RULES.hurtRadius)) {
      if (takeHit(s, h.kind, Math.max(t0, h.activeAt), events)) h.hit = true;
    }
  }
  const done = s.hazards.filter((h) => t1 >= h.endAt);
  if (done.length > 0) {
    s.hazards = s.hazards.filter((h) => t1 < h.endAt);
    for (const h of done) if (h.aimed && !h.hit) events.push({ type: 'evade', attack: h.kind });
  }

  // 3. A downed boss gets back up.
  if (s.down && t1 >= s.down.until) {
    s.down = null;
    events.push({ type: 'up' });
    pushOutOfBoss(def, s);
  }

  // 4. A finished charge heals, but never past the current stage's starting HP (as in fight.ts).
  if (s.charge && t1 >= s.charge.until) {
    const cap = Math.min(def.maxHp, currentStage(def, s).atHp);
    const amount = Math.max(0, Math.min(cap - s.hp, s.charge.heal));
    s.hp += amount;
    s.charge = null;
    events.push({ type: 'heal', amount });
  }

  // 5. Between attacks the standing boss turns towards the player, at a limited rate.
  if (!s.down && t1 >= s.bossLockedUntil) {
    const want = angleTo(s.boss, s.pos);
    const diff = angleDiff(want, s.bossFacing);
    const max = (currentStage(def, s).turnDegPerS * DEG * dt) / 1000;
    s.bossFacing += Math.max(-max, Math.min(max, diff));
  }

  s.t = t1;

  // 6. The boss's next move.
  if (!s.down && t1 >= s.nextMoveAt && t1 >= s.stageBannerUntil) startMove(def, s);
}

function pushOutOfBoss(def: ArenaFightDefinition, s: ArenaState): void {
  if (s.down) return;
  const min = def.bossRadius + ARENA_RULES.playerRadius;
  const d = dist(s.pos, s.boss);
  if (d >= min) return;
  const a = d > 1e-6 ? angleTo(s.boss, s.pos) : s.bossFacing;
  s.pos = clampToFloor(def, along(s.boss, a, min), ARENA_RULES.playerRadius);
}

/** The moment a hazard becomes active: a hop lands, a topple falls. */
function strike(def: ArenaFightDefinition, s: ArenaState, h: Hazard, events: ArenaEvent[]): void {
  if (h.kind === 'hop' && h.landAt) {
    s.boss = { ...h.landAt };
  } else if (h.kind === 'topple' && h.shape.type === 'strip') {
    const { o, dir, length } = h.shape;
    // It lies along the strip: its middle is the new position, the bottle sits near the top end.
    s.boss = clampToFloor(def, along(o, dir, length / 2), bossInset(def));
    s.bossFacing = dir;
    s.down = {
      cause: 'topple',
      from: h.activeAt,
      until: h.activeAt + (h.downMs ?? 0),
      weak: clampToFloor(def, along(o, dir, length * 0.85), ARENA_RULES.playerRadius),
    };
    s.bossLockedUntil = s.down.until;
    events.push({ type: 'down', cause: 'topple' });
  }
}

function currentStage(def: ArenaFightDefinition, s: ArenaState): ArenaStage {
  return def.stages[s.stage] ?? def.stages[def.stages.length - 1]!;
}

function addHazard(
  s: ArenaState,
  kind: ArenaAttack,
  shape: Shape,
  telegraphMs: number,
  activeMs: number,
  extra: Partial<Hazard> = {},
): Hazard {
  const h: Hazard = {
    id: s.nextId++,
    kind,
    shape,
    warnAt: s.t,
    activeAt: s.t + telegraphMs,
    endAt: s.t + telegraphMs + activeMs,
    hit: false,
    aimed: inShape(shape, s.pos, ARENA_RULES.hurtRadius),
    ...extra,
  };
  s.hazards.push(h);
  return h;
}

function randomFloorPoint(def: ArenaFightDefinition, s: ArenaState, inset: number): Vec {
  const w = def.floor.halfW - inset;
  const h = def.floor.halfH - inset;
  return { x: (draw(s) * 2 - 1) * w, y: (draw(s) * 2 - 1) * h };
}

function startMove(def: ArenaFightDefinition, s: ArenaState): void {
  const stage = currentStage(def, s);
  if (s.cycleIndex === 0) s.round += 1;
  const move = stage.cycle[s.cycleIndex % stage.cycle.length]!;
  s.cycleIndex = (s.cycleIndex + 1) % stage.cycle.length;
  const strikeMs = ARENA_RULES.strikeMs;
  const aim = angleTo(s.boss, s.pos);
  let duration = 0;

  // Aimed attacks turn the boss to the player at once and hold that facing until they strike.
  const lock = (ms: number) => {
    s.bossFacing = aim;
    s.bossLockedUntil = s.t + ms;
  };

  switch (move.kind) {
    case 'coins':
      lock(move.telegraphMs + strikeMs);
      for (const off of move.fanDeg) {
        const shape: Shape = { type: 'cone', o: { ...s.boss }, dir: aim + off * DEG, half: move.halfAngleDeg * DEG, range: move.range };
        addHazard(s, 'coins', shape, move.telegraphMs, strikeMs);
      }
      duration = move.telegraphMs + strikeMs;
      break;
    case 'soda':
      for (let i = 0; i < move.count; i++) {
        const c = i === 0 ? { ...s.pos } : randomFloorPoint(def, s, move.radius * 0.5);
        addHazard(s, 'soda', { type: 'circle', c, r: move.radius }, move.telegraphMs, move.activeMs);
      }
      duration = move.telegraphMs;
      break;
    case 'hop': {
      lock(move.telegraphMs + strikeMs);
      // The impact is where the player stood; near a wall the boss itself lands a little further
      // in (so there is always room round it), but hugging a corner is no shelter.
      const landAt = clampToFloor(def, s.pos, bossInset(def));
      addHazard(s, 'hop', { type: 'circle', c: { ...s.pos }, r: move.radius }, move.telegraphMs, strikeMs, { landAt });
      duration = move.telegraphMs + strikeMs;
      break;
    }
    case 'rattle':
      lock(move.telegraphMs + strikeMs);
      addHazard(s, 'rattle', { type: 'circle', c: { ...s.boss }, r: move.radius }, move.telegraphMs, strikeMs);
      duration = move.telegraphMs + strikeMs;
      break;
    case 'topple': {
      lock(move.telegraphMs + strikeMs);
      const shape: Shape = { type: 'strip', o: { ...s.boss }, dir: aim, length: move.length, width: move.width };
      addHazard(s, 'topple', shape, move.telegraphMs, strikeMs, { downMs: move.downMs });
      duration = move.telegraphMs + move.downMs;
      break;
    }
    case 'maintenance':
      if (!s.charge && def.sockets.length > 0) {
        // Never the socket nearest the player: reaching it should take some running.
        const order = def.sockets
          .map((p, i) => ({ i, d: dist(p, s.pos) }))
          .sort((a, b) => a.d - b.d);
        const choices = order.length > 1 ? order.slice(1) : order;
        const pick = choices[Math.floor(draw(s) * choices.length)]!;
        s.charge = { from: s.t, until: s.t + move.chargeMs, heal: move.heal, socket: { ...def.sockets[pick.i]! } };
      }
      break;
    case 'wait':
      duration = move.ms;
      break;
  }
  s.nextMoveAt = s.t + duration + stage.gapMs + Math.floor(draw(s) * ARENA_RULES.gapJitterMs);
}
