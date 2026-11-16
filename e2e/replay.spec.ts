import type { Page } from '@playwright/test';
import { expect, test, type GamePage } from './fixtures';

/**
 * Iteration 5: reasons to replay (clear time, personal best, a tip, boss practice), the boss's
 * mastery techniques (heavy pull), sound, and backdrop motion.
 */

const CLOCK_START = new Date('2026-01-01T09:00:00Z').getTime();

/** Opens the title under the fake clock (paused once in the game), fixed seed, simplified display, no particles. */
async function openTitle(page: Page, extra = '') {
  await page.clock.install({ time: CLOCK_START });
  await page.goto(`./?seed=7&render=simple&fx=0${extra}`);
}

async function startPractice(page: Page, game: GamePage) {
  await page.getByTestId('title-practice').click();
  await page.clock.pauseAt(CLOCK_START + 3_600_000);
  await expect(game.app).toHaveAttribute('data-mode', 'boss');
  await expect(game.fight).toHaveAttribute('data-fight-id', 'printer-boss');
}

async function finishRun(game: GamePage) {
  await game.runUntil(async () => (await game.app.getAttribute('data-outcome')) !== null);
}

test.describe('boss practice and records', () => {
  test('losing before reaching the boss does not unlock practice on the result screen', async ({ game, page }) => {
    await game.openPaused();
    await game.installBot({ idle: true });
    await game.fightStart.click();
    await finishRun(game);
    await game.expectOutcome('failure');
    await expect(page.getByTestId('switch-mode')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('title-practice')).toHaveCount(0);
  });

  test('previously unlocked practice remains available after an early full-run loss', async ({ game, page }) => {
    await game.openPaused('render=simple&practice=1');
    await game.installBot({ idle: true });
    await game.fightStart.click();
    await finishRun(game);
    await game.expectOutcome('failure');
    await page.getByTestId('switch-mode').click();
    await expect(game.app).toHaveAttribute('data-mode', 'boss');
    await expect(game.fight).toHaveAttribute('data-fight-id', 'printer-boss');
  });

  test('practice is hidden on a first visit and unlocks once the boss is reached', async ({ game, page }) => {
    test.setTimeout(90_000);
    await page.goto('./');
    await expect(game.titleScreen).toBeVisible();
    await expect(page.getByTestId('title-practice')).toHaveCount(0);

    await game.openPaused();
    await game.installBot();
    await game.clearFight();
    await game.clearFight();
    await expect(game.app).toHaveAttribute('data-intensity', 'critical');

    await page.reload();
    await expect(page.getByTestId('title-practice')).toBeVisible();
  });

  test('practice skips the warm-ups and the story; a win shows time, a tip and a recorded best', async ({
    game,
    page,
  }) => {
    test.setTimeout(120_000);
    await openTitle(page, '&practice=1');
    await startPractice(page, game);
    await expect(game.intro).toHaveCount(0);
    await game.installBot({ takeHits: 1 });
    await game.fightStart.click();
    await finishRun(game);

    await expect(game.resultBadge).toContainText('练习');
    await expect(page.getByTestId('result-time')).toHaveText(/^\d:\d\d\.\d/);
    await expect(page.getByTestId('result-time')).toContainText('新纪录');
    await expect(page.getByTestId('result-hits')).toHaveText(/^1/);
    await expect(page.getByTestId('result-tip')).toContainText('被纸砸中');
    const stored = await page.evaluate(() => localStorage.getItem('dailyboss:records:printer-from-hell'));
    expect(JSON.parse(stored!)).toMatchObject({ boss: { hits: 1 } });

    // R practises again, still in the boss phase, with a fresh tally.
    await page.keyboard.press('r');
    await expect(game.fight).toHaveAttribute('data-fight-id', 'printer-boss');
    await expect(game.fight).toHaveAttribute('data-hits', '0');
    await expect(game.app).toHaveAttribute('data-mode', 'boss');
  });

  test('the result screen switches between practice and the full run', async ({ game, page }) => {
    test.setTimeout(120_000);
    await openTitle(page, '&practice=1');
    await startPractice(page, game);
    await game.installBot({ idle: true });
    await game.fightStart.click();
    await finishRun(game);
    await game.expectOutcome('failure');
    await expect(page.getByTestId('result-time')).not.toContainText('新纪录');
    await expect(page.getByTestId('switch-mode')).toHaveText('完整挑战');
    await page.getByTestId('switch-mode').click();
    await expect(game.app).toHaveAttribute('data-mode', 'full');
    await game.expectInitialState();
  });

  test('assist runs are not recorded', async ({ game, page }) => {
    test.setTimeout(120_000);
    await openTitle(page, '&practice=1&assist=1');
    await startPractice(page, game);
    await game.installBot();
    await game.fightStart.click();
    await finishRun(game);
    await expect(page.getByText('不计入最佳成绩')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('dailyboss:records:printer-from-hell'))).toBeNull();
  });

  test('changing assist settings before starting does not disqualify an unassisted first run', async ({ game, page }) => {
    test.setTimeout(120_000);
    await openTitle(page);
    const assist = page.locator('.title__assist');
    await assist.click();
    await assist.click();
    await expect(assist).toHaveAttribute('aria-pressed', 'false');
    await game.enterGame();
    await page.clock.pauseAt(CLOCK_START + 3_600_000);
    await game.installBot();
    await game.playThrough();
    await game.expectOutcome('perfect');
    await expect(page.getByText('不计入最佳成绩')).toHaveCount(0);
    await expect(page.getByTestId('result-time')).toContainText('新纪录');
    const stored = await page.evaluate(() => localStorage.getItem('dailyboss:records:printer-from-hell'));
    expect(JSON.parse(stored!)).toMatchObject({ full: { hits: 0 } });
  });
});

