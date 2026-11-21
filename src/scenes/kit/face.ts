import type { FaceMood } from '../arenaAnim';

/**
 * The vending machine's LCD face, drawn on a small 2D canvas that the 3D model uses as an emissive
 * texture. `faceKey` says when a redraw is needed, so the canvas is redrawn a few times a second
 * at most, never every frame.
 */

export const FACE_W = 256;
export const FACE_H = 160;

export interface FaceState {
  mood: FaceMood;
  /** 0 eyes open … 1 shut. */
  blink: number;
  /** Maintenance progress 0 … 1. */
  progress: number;
  /** Seconds, for spinning spirals and the loading ring. */
  time: number;
  /** Eyes look this way, −1 … 1 (toward the player). */
  look: number;
}

const COLORS: Record<FaceMood, string> = {
  idle: '#7ee8ff',
  focus: '#ffc44d',
  angry: '#ff4d5e',
  guard: '#9ad0ff',
  loading: '#ffd23f',
  hurt: '#ffffff',
  dizzy: '#ffd23f',
  off: '#1b2a33',
  defeated: '#ff8a8a',
  smug: '#ff6b9a',
  happy: '#7cf2a6',
};

/** Changes whenever the drawing would change; quantised so it stays cheap. */
export function faceKey(f: FaceState): string {
  const animated = f.mood === 'dizzy' || f.mood === 'loading';
  return [
    f.mood,
    Math.round(f.blink * 4),
    f.mood === 'loading' ? Math.round(f.progress * 40) : 0,
    animated ? Math.floor(f.time * 12) : 0,
    Math.round(f.look * 4),
  ].join('|');
}

export function drawFace(g: CanvasRenderingContext2D, f: FaceState): void {
  const W = FACE_W;
  const H = FACE_H;
  const color = COLORS[f.mood];
  g.save();
  g.clearRect(0, 0, W, H);
  // Panel and its glow.
  g.fillStyle = f.mood === 'off' ? '#020406' : '#03111a';
  g.fillRect(0, 0, W, H);
  if (f.mood !== 'off') {
    const glow = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.7);
    glow.addColorStop(0, hexA(color, 0.22));
    glow.addColorStop(1, hexA(color, 0));
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
  }

  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.shadowColor = color;
  g.shadowBlur = f.mood === 'off' ? 0 : 14;
  const lx = W * 0.3 + f.look * 10;
  const rx = W * 0.7 + f.look * 10;
  const ey = H * 0.48;
  const open = 1 - f.blink;

  switch (f.mood) {
    case 'idle':
      eye(g, lx, ey, 34, 46 * open, 14);
      eye(g, rx, ey, 34, 46 * open, 14);
      // Bored lids.
      g.fillStyle = '#03111a';
      g.shadowBlur = 0;
      g.fillRect(lx - 24, ey - 30, 48, 14);
      g.fillRect(rx - 24, ey - 30, 48, 14);
      break;
    case 'focus':
      eye(g, lx, ey + 4, 40, 18 * open + 2, 8);
      eye(g, rx, ey + 4, 40, 18 * open + 2, 8);
      brow(g, lx, ey - 26, -0.18, 50);
      brow(g, rx, ey - 26, 0.18, 50);
      break;
    case 'angry':
      angryEye(g, lx, ey, 1, open);
      angryEye(g, rx, ey, -1, open);
      break;
    case 'guard':
      eye(g, lx, ey, 36, 30 * open + 2, 10);
      eye(g, rx, ey, 36, 30 * open + 2, 10);
      // A shield glyph between the eyes.
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(W / 2, ey - 22);
      g.lineTo(W / 2 + 14, ey - 14);
      g.lineTo(W / 2 + 10, ey + 8);
      g.lineTo(W / 2, ey + 18);
      g.lineTo(W / 2 - 10, ey + 8);
      g.lineTo(W / 2 - 14, ey - 14);
      g.closePath();
      g.stroke();
      break;
    case 'loading': {
      const r = 42;
      g.lineWidth = 12;
      g.globalAlpha = 0.25;
      g.beginPath();
      g.arc(W / 2, H / 2, r, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
      g.beginPath();
      g.arc(W / 2, H / 2, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f.progress);
      g.stroke();
      const spin = f.time * 6;
      g.lineWidth = 5;
      g.beginPath();
      g.arc(W / 2, H / 2, r - 18, spin, spin + 1.4);
      g.stroke();
      g.shadowBlur = 0;
      g.font = '800 22px ui-monospace, Menlo, Consolas, monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(`${Math.round(f.progress * 100)}%`, W / 2, H / 2 + 2);
      break;
    }
    case 'hurt':
      chevron(g, lx, ey, 1);
      chevron(g, rx, ey, -1);
      break;
    case 'dizzy':
      spiral(g, lx, ey, f.time * 7);
      spiral(g, rx, ey, f.time * 7 + 1.3);
      break;
    case 'off':
      g.shadowBlur = 0;
      g.fillStyle = '#ff3b3b';
      g.globalAlpha = Math.floor(f.time * 2) % 2 === 0 ? 0.9 : 0.25;
      g.fillRect(W - 34, 14, 18, 8);
      break;
    case 'defeated':
      cross(g, lx, ey);
      cross(g, rx, ey);
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(W / 2 - 26, H * 0.82);
      g.quadraticCurveTo(W / 2, H * 0.72, W / 2 + 26, H * 0.82);
      g.stroke();
      break;
    case 'smug':
      g.lineWidth = 9;
      arcEye(g, lx, ey + 6, false);
      arcEye(g, rx, ey + 6, false);
      g.beginPath();
      g.moveTo(W / 2 - 30, H * 0.76);
      g.quadraticCurveTo(W / 2 + 10, H * 0.9, W / 2 + 34, H * 0.7);
      g.stroke();
      break;
    case 'happy':
      g.lineWidth = 9;
      arcEye(g, lx, ey + 6, true);
      arcEye(g, rx, ey + 6, true);
      break;
  }

  // Scanlines over everything.
  g.shadowBlur = 0;
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2);
  g.restore();
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function eye(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const hh = Math.max(3, h);
  const rr = Math.min(r, hh / 2, w / 2);
  g.beginPath();
  g.roundRect(x - w / 2, y - hh / 2, w, hh, rr);
  g.fill();
}

