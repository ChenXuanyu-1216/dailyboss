import {
  ARENA_RULES,
  type ArenaFightDefinition,
  type ArenaEvent,
  type ArenaState,
  type Hazard,
  type Vec,
} from '../game/arena';

/**
 * Animation poses for the 3D arena, derived from the simulation state (presentation only: no
 * Three.js, no rules). The models ease toward these; one-off reactions (recoil, landing squash,
 * flinches) are springs inside the models, triggered by the fight's events.
 *
 * Coordinates are the simulation's floor (x across, y away from the camera); angles are the
 * simulation's (radians, counter-clockwise from +x).
 */

/** What the machine's LCD face shows. */
export type FaceMood =
  | 'idle'
  | 'focus'
  | 'angry'
  | 'guard'
  | 'loading'
  | 'hurt'
  | 'dizzy'
  | 'off'
  | 'defeated'
  | 'smug'
  | 'happy';

/** The machine's proportions in the arena (world units; its footprint matches `bossRadius`). */
export interface MachineSize {
  width: number;
  depth: number;
  height: number;
}

export function machineSize(def: ArenaFightDefinition): MachineSize {
  const r = def.bossRadius;
  return { width: r * 1.75, depth: r * 1.1, height: r * 2.9 };
}

export interface MachinePose {
  /**
   * Where the standing footprint's centre would be. While the machine falls or gets up it pivots
   * on its front bottom edge, `anchor + dir · depth/2`, so its body can lie elsewhere.
   */
  anchor: Vec;
  /** Height of the feet above the floor (a hop's arc). */
  lift: number;
  /** Facing (and the direction it falls in). */
  yaw: number;
  /** 0 standing … 1 lying face down along `yaw`. */
  fall: number;
  /** Vertical scale: below 1 crouching, above 1 stretched in the air. */
  squash: number;
  /** Tilt about its side axis in radians: positive leans forward (toward `yaw`). */
  lean: number;
  /** 0 … 1 violent shaking (rattle) — the model adds the noise. */
  shake: number;
  /** 0 … 1 low hum (maintenance, soda). */
  hum: number;
  mood: FaceMood;
  /** Maintenance progress 0 … 1 (shown on the face). */
  progress: number;
  /** Screen and sign brightness: 0 unplugged … 1. */
  power: number;
  /** The coin slot heating up before a coin spray, 0 … 1. */
  slotGlow: number;
  /** The stuck drink is exposed (down): 0 … 1. */
  drinkOut: number;
  /** Glass shimmer while it braces after a hit, 0 … 1. */
  guard: number;
  /** Accent colour key for lights and the sign. */
  tone: 'calm' | 'warn' | 'danger' | 'power' | 'off' | 'done';
}

/** Remembers where a topple started (the hazard is gone before the fall finishes). */
export interface MachineMemo {
  topple: { from: Vec; dir: number; length: number; at: number } | null;
}

export function newMachineMemo(): MachineMemo {
  return { topple: null };
}

/** Ground-level combat cue. The animated cabinet can leave its rules-defined footprint. */
export function armorPose(s: ArenaState): { center: Vec; yaw: number; visible: boolean } {
  return { center: s.boss, yaw: s.bossFacing, visible: !s.down && !s.won };
}

/** The charge owns a copy of its socket position, not the same object as the floor plate. */
export function isLiveSocket(s: ArenaState, socket: Vec): boolean {
  const live = s.charge?.socket;
  return live !== undefined && live.x === socket.x && live.y === socket.y;
}

/** How long the fall takes after the topple strikes, and how long getting up takes. */
export const FALL_MS = 240;
export const RISE_MS = 480;
/** A hop crouches for this share of its warning, then is airborne for the rest. */
export const HOP_CROUCH = 0.55;
export const HOP_HEIGHT = 2.4;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const easeIn = (k: number) => k * k;
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const along = (o: Vec, a: number, d: number): Vec => ({ x: o.x + Math.cos(a) * d, y: o.y + Math.sin(a) * d });

/** Warning progress of a hazard at time t: 0 when it appears, 1 when it strikes. */
export function warnProgress(h: Hazard, t: number): number {
  return clamp01((t - h.warnAt) / Math.max(1, h.activeAt - h.warnAt));
}

/** The boss's own wind-up: the most recent hazard still warning (soda puddles count too). */
function windup(s: ArenaState): Hazard | null {
  let best: Hazard | null = null;
  for (const h of s.hazards) {
    if (s.t < h.activeAt && (!best || h.warnAt > best.warnAt)) best = h;
  }
  return best;
}

/** Distance from the standing footprint centre to the lying body's centre. */
function lieOffset(size: MachineSize): number {
  return size.depth / 2 + size.height / 2;
}

