import type { SceneProps } from '../game/contracts';

/** Props a registered 3D scene component receives from SceneHost. */
export interface Scene3DProps extends SceneProps {
  /** Call when the WebGL context is lost so the host can switch to the fallback. */
  onContextLost: () => void;
}
