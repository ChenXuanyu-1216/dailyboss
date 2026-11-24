import { useEffect, useRef, useState } from 'react';
import type { EndingDefinition, Outcome } from '../game/contracts';
import { OUTCOME_LABEL, UI } from './copy';
import type { Best, RunMode } from './records';
import { formatTime } from './runStats';
import { copyText, shareNatively } from './share';

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
  /** Back to the title screen to pick another level; absent when there is only one. */
  onChangeLevel?: () => void;
  /** Text of a shared result (see ./share.ts); absent: no share button. */
  shareText?: string;
  /** Title for the system share sheet. */
  shareTitle?: string;
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
  onChangeLevel,
  shareText,
  shareTitle = '',
}: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    buttonRef.current?.focus();
  }, []);
  const won = outcome !== 'failure';
  /** Copyable text is shown when the browser can't share (or sharing failed). */
  const [showText, setShowText] = useState(false);
  const [shareNote, setShareNote] = useState<{ text: string; n: number } | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const note = (text: string) => setShareNote((p) => ({ text, n: (p?.n ?? 0) + 1 }));

  const onShare = async () => {
    if (!shareText) return;
    const result = await shareNatively(shareTitle, shareText);
    if (result === 'shared') note(UI.shareShared);
    else if (result === 'unsupported') setShowText(true);
  };
  const onCopy = async () => {
    if (!shareText) return;
    if (await copyText(shareText)) {
      note(UI.shareCopied);
    } else {
      textRef.current?.focus();
      textRef.current?.select();
      note(UI.shareCopyFailed);
    }
  };
  // Once shown, the text is selected so Ctrl+C / long-press copies it straight away.
  useEffect(() => {
    if (!showText) return;
    textRef.current?.focus();
    textRef.current?.select();
  }, [showText]);
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
        {onChangeLevel && (
          <button type="button" className="btn btn--ghost" onClick={onChangeLevel} data-testid="change-level">
            {UI.changeLevel}
          </button>
        )}
        {shareText && (
          <button type="button" className="btn btn--ghost" onClick={onShare} data-testid="share" aria-expanded={showText}>
            {UI.share}
          </button>
        )}
      </div>

      {shareText && showText && (
        <div className="result__share" data-testid="share-box">
          <label className="result__share-label" htmlFor="share-text">
            {UI.shareTextLabel}
          </label>
          <textarea
            ref={textRef}
            id="share-text"
            className="result__share-text"
            readOnly
            rows={shareText.split('\n').length}
            value={shareText}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button type="button" className="btn btn--primary result__share-copy" onClick={onCopy}>
            {UI.shareCopy}
          </button>
        </div>
      )}
      <p className="result__share-note" role="status" aria-live="polite">
        <span key={shareNote?.n}>{shareNote?.text ?? ''}</span>
      </p>
    </section>
  );
}
