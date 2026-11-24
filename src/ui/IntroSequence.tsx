import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { IntroArt, IntroDefinition } from '../game/contracts';
import { UI } from './copy';

/** Typewriter speed. */
const CHAR_MS = 45;

/**
 * The illustrations a beat can show (v0.4 `art`). The first four are generic (the printer uses
 * them); the rest tell the vending machine's story and share its palette with the title portrait.
 */
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

  // ---- the vending machine ----

  /** A school wall clock at 10:50, with the bell above it: ten minutes of break left. */
  'school-clock': () => (
    <svg viewBox="0 0 120 120" className="intro-art intro-art--school-clock">
      <rect x="50" y="2" width="20" height="8" rx="2" fill="#5b6270" />
      <g className="intro-art__bell">
        <path d="M48 22 C48 12 72 12 72 22 L74 28 H46 Z" fill="#f5b041" stroke="#9a6410" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="60" cy="30" r="3" fill="#9a6410" />
      </g>
      <rect x="14" y="34" width="92" height="82" rx="14" fill="#2f6d5a" />
      <circle cx="60" cy="75" r="35" fill="#f1ede2" stroke="#1f4a3d" strokeWidth="4" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x="58.75" y="43" width="2.5" height={i % 3 === 0 ? 7 : 4} fill="#2a2a2e" transform={`rotate(${i * 30} 60 75)`} />
      ))}
      {/* 10:50: hour hand at 325°, minute hand at 300° */}
      <rect x="57.5" y="56" width="5" height="22" rx="2.5" fill="#1d1d1f" transform="rotate(325 60 75)" />
      <rect x="58.5" y="46" width="3" height="32" rx="1.5" fill="#1d1d1f" transform="rotate(300 60 75)" />
      <g className="intro-art__tick intro-art__tick--school">
        <rect x="59.4" y="45" width="1.2" height="32" fill="#d23a3a" />
      </g>
      <circle cx="60" cy="75" r="3.5" fill="#d23a3a" />
    </svg>
  ),
  /** The last coin going into the slot. */
  'coin-slot': () => (
    <svg viewBox="0 0 120 120" className="intro-art intro-art--coin-slot">
      <rect x="22" y="8" width="76" height="108" rx="8" fill="#a80f26" />
      <rect x="22" y="8" width="76" height="108" rx="8" fill="#fff" opacity="0.08" />
      <rect x="30" y="16" width="60" height="10" rx="2" fill="#ffe7a8" />
      <circle cx="38" cy="40" r="4" fill="#f4f0e6" />
      <circle cx="82" cy="40" r="4" fill="#f4f0e6" />
      <rect x="44" y="58" width="32" height="44" rx="5" fill="#2a0a10" />
      <rect x="57" y="64" width="6" height="22" rx="2" fill="#0b0204" />
      <text x="60" y="97" textAnchor="middle" fontSize="7" fontWeight="800" fill="#ffc53d" letterSpacing="1">
        投币
      </text>
      <g className="intro-art__coin">
        <ellipse cx="60" cy="30" rx="5" ry="15" fill="#ffc53d" stroke="#b07d0e" strokeWidth="2" />
        <rect x="58.5" y="22" width="3" height="16" rx="1.5" fill="#e0a520" />
      </g>
    </svg>
  ),
  /** The display says "insert coin" again: the coin is gone. */
  'insert-coin': () => (
    <svg viewBox="0 0 120 120" className="intro-art intro-art--insert-coin">
      <rect x="10" y="20" width="100" height="80" rx="8" fill="#a80f26" />
      <rect x="18" y="28" width="84" height="44" rx="4" fill="#1b2a24" />
      <text className="intro-art__lcd" x="60" y="49" textAnchor="middle" fontSize="15" fontWeight="800" fill="#7dffb2" letterSpacing="2">
        请投币
      </text>
      <text x="60" y="65" textAnchor="middle" fontSize="9" fontWeight="700" fill="#7dffb2" opacity="0.7">
        余额 ¥0.00
      </text>
      <rect x="40" y="80" width="40" height="12" rx="3" fill="#2a0a10" />
      <rect x="46" y="84" width="28" height="4" rx="2" fill="#0b0204" />
    </svg>
  ),
  /** The machine turns toward you, its screen now an angry face. */
  'vending-eyes': () => (
    <svg viewBox="0 0 120 120" className="intro-art intro-art--vending-eyes">
      <defs>
        <radialGradient id="intro-vend-glow">
          <stop offset="0" stopColor="#ff3b3b" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ff3b3b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="46" rx="56" ry="34" fill="url(#intro-vend-glow)" opacity="0.5" />
      <g className="intro-art__turn">
        <rect x="24" y="6" width="72" height="110" rx="8" fill="#a80f26" />
        <rect x="30" y="12" width="60" height="10" rx="2" fill="#ffe7a8" opacity="0.9" />
        <rect x="32" y="28" width="56" height="38" rx="4" fill="#1b2a24" />
        <g className="intro-art__eyes">
          <path d="M38 38 L56 45 L56 51 L38 46 Z" fill="#ff3b3b" />
          <path d="M82 38 L64 45 L64 51 L82 46 Z" fill="#ff3b3b" />
          <rect x="46" y="57" width="28" height="4" rx="2" fill="#ff3b3b" />
        </g>
        <rect x="32" y="74" width="56" height="26" rx="3" fill="#2a0a10" />
        <rect x="70" y="78" width="12" height="14" rx="2" fill="#ffc53d" opacity="0.8" />
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
