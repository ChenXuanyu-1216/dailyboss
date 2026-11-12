import { test as base, expect, type Locator, type Page } from '@playwright/test';

/**
 * Shared fixtures:
 * - `guard` (automatic): fails a test on unexpected console errors, uncaught page errors,
 *   or failed / non-2xx requests for the app's own assets under /dailyboss/.
 * - `game`: small page object over the real DOM — no app internals are mocked.
 */

type Fixtures = {
  allowedConsoleErrors: RegExp[];
  guard: void;
  game: GamePage;
};

export const test = base.extend<Fixtures>({
  allowedConsoleErrors: [[], { option: true }],

  guard: [
    async ({ page, allowedConsoleErrors, baseURL }, use) => {
      const problems: string[] = [];
      const appPrefix = new URL(baseURL!).origin + new URL(baseURL!).pathname;
      const isAppAsset = (url: string) => url.startsWith(appPrefix);

      page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        if (allowedConsoleErrors.some((re) => re.test(msg.text()))) return;
        problems.push(`console.error: ${msg.text()}`);
      });
      page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
      page.on('requestfailed', (req) => {
        const reason = req.failure()?.errorText ?? '';
        // Aborts happen when a test navigates away mid-load; real failures have other codes.
        if (isAppAsset(req.url()) && !reason.includes('ERR_ABORTED')) {
          problems.push(`request failed: ${req.url()} (${reason})`);
        }
      });
      page.on('response', (res) => {
        if (isAppAsset(res.url()) && res.status() >= 400) problems.push(`HTTP ${res.status()}: ${res.url()}`);
      });

      await use();

      expect(problems, 'unexpected console errors, page errors, or failed app assets').toEqual([]);
    },
    { auto: true },
  ],

  game: async ({ page }, use) => {
    await use(new GamePage(page));
  },
});

export { expect };

/** Query that turns on assist mode: fights run at 65% speed. */
export const ASSIST = '?assist=1';
/** Phase titles of the shipped level, in order: two warm-up fights, then the boss fight. */
export const PHASE_TITLES = ['打印机离线', '队列堵塞', '卡纸：最终 Boss'] as const;
export const FIGHT_IDS = ['printer-offline', 'printer-queue', 'printer-boss'] as const;
export const MAX_PATIENCE = 5;
/** Fixed fight seed so browser runs are repeatable. */
export const SEED = 'seed=7';

const CLOCK_START = new Date('2026-01-01T09:00:00Z').getTime();

export interface BotOptions {
  /** Stand still (take hits) until this many hits were taken in total, then play perfectly. */
  takeHits?: number;
  /** Never touch anything — for checking that idling loses. */
  idle?: boolean;
}

/**
 * A scripted player that runs *inside the page*, one decision per animation frame, reading only
 * what the arena renders (data attributes on lanes, papers, toner, weak point, charge) and pressing
 * keys with KeyboardEvents on window. Under Playwright's fake clock a whole fight then runs inside
 * `clock.runFor()` with frame-exact timing.
 */
