import { expect, requireWebGL, test } from './fixtures';

// Boss #2 (the vending machine) in a real browser: reachable by URL, an open-arena fight the
// player walks around in with the keyboard. Runs under the fake clock with a fixed seed.

const LEVEL = 'level=vending-machine&render=simple';

test.describe('vending machine (open arena)', () => {
  test('is reachable by URL and opens on the first arena fight', async ({ game, page }) => {
    await game.openPaused(LEVEL);
    await expect(game.app).toHaveAttribute('data-arena', 'true');
    await expect(game.phaseTitle).toHaveText('吞币');
    await expect(game.fight).toHaveAttribute('data-kind', 'arena');
    await expect(game.fight).toHaveAttribute('data-fight-id', 'vending-pay');
    await expect(page.getByTestId('arena-canvas')).toBeVisible();
    await expect(game.fightStart).toBeVisible();
    await game.expectNoHorizontalOverflow();
  });

  test('the keyboard moves the player; Escape pauses', async ({ game, page }) => {
    await game.openPaused(LEVEL);
    await game.fightStart.click();
    await expect(game.fight).toHaveAttribute('data-started', 'true');
    const x0 = Number(await game.fight.getAttribute('data-player-x'));

    await page.keyboard.down('KeyD');
    await page.clock.runFor(400);
    await page.keyboard.up('KeyD');
    await page.clock.runFor(50);
    const x1 = Number(await game.fight.getAttribute('data-player-x'));
    expect(x1 - x0, 'moved right').toBeGreaterThan(0.5);

    await page.keyboard.down('ArrowLeft');
    await page.clock.runFor(200);
    await page.keyboard.up('ArrowLeft');
    await page.clock.runFor(50);
    expect(Number(await game.fight.getAttribute('data-player-x'))).toBeLessThan(x1);

    await page.keyboard.press('Escape');
    await expect(game.fight).toHaveAttribute('data-paused', 'true');
  });

  test('standing still gets the player hit and costs patience', async ({ game }) => {
    test.setTimeout(60_000);
    await game.openPaused(LEVEL);
    await game.fightStart.click();
    await game.runUntil(async () => (await game.log.count()) >= 1, { stepMs: 500, maxMs: 30_000 });
    await game.expectPatience(4);
    await expect(game.log.first()).toHaveText(/被硬币砸中|被跳砸压中|踩进汽水|被摇晃撞到/);
  });

  test('renders the 3D vending machine beside the arena', async ({ game }) => {
    await game.page.goto('./');
    await requireWebGL(game);
    await game.open('?level=vending-machine');
    await expect(game.canvas).toBeVisible();
    await expect(game.page.getByRole('region', { name: '售货机状态' })).toBeVisible();
  });
});
