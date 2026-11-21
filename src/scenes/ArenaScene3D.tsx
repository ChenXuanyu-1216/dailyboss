import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { BufferGeometry, Float32BufferAttribute, MathUtils, type PerspectiveCamera } from 'three';
import {
  ARENA_RULES,
  type ArenaFightDefinition,
  type ArenaState,
  type Hazard,
  type Shape,
  type Vec,
} from '../game/arena';
import { SceneCanvas } from './SceneCanvas';

/**
 * The open-arena fight in 3D: the same state the top-down view draws (src/ui/arenaDraw.ts), seen
 * from a fixed oblique camera that follows the player. A pure function of the simulation state
 * plus camera easing; no rules here. With reduced motion the camera holds still over the whole
 * floor instead of following.
 *
 * Everything sits in one group rotated so that its local (x, y) is the simulation's floor
 * (x across, y away from the camera) and local z is up.
 */

export interface ArenaScene3DProps {
  def: ArenaFightDefinition;
  state: ArenaState;
  reducedMotion: boolean;
  onContextLost: () => void;
}

const C = {
  floor: '#1b2130',
  wall: '#2b3346',
  grid: '#3a4256',
  warn: '#f5a524',
  strike: '#e5484d',
  soda: '#3fb8af',
  cabinet: '#c43c3f',
  cabinetDark: '#5a1d1f',
  glass: '#7cc3f0',
  weak: '#ffd23f',
  socket: '#59617a',
  player: '#5ee0a0',
  playerDark: '#0f3d2a',
  back: '#ff6369',
} as const;

/** Camera pitch above the floor. */
const ELEVATION = MathUtils.degToRad(56);
/** How much of the floor a following camera keeps in view (world units), before fitting the aspect. */
const FOLLOW_VIEW = { w: 11, d: 7.5 };
const CABINET_HEIGHT = 2.4;

