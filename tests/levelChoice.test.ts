import { describe, expect, it } from 'vitest';
import { initialLevelId, searchWithLevel } from '../src/app/levelChoice';
import { DEFAULT_LEVEL_ID, LEVEL_SOURCES, listLevels } from '../src/app/levels';

const KNOWN = ['printer-from-hell', 'vending-machine'];

describe('initialLevelId', () => {
  it('opens the default level on a first visit', () => {
    expect(initialLevelId('', null, KNOWN, 'printer-from-hell')).toBe('printer-from-hell');
  });

  it('reopens the level picked last time', () => {
    expect(initialLevelId('?fx=0', 'vending-machine', KNOWN, 'printer-from-hell')).toBe('vending-machine');
  });

  it('lets a ?level link win over the remembered level', () => {
    expect(initialLevelId('?level=printer-from-hell', 'vending-machine', KNOWN, 'printer-from-hell')).toBe(
      'printer-from-hell',
    );
  });

  it('passes an unknown ?level through, so the configuration error still shows', () => {
    expect(initialLevelId('?level=missing-level', null, KNOWN, 'printer-from-hell')).toBe('missing-level');
  });

  it('ignores a remembered level that no longer exists', () => {
    expect(initialLevelId('', 'retired-level', KNOWN, 'printer-from-hell')).toBe('printer-from-hell');
  });
});

describe('searchWithLevel', () => {
  it('adds the level to an empty query', () => {
    expect(searchWithLevel('', 'vending-machine')).toBe('?level=vending-machine');
  });

  it('replaces the level and keeps the other parameters in order', () => {
    expect(searchWithLevel('?seed=7&level=printer-from-hell&fx=0', 'vending-machine')).toBe(
      '?seed=7&level=vending-machine&fx=0',
    );
  });
});

describe('listLevels', () => {
  it('lists every shipped level in registry order, default first', () => {
    const levels = listLevels();
    expect(levels.map((l) => l.id)).toEqual(Object.keys(LEVEL_SOURCES));
    expect(levels[0]?.id).toBe(DEFAULT_LEVEL_ID);
    expect(levels.map((l) => l.title)).toEqual(['地狱打印机', '吞币售货机']);
  });
});
