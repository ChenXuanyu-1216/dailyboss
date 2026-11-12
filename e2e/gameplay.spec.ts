import { FIGHT_IDS, MAX_PATIENCE, PHASE_TITLES, expect, test } from './fixtures';

// Every phase is a real-time fight. These tests run under Playwright's fake clock with a fixed
// seed; an in-page bot (e2e/fixtures.ts) plays by reading the arena and pressing real keys.

test.describe('endings', () => {
  test('perfect: three fights won without a hit, result panel, terminal lock', async ({ game, page }) => {
    test.setTimeout(90_000);
    await game.openPaused();
    await game.expectInitialState();
    await expect(game.assistToggle).toHaveAttribute('aria-pressed', 'false');
    await game.installBot();

    await game.clearFight();
    await expect(game.phaseTitle).toHaveText(PHASE_TITLES[1]);
    await expect(game.app).toHaveAttribute('data-intensity', 'warning');
    await expect(game.feedback).toContainText('你把 USB 线插了回去');
    await expect(game.feedback).toContainText('局面变化：队列堵塞');
    await expect(game.fight).toHaveAttribute('data-fight-id', FIGHT_IDS[1]);
    await expect(game.bossBar).toHaveCount(0);

    await game.clearFight();
    await expect(game.phaseTitle).toHaveText(PHASE_TITLES[2]);
    await expect(game.app).toHaveAttribute('data-intensity', 'critical');
    await game.expectBossHealth(100);

    await game.clearFight();
    await game.expectOutcome('perfect');
    await game.expectBossHealth(0);
    await expect(game.resultBadge).toContainText('完美结局');
    await expect(game.resultTitle).toHaveText('你打印了一张纸');
    await expect(game.victoryPrint).toContainText('成功打印一张纸');
    await expect(page.locator('.result__stats')).toContainText('被击中0');
    await game.expectPatience(MAX_PATIENCE);
    await expect(game.restartButton).toBeFocused();
    await expect(game.log).toHaveText([/通过：打印机离线/, /通过：队列堵塞/, /通过：卡纸：最终 Boss/]);

    // Fight keys do nothing once the run is over.
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('1');
    await game.expectOutcome('perfect');
  });

  test('normal: hits cost patience, are shown and logged, and the boss still falls', async ({ game, page }) => {
    test.setTimeout(90_000);
    await game.openPaused();
    await game.installBot({ takeHits: 2 });
    await game.fightStart.click();
    await game.runUntil(async () => (await game.log.count()) >= 1, { stepMs: 500 });
    await expect(game.log.first()).toHaveText(/被纸砸中\s*耐心 −1/);
    await expect(game.hurtPop).toHaveText('−1 耐心');
    await expect(game.feedback).toContainText('一张纸糊在了你脸上。耐心 −1，剩余 4。');
    await game.expectPatience(4);

    await game.runUntil(async () => (await game.phaseTitle.textContent()) === PHASE_TITLES[1]);
    await game.playThrough();
    await game.expectOutcome('normal');
    await expect(game.resultBadge).toContainText('普通结局');
    await expect(game.resultTitle).toHaveText('纸出来了');
    await expect(game.victoryPrint).toBeVisible();
    await expect(page.locator('.result__stats')).toContainText('被击中2');
    await game.expectPatience(3);
  });

  test('failure: standing still loses all patience in the first fight', async ({ game }) => {
    await game.openPaused();
    await game.installBot({ idle: true });
    await game.fightStart.click();
    await game.runUntil(async () => (await game.app.getAttribute('data-outcome')) !== null, { stepMs: 1000 });
    await game.expectOutcome('failure');
    await expect(game.resultBadge).toContainText('挑战失败');
    await expect(game.resultTitle).toHaveText('耐心已耗尽');
    await expect(game.victoryPrint).toHaveCount(0);
    await game.expectPatience(0);
    await expect(game.log).toHaveCount(MAX_PATIENCE);
    await expect(game.feedback).toContainText('耐心已耗尽');
  });
});

