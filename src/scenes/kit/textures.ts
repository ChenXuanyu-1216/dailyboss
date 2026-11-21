import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

/**
 * Procedural textures drawn on 2D canvases, so the scenes need no image files. Each call makes a
 * new texture; callers create them once (useMemo) and dispose them on unmount.
 */

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function srgb<T extends Texture>(t: T): T {
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** A soft round shadow (white, used as an alpha map on a black plane). */
export function blobShadowTexture(): CanvasTexture {
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

/** Polished corridor tiles: one tile per world unit when repeated `w × h` times. */
export function floorTexture(w: number, h: number): CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#161c2c';
  g.fillRect(0, 0, 256, 256);
  // Two-tone checker in 128px tiles, subtle speckle, and thin grout lines.
  g.fillStyle = '#1b2236';
  g.fillRect(0, 0, 128, 128);
  g.fillRect(128, 128, 128, 128);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(255,255,255,${0.012 + rnd() * 0.025})`;
    g.fillRect(rnd() * 256, rnd() * 256, 1.5, 1.5);
  }
  g.strokeStyle = 'rgba(120,140,200,0.18)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, 126, 126);
  g.strokeRect(129, 1, 126, 126);
  g.strokeRect(1, 129, 126, 126);
  g.strokeRect(129, 129, 126, 126);
  const t = srgb(new CanvasTexture(c));
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(w / 2, h / 2);
  t.anisotropy = 4;
  return t;
}

/** The lit sign on top of the machine: text on a gradient, wide enough to scroll. */
export function marqueeTexture(text: string): CanvasTexture {
  const [c, g] = canvas(512, 96);
  const grad = g.createLinearGradient(0, 0, 0, 96);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#cfe6ff');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = '#0b1530';
  g.font = '900 58px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  g.fillText(text, 128, 50);
  g.fillText(text, 384, 50);
  g.fillStyle = 'rgba(11,21,48,0.45)';
  for (let x = 0; x < 512; x += 32) g.fillRect(x, 6, 16, 4);
  for (let x = 16; x < 512; x += 32) g.fillRect(x, 86, 16, 4);
  const t = srgb(new CanvasTexture(c));
  t.wrapS = RepeatWrapping;
  t.repeat.set(0.5, 1);
  return t;
}

/** A can's label: a band of colour with a stripe and a logo dot. */
export function canLabelTexture(main: string, accent: string): CanvasTexture {
  const [c, g] = canvas(128, 64);
  g.fillStyle = main;
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = accent;
  g.fillRect(0, 26, 128, 10);
  g.beginPath();
  g.arc(40, 18, 9, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(0, 4, 128, 3);
  return srgb(new CanvasTexture(c));
}

/** Locker doors for the corridor walls (one door per world unit when repeated). */
export function lockerTexture(): CanvasTexture {
  const [c, g] = canvas(128, 256);
  g.fillStyle = '#26314a';
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = '#2d3a57';
  g.fillRect(6, 6, 116, 244);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = 22; y < 70; y += 9) g.fillRect(24, y, 80, 4);
  g.fillStyle = '#9fb0d0';
  g.fillRect(96, 130, 10, 26);
  g.fillStyle = 'rgba(255,255,255,0.06)';
  g.fillRect(6, 6, 12, 244);
  const t = srgb(new CanvasTexture(c));
  t.wrapS = RepeatWrapping;
  return t;
}
