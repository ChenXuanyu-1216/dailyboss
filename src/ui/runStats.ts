import type { ArenaEvent } from '../game/arena';
import type { HitKind, Outcome } from '../game/contracts';
import type { FightEvent } from '../game/fight';

/**
 * What happened in a run, tallied from the fight events (presentation only: the rules engine
 * never reads it). Feeds the results screen: clear time, the breakdown, and one improvement tip.
 */
export interface RunStats {
  /** Fight time across all fights, in ms (briefings and pauses excluded; slowed in assist mode). */
  fightMs: number;
  /** Hits taken, by what hit (lane attacks and arena hazards; kinds never seen are absent). */
  hits: Partial<Record<HitKind, number>>;
  whiffs: number;
  /** Weak points (jam, stun or counter) that retracted unpulled. */
  missed: number;
  /** Charges that finished and healed the printer. */
  heals: number;
  interrupts: number;
  /** Precise dodges and blocks. */
  perfects: number;
  /** Damage dealt through counters. */
  counters: number;
  heavyPulls: number;
  /** Arena: attacks that bounced off the boss's armoured front (or a downed boss's body). */
  clanks: number;
  /** Arena: hits on a downed boss's weak point. */
  weakHits: number;
}

export function emptyStats(): RunStats {
  return {
    fightMs: 0,
    hits: { paper: 0, toner: 0, pinch: 0 },
    whiffs: 0,
    missed: 0,
    heals: 0,
    interrupts: 0,
    perfects: 0,
    counters: 0,
    heavyPulls: 0,
    clanks: 0,
    weakHits: 0,
  };
}

function countHit(stats: RunStats, kind: HitKind): void {
  stats.hits[kind] = (stats.hits[kind] ?? 0) + 1;
}

/** Arena counterpart of `addFrame` (open-arena fights, src/game/arena.ts). */
export function addArenaFrame(stats: RunStats, events: readonly ArenaEvent[], dtMs: number): RunStats {
  stats.fightMs += Math.max(0, dtMs);
  for (const e of events) {
    switch (e.type) {
      case 'hit':
        countHit(stats, e.attack);
        break;
      case 'whiff':
        stats.whiffs += 1;
        break;
      case 'clank':
        stats.clanks += 1;
        break;
      case 'heal':
        if (e.amount > 0) stats.heals += 1;
        break;
      case 'interrupt':
        stats.interrupts += 1;
        break;
      case 'damage':
        if (e.weak) stats.weakHits += 1;
        break;
      default:
        break;
    }
  }
  return stats;
}

/** Adds one frame's events to the tally (mutates and returns `stats`, it lives in a ref). */
export function addFrame(stats: RunStats, events: readonly FightEvent[], dtMs: number): RunStats {
  stats.fightMs += Math.max(0, dtMs);
  for (const e of events) {
    switch (e.type) {
      case 'hit':
        countHit(stats, e.attack);
        break;
      case 'whiff':
        stats.whiffs += 1;
        break;
      case 'window-missed':
        stats.missed += 1;
        break;
      case 'heal':
        if (e.amount > 0) stats.heals += 1;
        break;
      case 'interrupt':
        stats.interrupts += 1;
        break;
      case 'perfect':
        stats.perfects += 1;
        break;
      case 'damage':
        if (e.counter) stats.counters += 1;
        if (e.heavy) stats.heavyPulls += 1;
        break;
      default:
        break;
    }
  }
  return stats;
}

export function totalHits(stats: RunStats): number {
  return Object.values(stats.hits).reduce((a, n) => a + (n ?? 0), 0);
}

/** "1:07.4" */
export function formatTime(ms: number): string {
  const tenths = Math.max(0, Math.round(ms / 100));
  const min = Math.floor(tenths / 600);
  const sec = Math.floor((tenths % 600) / 10);
  return `${min}:${String(sec).padStart(2, '0')}.${tenths % 10}`;
}

