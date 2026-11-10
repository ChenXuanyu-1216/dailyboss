import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, MathUtils, MeshStandardMaterial, type Group, type Mesh, type PointLight } from 'three';
import type { SceneProps } from '../game/contracts';
import { SceneCanvas } from './SceneCanvas';
import type { Scene3DProps } from './types';

/**
 * "Printer From Hell" boss scene, built from primitive geometry.
 * Visuals are a pure function of SceneProps (poseFor); useFrame only eases toward the pose.
 * Nothing here affects game rules.
 */

interface Pose {
  led: string;
  ledHz: number;
  ledGlow: number;
  eyeOpen: number;
  eye: string;
  eyeGlow: number;
  angry: number;
  shake: number;
  lid: number;
  paperOut: number;
  paperTilt: number;
  paperTremble: number;
  queueBob: number;
  warn: string;
  warnPower: number;
  sag: number;
  zoom: number;
}

const BASE: Pose = {
  led: '#8a8f98',
  ledHz: 0.8,
  ledGlow: 0.9,
  eyeOpen: 0,
  eye: '#f5a524',
  eyeGlow: 0,
  angry: 0,
  shake: 0,
  lid: 0,
  paperOut: 0,
  paperTilt: 0,
  paperTremble: 0,
  queueBob: 0,
  warn: '#f5a524',
  warnPower: 0,
  sag: 0,
  zoom: 1,
};

export function poseFor({ cue, outcome }: Pick<SceneProps, 'cue' | 'outcome'>): Pose {
  if (outcome === 'perfect') {
    return { ...BASE, led: '#30a46c', ledHz: 0, ledGlow: 1.4, paperOut: 1, warn: '#7ee2a8', warnPower: 0.8 };
  }
  if (outcome === 'normal') {
    return {
      ...BASE,
      led: '#30a46c',
      ledHz: 0,
      ledGlow: 1.1,
      eyeOpen: 0.18,
      eyeGlow: 0.6,
      paperOut: 0.95,
      paperTilt: 0.42,
    };
  }
  if (outcome === 'failure') {
    return {
      ...BASE,
      led: '#3a1f20',
      ledHz: 0,
      ledGlow: 0,
      eyeOpen: 0.45,
      eye: '#e5484d',
      eyeGlow: 1.2,
      angry: 0.6,
      paperOut: 0.12,
      warn: '#e5484d',
      warnPower: 0.35,
      sag: 1,
      zoom: 1.04,
    };
  }
  switch (cue) {
    case 'queue':
      return {
        ...BASE,
        led: '#f5a524',
        ledHz: 2.6,
        ledGlow: 1.6,
        eyeOpen: 0.32,
        eyeGlow: 1,
        shake: 0.004,
        queueBob: 1,
        warnPower: 0.9,
        zoom: 0.95,
      };
    case 'jam':
      return {
        ...BASE,
        led: '#e5484d',
        ledHz: 6,
        ledGlow: 2.2,
        eyeOpen: 1,
        eye: '#ff3b3b',
        eyeGlow: 2.6,
        angry: 1,
        shake: 0.012,
        lid: 0.22,
        paperOut: 0.42,
        paperTilt: 0.12,
        paperTremble: 1,
        warn: '#e5484d',
        warnPower: 2.2,
        zoom: 0.86,
      };
    case 'offline':
    default:
      return BASE;
  }
}

