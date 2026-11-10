import type { LevelDefinition } from '../src/game/contracts';
import { validateLevel } from '../src/game/validateLevel';
import { SCENE_CATALOG } from '../src/scenes/catalog';
import printerJson from '../content/levels/printer-from-hell.json';

/** A fresh, mutable deep copy of the shipped printer level JSON. */
export function rawPrinter(): any {
  return structuredClone(printerJson);
}

export function validPrinter(): LevelDefinition {
  const result = validateLevel(rawPrinter(), SCENE_CATALOG);
  if (!result.ok) throw new Error(JSON.stringify(result.errors, null, 2));
  return result.value;
}

export function codesOf(input: unknown): string[] {
  const result = validateLevel(input, SCENE_CATALOG);
  return result.ok ? [] : result.errors.map((e) => e.code);
}

export function errorsOf(input: unknown) {
  const result = validateLevel(input, SCENE_CATALOG);
  return result.ok ? [] : result.errors;
}
