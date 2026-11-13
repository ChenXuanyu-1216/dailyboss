import {
  createFight,
  stepFight,
  type FightCommand,
  type FightDefinition,
  type FightInput,
  type FightState,
} from '../src/game/fight';

/**
 * Scripted players for the fight simulation. They only see what the arena shows (lanes that glow,
 * the toner warning, the exposed weak point, the charge bar), and only after `reactionMs`.
 */

export interface RunResult {
  won: boolean;
  hits: number;
  /** Fight time when the run stopped, in ms. */
  t: number;
  whiffs: number;
}

export type Policy = (s: FightState, mem: Record<string, number>) => FightInput;

export const FRAME_MS = 1000 / 60;

export function runFight(
  def: FightDefinition,
  seed: number,
  policy: Policy,
  { maxMs = 240_000, maxHits = Infinity }: { maxMs?: number; maxHits?: number } = {},
): RunResult {
  let s = createFight(def, seed);
  const mem: Record<string, number> = {};
  let whiffs = 0;
  while (!s.won && s.t < maxMs && s.hits < maxHits) {
    const input = policy(s, mem);
    const r = stepFight(def, s, input, FRAME_MS);
    whiffs += r.events.filter((e) => e.type === 'whiff').length;
    s = r.state;
  }
  return { won: s.won, hits: s.hits, t: s.t, whiffs };
}

/** A careful human: reacts after `reactionMs`, presses a key at most every `keyGapMs`. */
export function skilledPolicy(reactionMs = 250, keyGapMs = 110): Policy {
  return (s, mem) => {
    const t = s.t;
    const seen = (at: number) => at + reactionMs <= t;
    const papers = s.papers.filter((p) => seen(p.spawnAt) && p.impactAt > t);
    const danger = (lane: number, within = Infinity) =>
      papers.some((p) => p.lane === lane && p.impactAt - t <= within);
    const toner = s.toner && seen(s.toner.warnAt) ? s.toner : null;
    const exposure = s.exposure && seen(s.exposure.from) ? s.exposure : null;
    const charge = s.charge && seen(s.charge.from) ? s.charge : null;

    const canPress = t - (mem.lastKey ?? -Infinity) >= keyGapMs;
    const press = (cmd: FightCommand): FightInput => {
      mem.lastKey = t;
      return { commands: [cmd], block: false, reset: false };
    };
    const idle: FightInput = { commands: [], block: false, reset: false };

    // Toner about to fire (or firing): block, unless a paper in this lane lands first.
    if (toner && toner.activeAt - t <= 200 && !danger(s.lane, toner.activeAt - t)) {
      return { commands: [], block: true, reset: false };
    }

    // Standing in a lane that is about to be hit: step out, but never into a sheet that lands
    // sooner than the one in this lane (wait for it to land first).
    if (danger(s.lane)) {
      if (!canPress) return idle;
      const nextImpact = (lane: number) =>
        Math.min(...papers.filter((p) => p.lane === lane).map((p) => p.impactAt), Infinity);
      const mine = nextImpact(s.lane);
      const adjacent = [s.lane - 1, s.lane + 1].filter((l) => l >= 0 && l <= 2);
      const better = adjacent
        .filter((l) => nextImpact(l) > mine + 50)
        .sort((a, b) => nextImpact(b) - nextImpact(a))[0];
      if (better !== undefined) return press(better < s.lane ? 'left' : 'right');
      for (const far of [s.lane - 2, s.lane + 2]) {
        if (far < 0 || far > 2 || danger(far)) continue;
        const mid = (far + s.lane) / 2;
        if (nextImpact(mid) - t > 2 * keyGapMs + 60) return press(far < s.lane ? 'left' : 'right');
      }
      return idle;
    }

    // Keep channelling while it is safe.
    if (s.channelFrom !== null && charge && !toner) return { commands: [], block: false, reset: true };

    if (exposure) {
      if (exposure.lane === s.lane) return canPress && t >= s.pullReadyAt ? press('pull') : idle;
      const step = exposure.lane < s.lane ? -1 : 1;
      if (canPress && !danger(s.lane + step, 450)) return press(step < 0 ? 'left' : 'right');
      return idle;
    }

    if (charge && !toner && t >= s.resetReadyAt && !danger(s.lane, 900)) {
      return { commands: [], block: false, reset: true };
    }
    return idle;
  };
}

/** Never touches anything. */
export const idlePolicy: Policy = () => ({ commands: [], block: false, reset: false });

/** Mashes pull every frame without ever moving — the old "spacebar" strategy. */
export const mashPolicy: Policy = () => ({ commands: ['pull'], block: false, reset: false });

/** Holds block forever and mashes pull — tries to turtle through the fight. */
export const turtlePolicy: Policy = () => ({ commands: ['pull'], block: true, reset: false });

/** Mashes everything at once: random lane changes plus pull, block and reset held. */
export function chaosPolicy(): Policy {
  return (s) => ({
    commands: [Math.floor(s.t / 200) % 2 === 0 ? 'left' : 'right', 'pull'],
    block: Math.floor(s.t / 900) % 2 === 0,
    reset: true,
  });
}
