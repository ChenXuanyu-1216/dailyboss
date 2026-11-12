import {
  INTENSITIES,
  OUTCOMES,
  SKILL_TYPES,
  SUPPORTED_SCHEMA_VERSIONS,
  type ActionDefinition,
  type ActionTarget,
  type EndingDefinition,
  type FightRef,
  type Intensity,
  type LevelDefinition,
  type Outcome,
  type PhaseDefinition,
  type Result,
  type SceneCatalog,
  type SchemaVersion,
  type SkillDefinition,
  type SkillType,
  type ValidationCode,
  type ValidationIssue,
} from './contracts';
import { FIGHT_IDS } from './fights';

/**
 * Runtime validation for level JSON (protocol v0.1, v0.2 and v0.3).
 *
 * Guarantees when `ok`:
 * - supported schemaVersion; no unknown fields at any level (newer fields only in newer files)
 * - every phase has either a non-empty `actions` list or (v0.3) a registered `fight`, never both
 * - non-empty strings, positive integer initialPatience, non-negative integer costs
 * - unique phase IDs, unique action IDs within a phase
 * - initial phase and every phase target (including skill `onFail` and fight targets) exist
 * - sceneId is registered and every cue is supported by that scene
 * - every phase is reachable from the initial phase
 * - from every phase a `resolve` target is still reachable (no trap loops)
 * - all three endings present
 *
 * The returned value is a fresh, frozen object built only from known fields.
 */

const LEVEL_KEYS = [
  'schemaVersion',
  'id',
  'title',
  'objective',
  'sceneId',
  'initialPatience',
  'initialPhaseId',
  'phases',
  'endings',
] as const;
const PHASE_KEYS_V01 = ['id', 'title', 'description', 'cue', 'actions'] as const;
const PHASE_KEYS_V02 = [...PHASE_KEYS_V01, 'intensity'] as const;
const PHASE_KEYS_V03 = [...PHASE_KEYS_V02, 'fight'] as const;
const FIGHT_KEYS = ['id', 'target', 'feedback'] as const;
const ACTION_KEYS_V01 = ['id', 'label', 'patienceCost', 'target'] as const;
const ACTION_KEYS_V02 = [...ACTION_KEYS_V01, 'feedback', 'skill'] as const;
const SKILL_KEYS = ['type', 'onFail'] as const;
const SKILL_FAIL_KEYS = ['patienceCost', 'target', 'feedback'] as const;
const ENDING_KEYS = ['title', 'description'] as const;

type Obj = Record<string, unknown>;

class Collector {
  readonly errors: ValidationIssue[] = [];
  add(code: ValidationCode, path: string, message: string): void {
    this.errors.push({ code, path, message });
  }
}

function isObject(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return '数组';
  return typeof v;
}

function checkKeys(c: Collector, obj: Obj, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      c.add('unknown-field', join(path, key), `未知字段 "${key}"。允许的字段：${allowed.join('、')}。`);
    }
  }
}

function join(path: string, key: string | number): string {
  if (typeof key === 'number') return `${path}[${key}]`;
  return path ? `${path}.${key}` : key;
}

function readString(c: Collector, obj: Obj, key: string, path: string): string | undefined {
  const p = join(path, key);
  if (!(key in obj)) {
    c.add('missing-field', p, `缺少必填字段 "${key}"。`);
    return undefined;
  }
  const v = obj[key];
  if (typeof v !== 'string') {
    c.add('invalid-type', p, `应为字符串，实际为 ${describe(v)}。`);
    return undefined;
  }
  if (v.trim() === '') {
    c.add('invalid-value', p, '不能为空字符串。');
    return undefined;
  }
  return v;
}

/** Reads an optional non-empty string. Returns `null` on error, `undefined` when absent. */
function readOptionalString(c: Collector, obj: Obj, key: string, path: string): string | undefined | null {
  if (!(key in obj)) return undefined;
  return readString(c, obj, key, path) ?? null;
}

