import type { CSSProperties } from 'react';
import type { SceneProps } from '../game/contracts';

interface Props extends SceneProps {
  statusText: string;
  /** Which machine to draw: the scene's ID (unknown IDs get the printer). */
  sceneId?: string;
  /** Accessible name prefix, e.g. "打印机示意". */
  label?: string;
}

/**
 * Simplified display used when WebGL is unavailable, fails, loses its context,
 * or the player picks it. Pure DOM/CSS driven by the same state as the 3D scene.
 */
export function FallbackScene({
  cue,
  outcome,
  intensity,
  turnCount,
  lastTurnHurt,
  bossHealth,
  statusText,
  sceneId = 'printer',
  label = '打印机示意',
}: Props) {
  const damage = bossHealth === null ? 0 : Math.min(1, Math.max(0, 1 - bossHealth));
  const vending = sceneId === 'vending';
  return (
    <div
      className="fallback"
      data-scene={sceneId}
      data-cue={cue}
      data-outcome={outcome ?? undefined}
      data-intensity={intensity}
      data-boss-health={bossHealth === null ? undefined : bossHealth.toFixed(2)}
      style={{ '--fb-damage': damage } as CSSProperties}
      role="img"
      aria-label={`${label}：${statusText}`}
    >
      {vending ? (
        <div key={turnCount} className="fallback__vending" data-jolt={lastTurnHurt || undefined}>
          <div className="fallback__vending-glass">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="fallback__vending-can" data-stuck={i === 4 || undefined} />
            ))}
          </div>
          <div className="fallback__vending-panel">
            <span className="fallback__eye fallback__eye--l" />
            <span className="fallback__eye fallback__eye--r" />
            <span className="fallback__vending-slot" />
          </div>
          <div className="fallback__vending-tray" />
        </div>
      ) : (
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
      )}
      {lastTurnHurt && turnCount > 0 && <div key={`shot-${turnCount}`} className="fallback__shot" aria-hidden="true" />}
    </div>
  );
}