test.describe('boss mastery', () => {
  test('holding pull on a weak point roots you, then lands a heavy pull for +1 damage', async ({ game, page }) => {
    test.setTimeout(60_000);
    await openTitle(page, '&practice=1');
    await startPractice(page, game);
    await expect(page.getByTestId('kit-mastery')).toContainText('重拽');
    await expect(page.getByTestId('kit-known')).toContainText('闪避');
    await game.installBot({ idle: true });
    await game.fightStart.click();

    await game.runUntil(async () => (await game.fight.getAttribute('data-exposed-lane')) !== null, {
      stepMs: 50,
      maxMs: 20_000,
    });
    // Ignore hits: walk to the weak point and hold pull there.
    const target = Number(await game.fight.getAttribute('data-exposed-lane'));
    let lane = Number(await game.fight.getAttribute('data-player-lane'));
    while (lane !== target) {
      await page.keyboard.press(target < lane ? 'ArrowLeft' : 'ArrowRight');
      await page.clock.runFor(20);
      lane = Number(await game.fight.getAttribute('data-player-lane'));
    }
    const hp = Number(await game.fight.getAttribute('data-hp'));
    await page.keyboard.down('ArrowUp');
    await page.clock.runFor(100);
    await expect(game.fight).toHaveAttribute('data-gripping', 'true');
    await page.keyboard.press('ArrowLeft');
    await page.clock.runFor(50);
    await expect(game.fight).toHaveAttribute('data-player-lane', String(target)); // rooted
    await page.clock.runFor(700);
    await page.keyboard.up('ArrowUp');
    await expect(game.fight).toHaveAttribute('data-hp', String(hp - 2));
    await expect(game.fightCall).toHaveText('重拽！连根拔出来了！');
  });
});

test.describe('sound', () => {
  test('the sound toggle is on by default, switches off, and is remembered', async ({ game, page }) => {
    await game.open();
    const toggle = page.getByTestId('sound-toggle');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(toggle).toHaveText('声音：关');
    await page.reload();
    await expect(page.locator('.title__sound')).toHaveAttribute('aria-pressed', 'false');
  });

  test('?sfx=0 starts muted', async ({ game, page }) => {
    await game.open('?sfx=0');
    await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('backdrop motion', () => {
  test('without a GPU the room keeps its small motion only: no alarm sweep in the boss fight', async ({
    game,
    page,
  }) => {
    // Not openTitle: `fx=0` (fast-forward tests) turns backdrop motion off too.
    await page.clock.install({ time: CLOCK_START });
    await page.goto('./?seed=7&render=simple&practice=1');
    await expect(page.locator('.backdrop')).toHaveAttribute('data-motion', 'lite');
    await startPractice(page, game);
    await expect(page.locator('.backdrop')).toHaveAttribute('data-mood', 'critical');
    await expect(page.locator('.backdrop__sweep')).toHaveCount(0);
    const second = await page.locator('.backdrop__second').evaluate((el) => getComputedStyle(el).animationName);
    expect(second).toBe('bd-tick');
    expect(await page.locator('.backdrop__light').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  });

  test('?bg=full adds the alarm sweep and pulsing light in the boss fight', async ({ game, page }) => {
    await openTitle(page, '&practice=1&bg=full');
    await startPractice(page, game);
    await expect(page.locator('.backdrop__sweep')).toHaveCount(1);
    expect(await page.locator('.backdrop__light').evaluate((el) => getComputedStyle(el).animationName)).toBe(
      'bd-alarm',
    );
  });

  test('moving parts are their own layers: the room picture itself never animates', async ({ page }) => {
    await page.goto('./?bg=full');
    const animatedInsideSvg = await page.evaluate(
      () =>
        [...document.querySelectorAll('.backdrop__room *')].filter((el) => getComputedStyle(el).animationName !== 'none')
          .length,
    );
    expect(animatedInsideSvg).toBe(0);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the room is still', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.backdrop')).toHaveAttribute('data-motion', 'off');
    const running = await page.evaluate(
      () => document.querySelector('.backdrop')!.getAnimations({ subtree: true }).length,
    );
    expect(running).toBe(0);
  });
});