function Arena({ def, state, reducedMotion }: Omit<ArenaScene3DProps, 'onContextLost'>) {
  const s = state;
  const t = s.t;
  const { halfW, halfH } = def.floor;
  const r = def.bossRadius;
  const depth = r * 1.1;
  const width = r * 1.7;
  const motion = !reducedMotion;

  const latest = useRef(s);
  latest.current = s;
  const focus = useRef<Vec | null>(null);
  const { camera, size, invalidate } = useThree();

  // On-demand rendering (reduced motion) still needs a frame per state change.
  useEffect(() => {
    invalidate();
  }, [s, size.width, size.height, invalidate]);

  useLayoutEffect(() => {
    const cam = camera as PerspectiveCamera;
    cam.fov = 34;
    cam.far = 80;
    cam.updateProjectionMatrix();
  }, [camera]);

  useFrame((_, delta) => {
    const cam = camera as PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const tanHalf = Math.tan(MathUtils.degToRad(cam.fov) / 2);
    const follow = motion;
    const viewW = follow ? Math.min(2 * halfW, FOLLOW_VIEW.w) : 2 * halfW + 1.2;
    const viewD = follow ? Math.min(2 * halfH, FOLLOW_VIEW.d) : 2 * halfH + 1.2;
    const d = Math.min(
      40,
      Math.max(viewW / (2 * tanHalf * aspect), (viewD * Math.sin(ELEVATION)) / (2 * tanHalf) + 1.5),
    );
    const p = latest.current.pos;
    const limitX = Math.max(0, halfW - viewW / 2);
    const limitY = Math.max(0, halfH - viewD / 2);
    const want = follow
      ? { x: MathUtils.clamp(p.x, -limitX, limitX), y: MathUtils.clamp(p.y, -limitY, limitY) }
      : { x: 0, y: 0 };
    const f = focus.current ?? want;
    const k = Math.min(delta, 0.1);
    focus.current = follow
      ? { x: MathUtils.damp(f.x, want.x, 5, k), y: MathUtils.damp(f.y, want.y, 5, k) }
      : want;
    const fx = focus.current.x;
    const fz = -focus.current.y;
    cam.position.set(fx, d * Math.sin(ELEVATION), fz + d * Math.cos(ELEVATION));
    cam.lookAt(fx, 0, fz);
  });

  const grid = useMemo(() => {
    const pts: number[] = [];
    for (let x = Math.ceil(-halfW); x <= halfW; x++) pts.push(x, -halfH, 0.004, x, halfH, 0.004);
    for (let y = Math.ceil(-halfH); y <= halfH; y++) pts.push(-halfW, y, 0.004, halfW, y, 0.004);
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pts, 3));
    return g;
  }, [halfW, halfH]);
  useEffect(() => () => grid.dispose(), [grid]);

  const pulse = (period: number) => (motion ? 0.5 + 0.5 * Math.sin(t / period) : 1);
  const invulnerable = t < s.invulnerableUntil && s.hits > 0;
  const blink = invulnerable && motion && Math.floor(t / 90) % 2 === 0;
  const dashing = s.dashFrom !== null && t < s.dashFrom + ARENA_RULES.dashMs;
  const bracing = t < s.braceUntil;
  const live = s.charge?.socket ?? null;
  const half = MathUtils.degToRad(def.armorDeg);

  return (
    <>
      <ambientLight intensity={0.75} />
      <hemisphereLight args={['#dfe8ff', '#20242e', 0.5]} />
      <directionalLight position={[4, 9, 6]} intensity={1.5} />

      <group rotation-x={-Math.PI / 2}>
        {/* floor, grid and low walls */}
        <mesh>
          <planeGeometry args={[2 * halfW, 2 * halfH]} />
          <meshStandardMaterial color={C.floor} roughness={0.95} />
        </mesh>
        <lineSegments geometry={grid}>
          <lineBasicMaterial color={C.grid} transparent opacity={0.5} />
        </lineSegments>
        {[
          [0, halfH + 0.1, 2 * halfW + 0.4, 0.2],
          [0, -halfH - 0.1, 2 * halfW + 0.4, 0.2],
          [halfW + 0.1, 0, 0.2, 2 * halfH],
          [-halfW - 0.1, 0, 0.2, 2 * halfH],
        ].map(([x, y, w, h], i) => (
          <mesh key={i} position={[x!, y!, 0.15]}>
            <boxGeometry args={[w!, h!, 0.3]} />
            <meshStandardMaterial color={C.wall} roughness={0.8} />
          </mesh>
        ))}

        {/* sockets; the live one glows, with a cable to the boss and a reach ring */}
        {def.sockets.map((sock, i) => {
          const isLive = live !== null && live.x === sock.x && live.y === sock.y;
          return (
            <group key={i} position={[sock.x, sock.y, 0]}>
              <mesh position={[0, 0, 0.08]}>
                <boxGeometry args={[0.44, 0.44, 0.16]} />
                <meshStandardMaterial
                  color={isLive ? C.weak : C.socket}
                  emissive={isLive ? C.weak : '#000000'}
                  emissiveIntensity={isLive ? 0.6 + pulse(120) : 0}
                />
              </mesh>
              {isLive && (
                <mesh position={[0, 0, 0.012]}>
                  <circleGeometry args={[ARENA_RULES.plugReach, 40]} />
                  <meshBasicMaterial color={C.weak} transparent opacity={0.15 + 0.2 * pulse(120)} depthWrite={false} />
                </mesh>
              )}
            </group>
          );
        })}
        {live && <Cable from={s.boss} to={live} />}

        {/* warnings and strikes */}
        {s.hazards.map((h) => (
          <HazardMesh key={h.id} h={h} t={t} />
        ))}

        {/* the boss */}
        {s.down ? (
          <>
            <group position={[s.boss.x, s.boss.y, 0]} rotation-z={s.bossFacing}>
              <mesh position={[0, 0, depth / 2]}>
                <boxGeometry args={[r * 3, width, depth]} />
                <meshStandardMaterial color={s.down.cause === 'unplug' ? C.cabinetDark : C.cabinet} roughness={0.6} />
              </mesh>
            </group>
            <group position={[s.down.weak.x, s.down.weak.y, 0]}>
              <mesh position={[0, 0, 0.014]}>
                <circleGeometry args={[ARENA_RULES.weakReach, 40]} />
                <meshBasicMaterial color={C.weak} transparent opacity={0.2 + 0.25 * pulse(90)} depthWrite={false} />
              </mesh>
              <mesh position={[0, 0, depth + 0.3]} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[0.18, 0.18, 0.5, 16]} />
                <meshStandardMaterial color={C.weak} emissive={C.weak} emissiveIntensity={0.8 + pulse(90)} />
              </mesh>
            </group>
          </>
        ) : (
          <group position={[s.boss.x, s.boss.y, 0]} rotation-z={s.bossFacing}>
            {/* the armoured front, marked on the floor */}
            <mesh position={[0, 0, 0.016]}>
              <ringGeometry args={[r * 1.02, r * 1.22, 32, 1, -half, 2 * half]} />
              <meshBasicMaterial color={C.glass} transparent opacity={0.55} depthWrite={false} />
            </mesh>
            <mesh position={[0, 0, CABINET_HEIGHT / 2]}>
              <boxGeometry args={[depth, width, CABINET_HEIGHT]} />
              <meshStandardMaterial
                color={C.cabinet}
                roughness={0.55}
                emissive={C.glass}
                emissiveIntensity={bracing ? 0.25 : 0}
              />
            </mesh>
            {/* glass front with cans behind it */}
            <mesh position={[depth / 2 + 0.012, -width * 0.12, CABINET_HEIGHT * 0.55]}>
              <boxGeometry args={[0.02, width * 0.62, CABINET_HEIGHT * 0.6]} />
              <meshStandardMaterial color={C.glass} emissive={C.glass} emissiveIntensity={0.35} transparent opacity={0.85} />
            </mesh>
            {/* eyes on the side panel */}
            {[-1, 1].map((side) => (
              <mesh key={side} position={[depth / 2 + 0.02, width * 0.33 + side * 0.09, CABINET_HEIGHT * 0.78]}>
                <boxGeometry args={[0.02, 0.12, 0.05]} />
                <meshStandardMaterial color="#1a0f0f" emissive="#ff3b3b" emissiveIntensity={2} />
              </mesh>
            ))}
            {/* its back, where hits land */}
            <mesh position={[-depth / 2 - 0.012, 0, CABINET_HEIGHT * 0.5]}>
              <boxGeometry args={[0.02, width * 0.4, 0.4]} />
              <meshBasicMaterial color={C.back} />
            </mesh>
          </group>
        )}

        {/* the player */}
        <group position={[s.pos.x, s.pos.y, 0]} rotation-z={s.facing}>
          <mesh position={[0, 0, 0.012]}>
            <circleGeometry args={[ARENA_RULES.playerRadius, 24]} />
            <meshBasicMaterial color={C.player} transparent opacity={0.35} depthWrite={false} />
          </mesh>
          {dashing && (
            <mesh position={[-0.6, 0, 0.5]}>
              <planeGeometry args={[1.2, 0.5]} />
              <meshBasicMaterial color={C.player} transparent opacity={0.25} depthWrite={false} />
            </mesh>
          )}
          <group visible={!blink}>
            <mesh position={[0, 0, 0.55]} rotation-x={Math.PI / 2}>
              <capsuleGeometry args={[0.28, 0.45, 4, 12]} />
              <meshStandardMaterial color={C.player} roughness={0.5} />
            </mesh>
            <mesh position={[0.27, 0, 0.75]}>
              <boxGeometry args={[0.16, 0.12, 0.1]} />
              <meshStandardMaterial color={C.playerDark} />
            </mesh>
          </group>
        </group>
      </group>
    </>
  );
}

