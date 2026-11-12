import { ASSIST, BOSS_SKILLS, expect, test } from './fixtures';

test.use({ reducedMotion: 'reduce' });

test('reduced motion disables CSS motion and keeps gameplay intact', async ({ game, page }) => {
  await game.open(ASSIST);
  await game.act('reconnect', 'clear-queue');
  await expect(game.app).toHaveAttribute('data-intensity', 'critical');

  const durations = await page.evaluate(() => ({
    viewport: getComputedStyle(document.querySelector('.scene__viewport')!).animationDuration,
    tag: getComputedStyle(document.querySelector('.titlebar__tag')!).animationDuration,
    skew: getComputedStyle(document.querySelector('.app')!).getPropertyValue('--skew').trim(),
  }));
  expect(durations).toEqual({ viewport: '0s', tag: '0s', skew: '0deg' });

  // The short-lived title card is checked with a paused clock below.
  await game.act(...BOSS_SKILLS);
  await game.expectOutcome('perfect');
  await page.keyboard.press('r');
  await game.expectInitialState();
});

test('reduced motion shows the boss title card without animation, then clears it', async ({ game, page }) => {
  // The card lives 1.8 s; a paused clock keeps the check independent of runner speed.
  await page.clock.install({ time: new Date('2026-01-01T09:00:00Z') });
  await game.open(`?render=simple&${ASSIST.slice(1)}`);
  await page.clock.pauseAt(new Date('2026-01-01T10:00:00Z'));
  await game.act('reconnect', 'clear-queue');
  await expect(game.bossCard).toBeVisible();
  await expect(game.bossCard).toContainText('BOSS 出现');
  expect(await game.bossCard.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await page.clock.runFor(1900);
  await expect(game.bossCard).toHaveCount(0);
});

test('reduced motion slows the timing needle', async ({ game, page }) => {
  // With reduced motion a sweep takes 2600 ms: at 400 ms the needle is only at ~0.31 (a miss);
  // at 650 ms it is at 0.5 (a hit).
  await page.clock.install({ time: new Date('2026-01-01T09:00:00Z') });
  await game.open('?render=simple');
  await page.clock.pauseAt(new Date('2026-01-01T10:00:00Z'));
  await game.act('reconnect', 'clear-queue', 'open-lid');
  await page.clock.runFor(650);
  await page.keyboard.press('Space');
  await expect(game.skillVerdict).toHaveText('成功！');
});