/**
 * The one thing most worth changing next time, judged from the run. Ordered by what costs the
 * most: what hit you, then what slowed you down, then the next technique to try.
 */
export function improvementTip(stats: RunStats, outcome: Outcome, mastery: boolean): string {
  const { paper = 0, toner = 0, pinch = 0 } = stats.hits;
  const worst = Math.max(paper, toner, pinch);
  if (worst > 0) {
    if (worst === toner) {
      return `${toner} 次被墨粉喷中：出纸口开始漏粉就按住 ↓，一直按到喷射结束再松手。`;
    }
    if (worst === paper) {
      return `${paper} 次被纸砸中：通道一发光就离开；连发时先看哪条通道最后落纸。`;
    }
    return `${pinch} 次重拽时被夹手：先看弱点下方的倒计时，剩不到一半就轻点 ↑ 快拽。`;
  }
  if (stats.heals > 0) {
    return `打印机装完了 ${stats.heals} 次更新：看到充能条就按住 K，打断后还能拽出大弱点。`;
  }
  if (stats.missed >= 3) {
    return `${stats.missed} 个弱点没拽就缩回去了：弱点总在别的通道出现，提前往中路站。`;
  }
  if (stats.whiffs >= 3) {
    return `扑空了 ${stats.whiffs} 次：只在弱点就在你脚下那条通道时按 ↑，扑空会被夹手 0.6 秒。`;
  }
  if (outcome === 'failure') return '先在辅助模式下熟悉招式，再回来挑战。';
  if (mastery && stats.perfects === 0) {
    return '零失误！下一步：纸快落地时才闪开，或墨粉喷出前一刻才格挡，打印机会提前露出破绽。';
  }
  if (mastery && stats.heavyPulls === 0) {
    return '试试重拽：弱点刚露出、附近没有来纸时按住 ↑ 约 0.7 秒，伤害 +1。';
  }
  return '零失误！再快一点：多用极限闪避和重拽，刷新最佳时间。';
}

const ARENA_HIT_TIPS: Record<'coins' | 'soda' | 'hop' | 'rattle' | 'topple', (n: number) => string> = {
  coins: (n) => `${n} 次被硬币砸中：它吐币前会朝你转身，往扇形的侧面走，贴近它反而更容易绕开。`,
  soda: (n) => `${n} 次踩进汽水：圆圈出现在你脚下，马上离开；水洼会留一阵，别走回去。`,
  hop: (n) => `${n} 次被跳砸压中：它蹲下时脚下会出现圆圈，往任意方向走出去就行。`,
  rattle: (n) => `${n} 次被摇晃撞到：它身边出现大圆圈时就后撤，打完一下别贪刀。`,
  topple: (n) => `${n} 次被压住：长条只朝一个方向，往侧面走，不要往后退。`,
};

/** The arena version of `improvementTip`: what hit you most, then what slowed you down. */
export function arenaTip(stats: RunStats, outcome: Outcome): string {
  const worst = (Object.keys(ARENA_HIT_TIPS) as (keyof typeof ARENA_HIT_TIPS)[])
    .map((kind) => ({ kind, n: stats.hits[kind] ?? 0 }))
    .sort((a, b) => b.n - a.n)[0]!;
  if (worst.n > 0) return ARENA_HIT_TIPS[worst.kind](worst.n);
  if (stats.heals > 0) {
    return `它完成了 ${stats.heals} 次维护：看到插座发光就跑过去按 J 拔电源，它会停电露出饮料。`;
  }
  if (stats.clanks >= 5) {
    return `${stats.clanks} 下打在了玻璃正面：它出招时会锁定方向，趁这时绕到侧面或背后。`;
  }
  if (outcome === 'failure') return '先在辅助模式下熟悉招式，再回来挑战。';
  if (stats.weakHits === 0) return '零失误！它倒下时去砸顶上的饮料，一下顶好几下。';
  return '零失误！再快一点：用冲刺缩短跑位，倒下的瞬间就去砸饮料。';
}
