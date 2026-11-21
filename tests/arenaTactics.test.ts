import { describe, expect, it } from 'vitest';
import { createArena, stepArena, NO_ARENA_INPUT } from '../src/game/arena';
import { ARENA_FIGHTS } from '../src/game/arenaFights';
import { armorPose, isLiveSocket, machinePose, newMachineMemo } from '../src/scenes/arenaAnim';

const def = ARENA_FIGHTS['vending-pay']!;

describe('3D tactical markers', () => {
  it('keeps the armored footprint at the attackable position during an airborne hop', () => {
    let state = createArena(def, 1);
    while (state.t < 4560) state = stepArena(def, state, NO_ARENA_INPUT, 10).state;
    const pose = machinePose(def, state, newMachineMemo());
    expect(pose.lift).toBeGreaterThan(0);
    expect(pose.anchor.y).toBeLessThan(-1);
    expect(armorPose(state)).toEqual({ center: { x: 0, y: 1.6 }, yaw: state.bossFacing, visible: true });
    expect(armorPose(state).center).not.toEqual(pose.anchor);
    const landed = stepArena(def, state, NO_ARENA_INPUT, 50).state;
    expect(armorPose(landed).center).toEqual(landed.boss);
    expect(armorPose(landed).center).not.toEqual(state.boss);
  });

  it('removes the armor marker once unplugged, even though the cabinet is upright', () => {
    const state = createArena(def, 1);
    const down = { cause: 'unplug' as const, from: 0, until: 2600, weak: { x: 0, y: 0.2 } };
    const unplugged = { ...state, down };
    expect(machinePose(def, unplugged, newMachineMemo()).fall).toBe(0);
    expect(armorPose(unplugged).visible).toBe(false);
    expect(armorPose({ ...state, won: true }).visible).toBe(false);
  });

  it('marks exactly the charged socket, comparing coordinates instead of object identity', () => {
    const state = createArena(def, 1);
    const charge = { from: 0, until: 6000, heal: 0, socket: { x: 6.4, y: 3.9 } };
    expect(def.sockets.filter((socket) => isLiveSocket(state, socket))).toEqual([]);
    expect(def.sockets.filter((socket) => isLiveSocket({ ...state, charge }, socket))).toEqual([{ x: 6.4, y: 3.9 }]);
  });
});
