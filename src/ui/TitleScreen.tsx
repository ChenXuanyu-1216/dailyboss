import { useEffect, useRef, type ReactNode } from 'react';
import type { LevelDefinition } from '../game/contracts';
import { getPhaseIntensity } from '../game/engine';
import { INTENSITY_LABEL, UI } from './copy';
import { IntroArtView } from './IntroSequence';

/** Boss portrait per scene; scenes without one get the generic glowing eyes. */
const PORTRAITS: Record<string, () => ReactNode> = {
  printer: () => (
    <svg viewBox="0 0 220 170" className="title__printer">
      <ellipse cx="110" cy="158" rx="92" ry="10" fill="#000" opacity="0.35" />
      {/* input tray and queued sheets */}
      <path d="M52 34 L168 34 L156 62 L64 62 Z" fill="#d6d5cf" />
      <rect className="title__sheet" x="76" y="16" width="68" height="34" fill="#fbfbf8" transform="rotate(-4 110 33)" />
      {/* body */}
      <rect x="22" y="58" width="176" height="78" rx="10" fill="#e7e6e1" />
      <rect x="22" y="126" width="176" height="14" rx="6" fill="#c9c8c2" />
      {/* control panel */}
      <rect x="150" y="66" width="38" height="14" rx="3" fill="#2b2b2e" />
      <circle className="title__led" cx="181" cy="73" r="3.5" fill="#e5484d" />
      {/* angry eyes */}
      <g className="title__eyes">
        <path d="M46 82 L88 92 L86 100 L48 92 Z" fill="#ff3b3b" />
        <path d="M134 82 L92 92 L94 100 L132 92 Z" fill="#ff3b3b" />
      </g>
      {/* mouth: the output slot, with the jammed page */}
      <rect x="44" y="112" width="132" height="8" rx="3" fill="#141416" />
      <path className="title__tongue" d="M82 118 H138 L134 150 L86 154 Z" fill="#fbfbf8" />
      <rect x="92" y="128" width="26" height="3" fill="#c62a2f" transform="rotate(2 105 129)" />
    </svg>
  ),
};

interface Props {
  level: LevelDefinition;
  assist: boolean;
  onToggleAssist: () => void;
  onStart: () => void;
}

/** The front door: game name, today's level (its route through the phases) and a start button. */
export function TitleScreen({ level, assist, onToggleAssist, onStart }: Props) {
  const startRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    startRef.current?.focus();
  }, []);
  const portrait = PORTRAITS[level.sceneId];

  return (
    <div className="title" role="dialog" aria-modal="true" aria-labelledby="title-level" data-testid="title-screen">
      <header className="title__brand">
        <p className="title__logo">
          <span className="title__logo-daily">Daily</span>
          <span className="title__logo-boss">Boss</span>
        </p>
        <p className="title__sub">{UI.titleSubtitle}</p>
      </header>

      <section className="title__card" aria-describedby="title-tagline">
        <div className="title__portrait" aria-hidden="true">
          {portrait ? portrait() : <IntroArtView art="eyes" />}
        </div>
        <div className="title__info">
          <p className="title__kicker">{UI.titleToday}</p>
          <h1 id="title-level" className="title__level">
            {level.title}
          </h1>
          <p id="title-tagline" className="title__tagline">
            {level.intro?.tagline ?? level.objective}
          </p>
          <dl className="title__meta">
            <div>
              <dt>{UI.objective}</dt>
              <dd>{level.objective}</dd>
            </div>
            <div>
              <dt>{UI.patience}</dt>
              <dd>
                {level.initialPatience}
                <span className="title__hearts" aria-hidden="true">
                  {Array.from({ length: level.initialPatience }, (_, i) => (
                    <span key={i} />
                  ))}
                </span>
              </dd>
            </div>
          </dl>
          <ol className="title__route" aria-label={UI.titleRoute}>
            {level.phases.map((p, i) => {
              const intensity = getPhaseIntensity(level, p.id);
              return (
                <li key={p.id} className="title__stop" data-intensity={intensity}>
                  <span className="title__stop-n">{i + 1}</span>
                  <span className="title__stop-name">{p.title}</span>
                  {intensity === 'critical' && <span className="title__stop-tag">{INTENSITY_LABEL.critical}</span>}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <div className="title__actions">
        <button ref={startRef} type="button" className="btn btn--primary title__start" onClick={onStart}>
          {UI.titleStart}
          <kbd className="btn__key btn__key--inline" aria-hidden="true">
            Enter
          </kbd>
        </button>
        <button
          type="button"
          className="btn btn--ghost title__assist"
          aria-pressed={assist}
          onClick={onToggleAssist}
          title={UI.assistHint}
        >
          {UI.assist}
        </button>
      </div>
      <p className="title__hint">{UI.titleControls}</p>
    </div>
  );
}