function Printer(props: SceneProps) {
  const { reducedMotion, turnCount, lastTurnHurt } = props;
  const { cue, outcome } = props;
  const pose = useMemo(() => poseFor({ cue, outcome }), [cue, outcome]);
  const colors = useMemo(
    () => ({ led: new Color(pose.led), eye: new Color(pose.eye), warn: new Color(pose.warn) }),
    [pose],
  );

  const root = useRef<Group>(null);
  const lid = useRef<Group>(null);
  const paper = useRef<Mesh>(null);
  const queueSheets = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  // One material shared by both eyes; created imperatively, so disposed here.
  const eyeMat = useMemo(
    () => new MeshStandardMaterial({ color: '#1a0f0f', emissive: '#f5a524', emissiveIntensity: 0 }),
    [],
  );
  useEffect(() => () => eyeMat.dispose(), [eyeMat]);
  const ledMat = useRef<MeshStandardMaterial>(null);
  const warnLight = useRef<PointLight>(null);
  const current = useRef({ ...BASE, eyeOpen: 0, lid: 0, paperOut: 0 });
  const jolt = useRef(-10);

  const { clock, camera, size, invalidate } = useThree();

  // One-shot jolt when an action costs patience (presentation only).
  useEffect(() => {
    if (turnCount > 0 && lastTurnHurt && !reducedMotion) jolt.current = clock.elapsedTime;
  }, [turnCount, lastTurnHurt, reducedMotion, clock]);

  // In reduced-motion (demand) mode, render once per state change.
  useEffect(() => {
    invalidate();
  }, [pose, size.width, size.height, invalidate]);

  useFrame((_, delta) => {
    const t = clock.elapsedTime;
    const c = current.current;
    // Snap instantly with reduced motion; otherwise ease (frame-rate independent).
    const ease = (from: number, to: number, lambda = 6) =>
      reducedMotion ? to : MathUtils.damp(from, to, lambda, Math.min(delta, 0.1));
    c.eyeOpen = ease(c.eyeOpen, pose.eyeOpen);
    c.angry = ease(c.angry, pose.angry);
    c.lid = ease(c.lid, pose.lid, 4);
    c.paperOut = ease(c.paperOut, pose.paperOut, 3);
    c.paperTilt = ease(c.paperTilt, pose.paperTilt, 3);
    c.warnPower = ease(c.warnPower, pose.warnPower, 3);
    c.sag = ease(c.sag, pose.sag, 3);
    c.zoom = ease(c.zoom, pose.zoom, 2);
    c.eyeGlow = ease(c.eyeGlow, pose.eyeGlow, 5);

    const motion = reducedMotion ? 0 : 1;

    if (root.current) {
      const shake = pose.shake * motion;
      const since = t - jolt.current;
      const j = since < 0.6 ? 0.06 * Math.exp(-since * 7) * Math.sin(since * 48) : 0;
      root.current.position.x = Math.sin(t * 43) * shake + j;
      root.current.position.z = Math.cos(t * 37) * shake * 0.6;
      // Idle "breathing" while offline; slump on failure.
      const breathe = cue === 'offline' && !outcome ? Math.sin(t * 1.6) * 0.006 * motion : 0;
      root.current.scale.y = 1 - c.sag * 0.06 + breathe;
      root.current.rotation.z = c.sag * 0.035 + j * 0.4;
    }
    if (lid.current) {
      const flap = pose.lid > 0 ? Math.abs(Math.sin(t * 9)) * 0.06 * motion : 0;
      lid.current.rotation.x = -(c.lid + flap);
    }
    if (paper.current) {
      const out = c.paperOut;
      paper.current.position.set(0, 0.12 - out * 0.1, 0.18 + out * 1.12);
      const tremble = pose.paperTremble * motion;
      paper.current.rotation.set(
        0.1 * out + Math.sin(t * 31) * 0.05 * tremble,
        c.paperTilt * 0.6,
        c.paperTilt * 0.25 + Math.sin(t * 23) * 0.04 * tremble,
      );
    }
    if (queueSheets.current) {
      queueSheets.current.children.forEach((sheet, i) => {
        sheet.position.y = 0.05 + i * 0.03 + Math.max(0, Math.sin(t * 5 + i * 1.7)) * 0.12 * pose.queueBob * motion;
      });
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
    eyeMat.emissiveIntensity = c.eyeGlow;
    if (ledMat.current) {
      const on = pose.ledHz === 0 || !motion ? 1 : Math.sin(t * Math.PI * 2 * pose.ledHz) > 0 ? 1 : 0.15;
      ledMat.current.color.lerp(colors.led, reducedMotion ? 1 : 0.2);
      ledMat.current.emissive.copy(ledMat.current.color);
      ledMat.current.emissiveIntensity = pose.ledGlow * on;
    }
    if (warnLight.current) {
      warnLight.current.color.lerp(colors.warn, reducedMotion ? 1 : 0.08);
      const pulse = pose.warnPower > 1 ? 0.75 + 0.25 * Math.sin(t * 7) * motion : 1;
      warnLight.current.intensity = c.warnPower * pulse * 3;
    }

    // Camera: frame the printer for the viewport, move in as the fight escalates.
    const aspect = size.width / Math.max(1, size.height);
    const fit = aspect < 1.25 ? 1.25 / aspect : 1;
    const d = c.zoom * Math.min(fit, 1.8);
    camera.position.set(3.1 * d, 2.1 * d - (1 - c.zoom) * 1.2, 4.6 * d);
    camera.lookAt(0, 0.05, 0.35);
  });

  return (
    <>
      <ambientLight intensity={0.75} />
      <hemisphereLight args={['#ffffff', '#b8b8b0', 0.6]} />
      <directionalLight position={[3, 5, 4]} intensity={1.7} />
      <pointLight ref={warnLight} position={[0.2, 1.3, 1.9]} distance={7} decay={1.6} intensity={0} />

      {/* soft contact shadow */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.455, 0.3]}>
        <circleGeometry args={[1.75, 40]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.1} depthWrite={false} />
      </mesh>

      <group ref={root}>
        {/* body */}
        <mesh>
          <boxGeometry args={[2.2, 0.9, 1.5]} />
          <meshStandardMaterial color="#e7e6e1" roughness={0.65} />
        </mesh>
        {/* base trim */}
        <mesh position={[0, -0.41, 0]}>
          <boxGeometry args={[2.24, 0.08, 1.54]} />
          <meshStandardMaterial color="#c9c8c2" roughness={0.8} />
        </mesh>

        {/* lid, hinged at the back */}
        <group ref={lid} position={[-0.325, 0.45, -0.72]}>
          <mesh position={[0, 0.03, 0.66]}>
            <boxGeometry args={[1.45, 0.06, 1.32]} />
            <meshStandardMaterial color="#f1f0eb" roughness={0.55} />
          </mesh>
        </group>

        {/* control panel + LED */}
        <mesh position={[0.78, 0.47, 0.35]}>
          <boxGeometry args={[0.5, 0.05, 0.62]} />
          <meshStandardMaterial color="#2b2b2e" roughness={0.4} />
        </mesh>
        <mesh position={[0.9, 0.51, 0.52]}>
          <sphereGeometry args={[0.045, 16, 12]} />
          <meshStandardMaterial ref={ledMat} color="#8a8f98" emissive="#8a8f98" emissiveIntensity={0.9} />
        </mesh>
        <mesh position={[0.7, 0.5, 0.3]}>
          <boxGeometry args={[0.26, 0.012, 0.14]} />
          <meshStandardMaterial color="#5b6b5e" emissive="#9fb7a2" emissiveIntensity={0.25} />
        </mesh>

        {/* eyes — the boss reveals itself as faults escalate */}
        <group ref={eyes} position={[-0.28, 0.27, 0.755]} visible={false}>
          <mesh position={[-0.3, 0, 0]} material={eyeMat}>
            <boxGeometry args={[0.28, 0.08, 0.02]} />
          </mesh>
          <mesh position={[0.3, 0, 0]} material={eyeMat}>
            <boxGeometry args={[0.28, 0.08, 0.02]} />
          </mesh>
        </group>

        {/* output slot */}
        <mesh position={[0, 0.1, 0.752]}>
          <boxGeometry args={[1.5, 0.07, 0.01]} />
          <meshStandardMaterial color="#141416" roughness={0.9} />
        </mesh>

        {/* output tray */}
        <mesh position={[0, -0.08, 1.08]} rotation-x={0.06}>
          <boxGeometry args={[1.25, 0.03, 0.7]} />
          <meshStandardMaterial color="#d6d5cf" roughness={0.7} />
        </mesh>

        {/* the one page */}
        <mesh ref={paper}>
          <boxGeometry args={[0.85, 0.008, 1.05]} />
          <meshStandardMaterial color="#fbfbf8" roughness={0.9} />
        </mesh>

        {/* input tray with queued jobs */}
        <group position={[-0.1, 0.48, -0.62]} rotation-x={-0.55}>
          <mesh>
            <boxGeometry args={[1.3, 0.02, 0.72]} />
            <meshStandardMaterial color="#d6d5cf" roughness={0.7} />
          </mesh>
          <group ref={queueSheets}>
            {[0, 1, 2].map((i) => (
              <mesh key={i} position={[(i - 1) * 0.05, 0.05 + i * 0.03, 0.02 * i]}>
                <boxGeometry args={[1.0, 0.012, 0.6]} />
                <meshStandardMaterial color="#fbfbf8" roughness={0.9} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </>
  );
}

export default function PrinterScene({ onContextLost, ...props }: Scene3DProps) {
  return (
    <SceneCanvas reducedMotion={props.reducedMotion} onContextLost={onContextLost}>
      <Printer {...props} />
    </SceneCanvas>
  );
}
