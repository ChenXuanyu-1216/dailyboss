import { memo } from 'react';
import type { Intensity, Outcome } from '../game/contracts';

/**
 * The room the game is played in: a desk late at night, drawn as one inline SVG behind the game
 * window. Decorative only (aria-hidden) and static (see src/styles/backdrop.css for why). Its
 * lighting follows the game: calm night, amber when things go wrong, alarm-red in the boss fight,
 * dawn after a win, and grey after a loss. Moods are pure CSS, so restyling needs no code.
 */

export type BackdropMood = 'night' | 'warning' | 'critical' | 'dawn' | 'failure';

export function backdropMood(intensity: Intensity, outcome: Outcome | null): BackdropMood {
  if (outcome === 'perfect' || outcome === 'normal') return 'dawn';
  if (outcome === 'failure') return 'failure';
  return intensity === 'critical' ? 'critical' : intensity === 'warning' ? 'warning' : 'night';
}

/** Deterministic pseudo-random numbers, so the skyline is the same on every load. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

interface Building {
  x: number;
  w: number;
  h: number;
  lit: { x: number; y: number }[];
}

/** The city outside the window (window glass spans x 70–530, y 100–560 in the viewBox). */
const SKYLINE: readonly Building[] = (() => {
  const r = seeded(7);
  const out: Building[] = [];
  let x = 60;
  while (x < 540) {
    const w = 34 + Math.floor(r() * 46);
    const h = 120 + Math.floor(r() * 260);
    const lit: { x: number; y: number }[] = [];
    for (let wy = 560 - h + 14; wy < 548; wy += 16) {
      for (let wx = x + 6; wx < x + w - 8; wx += 11) if (r() < 0.22) lit.push({ x: wx, y: wy });
    }
    out.push({ x, w, h, lit });
    x += w + 4 + Math.floor(r() * 8);
  }
  return out;
})();

/** Clock hands at 23:47. */
const HOUR_DEG = (11 + 47 / 60) * 30;
const MINUTE_DEG = 47 * 6;

