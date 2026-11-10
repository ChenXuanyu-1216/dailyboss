import { Canvas } from '@react-three/fiber';
import { useLayoutEffect, useRef, type ReactNode } from 'react';

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
 *
 * Context-loss listener lifecycle: when <Canvas> unmounts, R3F (9.x) releases the renderer with
 * `gl.forceContextLoss()`, which fires a real `webglcontextlost` event. That intentional teardown
 * must not be reported as a failure, so the listener is detached in this component's layout-effect
 * cleanup. On unmount React destroys a parent's layout effects before its children's, so the
 * listener is gone before <Canvas> starts its teardown. Genuine loss while mounted is still reported.
 */
export function SceneCanvas({ children, reducedMotion, onContextLost }: Props) {
  const lostRef = useRef(onContextLost);
  const detachRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    lostRef.current = onContextLost;
  }, [onContextLost]);

  useLayoutEffect(
    () => () => {
      detachRef.current?.();
      detachRef.current = null;
    },
    [],
  );

  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={reducedMotion ? 'demand' : 'always'}
      camera={{ position: [3.1, 2.1, 4.6], fov: 30, near: 0.1, far: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      onCreated={({ gl }) => {
        detachRef.current?.();
        const canvas = gl.domElement;
        let attached = true;
        const onLost = (event: Event) => {
          event.preventDefault();
          if (attached) lostRef.current();
        };
        canvas.addEventListener('webglcontextlost', onLost);
        detachRef.current = () => {
          attached = false;
          canvas.removeEventListener('webglcontextlost', onLost);
        };
      }}
    >
      {children}
    </Canvas>
  );
}
