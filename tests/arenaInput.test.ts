import { describe, expect, it } from 'vitest';
import { STICK_DEAD_ZONE, keysVector, knobOffset, stickVector } from '../src/ui/arenaInput';

describe('touch stick (presentation only)', () => {
  it('reads centred inside the dead zone', () => {
    expect(stickVector(0, 0, 44)).toEqual({ x: 0, y: 0 });
    expect(stickVector(44 * STICK_DEAD_ZONE - 0.5, 0, 44)).toEqual({ x: 0, y: 0 });
  });

  it('screen up is away from the camera, and the rim is full speed', () => {
    const up = stickVector(0, -44, 44);
    expect(up.x).toBeCloseTo(0);
    expect(up.y).toBeCloseTo(1);
    const right = stickVector(44, 0, 44);
    expect(right.x).toBe(1);
    expect(right.y).toBeCloseTo(0);
  });

  it('never exceeds length 1, even past the rim', () => {
    const v = stickVector(300, 300, 44);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
    expect(v.x).toBeCloseTo(Math.SQRT1_2);
    expect(v.y).toBeCloseTo(-Math.SQRT1_2);
  });

  it('speed rises smoothly from the dead zone edge to the rim', () => {
    const speeds = [0.2, 0.4, 0.6, 0.8, 1].map((f) => stickVector(44 * f, 0, 44).x);
    for (let i = 1; i < speeds.length; i++) expect(speeds[i]!).toBeGreaterThan(speeds[i - 1]!);
    expect(speeds[0]!).toBeLessThan(0.05);
  });

  it('keeps the knob inside the rim', () => {
    expect(knobOffset(10, 5, 44)).toEqual({ x: 10, y: 5 });
    const k = knobOffset(0, -100, 44);
    expect(k.x).toBeCloseTo(0);
    expect(k.y).toBeCloseTo(-44);
  });

  it('maps held keys to a direction', () => {
    expect(keysVector({ up: true, down: false, left: true, right: false })).toEqual({ x: -1, y: 1 });
    expect(keysVector({ up: true, down: true, left: false, right: false })).toEqual({ x: 0, y: 0 });
  });
});
