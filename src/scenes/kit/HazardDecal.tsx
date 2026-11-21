import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { AdditiveBlending, Color, NormalBlending, ShaderMaterial, Vector2 } from 'three';
import type { Hazard } from '../../game/arena';

/**
 * A ground warning drawn by one small shader: the shape's outline glows, diagonal hazard stripes
 * scroll inside it, and a solid fill grows from its origin until the strike, when it flashes the
 * strike colour and fades. Circles, cones and strips share the material; the shape is evaluated as a
 * signed distance in its own floor coordinates, so edges stay crisp at any size.
 *
 * Lies on the floor inside the arena's floor group (local x, y = the simulation's floor; z up).
 */

const VERT = /* glsl */ `
uniform vec2 uOffset;
varying vec2 vLocal;
void main() {
  vLocal = position.xy + uOffset;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform int uType;
uniform float uR;
uniform float uHalf;
uniform float uLen;
uniform float uWidth;
uniform float uProgress;
uniform float uActive;
uniform float uTime;
uniform float uMotion;
uniform vec3 uWarn;
uniform vec3 uStrike;
uniform vec2 uOrigin;
uniform float uDir;
uniform vec2 uFloor;
varying vec2 vLocal;

// Signed distance to the shape (negative inside) and how far along it the point is (0 … 1).
vec2 shape(vec2 p) {
  if (uType == 0) {
    float d = length(p) - uR;
    return vec2(d, length(p) / uR);
  }
  if (uType == 1) {
    // A pie slice along +x (Inigo Quilez's sdPie, turned to face +x).
    vec2 q = vec2(abs(p.y), p.x);
    vec2 c = vec2(sin(uHalf), cos(uHalf));
    float l = length(q) - uR;
    float m = length(q - c * clamp(dot(q, c), 0.0, uR));
    float d = max(l, m * sign(c.y * q.x - c.x * q.y));
    return vec2(d, length(p) / uR);
  }
  // Strip from the origin along +x.
  vec2 c = vec2(uLen * 0.5, 0.0);
  vec2 h = vec2(uLen * 0.5, uWidth * 0.5);
  vec2 q = abs(p - c) - h;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  return vec2(d, p.x / uLen);
}

void main() {
  // Clip to the floor: the walls stop coins and soda alike.
  vec2 fp = uOrigin + mat2(cos(uDir), sin(uDir), -sin(uDir), cos(uDir)) * vLocal;
  if (abs(fp.x) > uFloor.x || abs(fp.y) > uFloor.y) discard;
  vec2 s = shape(vLocal);
  float d = s.x;
  float along = s.y;
  float aa = fwidth(d) * 1.5;
  float inside = 1.0 - smoothstep(-aa, aa, d);
  if (inside <= 0.0 && d > 0.12) discard;

  if (uActive > 0.0) {
    // Strike: a hot flash that cools to the strike colour.
    float flash = clamp(uActive, 0.0, 1.0);
    float rim = 1.0 - smoothstep(0.0, 0.18, abs(d));
    vec3 col = mix(uStrike, vec3(1.0), flash * 0.65);
    float alpha = inside * (0.5 + 0.35 * flash) + rim * 0.6;
    gl_FragColor = vec4(col * (1.0 + flash), clamp(alpha, 0.0, 1.0));
    return;
  }

  float rim = 1.0 - smoothstep(0.0, 0.07, abs(d));
  float glow = (1.0 - smoothstep(0.0, 0.12, abs(d))) * 0.45;
  float stripe = step(0.5, fract((vLocal.x + vLocal.y) * 1.6 - uTime * 0.9 * uMotion));
  float filled = step(along, uProgress) * inside;
  float edge = (1.0 - smoothstep(0.0, 0.05, abs(along - uProgress))) * inside;
  float urgency = smoothstep(0.55, 1.0, uProgress);
  float pulse = 1.0 + urgency * 0.5 * sin(uTime * 22.0) * uMotion;

  vec3 col = uWarn * pulse;
  float alpha = inside * (0.1 + stripe * 0.12) + filled * (0.22 + 0.2 * urgency) + edge * 0.6 + rim * 0.95 + glow;
  gl_FragColor = vec4(col * (1.0 + rim * 0.8 + edge), clamp(alpha, 0.0, 1.0));
}
`;

