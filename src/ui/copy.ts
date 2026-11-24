import type { ArenaAbility, ArenaAttack } from '../game/arena';
import type { HitKind, Intensity, Outcome } from '../game/contracts';

/**
 * Framework-level interface copy (labels shared by every level).
 * Level-specific dialogue, actions and endings come only from content/levels/*.json.
 */
export const UI = {
  appName: 'DailyBoss',
  appSubtitle: '人生副本',
  objective: '目标',
  patience: '耐心',
  phase: '阶段',
  status: '状态',
  actions: '可执行操作',
  log: '操作记录',
  logEmpty: '还没有操作。',
  feedbackIdle: '选择一个操作开始。',
  restart: '重新开始',
  restartShort: '重开',
  simplified: '简化显示',
  render3d: '3D 显示',
  keyboardHint: '快捷键：数字键选择操作，R 重开',
  spent: '消耗耐心',
  steps: '操作步数',
  hitsTaken: '被击中',
  lowPatience: '只剩最后一点耐心',
  configErrorTitle: '关卡配置无法加载',
  configErrorBody: '下面的问题需要在关卡 JSON 中修正：',
  // Skill checks
  skillBadge: '技巧',
  skillTimingTitle: '时机判定',
  skillTimingHint: '指针进入绿色区域时按下（空格 / 回车 / 点击）。',
  skillTimingButton: '就是现在！',
  skillMashTitle: '连打判定',
  skillMashHint: (taps: number, seconds: number) => `${seconds} 秒内连按 ${taps} 次（空格 / 回车 / 点击），从第一下开始计时。`,
  skillMashButton: '拽！',
  skillMashProgress: '拽纸进度',
  skillCancel: '先不了（Esc）',
  skillSuccess: '成功！',
  skillFail: '失手了！',
  logSkillSuccess: '✓ 判定成功',
  logSkillFail: '✕ 判定失手',
  assist: '辅助模式',
  assistHint: '技巧判定自动成功；实时战斗放慢到 65% 速度',
  // Title screen and opening story
  titleSubtitle: '人生副本 · 把日常故障打成 Boss 战',
  titleToday: '今日副本',
  titleStart: '开始游戏',
  titleRoute: '关卡路线',
  titlePick: '选择副本',
  titlePickHint: '用方向键切换副本',
  titleCleared: '已通关',
  changeLevel: '换个副本',
  titleControls: '支持键盘与触屏 · 战斗中按 Esc 暂停 · R 重开',
  introLabel: '开场剧情',
  introSkip: '跳过',
  introNext: '继续',
  introBegin: '进入战斗',
  introProgress: (n: number, total: number) => `第 ${n} 段，共 ${total} 段`,
  // Real-time fights
  fightLanes: ['左路', '中路', '右路'],
  fightPosition: (lane: string) => `你在${lane}。`,
  fightPaperCue: (lanes: string) => `${lanes}来纸，闪避。`,
  fightChargeCue: (charge: string) => `${charge}，按住重启。`,
  fightWeakCue: (lane: string, weak: string) => `${lane}露出${weak}，到该路拽纸。`,
  fightTonerEnd: '喷射结束，可松开格挡。',
  feedbackIdleFight: '准备好就开始战斗。',
  fightKeyboardHint: '键位：←→ 闪避 · ↓ 按住格挡 · ↑ 拽出 · K 按住重启 · Esc 暂停 · R 重开',
  fightStart: '开始战斗',
  fightResume: '继续',
  fightPause: '暂停',
  fightPaused: '已暂停',
  fightNewAbility: '新技能',
  fightArena: '战斗区域',
  fightYou: '你',
  fightCharge: '充能进度',
  fightIncoming: '来纸！',
  fightTonerWarn: '墨粉预警：按住格挡',
  fightTonerActive: '墨粉喷射中',
  fightBlocking: '格挡中',
  fightChanneling: '重启中…',
  fightCooldown: '冷却中',
  fightLocked: '手被夹住',
  fightGripping: '重拽中…',
  fightCounter: '破绽',
  fightAdvanced: '进阶',
  fightCounterCue: (lane: string) => `${lane}露出破绽，原地拽出。`,
  fightStageCleared: '形态改变',
  fightVictory: '过关！',
  fightVictoryBoss: 'Boss 击破！',
  fightCalls: {
    hit: { paper: '被纸砸中！', toner: '被墨粉喷中！', pinch: '抓太久，被夹手了！' },
    dodge: '闪开了。',
    block: '挡住了墨粉。',
    damage: '拽出来了！',
    stunDamage: '趁它宕机，狠狠拽了一把！',
    whiff: '扑空了——手被夹了一下。',
    interrupt: '重启成功，打断了它！',
    resetWasted: '重启了个寂寞。',
    heal: '它装完了更新，回了血。',
    healNone: '它处理完了队列……又来了 99 份。',
    windowMissed: '它缩回去了。',
    grip: '抓住了——按住重拽，或松手快拽。',
    heavyDamage: '重拽！连根拔出来了！',
    counterDamage: '反击得手！',
    perfectDodge: '极限闪避！它露出了破绽。',
    perfectBlock: '完美格挡！它露出了破绽。',
    perfectNoOpening: '漂亮！',
    won: '赢了！',
  },
  hitFeedback: {
    paper: '一张纸糊在了你脸上。',
    toner: '你吸了一大口墨粉。',
    pinch: '你抓得太久，它把纸连同你的手一起夹住了。',
    coins: '一把硬币砸在你身上——全是它不肯找的零钱。',
    soda: '你一脚踩进汽水里，黏住了。',
    hop: '它跳起来，正好砸在你站的地方。',
    rattle: '它疯狂摇晃，把你撞了出去。',
    topple: '它整个倒了下来，压住了你。',
  } satisfies Record<HitKind, string>,
  hitLog: {
    paper: '被纸砸中',
    toner: '被墨粉喷中',
    pinch: '重拽时被夹手',
    coins: '被硬币砸中',
    soda: '踩进汽水',
    hop: '被跳砸压中',
    rattle: '被摇晃撞到',
    topple: '被倒下的售货机压住',
  } satisfies Record<HitKind, string>,
  // Open-arena fights (boss #2)
  arenaKeyboardHint: '键位：WASD/方向键 移动 · J 攻击 · K/空格 冲刺 · Esc 暂停 · R 重开',
  arenaFloor: '战斗场地',
  arenaControls: '移动与技能',
  arenaStick: '移动摇杆：按住后朝想走的方向拖动',
  arenaWarn: {
    coins: '硬币预警：离开扇形区域',
    soda: '汽水预警：离开圆圈',
    hop: '跳砸预警：离开脚下的圆圈',
    rattle: '摇晃预警：离它远一点',
    topple: '倾倒预警：离开它面前的长条',
  } satisfies Record<ArenaAttack, string>,
  arenaChargeCue: (charge: string) => `${charge}——跑到发光的插座边按 J 拔电源。`,
  arenaDownCue: (weak: string) => `它倒下了：走到${weak}旁边按 J。`,
  arenaAbility: { move: '移动', attack: '攻击', dash: '冲刺' } satisfies Record<ArenaAbility, string>,
  arenaKeys: { move: 'WASD / 方向键', attack: 'J', dash: 'K / 空格' } satisfies Record<ArenaAbility, string>,
  arenaHelp: {
    move: '走开躲避地上的预警。它的正面是玻璃，绕到侧面或背后打。',
    attack: '贴近它出手；打中一下它就会转身防备，再找下一个破绽。',
    dash: '短距离冲刺，冲刺途中不会被打中，用完要等一下。',
  } satisfies Record<ArenaAbility, string>,
  arenaCalls: {
    hit: '被打中了！',
    evade: '躲开了。',
    damage: '打中了！',
    weakDamage: '正中要害！',
    clank: '铛——打在玻璃上了，绕到后面去。',
    whiff: '够不着。',
    down: '它倒下了！',
    up: '它站起来了。',
    interrupt: '拔掉电源了！',
    heal: '维护完成，它回了血。',
    healNone: '维护完成。',
    won: '赢了！',
  },
  fightWonLog: (title: string) => `通过：${title}`,
  fightWonFeedback: '你赢下了这一战。',
  // Boss presentation
  bossAppears: 'BOSS 出现',
  bossHealth: 'Boss 血量',
  hurt: (n: number) => `−${n} 耐心`,
  printedPage: '打印成功',
  // Results, records and boss practice (iteration 5)
  clearTime: '通关时间',
  survivedTime: '坚持时间',
  newRecord: '新纪录',
  bestLabel: '最佳',
  tipLabel: '下次试试',
  statPerfects: (n: number) => `极限防御 ×${n}`,
  statHeavy: (n: number) => `重拽 ×${n}`,
  statInterrupts: (n: number) => `打断更新 ×${n}`,
  assistNotRecorded: '本局开过辅助模式，不计入最佳成绩。',
  bossPractice: 'Boss 练习',
  bossPracticeHint: '直接挑战最终 Boss，不用重打热身战',
  practiceBadge: '练习',
  practiceAgain: '再练一次',
  fullRun: '完整挑战',
  titleBest: (time: string) => `最佳通关 ${time}`,
  // Sharing a result
  share: '分享结果',
  shareHead: 'DailyBoss 人生副本',
  shareStats: (label: string, time: string, hits: number) => `${label} ${time} · 被击中 ${hits} 次`,
  shareSpent: (n: number) => `消耗耐心 ${n}`,
  shareDareWon: '你能比我更快吗？',
  shareDareLost: '我输了，你能打赢它吗？',
  shareTextLabel: '分享文字',
  shareCopy: '复制',
  shareCopied: '已复制，可以粘贴给朋友了。',
  shareCopyFailed: '无法自动复制，文字已选中，请手动复制。',
  shareShared: '已分享。',
  sound: '声音',
  soundOn: '声音：开',
  soundOff: '声音：关',
} as const;