export const Backdrop = memo(function Backdrop({ mood }: { mood: BackdropMood }) {
  return (
    <div className="backdrop" data-mood={mood} aria-hidden="true">
      <svg className="backdrop__room" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="bd-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#151a29" />
            <stop offset="1" stopColor="#202538" />
          </linearGradient>
          <linearGradient id="bd-night" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#060b1d" />
            <stop offset="1" stopColor="#1b2b55" />
          </linearGradient>
          <linearGradient id="bd-dawn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b4f8f" />
            <stop offset="0.55" stopColor="#e98a6a" />
            <stop offset="1" stopColor="#ffd28a" />
          </linearGradient>
          <linearGradient id="bd-desk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5a3d2b" />
            <stop offset="0.06" stopColor="#3f2a1d" />
            <stop offset="1" stopColor="#1e140d" />
          </linearGradient>
          <radialGradient id="bd-lamp" cx="0.5" cy="0" r="1">
            <stop offset="0" stopColor="#ffd58a" stopOpacity="0.55" />
            <stop offset="0.5" stopColor="#ffb85c" stopOpacity="0.14" />
            <stop offset="1" stopColor="#ffb85c" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bd-vignette" cx="0.5" cy="0.5" r="0.75">
            <stop offset="0.55" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.6" />
          </radialGradient>
        </defs>

        <rect width="1600" height="1000" fill="url(#bd-wall)" />
        {/* faint wallpaper stripes */}
        {Array.from({ length: 33 }, (_, i) => (
          <rect key={i} x={i * 50} y="0" width="1" height="780" fill="#ffffff" opacity="0.025" />
        ))}

        {/* window onto the city */}
        <g className="backdrop__window">
          <rect x="56" y="86" width="488" height="488" rx="6" fill="#0c0f18" />
          <rect x="70" y="100" width="460" height="460" fill="url(#bd-night)" />
          <rect className="backdrop__dawn" x="70" y="100" width="460" height="460" fill="url(#bd-dawn)" />
          <circle className="backdrop__moon" cx="440" cy="170" r="26" fill="#f4f0d8" />
          {SKYLINE.map((b) => (
            <g key={b.x}>
              <rect x={b.x} y={560 - b.h} width={b.w} height={b.h} fill="#090d1a" />
              {b.lit.map((w) => (
                <rect key={`${w.x}-${w.y}`} x={w.x} y={w.y} width="5" height="7" fill="#ffd27a" />
              ))}
            </g>
          ))}
          <rect x="296" y="100" width="8" height="460" fill="#0c0f18" />
          <rect x="70" y="326" width="460" height="8" fill="#0c0f18" />
          <rect x="44" y="566" width="512" height="16" rx="3" fill="#2a2f42" />
        </g>

        {/* wall clock: 23:47 */}
        <g transform="translate(1390 200)">
          <circle r="74" fill="#0e121e" />
          <circle r="66" fill="#f1ede2" />
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x="-2" y="-60" width="4" height={i % 3 === 0 ? 12 : 7} fill="#2a2a2e" transform={`rotate(${i * 30})`} />
          ))}
          <rect x="-4" y="-34" width="8" height="40" rx="4" fill="#1d1d1f" transform={`rotate(${HOUR_DEG})`} />
          <rect x="-3" y="-52" width="6" height="58" rx="3" fill="#1d1d1f" transform={`rotate(${MINUTE_DEG})`} />
          <rect x="-1" y="-58" width="2" height="58" fill="#d23a3a" transform="rotate(24)" />
          <circle r="5" fill="#d23a3a" />
        </g>

        {/* calendar with the deadline circled */}
        <g transform="translate(1290 330)">
          <rect width="200" height="220" rx="6" fill="#efe9dc" />
          <rect width="200" height="48" rx="6" fill="#c62a2f" />
          <rect y="40" width="200" height="8" fill="#c62a2f" />
          {Array.from({ length: 20 }, (_, i) => (
            <rect key={i} x={16 + (i % 5) * 36} y={66 + Math.floor(i / 5) * 36} width="22" height="18" rx="2" fill="#d6cfc0" />
          ))}
          <ellipse className="backdrop__deadline" cx="135" cy="147" rx="24" ry="20" fill="none" stroke="#e5484d" strokeWidth="4" />
        </g>

        {/* desk */}
        <rect x="0" y="790" width="1600" height="210" fill="url(#bd-desk)" />
        <rect x="0" y="790" width="1600" height="3" fill="#8a6447" opacity="0.6" />

        {/* desk lamp and its pool of light */}
        <ellipse className="backdrop__lamp-light" cx="260" cy="800" rx="420" ry="240" fill="url(#bd-lamp)" />
        <g transform="translate(150 640)">
          <rect x="70" y="140" width="90" height="14" rx="6" fill="#262a36" />
          <rect x="108" y="40" width="10" height="104" fill="#262a36" transform="rotate(-12 113 140)" />
          <path d="M60 30 L170 10 L150 60 L80 70 Z" fill="#2f3446" />
          <ellipse className="backdrop__bulb" cx="118" cy="62" rx="34" ry="8" fill="#ffe2a4" />
        </g>

        {/* paper stack */}
        <g transform="translate(470 742)">
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={i * 3 - 4} y={-i * 6 + 30} width="120" height="18" rx="2" fill={i === 3 ? '#fbfbf8' : '#e2ddd2'} transform={`rotate(${i * 2 - 3})`} />
          ))}
        </g>

        {/* sticky notes on the desk edge */}
        <rect x="1140" y="770" width="54" height="50" fill="#ffd23f" transform="rotate(-6 1167 795)" />
        <rect x="1180" y="776" width="54" height="50" fill="#ff8fc4" transform="rotate(5 1207 801)" />

        {/* coffee, gone cold-ish */}
        <g transform="translate(1360 720)">
          <path className="backdrop__steam" d="M18 -10 C 8 -30, 30 -40, 18 -62" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
          <path className="backdrop__steam backdrop__steam--late" d="M40 -14 C 30 -34, 52 -44, 40 -66" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
          <rect x="0" y="0" width="60" height="74" rx="8" fill="#e8e3d6" />
          <path d="M60 18 C 84 18, 84 54, 60 54" fill="none" stroke="#e8e3d6" strokeWidth="9" />
          <rect x="0" y="0" width="60" height="10" rx="5" fill="#3a2414" />
        </g>

        <rect width="1600" height="1000" fill="url(#bd-vignette)" />
      </svg>
      {/* mood lighting over the whole room */}
      <div className="backdrop__light" />
    </div>
  );
});
