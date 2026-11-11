import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActionDefinition, SkillResult, SkillType } from '../game/contracts';
import { UI } from './copy';
import {
  MASH,
  TIMING,
  mashProgress,
  mashResult,
  needlePosition,
  timingResult,
  timingTimeoutMs,
} from './skills';

interface Props {
  action: ActionDefinition & { skill: NonNullable<ActionDefinition['skill']> };
  reducedMotion: boolean;
  onResolve: (result: SkillResult) => void;
  onCancel: () => void;
}

/** How long the hit / miss verdict stays on screen before the turn resolves. */
const VERDICT_MS = 600;

/**
 * Skill-check overlay for one action. Input: click / tap the big button, or Space / Enter.
 * Escape cancels (no turn is taken). Times come from performance.now().
 */
export function SkillChallenge({ action, reducedMotion, onResolve, onCancel }: Props) {
  const type: SkillType = action.skill.type;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [verdict, setVerdict] = useState<SkillResult | null>(null);
  const verdictRef = useRef<SkillResult | null>(null);
  const resolveTimer = useRef<number | undefined>(undefined);

  const finish = useCallback(
    (result: SkillResult) => {
      if (verdictRef.current) return;
      verdictRef.current = result;
      setVerdict(result);
      resolveTimer.current = window.setTimeout(() => onResolve(result), VERDICT_MS);
    },
    [onResolve],
  );

  useEffect(() => {
    buttonRef.current?.focus();
    return () => window.clearTimeout(resolveTimer.current);
  }, []);

  const timing = useTiming(type === 'timing', reducedMotion, finish, verdict !== null);
  const mash = useMash(type === 'mash', finish);
  const hit = type === 'timing' ? timing.press : mash.tap;

  // Keyboard: native button activation handles Space / Enter when the button has focus;
  // elsewhere they are forwarded. Auto-repeat never counts. Escape cancels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!verdictRef.current) onCancel();
        return;
      }
      if (e.key !== ' ' && e.key !== 'Enter') return;
      if (e.target === buttonRef.current) {
        if (e.repeat) e.preventDefault();
        return;
      }
      e.preventDefault();
      if (!e.repeat) hit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hit, onCancel]);

  const title = type === 'timing' ? UI.skillTimingTitle : UI.skillMashTitle;
  const hint = type === 'timing' ? UI.skillTimingHint : UI.skillMashHint(MASH.taps, MASH.windowMs / 1000);

  return (
    <section
      className="panel skill"
      data-skill={type}
      data-verdict={verdict ?? undefined}
      aria-labelledby="skill-title"
      aria-describedby="skill-hint"
    >
      <p className="panel__label">{title}</p>
      <h2 id="skill-title" className="skill__title">
        {action.label}
      </h2>
      <p id="skill-hint" className="skill__hint">
        {hint}
      </p>

      {type === 'timing' ? (
        <div className="skill__track" ref={timing.trackRef} aria-hidden="true">
          <span
            className="skill__zone"
            style={{ left: `${TIMING.zoneStart * 100}%`, width: `${(TIMING.zoneEnd - TIMING.zoneStart) * 100}%` }}
          />
          <span className="skill__needle" />
        </div>
      ) : (
        <div
          className="skill__meter"
          role="progressbar"
          aria-label={UI.skillMashProgress}
          aria-valuemin={0}
          aria-valuemax={MASH.taps}
          aria-valuenow={mash.taps}
        >
          <span className="skill__fill" style={{ transform: `scaleX(${mashProgress(mash.taps)})` }} />
          <span className="skill__count">
            {mash.taps} / {MASH.taps}
          </span>
        </div>
      )}

      <div className="skill__controls">
        <button
          ref={buttonRef}
          type="button"
          className="btn btn--primary skill__hit"
          onClick={hit}
          disabled={verdict !== null}
          data-testid="skill-hit"
        >
          {type === 'timing' ? UI.skillTimingButton : UI.skillMashButton}
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={onCancel} disabled={verdict !== null}>
          {UI.skillCancel}
        </button>
      </div>

      <p className="skill__verdict" role="status" aria-live="assertive">
        {verdict === 'success' ? UI.skillSuccess : verdict === 'fail' ? UI.skillFail : ''}
      </p>
    </section>
  );
}

function useTiming(
  active: boolean,
  reducedMotion: boolean,
  finish: (r: SkillResult) => void,
  stopped: boolean,
) {
  const trackRef = useRef<HTMLDivElement>(null);
  const startRef = useRef(0);
  const periodMs = reducedMotion ? TIMING.reducedPeriodMs : TIMING.periodMs;

  useEffect(() => {
    if (!active) return;
    startRef.current = performance.now();
    const timeout = window.setTimeout(() => finish('fail'), timingTimeoutMs(periodMs));
    return () => window.clearTimeout(timeout);
  }, [active, periodMs, finish]);

  // Animate the needle by writing a CSS variable — no React render per frame.
  useEffect(() => {
    if (!active || stopped) return;
    let raf = 0;
    const tick = () => {
      const pos = needlePosition(performance.now() - startRef.current, periodMs);
      trackRef.current?.style.setProperty('--needle', pos.toFixed(4));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [active, stopped, periodMs]);

  const press = useCallback(() => {
    if (!active) return;
    const elapsed = performance.now() - startRef.current;
    trackRef.current?.style.setProperty('--needle', needlePosition(elapsed, periodMs).toFixed(4));
    finish(timingResult(elapsed, periodMs));
  }, [active, periodMs, finish]);

  return { trackRef, press };
}

function useMash(active: boolean, finish: (r: SkillResult) => void) {
  const [taps, setTaps] = useState(0);
  const tapsRef = useRef(0);
  const firstRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  const tap = useCallback(() => {
    if (!active) return;
    const now = performance.now();
    if (firstRef.current === null) {
      firstRef.current = now;
      timeoutRef.current = window.setTimeout(() => finish('fail'), MASH.windowMs);
    }
    tapsRef.current += 1;
    setTaps(tapsRef.current);
    const result = mashResult(tapsRef.current, firstRef.current, now);
    if (result !== 'pending') {
      window.clearTimeout(timeoutRef.current);
      finish(result);
    }
  }, [active, finish]);

  return { taps, tap };
}
