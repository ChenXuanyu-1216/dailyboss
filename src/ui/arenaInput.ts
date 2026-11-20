import type { Vec } from '../game/arena';

/** Inside this fraction of the stick's radius the stick reads as centred (thumb jitter). */
export const STICK_DEAD_ZONE = 0.18;

/**
 * Virtual-stick reading → movement vector for the arena simulation (presentation only).
 *
 * `dx`, `dy` are the pointer's offset from the stick's centre in screen pixels (y grows downward);
 * `radius` is how far the thumb travels for full speed. The result has length ≤ 1, y pointing
 * *away from the camera* (screen up), with the dead zone removed and the rest rescaled so speed
 * still rises smoothly from 0 at its edge to 1 at the rim.
 */
export function stickVector(dx: number, dy: number, radius: number, deadZone = STICK_DEAD_ZONE): Vec {
  const r = Math.max(1, radius);
  const len = Math.hypot(dx, dy) / r;
  if (len <= deadZone) return { x: 0, y: 0 };
  const k = Math.min(1, (len - deadZone) / (1 - deadZone)) / len;
  return { x: (dx / r) * k, y: (-dy / r) * k };
}

/** Where the stick's knob is drawn, in pixels from the centre: the pointer, clamped to the rim. */
export function knobOffset(dx: number, dy: number, radius: number): Vec {
  const len = Math.hypot(dx, dy);
  if (len <= radius || len === 0) return { x: dx, y: dy };
  return { x: (dx / len) * radius, y: (dy / len) * radius };
}

/** Keyboard directions held → movement vector (diagonals are clamped to length 1 by the sim). */
export function keysVector(held: { up: boolean; down: boolean; left: boolean; right: boolean }): Vec {
  return { x: (held.right ? 1 : 0) - (held.left ? 1 : 0), y: (held.up ? 1 : 0) - (held.down ? 1 : 0) };
}