function installBotInPage(opts: BotOptions) {
  type Bot = { opts: BotOptions; total: number; arena: Element | null; seen: number; held: Set<string> };
  const w = window as unknown as { __bot?: Bot };
  if (w.__bot) {
    w.__bot.opts = opts;
    return;
  }
  const bot: Bot = { opts, total: 0, arena: null, seen: 0, held: new Set() };
  w.__bot = bot;
  const key = (type: 'keydown' | 'keyup', code: string) =>
    window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
  const tap = (code: string) => {
    key('keydown', code);
    key('keyup', code);
  };
  const hold = (code: string, on: boolean) => {
    if (on === bot.held.has(code)) return;
    if (on) bot.held.add(code);
    else bot.held.delete(code);
    key(on ? 'keydown' : 'keyup', code);
  };
  const releaseAll = () => {
    hold('ArrowDown', false);
    hold('KeyK', false);
  };

  const tick = () => {
    requestAnimationFrame(tick);
    const arena = document.querySelector<HTMLElement>('.fight');
    if (!arena || !arena.dataset.started || arena.dataset.paused) {
      releaseAll();
      return;
    }
    if (arena !== bot.arena) {
      bot.arena = arena;
      bot.seen = 0;
    }
    const hits = Number(arena.dataset.hits ?? 0);
    if (hits > bot.seen) {
      bot.total += hits - bot.seen;
      bot.seen = hits;
    }
    if (bot.opts.idle || bot.total < (bot.opts.takeHits ?? 0)) {
      releaseAll();
      return;
    }

    const lane = Number(arena.dataset.playerLane);
    const papers = [...arena.querySelectorAll<HTMLElement>('[data-testid="paper"]')].map((p) => ({
      lane: Number(p.dataset.lane),
      impact: Number(p.dataset.impactMs),
    }));
    const next = (l: number) => Math.min(...papers.filter((p) => p.lane === l).map((p) => p.impact), Infinity);
    const mine = next(lane);

    // Paper coming down this lane: step aside, never into a sheet that lands sooner.
    if (mine < Infinity) {
      releaseAll();
      const adj = [lane - 1, lane + 1].filter((l) => l >= 0 && l <= 2).sort((a, b) => next(b) - next(a));
      const best = adj[0]!;
      if (next(best) > mine + 40) {
        tap(best < lane ? 'ArrowLeft' : 'ArrowRight');
        return;
      }
      // Only the lane two over is safe: cross the middle one while it still has time.
      for (const far of [lane - 2, lane + 2]) {
        if (far < 0 || far > 2 || next(far) < Infinity) continue;
        if (next((far + lane) / 2) > 120) tap(far < lane ? 'ArrowLeft' : 'ArrowRight');
      }
      return;
    }
    if (arena.dataset.toner) {
      hold('KeyK', false);
      hold('ArrowDown', true);
      return;
    }
    hold('ArrowDown', false);
    const exposed = arena.dataset.exposedLane === undefined ? null : Number(arena.dataset.exposedLane);
    if (exposed !== null) {
      hold('KeyK', false);
      if (exposed === lane) {
        if (arena.dataset.pullReady) tap('ArrowUp');
      } else {
        const step = exposed < lane ? -1 : 1;
        if (next(lane + step) > 250) tap(step < 0 ? 'ArrowLeft' : 'ArrowRight');
      }
      return;
    }
    hold('KeyK', !!arena.dataset.charging && (!!arena.dataset.resetReady || !!arena.dataset.channeling));
  };
  requestAnimationFrame(tick);
}

export class GamePage {
  readonly app: Locator;
  readonly phaseTitle: Locator;
  readonly patience: Locator;
  readonly feedback: Locator;
  readonly resultTitle: Locator;
  readonly resultBadge: Locator;
  readonly actionButtons: Locator;
  readonly log: Locator;
  readonly scene: Locator;
  readonly canvas: Locator;
  readonly sceneNote: Locator;
  readonly simplifiedToggle: Locator;
  readonly headerRestart: Locator;
  readonly lowPatienceWarning: Locator;
  readonly bossBar: Locator;
  readonly bossCard: Locator;
  readonly hurtPop: Locator;
  readonly victoryPrint: Locator;
  readonly assistToggle: Locator;
  readonly fight: Locator;
  readonly fightStart: Locator;
  readonly fightCall: Locator;
  readonly restartButton: Locator;

  constructor(readonly page: Page) {
    this.bossBar = page.getByRole('progressbar', { name: 'Boss 血量' });
    this.bossCard = page.getByTestId('boss-card');
    this.hurtPop = page.getByTestId('hurt-pop');
    this.victoryPrint = page.getByTestId('victory-print');
    this.assistToggle = page.getByRole('button', { name: '辅助模式' });
    this.app = page.locator('.app');
    this.phaseTitle = page.locator('#phase-title');
    this.patience = page.locator('.patience__value');
    this.feedback = page.locator('.feedback');
    this.resultTitle = page.locator('#result-title');
    this.resultBadge = page.locator('.result__badge');
    this.actionButtons = page.locator('.btn--action');
    this.log = page.locator('.log__item');
    this.scene = page.locator('.scene');
    this.canvas = page.locator('.scene canvas');
    this.sceneNote = page.locator('.scene__note');
    this.simplifiedToggle = page.getByRole('button', { name: '简化显示' });
    this.headerRestart = page.locator('.titlebar__restart');
    this.lowPatienceWarning = page.getByText('只剩最后一点耐心');
    this.fight = page.locator('.fight');
    this.fightStart = page.getByRole('button', { name: '开始战斗' });
    this.fightCall = page.getByTestId('fight-call');
    this.restartButton = page.getByRole('button', { name: /重新开始/ });
  }

  /** Opens the game (optionally with a query string) and waits until it is interactive. */
  async open(query = '') {
    await this.page.goto(`./${query}`);
    await expect(this.page.locator('.btn--action, .fight__start').first()).toBeVisible();
  }

  /**
   * Opens the game under Playwright's fake clock, paused, with a fixed fight seed (simplified
   * display unless `query` says otherwise). Time then only moves with `page.clock.runFor()`.
   */
  async openPaused(query = 'render=simple') {
    await this.page.clock.install({ time: CLOCK_START });
    const extra = query.replace(/^[?&]/, '');
    await this.open(`?${SEED}${extra ? `&${extra}` : ''}`);
    await this.page.clock.pauseAt(CLOCK_START + 3_600_000);
  }

