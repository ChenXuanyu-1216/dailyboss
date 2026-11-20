import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, MathUtils, MeshStandardMaterial, type Group, type Mesh, type PointLight } from 'three';
import type { SceneProps } from '../game/contracts';
import { SceneCanvas } from './SceneCanvas';
import type { Scene3DProps } from './types';

/**
 * "Vending machine" boss scene (boss #2), built from primitive geometry: the portrait shown beside
 * the arena fight. Visuals are a pure function of SceneProps (poseFor); useFrame only eases toward
 * the pose. Nothing here affects game rules — the fight itself is drawn by the arena view.
 */

interface Pose {
  sign: string;
  signGlow: number;
  eyeOpen: number;
  eye: string;
  eyeGlow: number;
  angry: number;
  shake: number;
  tilt: number;
  canOut: number;
  warn: string;
  warnPower: number;
  sag: number;
  zoom: number;
}

const BASE: Pose = {
  sign: '#7cc3f0',
  signGlow: 1,
  eyeOpen: 0,
  eye: '#f5a524',
  eyeGlow: 0,
  angry: 0,
  shake: 0,
  tilt: 0,
  canOut: 0,
  warn: '#f5a524',
  warnPower: 0,
  sag: 0,
  zoom: 1,
};

/** Target pose for the current state; in the boss fight, damage makes it lean and rattle more. */
export function poseFor({ cue, outcome, bossHealth }: Pick<SceneProps, 'cue' | 'outcome' | 'bossHealth'>): Pose {
  if (outcome === 'perfect' || outcome === 'normal') {
    return {
      ...BASE,
      sign: '#30a46c',
      signGlow: 1.4,
      eyeOpen: outcome === 'normal' ? 0.18 : 0,
      eyeGlow: 0.6,
      canOut: 1,
      tilt: outcome === 'normal' ? 0.04 : 0,
      warn: '#7ee2a8',
      warnPower: 0.8,
    };
  }
  if (outcome === 'failure') {
    return {
      ...BASE,
      sign: '#3a1f20',
      signGlow: 0.1,
      eyeOpen: 0.45,
      eye: '#e5484d',
      eyeGlow: 1.2,
      angry: 0.6,
      warn: '#e5484d',
      warnPower: 0.35,
      sag: 1,
      zoom: 1.04,
    };
  }
  switch (cue) {
    case 'change':
      return {
        ...BASE,
        sign: '#f5a524',
        signGlow: 1.6,
        eyeOpen: 0.4,
        eyeGlow: 1,
        angry: 0.3,
        shake: 0.004,
        warnPower: 0.9,
        zoom: 0.95,
      };
    case 'boss': {
      const damage = bossHealth === null ? 0 : MathUtils.clamp(1 - bossHealth, 0, 1);
      return {
        ...BASE,
        sign: '#e5484d',
        signGlow: 2.2,
        eyeOpen: 1,
        eye: '#ff3b3b',
        eyeGlow: 2.6 + damage * 1.2,
        angry: 1,
        shake: 0.01 + damage * 0.012,
        tilt: damage * 0.12,
        canOut: damage * 0.5,
        warn: '#e5484d',
        warnPower: 2.2 + damage * 0.8,
        zoom: 0.88 - damage * 0.05,
      };
    }
    case 'pay':
    default:
      return { ...BASE, eyeOpen: 0.12, eyeGlow: 0.5 };
  }
}

/** Can colours in the glass front, row by row (the middle one is the stuck drink). */
const CANS = ['#e5484d', '#3fb8af', '#f5a524', '#7cc3f0', '#ffd23f', '#30a46c', '#c084fc', '#e5484d', '#3fb8af'];

