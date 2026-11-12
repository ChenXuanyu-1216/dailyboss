import type { FightDefinition } from './fight';

/**
 * Registered fights. A level phase refers to one by `fight.id`; the validator rejects unknown IDs.
 * Fights are code (like scenes), not JSON: their numbers are tuned against the bots in
 * tests/fight.test.ts, which check that each fight is winnable without a hit at human reaction
 * speed and that button-mashing, holding block, or standing still lose.
 */

/** Warm-up 1: teaches dodge and pull. */
const printerOffline: FightDefinition = {
  id: 'printer-offline',
  maxHp: 2,
  introMs: 1200,
  stageIntroMs: 0,
  abilities: ['dodge', 'pull'],
  newAbilities: ['dodge', 'pull'],
  stun: { windowMs: 2000, damage: 1 },
  stages: [
    {
      title: '假装离线',
      atHp: 2,
      gapMs: 700,
      cycle: [
        { kind: 'paper', shots: ['aimed'], intervalMs: 0, telegraphMs: 1100, travelMs: 600 },
        { kind: 'paper', shots: ['aimed'], intervalMs: 0, telegraphMs: 1100, travelMs: 600 },
        { kind: 'jam', windowMs: 2400, lane: 'away' },
      ],
    },
  ],
  copy: {
    briefing: '打印机假装离线，却在朝你扔纸。发光的通道会被砸中——躲开它。USB 线露出来时，走到那条通道把它插回去。',
    weakPoint: '松动的 USB 线',
    charge: '正在离线',
    progress: '重新连接',
  },
};

/** Warm-up 2: teaches block and reset (and the stun → pull combo). */
const printerQueue: FightDefinition = {
  id: 'printer-queue',
  maxHp: 2,
  introMs: 1200,
  stageIntroMs: 0,
  abilities: ['dodge', 'block', 'pull', 'reset'],
  newAbilities: ['block', 'reset'],
  stun: { windowMs: 2200, damage: 2 },
  stages: [
    {
      title: '99 份任务',
      atHp: 2,
      gapMs: 600,
      cycle: [
        { kind: 'toner', telegraphMs: 1100, activeMs: 800 },
        { kind: 'wait', ms: 200 },
        { kind: 'update', chargeMs: 4500, heal: 0, parallel: false },
      ],
    },
  ],
  copy: {
    briefing: '墨粉会喷满整个屏幕，躲不开，只能按住格挡。它开始「处理队列」时，按住重启打断它——被打断的打印机会露出卡住的纸，趁机拽出来。',
    weakPoint: '卡在队列里的纸',
    charge: '正在处理 99 份任务',
    progress: '清理队列',
  },
};

/** The boss: three stages that layer the four answers together. */
const printerBoss: FightDefinition = {
  id: 'printer-boss',
  maxHp: 12,
  introMs: 1500,
  stageIntroMs: 1600,
  abilities: ['dodge', 'block', 'pull', 'reset'],
  newAbilities: [],
  stun: { windowMs: 1800, damage: 2 },
  stages: [
    {
      title: '第一形态：盖板',
      atHp: 12,
      gapMs: 450,
      cycle: [
        { kind: 'paper', shots: ['aimed', 'aimed'], intervalMs: 650, telegraphMs: 700, travelMs: 400 },
        { kind: 'paper', shots: ['pair'], intervalMs: 0, telegraphMs: 700, travelMs: 400 },
        { kind: 'jam', windowMs: 1500, lane: 'away' },
      ],
    },
    {
      title: '第二形态：拔河',
      atHp: 8,
      gapMs: 400,
      cycle: [
        { kind: 'paper', shots: ['pair'], intervalMs: 0, telegraphMs: 620, travelMs: 350 },
        { kind: 'toner', telegraphMs: 700, activeMs: 700 },
        { kind: 'paper', shots: ['aimed', 'pair'], intervalMs: 550, telegraphMs: 600, travelMs: 350 },
        { kind: 'jam', windowMs: 1200, lane: 'away' },
      ],
    },
    {
      title: '最终形态：最后两厘米',
      atHp: 4,
      gapMs: 350,
      cycle: [
        { kind: 'update', chargeMs: 5000, heal: 2, parallel: true },
        { kind: 'paper', shots: ['aimed', 'aimed', 'aimed'], intervalMs: 450, telegraphMs: 520, travelMs: 330 },
        { kind: 'toner', telegraphMs: 600, activeMs: 650 },
        { kind: 'paper', shots: ['pair'], intervalMs: 0, telegraphMs: 560, travelMs: 330 },
        { kind: 'jam', windowMs: 1000, lane: 'away' },
      ],
    },
  ],
  copy: {
    briefing: '真正的打印机醒了。躲纸、挡墨、打断更新，在纸露出来的瞬间把它拽出来。',
    weakPoint: '卡纸',
    charge: '正在安装固件更新',
    progress: 'Boss 血量',
  },
};

export const FIGHTS: Readonly<Record<string, FightDefinition>> = {
  [printerOffline.id]: printerOffline,
  [printerQueue.id]: printerQueue,
  [printerBoss.id]: printerBoss,
};

export const FIGHT_IDS: readonly string[] = Object.keys(FIGHTS);

export function getFight(id: string): FightDefinition | undefined {
  return Object.hasOwn(FIGHTS, id) ? FIGHTS[id] : undefined;
}
