import {
  ARENA_RULES,
  angleDiff,
  angleTo,
  canUseArena,
  createArena,
  dist,
  inArmor,
  inReach,
  inShape,
  stepArena,
  type ArenaCommand,
  type ArenaFightDefinition,
  type ArenaInput,
  type ArenaState,
  type Vec,
} from '../src/game/arena';

/**
 * Scripted players for the open-arena simulation. Like tests/fightBot.ts they only react to what
 * the screen shows (floor warnings, the socket glow, the downed boss), and only after `reactionMs`.
 */

export interface ArenaRunResult {
  won: boolean;
  hits: number;
  /** Fight time when the run stopped, in ms. */
  t: number;
  heals: number;
  interrupts: number;
  clanks: number;
  bodyDamage: number;
  weakDamage: number;
  hitBy: Record<string, number>;
}

export type ArenaPolicy = (s: ArenaState, mem: Record<string, number>) => ArenaInput;

export const FRAME_MS = 1000 / 60;

export function runArena(
  def: ArenaFightDefinition,
  seed: number,
  policy: ArenaPolicy,
  { maxMs = 300_000, maxHits = Infinity }: { maxMs?: number; maxHits?: number } = {},
): ArenaRunResult {
  let s = createArena(def, seed);
  const mem: Record<string, number> = {};
  let heals = 0;
  let interrupts = 0;
  let clanks = 0;
  let bodyDamage = 0;
  let weakDamage = 0;
  const hitBy: Record<string, number> = {};
  while (!s.won && s.t < maxMs && s.hits < maxHits) {
    const r = stepArena(def, s, policy(s, mem), FRAME_MS);
    for (const e of r.events) {
      if (e.type === 'heal' && e.amount > 0) heals += 1;
      if (e.type === 'interrupt') interrupts += 1;
      if (e.type === 'clank') clanks += 1;
      if (e.type === 'hit') hitBy[e.attack] = (hitBy[e.attack] ?? 0) + 1;
      if (e.type === 'damage') {
        if (e.weak) weakDamage += e.amount;
        else bodyDamage += e.amount;
      }
    }
    s = r.state;
  }
  return { won: s.won, hits: s.hits, t: s.t, heals, interrupts, clanks, bodyDamage, weakDamage, hitBy };
}

const STILL: Vec = { x: 0, y: 0 };

function toward(from: Vec, to: Vec): Vec {
  const d = dist(from, to);
  return d < 0.08 ? STILL : { x: (to.x - from.x) / d, y: (to.y - from.y) / d };
}

function along(o: Vec, dir: number, d: number): Vec {
  return { x: o.x + Math.cos(dir) * d, y: o.y + Math.sin(dir) * d };
}

/** The nearest floor point (on rings around the player) that passes `ok`, or null. */
function nearestSafe(def: ArenaFightDefinition, from: Vec, ok: (p: Vec) => boolean): Vec | null {
  const inset = ARENA_RULES.playerRadius;
  for (let r = 0.3; r <= 9; r += 0.3) {
    let best: Vec | null = null;
    for (let i = 0; i < 32; i++) {
      const p = along(from, (i / 32) * 2 * Math.PI, r);
      if (Math.abs(p.x) > def.floor.halfW - inset || Math.abs(p.y) > def.floor.halfH - inset) continue;
      if (ok(p)) {
        best = p;
        break;
      }
    }
    if (best) return best;
  }
  return null;
}

export interface ArenaSkill {
  /** Never goes for the plug (lets every maintenance charge finish). */
  ignorePlug?: boolean;
  /** Never dodges: only attacks (from behind, the plug and the weak point like the careful bot). */
  noDodge?: boolean;
}

/**
 * A careful human: leaves any warned area for the nearest safe spot as soon as the warning is
 * seen (dashing when walking would be too slow), and otherwise circles to the boss's back to hit
 * it, goes for the weak point when it is down and for the plug when it charges.
 */
