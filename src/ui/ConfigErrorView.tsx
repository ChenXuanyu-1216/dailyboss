import type { ValidationIssue } from '../game/contracts';
import { UI } from './copy';

export function ConfigErrorView({ errors, source }: { errors: readonly ValidationIssue[]; source: string }) {
  return (
    <main className="config-error" role="alert">
      <h1 className="config-error__title">{UI.configErrorTitle}</h1>
      <p>
        {UI.configErrorBody} <code>{source}</code>
      </p>
      <ol className="config-error__list">
        {errors.map((e, i) => (
          <li key={i}>
            <code className="config-error__path">{e.path || '(root)'}</code>
            <span className="config-error__code">{e.code}</span>
            <span>{e.message}</span>
          </li>
        ))}
      </ol>
    </main>
  );
}