const TYPE = { circle: 0, cone: 1, strip: 2 } as const;
const WARN = new Color('#ffb020');
const STRIKE: Record<Hazard['kind'], string> = {
  coins: '#ffcf4a',
  soda: '#2fe0c8',
  hop: '#ff3b4f',
  rattle: '#ff3b4f',
  topple: '#ff3b4f',
};

export function HazardDecal({
  h,
  getT,
  motion,
  floor,
}: {
  h: Hazard;
  getT: () => number;
  motion: boolean;
  floor: { halfW: number; halfH: number };
}) {
  const material = useMemo(() => {
    const m = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      uniforms: {
        uType: { value: TYPE[h.shape.type] },
        uR: { value: h.shape.type === 'circle' ? h.shape.r : h.shape.type === 'cone' ? h.shape.range : 0 },
        uHalf: { value: h.shape.type === 'cone' ? h.shape.half : 0 },
        uLen: { value: h.shape.type === 'strip' ? h.shape.length : 0 },
        uWidth: { value: h.shape.type === 'strip' ? h.shape.width : 0 },
        uOffset: {
          value: new Vector2(
            h.shape.type === 'cone' ? (h.shape.range + 0.3) / 2 : h.shape.type === 'strip' ? h.shape.length / 2 : 0,
            0,
          ),
        },
        uOrigin: {
          value: new Vector2(
            h.shape.type === 'circle' ? h.shape.c.x : h.shape.o.x,
            h.shape.type === 'circle' ? h.shape.c.y : h.shape.o.y,
          ),
        },
        uDir: { value: h.shape.type === 'circle' ? 0 : h.shape.dir },
        uFloor: { value: new Vector2(floor.halfW, floor.halfH) },
        uProgress: { value: 0 },
        uActive: { value: 0 },
        uTime: { value: 0 },
        uMotion: { value: motion ? 1 : 0 },
        uWarn: { value: WARN.clone() },
        uStrike: { value: new Color(STRIKE[h.kind]) },
      },
    });
    m.toneMapped = false;
    return m;
  }, [h, motion, floor.halfW, floor.halfH]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }) => {
    const t = getT();
    const u = material.uniforms;
    u.uTime!.value = clock.elapsedTime;
    u.uProgress!.value = Math.min(1, Math.max(0, (t - h.warnAt) / Math.max(1, h.activeAt - h.warnAt)));
    // 1 at the strike, fading over the active time (soda puddles keep a steady 0.25).
    const since = t - h.activeAt;
    if (since >= 0) {
      const span = Math.max(1, h.endAt - h.activeAt);
      u.uActive!.value = h.kind === 'soda' ? Math.max(0.25, 1 - since / 220) : Math.max(0.05, 1 - since / span);
    } else {
      u.uActive!.value = 0;
    }
    material.blending = since >= 0 && h.kind !== 'soda' ? AdditiveBlending : NormalBlending;
  });

  // A plane covering the shape's bounds, in shape-local coordinates.
  const s = h.shape;
  if (s.type === 'circle') {
    return (
      <mesh position={[s.c.x, s.c.y, 0.02]} material={material}>
        <planeGeometry args={[s.r * 2 + 0.3, s.r * 2 + 0.3]} />
      </mesh>
    );
  }
  if (s.type === 'cone') {
    const r = s.range + 0.3;
    return (
      <group position={[s.o.x, s.o.y, 0.021]} rotation-z={s.dir}>
        <mesh position={[r / 2, 0, 0]} material={material}>
          <planeGeometry args={[r, 2 * r * Math.sin(Math.min(Math.PI / 2, s.half)) + 0.3]} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[s.o.x, s.o.y, 0.022]} rotation-z={s.dir}>
      <mesh position={[s.length / 2, 0, 0]} material={material}>
        <planeGeometry args={[s.length + 0.3, s.width + 0.3]} />
      </mesh>
    </group>
  );
}
