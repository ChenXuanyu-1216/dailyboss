import { useEffect, useRef, useState } from 'react';
import { UI } from './copy';

interface Props {
  title: string;
  /** Boss health in [0, 1], or null before the boss appears. */
  health: number | null;
  turnCount: number;
  /** Patience charged by the latest turn (0 when it cost nothing). */
  lastCost: number;
}

const CARD_MS = 1800;

/**
 * Boss presentation layered over the device area: health bar, "Boss appears" title card,
 * and a floating "−1 耐心" when the boss hits back. Decorative only — the rules never read it.
 */
export function BossHud({ title, health, turnCount, lastCost }: Props) {
  const [card, setCard] = useState(0);
  const prevHealth = useRef<number | null>(health);

  useEffect(() => {
    const wasNull = prevHealth.current === null;
    prevHealth.current = health;
    if (wasNull && health !== null && turnCount > 0) setCard((n) => n + 1);
  }, [health, turnCount]);

  useEffect(() => {
    if (card === 0) return;
    const t = window.setTimeout(() => setCard(0), CARD_MS);
    return () => window.clearTimeout(t);
  }, [card]);

  return (
    <>
      {health !== null && (
        <div className="boss-bar">
          <span className="boss-bar__name">{title}</span>
          <div
            className="boss-bar__track"
            role="progressbar"
            aria-label={UI.bossHealth}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(health * 100)}
          >
            <span className="boss-bar__fill" style={{ transform: `scaleX(${health})` }} />
          </div>
          <span className="boss-bar__value" aria-hidden="true">
            {Math.round(health * 100)}%
          </span>
        </div>
      )}
      {card > 0 && (
        <div key={card} className="boss-card" aria-hidden="true" data-testid="boss-card">
          <span className="boss-card__kicker">{UI.bossAppears}</span>
          <span className="boss-card__title">{title}</span>
        </div>
      )}
      {lastCost > 0 && (
        <span key={turnCount} className="hurt-pop" aria-hidden="true" data-testid="hurt-pop">
          {UI.hurt(lastCost)}
        </span>
      )}
    </>
  );
}