function readInteger(
  c: Collector,
  obj: Obj,
  key: string,
  path: string,
  min: number,
): number | undefined {
  const p = join(path, key);
  if (!(key in obj)) {
    c.add('missing-field', p, `缺少必填字段 "${key}"。`);
    return undefined;
  }
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    c.add('invalid-type', p, `应为整数，实际为 ${JSON.stringify(v) ?? describe(v)}。`);
    return undefined;
  }
  if (v < min) {
    c.add('invalid-value', p, min === 0 ? '不能为负数。' : `必须不小于 ${min}。`);
    return undefined;
  }
  return v;
}

function readArray(c: Collector, obj: Obj, key: string, path: string): unknown[] | undefined {
  const p = join(path, key);
  if (!(key in obj)) {
    c.add('missing-field', p, `缺少必填字段 "${key}"。`);
    return undefined;
  }
  const v = obj[key];
  if (!Array.isArray(v)) {
    c.add('invalid-type', p, `应为数组，实际为 ${describe(v)}。`);
    return undefined;
  }
  if (v.length === 0) {
    c.add('invalid-value', p, '至少需要一项。');
    return undefined;
  }
  return v;
}

function readTarget(c: Collector, raw: unknown, path: string): ActionTarget | undefined {
  if (!isObject(raw)) {
    c.add('invalid-type', path, `应为对象，实际为 ${describe(raw)}。`);
    return undefined;
  }
  if (raw.type === 'resolve') {
    checkKeys(c, raw, ['type'], path);
    return { type: 'resolve' };
  }
  if (raw.type === 'phase') {
    checkKeys(c, raw, ['type', 'id'], path);
    const id = readString(c, raw, 'id', path);
    return id === undefined ? undefined : { type: 'phase', id };
  }
  c.add(
    'invalid-target',
    join(path, 'type'),
    `不支持的目标类型 ${JSON.stringify(raw.type) ?? 'undefined'}，只能是 "phase" 或 "resolve"。`,
  );
  return undefined;
}

function readRequiredTarget(c: Collector, obj: Obj, path: string): ActionTarget | undefined {
  if (!('target' in obj)) {
    c.add('missing-field', join(path, 'target'), '缺少必填字段 "target"。');
    return undefined;
  }
  return readTarget(c, obj.target, join(path, 'target'));
}

function readSkill(c: Collector, raw: unknown, path: string): SkillDefinition | undefined {
  if (!isObject(raw)) {
    c.add('invalid-type', path, `应为对象，实际为 ${describe(raw)}。`);
    return undefined;
  }
  checkKeys(c, raw, SKILL_KEYS, path);
  let type: SkillType | undefined;
  if (!('type' in raw)) {
    c.add('missing-field', join(path, 'type'), '缺少必填字段 "type"。');
  } else if (!(SKILL_TYPES as readonly unknown[]).includes(raw.type)) {
    c.add(
      'invalid-value',
      join(path, 'type'),
      `不支持的技能类型 ${JSON.stringify(raw.type) ?? 'undefined'}，只能是 ${SKILL_TYPES.map((t) => `"${t}"`).join(' 或 ')}。`,
    );
  } else {
    type = raw.type as SkillType;
  }

  const fp = join(path, 'onFail');
  if (!('onFail' in raw)) {
    c.add('missing-field', fp, '缺少必填字段 "onFail"。');
    return undefined;
  }
  const f = raw.onFail;
  if (!isObject(f)) {
    c.add('invalid-type', fp, `应为对象，实际为 ${describe(f)}。`);
    return undefined;
  }
  checkKeys(c, f, SKILL_FAIL_KEYS, fp);
  const patienceCost = readInteger(c, f, 'patienceCost', fp, 0);
  const target = readRequiredTarget(c, f, fp);
  const feedback = readOptionalString(c, f, 'feedback', fp);
  if (type === undefined || patienceCost === undefined || !target || feedback === null) return undefined;
  return {
    type,
    onFail: { patienceCost, target, ...(feedback !== undefined ? { feedback } : {}) },
  };
}

function readFight(c: Collector, raw: unknown, path: string): FightRef | undefined {
  if (!isObject(raw)) {
    c.add('invalid-type', path, `应为对象，实际为 ${describe(raw)}。`);
    return undefined;
  }
  checkKeys(c, raw, FIGHT_KEYS, path);
  const id = readString(c, raw, 'id', path);
  if (id !== undefined && !FIGHT_IDS.includes(id)) {
    c.add('unknown-fight', join(path, 'id'), `未注册的战斗 "${id}"。已注册：${FIGHT_IDS.join('、')}。`);
  }
  const target = readRequiredTarget(c, raw, path);
  const feedback = readOptionalString(c, raw, 'feedback', path);
  if (id === undefined || !FIGHT_IDS.includes(id) || !target || feedback === null) return undefined;
  return { id, target, ...(feedback !== undefined ? { feedback } : {}) };
}

