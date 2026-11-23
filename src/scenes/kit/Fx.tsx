import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedMesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  PlaneGeometry,
  RingGeometry,
  type BufferGeometry,
  type Material,
  type Mesh,
} from 'three';
import type { Quality } from './VendingMachine';

/**
 * Pooled particles and shockwave rings for the 3D arena (presentation only). Everything is
 * preallocated: instanced meshes for sparks, puffs, droplets, coins and confetti, and a handful of
 * ring meshes. `apiRef` receives the spawn functions. Positions are Three.js world coordinates
 * (y up). With quality `off` (reduced motion) nothing spawns; `lite` halves the counts.
 */

export type ParticleKind = 'spark' | 'puff' | 'drop' | 'coin' | 'confetti';

export interface BurstOptions {
  count: number;
  /** Base colour (confetti picks from a palette instead). */
  color?: string;
  /** Initial speed range. */
  speed: [number, number];
  /** Extra upward speed. */
  up?: number;
  /** Direction in the floor plane (radians, Three.js: atan2(-z, x)); omit for all around. */
  dir?: number;
  /** Half-angle around `dir`. */
  spread?: number;
  life: [number, number];
  size: [number, number];
  gravity?: number;
  /** Random offset of the start points. */
  jitter?: number;
}

export interface RingOptions {
  color: string;
  from: number;
  to: number;
  life: number;
  y?: number;
  opacity?: number;
}

export interface FxApi {
  burst(kind: ParticleKind, at: [number, number, number], o: BurstOptions): void;
  ring(at: [number, number, number], o: RingOptions): void;
}

interface Particle {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  spin: number;
  rx: number;
  ry: number;
  gravity: number;
}

interface Pool {
  mesh: InstancedMesh;
  items: Particle[];
  next: number;
}

const CAP: Record<ParticleKind, number> = { spark: 180, puff: 70, drop: 110, coin: 80, confetti: 110 };
const CONFETTI = ['#ff5d73', '#ffd23f', '#5ee0a0', '#7cc3f0', '#c084fc', '#ff8a3d'];
const RINGS = 12;

