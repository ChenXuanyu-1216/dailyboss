import { UI } from './copy';

interface Props {
  patience: number;
  max: number;
}

export function PatienceMeter({ patience, max }: Props) {
  const low = patience === 1;
  return (
    <div className="patience" data-low={low || undefined} data-empty={patience === 0 || undefined}>
      <span className="patience__label">{UI.patience}</span>
      <span className="patience__pips" aria-hidden="true">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className="patience__pip" data-filled={i < patience || undefined} />
        ))}
      </span>
      <span className="patience__value">
        <span className="visually-hidden">{UI.patience} </span>
        {patience} / {max}
      </span>
      {low && <span className="patience__warn">{UI.lowPatience}</span>}
    </div>
  );
}