export function arenaSkilledPolicy(def: ArenaFightDefinition, reactionMs = 250, skill: ArenaSkill = {}): ArenaPolicy {
  const R = ARENA_RULES;
  const margin = R.hurtRadius + 0.3;
  const tightMargin = R.hurtRadius + 0.05;
  const orbit = def.bossRadius + R.playerRadius + 0.35;
  return (s, mem) => {
    const t = s.t;
    const seen = (at: number) => at + reactionMs <= t;
    const hazards = s.hazards.filter((h) => seen(h.warnAt) && h.endAt > t);
    const threats = (p: Vec, horizon = Infinity) =>
      hazards.filter((h) => h.activeAt - t <= horizon && inShape(h.shape, p, margin));
    const bodyR = def.bossRadius + R.playerRadius + 0.05;
    // A route is clear if it stays off the standing boss and reaches every point of it before any
    // warned area there goes active; the spot itself must be outside every warned area.
    const dashReady = canUseArena(def, 'dash') && t >= s.dashReadyAt;
    /** Time to cover `d` units, dashing first when the dash is ready. */
    const travelMs = (d: number) => {
      if (!dashReady) return (d / R.speed) * 1000;
      if (d <= R.dashDistance) return (d / R.dashDistance) * R.dashMs;
      return R.dashMs + ((d - R.dashDistance) / R.speed) * 1000;
    };
    const clearRoute = (p: Vec, clearance = margin) => {
      if (hazards.some((h) => inShape(h.shape, p, clearance))) return false;
      const d = dist(s.pos, p);
      for (let k = 1; k <= 6; k++) {
        const q = { x: s.pos.x + ((p.x - s.pos.x) * k) / 6, y: s.pos.y + ((p.y - s.pos.y) * k) / 6 };
        if (!s.down && dist(q, s.boss) < bodyR) return false;
        const arrive = t + travelMs((d * k) / 6);
        if (hazards.some((h) => h.activeAt <= arrive + 60 && h.endAt > arrive && inShape(h.shape, q, clearance))) {
          return false;
        }
      }
      return true;
    };
    const commands: ArenaCommand[] = [];

    // 1. Standing somewhere that will be (or is) hit: get out, sticking to the spot once picked.
    const here = skill.noDodge ? [] : threats(s.pos);
    if (here.length > 0) {
      const kept = mem.escT === undefined ? null : { x: mem.escX!, y: mem.escY! };
      // Only inside the comfort margin, not the real hurt area: with no clean route, stay put.
      const reallyIn = here.some((h) => inShape(h.shape, s.pos, tightMargin));
      // A new warning can cut off an old route. Try tighter clearance before risking a direct run.
      const safe =
        kept && t - mem.escT! < 1500 && clearRoute(kept, tightMargin)
          ? kept
          : nearestSafe(def, s.pos, clearRoute) ??
            (reallyIn
              ? nearestSafe(def, s.pos, (p) => clearRoute(p, tightMargin)) ??
                nearestSafe(def, s.pos, (p) => threats(p).length === 0 && !(!s.down && dist(p, s.boss) < bodyR))
              : null);
      if (!safe && !reallyIn) return { move: STILL, commands: [] };
      if (safe) {
        if (safe !== kept) {
          mem.escX = safe.x;
          mem.escY = safe.y;
          mem.escT = t;
        }
        const soonest = Math.min(...here.map((h) => h.activeAt - t));
        const walkMs = (dist(s.pos, safe) / R.speed) * 1000;
        if (
          canUseArena(def, 'dash') &&
          t >= s.dashReadyAt &&
          soonest > 0 &&
          walkMs + 50 > soonest &&
          dist(s.pos, safe) > 0.3 &&
          dist(s.pos, safe) <= R.dashDistance + 0.6 &&
          // A dash always covers its full distance: where it ends must be safe too.
          threats(along(s.pos, angleTo(s.pos, safe), R.dashDistance)).length === 0
        ) {
          commands.push('dash');
        }
        return { move: toward(s.pos, safe), commands };
      }
      return { move: STILL, commands: canUseArena(def, 'dash') && t >= s.dashReadyAt ? ['dash'] : [] };
    }
    delete mem.escT;

    // 2. Pick what to go for.
    let goal: Vec;
    let ready: boolean;
    if (s.down && seen(s.down.from)) {
      goal = s.down.weak;
      ready = dist(s.pos, goal) <= R.weakReach - 0.05;
    } else if (s.charge && seen(s.charge.from) && !skill.ignorePlug) {
      goal = s.charge.socket;
      ready = dist(s.pos, goal) <= R.plugReach - 0.05;
    } else {
      goal = along(s.boss, s.bossFacing + Math.PI, orbit);
      ready = inReach(def, s) && !inArmor(def, s);
      // Circle round the boss rather than through it.
      if (!s.down) {
        const at = angleTo(s.boss, s.pos);
        const diff = angleDiff(angleTo(s.boss, goal), at);
        if (Math.abs(diff) > 0.35) {
          const stepAngle = Math.sign(diff) * Math.min(Math.abs(diff), 0.8);
          goal = along(s.boss, at + stepAngle, orbit);
        }
      }
    }
    if (ready && t >= s.attackReadyAt) commands.push('attack');

    // 3. Walk there, but never into a warned area.
    let move = toward(s.pos, goal);
    if (!skill.noDodge && (move.x !== 0 || move.y !== 0)) {
      const next = { x: s.pos.x + move.x * 0.5, y: s.pos.y + move.y * 0.5 };
      if (threats(next).length > 0) move = STILL;
    }
    return { move, commands };
  };
}

/** Never touches anything. */
export const arenaIdlePolicy: ArenaPolicy = () => ({ move: STILL, commands: [] });

/** Walks straight at the boss and mashes attack — the "spacebar" strategy. */
export const arenaMashPolicy: ArenaPolicy = (s) => ({ move: toward(s.pos, s.boss), commands: ['attack'] });

/** Runs in circles mashing attack and dash. */
export const arenaChaosPolicy: ArenaPolicy = (s) => {
  const a = Math.floor(s.t / 400) * 2.1;
  return { move: { x: Math.cos(a), y: Math.sin(a) }, commands: ['attack', 'dash'] };
};
