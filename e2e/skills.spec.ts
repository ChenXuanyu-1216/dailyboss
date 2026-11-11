import { ROUND_TITLES, expect, test, type GamePage } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * The skill-check mini-games, driven by Playwright's fake clock so timing is exact:
 * the clock is installed before the page loads and paused before each check opens.
 * The simplified display keeps the 3D render loop out of the way.
 */

const START = new Date('2026-01-01T09:00:00Z').getTime();
let pauseCount = 0;

async function openPaused(game: GamePage, page: Page, query = '') {
  await page.clock.install({ time: START });
  await game.open(`?render=simple${query}`);
  // Freeze time (pauseAt must be in the future of the page's clock).
  pauseCount += 1;
  await page.clock.pauseAt(START + pauseCount * 3_600_000);
}

/** Timing: one sweep 0 → 1 → 0 takes 1600 ms; the green zone is 0.4–0.6 → 320–480 ms on the way out. */
test.describe('timing check', () => {
  test('pressing in the green zone succeeds and advances the round', async ({ game, page }) => {
    await openPaused(game, page);
    await game.act('reconnect', 'clear-queue');
    await expect(game.phaseTitle).toHaveText(ROUND_TITLES[0]);

    await game.act('open-lid');
    await expect(game.skillPanel).toBeVisible();
    await expect(game.skillPanel).toHaveAttribute('data-skill', 'timing');
    await expect(game.skillHit).toBeFocused();
    await expect(game.actionButtons).toHaveCount(0);

    await page.clock.runFor(400); // needle at 0.5
    await page.keyboard.press('Space');
    await expect(game.skillVerdict).toHaveText('成功！');
    await page.clock.runFor(700);
    await expect(game.phaseTitle).toHaveText(ROUND_TITLES[1]);
    await game.expectPatience(3);
    await expect(game.feedback).toContainText('盖板弹开了');
    await expect(game.log.last()).toContainText('判定成功');
  });

  test('pressing outside the zone fails: onFail cost, stays in the round, counterattack', async ({ game, page }) => {
    await openPaused(game, page);
    await game.act('reconnect', 'clear-queue', 'open-lid');
    await page.clock.runFor(100); // needle at 0.125
    await game.skillHit.click();
    await expect(game.skillVerdict).toHaveText('失手了！');
    await page.clock.runFor(700);
    await expect(game.phaseTitle).toHaveText(ROUND_TITLES[0]);
    await game.expectPatience(2);
    await expect(game.feedback).toContainText('盖板猛地合上，夹住了你的手指。');
    await expect(game.hurtPop).toHaveText('−1 耐心');
    await expect(game.log.last()).toContainText('判定失手');
    await game.expectBossHealth(100);
  });

  test('waiting through three sweeps fails on its own', async ({ game, page }) => {
    await openPaused(game, page);
    await game.act('reconnect', 'clear-queue', 'open-lid');
    await page.clock.runFor(1600 * 3);
    await expect(game.skillVerdict).toHaveText('失手了！');
    await page.clock.runFor(700);
    await game.expectPatience(2);
    await expect(game.skillPanel).toHaveCount(0);
  });

  test('Escape cancels without taking a turn; shortcuts are off while the check is open', async ({
    game,
    page,
  }) => {
    await openPaused(game, page);
    await game.act('reconnect', 'clear-queue', 'open-lid');
    await page.keyboard.press('r'); // ignored during the check
    await page.keyboard.press('2');
    await expect(game.skillPanel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(game.skillPanel).toHaveCount(0);
    await expect(game.phaseTitle).toHaveText(ROUND_TITLES[0]);
    await expect(game.log).toHaveCount(2);
    await game.expectPatience(3);
    await game.expectFocusOnFirstAction();
  });
});

/** Mash: 10 taps within 3 s of the first tap. */
test.describe('mash check', () => {
  async function toTugOfWar(game: GamePage, page: Page) {
    await openPaused(game, page, '&assist=1');
    await game.act('reconnect', 'clear-queue', 'open-lid'); // assist: instant success
    await expect(game.phaseTitle).toHaveText(ROUND_TITLES[1]);
    await game.assistToggle.click();
    await expect(game.assistToggle).toHaveAttribute('aria-pressed', 'false');
    await game.act('pull-steady');
    await expect(game.skillPanel).toHaveAttribute('data-skill', 'mash');
  }

  test('ten quick taps succeed', async ({ game, page }) => {
    await toTugOfWar(game, page);
    const meter = page.getByRole('progressbar', { name: '拽纸进度' });
    for (let i = 1; i <= 10; i++) {
      await page.keyboard.press(i % 2 ? 'Space' : 'Enter');
      await page.clock.runFor(100);
      if (i < 10) await expect(meter).toHaveAttribute('aria-valuenow', String(i));
    }
    await expect(game.skillVerdict).toHaveText('成功！');
    await page.clock.runFor(700);
    await expect(game.phaseTitle).toHaveText(ROUND_TITLES[2]);
    await game.expectPatience(3);
  });

  test('too few taps before the window closes fails', async ({ game, page }) => {
    await toTugOfWar(game, page);
    for (let i = 0; i < 4; i++) await game.skillHit.click();
    await page.clock.runFor(3000);
    await expect(game.skillVerdict).toHaveText('失手了！');
    await page.clock.runFor(700);
    await expect(game.phaseTitle).toHaveText(ROUND_TITLES[1]);
    await game.expectPatience(2);
    await expect(game.feedback).toContainText('纸又被吸回去一截');
  });

  test('a held key does not auto-repeat taps', async ({ game, page }) => {
    await toTugOfWar(game, page);
    await page.keyboard.down('Enter');
    for (let i = 0; i < 5; i++) {
      await page.keyboard.down('Enter'); // repeat keydown events
    }
    await page.keyboard.up('Enter');
    const meter = page.getByRole('progressbar', { name: '拽纸进度' });
    await expect(meter).toHaveAttribute('aria-valuenow', '1');
  });
});

test('the boss title card appears on entering the first round and then clears', async ({ game, page }) => {
  await openPaused(game, page);
  await game.act('reconnect');
  await expect(game.bossCard).toHaveCount(0);
  await game.act('clear-queue');
  await expect(game.bossCard).toBeVisible();
  await expect(game.bossCard).toHaveCSS('pointer-events', 'none');
  await page.clock.runFor(1900);
  await expect(game.bossCard).toHaveCount(0);
});
