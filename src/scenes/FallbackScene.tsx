import type { SceneProps } from '../game/contracts';

interface Props extends SceneProps {
  statusText: string;
}

/**
 * Simplified display used when WebGL is unavailable, fails, loses its context,
 * or the player picks it. Pure DOM/CSS driven by the same state as the 3D scene.
 */
export function FallbackScene({ cue, outcome, intensity, turnCount, lastTurnHurt, statusText }: Props) {
  return (
    <div
      className="fallback"
      data-cue={cue}
      data-outcome={outcome ?? undefined}
      data-intensity={intensity}
      role="img"
      aria-label={`打印机示意：${statusText}`}
    >
      <div key={turnCount} className="fallback__device" data-jolt={lastTurnHurt || undefined}>
        <div className="fallback__tray-in">
          <span />
          <span />
          <span />
        </div>
        <div className="fallback__lid" />
        <div className="fallback__body">
          <span className="fallback__eye fallback__eye--l" />
          <span className="fallback__eye fallback__eye--r" />
          <span className="fallback__led" />
          <span className="fallback__slot" />
        </div>
        <div className="fallback__paper" />
        <div className="fallback__tray-out" />
      </div>
    </div>
  );
}
