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

  test('the touch stick moves the player; the attack button attacks; dash waits for its fight', async ({
    game,
    page,
  }) => {
    await game.openPaused(LEVEL);
    await game.fightStart.click();
    const stick = page.getByTestId('arena-stick');
    const attack = page.locator('[data-ability="attack"]');
    await expect(page.locator('[data-ability="dash"]')).toHaveCount(0);

    const box = (await stick.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const x0 = Number(await game.fight.getAttribute('data-player-x'));
    const y0 = Number(await game.fight.getAttribute('data-player-y'));
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 60, cy, { steps: 3 });
    await page.clock.runFor(400);
    await page.mouse.up();
    await page.clock.runFor(50);
    const x1 = Number(await game.fight.getAttribute('data-player-x'));
    expect(x1 - x0, 'moved left').toBeLessThan(-0.5);
    expect(Math.abs(Number(await game.fight.getAttribute('data-player-y')) - y0)).toBeLessThan(0.2);

    // Released: the player stops.
    await page.clock.runFor(300);
    expect(Number(await game.fight.getAttribute('data-player-x'))).toBeCloseTo(x1, 1);

    await expect(attack).toHaveAttribute('data-ready', 'true');
    await attack.dispatchEvent('pointerdown', { pointerId: 2, isPrimary: true });
    await page.clock.runFor(50);
    await expect(attack).not.toHaveAttribute('data-ready');
    await page.clock.runFor(500);
    await expect(attack).toHaveAttribute('data-ready', 'true');
  });

  test('Space activates the focused arena attack button', async ({ game, page }) => {
    await game.openPaused(LEVEL);
    await game.fightStart.click();
    const attack = page.getByRole('button', { name: '攻击' });

    await expect(attack).toHaveAttribute('data-ready', 'true');
    await attack.focus();
    await page.keyboard.press('Space');
    await page.clock.runFor(50);
    await expect(attack).not.toHaveAttribute('data-ready');
  });

  test('draws the floor in 3D with a follow camera, and in 2D with the simplified display', async ({ game, page }) => {
    await page.goto('./');
    await requireWebGL(game);
    await game.open('?level=vending-machine');
    await expect(game.canvas.first()).toBeVisible();
    await expect(page.getByRole('region', { name: '售货机状态' })).toBeVisible();

    await game.fightStart.click();
    await expect(game.fight).toHaveAttribute('data-view', '3d');
    await expect(page.getByTestId('arena-3d').locator('canvas')).toBeVisible();
    const x0 = Number(await game.fight.getAttribute('data-player-x'));
    await page.keyboard.down('KeyD');
    await expect.poll(async () => Number(await game.fight.getAttribute('data-player-x'))).toBeGreaterThan(x0 + 0.5);
    await page.keyboard.up('KeyD');

    await game.simplifiedToggle.click();
    await expect(game.fight).toHaveAttribute('data-view', '2d');
    await expect(page.getByTestId('arena-canvas')).toBeVisible();
    await expect(page.getByTestId('arena-3d')).toHaveCount(0);
  });
});

test.describe('vending machine on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the stick and buttons fit without sideways scrolling, and a tap attacks', async ({ game, page }) => {
    await game.openPaused(LEVEL);
    await game.fightStart.click();
    const stick = page.getByTestId('arena-stick');
    const attack = page.locator('[data-ability="attack"]');
    await expect(stick).toBeVisible();
    await expect(attack).toBeVisible();
    await game.expectNoHorizontalOverflow();
    const s = (await stick.boundingBox())!;
    const a = (await attack.boundingBox())!;
    expect(s.width, 'stick is thumb-sized').toBeGreaterThanOrEqual(100);
    expect(a.x, 'attack sits right of the stick').toBeGreaterThan(s.x + s.width);

    await attack.tap();
    await page.clock.runFor(50);
    await expect(attack).not.toHaveAttribute('data-ready');
  });
});

test.describe('vending machine with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the 3D floor still renders (fixed overview camera) and the fight runs', async ({ game, page }) => {
    await page.goto('./');
    await requireWebGL(game);
    await game.open('?level=vending-machine');
    await game.fightStart.click();
    await expect(game.fight).toHaveAttribute('data-view', '3d');
    await expect(page.getByTestId('arena-3d').locator('canvas')).toBeVisible();
    const x0 = Number(await game.fight.getAttribute('data-player-x'));
    await page.keyboard.down('KeyA');
    await expect.poll(async () => Number(await game.fight.getAttribute('data-player-x'))).toBeLessThan(x0 - 0.5);
    await page.keyboard.up('KeyA');
  });
});
