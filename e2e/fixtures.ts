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

/** Query that turns on assist mode: every skill check succeeds instantly (no mini-game). */
export const ASSIST = '?assist=1';
/** The skill action of each boss round, in order: jam → jam-tug → jam-final. */
export const BOSS_SKILLS = ['open-lid', 'pull-steady', 'release-paper'] as const;
export const ROUND_TITLES = ['第一回合：盖板', '第二回合：拔河', '最终回合：最后两厘米'] as const;

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
  readonly skillPanel: Locator;
  readonly skillHit: Locator;
  readonly skillVerdict: Locator;
  readonly bossBar: Locator;
  readonly bossCard: Locator;
  readonly hurtPop: Locator;
  readonly victoryPrint: Locator;
  readonly assistToggle: Locator;

  constructor(readonly page: Page) {
    this.skillPanel = page.locator('.skill');
    this.skillHit = page.getByTestId('skill-hit');
    this.skillVerdict = page.locator('.skill__verdict');
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
  }

  /** Opens the game (optionally with a query string) and waits until actions are interactive. */
  async open(query = '') {
    await this.page.goto(`./${query}`);
    await expect(this.actionButtons.first()).toBeVisible();
  }

  action(id: string): Locator {
    return this.page.locator(`[data-action-id="${id}"]`);
  }

  async act(...ids: string[]) {
    for (const id of ids) await this.action(id).click();
  }

  async expectPatience(value: number, max = 3) {
    await expect(this.patience).toHaveText(new RegExp(`${value} / ${max}$`));
  }

  async expectOutcome(outcome: 'perfect' | 'normal' | 'failure') {
    await expect(this.app).toHaveAttribute('data-outcome', outcome);
    await expect(this.actionButtons).toHaveCount(0);
  }

  async expectInitialState() {
    await expect(this.app).not.toHaveAttribute('data-outcome');
    await expect(this.phaseTitle).toHaveText('打印机离线');
    await this.expectPatience(3);
    await expect(this.log).toHaveCount(0);
    await expect(this.resultTitle).toHaveCount(0);
    await expect(this.feedback).toHaveText('选择一个操作开始。');
    await expect(this.bossBar).toHaveCount(0);
    await expect(this.skillPanel).toHaveCount(0);
  }

  async expectBossHealth(percent: number) {
    await expect(this.bossBar).toHaveAttribute('aria-valuenow', String(percent));
  }

  async expectFocusOnFirstAction() {
    await expect(this.actionButtons.first()).toBeFocused();
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