test.describe('fight controls', () => {
  test('the briefing teaches the new abilities and Start (focused) begins the fight', async ({ game, page }) => {
    await game.openPaused();
    await expect(game.fightStart).toBeFocused();
    const kit = page.locator('.fight__kit-item');
    await expect(kit).toHaveCount(2);
    await expect(kit.filter({ hasText: '新技能' })).toHaveCount(2);
    await expect(game.fight).not.toHaveAttribute('data-started');

    await page.keyboard.press('Enter');
    await expect(game.fight).toHaveAttribute('data-started', 'true');
    await expect(page.locator('.fight__ctl')).toHaveCount(3); // dodge left, pull, dodge right
    await expect(game.fight).toHaveAttribute('data-player-lane', '1');
  });

  test('arrow keys and A / D move between the three lanes, clamped at the edges', async ({ game, page }) => {
    await game.openPaused();
    await game.fightStart.click();
    for (const [key, lane] of [
      ['ArrowLeft', '0'],
      ['ArrowLeft', '0'],
      ['KeyD', '1'],
      ['ArrowRight', '2'],
      ['ArrowRight', '2'],
      ['KeyA', '1'],
    ] as const) {
      await page.keyboard.press(key === 'KeyA' ? 'a' : key === 'KeyD' ? 'd' : key);
      await page.clock.runFor(50);
      await expect(game.fight).toHaveAttribute('data-player-lane', lane);
    }
  });

  test('a telegraphed sheet hits the lane that glowed; stepping aside dodges it', async ({ game, page }) => {
    await game.openPaused();
    await game.fightStart.click();
    await page.clock.runFor(1400); // first shot: aimed at the middle lane, telegraphing
    await expect(page.locator('.fight__lane[data-warn]')).toHaveAttribute('data-lane', '1');
    await page.keyboard.press('ArrowLeft');
    await page.clock.runFor(1600);
    await expect(game.fightCall).toHaveText('闪开了。');
    await game.expectPatience(MAX_PATIENCE);

    // The second shot follows the player; staying put is a hit.
    await game.runUntil(async () => (await game.log.count()) >= 1, { stepMs: 200, maxMs: 5000 });
    await game.expectPatience(MAX_PATIENCE - 1);
  });

  test('pulling at nothing whiffs and locks the hand for a moment', async ({ game, page }) => {
    await game.openPaused();
    await game.fightStart.click();
    await page.clock.runFor(100);
    await page.keyboard.press('ArrowUp');
    await page.clock.runFor(50);
    await expect(game.fightCall).toHaveText('扑空了——手被夹了一下。');
    await expect(game.fight).not.toHaveAttribute('data-pull-ready');
    await expect(page.locator('[data-ability="pull"]')).toContainText('手被夹住');
    await page.clock.runFor(700);
    await expect(game.fight).toHaveAttribute('data-pull-ready', 'true');
  });

  test('Escape pauses (time stops) and resumes; losing window focus pauses too', async ({ game, page }) => {
    await game.openPaused();
    await game.fightStart.click();
    await page.clock.runFor(1400);
    await expect(page.locator('[data-testid="paper"]')).toHaveCount(1);
    const impact = await page.locator('[data-testid="paper"]').getAttribute('data-impact-ms');

    await page.keyboard.press('Escape');
    await expect(game.fight).toHaveAttribute('data-paused', 'true');
    await expect(page.getByRole('button', { name: /继续/ }).last()).toBeFocused();
    await page.clock.runFor(10_000);
    await expect(page.locator('[data-testid="paper"]')).toHaveAttribute('data-impact-ms', impact!);
    await game.expectPatience(MAX_PATIENCE);

    await page.keyboard.press('Escape');
    await expect(game.fight).not.toHaveAttribute('data-paused');
    await page.clock.runFor(100);
    expect(Number(await page.locator('[data-testid="paper"]').getAttribute('data-impact-ms'))).toBeLessThan(
      Number(impact),
    );

    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(game.fight).toHaveAttribute('data-paused', 'true');
  });

  test('assist mode slows fight time to 65%', async ({ game, page }) => {
    await game.openPaused('render=simple&assist=1');
    await expect(game.assistToggle).toHaveAttribute('aria-pressed', 'true');
    await game.fightStart.click();
    // The first shot comes 1200 ms of fight time after the start: ~1850 ms of real time at 65%.
    await page.clock.runFor(1500);
    await expect(page.locator('[data-testid="paper"]')).toHaveCount(0);
    await page.clock.runFor(500);
    await expect(page.locator('[data-testid="paper"]')).toHaveCount(1);
  });

  test('the queue fight teaches block and reset: blocking stops toner, reset interrupts the charge', async ({
    game,
    page,
  }) => {
    test.setTimeout(60_000);
    await game.openPaused();
    await game.installBot();
    await game.clearFight();
    await expect(game.fight).toHaveAttribute('data-fight-id', FIGHT_IDS[1]);
    await expect(page.locator('.fight__kit-item[data-new]')).toHaveText([/格挡/, /重启/]);
    await page.evaluate(() => ((window as unknown as { __bot: { opts: object } }).__bot.opts = { idle: true }));
    await game.fightStart.click();

    // Toner: warning from 1200 ms, spray from 2300 ms to 3100 ms of fight time.
    await page.clock.runFor(1500);
    await expect(game.fight).toHaveAttribute('data-toner', 'warn');
    await page.keyboard.down('ArrowDown');
    await page.clock.runFor(1800);
    await expect(game.fightCall).toHaveText('挡住了墨粉。');
    await page.keyboard.up('ArrowDown');
    await game.expectPatience(MAX_PATIENCE);

    await game.runUntil(async () => (await game.fight.getAttribute('data-charging')) === 'true', {
      stepMs: 200,
      maxMs: 3000,
    });
    await page.keyboard.down('k');
    await page.clock.runFor(800);
    await page.keyboard.up('k');
    await expect(game.fightCall).toHaveText('重启成功，打断了它！');
    await expect(page.getByTestId('weak-point')).toBeVisible();
  });
});