function Vending(props: SceneProps) {
  const { reducedMotion, turnCount, lastTurnHurt } = props;
  const { cue, outcome, bossHealth } = props;
  const pose = useMemo(() => poseFor({ cue, outcome, bossHealth }), [cue, outcome, bossHealth]);
  const colors = useMemo(
    () => ({ sign: new Color(pose.sign), eye: new Color(pose.eye), warn: new Color(pose.warn) }),
    [pose],
  );

  const root = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const stuck = useRef<Mesh>(null);
  const eyeMat = useMemo(
    () => new MeshStandardMaterial({ color: '#1a0f0f', emissive: '#f5a524', emissiveIntensity: 0 }),
    [],
  );
  const signMat = useMemo(
    () => new MeshStandardMaterial({ color: '#7cc3f0', emissive: '#7cc3f0', emissiveIntensity: 1 }),
    [],
  );
  useEffect(
    () => () => {
      eyeMat.dispose();
      signMat.dispose();
    },
    [eyeMat, signMat],
  );
  const warnLight = useRef<PointLight>(null);
  const current = useRef({ ...BASE });
  const jolt = useRef(-10);
  const flinch = useRef(-10);
  const prevHealth = useRef(bossHealth);

  const { clock, camera, size, invalidate } = useThree();

  useEffect(() => {
    if (turnCount > 0 && lastTurnHurt && !reducedMotion) jolt.current = clock.elapsedTime;
  }, [turnCount, lastTurnHurt, reducedMotion, clock]);

  useEffect(() => {
    const prev = prevHealth.current;
    prevHealth.current = bossHealth;
    if (prev !== null && bossHealth !== null && bossHealth < prev && !reducedMotion) flinch.current = clock.elapsedTime;
  }, [bossHealth, reducedMotion, clock]);

  useEffect(() => {
    invalidate();
  }, [pose, size.width, size.height, invalidate]);

  useFrame((_, delta) => {
    const t = clock.elapsedTime;
    const c = current.current;
    const ease = (from: number, to: number, lambda = 6) =>
      reducedMotion ? to : MathUtils.damp(from, to, lambda, Math.min(delta, 0.1));
    c.eyeOpen = ease(c.eyeOpen, pose.eyeOpen);
    c.angry = ease(c.angry, pose.angry);
    c.tilt = ease(c.tilt, pose.tilt, 3);
    c.canOut = ease(c.canOut, pose.canOut, 3);
    c.warnPower = ease(c.warnPower, pose.warnPower, 3);
    c.sag = ease(c.sag, pose.sag, 3);
    c.zoom = ease(c.zoom, pose.zoom, 2);
    c.eyeGlow = ease(c.eyeGlow, pose.eyeGlow, 5);
    c.signGlow = ease(c.signGlow, pose.signGlow, 4);
    const motion = reducedMotion ? 0 : 1;

    if (root.current) {
      const shake = pose.shake * motion;
      const since = t - jolt.current;
      const j = since < 0.6 ? 0.05 * Math.exp(-since * 7) * Math.sin(since * 40) : 0;
      const sinceFlinch = t - flinch.current;
      const f = sinceFlinch < 0.7 ? Math.exp(-sinceFlinch * 6) * Math.cos(sinceFlinch * 22) : 0;
      root.current.position.x = Math.sin(t * 41) * shake + j;
      root.current.position.z = -f * 0.1;
      root.current.rotation.z = c.tilt + c.sag * 0.05 + j * 0.5;
      root.current.rotation.x = -f * 0.06 - c.sag * 0.04;
      root.current.scale.y = 1 - c.sag * 0.04 - f * 0.04;
    }
    if (stuck.current) {
      stuck.current.position.z = 0.2 + c.canOut * 0.12;
      stuck.current.rotation.x = c.canOut * 0.6;
    }
    if (eyes.current) {
      const blink = motion && pose.eyeOpen > 0 && Math.sin(t * 0.9) > 0.985 ? 0.1 : 1;
      eyes.current.visible = c.eyeOpen > 0.02;
      eyes.current.children.forEach((eye, i) => {
        eye.scale.y = Math.max(0.05, c.eyeOpen * blink);
        eye.rotation.z = (i === 0 ? -1 : 1) * c.angry * 0.32;
      });
    }
    eyeMat.emissive.lerp(colors.eye, reducedMotion ? 1 : 0.12);
    const sinceHit = t - flinch.current;
    eyeMat.emissiveIntensity = c.eyeGlow + (sinceHit < 0.5 ? 4 * (1 - sinceHit / 0.5) : 0);
    signMat.color.lerp(colors.sign, reducedMotion ? 1 : 0.2);
    signMat.emissive.copy(signMat.color);
    const flicker = cue === 'boss' && !outcome && motion ? (Math.sin(t * 17) > 0.7 ? 0.4 : 1) : 1;
    signMat.emissiveIntensity = c.signGlow * flicker;
    if (warnLight.current) {
      warnLight.current.color.lerp(colors.warn, reducedMotion ? 1 : 0.08);
      const pulse = pose.warnPower > 1 ? 0.75 + 0.25 * Math.sin(t * 7) * motion : 1;
      warnLight.current.intensity = c.warnPower * pulse * 3;
    }
    const aspect = size.width / Math.max(1, size.height);
    const fit = aspect < 1.1 ? 1.1 / aspect : 1;
    const d = c.zoom * Math.min(fit, 1.8);
    camera.position.set(2.6 * d, 1.5 * d, 5.4 * d);
    camera.lookAt(0, 0.1, 0);
  });

  return (
    <>
      <ambientLight intensity={0.7} />
      <hemisphereLight args={['#ffffff', '#b8b8b0', 0.6]} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <pointLight ref={warnLight} position={[0.4, 1.2, 2]} distance={7} decay={1.6} intensity={0} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.2, 0]}>
        <circleGeometry args={[1.3, 40]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <group ref={root} position={[0, 0, 0]}>
        {/* cabinet */}
        <mesh>
          <boxGeometry args={[1.5, 2.4, 1]} />
          <meshStandardMaterial color="#c43c3f" roughness={0.55} />
        </mesh>
        {/* lit sign along the top */}
        <mesh position={[0, 1.03, 0.505]} material={signMat}>
          <boxGeometry args={[1.3, 0.2, 0.02]} />
        </mesh>
        {/* glass front with the cans */}
        <mesh position={[-0.2, 0.2, 0.505]}>
          <boxGeometry args={[0.95, 1.5, 0.02]} />
          <meshStandardMaterial color="#1b2a38" roughness={0.2} metalness={0.1} />
        </mesh>
        {CANS.map((color, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const isStuck = i === 4;
          return (
            <mesh
              key={i}
              ref={isStuck ? stuck : undefined}
              position={[-0.5 + col * 0.3, 0.68 - row * 0.45, 0.2]}
            >
              <cylinderGeometry args={[0.09, 0.09, 0.28, 16]} />
              <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
            </mesh>
          );
        })}
        <mesh position={[-0.2, 0.2, 0.52]}>
          <boxGeometry args={[0.95, 1.5, 0.005]} />
          <meshStandardMaterial color="#9fd3f5" transparent opacity={0.18} roughness={0.05} />
        </mesh>
        {/* side panel: eyes and the coin slot */}
        <mesh position={[0.52, 0.2, 0.505]}>
          <boxGeometry args={[0.36, 1.5, 0.02]} />
          <meshStandardMaterial color="#2b2b2e" roughness={0.4} />
        </mesh>
        <group ref={eyes} position={[0.52, 0.7, 0.52]} visible={false}>
          <mesh position={[-0.08, 0, 0]} material={eyeMat}>
            <boxGeometry args={[0.12, 0.05, 0.02]} />
          </mesh>
          <mesh position={[0.08, 0, 0]} material={eyeMat}>
            <boxGeometry args={[0.12, 0.05, 0.02]} />
          </mesh>
        </group>
        <mesh position={[0.52, 0.25, 0.52]}>
          <boxGeometry args={[0.04, 0.16, 0.01]} />
          <meshStandardMaterial color="#d8d8d8" metalness={0.6} roughness={0.3} />
        </mesh>
        {/* pickup tray */}
        <mesh position={[-0.2, -0.85, 0.505]}>
          <boxGeometry args={[0.95, 0.3, 0.03]} />
          <meshStandardMaterial color="#141416" roughness={0.9} />
        </mesh>
        {/* feet */}
        <mesh position={[0, -1.22, 0]}>
          <boxGeometry args={[1.45, 0.05, 0.95]} />
          <meshStandardMaterial color="#5a1d1f" roughness={0.8} />
        </mesh>
      </group>
    </>
  );
}

export default function VendingScene({ onContextLost, ...props }: Scene3DProps) {
  return (
    <SceneCanvas reducedMotion={props.reducedMotion} onContextLost={onContextLost}>
      <Vending {...props} />
    </SceneCanvas>
  );
}
