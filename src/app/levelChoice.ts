/**
 * Which level the game opens on, and how a choice made on the title screen is kept.
 *
 * Order: a `?level=<id>` link wins (so shared links keep working, and an unknown id still shows the
 * configuration error), then the level last picked in this browser, then the default level.
 * Picking a level on the title screen remembers it and rewrites `?level` in the address bar
 * (other parameters kept), so a reload or a copied link opens the same level.
 */

export const LEVEL_STORAGE_KEY = 'dailyboss:level';

/** The level to open: the link's, else a remembered one that still exists, else the fallback. */
export function initialLevelId(
  search: string,
  stored: string | null,
  known: readonly string[],
  fallback: string,
): string {
  const linked = new URLSearchParams(search).get('level');
  if (linked !== null) return linked;
  if (stored !== null && known.includes(stored)) return stored;
  return fallback;
}

/** `search` with `level` set to `levelId`, keeping every other parameter. Includes the leading "?". */
export function searchWithLevel(search: string, levelId: string): string {
  const params = new URLSearchParams(search);
  params.set('level', levelId);
  return `?${params.toString()}`;
}

export function readStoredLevel(): string | null {
  try {
    return window.localStorage.getItem(LEVEL_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Remembers the choice and puts it in the address bar. Both are best effort. */
export function rememberLevel(levelId: string): void {
  try {
    window.localStorage.setItem(LEVEL_STORAGE_KEY, levelId);
  } catch {
    // Storage unavailable: the choice lasts for this page only.
  }
  try {
    const url = new URL(window.location.href);
    url.search = searchWithLevel(url.search, levelId);
    window.history.replaceState(window.history.state, '', url);
  } catch {
    // ignore
  }
}
