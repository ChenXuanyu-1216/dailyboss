import type { Outcome } from '../game/contracts';
import type { AttackKind, FightEvent } from '../game/fight';

/**
 * What happened in a run, tallied from the fight events (presentation only: the rules engine
 * never reads it). Feeds the results screen: clear time, the breakdown, and one improvement tip.
 */
export interface RunStats {
  /** Fight time across all fights, in ms (briefings and pauses excluded; slowed in assist mode). */
  fightMs: number;
  hits: Record<AttackKind, number>;
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
  };
}

/** Adds one frame's events to the tally (mutates and returns `stats`, it lives in a ref). */
export function addFrame(stats: RunStats, events: readonly FightEvent[], dtMs: number): RunStats {
  stats.fightMs += Math.max(0, dtMs);
  for (const e of events) {
    switch (e.type) {
      case 'hit':
        stats.hits[e.attack] += 1;
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
  return stats.hits.paper + stats.hits.toner + stats.hits.pinch;
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
  const { paper, toner, pinch } = stats.hits;
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
