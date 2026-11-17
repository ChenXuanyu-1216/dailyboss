import type { ArenaFightDefinition, Vec } from './arena';

/**
 * Registered open-arena fights (boss #2, the vending machine). Like fights.ts these are code, not
 * JSON: their numbers are tuned against the scripted players in tests/arena.test.ts, which check
 * that each fight is winnable without a hit at human reaction speed and that standing still,
 * mashing attack from the front, or never dodging lose.
 *
 * Not yet referenced by a level: the protocol change that lets a phase point at an arena fight
 * comes with the arena's presentation.
 */

/** A corridor floor, 14 × 9 units. The camera looks from −y. */
const FLOOR = { halfW: 7, halfH: 4.5 };
/** Wall sockets near the four corners. */
const SOCKETS: readonly Vec[] = [
  { x: -6.4, y: 3.9 },
  { x: 6.4, y: 3.9 },
  { x: -6.4, y: -3.9 },
  { x: 6.4, y: -3.9 },
];

const COMMON = {
  floor: FLOOR,
  bossRadius: 1.1,
  bossStart: { x: 0, y: 1.6 },
  playerStart: { x: 0, y: -2.6 },
  sockets: SOCKETS,
  armorDeg: 70,
  bodyDamage: 1,
} as const;

/** Warm-up 1: teaches moving and hitting it from behind (its front is armoured). */
const vendingPay: ArenaFightDefinition = {
  ...COMMON,
  id: 'vending-pay',
  maxHp: 5,
  introMs: 1200,
  stageIntroMs: 0,
  abilities: ['move', 'attack'],
  newAbilities: ['move', 'attack'],
  weakDamage: 2,
  unplugDownMs: 0,
  stages: [
    {
      title: '扣款成功',
      atHp: 5,
      gapMs: 900,
      turnDegPerS: 80,
      cycle: [
        { kind: 'coins', telegraphMs: 1100, range: 8, halfAngleDeg: 20, fanDeg: [0] },
        { kind: 'hop', telegraphMs: 1100, radius: 1.5 },
      ],
    },
  ],
  copy: {
    briefing: '钱扣了，饮料没出来。它会朝你吐硬币、跳过来砸你——看准地上的预警躲开。它的正面是玻璃，绕到侧面或背后再打。',
    weakPoint: '投币口',
    charge: '正在出货',
    progress: '要回货款',
  },
};

/** Warm-up 2: teaches the dash and pulling the plug on a maintenance charge. */
const vendingChange: ArenaFightDefinition = {
  ...COMMON,
  id: 'vending-change',
  maxHp: 4,
  introMs: 1200,
  stageIntroMs: 0,
  abilities: ['move', 'attack', 'dash'],
  newAbilities: ['dash'],
  weakDamage: 3,
  unplugDownMs: 2600,
  stages: [
    {
      title: '找零暴走',
      atHp: 4,
      gapMs: 700,
      turnDegPerS: 150,
      cycle: [
        { kind: 'soda', telegraphMs: 1000, activeMs: 1400, radius: 1.3, count: 2 },
        { kind: 'wait', ms: 300 },
        { kind: 'maintenance', chargeMs: 6000, heal: 0 },
        { kind: 'coins', telegraphMs: 1000, range: 8, halfAngleDeg: 22, fanDeg: [-26, 26] },
        { kind: 'hop', telegraphMs: 1000, radius: 1.5 },
      ],
    },
  ],
  copy: {
    briefing: '它开始疯狂找零。汽水洒在地上会持续一阵，离开那片区域；来不及就冲刺穿过去。它「系统维护」时，跑到发光的插座边按攻击拔掉电源，玻璃后面的饮料就露出来了。',
    weakPoint: '玻璃后面的饮料',
    charge: '系统维护中，请稍候',
    progress: '找回零钱',
  },
};

/** The boss: three stages; the topple (its signature move) leaves it lying with the bottle out. */
const vendingBoss: ArenaFightDefinition = {
  ...COMMON,
  id: 'vending-boss',
  maxHp: 60,
  introMs: 1500,
  stageIntroMs: 1600,
  abilities: ['move', 'attack', 'dash'],
  newAbilities: [],
  armorDeg: 75,
  weakDamage: 6,
  unplugDownMs: 2400,
  stages: [
    {
      title: '第一形态：吞币',
      atHp: 60,
      gapMs: 550,
      turnDegPerS: 150,
      cycle: [
        { kind: 'coins', telegraphMs: 800, range: 8.5, halfAngleDeg: 22, fanDeg: [0] },
        { kind: 'hop', telegraphMs: 850, radius: 1.6 },
        { kind: 'rattle', telegraphMs: 750, radius: 2.8 },
        { kind: 'topple', telegraphMs: 950, length: 6, width: 2.4, downMs: 2200 },
      ],
    },
    {
      title: '第二形态：摇晃',
      atHp: 40,
      gapMs: 500,
      turnDegPerS: 165,
      cycle: [
        { kind: 'coins', telegraphMs: 760, range: 8.5, halfAngleDeg: 20, fanDeg: [-28, 28] },
        { kind: 'soda', telegraphMs: 850, activeMs: 1500, radius: 1.3, count: 3 },
        { kind: 'hop', telegraphMs: 800, radius: 1.6 },
        { kind: 'topple', telegraphMs: 900, length: 6.5, width: 2.4, downMs: 2000 },
        { kind: 'rattle', telegraphMs: 750, radius: 2.8 },
      ],
    },
    {
      title: '最终形态：最后一瓶',
      atHp: 20,
      gapMs: 450,
      turnDegPerS: 180,
      cycle: [
        { kind: 'maintenance', chargeMs: 7000, heal: 2 },
        { kind: 'wait', ms: 800 },
        { kind: 'coins', telegraphMs: 740, range: 9, halfAngleDeg: 20, fanDeg: [-30, 30] },
        { kind: 'topple', telegraphMs: 880, length: 6.5, width: 2.4, downMs: 1900 },
        { kind: 'soda', telegraphMs: 800, activeMs: 1500, radius: 1.3, count: 3 },
        { kind: 'hop', telegraphMs: 780, radius: 1.7 },
        { kind: 'rattle', telegraphMs: 750, radius: 2.8 },
      ],
    },
  ],
  copy: {
    briefing: '真正的售货机站起来了。躲开地上的预警，从背后打它；它倒下时砸它顶上的那瓶饮料；它维护时去拔电源。',
    weakPoint: '卡住的那瓶饮料',
    charge: '系统维护中，请勿断电',
    progress: 'Boss 血量',
  },
};

export const ARENA_FIGHTS: Readonly<Record<string, ArenaFightDefinition>> = {
  [vendingPay.id]: vendingPay,
  [vendingChange.id]: vendingChange,
  [vendingBoss.id]: vendingBoss,
};

export const ARENA_FIGHT_IDS: readonly string[] = Object.keys(ARENA_FIGHTS);

export function getArenaFight(id: string): ArenaFightDefinition | undefined {
  return Object.hasOwn(ARENA_FIGHTS, id) ? ARENA_FIGHTS[id] : undefined;
}
