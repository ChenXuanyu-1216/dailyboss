import { describe, expect, it } from 'vitest';
import { validateLevel } from '../src/game/validateLevel';
import { loadLevel, LEVEL_SOURCES } from '../src/app/levels';
import { SCENE_CATALOG } from '../src/scenes/catalog';
import { codesOf, errorsOf, rawPrinter } from './helpers';

describe('shipped content', () => {
  it('the printer level JSON is valid', () => {
    const result = loadLevel('printer-from-hell');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe('地狱打印机');
      expect(result.value.phases.map((p) => p.id)).toEqual(['offline', 'queue', 'jam']);
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
    expect(errorsOf(raw)).toEqual([expect.objectContaining({ code: 'trap-phase', path: 'phases[3]' })]);
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
