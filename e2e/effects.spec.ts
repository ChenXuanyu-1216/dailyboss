import { expect, test } from './fixtures';

/** Fraction of the effects canvas covered by drawn (non-transparent) pixels. */
async function coverage(page: import('@playwright/test').Page): Promise<number> {
  return page.locator('.fight__fx').evaluate((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')!;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let drawn = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 8) drawn++;
    return drawn / (canvas.width * canvas.height);
  });
}

test('the particle layer covers the arena, ignores input, and draws fight events', async ({ game, page }) => {
  test.setTimeout(90_000);
  await game.openPaused('render=simple', { fx: true });
  await game.installBot();
  await game.fightStart.click();

  const fx = page.locator('.fight__fx');
  await expect(fx).toHaveAttribute('aria-hidden', 'true');
  await expect(fx).toHaveCSS('pointer-events', 'none');
  await expect(game.fight).toHaveAttribute('data-fx', 'true');
  const [canvasBox, arenaBox] = await Promise.all([fx.boundingBox(), page.locator('.fight__arena').boundingBox()]);
  expect(canvasBox).toEqual(arenaBox);

  // A dodged sheet shreds on the floor.
  await game.runUntil(async () => (await game.fightCall.textContent()) === '闪开了。', { stepMs: 50, maxMs: 6000 });
  expect(await coverage(page)).toBeGreaterThan(0);

  // Win the warm-up, then stand in the queue fight's toner spray.
  await game.runUntil(async () => (await game.fight.getAttribute('data-fight-id')) === 'printer-queue', {
    stepMs: 500,
    maxMs: 30_000,
  });
  await page.evaluate(() => ((window as unknown as { __bot: { opts: object } }).__bot.opts = { idle: true }));
  await game.fightStart.click();
  await game.runUntil(async () => (await game.fight.getAttribute('data-toner')) === 'active', { stepMs: 100, maxMs: 4000 });
  await page.clock.runFor(400);
  expect(await coverage(page), 'the spray fills a good part of the arena').toBeGreaterThan(0.2);
  await expect(game.fightCall).toHaveText('被墨粉喷中！');
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('no particle layer, even when effects are on', async ({ game, page }) => {
    await game.openPaused('render=simple', { fx: true });
    await game.fightStart.click();
    await page.clock.runFor(500);
    await expect(page.locator('.fight__fx')).toHaveCount(0);
    await expect(game.fight).not.toHaveAttribute('data-fx');
  });
});

test('?fx=0 turns the particle layer off', async ({ game, page }) => {
  await game.openPaused();
  await game.fightStart.click();
  await page.clock.runFor(500);
  await expect(page.locator('.fight__fx')).toHaveCount(0);
});
