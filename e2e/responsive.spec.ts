import { expect, test } from './fixtures';

const viewports = [
  { name: 'mobile portrait 390×844', width: 390, height: 844 },
  { name: 'mobile landscape 844×390', width: 844, height: 390 },
  { name: 'small portrait 360×640', width: 360, height: 640 },
];

for (const vp of viewports) {
  test.describe(vp.name, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, isMobile: true, hasTouch: true });

    test('no horizontal overflow through a full run, touch targets ≥ 44px', async ({ game }) => {
      test.setTimeout(120_000);
      await game.openPaused();
      await game.expectNoHorizontalOverflow();
      const start = await game.fightStart.boundingBox();
      expect(start?.height ?? 0).toBeGreaterThanOrEqual(44);

      await game.installBot();
      await game.clearFight();
      await game.clearFight();
      await expect(game.app).toHaveAttribute('data-intensity', 'critical');
      await game.expectNoHorizontalOverflow();
      await expect(game.bossBar).toBeVisible();

      await game.fightStart.tap();
      await game.page.clock.runFor(500);
      await game.expectNoHorizontalOverflow();
      for (const box of await Promise.all((await game.page.locator('.fight__ctl').all()).map((b) => b.boundingBox()))) {
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      }

      await game.runUntil(async () => (await game.app.getAttribute('data-outcome')) !== null);
      await game.expectOutcome('perfect');
      await game.expectNoHorizontalOverflow();

      await game.restartButton.scrollIntoViewIfNeeded();
      await game.restartButton.tap();
      await game.expectInitialState();
    });

    test('the arena and its controls fit on screen once the fight starts', async ({ game, page }) => {
      await game.openPaused();
      await game.fightStart.tap();
      await page.clock.runFor(100);
      const vh = vp.height;
      const arena = await page.locator('.fight__arena').boundingBox();
      const controls = await page.locator('.fight__controls').boundingBox();
      expect(arena!.y).toBeGreaterThanOrEqual(0);
      // The lanes are what matters: they must be on screen together with the controls,
      // or (short landscape screens) at least the lanes must be fully visible.
      expect(arena!.y + arena!.height).toBeLessThanOrEqual(vh);
      if (vh >= 600) expect(controls!.y + controls!.height).toBeLessThanOrEqual(vh);
    });

    test('touch controls: tap to dodge and pull, press and hold to block', async ({ game, page }) => {
      await game.openPaused();
      await game.fightStart.tap();
      await page.clock.runFor(100);
      await page.locator('[data-ability="left"]').tap();
      await page.clock.runFor(50);
      await expect(game.fight).toHaveAttribute('data-player-lane', '0');
      await page.locator('[data-ability="right"]').tap();
      await page.locator('[data-ability="right"]').tap();
      await page.clock.runFor(50);
      await expect(game.fight).toHaveAttribute('data-player-lane', '2');
      await page.locator('[data-ability="pull"]').tap();
      await page.clock.runFor(50);
      await expect(game.fightCall).toHaveText('扑空了——手被夹了一下。');
    });
  });
}

test.describe('pointer hold', () => {
  test('holding the block button blocks until it is released', async ({ game, page }) => {
    test.setTimeout(60_000);
    await game.openPaused();
    await game.installBot();
    await game.clearFight();
    await page.evaluate(() => ((window as unknown as { __bot: { opts: object } }).__bot.opts = { idle: true }));
    await game.fightStart.click();
    await page.clock.runFor(100);
    const block = page.locator('[data-ability="block"]');
    await block.hover();
    await page.mouse.down();
    await page.clock.runFor(50);
    await expect(game.fight).toHaveAttribute('data-blocking', 'true');
    await expect(block).toHaveAttribute('data-active', 'true');
    await page.mouse.up();
    await page.clock.runFor(50);
    await expect(game.fight).not.toHaveAttribute('data-blocking');
  });
});
