import type { Page } from '@playwright/test';
import { expect, test, type GamePage } from './fixtures';

// Sharing a result: the system share sheet when the browser has one, otherwise copyable text.

/** Loses the first fight quickly (the bot stands still) to reach the result screen. */
async function reachResult(game: GamePage) {
  await game.openPaused();
  await game.installBot({ idle: true });
  await game.fightStart.click();
  await game.runUntil(async () => (await game.app.getAttribute('data-outcome')) !== null, { stepMs: 1000 });
  await game.expectOutcome('failure');
}

/** Replaces the browser's share sheet before the page loads: none at all, or a stub. */
async function stubShare(page: Page, mode: 'none' | 'ok' | 'abort') {
  await page.addInitScript((m) => {
    const w = window as unknown as { __shared?: unknown };
    const share =
      m === 'none'
        ? undefined
        : async (data: unknown) => {
            if (m === 'abort') throw new DOMException('closed', 'AbortError');
            w.__shared = data;
          };
    Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: share });
    Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: undefined });
  }, mode);
}

test.describe('sharing a result', () => {
  test('without a share sheet: shows the text selected, copies it, and R still waits', async ({
    game,
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await stubShare(page, 'none');
    await reachResult(game);

    const share = page.getByTestId('share');
    await expect(share).toHaveText('分享结果');
    await share.click();
    const box = page.getByTestId('share-box');
    await expect(box).toBeVisible();
    await expect(share).toHaveAttribute('aria-expanded', 'true');

    const text = box.getByRole('textbox', { name: '分享文字' });
    await expect(text).toBeFocused();
    const value = await text.inputValue();
    const lines = value.split('\n');
    expect(lines[0]).toBe('DailyBoss 人生副本 · 地狱打印机');
    expect(lines[1]).toBe('挑战失败：耐心已耗尽');
    expect(lines[2]).toMatch(/^坚持时间 \d:\d\d\.\d · 被击中 5 次$/);
    // The link opens the same level, without this run's debug parameters.
    expect(lines.at(-1)).toMatch(/\/dailyboss\/\?level=printer-from-hell$/);
    expect(await text.evaluate((el: HTMLTextAreaElement) => el.selectionEnd - el.selectionStart)).toBe(value.length);

    // Typing keys in the text box doesn't restart the run.
    await page.keyboard.press('r');
    await expect(game.app).toHaveAttribute('data-outcome', 'failure');

    await box.getByRole('button', { name: '复制' }).click();
    await expect(page.getByRole('status').filter({ hasText: '已复制' })).toBeVisible();
    // (The Windows clipboard hands text back with CRLF line endings.)
    expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(value);
    await game.expectNoHorizontalOverflow();
  });

  test('with a share sheet: hands it the text and shows no copy box', async ({ game, page }) => {
    await stubShare(page, 'ok');
    await reachResult(game);
    await page.getByTestId('share').click();
    await expect(page.getByRole('status').filter({ hasText: '已分享' })).toBeVisible();
    const shared = (await page.evaluate(() => (window as unknown as { __shared: { title: string; text: string } }).__shared))!;
    expect(shared.title).toBe('DailyBoss 人生副本 · 地狱打印机');
    expect(shared.text).toContain('挑战失败：耐心已耗尽');
    await expect(page.getByTestId('share-box')).toHaveCount(0);
  });

  test('closing the share sheet does nothing', async ({ game, page }) => {
    await stubShare(page, 'abort');
    await reachResult(game);
    await page.getByTestId('share').click();
    await page.waitForTimeout(100);
    await expect(page.getByTestId('share-box')).toHaveCount(0);
    await expect(page.locator('.result__share-note')).toHaveText('');
  });
});

test.describe('sharing on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the copy box fits without sideways scrolling', async ({ game, page }) => {
    await stubShare(page, 'none');
    await reachResult(game);
    await page.getByTestId('share').click();
    await expect(page.getByTestId('share-box')).toBeVisible();
    await game.expectNoHorizontalOverflow();
  });
});