test.describe('restart', () => {
  test('R restarts mid-fight and after an ending, and the new run is independent', async ({ game, page }) => {
    test.setTimeout(60_000);
    await game.openPaused();
    await game.installBot({ idle: true });
    await game.fightStart.click();
    await game.runUntil(async () => (await game.log.count()) >= 2, { stepMs: 500 });
    await page.keyboard.press('r');
    await game.expectInitialState();

    await game.fightStart.click();
    await game.runUntil(async () => (await game.app.getAttribute('data-outcome')) !== null, { stepMs: 1000 });
    await game.expectOutcome('failure');
    await page.keyboard.press('r');
    await game.expectInitialState();
    await expect(game.fightStart).toBeFocused();
  });

  test('Enter on the focused result button restarts', async ({ game, page }) => {
    await game.openPaused();
    await game.installBot({ idle: true });
    await game.fightStart.click();
    await game.runUntil(async () => (await game.app.getAttribute('data-outcome')) !== null, { stepMs: 1000 });
    await expect(game.restartButton).toBeFocused();
    await page.keyboard.press('Enter');
    await game.expectInitialState();
  });

  test('header restart works during the boss fight', async ({ game }) => {
    test.setTimeout(60_000);
    await game.openPaused();
    await game.installBot();
    await game.clearFight();
    await game.clearFight();
    await expect(game.bossBar).toBeVisible();
    await game.headerRestart.click();
    await game.expectInitialState();
  });

  test('keys are ignored when modifiers are held', async ({ game, page }) => {
    await game.openPaused();
    await game.fightStart.click();
    await page.keyboard.press('Control+ArrowLeft');
    await page.keyboard.press('Alt+ArrowRight');
    await page.keyboard.press('Control+r');
    await page.clock.runFor(50);
    await expect(game.fight).toHaveAttribute('data-player-lane', '1');
    await expect(game.fight).toHaveAttribute('data-started', 'true');
  });
});

test.describe('boss presentation', () => {
  test('the boss title card appears on entering the boss fight and then clears', async ({ game, page }) => {
    test.setTimeout(60_000);
    await game.openPaused();
    await game.installBot();
    await game.clearFight();
    await expect(game.bossCard).toHaveCount(0);
    await game.clearFight();
    await expect(game.bossCard).toBeVisible();
    await expect(game.bossCard).toContainText('BOSS 出现');
    await expect(game.bossCard).toContainText('地狱打印机');
    await expect(game.bossCard).toHaveCSS('pointer-events', 'none');
    await page.clock.runFor(1900);
    await expect(game.bossCard).toHaveCount(0);
  });

  test('the boss bar follows the boss HP and stages announce themselves', async ({ game, page }) => {
    test.setTimeout(90_000);
    await game.openPaused();
    await game.installBot();
    await game.clearFight();
    await game.clearFight();
    await game.fightStart.click();
    await expect(page.locator('#fight-heading')).toHaveText('第一形态：盖板');
    await game.runUntil(async () => (await game.bossBar.getAttribute('aria-valuenow')) === '92', { stepMs: 250 });
    await game.runUntil(async () => (await page.locator('#fight-heading').textContent()) === '第二形态：拔河', {
      stepMs: 250,
    });
    await game.expectBossHealth(67);
    await expect(page.locator('.fight__banner')).toContainText('第二形态：拔河');
  });
});

test.describe('configuration errors', () => {
  test('an unknown level shows a readable configuration error', async ({ game, page }) => {
    await page.goto('./?level=missing-level');
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert.getByRole('heading', { name: '关卡配置无法加载' })).toBeVisible();
    await expect(alert).toContainText('找不到关卡 "missing-level"');
    await expect(alert).toContainText('printer-from-hell');
    await expect(game.fight).toHaveCount(0);
  });
});
