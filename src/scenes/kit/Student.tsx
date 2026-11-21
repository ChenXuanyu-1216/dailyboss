import { useFrame } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import {
  AdditiveBlending,
  Color,
  MathUtils,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Group,
  type Mesh,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ARENA_RULES } from '../../game/arena';
import { turnToward, yawToRotation, type StudentPose } from '../arenaAnim';
import type { Quality } from './VendingMachine';

/**
 * The player: a chibi student in a mint hoodie with an orange backpack, about 1.2 units tall.
 * Built y-up, front +z, feet on the origin. Each frame it reads `poseRef` (set from the
 * simulation) and animates: a walk cycle scaled by speed, a punch, a dash lean, a flinch when hit,
 * blinking while invulnerable, and a cheer when the fight is won.
 */

interface Props {
  poseRef: MutableRefObject<StudentPose>;
  quality: Quality;
}

const HOODIE = '#5ee0a0';
const SKIN = '#ffd9bf';
const HAIR = '#7a4a2e';
const PANTS = '#27325a';
const PACK = '#ff8a3d';
/** Drawn a little larger than its hit circle, so it reads at arena distance. */
const SCALE = 1.25;

/** Fist out fast, back slow. */
function punch(k: number): number {
  if (k < 0) return 0;
  return k < 0.35 ? MathUtils.smoothstep(k / 0.35, 0, 1) : 1 - MathUtils.smoothstep((k - 0.35) / 0.65, 0, 1);
}

