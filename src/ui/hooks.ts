import { useEffect, useState } from 'react';

export function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(query).matches === true,
  );
  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return;
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Global shortcuts: 1–9 trigger the nth action, R restarts. Off while a skill check is open. */
export function useGameShortcuts(
  actionIds: readonly string[],
  onAct: (id: string) => void,
  onRestart: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target)) return;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        onRestart();
        return;
      }
      const n = Number.parseInt(e.key, 10);
      if (n >= 1 && n <= 9) {
        const id = actionIds[n - 1];
        if (id) {
          e.preventDefault();
          onAct(id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actionIds, onAct, onRestart, enabled]);
}

/** Assist mode starts on with `?assist=1`. */
export function initialAssist(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('assist') === '1';
}

/**
 * Seed for a new fight: `?seed=<integer>` makes fights repeatable (tests, bug reports);
 * otherwise each fight is different.
 */
export function fightSeed(): number {
  if (typeof window !== 'undefined') {
    const raw = new URLSearchParams(window.location.search).get('seed');
    const n = raw === null ? Number.NaN : Number.parseInt(raw, 10);
    if (Number.isSafeInteger(n)) return n;
  }
  return Math.floor(Math.random() * 2 ** 31);
}
