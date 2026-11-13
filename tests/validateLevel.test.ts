import { describe, expect, it } from 'vitest';
import { validateLevel } from '../src/game/validateLevel';
import { loadLevel, LEVEL_SOURCES } from '../src/app/levels';
import { SCENE_CATALOG } from '../src/scenes/catalog';
import { codesOf, errorsOf, rawPrinter, rawShipped } from './helpers';
import printerV01 from './fixtures/printer-v0.1.json';

describe('shipped content', () => {
  it('the printer level JSON is valid', () => {
    const result = loadLevel('printer-from-hell');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe('地狱打印机');
      expect(result.value.phases.map((p) => p.id)).toEqual(['offline', 'queue', 'jam']);
      expect(result.value.schemaVersion).toBe('0.3');
      // Every phase of the shipped level is a real-time fight: no menu to click through.
      expect(result.value.phases.map((p) => p.fight?.id)).toEqual(['printer-offline', 'printer-queue', 'printer-boss']);
      expect(result.value.phases.every((p) => p.actions.length === 0)).toBe(true);
    }
  });

  it('every registered level source validates', () => {
    for (const id of Object.keys(LEVEL_SOURCES)) {
      expect(loadLevel(id).ok, id).toBe(true);
    }
  });

  it('reports an unknown level id readably', () => {
    const result = loadLevel('does-not-exist');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]!.message).toContain('does-not-exist');
  });

  it('returns a frozen copy that does not alias the input', () => {
    const raw = rawPrinter();
    const result = validateLevel(raw, SCENE_CATALOG);
    if (!result.ok) throw new Error('expected ok');
    expect(Object.isFrozen(result.value.phases[0]!.actions[0])).toBe(true);
    raw.phases[0].title = 'changed';
    expect(result.value.phases[0]!.title).toBe('打印机离线');
  });
});

describe('protocol version and shape', () => {
  it.each([[null], [[]], ['level'], [42]])('rejects non-object input %j', (input) => {
    expect(codesOf(input)).toEqual(['invalid-type']);
  });

  it('rejects an unsupported schemaVersion before checking anything else', () => {
    const raw = rawPrinter();
    raw.schemaVersion = '2.0';
    delete raw.phases;
    const errors = errorsOf(raw);
    expect(errors.map((e) => e.code)).toEqual(['unsupported-version']);
    expect(errors[0]!.message).toContain('2.0');
  });

  it('rejects a missing schemaVersion', () => {
    const raw = rawPrinter();
    delete raw.schemaVersion;
    expect(codesOf(raw)).toEqual(['unsupported-version']);
  });

  it('reports missing required fields with their path', () => {
    const raw = rawPrinter();
    delete raw.objective;
    delete raw.phases[1].actions[0].label;
    const errors = errorsOf(raw);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'missing-field', path: 'objective' }),
        expect.objectContaining({ code: 'missing-field', path: 'phases[1].actions[0].label' }),
      ]),
    );
  });

  it('rejects unknown fields (no scripts or extra behaviour smuggled in)', () => {
    const raw = rawPrinter();
    raw.onLoad = 'alert(1)';
    raw.phases[0].actions[0].script = 'eval()';
    raw.phases[0].actions[0].target.url = 'https://example.com/x.js';
    const errors = errorsOf(raw);
    expect(errors.map((e) => [e.code, e.path])).toEqual(
      expect.arrayContaining([
        ['unknown-field', 'onLoad'],
        ['unknown-field', 'phases[0].actions[0].script'],
        ['unknown-field', 'phases[0].actions[0].target.url'],
      ]),
    );
  });

  it('rejects empty strings and empty arrays', () => {
    const raw = rawPrinter();
    raw.title = '   ';
    raw.phases[2].actions = [];
    expect(errorsOf(raw).map((e) => [e.code, e.path])).toEqual(
      expect.arrayContaining([
        ['invalid-value', 'title'],
        ['invalid-value', 'phases[2].actions'],
      ]),
    );
  });

  it('requires all three endings', () => {
    const raw = rawPrinter();
    delete raw.endings.failure;
    raw.endings.normal.title = 7;
    expect(errorsOf(raw).map((e) => [e.code, e.path])).toEqual(
      expect.arrayContaining([
        ['missing-field', 'endings.failure'],
        ['invalid-type', 'endings.normal.title'],
      ]),
    );
  });
});

