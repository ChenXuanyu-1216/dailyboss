import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { MathUtils, MeshBasicMaterial } from 'three';
import type { SceneProps } from '../game/contracts';
import { portraitPose, type MachineSize } from './arenaAnim';
import { blobShadowTexture } from './kit/textures';
import { useStudioEnvironment } from './kit/useStudioEnvironment';
import { VendingMachine, newKicks, type Quality } from './kit/VendingMachine';
import { SceneCanvas } from './SceneCanvas';
import type { Scene3DProps } from './types';
import { probeWebGL } from './webgl';

/**
 * Boss #2's portrait beside the fight: the same vending machine model as the 3D arena
 * (src/scenes/kit/VendingMachine.tsx), posed from the level's cue, the outcome and the boss's
 * health. It hops with glee when it hits the player and recoils when the player lands a blow.
 * Nothing here affects game rules.
 */

const SIZE: MachineSize = { width: 1.75, depth: 1.1, height: 2.9 };

function Portrait(props: SceneProps) {
  const { cue, outcome, bossHealth, reducedMotion, turnCount, lastTurnHurt } = props;
  const quality: Quality = reducedMotion ? 'off' : probeWebGL().software ? 'lite' : 'full';
  useStudioEnvironment(0.85);

  const pose = useRef(portraitPose(cue, outcome, bossHealth));
  pose.current = portraitPose(cue, outcome, bossHealth);
  const kicks = useRef(newKicks());
  const prevHealth = useRef(bossHealth);
  const { clock, camera, size, invalidate } = useThree();

  // It lands a blow on the player: a gleeful hop. The player lands one: it recoils.
  useEffect(() => {
    if (turnCount > 0 && lastTurnHurt && !reducedMotion) kicks.current.land = clock.elapsedTime;
  }, [turnCount, lastTurnHurt, reducedMotion, clock]);
  useEffect(() => {
    const prev = prevHealth.current;
    prevHealth.current = bossHealth;
    if (prev !== null && bossHealth !== null && bossHealth < prev && !reducedMotion) {
      kicks.current.recoil = clock.elapsedTime;
      kicks.current.hurt = clock.elapsedTime;
    }
  }, [bossHealth, reducedMotion, clock]);

  useEffect(() => {
    invalidate();
  }, [cue, outcome, bossHealth, size.width, size.height, invalidate]);

  const shadow = useMemo(() => {
    const alphaMap = blobShadowTexture();
    return { alphaMap, mat: new MeshBasicMaterial({ color: '#000000', alphaMap, transparent: true, opacity: 0.45, depthWrite: false }) };
  }, []);
  useEffect(
    () => () => {
      shadow.alphaMap.dispose();
      shadow.mat.dispose();
    },
    [shadow],
  );

  useFrame(() => {
    const t = clock.elapsedTime;
    const aspect = size.width / Math.max(1, size.height);
    const fit = aspect < 1.2 ? 1.2 / aspect : 1;
    const d = 6.4 * Math.min(fit, 1.8);
    const sway = quality === 'off' ? 0 : Math.sin(t * 0.35) * 0.25;
    camera.position.set(d * Math.sin(0.42 + sway * 0.3), 2.4, d * Math.cos(0.42 + sway * 0.3));
    camera.lookAt(0, SIZE.height * 0.47, 0);
  });

  return (
    <>
      <ambientLight intensity={0.35} />
      <hemisphereLight args={['#dfe8ff', '#3a2a2a', 0.55]} />
      <directionalLight position={[-4, 6, 5]} intensity={1.8} color="#fff4e6" />
      <directionalLight position={[5, 3, -4]} intensity={0.9} color="#ff4fb8" />
      <directionalLight position={[-5, 3, -4]} intensity={0.7} color="#36e2ff" />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0.1]} material={shadow.mat}>
        <planeGeometry args={[SIZE.width * 1.9, SIZE.depth * 2.6]} />
      </mesh>
      <group rotation-y={MathUtils.degToRad(-8)}>
        <VendingMachine size={SIZE} poseRef={pose} kicksRef={kicks} quality={quality} placed={false} />
      </group>
    </>
  );
}

export default function VendingScene({ onContextLost, ...props }: Scene3DProps) {
  return (
    <SceneCanvas reducedMotion={props.reducedMotion} onContextLost={onContextLost}>
      <Portrait {...props} />
    </SceneCanvas>
  );
}
