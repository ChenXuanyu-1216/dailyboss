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
  assistHint: '技巧判定自动成功',
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
