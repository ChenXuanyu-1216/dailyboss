import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { HalfFloatType, Vector2, WebGLRenderTarget } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * Soft bloom on the bright parts (neon, LCD, sparks, strike flashes). Mount it only on hardware
 * GPUs: it takes over rendering (useFrame priority 1) and costs a few extra passes per frame.
 */
export function Bloom({ strength = 0.5, radius = 0.45, threshold = 0.92 }: { strength?: number; radius?: number; threshold?: number }) {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    // Multisampled HDR target: keeps antialiasing (lost once rendering goes off-screen) and lets
    // bright emissives exceed 1 so the threshold picks out only the glowing parts.
    const c = new EffectComposer(gl, new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 }));
    c.addPass(new RenderPass(scene, camera));
    // Bloom at half resolution: plenty for a soft glow, a quarter of the fill cost.
    c.addPass(new UnrealBloomPass(new Vector2(256, 256), strength, radius, threshold));
    c.addPass(new OutputPass());
    return c;
  }, [gl, scene, camera, strength, radius, threshold]);

  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
    const bloom = composer.passes[1] as UnrealBloomPass;
    bloom.resolution.set(Math.max(1, size.width / 2), Math.max(1, size.height / 2));
  }, [composer, gl, size.width, size.height]);

  useEffect(() => () => composer.dispose(), [composer]);

  useFrame((_, delta) => {
    composer.render(delta);
  }, 1);
  return null;
}
