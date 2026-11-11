import { ASSIST, BOSS_SKILLS, ROUND_TITLES, expect, test } from './fixtures';

// Gameplay is independent of rendering: these run in whatever display mode the browser supports.
// Full runs use assist mode so skill checks succeed instantly; the mini-games are in skills.spec.ts.

test.describe('endings', () => {
  test('perfect: zero-cost path through all three boss rounds, result panel, terminal lock', async ({
    game,
    page,
  }) => {
    await game.open(ASSIST);
    await game.expectInitialState();
    await expect(game.assistToggle).toHaveAttribute('aria-pressed', 'true');

    await game.act('reconnect');
    await expect(game.phaseTitle).toHaveText('队列堵塞');
    await expect(game.app).toHaveAttribute('data-intensity', 'warning');
    await expect(game.feedback).toContainText('你插紧了 USB 线');
    await expect(game.feedback).toContainText('局面变化：队列堵塞');
    await expect(game.bossBar).toHaveCount(0);

    await game.act('clear-queue');
    await expect(game.phaseTitle).toHaveText(ROUND_TITLES[0]);
    await expect(game.app).toHaveAttribute('data-intensity', 'critical');
    await expect(game.bossCard).toBeVisible();
    await expect(game.bossCard).toContainText('BOSS 出现');
    await expect(game.bossCard).toContainText('地狱打印机');
    await game.expectBossHealth(100);
    await expect(game.action('open-lid')).toHaveAttribute('data-skill', 'timing');

    await game.act('open-lid');
    await expect(game.phaseTitle).toHaveText(ROUND_TITLES[1]);
    await expect(game.feedback).toContainText('盖板弹开了');
    await game.expectBossHealth(67);

    await game.act('pull-steady');
    await expect(game.phaseTitle).toHaveText(ROUND_TITLES[2]);
    await game.expectBossHealth(33);

    await game.act('release-paper');
    await game.expectOutcome('perfect');
    await game.expectBossHealth(0);
    await expect(game.resultBadge).toContainText('完美结局');
    await expect(game.resultTitle).toHaveText('你打印了一张纸');
    await expect(game.victoryPrint).toBeVisible();
    await expect(game.victoryPrint).toContainText('成功打印一张纸');
    await game.expectPatience(3);
    await expect(page.getByRole('button', { name: /重新开始/ })).toBeFocused();

    // Number keys do nothing once the run is over.
    await page.keyboard.press('1');
    await page.keyboard.press('2');
    await game.expectOutcome('perfect');
    await expect(game.log).toHaveCount(5);
    await expect(game.log.filter({ hasText: '判定成功' })).toHaveCount(3);
  });

  test('normal: number-key actions with one costly retry', async ({ game, page }) => {
    await game.open(ASSIST);
    await page.keyboard.press('2'); // 再按一次打印 (−1)
    await expect(game.feedback).toContainText('耐心 −1，剩余 2');
    await expect(game.phaseTitle).toHaveText('打印机离线');
    await page.keyboard.press('1'); // 检查连接
    await expect(game.phaseTitle).toHaveText('队列堵塞');
    await page.keyboard.press('1'); // 清理旧任务
    await expect(game.phaseTitle).toHaveText(ROUND_TITLES[0]);
    for (const title of [ROUND_TITLES[1], ROUND_TITLES[2]]) {
      await page.keyboard.press('1'); // the round's skill action (assist: instant success)
      await expect(game.phaseTitle).toHaveText(title);
    }
    await page.keyboard.press('1');
    await game.expectOutcome('normal');
    await expect(game.resultBadge).toContainText('普通结局');
    await expect(game.resultTitle).toHaveText('纸出来了');
    await expect(game.victoryPrint).toBeVisible();
    await game.expectPatience(2);
  });

  test('normal: the brute-force options also win, and every hit is shown', async ({ game }) => {
    await game.open(ASSIST);
    await game.act('reconnect', 'clear-queue', 'slap-side');
    await expect(game.phaseTitle).toHaveText(ROUND_TITLES[1]);
    await expect(game.feedback).toContainText('朝你脸上吐了一张白纸');
    await expect(game.hurtPop).toHaveText('−1 耐心');
    await game.expectPatience(2);
    await game.act('pull-hard');
    await game.expectPatience(1);
    await expect(game.lowPatienceWarning).toBeVisible();
    await game.act('release-paper');
    await game.expectOutcome('normal');
  });

  test('failure: patience runs out while retrying', async ({ game }) => {
    await game.open();
    await game.act('print-again', 'print-again');
    await expect(game.lowPatienceWarning).toBeVisible();
    await game.act('print-again');
    await game.expectOutcome('failure');
    await expect(game.resultBadge).toContainText('挑战失败');
    await expect(game.resultTitle).toHaveText('耐心已耗尽');
    await expect(game.victoryPrint).toHaveCount(0);
    await game.expectPatience(0);
  });

  test('failure takes precedence when a resolve action spends the last patience', async ({ game }) => {
    await game.open(ASSIST);
    await game.act('print-again', 'reconnect', 'add-copy', 'clear-queue', 'open-lid', 'pull-steady');
    await expect(game.phaseTitle).toHaveText(ROUND_TITLES[2]);
    await game.expectPatience(1);
    await expect(game.lowPatienceWarning).toBeVisible();

    await game.act('unplug'); // target: resolve, cost 1 → patience 0
    await game.expectOutcome('failure');
    await expect(game.resultTitle).toHaveText('耐心已耗尽');
    await game.expectPatience(0);
  });
});

