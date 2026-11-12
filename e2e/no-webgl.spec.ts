import { ASSIST, BOSS_SKILLS, expect, test } from './fixtures';

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

  test('the boss bar and counterattack work in the simplified display', async ({ game, page }) => {
    await game.open(ASSIST);
    await game.act('reconnect', 'clear-queue');
    await game.expectBossHealth(100);
    await game.act('slap-side');
    await expect(page.locator('.fallback__shot')).toHaveCount(1);
    await expect(page.locator('.fallback')).toHaveAttribute('data-boss-health', '0.67');
  });

  test('all three endings remain playable', async ({ game, page }) => {
    await game.open(ASSIST);
    await game.act('reconnect', 'clear-queue', ...BOSS_SKILLS);
    await game.expectOutcome('perfect');
    await expect(game.victoryPrint).toBeVisible();

    await page.keyboard.press('r');
    await game.expectInitialState();
    await game.act('reconnect', 'add-copy', 'clear-queue', ...BOSS_SKILLS);
    await game.expectOutcome('normal');

    await page.keyboard.press('r');
    await game.act('print-again', 'print-again', 'print-again');
    await game.expectOutcome('failure');
  });
});
