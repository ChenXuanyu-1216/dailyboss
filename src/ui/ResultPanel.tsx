import { useEffect, useRef } from 'react';
import type { EndingDefinition, Outcome } from '../game/contracts';
import { OUTCOME_LABEL, UI } from './copy';

interface Props {
  outcome: Outcome;
  ending: EndingDefinition;
  patienceSpent: number;
  steps: number;
  /** Levels with fights show hits taken instead of steps. */
  hits?: number;
  /** Text on the victory print (the level objective). */
  printed: string;
  onRestart: () => void;
}

export function ResultPanel({ outcome, ending, patienceSpent, steps, hits, printed, onRestart }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  return (
    <section className="panel result" data-outcome={outcome} aria-labelledby="result-title">
      {outcome !== 'failure' && (
        <div className="result__print" aria-hidden="true" data-testid="victory-print">
          <span className="result__print-head">{UI.printedPage}</span>
          <span className="result__print-body">{printed}</span>
          <span className="result__print-lines" />
        </div>
      )}
      <p className="result__badge">
        <span className="result__mark" aria-hidden="true">
          {outcome === 'failure' ? '✕' : outcome === 'perfect' ? '★' : '✓'}
        </span>
        {OUTCOME_LABEL[outcome]}
      </p>
      <h2 id="result-title" className="result__title">
        {ending.title}
      </h2>
      <p className="result__desc">{ending.description}</p>
      <dl className="result__stats">
        <div>
          <dt>{UI.spent}</dt>
          <dd>{patienceSpent}</dd>
        </div>
        <div>
          <dt>{hits === undefined ? UI.steps : UI.hitsTaken}</dt>
          <dd>{hits ?? steps}</dd>
        </div>
      </dl>
      <button ref={buttonRef} type="button" className="btn btn--primary" onClick={onRestart} aria-keyshortcuts="R">
        {UI.restart}
        <kbd className="btn__key btn__key--inline" aria-hidden="true">
          R
        </kbd>
      </button>
    </section>
  );
}
