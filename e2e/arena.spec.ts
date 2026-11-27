import { expect, requireWebGL, test } from './fixtures';
import { fileURLToPath } from 'node:url';

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
    // Software WebGL initialization and switching renderers can exceed the usual test budget on CI.
    test.setTimeout(60_000);
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

test.describe('vending machine opening story', () => {
  test.use({ reducedMotion: 'reduce' });

  test('tells its own story with its own illustrations', async ({ game, page }) => {
    await page.goto('./?level=vending-machine&render=simple&fx=0');
    await game.titleStart.click();
    for (const art of ['school-clock', 'coin-slot', 'insert-coin', 'vending-eyes']) {
      await expect(game.intro).toHaveAttribute('data-art', art);
      await expect(game.intro.locator(`.intro__art .intro-art--${art}`)).toBeVisible();
      await page.keyboard.press('Enter');
    }
    await expect(game.intro).toHaveCount(0);
    await expect(game.fight).toHaveAttribute('data-fight-id', 'vending-pay');
  });
});

let botScript: Promise<string> | null = null;

/** The in-page player (e2e/arenaPageBot.ts + tests/arenaBot.ts + the simulation), bundled once per worker. */
function bundleBot(): Promise<string> {
  botScript ??= import('rolldown').then(async ({ build }) => {
    const out = await build({
      input: fileURLToPath(new URL('./arenaPageBot.ts', import.meta.url)),
      write: false,
      output: { format: 'iife' },
      logLevel: 'silent',
    });
    return out.output[0].code;
  });
  return botScript;
}

test.describe('vending machine, whole level', () => {
  test('a scripted player beats all three fights with the keyboard', async ({ game, page }) => {
    // About two minutes of fight time, stepped frame by frame under the fake clock.
    // Alone it takes ~2.2 min; the full-window canvas makes software rendering slower
    // when other specs run alongside, so allow five minutes everywhere.
    test.setTimeout(300_000);
    await game.openPaused(`${LEVEL}&probe=1`);
    await page.addScriptTag({ content: await bundleBot() });
    await page.evaluate(() => (window as unknown as { installArenaBot: () => void }).installArenaBot());

    for (const [i, title] of ['吞币', '找零中', '出货失败：最终 Boss'].entries()) {
      await expect(game.phaseTitle).toHaveText(title);
      await expect(game.fight).toHaveAttribute('data-fight-id', ['vending-pay', 'vending-change', 'vending-boss'][i]!);
      await game.clearFight();
    }

    await expect(game.app).toHaveAttribute('data-outcome', /^(perfect|normal)$/);
    await expect(game.resultTitle).toHaveText(/^(你买到了一瓶水|饮料出来了)$/);
    const patience = Number((await game.patience.textContent())!.match(/(\d+) \/ 5/)![1]);
    expect(patience, 'a careful player takes at most a couple of hits').toBeGreaterThanOrEqual(3);
  });
});

test.describe('vending machine fills the window once a fight starts', () => {
  test('boss bar across the top, patience over the player, the page behind hidden', async ({ game, page }) => {
    await game.openPaused(LEVEL);
    // The briefing still shows in its panel, with the page around it.
    await expect(game.fight).not.toHaveAttribute('data-full');
    await expect(page.locator('.window')).toBeVisible();

    await game.fightStart.click();
    await expect(game.fight).toHaveAttribute('data-full', 'true');
    const vp = page.viewportSize()!;
    const box = (await game.fight.boundingBox())!;
    expect(box).toEqual({ x: 0, y: 0, width: vp.width, height: vp.height });
    await expect(page.locator('.window')).toBeHidden();
    await expect(page.locator('.window')).toHaveAttribute('inert', '');

    // The machine's health: one long bar across the top.
    const bar = page.getByTestId('arena-boss-bar');
    await expect(bar).toHaveAttribute('aria-valuenow', '100');
    const b = (await bar.boundingBox())!;
    expect(b.y, 'at the top').toBeLessThan(60);
    expect(b.width, 'most of the width').toBeGreaterThan(vp.width * 0.7);

    // Patience over the player (drawn on the floor; announced as text) drops when hit.
    const patience = page.getByTestId('arena-patience');
    await expect(patience).toHaveText('耐心 5 / 5');
    await game.runUntil(async () => (await game.log.count()) >= 1, { stepMs: 500, maxMs: 30_000 });
    await expect(patience).toHaveText('耐心 4 / 5');
    await game.expectNoHorizontalOverflow();

    // The pause menu stands in for the covered title bar.
    await page.keyboard.press('Escape');
    const menu = page.locator('.fight__paused');
    await expect(menu.getByRole('button', { name: /^声音/ })).toBeVisible();
    await menu.getByRole('button', { name: '重开' }).click();
    await expect(game.fight).not.toHaveAttribute('data-full');
    await expect(game.fightStart).toBeVisible();
    await expect(page.locator('.window')).toBeVisible();
  });

  test('winning a fight returns to the next briefing in its panel', async ({ game, page }) => {
    test.setTimeout(60_000);
    await game.openPaused(`${LEVEL}&probe=1`);
    await page.addScriptTag({ content: await bundleBot() });
    await page.evaluate(() => (window as unknown as { installArenaBot: () => void }).installArenaBot());
    await game.clearFight();
    await expect(game.fight).toHaveAttribute('data-fight-id', 'vending-change');
    await expect(game.fight).not.toHaveAttribute('data-full');
    await expect(game.fightStart).toBeVisible();
  });
});

test.describe('vending machine full window on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the stick and buttons sit inside the screen, under the boss bar', async ({ game, page }) => {
    await game.openPaused(LEVEL);
    await game.fightStart.click();
    await expect(game.fight).toHaveAttribute('data-full', 'true');
    await game.expectNoHorizontalOverflow();
    const stick = (await page.getByTestId('arena-stick').boundingBox())!;
    const attack = (await page.locator('[data-ability="attack"]').boundingBox())!;
    const bar = (await page.getByTestId('arena-boss-bar').boundingBox())!;
    for (const r of [stick, attack]) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(390);
      expect(r.y + r.height).toBeLessThanOrEqual(844);
      expect(r.y).toBeGreaterThan(bar.y + bar.height);
    }
  });
});
