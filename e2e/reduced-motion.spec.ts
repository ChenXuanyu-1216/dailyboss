import { expect, test } from './fixtures';

test.use({ reducedMotion: 'reduce' });

test('reduced motion disables CSS motion and keeps gameplay intact', async ({ game, page }) => {
  await game.open();
  await game.act('reconnect', 'clear-queue');
  await expect(game.app).toHaveAttribute('data-intensity', 'critical');

  const durations = await page.evaluate(() => ({
    viewport: getComputedStyle(document.querySelector('.scene__viewport')!).animationDuration,
    tag: getComputedStyle(document.querySelector('.titlebar__tag')!).animationDuration,
    skew: getComputedStyle(document.querySelector('.app')!).getPropertyValue('--skew').trim(),
  }));
  expect(durations).toEqual({ viewport: '0s', tag: '0s', skew: '0deg' });

  await game.act('release-paper');
  await game.expectOutcome('perfect');
  await page.keyboard.press('r');
  await game.expectInitialState();
});
