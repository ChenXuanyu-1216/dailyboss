import {
  OUTCOMES,
  SUPPORTED_SCHEMA_VERSIONS,
  type ActionDefinition,
  type ActionTarget,
  type EndingDefinition,
  type LevelDefinition,
  type Outcome,
  type PhaseDefinition,
  type Result,
  type SceneCatalog,
  type SchemaVersion,
  type ValidationCode,
  type ValidationIssue,
} from './contracts';

/**
 * Runtime validation for level JSON (protocol v0.1).
 *
 * Guarantees when `ok`:
 * - supported schemaVersion; no unknown fields at any level
 * - non-empty strings, positive integer initialPatience, non-negative integer costs
 * - unique phase IDs, unique action IDs within a phase
 * - initial phase and every phase target exist
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
const PHASE_KEYS = ['id', 'title', 'description', 'cue', 'actions'] as const;
const ACTION_KEYS = ['id', 'label', 'patienceCost', 'target'] as const;
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

function readAction(c: Collector, raw: unknown, path: string): ActionDefinition | undefined {
  if (!isObject(raw)) {
    c.add('invalid-type', path, `应为对象，实际为 ${describe(raw)}。`);
    return undefined;
  }
  checkKeys(c, raw, ACTION_KEYS, path);
  const id = readString(c, raw, 'id', path);
  const label = readString(c, raw, 'label', path);
  const patienceCost = readInteger(c, raw, 'patienceCost', path, 0);
  let target: ActionTarget | undefined;
  if (!('target' in raw)) c.add('missing-field', join(path, 'target'), '缺少必填字段 "target"。');
  else target = readTarget(c, raw.target, join(path, 'target'));
  if (id === undefined || label === undefined || patienceCost === undefined || !target) return undefined;
  return { id, label, patienceCost, target };
}

function readPhase(
  c: Collector,
  raw: unknown,
  path: string,
  sceneCues: readonly string[] | undefined,
  sceneId: string | undefined,
): PhaseDefinition | undefined {
  if (!isObject(raw)) {
    c.add('invalid-type', path, `应为对象，实际为 ${describe(raw)}。`);
    return undefined;
  }
  checkKeys(c, raw, PHASE_KEYS, path);
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
  const rawActions = readArray(c, raw, 'actions', path);
  const actions: ActionDefinition[] = [];
  let actionsOk = rawActions !== undefined;
  if (rawActions) {
    const seen = new Set<string>();
    rawActions.forEach((ra, i) => {
      const ap = join(join(path, 'actions'), i);
      const action = readAction(c, ra, ap);
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
  if (id === undefined || title === undefined || description === undefined || cue === undefined || !actionsOk) {
    return undefined;
  }
  return { id, title, description, cue, actions };
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

/** Graph checks: references, reachability, and that `resolve` stays reachable from every phase. */
function checkGraph(c: Collector, phases: PhaseDefinition[], initialPhaseId: string): void {
  const index = new Map(phases.map((p, i) => [p.id, i]));
  let refsOk = true;

  if (!index.has(initialPhaseId)) {
    c.add('unknown-phase-ref', 'initialPhaseId', `初始阶段 "${initialPhaseId}" 不存在。`);
    refsOk = false;
  }
  phases.forEach((phase, pi) => {
    phase.actions.forEach((action, ai) => {
      if (action.target.type === 'phase' && !index.has(action.target.id)) {
        c.add(
          'unknown-phase-ref',
          `phases[${pi}].actions[${ai}].target.id`,
          `行动 "${action.id}" 指向不存在的阶段 "${action.target.id}"。`,
        );
        refsOk = false;
      }
    });
  });
  if (!refsOk) return;

  // Forward reachability from the initial phase.
  const reachable = new Set<string>([initialPhaseId]);
  const queue = [initialPhaseId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const phase = phases[index.get(id)!]!;
    for (const a of phase.actions) {
      if (a.target.type === 'phase' && !reachable.has(a.target.id)) {
        reachable.add(a.target.id);
        queue.push(a.target.id);
      }
    }
  }
  phases.forEach((phase, pi) => {
    if (!reachable.has(phase.id)) {
      c.add('unreachable-phase', `phases[${pi}]`, `阶段 "${phase.id}" 无法从初始阶段到达。`);
    }
  });

  // Backward: phases from which a resolve action is reachable (fixed-point iteration).
  const canResolve = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const phase of phases) {
      if (canResolve.has(phase.id)) continue;
      const ok = phase.actions.some(
        (a) => a.target.type === 'resolve' || (a.target.type === 'phase' && canResolve.has(a.target.id)),
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
      const phase = readPhase(c, rp, `phases[${i}]`, sceneCues, sceneId);
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
      schemaVersion: version as SchemaVersion,
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
