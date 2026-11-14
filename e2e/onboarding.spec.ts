import { FIGHT_IDS, PHASE_TITLES, expect, test } from './fixtures';

// The way in: title screen → opening story (protocol v0.4 `intro`) → first fight.

const BEATS = [
  '23:47。作业今晚 12 点截止。',
  '文档写完了，排版也调好了。只差最后一步：打印。',
  '「打印机脱机。」它就在你面前，绿灯还亮着。',
  '你又按了一次打印。这一次，它睁开了眼睛。',
];
const CLOCK_START = new Date('2026-01-01T09:00:00Z').getTime();

test.describe('title screen', () => {
  test('shows today’s level and keeps the game behind it inert', async ({ game, page }) => {
    await page.goto('./');
    await expect(game.titleScreen).toBeVisible();
    await expect(game.titleScreen.getByRole('heading', { level: 1, name: '地狱打印机' })).toBeVisible();
    await expect(game.titleScreen).toContainText('截止前 13 分钟，你只想打印一张纸。');
    await expect(game.titleScreen.locator('.title__stop')).toHaveText(
      PHASE_TITLES.map((t, i) => new RegExp(`^${i + 1}${t}`)),
    );
    await expect(game.titleStart).toBeFocused();
    await expect(page.locator('.window')).toHaveAttribute('inert', '');
    await expect(game.app).toHaveAttribute('data-screen', 'title');
    await expect(page.locator('.backdrop')).toHaveAttribute('data-mood', 'night');

    // Game shortcuts are off while the title is up.
    await page.keyboard.press('r');
    await page.keyboard.press('1');
    await page.keyboard.press('ArrowLeft');
    await expect(game.titleScreen).toBeVisible();
    await expect(game.fight).not.toHaveAttribute('data-started');
  });

  test('the assist toggle on the title carries into the game', async ({ game, page }) => {
    await page.goto('./');
    const toggle = game.titleScreen.getByRole('button', { name: '辅助模式' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await game.enterGame();
    await expect(game.assistToggle).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('opening story', () => {
  test('Enter starts, types each beat, advances, and lands focus on the first fight', async ({ game, page }) => {
    await page.clock.install({ time: CLOCK_START });
    await page.goto('./');
    await page.clock.pauseAt(CLOCK_START + 60_000);
    await page.keyboard.press('Enter');
    await expect(game.intro).toBeVisible();
    await expect(game.app).toHaveAttribute('data-screen', 'intro');
    await expect(game.introNext).toBeFocused();

    const typed = game.intro.locator('.intro__text > span[aria-hidden]');
    const dots = game.intro.locator('.intro__dot');
    await expect(dots).toHaveCount(BEATS.length);

    for (const [i, text] of BEATS.entries()) {
      await expect(dots.nth(i)).toHaveAttribute('data-state', 'current');
      // The full line is always available to screen readers, even mid-typewriter.
      await expect(game.intro.locator('.intro__text .visually-hidden')).toHaveText(text);
      if (i % 2 === 0) {
        // Still typing: the first press finishes the line.
        await expect(typed).not.toHaveText(text);
        await page.keyboard.press('Enter');
      } else {
        // Or let it type itself out.
        await page.clock.runFor(text.length * 45 + 100);
      }
      await expect(typed).toHaveText(text);
      await expect(game.introNext).toHaveText(i === BEATS.length - 1 ? /进入战斗/ : /继续/);
      await page.keyboard.press('Enter');
    }

    await expect(game.intro).toHaveCount(0);
    await expect(game.app).toHaveAttribute('data-screen', 'play');
    await expect(page.locator('.window')).not.toHaveAttribute('inert');
    await expect(game.fight).toHaveAttribute('data-fight-id', FIGHT_IDS[0]);
    await expect(game.fightStart).toBeFocused();
  });

  test('clicking the stage advances; Esc skips straight to the game', async ({ game, page }) => {
    await page.goto('./');
    await game.titleStart.click();
    await expect(game.intro.locator('.intro__dot').first()).toHaveAttribute('data-state', 'current');
    await game.intro.locator('.intro__stage').click(); // finish typing
    await game.intro.locator('.intro__stage').click(); // next beat
    await expect(game.intro.locator('.intro__dot').nth(1)).toHaveAttribute('data-state', 'current');
    await expect(game.intro.locator('.intro__dot').first()).toHaveAttribute('data-state', 'done');

    await page.keyboard.press('Escape');
    await expect(game.intro).toHaveCount(0);
    await expect(game.fightStart).toBeFocused();
    // Esc was the intro's, not the fight's: nothing started or paused.
    await expect(game.fight).not.toHaveAttribute('data-started');
  });

  test('restarting a run goes back to the first fight, not the title', async ({ game, page }) => {
    await game.open();
    await page.keyboard.press('r');
    await game.expectInitialState();
    await expect(game.titleScreen).toHaveCount(0);
    await expect(game.intro).toHaveCount(0);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('shows each line in full at once, without animation', async ({ game, page }) => {
    await page.goto('./');
    expect(await game.titleScreen.locator('.title__card').evaluate((el) => getComputedStyle(el).animationName)).toBe(
      'none',
    );
    await game.titleStart.click();
    const typed = game.intro.locator('.intro__text > span[aria-hidden]');
    await expect(typed).toHaveText(BEATS[0]!);
    await page.keyboard.press('Enter');
    await expect(typed).toHaveText(BEATS[1]!);
    expect(await game.intro.locator('.intro__beat').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  });
});
