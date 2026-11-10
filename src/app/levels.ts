import type { LevelDefinition, Result } from '../game/contracts';
import { validateLevel } from '../game/validateLevel';
import { SCENE_CATALOG } from '../scenes/catalog';
import printerFromHell from '../../content/levels/printer-from-hell.json';

/**
 * Level content sources. Adding a level using existing mechanics = add a JSON file
 * under content/levels/ and list it here (plus a scene in src/scenes/ if it needs a new one).
 */
export const LEVEL_SOURCES: Readonly<Record<string, unknown>> = {
  'printer-from-hell': printerFromHell,
};

export const DEFAULT_LEVEL_ID = 'printer-from-hell';

export function loadLevel(levelId: string): Result<LevelDefinition> {
  if (!Object.hasOwn(LEVEL_SOURCES, levelId)) {
    return {
      ok: false,
      errors: [
        {
          code: 'invalid-value',
          path: 'level',
          message: `找不到关卡 "${levelId}"。可用关卡：${Object.keys(LEVEL_SOURCES).join('、')}。`,
        },
      ],
    };
  }
  const result = validateLevel(LEVEL_SOURCES[levelId], SCENE_CATALOG);
  if (result.ok && result.value.id !== levelId) {
    return {
      ok: false,
      errors: [
        {
          code: 'invalid-value',
          path: 'id',
          message: `关卡文件登记为 "${levelId}"，但其 id 为 "${result.value.id}"。`,
        },
      ],
    };
  }
  return result;
}
