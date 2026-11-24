import type { Outcome } from '../game/contracts';
import { OUTCOME_LABEL, UI } from './copy';
import type { RunMode } from './records';
import { formatTime } from './runStats';

/** What a shared result says. Everything the text needs, nothing it doesn't. */
export interface ShareInput {
  levelTitle: string;
  outcome: Outcome;
  endingTitle: string;
  /** Fight levels: the run's time, hits and whether assist mode was used. Older (menu) levels have none. */
  run?: { mode: RunMode; timeMs: number; hits: number; assist: boolean };
  /** Menu levels only: patience spent. */
  patienceSpent: number;
  /** Link back to this level. */
  url: string;
}

/** The link a shared result points to: this page, opening the same level, with no debug flags. */
export function shareUrl(location: Pick<Location, 'origin' | 'pathname'>, levelId: string): string {
  const url = new URL(location.pathname, location.origin);
  url.searchParams.set('level', levelId);
  return url.toString();
}

/**
 * The text of a shared result: the game and level, the ending, the run's numbers, a nudge, and
 * the link. Plain text, so it reads the same in a chat app, a post or the clipboard.
 */
export function shareText(input: ShareInput): string {
  const { levelTitle, outcome, endingTitle, run, patienceSpent, url } = input;
  const won = outcome !== 'failure';
  const practice = run?.mode === 'boss' ? `（${UI.practiceBadge}）` : '';
  const assisted = run?.assist ? `（${UI.assist}）` : '';
  const stats = run
    ? UI.shareStats(won ? UI.clearTime : UI.survivedTime, formatTime(run.timeMs), run.hits)
    : UI.shareSpent(patienceSpent);
  return [
    `${UI.shareHead} · ${levelTitle}${practice}${assisted}`,
    `${OUTCOME_LABEL[outcome]}：${endingTitle}`,
    stats,
    won ? UI.shareDareWon : UI.shareDareLost,
    url,
  ].join('\n');
}

export type ShareResult = 'shared' | 'cancelled' | 'unsupported';

/**
 * Opens the system share sheet when the browser has one. `cancelled` when the player closed it;
 * `unsupported` when there is no share sheet or it failed, so the caller shows copyable text.
 */
export async function shareNatively(title: string, text: string, nav: Navigator = navigator): Promise<ShareResult> {
  if (typeof nav.share !== 'function') return 'unsupported';
  const data = { title, text };
  if (typeof nav.canShare === 'function' && !nav.canShare(data)) return 'unsupported';
  try {
    await nav.share(data);
    return 'shared';
  } catch (e) {
    return e instanceof DOMException && e.name === 'AbortError' ? 'cancelled' : 'unsupported';
  }
}

/** Copies to the clipboard; false when the browser refuses (then the text is left selected). */
export async function copyText(text: string, nav: Navigator = navigator): Promise<boolean> {
  try {
    if (!nav.clipboard?.writeText) return false;
    await nav.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