export const INTENSITY_LABEL: Record<Intensity, string> = {
  calm: '异常',
  warning: '故障升级',
  critical: 'Boss 战',
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  perfect: '完美结局',
  normal: '普通结局',
  failure: '挑战失败',
};

/** Wording that depends on which machine the level's scene shows. */
export interface SceneCopy {
  /** Label of the panel that shows the machine. */
  device: string;
  /** Accessible name prefix of the simplified (no-WebGL) drawing. */
  fallback: string;
  /** Short state word shown in the device status strip once the run ends. */
  status: Record<Outcome, string>;
  /** Heading of the "what you got" slip on the results screen. */
  delivered: string;
}

const SCENE_COPY: Record<string, SceneCopy> = {
  printer: {
    device: '打印机状态',
    fallback: '打印机示意',
    status: { perfect: '打印完成', normal: '打印完成（有损）', failure: '待机' },
    delivered: '打印成功',
  },
  vending: {
    device: '售货机状态',
    fallback: '售货机示意',
    status: { perfect: '出货完成', normal: '出货完成（有点凹）', failure: '待机' },
    delivered: '出货成功',
  },
};

export function sceneCopy(sceneId: string): SceneCopy {
  return SCENE_COPY[sceneId] ?? SCENE_COPY.printer!;
}
