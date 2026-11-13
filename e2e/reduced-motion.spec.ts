import { expect, test } from './fixtures';

test.use({ reducedMotion: 'reduce' });

test('reduced motion disables CSS motion and keeps gameplay intact', async ({ game, page }) => {
  test.setTimeout(90_000);
  await game.openPaused();
  await game.installBot();
  await game.clearFight();
  await game.clearFight();
  await expect(game.app).toHaveAttribute('data-intensity', 'critical');

  const durations = await page.evaluate(() => ({
    viewport: getComputedStyle(document.querySelector('.scene__viewport')!).animationDuration,
    tag: getComputedStyle(document.querySelector('.titlebar__tag')!).animationDuration,
    skew: getComputedStyle(document.querySelector('.app')!).getPropertyValue('--skew').trim(),
  }));
  expect(durations).toEqual({ viewport: '0s', tag: '0s', skew: '0deg' });

  await game.fightStart.click();
  await game.runUntil(async () => (await page.locator('.fight__weak').count()) > 0, { stepMs: 250 });
  expect(await page.locator('.fight__weak').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  expect(await page.locator('.fight__player').evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');

  await game.runUntil(async () => (await game.app.getAttribute('data-outcome')) !== null);
  await game.expectOutcome('perfect');
  await page.keyboard.press('r');
  await game.expectInitialState();
});

test('reduced motion shows the boss title card without animation, then clears it', async ({ game, page }) => {
  test.setTimeout(60_000);
  await game.openPaused();
  await game.installBot();
  await game.clearFight();
  await game.clearFight();
  await expect(game.bossCard).toBeVisible();
  await expect(game.bossCard).toContainText('BOSS 出现');
  expect(await game.bossCard.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await page.clock.runFor(1900);
  await expect(game.bossCard).toHaveCount(0);
});
