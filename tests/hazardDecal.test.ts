import { createRoot, extend, flushSync } from '@react-three/fiber';
import { createElement } from 'react';
import { Group, Mesh, PlaneGeometry, type ShaderMaterial, type WebGLRenderer } from 'three';
import { expect, it } from 'vitest';
import { createArena, NO_ARENA_INPUT, stepArena } from '../src/game/arena';
import { ARENA_FIGHTS } from '../src/game/arenaFights';
import { HazardDecal } from '../src/scenes/kit/HazardDecal';

it('keeps the decal material across simulation steps while a hazard is alive', async () => {
  // Render the real scene graph using R3F, without a GPU or browser canvas.
  extend({ Group, Mesh, PlaneGeometry });
  const root = createRoot({} as HTMLCanvasElement);
  const gl = {
    render() {},
    setSize() {},
    setPixelRatio() {},
    shadowMap: { enabled: false, type: 0 },
  } as unknown as WebGLRenderer;
  await root.configure({ gl, frameloop: 'never', dpr: 1, size: { width: 100, height: 100, top: 0, left: 0 } });
  try {
    const def = ARENA_FIGHTS['vending-pay']!;
    const state = stepArena(def, createArena(def, 1), NO_ARENA_INPUT, 1200).state;
    const next = stepArena(def, state, NO_ARENA_INPUT, 16).state;
    const hazard = state.hazards[0]!;
    const nextHazard = next.hazards[0]!;
    expect(nextHazard).not.toBe(hazard);
    const props = { getT: () => next.t, motion: true, floor: def.floor };
    const store = root.render(createElement(HazardDecal, { ...props, h: hazard }));
    const mesh = () => store.getState().scene.children[0]!.children[0] as Mesh;
    const initial = mesh().material;
    flushSync(() => { root.render(createElement(HazardDecal, { ...props, h: nextHazard })); });
    expect(mesh().material).toBe(initial);
    // The material responds to reduced motion even when the shape remains unchanged.
    flushSync(() => { root.render(createElement(HazardDecal, { ...props, motion: false, h: nextHazard })); });
    expect((mesh().material as ShaderMaterial).uniforms.uMotion!.value).toBe(0);
  } finally {
    root.unmount();
  }
});
