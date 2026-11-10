import { expect, test } from './fixtures';

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

  test('all three endings remain playable', async ({ game, page }) => {
    await game.open();
    await game.act('reconnect', 'clear-queue', 'release-paper');
    await game.expectOutcome('perfect');

    await page.keyboard.press('r');
    await game.expectInitialState();
    await game.act('reconnect', 'add-copy', 'clear-queue', 'release-paper');
    await game.expectOutcome('normal');

    await page.keyboard.press('r');
    await game.act('print-again', 'print-again', 'print-again');
    await game.expectOutcome('failure');
  });
});
