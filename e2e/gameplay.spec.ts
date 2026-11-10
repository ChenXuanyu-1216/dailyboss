import { expect, test } from './fixtures';

// Gameplay is independent of rendering: these run in whatever display mode the browser supports.

test.describe('endings', () => {
  test('perfect: zero-cost path, result panel, terminal lock', async ({ game, page }) => {
    await game.open();
    await game.expectInitialState();

    await game.act('reconnect');
    await expect(game.phaseTitle).toHaveText('队列堵塞');
    await expect(game.app).toHaveAttribute('data-intensity', 'warning');
    await expect(game.feedback).toContainText('你选择了「检查连接」');
    await expect(game.feedback).toContainText('局面变化：队列堵塞');

    await game.act('clear-queue');
    await expect(game.phaseTitle).toHaveText('最终阶段：卡纸');
    await expect(game.app).toHaveAttribute('data-intensity', 'critical');

    await game.act('release-paper');
    await game.expectOutcome('perfect');
    await expect(game.resultBadge).toContainText('完美结局');
    await expect(game.resultTitle).toHaveText('你打印了一张纸');
    await game.expectPatience(3);
    await expect(page.getByRole('button', { name: /重新开始/ })).toBeFocused();

    // Number keys do nothing once the run is over.
    await page.keyboard.press('1');
    await page.keyboard.press('2');
    await game.expectOutcome('perfect');
    await expect(game.log).toHaveCount(3);
  });

  test('normal: number-key actions with one costly retry', async ({ game, page }) => {
    await game.open();
    await page.keyboard.press('2'); // 再按一次打印 (−1)
    await expect(game.feedback).toContainText('耐心 −1，剩余 2');
    await expect(game.phaseTitle).toHaveText('打印机离线');
    await page.keyboard.press('1'); // 检查连接
    await expect(game.phaseTitle).toHaveText('队列堵塞');
    await page.keyboard.press('1'); // 清理旧任务
    await expect(game.phaseTitle).toHaveText('最终阶段：卡纸');
    await page.keyboard.press('1'); // 打开盖板，取出卡纸
    await game.expectOutcome('normal');
    await expect(game.resultBadge).toContainText('普通结局');
    await expect(game.resultTitle).toHaveText('纸出来了');
    await game.expectPatience(2);
  });

  test('failure: patience runs out while retrying', async ({ game }) => {
    await game.open();
    await game.act('print-again', 'print-again');
    await expect(game.lowPatienceWarning).toBeVisible();
    await game.act('print-again');
    await game.expectOutcome('failure');
    await expect(game.resultBadge).toContainText('挑战失败');
    await expect(game.resultTitle).toHaveText('耐心已耗尽');
    await game.expectPatience(0);
  });

  test('failure takes precedence when a resolve action spends the last patience', async ({ game }) => {
    await game.open();
    await game.act('print-again', 'reconnect', 'add-copy', 'clear-queue');
    await expect(game.phaseTitle).toHaveText('最终阶段：卡纸');
    await game.expectPatience(1);
    await expect(game.lowPatienceWarning).toBeVisible();

    await game.act('pull-hard'); // target: resolve, cost 1 → patience 0
    await game.expectOutcome('failure');
    await expect(game.resultTitle).toHaveText('耐心已耗尽');
    await game.expectPatience(0);
  });
});

test.describe('restart and keyboard', () => {
  test('R restarts after an ending and clears the previous run', async ({ game, page }) => {
    await game.open();
    await game.act('print-again', 'reconnect', 'clear-queue', 'pull-hard');
    await game.expectOutcome('normal');
    await expect(game.log).toHaveCount(4);

    await page.keyboard.press('r');
    await game.expectInitialState();
    await game.expectFocusOnFirstAction();

    // A fresh run is independent of the previous one.
    await game.act('reconnect', 'clear-queue', 'release-paper');
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
    await game.open();
    await game.act('print-again', 'reconnect');
    await expect(game.phaseTitle).toHaveText('队列堵塞');
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