function readAction(
  c: Collector,
  raw: unknown,
  path: string,
  version: SchemaVersion,
): ActionDefinition | undefined {
  if (!isObject(raw)) {
    c.add('invalid-type', path, `应为对象，实际为 ${describe(raw)}。`);
    return undefined;
  }
  checkKeys(c, raw, version === '0.1' ? ACTION_KEYS_V01 : ACTION_KEYS_V02, path);
  const id = readString(c, raw, 'id', path);
  const label = readString(c, raw, 'label', path);
  const patienceCost = readInteger(c, raw, 'patienceCost', path, 0);
  const target = readRequiredTarget(c, raw, path);

  let feedback: string | undefined | null;
  let skill: SkillDefinition | undefined | null;
  if (version !== '0.1') {
    feedback = readOptionalString(c, raw, 'feedback', path);
    if ('skill' in raw) skill = readSkill(c, raw.skill, join(path, 'skill')) ?? null;
  }

  if (
    id === undefined ||
    label === undefined ||
    patienceCost === undefined ||
    !target ||
    feedback === null ||
    skill === null
  ) {
    return undefined;
  }
  return {
    id,
    label,
    patienceCost,
    target,
    ...(feedback !== undefined ? { feedback } : {}),
    ...(skill !== undefined ? { skill } : {}),
  };
}

function readPhase(
  c: Collector,
  raw: unknown,
  path: string,
  version: SchemaVersion,
  sceneCues: readonly string[] | undefined,
  sceneId: string | undefined,
): PhaseDefinition | undefined {
  if (!isObject(raw)) {
    c.add('invalid-type', path, `应为对象，实际为 ${describe(raw)}。`);
    return undefined;
  }
  checkKeys(
    c,
    raw,
    version === '0.1' ? PHASE_KEYS_V01 : version === '0.2' ? PHASE_KEYS_V02 : PHASE_KEYS_V03,
    path,
  );
  const id = readString(c, raw, 'id', path);
  const title = readString(c, raw, 'title', path);
  const description = readString(c, raw, 'description', path);
  const cue = readString(c, raw, 'cue', path);
  if (cue !== undefined && sceneCues && !sceneCues.includes(cue)) {
    c.add(
      'unsupported-cue',
      join(path, 'cue'),
      `场景 "${sceneId}" 不支持 cue "${cue}"。支持：${sceneCues.join('、')}。`,
    );
  }

  let intensity: Intensity | undefined | null;
  if (version !== '0.1' && 'intensity' in raw) {
    if ((INTENSITIES as readonly unknown[]).includes(raw.intensity)) {
      intensity = raw.intensity as Intensity;
    } else {
      c.add(
        'invalid-value',
        join(path, 'intensity'),
        `不支持的强度 ${JSON.stringify(raw.intensity) ?? 'undefined'}，只能是 ${INTENSITIES.map((t) => `"${t}"`).join('、')}。`,
      );
      intensity = null;
    }
  }

  // v0.3: a fight phase has no actions.
  let fight: FightRef | undefined | null;
  if (version === '0.3' && 'fight' in raw) {
    fight = readFight(c, raw.fight, join(path, 'fight')) ?? null;
    if ('actions' in raw) {
      c.add('invalid-value', join(path, 'actions'), '战斗阶段（fight）不能同时包含 actions。');
      return undefined;
    }
  }

  const rawActions = fight === undefined ? readArray(c, raw, 'actions', path) : [];
  const actions: ActionDefinition[] = [];
  let actionsOk = rawActions !== undefined;
  if (rawActions) {
    const seen = new Set<string>();
    rawActions.forEach((ra, i) => {
      const ap = join(join(path, 'actions'), i);
      const action = readAction(c, ra, ap, version);
      if (!action) {
        actionsOk = false;
        return;
      }
      if (seen.has(action.id)) {
        c.add('duplicate-action-id', join(ap, 'id'), `行动 ID "${action.id}" 在本阶段内重复。`);
        actionsOk = false;
      }
      seen.add(action.id);
      actions.push(action);
    });
  }
  if (
    id === undefined ||
    title === undefined ||
    description === undefined ||
    cue === undefined ||
    intensity === null ||
    fight === null ||
    !actionsOk
  ) {
    return undefined;
  }
  return {
    id,
    title,
    description,
    cue,
    actions,
    ...(intensity !== undefined ? { intensity } : {}),
    ...(fight !== undefined ? { fight } : {}),
  };
}