export function machinePose(def: ArenaFightDefinition, s: ArenaState, memo: MachineMemo): MachinePose {
  const t = s.t;
  const size = machineSize(def);
  const pose: MachinePose = {
    anchor: { ...s.boss },
    lift: 0,
    yaw: s.bossFacing,
    fall: 0,
    squash: 1,
    lean: 0,
    shake: 0,
    hum: 0,
    mood: s.stage > 0 ? 'angry' : 'idle',
    progress: 0,
    power: 1,
    slotGlow: 0,
    drinkOut: 0,
    guard: 0,
    tone: s.stage > 0 ? 'warn' : 'calm',
  };

  if (s.won) {
    return { ...pose, mood: 'defeated', power: 0.35, lean: -0.06, squash: 0.97, tone: 'done', drinkOut: 1 };
  }

  // Remember a topple's start while it is still on the board.
  for (const h of s.hazards) {
    if (h.kind === 'topple' && h.shape.type === 'strip') {
      memo.topple = { from: { ...h.shape.o }, dir: h.shape.dir, length: h.shape.length, at: h.activeAt };
    }
  }

  if (s.down) {
    const d = s.down;
    pose.drinkOut = clamp01((t - d.from - (d.cause === 'topple' ? FALL_MS : 0)) / 260);
    pose.tone = 'off';
    if (d.cause === 'unplug') {
      pose.power = 0;
      pose.mood = 'off';
      pose.lean = 0.07;
      pose.squash = 0.98;
      return pose;
    }
    pose.mood = 'dizzy';
    pose.power = 0.6;
    const lying = along(s.boss, s.bossFacing + Math.PI, lieOffset(size));
    const falling = clamp01((t - d.from) / FALL_MS);
    const rising = clamp01((d.until - t) / RISE_MS);
    if (falling < 1) {
      // Falling: the pivot lunges from where it stood to where it will lie.
      const m = memo.topple && Math.abs(memo.topple.at - d.from) < 1 ? memo.topple : null;
      const from = m ? m.from : lying;
      const k = easeIn(falling);
      pose.fall = Math.max(0.2, k);
      pose.anchor = { x: lerp(from.x, lying.x, k), y: lerp(from.y, lying.y, k) };
    } else if (rising < 1) {
      // Getting up where the simulation already stands it.
      const k = easeInOut(1 - rising);
      pose.fall = 1 - k;
      pose.anchor = { x: lerp(lying.x, s.boss.x, k), y: lerp(lying.y, s.boss.y, k) };
      pose.mood = 'angry';
    } else {
      pose.fall = 1;
      pose.anchor = lying;
    }
    return pose;
  }

  if (s.charge) {
    pose.mood = 'loading';
    pose.progress = clamp01((t - s.charge.from) / Math.max(1, s.charge.until - s.charge.from));
    pose.hum = 0.35;
    pose.tone = 'power';
  }

  if (t < s.braceUntil) {
    pose.guard = clamp01((s.braceUntil - t) / ARENA_RULES.braceMs);
    if (!s.charge) pose.mood = 'guard';
  }

  const h = windup(s);
  if (h) {
    const p = warnProgress(h, t);
    pose.tone = 'danger';
    switch (h.kind) {
      case 'coins':
        pose.mood = 'focus';
        pose.slotGlow = p;
        // Rears back, then snaps forward as the coins fly.
        pose.lean = p < 0.8 ? -0.14 * easeOut(p / 0.8) : lerp(-0.14, 0.16, (p - 0.8) / 0.2);
        break;
      case 'soda':
        pose.mood = 'focus';
        pose.hum = Math.max(pose.hum, 0.5);
        pose.squash = 1 - 0.05 * Math.sin(p * Math.PI);
        break;
      case 'hop': {
        pose.mood = 'angry';
        const land = h.landAt ?? s.boss;
        if (p < HOP_CROUCH) {
          pose.squash = 1 - 0.24 * easeOut(p / HOP_CROUCH);
        } else {
          const q = (p - HOP_CROUCH) / (1 - HOP_CROUCH);
          const k = easeInOut(q);
          pose.anchor = { x: lerp(s.boss.x, land.x, k), y: lerp(s.boss.y, land.y, k) };
          pose.lift = HOP_HEIGHT * Math.sin(Math.PI * q);
          pose.squash = 1.1 - 0.1 * q;
          pose.yaw = Math.atan2(land.y - s.boss.y, land.x - s.boss.x) || s.bossFacing;
        }
        break;
      }
      case 'rattle':
        pose.mood = 'angry';
        pose.shake = 0.35 + 0.65 * p;
        break;
      case 'topple':
        pose.mood = 'angry';
        // Rocks back on its heels, then tips past the point of no return.
        pose.lean = p < 0.75 ? -0.2 * easeOut(p / 0.75) : lerp(-0.2, 0.32, easeIn((p - 0.75) / 0.25));
        break;
    }
  }
  return pose;
}

