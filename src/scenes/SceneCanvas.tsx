import { Canvas } from '@react-three/fiber';
import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  reducedMotion: boolean;
  onContextLost: () => void;
}

/**
 * Shared, mobile-friendly Canvas setup for boss scenes.
 * - Pixel ratio capped at 1.75, no shadows, low-power GPU preference.
 * - Reduced motion renders on demand only (scenes call invalidate on state changes).
 * - Context loss is reported to SceneHost, which swaps in the DOM fallback.
 * React Three Fiber disposes JSX-created geometries/materials and the renderer on unmount.
 */
export function SceneCanvas({ children, reducedMotion, onContextLost }: Props) {
  const lostRef = useRef(onContextLost);
  useEffect(() => {
    lostRef.current = onContextLost;
  }, [onContextLost]);

  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={reducedMotion ? 'demand' : 'always'}
      camera={{ position: [3.1, 2.1, 4.6], fov: 30, near: 0.1, far: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (event) => {
          event.preventDefault();
          lostRef.current();
        });
      }}
    >
      {children}
    </Canvas>
  );
}
