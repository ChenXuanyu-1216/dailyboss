import { useEffect, useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { LevelDefinition } from '../game/contracts';
import { getPhaseIntensity } from '../game/engine';
import { INTENSITY_LABEL, UI } from './copy';
import { loadRecords } from './records';
import { formatTime } from './runStats';
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
  vending: () => (
    <svg viewBox="44 0 132 170" className="title__vending">
      <defs>
        <linearGradient id="title-vend-sheen" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.85" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <ellipse cx="110" cy="160" rx="62" ry="8" fill="#000" opacity="0.35" />
      {/* cabinet */}
      <rect x="58" y="6" width="104" height="150" rx="9" fill="#a80f26" />
      <rect x="58" y="6" width="104" height="150" rx="9" fill="url(#title-vend-sheen)" />
      {/* lit sign */}
      <rect className="title__sign" x="66" y="13" width="88" height="15" rx="3" fill="#ffe7a8" />
      <text x="110" y="24.5" textAnchor="middle" fontSize="10" fontWeight="800" fill="#a80f26" letterSpacing="2">
        冰镇饮料
      </text>
      {/* display window with cans; the gold one in the middle row is the stuck drink */}
      <rect x="66" y="33" width="64" height="76" rx="3" fill="#10131c" />
      {CAN_ROWS.map((colour, row) =>
        [0, 1, 2, 3].map((col) => {
          const stuck = row === 1 && col === 2;
          return (
            <rect
              key={`${row}-${col}`}
              className={stuck ? 'title__stuck' : undefined}
              x={70 + col * 15}
              y={38 + row * 24}
              width="11"
              height="18"
              rx="2.5"
              fill={stuck ? '#ffc53d' : colour}
            />
          );
        }),
      )}
      <path d="M68 35 L92 35 L72 107 L68 107 Z" fill="#fff" opacity="0.1" />
      {/* face panel: angry LCD eyes */}
      <rect x="135" y="33" width="20" height="30" rx="3" fill="#1b2a24" />
      <g className="title__eyes">
        <path d="M138 42 L145 45 L145 48 L138 46 Z" fill="#ff3b3b" />
        <path d="M152 42 L145.5 45 L145.5 48 L152 46 Z" fill="#ff3b3b" />
        <rect x="139" y="53" width="12" height="2.5" rx="1" fill="#ff3b3b" />
      </g>
      {/* coin slot and buttons */}
      <rect x="140" y="70" width="10" height="16" rx="2" fill="#2a0a10" />
      <rect className="title__slot" x="143.5" y="73" width="3" height="10" rx="1" fill="#ffc53d" />
      <circle cx="141" cy="94" r="2.6" fill="#f4f0e6" />
      <circle cx="149" cy="94" r="2.6" fill="#f4f0e6" />
      <circle cx="141" cy="102" r="2.6" fill="#f4f0e6" />
      <circle cx="149" cy="102" r="2.6" fill="#f4f0e6" />
      {/* pickup tray */}
      <rect x="72" y="118" width="76" height="22" rx="3" fill="#2a0a10" />
      <rect x="76" y="121" width="68" height="6" rx="2" fill="#4a1018" />
    </svg>
  ),
};

const CAN_ROWS = ['#5ad1c9', '#ff8a3d', '#8fb4ff'];

interface Props {
  level: LevelDefinition;
  assist: boolean;
  onToggleAssist: () => void;
  onStart: () => void;
  /** Present once boss practice is unlocked (the player has reached the boss before). */
  onPractice?: () => void;
  /** Fastest full win in this browser, if any. */
  bestMs?: number | null;
  soundOn: boolean;
  onToggleSound: () => void;
  /** Every playable level; with two or more the title screen shows a picker. */
  levels?: readonly LevelDefinition[];
  onChooseLevel?: (levelId: string) => void;
  /** Start with focus on the picker (the player just picked a level) instead of the start button. */
  focusPicker?: boolean;
}

/** Arrow keys move through a radio group (and wrap); Home and End jump to its ends. */
function pickerStep(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (index + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/**
 * The front door: game name, a level picker (when there are several levels), the chosen level
 * (its route through the phases) and a start button.
 */
export function TitleScreen({
  level,
  assist,
  onToggleAssist,
  onStart,
  onPractice,
  bestMs,
  soundOn,
  onToggleSound,
  levels = [],
  onChooseLevel,
  focusPicker = false,
}: Props) {
  const startRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const showPicker = levels.length > 1 && onChooseLevel !== undefined;
  useEffect(() => {
    const picked = focusPicker ? pickerRef.current?.querySelector<HTMLElement>('[aria-checked="true"]') : null;
    (picked ?? startRef.current)?.focus();
  }, [focusPicker]);
  const portrait = PORTRAITS[level.sceneId];
  const cleared = useMemo(
    () => new Set(levels.filter((l) => loadRecords(l.id).full.timeMs !== null).map((l) => l.id)),
    [levels],
  );

  const choose = (id: string) => {
    if (id !== level.id) onChooseLevel?.(id);
  };
  const onPickerKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = pickerStep(e.key, levels.findIndex((l) => l.id === level.id), levels.length);
    const target = next === null ? undefined : levels[next];
    if (!target) return;
    e.preventDefault();
    choose(target.id);
  };

  return (
    <div
      className="title"
      role="dialog"
      aria-modal="true"
      aria-labelledby="title-level"
      data-testid="title-screen"
      data-switched={focusPicker || undefined}
    >
      <header className="title__brand">
        <p className="title__logo">
          <span className="title__logo-daily">Daily</span>
          <span className="title__logo-boss">Boss</span>
        </p>
        <p className="title__sub">{UI.titleSubtitle}</p>
      </header>

      {showPicker && (
        <div
          ref={pickerRef}
          className="title__picker"
          role="radiogroup"
          aria-label={UI.titlePick}
          aria-describedby="title-pick-hint"
          onKeyDown={onPickerKey}
          data-testid="level-picker"
        >
          <p className="title__picker-label" aria-hidden="true">
            {UI.titlePick}
          </p>
          <p id="title-pick-hint" className="visually-hidden">
            {UI.titlePickHint}
          </p>
          <div className="title__picks">
            {levels.map((l, i) => {
              const checked = l.id === level.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked ? 0 : -1}
                  className="title__pick"
                  data-level={l.id}
                  onClick={() => choose(l.id)}
                >
                  <span className="title__pick-n" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="title__pick-text">
                    <span className="title__pick-name">{l.title}</span>
                    <span className="title__pick-goal">{l.objective}</span>
                  </span>
                  {cleared.has(l.id) && <span className="title__pick-badge">{UI.titleCleared}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
        {onPractice && (
          <button
            type="button"
            className="btn btn--ghost title__practice"
            onClick={onPractice}
            title={UI.bossPracticeHint}
            data-testid="title-practice"
          >
            {UI.bossPractice}
          </button>
        )}
        <button
          type="button"
          className="btn btn--ghost title__assist"
          aria-pressed={assist}
          onClick={onToggleAssist}
          title={UI.assistHint}
        >
          {UI.assist}
        </button>
        <button type="button" className="btn btn--ghost title__sound" aria-pressed={soundOn} onClick={onToggleSound}>
          {soundOn ? UI.soundOn : UI.soundOff}
        </button>
      </div>
      {bestMs != null && <p className="title__best">{UI.titleBest(formatTime(bestMs))}</p>}
      <p className="title__hint">{UI.titleControls}</p>
    </div>
  );
}
