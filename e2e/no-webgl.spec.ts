import { MAX_PATIENCE, expect, test } from './fixtures';

// A real browser launched with WebGL disabled — exercises detection and the fallback, not a mock.
test.use({ launchOptions: { args: ['--disable-3d-apis'] } });

test.describe('without WebGL', () => {
  test('falls back to the simplified display with a readable note', async ({ game }) => {
    await game.open();
    expect(await game.hasWebGL()).toBe(false);
    await expect(game.scene).toHaveAttribute('data-render', 'simple');
    await expect(game.canvas).toHaveCount(0);
    await expect(game.sceneNote).toHaveText('当前浏览器不支持 WebGL，已使用简化显示。');
    await expect(game.simplifiedToggle).toBeDisabled();
  });

  test('the boss bar and counterattacks work in the simplified display', async ({ game, page }) => {
    test.setTimeout(60_000);
    await game.openPaused('');
    await game.installBot({ takeHits: 1 });
    await game.fightStart.click();
    await game.runUntil(async () => (await game.log.count()) >= 1, { stepMs: 250 });
    await expect(page.locator('.fallback__shot')).toHaveCount(1); // the printer hits back
    await game.runUntil(async () => (await game.fight.getAttribute('data-fight-id')) === 'printer-queue');
    await game.clearFight();
    await game.expectBossHealth(100);
    await game.fightStart.click();
    await game.runUntil(async () => (await game.bossBar.getAttribute('aria-valuenow')) !== '100', { stepMs: 250 });
    await expect(page.locator('.fallback')).toHaveAttribute('data-boss-health', '0.92');
  });

  test('all three endings remain playable', async ({ game, page }) => {
    test.setTimeout(120_000);
    await game.openPaused('');
    await game.installBot();
    await game.playThrough();
    await game.expectOutcome('perfect');
    await expect(game.victoryPrint).toBeVisible();

    await page.keyboard.press('r');
    await game.expectInitialState();
    await game.installBot({ takeHits: 1 });
    await game.playThrough();
    await game.expectOutcome('normal');

    await page.keyboard.press('r');
    await game.installBot({ idle: true });
    await game.fightStart.click();
    await game.runUntil(async () => (await game.app.getAttribute('data-outcome')) !== null, { stepMs: 1000 });
    await game.expectOutcome('failure');
    await game.expectPatience(0, MAX_PATIENCE);
  });
});