describe('numbers', () => {
  it.each([0, -1, 1.5, '3', Number.NaN])('rejects initialPatience %j', (value) => {
    const raw = rawPrinter();
    raw.initialPatience = value;
    expect(codesOf(raw).length).toBeGreaterThan(0);
  });

  it.each([-1, 0.5, '1', null])('rejects patienceCost %j', (value) => {
    const raw = rawPrinter();
    raw.phases[0].actions[1].patienceCost = value;
    expect(errorsOf(raw)[0]!.path).toBe('phases[0].actions[1].patienceCost');
  });

  it('accepts a zero patienceCost', () => {
    expect(codesOf(rawPrinter())).toEqual([]);
  });
});

describe('IDs and references', () => {
  it('rejects an initialPhaseId that does not exist', () => {
    const raw = rawPrinter();
    raw.initialPhaseId = 'warmup';
    expect(errorsOf(raw)).toEqual([expect.objectContaining({ code: 'unknown-phase-ref', path: 'initialPhaseId' })]);
  });

  it('rejects an action target pointing to a missing phase', () => {
    const raw = rawPrinter();
    raw.phases[1].actions[0].target.id = 'jamm';
    const errors = errorsOf(raw);
    expect(errors).toEqual([
      expect.objectContaining({ code: 'unknown-phase-ref', path: 'phases[1].actions[0].target.id' }),
    ]);
    expect(errors[0]!.message).toContain('jamm');
  });

  it('rejects duplicate phase IDs', () => {
    const raw = rawPrinter();
    raw.phases[2].id = 'queue';
    expect(codesOf(raw)).toContain('duplicate-phase-id');
  });

  it('rejects duplicate action IDs within a phase but allows reuse across phases', () => {
    const dup = rawPrinter();
    dup.phases[0].actions[1].id = 'reconnect';
    expect(codesOf(dup)).toContain('duplicate-action-id');

    const reuse = rawPrinter();
    reuse.phases[1].actions[1].id = 'print-again';
    expect(codesOf(reuse)).toEqual([]);
  });

  it.each([{ type: 'teleport' }, { type: 'phase' }, 'resolve', { type: 'resolve', id: 'x' }])(
    'rejects malformed target %j',
    (target) => {
      const raw = rawPrinter();
      raw.phases[2].actions[0].target = target;
      expect(codesOf(raw).length).toBeGreaterThan(0);
    },
  );
});

describe('scenes and cues', () => {
  it('rejects an unregistered sceneId', () => {
    const raw = rawPrinter();
    raw.sceneId = 'toaster';
    expect(codesOf(raw)).toEqual(['unknown-scene']);
  });

  it('does not treat prototype keys as registered scenes', () => {
    const raw = rawPrinter();
    raw.sceneId = 'constructor';
    expect(codesOf(raw)).toEqual(['unknown-scene']);
  });

  it('rejects a cue the scene does not support', () => {
    const raw = rawPrinter();
    raw.phases[1].cue = 'explode';
    expect(errorsOf(raw)).toEqual([expect.objectContaining({ code: 'unsupported-cue', path: 'phases[1].cue' })]);
  });
});

describe('path analysis', () => {
  it('rejects a level with no reachable resolve', () => {
    const raw = rawPrinter();
    raw.phases[2].actions = [
      { id: 'stare', label: '盯着它', patienceCost: 1, target: { type: 'phase', id: 'jam' } },
    ];
    expect(codesOf(raw)).toContain('no-reachable-resolve');
  });

  it('rejects an unreachable phase', () => {
    const raw = rawPrinter();
    raw.phases[0].actions[0].target.id = 'jam';
    expect(errorsOf(raw)).toEqual([expect.objectContaining({ code: 'unreachable-phase', path: 'phases[1]' })]);
  });

  it('rejects a trap phase that can never reach resolve', () => {
    const raw = rawPrinter();
    raw.phases.push({
      id: 'void',
      title: '虚空',
      description: '这里没有出口。',
      cue: 'jam',
      actions: [{ id: 'wait', label: '等待', patienceCost: 0, target: { type: 'phase', id: 'void' } }],
    });
    raw.phases[1].actions[1].target.id = 'void';
    expect(errorsOf(raw)).toEqual([expect.objectContaining({ code: 'trap-phase', path: 'phases[5]' })]);
  });

  it('allows self-loop retries as long as an exit exists', () => {
    expect(codesOf(rawPrinter())).toEqual([]);
  });
});

describe('error messages', () => {
  it('are non-empty and carry a location for every issue', () => {
    const raw = rawPrinter();
    raw.sceneId = 'toaster';
    raw.initialPatience = 0;
    raw.phases[0].actions[0].target.id = 'nowhere';
    const errors = errorsOf(raw);
    expect(errors.length).toBeGreaterThanOrEqual(3);
    for (const e of errors) {
      expect(e.message.length).toBeGreaterThan(0);
      expect(e.path.length).toBeGreaterThan(0);
    }
  });
});