function readEndings(c: Collector, obj: Obj, path: string): Record<Outcome, EndingDefinition> | undefined {
  const p = join(path, 'endings');
  if (!('endings' in obj)) {
    c.add('missing-field', p, '缺少必填字段 "endings"。');
    return undefined;
  }
  const raw = obj.endings;
  if (!isObject(raw)) {
    c.add('invalid-type', p, `应为对象，实际为 ${describe(raw)}。`);
    return undefined;
  }
  checkKeys(c, raw, OUTCOMES, p);
  const result: Partial<Record<Outcome, EndingDefinition>> = {};
  let ok = true;
  for (const outcome of OUTCOMES) {
    const ep = join(p, outcome);
    if (!(outcome in raw)) {
      c.add('missing-field', ep, `缺少结局 "${outcome}"。`);
      ok = false;
      continue;
    }
    const e = raw[outcome];
    if (!isObject(e)) {
      c.add('invalid-type', ep, `应为对象，实际为 ${describe(e)}。`);
      ok = false;
      continue;
    }
    checkKeys(c, e, ENDING_KEYS, ep);
    const title = readString(c, e, 'title', ep);
    const description = readString(c, e, 'description', ep);
    if (title === undefined || description === undefined) ok = false;
    else result[outcome] = { title, description };
  }
  return ok ? (result as Record<Outcome, EndingDefinition>) : undefined;
}

/**
 * Every outcome a phase can lead to, with the path of each target: each action's own target and,
 * for skill actions, the failure target; for fight phases, the fight's target.
 */
function phaseTargets(phase: PhaseDefinition, pi: number): { target: ActionTarget; path: string; owner: string }[] {
  const list: { target: ActionTarget; path: string; owner: string }[] = [];
  if (phase.fight) list.push({ target: phase.fight.target, path: `phases[${pi}].fight.target`, owner: `战斗 "${phase.fight.id}"` });
  phase.actions.forEach((action, ai) => {
    const base = `phases[${pi}].actions[${ai}]`;
    list.push({ target: action.target, path: `${base}.target`, owner: `行动 "${action.id}"` });
    if (action.skill) {
      list.push({ target: action.skill.onFail.target, path: `${base}.skill.onFail.target`, owner: `行动 "${action.id}"` });
    }
  });
  return list;
}

/** Graph checks: references, reachability, and that `resolve` stays reachable from every phase. */
function checkGraph(c: Collector, phases: PhaseDefinition[], initialPhaseId: string): void {
  const index = new Map(phases.map((p, i) => [p.id, i]));
  let refsOk = true;

  if (!index.has(initialPhaseId)) {
    c.add('unknown-phase-ref', 'initialPhaseId', `初始阶段 "${initialPhaseId}" 不存在。`);
    refsOk = false;
  }
  phases.forEach((phase, pi) => {
    for (const { target, path, owner } of phaseTargets(phase, pi)) {
      if (target.type === 'phase' && !index.has(target.id)) {
        c.add('unknown-phase-ref', `${path}.id`, `${owner} 指向不存在的阶段 "${target.id}"。`);
        refsOk = false;
      }
    }
  });
  if (!refsOk) return;

  // Forward reachability from the initial phase (success and failure branches both count).
  const reachable = new Set<string>([initialPhaseId]);
  const queue = [initialPhaseId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const pi = index.get(id)!;
    for (const { target } of phaseTargets(phases[pi]!, pi)) {
      if (target.type === 'phase' && !reachable.has(target.id)) {
        reachable.add(target.id);
        queue.push(target.id);
      }
    }
  }
  phases.forEach((phase, pi) => {
    if (!reachable.has(phase.id)) {
      c.add('unreachable-phase', `phases[${pi}]`, `阶段 "${phase.id}" 无法从初始阶段到达。`);
    }
  });

  // Backward: phases from which a resolve is reachable (fixed-point iteration over all branches).
  const canResolve = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [pi, phase] of phases.entries()) {
      if (canResolve.has(phase.id)) continue;
      const ok = phaseTargets(phase, pi).some(
        ({ target }) => target.type === 'resolve' || (target.type === 'phase' && canResolve.has(target.id)),
      );
      if (ok) {
        canResolve.add(phase.id);
        changed = true;
      }
    }
  }
  if (!canResolve.has(initialPhaseId)) {
    c.add('no-reachable-resolve', 'phases', '从初始阶段出发没有任何可到达的 resolve 目标，关卡无法通关。');
    return;
  }
  phases.forEach((phase, pi) => {
    if (reachable.has(phase.id) && !canResolve.has(phase.id)) {
      c.add('trap-phase', `phases[${pi}]`, `进入阶段 "${phase.id}" 后再也无法到达 resolve 目标。`);
    }
  });
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

