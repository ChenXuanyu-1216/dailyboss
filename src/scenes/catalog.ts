import type { SceneCatalog } from '../game/contracts';

/**
 * Whitelist of scene IDs and the cues each scene can perform.
 * Kept free of React/Three.js imports so the validator and tests can use it.
 * Every key here must have a component in ./registry.ts (enforced by its type).
 */
export const SCENE_CATALOG = {
  printer: { cues: ['offline', 'queue', 'jam'] },
} as const satisfies SceneCatalog;

export type SceneId = keyof typeof SCENE_CATALOG;