function StudentImpl({ poseRef, quality }: Props) {
  const motion = quality !== 'off';
  const root = useRef<Group>(null);
  const hips = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const head = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const swoosh = useRef<Mesh>(null);

  const mat = useMemo(
    () => ({
      hoodie: new MeshPhysicalMaterial({ color: HOODIE, roughness: 0.7, sheen: 0.35, sheenColor: new Color('#bff5dc'), sheenRoughness: 0.6 }),
      hoodieDark: new MeshStandardMaterial({ color: '#3fbf85', roughness: 0.7 }),
      skin: new MeshPhysicalMaterial({ color: SKIN, roughness: 0.55, sheen: 0.5, sheenColor: new Color('#ffc2a8') }),
      hair: new MeshPhysicalMaterial({ color: HAIR, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
      pants: new MeshStandardMaterial({ color: PANTS, roughness: 0.75 }),
      shoe: new MeshPhysicalMaterial({ color: '#f6f6f2', roughness: 0.35, clearcoat: 0.8 }),
      sole: new MeshStandardMaterial({ color: '#ff5d73', roughness: 0.6 }),
      pack: new MeshPhysicalMaterial({ color: PACK, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
      strap: new MeshStandardMaterial({ color: '#2a2140', roughness: 0.6 }),
      eye: new MeshBasicMaterial({ color: '#1a1326' }),
      shine: new MeshBasicMaterial({ color: '#ffffff' }),
      cheek: new MeshBasicMaterial({ color: '#ff9aa8', transparent: true, opacity: 0.55 }),
      swoosh: new MeshBasicMaterial({
        color: '#e8fff4',
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    }),
    [],
  );
  const geo = useMemo(
    () => ({
      pack: new RoundedBoxGeometry(0.34, 0.36, 0.15, 3, 0.05),
      shoe: new RoundedBoxGeometry(0.13, 0.08, 0.22, 2, 0.035),
    }),
    [],
  );
  useEffect(
    () => () => {
      Object.values(mat).forEach((m) => m.dispose());
      Object.values(geo).forEach((g) => g.dispose());
    },
    [mat, geo],
  );

  const anim = useRef({ yaw: NaN, phase: 0, speed: 0, last: null as null | { x: number; y: number }, blinkAt: 2 });
  const hurtTint = useMemo(() => new Color('#ff2a3d'), []);
  const black = useMemo(() => new Color('#000000'), []);

  useFrame(({ clock }, delta) => {
    const pose = poseRef.current;
    const a = anim.current;
    const t = clock.elapsedTime;
    const dt = Math.max(1e-3, Math.min(delta, 0.1));
    if (!root.current) return;

    // Speed from how far the simulation moved the player since the last drawn frame.
    const moved = a.last ? Math.hypot(pose.pos.x - a.last.x, pose.pos.y - a.last.y) : 0;
    a.last = { ...pose.pos };
    const target = Math.min(1.4, moved / dt / ARENA_RULES.speed);
    a.speed = MathUtils.damp(a.speed, moved > 1.5 ? 0 : target, 12, dt);
    a.phase += Math.min(moved, 0.5) * 5.2;

    root.current.position.set(pose.pos.x, 0, -pose.pos.y);
    root.current.scale.setScalar(SCALE);
    if (Number.isNaN(a.yaw)) a.yaw = pose.yaw;
    a.yaw += turnToward(a.yaw, pose.yaw) * Math.min(1, dt * 18);
    root.current.rotation.y = yawToRotation(a.yaw);
    root.current.visible = !pose.hidden;

    const walk = motion ? Math.min(1, a.speed) : 0;
    const swing = Math.sin(a.phase);
    const bob = motion ? Math.abs(Math.cos(a.phase)) * 0.05 * walk : 0;
    const breathe = motion ? Math.sin(t * 2.4) * 0.012 : 0;
    const p = motion ? punch(pose.swing) : pose.swing >= 0 ? 0.6 : 0;
    const dash = pose.dash >= 0 ? Math.sin(Math.PI * pose.dash) : 0;
    const hurt = pose.hurt;
    const cheer = pose.cheer && motion ? Math.abs(Math.sin(t * 7)) : pose.cheer ? 0.5 : 0;

    if (hips.current) {
      hips.current.position.y = 0.4 + bob + cheer * 0.18;
      hips.current.position.z = p * 0.1 + dash * 0.08;
    }
    if (torso.current) {
      torso.current.rotation.x = walk * 0.1 + dash * 0.45 - hurt * 0.45;
      torso.current.rotation.y = p * 0.45;
      torso.current.scale.y = 1 + breathe - dash * 0.06;
    }
    if (head.current) {
      head.current.rotation.x = -walk * 0.06 - dash * 0.25 + hurt * 0.25;
      head.current.rotation.z = motion ? Math.sin(t * 1.3) * 0.04 * (1 - walk) + hurt * 0.2 * Math.sin(t * 30) : 0;
    }
    if (legL.current && legR.current) {
      legL.current.rotation.x = swing * 0.75 * walk - dash * 0.6 + cheer * 0.2;
      legR.current.rotation.x = -swing * 0.75 * walk - dash * 0.2 - cheer * 0.2;
    }
    if (armL.current && armR.current) {
      armL.current.rotation.x = -swing * 0.65 * walk + dash * 0.9 - cheer * 2.6;
      armL.current.rotation.z = -0.12 - cheer * 0.3;
      armR.current.rotation.x = swing * 0.65 * walk + dash * 0.9 - p * 1.75 - cheer * 2.6;
      armR.current.rotation.z = 0.12 + p * 0.15 + cheer * 0.3;
    }
    if (eyes.current) {
      if (motion && t > a.blinkAt) a.blinkAt = t + 2.5 + ((t * 3.7) % 2);
      const closed = motion && t > a.blinkAt - 0.1 && t < a.blinkAt;
      eyes.current.scale.y = closed ? 0.15 : hurt > 0.3 ? 0.4 : 1;
    }
    if (swoosh.current) {
      const visible = motion && pose.swing >= 0 && pose.swing < 0.75;
      swoosh.current.visible = visible;
      mat.swoosh.opacity = visible ? 0.55 * (1 - pose.swing / 0.75) : 0;
      swoosh.current.rotation.y = -0.8 + pose.swing * 1.6;
    }
    // Flash red when hit.
    const flash = hurt > 0.5 ? (hurt - 0.5) * 2 : 0;
    mat.hoodie.emissive.copy(black).lerp(hurtTint, flash * 0.8);
    mat.skin.emissive.copy(black).lerp(hurtTint, flash * 0.6);
  });

  return (
    <group ref={root}>
      <group ref={hips}>
        {/* legs (pivot at the hip) with sneakers */}
        {[
          [-0.1, legL],
          [0.1, legR],
        ].map(([x, ref]) => (
          <group key={x as number} ref={ref as MutableRefObject<Group>} position={[x as number, 0, 0]}>
            <mesh position={[0, -0.16, 0]} material={mat.pants}>
              <capsuleGeometry args={[0.075, 0.18, 4, 10]} />
            </mesh>
            <mesh geometry={geo.shoe} position={[0, -0.34, 0.04]} material={mat.shoe} />
            <mesh position={[0, -0.378, 0.04]} material={mat.sole}>
              <boxGeometry args={[0.12, 0.02, 0.2]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.03, 0]} material={mat.pants}>
          <capsuleGeometry args={[0.17, 0.04, 4, 14]} />
        </mesh>

        <group ref={torso} position={[0, 0.06, 0]}>
          {/* hoodie body, pocket, drawstrings, hood */}
          <mesh position={[0, 0.2, 0]} scale={[1.08, 1, 0.86]} material={mat.hoodie}>
            <capsuleGeometry args={[0.2, 0.16, 6, 16]} />
          </mesh>
          <mesh position={[0, 0.12, 0.165]} material={mat.hoodieDark}>
            <boxGeometry args={[0.24, 0.09, 0.02]} />
          </mesh>
          {[-0.05, 0.05].map((x) => (
            <mesh key={x} position={[x, 0.3, 0.17]} material={mat.shoe}>
              <cylinderGeometry args={[0.008, 0.008, 0.12, 6]} />
            </mesh>
          ))}
          <mesh position={[0, 0.38, -0.08]} rotation-x={Math.PI / 2 - 0.4} material={mat.hoodieDark}>
            <torusGeometry args={[0.15, 0.05, 8, 20]} />
          </mesh>

          {/* backpack */}
          <mesh geometry={geo.pack} position={[0, 0.22, -0.24]} material={mat.pack} />
          <mesh position={[0, 0.16, -0.325]} material={mat.strap}>
            <boxGeometry args={[0.22, 0.12, 0.02]} />
          </mesh>
          {[-0.13, 0.13].map((x) => (
            <mesh key={x} position={[x, 0.27, 0.02]} rotation-x={0.15} material={mat.strap}>
              <boxGeometry args={[0.04, 0.3, 0.3]} />
            </mesh>
          ))}

          {/* arms (pivot at the shoulder) */}
          {[
            [-0.27, armL],
            [0.27, armR],
          ].map(([x, ref]) => (
            <group key={x as number} ref={ref as MutableRefObject<Group>} position={[x as number, 0.34, 0]}>
              <mesh position={[0, -0.13, 0]} material={mat.hoodie}>
                <capsuleGeometry args={[0.065, 0.16, 4, 10]} />
              </mesh>
              <mesh position={[0, -0.27, 0]} material={mat.skin}>
                <sphereGeometry args={[0.07, 14, 10]} />
              </mesh>
            </group>
          ))}

          {/* the big head */}
          <group ref={head} position={[0, 0.62, 0]}>
            <mesh material={mat.skin}>
              <sphereGeometry args={[0.27, 28, 20]} />
            </mesh>
            <mesh position={[0, 0.05, -0.02]} scale={[1.06, 0.95, 1.04]} material={mat.hair}>
              <sphereGeometry args={[0.28, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            </mesh>
            {/* fringe and a cowlick */}
            <mesh position={[0.05, 0.14, 0.2]} rotation={[0.9, 0, -0.3]} material={mat.hair}>
              <capsuleGeometry args={[0.07, 0.12, 4, 8]} />
            </mesh>
            <mesh position={[-0.09, 0.15, 0.19]} rotation={[0.9, 0, 0.4]} material={mat.hair}>
              <capsuleGeometry args={[0.06, 0.1, 4, 8]} />
            </mesh>
            <mesh position={[0.02, 0.32, -0.04]} rotation={[-0.5, 0, 0.3]} material={mat.hair}>
              <coneGeometry args={[0.04, 0.14, 8]} />
            </mesh>
            <group ref={eyes} position={[0, -0.01, 0.245]}>
              {[-0.09, 0.09].map((x) => (
                <group key={x} position={[x, 0, 0]}>
                  <mesh scale={[0.8, 1.25, 0.5]} material={mat.eye}>
                    <sphereGeometry args={[0.045, 14, 10]} />
                  </mesh>
                  <mesh position={[0.015, 0.025, 0.02]} material={mat.shine}>
                    <sphereGeometry args={[0.014, 8, 6]} />
                  </mesh>
                </group>
              ))}
            </group>
            {[-0.16, 0.16].map((x) => (
              <mesh key={x} position={[x, -0.08, 0.21]} rotation-y={x * 2.6} material={mat.cheek}>
                <circleGeometry args={[0.04, 14]} />
              </mesh>
            ))}
          </group>
        </group>
      </group>

      {/* punch swoosh */}
      <mesh ref={swoosh} position={[0.1, 0.62, 0.15]} rotation-x={Math.PI / 2} visible={false} material={mat.swoosh}>
        <ringGeometry args={[0.45, 0.62, 24, 1, -0.2, 1.6]} />
      </mesh>
    </group>
  );
}

export const Student = memo(StudentImpl);
