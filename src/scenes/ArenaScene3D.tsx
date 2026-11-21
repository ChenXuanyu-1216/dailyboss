import { useFrame, useThree } from '@react-three/fiber';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import {
  AdditiveBlending,
  CanvasTexture,
  MathUtils,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Group,
  type Mesh,
  type PerspectiveCamera,
} from 'three';
import { ARENA_RULES, type ArenaFightDefinition, type ArenaState, type Vec } from '../game/arena';
import {
  FALL_MS,
  bodyCentre,
  machinePose,
  machineSize,
  newMachineMemo,
  studentPose,
  toWorld,
  turnToward,
  type ArenaFeedItem,
} from './arenaAnim';
import { Bloom } from './kit/Bloom';
import { Fx, type FxApi } from './kit/Fx';
import { HazardDecal } from './kit/HazardDecal';
import { Student } from './kit/Student';
import { blobShadowTexture, canLabelTexture, floorTexture, lockerTexture } from './kit/textures';
import { useStudioEnvironment } from './kit/useStudioEnvironment';
import { VendingMachine, newKicks, type Quality } from './kit/VendingMachine';
import { SceneCanvas } from './SceneCanvas';

/**
 * The open-arena fight in 3D: a neon school corridor at night, the vending machine boss and the
 * student, seen from a fixed oblique camera that follows the player (a still overview with reduced
 * motion). Everything is a function of the simulation state plus presentation-only reactions to its
 * events (particles, shockwaves, camera shake), fed frame by frame through `feed`. No rules here.
 *
 * Floor decals live in a group whose local (x, y) is the simulation's floor; the models live in
 * the y-up world, where a floor point (x, y) is (x, 0, −y).
 */

export interface ArenaScene3DProps {
  def: ArenaFightDefinition;
  state: ArenaState;
  /** Simulation steps since the last drawn frame (the scene drains it). */
  feed: MutableRefObject<ArenaFeedItem[]>;
  quality: Quality;
  reducedMotion: boolean;
  onContextLost: () => void;
}

const ELEVATION = MathUtils.degToRad(47);
const FOLLOW_VIEW = { w: 11, d: 7.5 };
/** Flight of the soda cans the machine lobs at each puddle, ending as the puddle strikes. */
const LOB_HEIGHT = 3.2;
const MAX_LOBS = 4;

interface Pending {
  at: number;
  run: () => void;
}