test.describe('restart and keyboard', () => {
  test('R restarts after an ending and clears the previous run', async ({ game, page }) => {
    await game.open(ASSIST);
    await game.act('print-again', 'reconnect', 'clear-queue', ...BOSS_SKILLS.slice(0, 2), 'unplug');
    await game.expectOutcome('normal');
    await expect(game.log).toHaveCount(6);

    await page.keyboard.press('r');
    await game.expectInitialState();
    await game.expectFocusOnFirstAction();

    // A fresh run is independent of the previous one.
    await game.act('reconnect', 'clear-queue', ...BOSS_SKILLS);
    await game.expectOutcome('perfect');
  });

  test('Enter on the focused result button restarts', async ({ game, page }) => {
    await game.open();
    await game.act('print-again', 'print-again', 'print-again');
    await game.expectOutcome('failure');
    await expect(page.getByRole('button', { name: /重新开始/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await game.expectInitialState();
  });

  test('header restart works mid-run', async ({ game }) => {
    await game.open(ASSIST);
    await game.act('print-again', 'reconnect', 'clear-queue');
    await expect(game.bossBar).toBeVisible();
    await game.headerRestart.click();
    await game.expectInitialState();
  });

  test('focus stays usable across phase changes (Tab, Space, Enter)', async ({ game, page }) => {
    await game.open();
    await game.action('reconnect').focus();
    await page.keyboard.press('Space');
    await expect(game.phaseTitle).toHaveText('队列堵塞');
    // The pressed button was replaced; focus moves to the new phase's first action.
    await game.expectFocusOnFirstAction();
    await expect(game.actionButtons.first()).toHaveAttribute('data-action-id', 'clear-queue');

    await page.keyboard.press('Tab');
    await expect(game.action('add-copy')).toBeFocused();
    await page.keyboard.press('Enter'); // self-loop: same phase, focus stays on the button
    await game.expectPatience(2);
    await expect(game.action('add-copy')).toBeFocused();
  });

  test('keys are ignored when modifiers are held', async ({ game, page }) => {
    await game.open();
    await page.keyboard.press('Control+1');
    await page.keyboard.press('Alt+2');
    await game.expectInitialState();
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
    await expect(game.actionButtons).toHaveCount(0);
  });
});