function Cable({ from, to }: { from: Vec; to: Vec }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  return (
    <mesh position={[(from.x + to.x) / 2, (from.y + to.y) / 2, 0.04]} rotation-z={Math.atan2(dy, dx)}>
      <boxGeometry args={[len, 0.07, 0.06]} />
      <meshStandardMaterial color={C.weak} emissive={C.weak} emissiveIntensity={0.5} />
    </mesh>
  );
}

function HazardMesh({ h, t }: { h: Hazard; t: number }) {
  const active = t >= h.activeAt;
  const soda = h.kind === 'soda';
  const progress = active ? 1 : MathUtils.clamp((t - h.warnAt) / Math.max(1, h.activeAt - h.warnAt), 0, 1);
  if (active) {
    return <ShapeMesh shape={h.shape} k={1} z={0.02} color={soda ? C.soda : C.strike} opacity={0.62} />;
  }
  return (
    <>
      <ShapeMesh shape={h.shape} k={1} z={0.018} color={C.warn} opacity={0.18} />
      <ShapeMesh shape={h.shape} k={progress} z={0.02} color={C.warn} opacity={0.38} />
    </>
  );
}

/** A flat decal of the hazard's shape, grown to `k` of its size from its origin. */
function ShapeMesh({ shape, k, z, color, opacity }: { shape: Shape; k: number; z: number; color: string; opacity: number }) {
  const material = <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />;
  const scale = Math.max(0.001, k);
  switch (shape.type) {
    case 'circle':
      return (
        <mesh position={[shape.c.x, shape.c.y, z]} scale={[scale, scale, 1]}>
          <circleGeometry args={[shape.r, 48]} />
          {material}
        </mesh>
      );
    case 'cone':
      return (
        <mesh position={[shape.o.x, shape.o.y, z]} scale={[scale, scale, 1]}>
          <circleGeometry args={[shape.range, 32, shape.dir - shape.half, 2 * shape.half]} />
          {material}
        </mesh>
      );
    case 'strip':
      return (
        <group position={[shape.o.x, shape.o.y, z]} rotation-z={shape.dir}>
          <mesh position={[(shape.length * scale) / 2, 0, 0]} scale={[scale, 1, 1]}>
            <planeGeometry args={[shape.length, shape.width]} />
            {material}
          </mesh>
        </group>
      );
  }
}

export default function ArenaScene3D({ onContextLost, ...props }: ArenaScene3DProps) {
  return (
    <SceneCanvas reducedMotion={props.reducedMotion} onContextLost={onContextLost}>
      <Arena {...props} />
    </SceneCanvas>
  );
}