describe('protocol v0.1 compatibility', () => {
  it('the original v0.1 printer level still loads unchanged', () => {
    const result = validateLevel(structuredClone(printerV01), SCENE_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.schemaVersion).toBe('0.1');
      expect(result.value.phases.map((p) => p.id)).toEqual(['offline', 'queue', 'jam']);
      expect(result.value.phases.every((p) => p.intensity === undefined)).toBe(true);
    }
  });

  it.each([
    ['phases[0].intensity', (raw: any) => (raw.phases[0].intensity = 'calm')],
    ['phases[0].actions[0].feedback', (raw: any) => (raw.phases[0].actions[0].feedback = '你好')],
    [
      'phases[2].actions[0].skill',
      (raw: any) =>
        (raw.phases[2].actions[0].skill = {
          type: 'timing',
          onFail: { patienceCost: 1, target: { type: 'phase', id: 'jam' } },
        }),
    ],
  ])('rejects the v0.2 field %s in a v0.1 file', (path, mutate) => {
    const raw = structuredClone(printerV01) as any;
    mutate(raw);
    expect(errorsOf(raw).map((e) => [e.code, e.path])).toEqual([['unknown-field', path]]);
  });
});

describe('protocol v0.2 fields', () => {
  // phases[2] = jam (round 1); actions[0] = open-lid (timing skill)
  it('accepts declared intensity, feedback and skills, and keeps them in the result', () => {
    const result = validateLevel(rawPrinter(), SCENE_CATALOG);
    if (!result.ok) throw new Error('expected ok');
    const jam = result.value.phases[2]!;
    expect(jam.intensity).toBe('critical');
    expect(jam.actions[0]!.skill).toEqual({
      type: 'timing',
      onFail: { patienceCost: 1, target: { type: 'phase', id: 'jam' }, feedback: '盖板猛地合上，夹住了你的手指。' },
    });
    expect(Object.isFrozen(jam.actions[0]!.skill!.onFail)).toBe(true);
  });

  it('rejects an invalid intensity', () => {
    const raw = rawPrinter();
    raw.phases[0].intensity = 'apocalyptic';
    expect(errorsOf(raw).map((e) => [e.code, e.path])).toEqual([['invalid-value', 'phases[0].intensity']]);
  });

  it('rejects empty or non-string feedback', () => {
    const raw = rawPrinter();
    raw.phases[0].actions[0].feedback = '  ';
    raw.phases[0].actions[1].feedback = 3;
    raw.phases[2].actions[0].skill.onFail.feedback = '';
    expect(errorsOf(raw).map((e) => [e.code, e.path])).toEqual(
      expect.arrayContaining([
        ['invalid-value', 'phases[0].actions[0].feedback'],
        ['invalid-type', 'phases[0].actions[1].feedback'],
        ['invalid-value', 'phases[2].actions[0].skill.onFail.feedback'],
      ]),
    );
  });

  it('rejects an unknown skill type', () => {
    const raw = rawPrinter();
    raw.phases[2].actions[0].skill.type = 'quicktime';
    expect(errorsOf(raw).map((e) => [e.code, e.path])).toEqual([['invalid-value', 'phases[2].actions[0].skill.type']]);
  });

  it('requires onFail and rejects unknown skill fields', () => {
    const raw = rawPrinter();
    delete raw.phases[2].actions[0].skill.onFail;
    raw.phases[2].actions[0].skill.script = 'x';
    expect(errorsOf(raw).map((e) => [e.code, e.path])).toEqual(
      expect.arrayContaining([
        ['missing-field', 'phases[2].actions[0].skill.onFail'],
        ['unknown-field', 'phases[2].actions[0].skill.script'],
      ]),
    );
  });

  it('validates the onFail cost', () => {
    const raw = rawPrinter();
    raw.phases[2].actions[0].skill.onFail.patienceCost = -1;
    expect(errorsOf(raw).map((e) => [e.code, e.path])).toEqual([
      ['invalid-value', 'phases[2].actions[0].skill.onFail.patienceCost'],
    ]);
  });

  it('checks that the onFail target exists', () => {
    const raw = rawPrinter();
    raw.phases[2].actions[0].skill.onFail.target = { type: 'phase', id: 'nowhere' };
    expect(errorsOf(raw).map((e) => [e.code, e.path])).toEqual([
      ['unknown-phase-ref', 'phases[2].actions[0].skill.onFail.target.id'],
    ]);
  });

  it('counts onFail targets for reachability', () => {
    const raw = rawPrinter();
    raw.phases.push({
      id: 'penalty',
      title: '惩罚',
      description: '只有失手才会来到这里。',
      cue: 'jam',
      intensity: 'critical',
      actions: [{ id: 'leave', label: '离开', patienceCost: 0, target: { type: 'phase', id: 'jam' } }],
    });
    expect(codesOf(raw)).toEqual(['unreachable-phase']);
    raw.phases[2].actions[0].skill.onFail.target.id = 'penalty';
    expect(codesOf(raw)).toEqual([]);
  });

  it('treats an onFail trap as a trap phase', () => {
    const raw = rawPrinter();
    raw.phases.push({
      id: 'void',
      title: '虚空',
      description: '这里没有出口。',
      cue: 'jam',
      actions: [{ id: 'wait', label: '等待', patienceCost: 0, target: { type: 'phase', id: 'void' } }],
    });
    raw.phases[2].actions[0].skill.onFail.target.id = 'void';
    expect(errorsOf(raw)).toEqual([expect.objectContaining({ code: 'trap-phase', path: 'phases[5]' })]);
  });
});