  async installBot(opts: BotOptions = {}) {
    await this.page.evaluate(installBotInPage, opts);
  }

  /** Advances the fake clock in chunks until `done()` holds (or `maxMs` of game time passed). */
  async runUntil(done: () => Promise<boolean>, { stepMs = 2_000, maxMs = 240_000 } = {}) {
    for (let t = 0; t < maxMs; t += stepMs) {
      if (await done()) return;
      await this.page.clock.runFor(stepMs);
    }
    expect(await done(), `condition not reached within ${maxMs} ms of game time`).toBe(true);
  }

  /** Starts the current fight and lets the bot play until the phase changes or the run ends. */
  async clearFight() {
    const before = await this.phaseTitle.textContent();
    await this.fightStart.click();
    await this.runUntil(async () => {
      const outcome = await this.app.getAttribute('data-outcome');
      return outcome !== null || (await this.phaseTitle.textContent()) !== before;
    });
  }

  /** Plays the whole level with the bot (call after `openPaused` + `installBot`). */
  async playThrough() {
    for (let i = 0; i < PHASE_TITLES.length; i++) {
      if ((await this.app.getAttribute('data-outcome')) !== null) return;
      await this.clearFight();
    }
  }

  async expectPatience(value: number, max = MAX_PATIENCE) {
    await expect(this.patience).toHaveText(new RegExp(`${value} / ${max}$`));
  }

  async expectOutcome(outcome: 'perfect' | 'normal' | 'failure') {
    await expect(this.app).toHaveAttribute('data-outcome', outcome);
    await expect(this.actionButtons).toHaveCount(0);
    await expect(this.fight).toHaveCount(0);
  }

  async expectInitialState() {
    await expect(this.app).not.toHaveAttribute('data-outcome');
    await expect(this.phaseTitle).toHaveText(PHASE_TITLES[0]);
    await this.expectPatience(MAX_PATIENCE);
    await expect(this.log).toHaveCount(0);
    await expect(this.resultTitle).toHaveCount(0);
    await expect(this.feedback).toHaveText('准备好就开始战斗。');
    await expect(this.bossBar).toHaveCount(0);
    await expect(this.fight).toHaveAttribute('data-fight-id', FIGHT_IDS[0]);
    await expect(this.fightStart).toBeVisible();
  }

  async expectBossHealth(percent: number) {
    await expect(this.bossBar).toHaveAttribute('aria-valuenow', String(percent));
  }

  async expectNoHorizontalOverflow() {
    const overflow = await this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
  }

  /** Whether the browser under test can create a WebGL context at all. */
  async hasWebGL(): Promise<boolean> {
    return this.page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') ?? c.getContext('webgl');
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      return gl !== null;
    });
  }

  /**
   * Records when the *current* 3D canvas loses its context (for any reason) in window.__dbContextLost.
   * Lets tests wait for R3F's real renderer teardown instead of sleeping.
   */
  async watchCanvasContextLoss() {
    await expect(this.canvas).toBeVisible();
    await this.canvas.evaluate((canvas) => {
      (window as unknown as { __dbContextLost: boolean }).__dbContextLost = false;
      canvas.addEventListener('webglcontextlost', () => {
        (window as unknown as { __dbContextLost: boolean }).__dbContextLost = true;
      });
    });
  }

  async waitForWatchedContextLoss() {
    await expect
      .poll(() => this.page.evaluate(() => (window as unknown as { __dbContextLost?: boolean }).__dbContextLost))
      .toBe(true);
    await this.nextFrames();
  }

  /** Waits two animation frames so React has committed any state set by DOM events. */
  async nextFrames() {
    await this.page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
  }

  /** Forces a genuine WebGL context loss on the live scene canvas via WEBGL_lose_context. */
  async loseWebGLContext() {
    const lost = await this.canvas.evaluate((canvas: HTMLCanvasElement) => {
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      const ext = gl?.getExtension('WEBGL_lose_context');
      if (!ext) return false;
      ext.loseContext();
      return true;
    });
    expect(lost, 'WEBGL_lose_context available on the scene canvas').toBe(true);
  }
}

/**
 * For tests that need real WebGL. Skips (with a visible reason) when the environment has none,
 * unless E2E_REQUIRE_WEBGL=1 — then it fails, so CI can never silently skip 3D coverage.
 */
export async function requireWebGL(game: GamePage) {
  const ok = await game.hasWebGL();
  if (!ok && process.env.E2E_REQUIRE_WEBGL === '1') {
    throw new Error('E2E_REQUIRE_WEBGL=1 but this browser cannot create a WebGL context');
  }
  test.skip(!ok, 'WebGL is not available in this browser environment');
}
