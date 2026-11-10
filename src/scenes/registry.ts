import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { SceneId } from './catalog';
import type { Scene3DProps } from './types';

/**
 * sceneId → local 3D component. A fixed whitelist: content can only pick from these keys,
 * never load code from a URL. Components are lazy so Three.js stays out of the initial bundle.
 * The Record<SceneId, …> type forces every catalog entry to have a component.
 */
export const SCENE_REGISTRY: Record<SceneId, LazyExoticComponent<ComponentType<Scene3DProps>>> = {
  printer: lazy(() => import('./PrinterScene')),
};

export function getSceneComponent(sceneId: string) {
  return Object.hasOwn(SCENE_REGISTRY, sceneId) ? SCENE_REGISTRY[sceneId as SceneId] : undefined;
}