function brow(g: CanvasRenderingContext2D, x: number, y: number, tilt: number, w: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  g.fillRect(-w / 2, -4, w, 8);
  g.restore();
}

function angryEye(g: CanvasRenderingContext2D, x: number, y: number, side: 1 | -1, open: number): void {
  g.beginPath();
  g.moveTo(x - 26, y - 14 * side + 2);
  g.lineTo(x + 26, y + 14 * side + 2 - 8 * side);
  g.lineTo(x + 22 * side, y + 22 * open + 4);
  g.lineTo(x - 22 * side, y + 22 * open + 4);
  g.closePath();
  g.fill();
}

function chevron(g: CanvasRenderingContext2D, x: number, y: number, side: 1 | -1): void {
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(x - 20 * side, y - 20);
  g.lineTo(x + 16 * side, y);
  g.lineTo(x - 20 * side, y + 20);
  g.stroke();
}

function spiral(g: CanvasRenderingContext2D, x: number, y: number, rot: number): void {
  g.lineWidth = 5;
  g.beginPath();
  for (let i = 0; i <= 60; i++) {
    const a = rot + i * 0.32;
    const r = 2 + i * 0.5;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.stroke();
}

function cross(g: CanvasRenderingContext2D, x: number, y: number): void {
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(x - 18, y - 18);
  g.lineTo(x + 18, y + 18);
  g.moveTo(x + 18, y - 18);
  g.lineTo(x - 18, y + 18);
  g.stroke();
}

function arcEye(g: CanvasRenderingContext2D, x: number, y: number, up: boolean): void {
  g.beginPath();
  if (up) g.arc(x, y + 8, 22, Math.PI * 1.1, Math.PI * 1.9);
  else g.arc(x, y - 10, 22, Math.PI * 0.15, Math.PI * 0.85);
  g.stroke();
}
