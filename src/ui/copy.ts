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