function Arena({ def, state, feed, quality }: Omit<ArenaScene3DProps, 'onContextLost' | 'reducedMotion'>) {
  const motion = quality !== 'off';
  const { halfW, halfH } = def.floor;
  const size = useMemo(() => machineSize(def), [def]);
  useStudioEnvironment(0.75);

  // Poses are computed as each new state renders, before any frame reads them.
  const latest = useRef(state);
  latest.current = state;
  const memo = useRef(newMachineMemo());
  const machine = useRef(machinePose(def, state, memo.current));
  machine.current = machinePose(def, state, memo.current);
  const student = useRef(studentPose(state, motion));
  student.current = studentPose(state, motion);
  const kicks = useRef(newKicks());
  const getT = useCallback(() => latest.current.t, []);

  const fx = useRef<FxApi | null>(null);
  const shake = useRef(0);
  const pending = useRef<Pending[]>([]);
  const lobs = useRef<{ id: number; from: Vec; to: Vec; warnAt: number; activeAt: number }[]>([]);
  const lobMeshes = useRef<(Mesh | null)[]>([]);
  const armor = useRef<Group>(null);
  const bossShadow = useRef<Mesh>(null);
  const playerShadow = useRef<Mesh>(null);
  const cable = useRef<Mesh>(null);
  const drink = useRef<Group>(null);
  const weakRing = useRef<Mesh>(null);
  const focus = useRef<Vec | null>(null);
  const eased = useRef({ armorYaw: NaN });

  const { camera, size: view, invalidate, clock } = useThree();

  useEffect(() => {
    invalidate();
  }, [state, view.width, view.height, invalidate]);

  useLayoutEffect(() => {
    const cam = camera as PerspectiveCamera;
    cam.fov = 34;
    cam.far = 90;
    cam.updateProjectionMatrix();
  }, [camera]);

  const tex = useMemo(
    () => ({
      floor: floorTexture(2 * halfW, 2 * halfH),
      lockers: lockerTexture(),
      blob: blobShadowTexture(),
      can: canLabelTexture('#ffd23f', '#a35c00'),
      soda: canLabelTexture('#2fe0c8', '#0d3b38'),
    }),
    [halfW, halfH],
  );
  const mat = useMemo(() => {
    tex.lockers.repeat.set(2 * halfW, 1);
    return {
      floor: new MeshStandardMaterial({ map: tex.floor, roughness: 0.3, metalness: 0.25, envMapIntensity: 0.55 }),
      lockers: new MeshStandardMaterial({ map: tex.lockers, roughness: 0.55, metalness: 0.35 }),
      wall: new MeshStandardMaterial({ color: '#1d2438', roughness: 0.6, metalness: 0.2 }),
      neonCyan: new MeshBasicMaterial({ color: '#36e2ff', toneMapped: false }),
      neonPink: new MeshBasicMaterial({ color: '#ff4fb8', toneMapped: false }),
      shadow: new MeshBasicMaterial({ color: '#000000', alphaMap: tex.blob, transparent: true, opacity: 0.55, depthWrite: false }),
      armor: new MeshBasicMaterial({ color: '#7fd8ff', transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
      socket: new MeshPhysicalMaterial({ color: '#8e97a8', roughness: 0.4, clearcoat: 0.6 }),
      socketLed: new MeshBasicMaterial({ color: '#2a3a33', toneMapped: false }),
      cable: new MeshBasicMaterial({ color: '#ffd23f', toneMapped: false }),
      weak: new MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.4, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
      drink: new MeshPhysicalMaterial({ map: tex.can, metalness: 0.6, roughness: 0.2, emissive: '#ffb800', emissiveIntensity: 1.2 }),
      soda: new MeshPhysicalMaterial({ map: tex.soda, metalness: 0.6, roughness: 0.25, clearcoat: 0.6 }),
    };
  }, [tex, halfW]);
  useEffect(
    () => () => {
      Object.values(tex).forEach((t: CanvasTexture) => t.dispose());
      Object.values(mat).forEach((m) => m.dispose());
    },
    [tex, mat],
  );

  // Effects for one simulation step.
  const react = useCallback(
    (before: ArenaState, after: ArenaState, events: ArenaFeedItem['events']) => {
      const api = fx.current;
      const now = clock.elapsedTime;
      const bump = (amount: number) => {
        if (motion) shake.current = Math.min(1, shake.current + amount);
      };
      const W = (v: Vec, h = 0) => toWorld(v, h);
      const r = def.bossRadius;

      for (const h of after.hazards) {
        if (h.id >= before.nextId && h.kind === 'soda' && lobs.current.length < MAX_LOBS && motion) {
          lobs.current.push({ id: h.id, from: { ...after.boss }, to: h.shape.type === 'circle' ? h.shape.c : after.boss, warnAt: h.warnAt, activeAt: h.activeAt });
        }
        if (!(before.t < h.activeAt && after.t >= h.activeAt) || !api) continue;
        const sh = h.shape;
        switch (h.kind) {
          case 'coins':
            if (sh.type === 'cone') {
              const o = W(sh.o, size.height * 0.55);
              api.burst('coin', o, { count: 16, speed: [5, sh.range * 1.3], up: 3.5, dir: sh.dir, spread: sh.half, life: [1, 1.6], size: [0.09, 0.12], gravity: 14, jitter: 0.2 });
              api.burst('spark', o, { count: 14, color: '#ffd76a', speed: [3, 7], up: 2, dir: sh.dir, spread: sh.half, life: [0.25, 0.45], size: [0.08, 0.14], gravity: 2 });
              bump(0.12);
            }
            break;
          case 'soda':
            if (sh.type === 'circle') {
              api.burst('drop', W(sh.c, 0.1), { count: 30, color: '#2fe0c8', speed: [1.5, 4.5], up: 5, life: [0.5, 0.95], size: [0.06, 0.11], gravity: 12 });
              api.ring(W(sh.c), { color: '#2fe0c8', from: 0.3, to: sh.r * 1.1, life: 0.5 });
              bump(0.08);
            }
            break;
          case 'hop':
            if (h.landAt) {
              api.ring(W(h.landAt), { color: '#ffffff', from: 0.6, to: sh.type === 'circle' ? sh.r * 1.4 : 2, life: 0.55, opacity: 0.8 });
              api.burst('puff', W(h.landAt, 0.15), { count: 18, color: '#a8b3cc', speed: [2.5, 4.5], up: 0.8, life: [0.5, 0.9], size: [0.14, 0.26], gravity: 0, jitter: r * 0.8 });
              kicks.current.land = now;
              bump(0.4);
            }
            break;
          case 'rattle':
            if (sh.type === 'circle') {
              api.ring(W(sh.c), { color: '#ff3b4f', from: r, to: sh.r * 1.05, life: 0.4 });
              api.burst('spark', W(sh.c, 1.2), { count: 22, color: '#ff8a5c', speed: [3, 6], up: 2, life: [0.25, 0.5], size: [0.08, 0.13], gravity: 6 });
              bump(0.28);
            }
            break;
          case 'topple':
            pending.current.push({
              at: h.activeAt + FALL_MS,
              run: () => {
                const c = bodyCentre(def, machine.current);
                api.burst('puff', W(c, 0.2), { count: 30, color: '#9aa3b8', speed: [2.5, 5.5], up: 1, life: [0.6, 1.1], size: [0.18, 0.32], gravity: 0, jitter: 1.4 });
                api.ring(W(c), { color: '#ffffff', from: 1, to: 4.5, life: 0.6, opacity: 0.7 });
                if (latest.current.down) {
                  api.burst('spark', W(latest.current.down.weak, 0.5), { count: 24, color: '#ffd23f', speed: [2, 5], up: 4, life: [0.4, 0.8], size: [0.08, 0.14], gravity: 9 });
                }
                bump(0.6);
              },
            });
            break;
        }
      }

      if (!api) return;
      const toward = Math.atan2(after.pos.y - after.boss.y, after.pos.x - after.boss.x);
      const contact = { x: after.boss.x + Math.cos(toward) * r, y: after.boss.y + Math.sin(toward) * r };
      kicks.current.look = Math.max(-1, Math.min(1, turnToward(after.bossFacing, toward) / 0.8));
      for (const e of events) {
        switch (e.type) {
          case 'hit':
            api.burst('spark', W(after.pos, 0.7), { count: 20, color: '#ff4d5e', speed: [2, 5], up: 2.5, life: [0.25, 0.5], size: [0.08, 0.14], gravity: 6 });
            api.ring(W(after.pos), { color: '#ff3b4f', from: 0.2, to: 1.3, life: 0.35 });
            bump(0.35);
            break;
          case 'damage': {
            const at = after.down && e.weak ? after.down.weak : contact;
            const big = e.weak;
            api.burst('spark', W(at, big ? 0.6 : 1.3), {
              count: big ? 36 : 16,
              color: big ? '#ffd23f' : '#fff3d6',
              speed: big ? [3, 7] : [2, 5],
              up: 3,
              dir: toward,
              spread: big ? Math.PI : 1.1,
              life: [0.25, 0.55],
              size: big ? [0.1, 0.18] : [0.07, 0.12],
              gravity: 7,
            });
            if (big) api.ring(W(at), { color: '#ffd23f', from: 0.3, to: 2.2, life: 0.45 });
            kicks.current.recoil = now;
            kicks.current.recoilFrom = toward;
            kicks.current.hurt = now;
            bump(big ? 0.3 : 0.12);
            break;
          }
          case 'clank':
            api.burst('spark', W(contact, 1.3), { count: 10, color: '#8fd3ff', speed: [2, 4], up: 1.5, dir: toward, spread: 1, life: [0.2, 0.4], size: [0.06, 0.1], gravity: 5 });
            kicks.current.clank = now;
            bump(0.06);
            break;
          case 'whiff': {
            const fist = { x: after.pos.x + Math.cos(after.facing) * 0.6, y: after.pos.y + Math.sin(after.facing) * 0.6 };
            api.burst('puff', W(fist, 0.6), { count: 4, color: '#d8deea', speed: [0.5, 1.2], life: [0.3, 0.5], size: [0.08, 0.14], gravity: 0 });
            break;
          }
          case 'dash':
            api.burst('puff', W(after.pos, 0.1), { count: 8, color: '#cfd6e4', speed: [0.8, 2], dir: after.dashDir + Math.PI, spread: 0.7, life: [0.35, 0.6], size: [0.12, 0.22], gravity: 0 });
            break;
          case 'down':
            if (e.cause === 'unplug' && before.charge) {
              const sock = before.charge.socket;
              api.burst('spark', W(sock, 0.3), { count: 30, color: '#ffe36a', speed: [2, 6], up: 4, life: [0.3, 0.7], size: [0.07, 0.13], gravity: 9 });
              api.ring(W(sock), { color: '#ffd23f', from: 0.2, to: 1.6, life: 0.4 });
              api.burst('spark', W(after.boss, size.height * 0.9), { count: 18, color: '#9fe8ff', speed: [1, 3], up: 2, life: [0.3, 0.6], size: [0.05, 0.09], gravity: 5, jitter: 0.5 });
              bump(0.2);
            }
            break;
          case 'interrupt':
            if (before.charge) {
              api.burst('spark', W(before.charge.socket, 0.3), { count: 20, color: '#ffe36a', speed: [2, 5], up: 3, life: [0.3, 0.6], size: [0.07, 0.12], gravity: 9 });
            }
            break;
          case 'heal':
            if (e.amount > 0) {
              api.burst('spark', W(after.boss, 0.4), { count: 26, color: '#5ee0a0', speed: [0.4, 1.2], up: 3, life: [0.8, 1.3], size: [0.08, 0.13], gravity: -1.5, jitter: r });
              api.ring(W(after.boss), { color: '#5ee0a0', from: r, to: r * 2.2, life: 0.6 });
            }
            break;
          case 'stage':
            api.ring(W(after.boss), { color: '#ff3b4f', from: r, to: 6, life: 0.8, opacity: 1 });
            api.burst('spark', W(after.boss, size.height), { count: 30, color: '#ff5d73', speed: [2, 6], up: 3, life: [0.4, 0.8], size: [0.08, 0.14], gravity: 6 });
            bump(0.45);
            break;
          case 'won':
            api.burst('confetti', W(after.boss, size.height + 0.3), { count: 100, speed: [1.5, 5], up: 7, life: [1.6, 2.6], size: [0.1, 0.16], gravity: 7, jitter: 0.6 });
            api.burst('coin', W(after.boss, size.height * 0.5), { count: 24, speed: [2, 5], up: 6, life: [1.4, 2], size: [0.09, 0.12], gravity: 12 });
            api.ring(W(after.boss), { color: '#ffd23f', from: r, to: 7, life: 1 });
            bump(0.5);
            break;
          default:
            break;
        }
      }
    },
    [clock, def, motion, size.height],
  );

  useFrame((_, delta) => {
    const s = latest.current;
    const t = s.t;
    const dt = Math.min(delta, 0.1);

    // Drain the simulation steps since the last frame.
    const items = feed.current;
    if (items.length > 0) {
      feed.current = [];
      for (const it of items) react(it.before, it.after, it.events);
    }
    if (pending.current.length > 0) {
      const due = pending.current.filter((p) => t >= p.at);
      if (due.length > 0) {
        pending.current = pending.current.filter((p) => t < p.at);
        due.forEach((p) => p.run());
      }
    }

    // Soda cans in flight, landing as their puddles strike.
    lobs.current = lobs.current.filter((l) => t < l.activeAt && s.hazards.some((h) => h.id === l.id));
    lobMeshes.current.forEach((m, i) => {
      if (!m) return;
      const l = lobs.current[i];
      m.visible = !!l;
      if (!l) return;
      const k = Math.min(1, Math.max(0, (t - l.warnAt) / Math.max(1, l.activeAt - l.warnAt)));
      const x = MathUtils.lerp(l.from.x, l.to.x, k);
      const y = MathUtils.lerp(l.from.y, l.to.y, k);
      m.position.set(x, size.height * (1 - k) + LOB_HEIGHT * Math.sin(Math.PI * k) + 0.15, -y);
      m.rotation.set(k * 14, k * 5, k * 9);
    });

    const pose = machine.current;
    // Armour arc: the machine's glass front, on the floor.
    if (armor.current) {
      const e = eased.current;
      if (Number.isNaN(e.armorYaw)) e.armorYaw = pose.yaw;
      e.armorYaw += turnToward(e.armorYaw, pose.yaw) * Math.min(1, dt * 14);
      armor.current.visible = pose.fall === 0 && !s.won;
      armor.current.position.set(pose.anchor.x, 0.03, -pose.anchor.y);
      armor.current.rotation.set(-Math.PI / 2, 0, e.armorYaw);
    }
    if (bossShadow.current) {
      const c = pose.fall > 0 ? bodyCentre(def, pose) : pose.anchor;
      bossShadow.current.position.set(c.x, 0.012, -c.y);
      // Local x runs along the facing: the depth standing, the height once it lies down.
      const k = 1 / (1 + pose.lift * 0.35);
      const along = MathUtils.lerp(size.depth * 1.5, size.height * 1.1, pose.fall);
      bossShadow.current.scale.set(k * along, k * size.width * 1.2, 1);
      bossShadow.current.rotation.set(-Math.PI / 2, 0, pose.yaw);
    }
    if (playerShadow.current) {
      playerShadow.current.position.set(s.pos.x, 0.013, -s.pos.y);
    }
    // Maintenance cable from the machine's back to the live socket.
    if (cable.current) {
      const sock = s.charge?.socket;
      cable.current.visible = !!sock;
      if (sock) {
        const back = { x: pose.anchor.x - Math.cos(pose.yaw) * size.depth * 0.5, y: pose.anchor.y - Math.sin(pose.yaw) * size.depth * 0.5 };
        const dx = sock.x - back.x;
        const dy = sock.y - back.y;
        cable.current.position.set((back.x + sock.x) / 2, 0.05, -(back.y + sock.y) / 2);
        cable.current.rotation.set(0, Math.atan2(dy, dx), 0);
        cable.current.scale.set(Math.hypot(dx, dy), 1, 1);
        mat.cable.color.setRGB(1, 0.82, 0.25).multiplyScalar(motion ? 0.7 + 0.5 * Math.sin(clock.elapsedTime * 10) : 1);
      }
    }
    // The exposed drink and its target ring.
    const down = s.down;
    if (drink.current && weakRing.current) {
      const show = !!down && pose.drinkOut > 0;
      drink.current.visible = show && down!.cause === 'topple';
      weakRing.current.visible = !!down;
      if (down) {
        const pulse = motion ? 0.5 + 0.5 * Math.sin(clock.elapsedTime * 9) : 1;
        weakRing.current.position.set(down.weak.x, 0.025, -down.weak.y);
        weakRing.current.scale.setScalar(ARENA_RULES.weakReach * (0.9 + 0.1 * pulse));
        mat.weak.opacity = 0.25 + 0.3 * pulse;
        const pop = Math.min(1, pose.drinkOut);
        drink.current.position.set(down.weak.x, 0.18 + 0.5 * Math.sin(Math.PI * pop) * (1 - pop) + (motion ? 0.05 * pulse : 0), -down.weak.y);
        drink.current.rotation.set(0, motion ? clock.elapsedTime * 2 : 0, Math.PI / 2);
        drink.current.scale.setScalar(0.4 + 0.6 * pop);
      }
    }
    // Socket LEDs: the live one blinks.
    const live = s.charge?.socket;
    mat.socketLed.color.set(live ? '#ffd23f' : '#29c46f').multiplyScalar(live && motion ? 0.6 + 0.6 * Math.sin(clock.elapsedTime * 12) : live ? 1 : 0.5);

    // Camera: follow the player within the floor, shake on impacts.
    const cam = camera as PerspectiveCamera;
    const aspect = view.width / Math.max(1, view.height);
    const tanHalf = Math.tan(MathUtils.degToRad(cam.fov) / 2);
    const follow = motion;
    const viewW = follow ? Math.min(2 * halfW, FOLLOW_VIEW.w) : 2 * halfW + 1.2;
    const viewD = follow ? Math.min(2 * halfH, FOLLOW_VIEW.d) : 2 * halfH + 1.2;
    const d = Math.min(42, Math.max(viewW / (2 * tanHalf * aspect), (viewD * Math.sin(ELEVATION)) / (2 * tanHalf) + 1.5));
    const limitX = Math.max(0, halfW - viewW / 2);
    const limitY = Math.max(0, halfH - viewD / 2);
    const want = follow ? { x: MathUtils.clamp(s.pos.x, -limitX, limitX), y: MathUtils.clamp(s.pos.y, -limitY, limitY) } : { x: 0, y: 0 };
    const f = focus.current ?? want;
    focus.current = follow ? { x: MathUtils.damp(f.x, want.x, 4.5, dt), y: MathUtils.damp(f.y, want.y, 4.5, dt) } : want;
    shake.current = motion ? shake.current * Math.exp(-dt * 6) : 0;
    const ct = clock.elapsedTime;
    const amp = shake.current * shake.current * 0.35;
    const sx = amp * Math.sin(ct * 53) + amp * 0.5 * Math.sin(ct * 31);
    const sy = amp * Math.cos(ct * 47);
    const fx0 = focus.current.x;
    const fz0 = -focus.current.y + 0.6;
    cam.position.set(fx0 + sx, d * Math.sin(ELEVATION) + sy, fz0 + d * Math.cos(ELEVATION));
    cam.lookAt(fx0 + sx * 0.5, 0.6, fz0);
  });

  const wallH = 2.4;
  const lobSlots = Array.from({ length: MAX_LOBS }, (_, i) => i);

  return (
    <>
      <color attach="background" args={['#0a0e1a']} />
      <fog attach="fog" args={['#0a0e1a', 20, 46]} />
      <ambientLight intensity={0.22} />
      <hemisphereLight args={['#9fb4ff', '#1a1020', 0.4]} />
      <directionalLight position={[-6, 12, 8]} intensity={1.7} color="#fff4e6" />
      <directionalLight position={[8, 6, -10]} intensity={0.55} color="#ff4fb8" />
      <directionalLight position={[-9, 5, -8]} intensity={0.6} color="#36e2ff" />

      {/* corridor: polished tiles, lockers behind, low barriers at the sides and front, neon trim */}
      <mesh rotation-x={-Math.PI / 2} material={mat.floor}>
        <planeGeometry args={[2 * halfW, 2 * halfH]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
        <planeGeometry args={[2 * halfW + 30, 2 * halfH + 30]} />
        <meshStandardMaterial color="#0b0f1a" roughness={0.9} />
      </mesh>
      <mesh position={[0, wallH / 2, -halfH - 0.25]} material={mat.lockers}>
        <boxGeometry args={[2 * halfW + 1, wallH, 0.5]} />
      </mesh>
      <mesh position={[0, wallH + 0.05, -halfH - 0.02]} material={mat.neonCyan}>
        <boxGeometry args={[2 * halfW + 1, 0.05, 0.05]} />
      </mesh>
      <mesh position={[0, 0.06, -halfH + 0.01]} material={mat.neonPink}>
        <boxGeometry args={[2 * halfW, 0.04, 0.04]} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * (halfW + 0.25), 0.3, 0]} material={mat.wall}>
            <boxGeometry args={[0.5, 0.6, 2 * halfH + 1]} />
          </mesh>
          <mesh position={[side * (halfW + 0.02), 0.62, 0]} material={side < 0 ? mat.neonCyan : mat.neonPink}>
            <boxGeometry args={[0.05, 0.04, 2 * halfH + 1]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.15, halfH + 0.25]} material={mat.wall}>
        <boxGeometry args={[2 * halfW + 1, 0.3, 0.5]} />
      </mesh>
      <mesh position={[0, 0.32, halfH + 0.02]} material={mat.neonCyan}>
        <boxGeometry args={[2 * halfW + 1, 0.04, 0.05]} />
      </mesh>

      {/* sockets: floor plates with a status LED */}
      {def.sockets.map((sock, i) => (
        <group key={i} position={[sock.x, 0, -sock.y]}>
          <mesh position={[0, 0.06, 0]} material={mat.socket}>
            <boxGeometry args={[0.5, 0.12, 0.5]} />
          </mesh>
          {[-0.08, 0.08].map((x) => (
            <mesh key={x} position={[x, 0.125, 0]} material={mat.wall}>
              <boxGeometry args={[0.04, 0.01, 0.12]} />
            </mesh>
          ))}
          <mesh position={[0.17, 0.13, 0.17]} material={mat.socketLed}>
            <sphereGeometry args={[0.04, 10, 8]} />
          </mesh>
        </group>
      ))}

      {/* warnings on the floor */}
      <group rotation-x={-Math.PI / 2}>
        {state.hazards.map((h) => (
          <HazardDecal key={h.id} h={h} getT={getT} motion={motion} floor={def.floor} />
        ))}
      </group>

      {/* soft contact shadows */}
      <mesh ref={bossShadow} material={mat.shadow}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh ref={playerShadow} rotation-x={-Math.PI / 2} material={mat.shadow}>
        <planeGeometry args={[0.9, 0.9]} />
      </mesh>

      {/* the armoured front, marked on the floor */}
      <group ref={armor}>
        <mesh material={mat.armor}>
          <ringGeometry args={[def.bossRadius * 1.05, def.bossRadius * 1.25, 40, 1, -MathUtils.degToRad(def.armorDeg), 2 * MathUtils.degToRad(def.armorDeg)]} />
        </mesh>
      </group>

      {/* maintenance cable */}
      <mesh ref={cable} visible={false} material={mat.cable}>
        <boxGeometry args={[1, 0.05, 0.05]} />
      </mesh>

      {/* the exposed drink and its target ring */}
      <mesh ref={weakRing} rotation-x={-Math.PI / 2} visible={false} material={mat.weak}>
        <ringGeometry args={[0.8, 1, 48]} />
      </mesh>
      <group ref={drink} visible={false}>
        <mesh material={mat.drink}>
          <cylinderGeometry args={[0.16, 0.16, 0.42, 20]} />
        </mesh>
      </group>

      {/* soda cans in flight */}
      {lobSlots.map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            lobMeshes.current[i] = m;
          }}
          visible={false}
          material={mat.soda}
        >
          <cylinderGeometry args={[0.13, 0.13, 0.34, 16]} />
        </mesh>
      ))}

      <VendingMachine size={size} poseRef={machine} kicksRef={kicks} quality={quality} placed />
      <Student poseRef={student} quality={quality} />
      <Fx apiRef={fx} quality={quality} />
      {quality === 'full' && <Bloom />}
    </>
  );
}

const ArenaMemo = memo(Arena);

export default function ArenaScene3D({ onContextLost, reducedMotion, ...props }: ArenaScene3DProps) {
  return (
    <SceneCanvas reducedMotion={reducedMotion} onContextLost={onContextLost}>
      <ArenaMemo {...props} />
    </SceneCanvas>
  );
}
