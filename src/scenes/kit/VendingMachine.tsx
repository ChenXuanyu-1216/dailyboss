import { useFrame } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  MathUtils,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  type Group,
  type Mesh,
  type PointLight,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { turnToward, yawToRotation, type FaceMood, type MachinePose, type MachineSize } from '../arenaAnim';
import { FACE_H, FACE_W, drawFace, faceKey } from './face';
import { canLabelTexture, marqueeTexture } from './textures';

/**
 * The vending machine boss as a glossy designer-toy figure: lacquered cabinet on chrome feet, a lit
 * sign, a glass front with lit shelves of cans (the stuck drink glows), a side panel with an LCD
 * face, a coin slot and buttons, and hot vents on its back (where hits land).
 *
 * Built y-up with its front facing +z and its footprint centred on the origin. Every frame it eases
 * toward `poseRef` and plays one-off reactions from `kicksRef`; React never re-renders it.
 */

export interface MachineKicks {
  /** Clock times (seconds) of the latest reactions; −Infinity when none. */
  recoil: number;
  /** Direction of the latest blow (sim angle), for the recoil tilt. */
  recoilFrom: number;
  land: number;
  hurt: number;
  clank: number;
  /** Eyes follow this (−1 … 1). */
  look: number;
}

export function newKicks(): MachineKicks {
  return { recoil: -Infinity, recoilFrom: 0, land: -Infinity, hurt: -Infinity, clank: -Infinity, look: 0 };
}

export type Quality = 'full' | 'lite' | 'off';

interface Props {
  size: MachineSize;
  poseRef: MutableRefObject<MachinePose>;
  kicksRef: MutableRefObject<MachineKicks>;
  quality: Quality;
  /** In the arena the pose places and turns it; as a portrait it stays at the origin facing +z. */
  placed: boolean;
}

const TONE: Record<MachinePose['tone'], string> = {
  calm: '#7ee8ff',
  warn: '#ffb547',
  danger: '#ff3b4f',
  power: '#ffd23f',
  off: '#3a4660',
  done: '#ff8ab4',
};

const WHITE = new Color('#ffffff');
/** Depth of the display window's recess behind the glass. */
const RECESS = 0.34;

const CANS: [string, string][] = [
  ['#e5484d', '#ffffff'],
  ['#3fb8af', '#0d3b38'],
  ['#f5a524', '#5a2d00'],
  ['#7c66dc', '#ffffff'],
];

