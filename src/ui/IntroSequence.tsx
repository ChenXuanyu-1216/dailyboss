import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { IntroArt, IntroDefinition } from '../game/contracts';
import { UI } from './copy';

/** Typewriter speed. */
const CHAR_MS = 45;

/** The illustrations a beat can show (v0.4 `art`). Generic on purpose: any boss can use them. */
const ART: Record<IntroArt, () => ReactNode> = {
  clock: () => (
    <svg viewBox="0 0 120 120" className="intro-art intro-art--clock">
      <circle cx="60" cy="60" r="50" fill="#f1ede2" stroke="#0e121e" strokeWidth="6" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x="58.5" y="16" width="3" height={i % 3 === 0 ? 9 : 5} fill="#2a2a2e" transform={`rotate(${i * 30} 60 60)`} />
      ))}
      <rect x="57" y="33" width="6" height="30" rx="3" fill="#1d1d1f" transform="rotate(353.5 60 60)" />
      <rect x="58" y="20" width="4" height="43" rx="2" fill="#1d1d1f" transform="rotate(282 60 60)" />
      <g className="intro-art__tick">
        <rect x="59.25" y="18" width="1.5" height="42" fill="#d23a3a" />
      </g>
      <circle cx="60" cy="60" r="4" fill="#d23a3a" />
    </svg>
  ),
  document: () => (
    <svg viewBox="0 0 120 120" className="intro-art intro-art--document">
      <path d="M28 10 H76 L94 28 V110 H28 Z" fill="#fbfbf8" />
      <path d="M76 10 V28 H94" fill="#d9d4c8" />
      <rect x="38" y="36" width="32" height="5" rx="2" fill="#c62a2f" />
      {[50, 60, 70, 80, 90].map((y, i) => (
        <rect key={y} className="intro-art__line" style={{ animationDelay: `${i * 0.12}s` }} x="38" y={y} width={i === 4 ? 26 : 46} height="3" rx="1.5" fill="#b9b4aa" />
      ))}
      <circle cx="88" cy="96" r="14" fill="#1f8a55" />
      <path d="M81 96 L86 101 L95 91" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: () => (
    <svg viewBox="0 0 120 120" className="intro-art intro-art--error">
      <rect x="10" y="22" width="100" height="76" rx="6" fill="#f3f3f0" />
      <rect x="10" y="22" width="100" height="16" rx="6" fill="#c9c8c2" />
      <rect x="10" y="32" width="100" height="6" fill="#c9c8c2" />
      <circle cx="100" cy="30" r="4" fill="#e5484d" />
      <path d="M36 52 L50 78 H22 Z" fill="#f5a524" stroke="#b86e00" strokeWidth="2" strokeLinejoin="round" />
      <rect x="34.5" y="59" width="3" height="10" rx="1.5" fill="#2a1a00" />
      <circle cx="36" cy="73" r="1.8" fill="#2a1a00" />
      <rect x="58" y="54" width="40" height="5" rx="2" fill="#55555a" />
      <rect x="58" y="65" width="30" height="4" rx="2" fill="#a0a0a5" />
      <rect x="72" y="80" width="28" height="12" rx="3" fill="#1d1d1f" />
    </svg>
  ),
  eyes: () => (
    <svg viewBox="0 0 120 120" className="intro-art intro-art--eyes">
      <defs>
        <radialGradient id="intro-eye-glow">
          <stop offset="0" stopColor="#ff3b3b" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ff3b3b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="62" rx="58" ry="30" fill="url(#intro-eye-glow)" opacity="0.5" />
      <g className="intro-art__eyes">
        <path d="M18 56 L52 64 L48 72 L20 66 Z" fill="#ff3b3b" />
        <path d="M102 56 L68 64 L72 72 L100 66 Z" fill="#ff3b3b" />
      </g>
    </svg>
  ),
};

export function IntroArtView({ art }: { art: IntroArt }) {
  return <>{ART[art]()}</>;
}

interface Props {
  intro: IntroDefinition;
  reducedMotion: boolean;
  onDone: () => void;
}

/**
 * The opening story, one beat at a time. Click, Enter, Space or → advances (finishing the line
 * first if it is still typing); Esc or the skip button jumps straight into the game.
 */
export function IntroSequence({ intro, reducedMotion, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const beat = intro.beats[index]!;
  const [typed, setTyped] = useState(reducedMotion ? beat.text.length : 0);
  const [announcement, setAnnouncement] = useState<{ index: number; text: string } | null>(null);
  const last = index === intro.beats.length - 1;
  const done = typed >= beat.text.length;
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    nextRef.current?.focus();
  }, []);

  // Populate a persistent live region after mount, once per complete beat.
  useEffect(() => {
    setAnnouncement({ index, text: beat.text });
  }, [beat.text, index]);

  // Typewriter.
  useEffect(() => {
    if (reducedMotion) {
      setTyped(beat.text.length);
      return;
    }
    if (done) return;
    const id = window.setInterval(() => setTyped((n) => Math.min(beat.text.length, n + 1)), CHAR_MS);
    return () => window.clearInterval(id);
  }, [done, beat.text.length, reducedMotion]);

  const advance = useCallback(() => {
    if (!done) {
      setTyped(beat.text.length);
    } else if (last) {
      onDone();
    } else {
      const next = intro.beats[index + 1]!;
      setIndex(index + 1);
      setTyped(reducedMotion ? next.text.length : 0);
    }
  }, [done, last, beat.text.length, onDone, intro.beats, index, reducedMotion]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onDone();
      } else if (e.key === 'ArrowRight' || ((e.key === ' ' || e.key === 'Enter') && e.target === document.body)) {
        // Space / Enter on a focused button already click it.
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, onDone]);

  return (
    <div className="intro" role="dialog" aria-modal="true" aria-label={UI.introLabel} data-art={beat.art}>
      <div className="intro__bar intro__bar--top" />
      <button type="button" className="intro__skip" onClick={onDone} aria-keyshortcuts="Escape">
        {UI.introSkip} <span aria-hidden="true">›</span>
      </button>

      {/* The whole stage advances on click, like a visual novel. */}
      <div className="intro__stage" onClick={advance}>
        <div key={index} className="intro__beat">
          {beat.art && (
            <div className="intro__art" aria-hidden="true">
              <IntroArtView art={beat.art} />
            </div>
          )}
          <p className="intro__text">
            <span aria-hidden="true">
              {beat.text.slice(0, typed)}
              {!done && <span className="intro__caret" />}
            </span>
          </p>
        </div>
      </div>

      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        <span key={index}>{announcement?.index === index ? announcement.text : ''}</span>
      </p>

      <div className="intro__foot">
        <ol className="intro__dots" aria-label={UI.introProgress(index + 1, intro.beats.length)}>
          {intro.beats.map((_, i) => (
            <li key={i} className="intro__dot" data-state={i < index ? 'done' : i === index ? 'current' : undefined} />
          ))}
        </ol>
        <button ref={nextRef} type="button" className="btn btn--primary intro__next" onClick={advance}>
          {last && done ? UI.introBegin : UI.introNext}
          <kbd className="btn__key btn__key--inline" aria-hidden="true">
            Enter
          </kbd>
        </button>
      </div>
      <div className="intro__bar intro__bar--bottom" />
    </div>
  );
}
