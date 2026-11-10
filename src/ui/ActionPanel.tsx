import type { ActionDefinition } from '../game/contracts';
import { UI } from './copy';

interface Props {
  actions: readonly ActionDefinition[];
  onAct: (actionId: string) => void;
}

/** Renders the current phase's actions. Costs stay hidden until chosen — that's the game. */
export function ActionPanel({ actions, onAct }: Props) {
  return (
    <section className="panel actions" aria-labelledby="actions-heading">
      <h2 id="actions-heading" className="panel__label">
        {UI.actions}
      </h2>
      <div className="actions__list" role="group" aria-labelledby="actions-heading">
        {actions.map((action, i) => (
          <button
            key={action.id}
            type="button"
            className="btn btn--action"
            data-action-id={action.id}
            onClick={() => onAct(action.id)}
            aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
          >
            {i < 9 && (
              <kbd className="btn__key" aria-hidden="true">
                {i + 1}
              </kbd>
            )}
            <span className="btn__text">{action.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
