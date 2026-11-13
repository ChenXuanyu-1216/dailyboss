import type { Intensity, Outcome } from '../game/contracts';

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
  fightStageCleared: '形态改变',
  fightVictory: '过关！',
  fightVictoryBoss: 'Boss 击破！',
  fightCalls: {
    hit: { paper: '被纸砸中！', toner: '被墨粉喷中！' },
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
    won: '赢了！',
  },
  hitFeedback: { paper: '一张纸糊在了你脸上。', toner: '你吸了一大口墨粉。' },
  hitLog: { paper: '被纸砸中', toner: '被墨粉喷中' },
  fightWonLog: (title: string) => `通过：${title}`,
  fightWonFeedback: '你赢下了这一战。',
  // Boss presentation
  bossAppears: 'BOSS 出现',
  bossHealth: 'Boss 血量',
  hurt: (n: number) => `−${n} 耐心`,
  printedPage: '打印成功',
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

/** Short state word shown in the device status strip once the run ends. */
export const OUTCOME_STATUS: Record<Outcome, string> = {
  perfect: '打印完成',
  normal: '打印完成（有损）',
  failure: '待机',
};
