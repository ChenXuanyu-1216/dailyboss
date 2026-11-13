import { ASSIST, MAX_PATIENCE, PHASE_TITLES, expect, requireWebGL, test } from './fixtures';

/**
 * Tests tagged @webgl need a real WebGL context (SwiftShader in headless Chromium).
 * They skip with a reason when WebGL is unavailable, and fail instead under E2E_REQUIRE_WEBGL=1 (CI).
 */

test.describe('3D scene @webgl', () => {
  test.beforeEach(async ({ game }) => {
    await game.page.goto(`./${ASSIST}`);
    await requireWebGL(game);
  });

  test('lazy-loads the 3D chunk from /dailyboss/ and renders a canvas', async ({ game, page }) => {
    const chunk = page.waitForResponse((r) => /\/dailyboss\/assets\/PrinterScene-[\w-]+\.js$/.test(r.url()));
    await page.reload();
    // 304 is fine on reload: the chunk was revalidated from the HTTP cache.
    expect([200, 304]).toContain((await chunk).status());
    await expect(game.scene).toHaveAttribute('data-render', '3d');
    await expect(game.canvas).toBeVisible();
    await expect(game.simplifiedToggle).toHaveAttribute('aria-pressed', 'false');
    await expect(game.sceneNote).toHaveText('');
  });

  // Regression: R3F's renderer teardown calls forceContextLoss(); that must not be reported as a failure.
  test('manual switch to simplified display shows no failure warning, and toggling is repeatable', async ({
    game,
    page,
  }) => {
    await expect(game.canvas).toBeVisible();
    await game.fightStart.click();
    await page.keyboard.press('Escape'); // pause: the fight state must survive display changes
    await expect(game.fight).toHaveAttribute('data-paused', 'true');
    const lane = await game.fight.getAttribute('data-player-lane');

    for (let round = 1; round <= 3; round++) {
      await game.watchCanvasContextLoss();
      await game.simplifiedToggle.click();
      await expect(game.scene).toHaveAttribute('data-render', 'simple');
      await expect(game.canvas).toHaveCount(0);
      await expect(game.simplifiedToggle).toHaveAttribute('aria-pressed', 'true');
      // Wait until the old renderer has actually released its context, then check nothing was reported.
      await game.waitForWatchedContextLoss();
      await expect(game.sceneNote, `round ${round}: no failure note`).toHaveText('');
      await expect(game.scene).toHaveAttribute('data-render', 'simple');

      await game.simplifiedToggle.click();
      await expect(game.scene).toHaveAttribute('data-render', '3d');
      await expect(game.canvas).toBeVisible();
      await expect(game.sceneNote).toHaveText('');
      await expect(game.simplifiedToggle).toHaveAttribute('aria-pressed', 'false');

      // Game state is untouched by display changes.
      await expect(game.phaseTitle).toHaveText(PHASE_TITLES[0]);
      await expect(game.fight).toHaveAttribute('data-paused', 'true');
      await expect(game.fight).toHaveAttribute('data-player-lane', lane!);
      await game.expectPatience(MAX_PATIENCE);
    }
  });

  test('genuine context loss falls back, the fight continues, and 3D can be retried', async ({ game }) => {
    await expect(game.canvas).toBeVisible();
    await game.fightStart.click();

    await game.loseWebGLContext();
    await expect(game.scene).toHaveAttribute('data-render', 'simple');
    await expect(game.sceneNote).toHaveText('3D 渲染中断，已切换为简化显示。');
    await expect(game.simplifiedToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(game.fight).toHaveAttribute('data-started', 'true');
    await expect(game.fight).not.toHaveAttribute('data-paused');

    // Retry 3D: a fresh renderer comes up with state preserved.
    await game.simplifiedToggle.click();
    await expect(game.scene).toHaveAttribute('data-render', '3d');
    await expect(game.canvas).toBeVisible();
    await expect(game.sceneNote).toHaveText('');
    await expect(game.phaseTitle).toHaveText(PHASE_TITLES[0]);
    await expect(game.fight).toHaveAttribute('data-started', 'true');

    // And genuine loss is still detected on the new renderer.
    await game.loseWebGLContext();
    await expect(game.sceneNote).toHaveText('3D 渲染中断，已切换为简化显示。');
  });

  test('restart resets the scene inputs without remounting the renderer', async ({ game, page }) => {
    await expect(game.canvas).toBeVisible();
    await game.fightStart.click();
    await expect(game.log).toHaveCount(1, { timeout: 15_000 }); // standing still: the first sheet hits
    await game.watchCanvasContextLoss();
    await page.keyboard.press('r');
    await game.expectInitialState();
    await expect(game.app).toHaveAttribute('data-intensity', 'calm');
    await expect(game.scene).toHaveAttribute('data-render', '3d');
    await game.nextFrames();
    expect(await page.evaluate(() => (window as unknown as { __dbContextLost: boolean }).__dbContextLost)).toBe(false);
  });
});

test.describe('boss fight in 3D @webgl', () => {
  test('hits and boss damage play in 3D without errors or context loss', async ({ game, page }) => {
    test.setTimeout(120_000);
    // Warm-ups in the simplified display (fast), then switch to 3D for the boss.
    await game.openPaused();
    await requireWebGL(game);
    await game.installBot();
    await game.clearFight();
    await game.clearFight();
    await game.simplifiedToggle.click();
    await game.runUntil(async () => (await game.canvas.count()) > 0, { stepMs: 200, maxMs: 10_000 });
    await expect(game.scene).toHaveAttribute('data-render', '3d');
    await game.watchCanvasContextLoss();

    await game.installBot({ takeHits: 1 });
    await game.fightStart.click();
    await game.runUntil(async () => (await game.bossBar.getAttribute('aria-valuenow')) !== '100', {
      stepMs: 250,
      maxMs: 20_000,
    });
    await expect(game.log.filter({ hasText: '被纸砸中' })).toHaveCount(1);
    await game.expectPatience(MAX_PATIENCE - 1);
    await page.clock.runFor(100);
    await expect(game.scene).toHaveAttribute('data-render', '3d');
    await expect(game.sceneNote).toHaveText('');
    expect(await page.evaluate(() => (window as unknown as { __dbContextLost: boolean }).__dbContextLost)).toBe(false);
  });
});

test.describe('simplified display by URL', () => {
  test('?render=simple never loads the 3D chunk and is fully playable', async ({ game, page }) => {
    test.setTimeout(90_000);
    const sceneRequests: string[] = [];
    page.on('request', (r) => {
      if (/PrinterScene-/.test(r.url())) sceneRequests.push(r.url());
    });
    await game.openPaused();
    await expect(game.scene).toHaveAttribute('data-render', 'simple');
    await expect(game.canvas).toHaveCount(0);
    await expect(page.getByRole('img', { name: /打印机示意：打印机离线/ })).toBeVisible();
    await expect(game.simplifiedToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(game.sceneNote).toHaveText('');

    await game.installBot();
    await game.clearFight();
    await game.clearFight();
    await expect(page.locator('.fallback')).toHaveAttribute('data-cue', 'jam');
    await game.clearFight();
    await game.expectOutcome('perfect');
    await expect(page.locator('.fallback')).toHaveAttribute('data-outcome', 'perfect');
    expect(sceneRequests).toEqual([]);
  });
});
