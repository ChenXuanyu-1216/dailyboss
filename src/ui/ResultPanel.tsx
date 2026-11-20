import { useEffect, useRef } from 'react';
import type { EndingDefinition, Outcome } from '../game/contracts';
import { OUTCOME_LABEL, UI } from './copy';
import type { Best, RunMode } from './records';
import { formatTime } from './runStats';

/** A fight run's numbers (levels with fights only). */
export interface RunSummary {
  mode: RunMode;
  timeMs: number;
  hits: number;
  /** Best before this run (null fields: no earlier win). */
  previous: Best;
  newTime: boolean;
  newHits: boolean;
  /** Assist mode was on at some point: the run is not recorded. */
  assist: boolean;
  perfects: number;
  heavyPulls: number;
  interrupts: number;
  tip: string;
}

interface Props {
  outcome: Outcome;
  ending: EndingDefinition;
  patienceSpent: number;
  steps: number;
  /** Text on the victory print (the level objective). */
  printed: string;
  /** Heading of the victory print, e.g. "打印成功" (depends on the scene). */
  delivered?: string;
  run?: RunSummary;
  onRestart: () => void;
  /** Switches between the full run and boss practice; absent when the level has no boss fight. */
  onSwitchMode?: () => void;
}

export function ResultPanel({
  outcome,
  ending,
  patienceSpent,
  steps,
  printed,
  delivered = UI.printedPage,
  run,
  onRestart,
  onSwitchMode,
}: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    buttonRef.current?.focus();
  }, []);
  const won = outcome !== 'failure';
  const recorded = run && won && !run.assist;

  return (
    <section className="panel result" data-outcome={outcome} aria-labelledby="result-title">
      {won && (
        <div className="result__print" aria-hidden="true" data-testid="victory-print">
          <span className="result__print-head">{delivered}</span>
          <span className="result__print-body">{printed}</span>
          <span className="result__print-lines" />
        </div>
      )}
      <p className="result__badge">
        <span className="result__mark" aria-hidden="true">
          {outcome === 'failure' ? '✕' : outcome === 'perfect' ? '★' : '✓'}
        </span>
        {OUTCOME_LABEL[outcome]}
        {run?.mode === 'boss' && <span className="result__mode">{UI.practiceBadge}</span>}
      </p>
      <h2 id="result-title" className="result__title">
        {ending.title}
      </h2>
      <p className="result__desc">{ending.description}</p>

      {run ? (
        <>
          <dl className="result__stats" data-testid="result-stats">
            <div>
              <dt>{won ? UI.clearTime : UI.survivedTime}</dt>
              <dd data-testid="result-time">
                {formatTime(run.timeMs)}
                {recorded && run.newTime && <span className="result__record">{UI.newRecord}</span>}
              </dd>
              {recorded && !run.newTime && run.previous.timeMs !== null && (
                <dd className="result__best">
                  {UI.bestLabel} {formatTime(run.previous.timeMs)}
                </dd>
              )}
            </div>
            <div>
              <dt>{UI.hitsTaken}</dt>
              <dd data-testid="result-hits">
                {run.hits}
                {recorded && run.newHits && run.previous.hits !== null && (
                  <span className="result__record">{UI.newRecord}</span>
                )}
              </dd>
              {recorded && !run.newHits && run.previous.hits !== null && (
                <dd className="result__best">
                  {UI.bestLabel} {run.previous.hits}
                </dd>
              )}
            </div>
          </dl>
          {(run.perfects > 0 || run.heavyPulls > 0 || run.interrupts > 0) && (
            <p className="result__moves">
              {run.perfects > 0 && <span>{UI.statPerfects(run.perfects)}</span>}
              {run.heavyPulls > 0 && <span>{UI.statHeavy(run.heavyPulls)}</span>}
              {run.interrupts > 0 && <span>{UI.statInterrupts(run.interrupts)}</span>}
            </p>
          )}
          <p className="result__tip" data-testid="result-tip">
            <span className="result__tip-label">{UI.tipLabel}</span>
            {run.tip}
          </p>
          {run.assist && <p className="result__note">{UI.assistNotRecorded}</p>}
        </>
      ) : (
        <dl className="result__stats">
          <div>
            <dt>{UI.spent}</dt>
            <dd>{patienceSpent}</dd>
          </div>
          <div>
            <dt>{UI.steps}</dt>
            <dd>{steps}</dd>
          </div>
        </dl>
      )}

      <div className="result__actions">
        <button ref={buttonRef} type="button" className="btn btn--primary" onClick={onRestart} aria-keyshortcuts="R">
          {run?.mode === 'boss' ? UI.practiceAgain : UI.restart}
          <kbd className="btn__key btn__key--inline" aria-hidden="true">
            R
          </kbd>
        </button>
        {onSwitchMode && (
          <button type="button" className="btn btn--ghost" onClick={onSwitchMode} data-testid="switch-mode">
            {run?.mode === 'boss' ? UI.fullRun : UI.bossPractice}
          </button>
        )}
      </div>
    </section>
  );
}