export function validateLevel(input: unknown, scenes: SceneCatalog): Result<LevelDefinition> {
  const c = new Collector();
  if (!isObject(input)) {
    c.add('invalid-type', '', `关卡配置应为 JSON 对象，实际为 ${describe(input)}。`);
    return { ok: false, errors: c.errors };
  }

  // Version gate first: an unknown protocol version is not interpreted further.
  const version = input.schemaVersion;
  if (!(SUPPORTED_SCHEMA_VERSIONS as readonly unknown[]).includes(version)) {
    c.add(
      'unsupported-version',
      'schemaVersion',
      `不支持的协议版本 ${JSON.stringify(version) ?? '（缺失）'}。当前支持：${SUPPORTED_SCHEMA_VERSIONS.join('、')}。`,
    );
    return { ok: false, errors: c.errors };
  }
  const schemaVersion = version as SchemaVersion;

  checkKeys(c, input, LEVEL_KEYS, '');
  const id = readString(c, input, 'id', '');
  const title = readString(c, input, 'title', '');
  const objective = readString(c, input, 'objective', '');
  const sceneId = readString(c, input, 'sceneId', '');
  const initialPatience = readInteger(c, input, 'initialPatience', '', 1);
  const initialPhaseId = readString(c, input, 'initialPhaseId', '');

  let sceneCues: readonly string[] | undefined;
  if (sceneId !== undefined) {
    const entry = Object.hasOwn(scenes, sceneId) ? scenes[sceneId] : undefined;
    if (!entry) {
      c.add(
        'unknown-scene',
        'sceneId',
        `未注册的场景 "${sceneId}"。已注册：${Object.keys(scenes).join('、') || '（无）'}。`,
      );
    } else {
      sceneCues = entry.cues;
    }
  }

  const rawPhases = readArray(c, input, 'phases', '');
  const phases: PhaseDefinition[] = [];
  let phasesOk = rawPhases !== undefined;
  if (rawPhases) {
    const seen = new Set<string>();
    rawPhases.forEach((rp, i) => {
      const phase = readPhase(c, rp, `phases[${i}]`, schemaVersion, sceneCues, sceneId);
      if (!phase) {
        phasesOk = false;
        return;
      }
      if (seen.has(phase.id)) {
        c.add('duplicate-phase-id', `phases[${i}].id`, `阶段 ID "${phase.id}" 重复。`);
        phasesOk = false;
      }
      seen.add(phase.id);
      phases.push(phase);
    });
  }

  const endings = readEndings(c, input, '');

  if (phasesOk && initialPhaseId !== undefined) checkGraph(c, phases, initialPhaseId);

  if (
    c.errors.length > 0 ||
    id === undefined ||
    title === undefined ||
    objective === undefined ||
    sceneId === undefined ||
    initialPatience === undefined ||
    initialPhaseId === undefined ||
    !endings
  ) {
    return { ok: false, errors: c.errors };
  }

  return {
    ok: true,
    value: deepFreeze({
      schemaVersion,
      id,
      title,
      objective,
      sceneId,
      initialPatience,
      initialPhaseId,
      phases,
      endings,
    }),
  };
}
