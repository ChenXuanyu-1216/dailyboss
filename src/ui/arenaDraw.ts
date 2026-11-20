import {
  ARENA_RULES,
  type ArenaFightDefinition,
  type ArenaState,
  type Hazard,
  type Shape,
  type Vec,
} from '../game/arena';

/**
 * Top-down drawing of an open-arena fight on a 2D canvas: the floor, the warnings, the boss and
 * the player. A pure function of the simulation state (no rules here). It is the arena's view
 * until the 3D scene arrives, and stays as the view without WebGL afterwards.
 *
 * World → screen: x to the right, y away from the camera, so screen y = (halfH − y) · scale.
 */

const C = {
  floor: '#1b2130',
  floorEdge: '#2b3346',
  grid: 'rgb(255 255 255 / 0.045)',
  warn: 'rgb(245 165 36 / 0.16)',
  warnFill: 'rgb(245 165 36 / 0.34)',
  warnEdge: 'rgb(245 165 36 / 0.9)',
  strike: 'rgb(229 72 77 / 0.62)',
  strikeEdge: '#ff6369',
  soda: 'rgb(63 184 175 / 0.5)',
  sodaEdge: '#5fd6cb',
  boss: '#d7dbe2',
  bossDark: '#6b7280',
  glass: '#7cc3f0',
  weak: '#ffd23f',
  socket: '#59617a',
  socketLive: '#ffd23f',
  player: '#5ee0a0',
  playerEdge: '#0f3d2a',
  hurt: 'rgb(229 72 77 / 0.35)',
} as const;

export interface DrawOptions {
  /** Device-pixel width and height of the canvas. */
  width: number;
  height: number;
  /** Whether to animate pulses (off for reduced motion). */
  motion: boolean;
}

