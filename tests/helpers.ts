import type { LevelDefinition } from '../src/game/contracts';
import { validateLevel } from '../src/game/validateLevel';
import { SCENE_CATALOG } from '../src/scenes/catalog';
import printerV02Json from './fixtures/printer-v0.2.json';
import shippedJson from '../content/levels/printer-from-hell.json';

/**
 * A fresh, mutable deep copy of the menu-based printer level (protocol v0.2: actions and skill
 * checks). It was the shipped level before fights (v0.3) and keeps the action rules covered.
 */
export function rawPrinter(): any {
  return structuredClone(printerV02Json);
}

export function validPrinter(): LevelDefinition {
  const result = validateLevel(rawPrinter(), SCENE_CATALOG);
  if (!result.ok) throw new Error(JSON.stringify(result.errors, null, 2));
  return result.value;
}

/** A fresh, mutable deep copy of the shipped level (protocol v0.3: real-time fights). */
export function rawShipped(): any {
  return structuredClone(shippedJson);
}

export function validShipped(): LevelDefinition {
  const result = validateLevel(rawShipped(), SCENE_CATALOG);
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