/**
 * Where the lying (or falling) machine's body centre is, for effects that need it: the dust of
 * the impact, the drink rolling out.
 */
export function bodyCentre(def: ArenaFightDefinition, pose: MachinePose): Vec {
  const size = machineSize(def);
  const a = (pose.fall * Math.PI) / 2;
  const edge = along(pose.anchor, pose.yaw, size.depth / 2);
  // Centre relative to the front bottom edge, rotated by the fall angle about it.
  const back = -size.depth / 2;
  const up = size.height / 2;
  const forward = back * Math.cos(a) + up * Math.sin(a);
  return along(edge, pose.yaw, forward);
}

export interface StudentPose {
  pos: Vec;
  yaw: number;
  /** Fist out, 0 … 1 … 0 over a swing; −1 when not attacking. */
  swing: number;
  /** 0 … 1 through a dash; −1 when not dashing. */
  dash: number;
  /** 1 just hit, fading to 0. */
  hurt: number;
  /** Blinking while invulnerable after a hit. */
  hidden: boolean;
  cheer: boolean;
}

export const SWING_MS = 260;
export const HURT_MS = 520;

export function studentPose(s: ArenaState, motion: boolean): StudentPose {
  const t = s.t;
  const attackAt = s.attackReadyAt - ARENA_RULES.attackCooldownMs;
  const sinceAttack = t - attackAt;
  const swing = s.attackReadyAt > 0 && sinceAttack >= 0 && sinceAttack < SWING_MS ? sinceAttack / SWING_MS : -1;
  const dashing = s.dashFrom !== null && t < s.dashFrom + ARENA_RULES.dashMs;
  const dash = dashing ? clamp01((t - s.dashFrom!) / ARENA_RULES.dashMs) : -1;
  const hitAt = s.invulnerableUntil - ARENA_RULES.invulnerableMs;
  const sinceHit = t - hitAt;
  const hurt = s.hits > 0 && sinceHit >= 0 && sinceHit < HURT_MS ? 1 - sinceHit / HURT_MS : 0;
  const invulnerable = s.hits > 0 && t < s.invulnerableUntil && !dashing;
  return {
    pos: { ...s.pos },
    yaw: s.facing,
    swing,
    dash,
    hurt,
    hidden: invulnerable && motion && sinceHit > 120 && Math.floor(t / 90) % 2 === 0,
    cheer: s.won,
  };
}

/** Sim floor point → Three.js world (y up, the camera on the +z side). */
export function toWorld(v: Vec, height = 0): [number, number, number] {
  return [v.x, height, -v.y];
}

/** Sim facing → rotation.y of a model whose front is +z. */
export function yawToRotation(a: number): number {
  return a + Math.PI / 2;
}

/** The shortest signed turn from angle a to angle b. */
export function turnToward(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** One simulation step, as the arena fight hands it to the 3D scene for its effects. */
export interface ArenaFeedItem {
  before: ArenaState;
  after: ArenaState;
  events: readonly ArenaEvent[];
}

/**
 * The portrait beside the fight (src/scenes/VendingScene.tsx) has no simulation state, only the
 * level's cue, the outcome and the boss's health; this gives it the same machine's pose.
 */
export function portraitPose(cue: string, outcome: string | null, bossHealth: number | null): MachinePose {
  const base: MachinePose = {
    anchor: { x: 0, y: 0 },
    lift: 0,
    yaw: Math.PI / 2,
    fall: 0,
    squash: 1,
    lean: 0,
    shake: 0,
    hum: 0,
    mood: 'idle',
    progress: 0,
    power: 1,
    slotGlow: 0,
    drinkOut: 0,
    guard: 0,
    tone: 'calm',
  };
  if (outcome === 'perfect' || outcome === 'normal') {
    return { ...base, mood: 'defeated', tone: 'done', power: 0.7, drinkOut: 1, lean: outcome === 'normal' ? -0.05 : 0 };
  }
  if (outcome === 'failure') return { ...base, mood: 'smug', tone: 'warn', lean: -0.04 };
  switch (cue) {
    case 'change':
      return { ...base, mood: 'focus', tone: 'warn', hum: 0.3 };
    case 'boss': {
      const damage = bossHealth === null ? 0 : Math.min(1, Math.max(0, 1 - bossHealth));
      return { ...base, mood: 'angry', tone: 'danger', shake: 0.12 + damage * 0.35, slotGlow: 0.3 + damage * 0.5 };
    }
    default:
      return base;
  }
}