describe('protocol v0.3 fights', () => {
  const fightPhase = (id: string, target: object, extra: object = {}) => ({
    id,
    title: id,
    description: 'd',
    cue: 'jam',
    fight: { id: 'printer-boss', target, ...extra },
  });

  it('accepts fight phases and keeps the fight in the result', () => {
    const result = validateLevel(rawShipped(), SCENE_CATALOG);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phases[2]!.fight).toEqual({
      id: 'printer-boss',
      target: { type: 'resolve' },
      feedback: expect.any(String),
    });
    expect(Object.isFrozen(result.value.phases[2]!.fight)).toBe(true);
  });

  it('rejects `fight` in a v0.2 file (its meaning must not change silently)', () => {
    const raw = rawShipped();
    raw.schemaVersion = '0.2';
    expect(codesOf(raw)).toContain('unknown-field');
  });

  it('rejects an unregistered fight id', () => {
    const raw = rawShipped();
    raw.phases[0].fight.id = 'printer-dance-off';
    const errors = errorsOf(raw);
    expect(errors.map((e) => e.code)).toContain('unknown-fight');
    expect(errors.find((e) => e.code === 'unknown-fight')!.path).toBe('phases[0].fight.id');
  });

  it('rejects a phase with both a fight and actions', () => {
    const raw = rawShipped();
    raw.phases[0].actions = [{ id: 'a', label: 'a', patienceCost: 0, target: { type: 'resolve' } }];
    const errors = errorsOf(raw);
    expect(errors.some((e) => e.path === 'phases[0].actions' && e.code === 'invalid-value')).toBe(true);
  });

  it('still requires actions on phases without a fight', () => {
    const raw = rawShipped();
    delete raw.phases[0].fight;
    expect(errorsOf(raw).some((e) => e.path === 'phases[0].actions' && e.code === 'missing-field')).toBe(true);
  });

  it('validates the fight shape: required target, no unknown fields, non-empty feedback', () => {
    const raw = rawShipped();
    delete raw.phases[0].fight.target;
    raw.phases[1].fight.script = 'alert(1)';
    raw.phases[2].fight.feedback = '';
    const errors = errorsOf(raw);
    expect(errors.some((e) => e.path === 'phases[0].fight.target' && e.code === 'missing-field')).toBe(true);
    expect(errors.some((e) => e.path === 'phases[1].fight.script' && e.code === 'unknown-field')).toBe(true);
    expect(errors.some((e) => e.path === 'phases[2].fight.feedback' && e.code === 'invalid-value')).toBe(true);
  });

  it('checks fight targets for references, reachability and traps', () => {
    const missing = rawShipped();
    missing.phases[0].fight.target = { type: 'phase', id: 'nowhere' };
    expect(errorsOf(missing).find((e) => e.code === 'unknown-phase-ref')!.path).toBe('phases[0].fight.target.id');

    const trap = {
      ...rawShipped(),
      phases: [fightPhase('a', { type: 'phase', id: 'b' }), fightPhase('b', { type: 'phase', id: 'b' })],
      initialPhaseId: 'a',
    };
    expect(codesOf(trap)).toContain('no-reachable-resolve');

    const ok = { ...rawShipped(), phases: [fightPhase('a', { type: 'resolve' })], initialPhaseId: 'a' };
    expect(codesOf(ok)).toEqual([]);
  });

  it('lets a v0.3 level mix fight phases and action phases', () => {
    const raw = rawPrinter();
    raw.schemaVersion = '0.3';
    raw.phases[4] = fightPhase('jam-final', { type: 'resolve' });
    expect(codesOf(raw)).toEqual([]);
  });
});
