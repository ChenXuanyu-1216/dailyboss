import { test, expect, FIGHT_IDS } from './fixtures';

/** The printer's three-lane fights fill the browser window once started, like the vending machine's. */
test.describe('printer fight fills the window once it starts', () => {
  test('boss bar across the top, patience pips over the player, the page behind hidden', async ({ game, page }) => {
    await game.openPaused();
    // The briefing still shows in its panel, with the page around it.
    await expect(game.fight).not.toHaveAttribute('data-full');
    await expect(page.locator('.window')).toBeVisible();

    await game.fightStart.click();
    await expect(game.fight).toHaveAttribute('data-full', 'true');
    const vp = page.viewportSize()!;
    expect(await game.fight.boundingBox()).toEqual({ x: 0, y: 0, width: vp.width, height: vp.height });
    await expect(page.locator('.window')).toBeHidden();
    await expect(page.locator('.window')).toHaveAttribute('inert', '');

    const bar = game.fight.getByRole('progressbar', { name: '重新连接' });
    await expect(bar).toHaveAttribute('aria-valuenow', '0');
    await expect(game.fight.getByText('重新连接', { exact: true })).toBeVisible();
    const b = (await bar.boundingBox())!;
    expect(b.y, 'at the top').toBeLessThan(60);
    expect(b.width, 'most of the width').toBeGreaterThan(vp.width * 0.7);

    // Patience: a row of segments just over the player, all lit.
    const pips = page.getByTestId('player-patience');
    const lit = pips.locator('[data-on]');
    await expect(lit).toHaveCount(5);
    const p = (await pips.boundingBox())!;
    const you = (await page.locator('.fight__avatar').boundingBox())!;
    expect(p.y + p.height, 'above the player').toBeLessThanOrEqual(you.y);
    expect(Math.abs(p.x + p.width / 2 - (you.x + you.width / 2)), 'centred on the player').toBeLessThan(2);

    // Standing still gets you hit: one segment goes out, and the HUD says so.
    await game.runUntil(async () => (await game.log.count()) >= 1, { stepMs: 500, maxMs: 30_000 });
    await expect(lit).toHaveCount(4);
    await expect(page.getByTestId('fight-patience')).toHaveText('耐心 4 / 5');
    await game.expectNoHorizontalOverflow();

    // The pause menu stands in for the covered title bar.
    await page.keyboard.press('Escape');
    const menu = page.locator('.fight__paused');
    await expect(menu.getByRole('button', { name: /^声音/ })).toBeVisible();
    const assist = menu.getByRole('button', { name: '辅助模式' });
    await expect(assist).toHaveAttribute('aria-pressed', 'false');
    await assist.click();
    await expect(assist).toHaveAttribute('aria-pressed', 'true');
    await menu.getByRole('button', { name: '重开' }).click();
    await expect(game.fight).not.toHaveAttribute('data-full');
    await expect(game.fightStart).toBeVisible();
    await expect(page.locator('.window')).toBeVisible();
    await expect(game.assistToggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('winning a fight returns to the next briefing in its panel', async ({ game, page }) => {
    await game.openPaused();
    await game.installBot();
    await game.fightStart.click();
    const progress = game.fight.getByRole('progressbar', { name: '重新连接' });
    await game.runUntil(async () => (await progress.getAttribute('aria-valuenow')) === '50', { stepMs: 500 });
    await game.runUntil(async () => (await game.fight.getAttribute('data-fight-id')) === FIGHT_IDS[1]);
    await expect(game.fight).toHaveAttribute('data-fight-id', FIGHT_IDS[1]);
    await expect(game.fight).not.toHaveAttribute('data-full');
    await expect(page.locator('.window')).not.toHaveAttribute('inert');
    // The page is back in the same render, so the next briefing can take focus.
    await expect(game.fightStart).toBeFocused();
  });
});

for (const [name, viewport] of [
  ['portrait phone', { width: 390, height: 844 }],
  ['landscape phone', { width: 844, height: 390 }],
] as const) {
  test.describe(`printer full window on a ${name}`, () => {
    test.use({ viewport, hasTouch: true });

    test('lanes under the boss bar, buttons under the lanes, all on screen', async ({ game, page }) => {
      await game.openPaused();
      await game.fightStart.click();
      await expect(game.fight).toHaveAttribute('data-full', 'true');
      await game.expectNoHorizontalOverflow();
      const bar = (await page.getByTestId('fight-boss-bar').boundingBox())!;
      const lanes = (await page.locator('.fight__arena').boundingBox())!;
      expect(lanes.y).toBeGreaterThan(bar.y + bar.height);
      expect(lanes.height, 'room to see the sheets coming').toBeGreaterThan(viewport.height * 0.45);
      for (const ctl of await page.locator('.fight__ctl').all()) {
        const r = (await ctl.boundingBox())!;
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(viewport.width);
        expect(r.y).toBeGreaterThanOrEqual(lanes.y + lanes.height);
        expect(r.y + r.height).toBeLessThanOrEqual(viewport.height);
        expect(r.height, 'thumb-sized').toBeGreaterThanOrEqual(44);
      }
    });
  });
}