function makeParticle(): Particle {
  return { alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, size: 0.1, spin: 0, rx: 0, ry: 0, gravity: 0 };
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function Fx({ apiRef, quality }: { apiRef: MutableRefObject<FxApi | null>; quality: Quality }) {
  const resources = useMemo(() => {
    const geos: Record<ParticleKind, BufferGeometry> = {
      spark: new OctahedronGeometry(1, 0),
      puff: new IcosahedronGeometry(1, 1),
      drop: new IcosahedronGeometry(1, 0),
      coin: new CylinderGeometry(1, 1, 0.22, 16),
      confetti: new PlaneGeometry(1, 0.55),
    };
    const mats: Record<ParticleKind, Material> = {
      spark: new MeshBasicMaterial({ blending: AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }),
      puff: new MeshStandardMaterial({ roughness: 1, transparent: true, opacity: 0.3, depthWrite: false }),
      drop: new MeshBasicMaterial({ blending: AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }),
      coin: new MeshPhysicalMaterial({ color: '#ffcf4a', metalness: 1, roughness: 0.22, clearcoat: 0.6 }),
      confetti: new MeshBasicMaterial({ side: DoubleSide }),
    };
    const pools = {} as Record<ParticleKind, Pool>;
    const white = new Color('#ffffff');
    const hidden = new Object3D();
    hidden.scale.setScalar(0);
    hidden.updateMatrix();
    for (const kind of Object.keys(CAP) as ParticleKind[]) {
      const mesh = new InstancedMesh(geos[kind], mats[kind], CAP[kind]);
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = false;
      for (let i = 0; i < CAP[kind]; i++) {
        mesh.setColorAt(i, white);
        mesh.setMatrixAt(i, hidden.matrix);
      }
      mesh.count = CAP[kind];
      pools[kind] = { mesh, items: Array.from({ length: CAP[kind] }, makeParticle), next: 0 };
    }
    const ringGeo = new RingGeometry(0.86, 1, 64);
    const rings = Array.from({ length: RINGS }, () => ({
      mat: new MeshBasicMaterial({
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        side: DoubleSide,
      }),
      alive: false,
      age: 0,
      life: 1,
      from: 0,
      to: 1,
      opacity: 1,
    }));
    return { geos, mats, pools, ringGeo, rings };
  }, []);

  useEffect(
    () => () => {
      Object.values(resources.geos).forEach((g) => g.dispose());
      Object.values(resources.mats).forEach((m) => m.dispose());
      Object.values(resources.pools).forEach((p) => p.mesh.dispose());
      resources.ringGeo.dispose();
      resources.rings.forEach((r) => r.mat.dispose());
    },
    [resources],
  );

  const ringMeshes = useRef<(Mesh | null)[]>([]);
  const ringNext = useRef(0);
  const dummy = useMemo(() => new Object3D(), []);
  const tmp = useMemo(() => new Color(), []);
  const scale = quality === 'off' ? 0 : quality === 'lite' ? 0.5 : 1;

  useEffect(() => {
    apiRef.current = {
      burst(kind, at, o) {
        const n = Math.round(o.count * scale);
        const pool = resources.pools[kind];
        for (let i = 0; i < n; i++) {
          const idx = pool.next;
          pool.next = (pool.next + 1) % pool.items.length;
          const p = pool.items[idx]!;
          const a = o.dir === undefined ? Math.random() * Math.PI * 2 : o.dir + rand(-1, 1) * (o.spread ?? 0.4);
          const sp = rand(o.speed[0], o.speed[1]);
          const j = o.jitter ?? 0;
          p.alive = true;
          p.x = at[0] + rand(-j, j);
          p.y = at[1] + rand(0, j * 0.5);
          p.z = at[2] + rand(-j, j);
          p.vx = Math.cos(a) * sp;
          p.vz = -Math.sin(a) * sp;
          p.vy = (o.up ?? 0) * rand(0.6, 1.2);
          p.age = 0;
          p.life = rand(o.life[0], o.life[1]);
          p.size = rand(o.size[0], o.size[1]);
          p.spin = rand(-14, 14);
          p.rx = Math.random() * 6;
          p.ry = Math.random() * 6;
          p.gravity = o.gravity ?? 9;
          tmp.set(kind === 'confetti' ? CONFETTI[idx % CONFETTI.length]! : (o.color ?? '#ffffff'));
          pool.mesh.setColorAt(idx, tmp);
          if (pool.mesh.instanceColor) pool.mesh.instanceColor.needsUpdate = true;
        }
      },
      ring(at, o) {
        if (scale === 0) return;
        const i = ringNext.current;
        ringNext.current = (i + 1) % RINGS;
        const r = resources.rings[i]!;
        const mesh = ringMeshes.current[i];
        r.alive = true;
        r.age = 0;
        r.life = o.life;
        r.from = o.from;
        r.to = o.to;
        r.opacity = o.opacity ?? 0.9;
        r.mat.color.set(o.color);
        if (mesh) mesh.position.set(at[0], o.y ?? 0.06, at[2]);
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, resources, scale, tmp]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    for (const kind of Object.keys(resources.pools) as ParticleKind[]) {
      const pool = resources.pools[kind];
      let dirty = false;
      for (let i = 0; i < pool.items.length; i++) {
        const p = pool.items[i]!;
        if (!p.alive) continue;
        dirty = true;
        p.age += dt;
        if (p.age >= p.life) {
          p.alive = false;
          dummy.scale.setScalar(0);
          dummy.updateMatrix();
          pool.mesh.setMatrixAt(i, dummy.matrix);
          continue;
        }
        const drag = kind === 'puff' ? 3 : kind === 'confetti' ? 2.2 : 0.4;
        p.vx -= p.vx * drag * dt;
        p.vz -= p.vz * drag * dt;
        p.vy -= p.gravity * dt * (kind === 'confetti' ? 0.25 : 1);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.y < 0.03 && (kind === 'coin' || kind === 'drop' || kind === 'confetti')) {
          p.y = 0.03;
          p.vy = Math.abs(p.vy) * (kind === 'coin' ? 0.35 : 0);
          p.vx *= 0.55;
          p.vz *= 0.55;
          p.spin *= 0.5;
        }
        const k = p.age / p.life;
        let s = p.size;
        if (kind === 'spark' || kind === 'drop') s *= 1 - k;
        else if (kind === 'puff') s *= 0.6 + k * 0.9 * (1 - k * 0.6);
        else if (k > 0.8) s *= (1 - k) / 0.2;
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(p.rx + p.spin * p.age, p.ry + p.spin * 0.6 * p.age, 0);
        if (kind === 'spark') dummy.scale.set(s * 0.45, s * 1.6, s * 0.45);
        else if (kind === 'coin') dummy.scale.set(s, s, s);
        else dummy.scale.setScalar(s);
        dummy.updateMatrix();
        pool.mesh.setMatrixAt(i, dummy.matrix);
      }
      if (dirty) pool.mesh.instanceMatrix.needsUpdate = true;
    }
    resources.rings.forEach((r, i) => {
      const mesh = ringMeshes.current[i];
      if (!mesh) return;
      if (!r.alive) {
        mesh.visible = false;
        return;
      }
      r.age += dt;
      const k = Math.min(1, r.age / r.life);
      if (k >= 1) {
        r.alive = false;
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      const rad = r.from + (r.to - r.from) * (1 - (1 - k) * (1 - k));
      mesh.scale.setScalar(Math.max(0.001, rad));
      r.mat.opacity = r.opacity * (1 - k);
    });
  });

  return (
    <>
      {(Object.keys(resources.pools) as ParticleKind[]).map((kind) => (
        <primitive key={kind} object={resources.pools[kind].mesh} />
      ))}
      {resources.rings.map((r, i) => (
        <mesh
          key={i}
          ref={(m) => {
            ringMeshes.current[i] = m;
          }}
          geometry={resources.ringGeo}
          material={r.mat}
          rotation-x={-Math.PI / 2}
          visible={false}
        />
      ))}
    </>
  );
}
