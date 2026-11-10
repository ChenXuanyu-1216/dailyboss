import { useEffect, useRef } from 'react';
import type { EndingDefinition, Outcome } from '../game/contracts';
import { OUTCOME_LABEL, UI } from './copy';

interface Props {
  outcome: Outcome;
  ending: EndingDefinition;
  patienceSpent: number;
  steps: number;
  onRestart: () => void;
}

export function ResultPanel({ outcome, ending, patienceSpent, steps, onRestart }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  return (
    <section className="panel result" data-outcome={outcome} aria-labelledby="result-title">
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
          <dt>{UI.steps}</dt>
          <dd>{steps}</dd>
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