function VendingMachineImpl({ size, poseRef, kicksRef, quality, placed }: Props) {
  const { width: W, depth: D, height: H } = size;
  const motion = quality !== 'off';
  const feet = 0.13;
  const bodyH = H - feet;
  const panelW = Math.min(0.5, W * 0.27);
  const glassW = W - panelW - 0.24;
  const glassX = -W / 2 + 0.1 + glassW / 2;
  const glassBottom = feet + bodyH * 0.24;
  const glassTop = H - bodyH * 0.17;
  const glassH = glassTop - glassBottom;
  const front = D / 2;
  const panelX = W / 2 - 0.08 - panelW / 2;

  const root = useRef<Group>(null);
  const tip = useRef<Group>(null);
  const body = useRef<Group>(null);
  const flap = useRef<Group>(null);
  const beacon = useRef<Mesh>(null);
  const light = useRef<PointLight>(null);
  const stuck = useRef<Mesh>(null);

  const geo = useMemo(
    () => ({
      // A shallower body plus four bezel pieces, leaving the display window as an open recess.
      cabinet: new RoundedBoxGeometry(W, bodyH, D - RECESS, 4, Math.min(0.12, W * 0.07)),
      bezelTop: new RoundedBoxGeometry(W, H - glassTop, RECESS, 3, 0.05),
      bezelBottom: new RoundedBoxGeometry(W, glassBottom - feet, RECESS, 3, 0.05),
      bezelLeft: new RoundedBoxGeometry(glassX - glassW / 2 + W / 2, glassH + 0.02, RECESS, 2, 0.02),
      bezelRight: new RoundedBoxGeometry(W / 2 - (glassX + glassW / 2), glassH + 0.02, RECESS, 2, 0.04),
      panel: new RoundedBoxGeometry(panelW, glassH + 0.1, 0.06, 2, 0.025),
      sign: new RoundedBoxGeometry(W - 0.16, bodyH * 0.1, 0.08, 2, 0.03),
    }),
    [W, D, H, bodyH, feet, panelW, glassH, glassTop, glassBottom, glassX, glassW],
  );

  const tex = useMemo(() => {
    const faceCanvas = document.createElement('canvas');
    faceCanvas.width = FACE_W;
    faceCanvas.height = FACE_H;
    const face = new CanvasTexture(faceCanvas);
    face.colorSpace = SRGBColorSpace;
    return {
      faceCanvas,
      face,
      marquee: marqueeTexture('冰镇饮料'),
      labels: CANS.map(([a, b]) => canLabelTexture(a, b)),
    };
  }, []);

  const mat = useMemo(
    () => ({
      lacquer: new MeshPhysicalMaterial({
        color: '#a80f26',
        roughness: 0.34,
        metalness: 0.08,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        envMapIntensity: 0.7,
      }),
      stripe: new MeshPhysicalMaterial({ color: '#f4f1ea', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }),
      chrome: new MeshStandardMaterial({ color: '#e9eef5', metalness: 1, roughness: 0.16 }),
      dark: new MeshStandardMaterial({ color: '#10141c', roughness: 0.55, metalness: 0.2 }),
      interior: new MeshStandardMaterial({ color: '#0b1220', roughness: 0.9, emissive: '#2a6ea8', emissiveIntensity: 0.9 }),
      shelfLight: new MeshBasicMaterial({ color: '#dff3ff', toneMapped: false }),
      glass: new MeshPhysicalMaterial({
        color: '#cfeaff',
        transparent: true,
        opacity: 0.16,
        roughness: 0.04,
        metalness: 0,
        clearcoat: 1,
        envMapIntensity: 2,
        depthWrite: false,
      }),
      glare: new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.1, blending: AdditiveBlending, depthWrite: false }),
      shield: new MeshBasicMaterial({ color: '#8fd3ff', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
      face: new MeshBasicMaterial({ map: tex.face, toneMapped: false }),
      sign: new MeshBasicMaterial({ map: tex.marquee, toneMapped: false, color: '#ffffff' }),
      slot: new MeshBasicMaterial({ color: '#ff8a3d', toneMapped: false }),
      button: new MeshBasicMaterial({ color: '#7ee8ff', toneMapped: false }),
      vents: new MeshBasicMaterial({ color: '#ff6a3d', toneMapped: false }),
      beacon: new MeshBasicMaterial({ color: '#7ee8ff', toneMapped: false, transparent: true, opacity: 0.95 }),
      cans: tex.labels.map(
        (map) =>
          new MeshPhysicalMaterial({ map, metalness: 0.45, roughness: 0.28, clearcoat: 0.6, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: 0.25 }),
      ),
      stuck: new MeshPhysicalMaterial({
        color: '#ffd23f',
        metalness: 0.7,
        roughness: 0.2,
        emissive: '#ffb800',
        emissiveIntensity: 0.4,
      }),
    }),
    [tex],
  );

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
      tex.face.dispose();
      tex.marquee.dispose();
      tex.labels.forEach((t) => t.dispose());
      Object.values(mat).forEach((m) => (Array.isArray(m) ? m.forEach((x) => x.dispose()) : m.dispose()));
    },
    [geo, tex, mat],
  );

  // Eased channels.
  const eased = useRef({ lean: 0, squash: 1, shake: 0, hum: 0, power: 1, slot: 0, guard: 0, drink: 0, yaw: NaN });
  const face = useRef({ key: '', blinkUntil: 0, nextBlink: 1.5 });
  const tone = useMemo(() => new Color(), []);
  const toneTarget = useMemo(() => new Color(), []);

  useFrame(({ clock }, delta) => {
    const pose = poseRef.current;
    const kicks = kicksRef.current;
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.1);
    const e = eased.current;
    const damp = (from: number, to: number, l: number) => (motion ? MathUtils.damp(from, to, l, dt) : to);
    e.lean = damp(e.lean, pose.lean, 12);
    e.squash = damp(e.squash, pose.squash, 16);
    e.shake = damp(e.shake, pose.shake, 10);
    e.hum = damp(e.hum, pose.hum, 6);
    e.power = damp(e.power, pose.power, 5);
    e.slot = damp(e.slot, pose.slotGlow, 10);
    e.guard = damp(e.guard, pose.guard, 12);
    e.drink = damp(e.drink, pose.drinkOut, 8);

    if (root.current && placed) {
      root.current.position.set(pose.anchor.x, pose.lift, -pose.anchor.y);
      if (Number.isNaN(e.yaw)) e.yaw = pose.yaw;
      e.yaw += motion ? turnToward(e.yaw, pose.yaw) * Math.min(1, dt * 14) : turnToward(e.yaw, pose.yaw);
      root.current.rotation.y = yawToRotation(e.yaw);
    }

    // One-off reactions (springs), only with motion.
    const since = (at: number) => t - at;
    const ring = (at: number, dur: number, freq: number, decay: number) => {
      const s = since(at);
      return motion && s >= 0 && s < dur ? Math.exp(-s * decay) * Math.cos(s * freq) : 0;
    };
    const recoil = ring(kicks.recoil, 0.6, 26, 7);
    const land = ring(kicks.land, 0.7, 20, 6);
    const jitter = motion ? e.shake * 0.09 : 0;
    const hum = motion ? e.hum * 0.012 : 0;

    if (tip.current) {
      tip.current.position.z = front;
      tip.current.rotation.x = (pose.fall * Math.PI) / 2 + e.lean - recoil * 0.07;
      tip.current.rotation.z = jitter * Math.sin(t * 61) * 0.6;
    }
    if (body.current) {
      body.current.position.z = -front;
      body.current.position.x = jitter * Math.sin(t * 47) + hum * Math.sin(t * 90);
      const sq = e.squash * (1 - land * 0.22) * (1 + recoil * 0.03);
      body.current.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    }

    // Tone: the beacon, the light and the sign tint.
    toneTarget.set(TONE[pose.tone]);
    tone.lerp(toneTarget, motion ? Math.min(1, dt * 6) : 1);
    const danger = pose.tone === 'danger';
    const pulse = motion && danger ? 0.7 + 0.3 * Math.sin(t * 16) : 1;
    mat.beacon.color.copy(tone).multiplyScalar(0.4 + 0.9 * e.power * pulse);
    if (beacon.current) beacon.current.rotation.y = motion ? t * (danger ? 9 : 2) : 0;
    if (light.current) {
      light.current.color.copy(tone);
      light.current.intensity = (1.1 + (danger ? 2.2 : 0)) * e.power * pulse;
    }
    const flicker = motion && e.power < 0.9 && e.power > 0.05 ? (Math.sin(t * 37) > 0.6 ? 0.3 : 1) : 1;
    mat.sign.color.copy(tone).lerp(WHITE, 0.55).multiplyScalar(Math.max(0.08, e.power) * flicker);
    if (motion) tex.marquee.offset.x = (t * 0.06) % 1;
    mat.shelfLight.color.setScalar(0.25 + 0.75 * e.power * flicker);
    mat.interior.emissiveIntensity = 0.12 + 0.85 * e.power;
    mat.button.color.copy(tone).multiplyScalar(e.power * (motion ? 0.6 + 0.4 * Math.sin(t * 5) : 1));
    mat.slot.color.setRGB(1, 0.45 + 0.4 * e.slot, 0.15).multiplyScalar(0.3 + 2.2 * e.slot * e.power);
    mat.vents.color.setRGB(1, 0.38, 0.18).multiplyScalar(0.7 + 0.5 * (motion ? 0.5 + 0.5 * Math.sin(t * 4) : 1));
    const clank = ring(kicks.clank, 0.45, 0, 7);
    mat.shield.opacity = Math.min(0.7, e.guard * 0.32 + Math.abs(clank) * 0.6);
    mat.stuck.emissiveIntensity = 0.4 + e.drink * (2.2 + (motion ? Math.sin(t * 9) * 0.8 : 0));
    if (stuck.current) stuck.current.position.z = -RECESS * 0.55 + e.drink * 0.1;
    if (flap.current) flap.current.rotation.x = -e.drink * 0.9;

    // The face: redraw only when what it shows changes.
    const f = face.current;
    if (motion && t > f.nextBlink) {
      f.blinkUntil = t + 0.12;
      f.nextBlink = t + 2.2 + ((t * 7.3) % 2.5);
    }
    const hurt = since(kicks.hurt) < 0.35;
    const mood: FaceMood = hurt && pose.mood !== 'off' && pose.mood !== 'defeated' ? 'hurt' : pose.mood;
    const state = {
      mood,
      blink: t < f.blinkUntil ? 1 : 0,
      progress: pose.progress,
      time: motion ? t : 0,
      look: kicks.look,
    };
    const key = faceKey(state);
    if (key !== f.key) {
      f.key = key;
      const g = tex.faceCanvas.getContext('2d');
      if (g) {
        drawFace(g, state);
        tex.face.needsUpdate = true;
      }
    }
  });

  const cols = 4;
  const rows = 3;
  const canR = Math.min(0.12, glassW / cols / 2.6);
  const canStep = (glassW - canR * 2.6) / (cols - 1);
  const canH = canR * 2.6;
  const shelfGap = glassH / rows;

  return (
    <group ref={root}>
      <group ref={tip}>
        <group ref={body}>
          {/* chrome feet */}
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`${sx}${sz}`} position={[sx * (W / 2 - 0.16), feet / 2, sz * (D / 2 - 0.14)]} material={mat.chrome}>
                <cylinderGeometry args={[0.07, 0.09, feet, 16]} />
              </mesh>
            )),
          )}
          {/* cabinet and side stripes */}
          <mesh geometry={geo.cabinet} material={mat.lacquer} position={[0, feet + bodyH / 2, -RECESS / 2]} />
          <mesh geometry={geo.bezelTop} material={mat.lacquer} position={[0, (glassTop + H) / 2, front - RECESS / 2]} />
          <mesh geometry={geo.bezelBottom} material={mat.lacquer} position={[0, (feet + glassBottom) / 2, front - RECESS / 2]} />
          <mesh
            geometry={geo.bezelLeft}
            material={mat.lacquer}
            position={[(-W / 2 + glassX - glassW / 2) / 2, glassBottom + glassH / 2, front - RECESS / 2]}
          />
          <mesh
            geometry={geo.bezelRight}
            material={mat.lacquer}
            position={[(W / 2 + glassX + glassW / 2) / 2, glassBottom + glassH / 2, front - RECESS / 2]}
          />
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * (W / 2 + 0.004), feet + bodyH * 0.55, 0]} material={mat.stripe}>
              <boxGeometry args={[0.01, bodyH * 0.07, D * 0.82]} />
            </mesh>
          ))}

          {/* lit sign */}
          <mesh geometry={geo.sign} position={[0, H - bodyH * 0.075, front + 0.01]} material={mat.dark} />
          <mesh position={[0, H - bodyH * 0.075, front + 0.052]} material={mat.sign}>
            <planeGeometry args={[W - 0.26, bodyH * 0.075]} />
          </mesh>

          {/* glass front: lit interior, shelves of cans, the stuck drink, glass, glare and shield */}
          <group position={[glassX, glassBottom, front]}>
            <mesh position={[0, glassH / 2, -RECESS + 0.005]} material={mat.interior}>
              <planeGeometry args={[glassW, glassH]} />
            </mesh>
            {Array.from({ length: rows }, (_, r) => (
              <group key={r} position={[0, r * shelfGap + 0.02, 0]}>
                <mesh position={[0, 0, -RECESS / 2]} material={mat.chrome}>
                  <boxGeometry args={[glassW, 0.02, RECESS]} />
                </mesh>
                <mesh position={[0, 0.012, -0.002]} material={mat.shelfLight}>
                  <boxGeometry args={[glassW, 0.012, 0.01]} />
                </mesh>
                {Array.from({ length: cols }, (_, c) => {
                  const isStuck = r === 1 && c === 1;
                  return (
                    <mesh
                      key={c}
                      ref={isStuck ? stuck : undefined}
                      position={[(c - (cols - 1) / 2) * canStep, canH / 2 + 0.02, -RECESS * 0.55]}
                      rotation-y={-0.4 + c * 0.25}
                      material={isStuck ? mat.stuck : mat.cans[(r + c) % mat.cans.length]}
                    >
                      <cylinderGeometry args={[canR, canR, canH, 20]} />
                    </mesh>
                  );
                })}
              </group>
            ))}
            <mesh position={[0, glassH / 2, 0.012]} material={mat.glass}>
              <planeGeometry args={[glassW, glassH]} />
            </mesh>
            <mesh position={[-glassW * 0.18, glassH * 0.55, 0.016]} rotation-z={-0.5} material={mat.glare}>
              <planeGeometry args={[glassW * 0.12, glassH * 1.1]} />
            </mesh>
            <mesh position={[0, glassH / 2, 0.02]} material={mat.shield}>
              <planeGeometry args={[glassW + 0.06, glassH + 0.06]} />
            </mesh>
            {/* chrome frame */}
            {[
              [0, glassH + 0.02, glassW + 0.08, 0.04],
              [0, -0.02, glassW + 0.08, 0.04],
              [-glassW / 2 - 0.02, glassH / 2, 0.04, glassH + 0.04],
              [glassW / 2 + 0.02, glassH / 2, 0.04, glassH + 0.04],
            ].map(([x, y, w, h], i) => (
              <mesh key={i} position={[x!, y!, 0.02]} material={mat.chrome}>
                <boxGeometry args={[w!, h!, 0.04]} />
              </mesh>
            ))}
          </group>

          {/* side panel: face, coin slot, buttons */}
          <group position={[panelX, glassBottom + glassH / 2, front + 0.005]}>
            <mesh geometry={geo.panel} material={mat.dark} />
            <mesh position={[0, glassH * 0.3, 0.035]} material={mat.face}>
              <planeGeometry args={[panelW * 0.86, panelW * 0.86 * (FACE_H / FACE_W)]} />
            </mesh>
            <mesh position={[0, glassH * 0.05, 0.035]} material={mat.chrome}>
              <boxGeometry args={[panelW * 0.32, panelW * 0.42, 0.02]} />
            </mesh>
            <mesh position={[0, glassH * 0.05, 0.047]} material={mat.slot}>
              <boxGeometry args={[panelW * 0.06, panelW * 0.28, 0.01]} />
            </mesh>
            {Array.from({ length: 6 }, (_, i) => (
              <mesh
                key={i}
                position={[(i % 2 === 0 ? -1 : 1) * panelW * 0.2, -glassH * 0.14 - Math.floor(i / 2) * panelW * 0.22, 0.04]}
                material={mat.button}
              >
                <boxGeometry args={[panelW * 0.26, panelW * 0.12, 0.02]} />
              </mesh>
            ))}
          </group>

          {/* pickup tray with a flap that swings open when the drink comes out */}
          <group position={[glassX, feet + bodyH * 0.08, front]}>
            <mesh position={[0, 0.1, 0.003]} material={mat.dark}>
              <planeGeometry args={[glassW, bodyH * 0.1]} />
            </mesh>
            <group ref={flap} position={[0, 0.1 + bodyH * 0.05, 0.02]}>
              <mesh position={[0, -bodyH * 0.05, 0]} material={mat.chrome}>
                <boxGeometry args={[glassW * 0.96, bodyH * 0.1, 0.02]} />
              </mesh>
            </group>
          </group>

          {/* hot vents on the back: hit here */}
          {[0.35, 0.45, 0.55].map((k) => (
            <mesh key={k} position={[0, feet + bodyH * k, -front - 0.006]} rotation-y={Math.PI} material={mat.vents}>
              <planeGeometry args={[W * 0.55, bodyH * 0.035]} />
            </mesh>
          ))}

          {/* warning beacon on top */}
          <mesh position={[0, H + 0.04, 0]} material={mat.chrome}>
            <cylinderGeometry args={[0.14, 0.16, 0.08, 20]} />
          </mesh>
          <mesh ref={beacon} position={[0, H + 0.16, 0]} material={mat.beacon}>
            <sphereGeometry args={[0.13, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <pointLight ref={light} position={[0, H * 0.75, front + 0.8]} distance={7} decay={1.7} intensity={2} />
        </group>
      </group>
    </group>
  );
}

export const VendingMachine = memo(VendingMachineImpl);