export function drawArena(ctx: CanvasRenderingContext2D, def: ArenaFightDefinition, s: ArenaState, o: DrawOptions): void {
  const { halfW, halfH } = def.floor;
  const scale = Math.min(o.width / (2 * halfW), o.height / (2 * halfH));
  const ox = (o.width - 2 * halfW * scale) / 2;
  const oy = (o.height - 2 * halfH * scale) / 2;
  const X = (x: number) => ox + (x + halfW) * scale;
  const Y = (y: number) => oy + (halfH - y) * scale;
  const P = (p: Vec): [number, number] => [X(p.x), Y(p.y)];
  const t = s.t;

  ctx.clearRect(0, 0, o.width, o.height);

  // Floor and a 1-unit grid, so distances read at a glance.
  ctx.fillStyle = C.floor;
  ctx.fillRect(X(-halfW), Y(halfH), 2 * halfW * scale, 2 * halfH * scale);
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = Math.ceil(-halfW); x <= halfW; x++) {
    ctx.moveTo(X(x), Y(halfH));
    ctx.lineTo(X(x), Y(-halfH));
  }
  for (let y = Math.ceil(-halfH); y <= halfH; y++) {
    ctx.moveTo(X(-halfW), Y(y));
    ctx.lineTo(X(halfW), Y(y));
  }
  ctx.stroke();
  ctx.strokeStyle = C.floorEdge;
  ctx.lineWidth = Math.max(2, scale * 0.12);
  ctx.strokeRect(X(-halfW), Y(halfH), 2 * halfW * scale, 2 * halfH * scale);

  // Sockets; the live one glows and a cable runs to the boss.
  for (const socket of def.sockets) {
    const live = s.charge !== null && s.charge.socket.x === socket.x && s.charge.socket.y === socket.y;
    const [sx, sy] = P(socket);
    if (live) {
      ctx.save();
      ctx.setLineDash([scale * 0.25, scale * 0.18]);
      ctx.strokeStyle = C.socketLive;
      ctx.lineWidth = Math.max(1.5, scale * 0.06);
      ctx.beginPath();
      ctx.moveTo(...P(s.boss));
      ctx.lineTo(sx, sy);
      ctx.stroke();
      ctx.restore();
      const pulse = o.motion ? 0.5 + 0.5 * Math.sin(t / 120) : 1;
      ctx.fillStyle = `rgb(255 210 63 / ${0.18 + 0.2 * pulse})`;
      ctx.beginPath();
      ctx.arc(sx, sy, ARENA_RULES.plugReach * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = live ? C.socketLive : C.socket;
    ctx.fillRect(sx - scale * 0.22, sy - scale * 0.22, scale * 0.44, scale * 0.44);
  }

  // Warnings under everything that moves. The inner fill grows until the strike.
  for (const h of s.hazards) drawHazard(ctx, h, t, scale, P);

  // The boss.
  const [bx, by] = P(s.boss);
  const r = def.bossRadius * scale;
  if (s.down) {
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(-s.bossFacing);
    ctx.fillStyle = s.down.cause === 'unplug' ? C.bossDark : C.boss;
    roundRect(ctx, -r * 1.5, -r * 0.8, r * 3, r * 1.6, r * 0.2);
    ctx.fill();
    ctx.restore();
    const [wx, wy] = P(s.down.weak);
    const pulse = o.motion ? 0.5 + 0.5 * Math.sin(t / 90) : 1;
    ctx.fillStyle = `rgb(255 210 63 / ${0.25 + 0.25 * pulse})`;
    ctx.beginPath();
    ctx.arc(wx, wy, ARENA_RULES.weakReach * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.weak;
    ctx.beginPath();
    ctx.arc(wx, wy, scale * 0.28, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = C.boss;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
    // The armoured glass front: a thick arc over ±armorDeg around its facing.
    const a = -s.bossFacing;
    const half = (def.armorDeg * Math.PI) / 180;
    ctx.strokeStyle = C.glass;
    ctx.lineWidth = Math.max(3, scale * 0.22);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(bx, by, r - ctx.lineWidth / 2, a - half, a + half);
    ctx.stroke();
    ctx.lineCap = 'butt';
    // Its back, where hits land.
    ctx.fillStyle = 'rgb(229 72 77 / 0.55)';
    ctx.beginPath();
    ctx.arc(bx - Math.cos(a) * r * 0.55, by - Math.sin(a) * r * 0.55, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  // The player: a dot with a facing tick; blinking while invulnerable, a streak while dashing.
  const [px, py] = P(s.pos);
  const pr = ARENA_RULES.playerRadius * scale;
  const invulnerable = t < s.invulnerableUntil && s.hits > 0;
  const blink = invulnerable && o.motion && Math.floor(t / 90) % 2 === 0;
  if (s.dashFrom !== null && t < s.dashFrom + ARENA_RULES.dashMs) {
    ctx.strokeStyle = 'rgb(94 224 160 / 0.35)';
    ctx.lineWidth = pr * 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px - Math.cos(-s.dashDir) * pr * 3, py - Math.sin(-s.dashDir) * pr * 3);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
  ctx.globalAlpha = blink ? 0.35 : 1;
  ctx.fillStyle = C.player;
  ctx.strokeStyle = C.playerEdge;
  ctx.lineWidth = Math.max(1.5, scale * 0.06);
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = C.playerEdge;
  ctx.lineWidth = Math.max(2, scale * 0.08);
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + Math.cos(-s.facing) * pr, py + Math.sin(-s.facing) * pr);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // A red edge for a moment after being hit.
  if (invulnerable && t - (s.invulnerableUntil - ARENA_RULES.invulnerableMs) < 250) {
    ctx.strokeStyle = C.hurt;
    ctx.lineWidth = scale * 0.5;
    ctx.strokeRect(X(-halfW), Y(halfH), 2 * halfW * scale, 2 * halfH * scale);
  }
}

function drawHazard(
  ctx: CanvasRenderingContext2D,
  h: Hazard,
  t: number,
  scale: number,
  P: (p: Vec) => [number, number],
): void {
  const active = t >= h.activeAt;
  const soda = h.kind === 'soda';
  const progress = active ? 1 : Math.min(1, Math.max(0, (t - h.warnAt) / Math.max(1, h.activeAt - h.warnAt)));
  if (active) {
    shapePath(ctx, h.shape, 1, scale, P);
    ctx.fillStyle = soda ? C.soda : C.strike;
    ctx.fill();
    ctx.strokeStyle = soda ? C.sodaEdge : C.strikeEdge;
    ctx.lineWidth = Math.max(2, scale * 0.06);
    ctx.stroke();
    return;
  }
  shapePath(ctx, h.shape, 1, scale, P);
  ctx.fillStyle = C.warn;
  ctx.fill();
  ctx.strokeStyle = C.warnEdge;
  ctx.lineWidth = Math.max(1.5, scale * 0.05);
  ctx.setLineDash([scale * 0.2, scale * 0.12]);
  ctx.stroke();
  ctx.setLineDash([]);
  shapePath(ctx, h.shape, progress, scale, P);
  ctx.fillStyle = C.warnFill;
  ctx.fill();
}

/** The shape's outline, grown to `k` of its size from its origin (centre for circles). */
function shapePath(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  k: number,
  scale: number,
  P: (p: Vec) => [number, number],
): void {
  ctx.beginPath();
  switch (shape.type) {
    case 'circle': {
      const [cx, cy] = P(shape.c);
      ctx.arc(cx, cy, shape.r * k * scale, 0, Math.PI * 2);
      break;
    }
    case 'cone': {
      const [cx, cy] = P(shape.o);
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, shape.range * k * scale, -shape.dir - shape.half, -shape.dir + shape.half);
      ctx.closePath();
      break;
    }
    case 'strip': {
      const [cx, cy] = P(shape.o);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-shape.dir);
      ctx.rect(0, (-shape.width / 2) * scale, shape.length * k * scale, shape.width * scale);
      ctx.restore();
      break;
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
