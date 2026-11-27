import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { UI } from './copy';

/**
 * What both real-time fights (the printer's lanes and the vending machine's open floor) take to
 * cover the whole browser window once started. Without `fullTarget` a fight stays in its panel;
 * the briefing before each fight always shows in the panel.
 */
export interface FullWindowProps {
  /** The level's patience, drawn as a bar over the player. */
  patience?: number;
  maxPatience?: number;
  /** The enemy's name over the long health bar in the full-window view. */
  enemyName?: string;
  /** Where a started fight is drawn over the whole window (the app root). */
  fullTarget?: HTMLElement | null;
  /** Reports whether the fight fills the window (the page behind it is then hidden). */
  onFullChange?: (full: boolean) => void;
  /** Sound and restart, offered in the pause menu while the page's own buttons are covered. */
  soundOn?: boolean;
  onToggleSound?: () => void;
  onRestart?: () => void;
}

/**
 * Whether the fight fills the window: from the start until the fight leaves (won, restarted).
 * Reports it up, and moves keyboard focus onto the fight (Space must act, not press a button).
 */
export function useFullWindow(
  started: boolean,
  fullTarget: HTMLElement | null | undefined,
  onFullChange: ((full: boolean) => void) | undefined,
  rootRef: RefObject<HTMLElement | null>,
): boolean {
  const full = started && !!fullTarget;
  const change = useRef(onFullChange);
  change.current = onFullChange;
  useEffect(() => {
    change.current?.(full);
    if (full) rootRef.current?.focus({ preventScroll: true });
    return () => change.current?.(false);
  }, [full, rootRef]);
  return full;
}

interface HudProps {
  enemyName?: string;
  /** The current stage's title; also the fight's heading. */
  stageTitle: string;
  /** What the bar measures (the fight's progress copy). */
  label: string;
  /** Fight progress or enemy health in [0, 1]. */
  value: number;
  patience?: number;
  maxPatience?: number;
  /** Buttons at the right end (pause, view switch). */
  children?: ReactNode;
}

/** Full window: a long bar across the top, tools at the right. */
export function FightHud({ enemyName, stageTitle, label, value, patience, maxPatience, children }: HudProps) {
  return (
    <header className="fight-hud">
      <div className="fight-hud__boss">
        <div className="fight-hud__name">
          {enemyName && <span className="fight-hud__enemy">{enemyName}</span>}
          <h2 id="fight-heading" className="fight-hud__stage">
            {stageTitle}
          </h2>
        </div>
        <div
          className="fight-hud__bar"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(value * 100)}
          data-testid="fight-boss-bar"
        >
          <span className="fight-hud__fill" style={{ transform: `scaleX(${value})` }} />
        </div>
      </div>
      <div className="fight-hud__tools">{children}</div>
      {patience !== undefined && maxPatience !== undefined && (
        <p className="visually-hidden" data-testid="fight-patience">
          {UI.patience} {patience} / {maxPatience}
        </p>
      )}
    </header>
  );
}

/** The page's title bar is covered in the full-window view: its buttons, in the pause menu. */
export function PauseExtras({ soundOn, onToggleSound, onRestart }: Pick<FullWindowProps, 'soundOn' | 'onToggleSound' | 'onRestart'>) {
  if (!onToggleSound && !onRestart) return null;
  return (
    <div className="fight__paused-more">
      {onToggleSound && (
        <button type="button" className="btn btn--ghost btn--small" aria-pressed={soundOn} onClick={onToggleSound}>
          {soundOn ? UI.soundOn : UI.soundOff}
        </button>
      )}
      {onRestart && (
        <button type="button" className="btn btn--ghost btn--small" onClick={onRestart} aria-keyshortcuts="R">
          {UI.restartShort}
        </button>
      )}
    </div>
  );
}

/**
 * Patience as a row of segments over the player (the DOM twin of the bar arenaDraw.ts and
 * ArenaScene3D draw). Colours follow PATIENCE_BAR; the last one left turns red. Decorative:
 * the HUD carries the value for screen readers.
 */
export function PatiencePips({ patience, max }: { patience: number; max: number }) {
  return (
    <span className="fight-pips" data-last={patience === 1 || undefined} aria-hidden="true" data-testid="player-patience">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className="fight-pips__seg" data-on={i < patience || undefined} />
      ))}
    </span>
  );
}
