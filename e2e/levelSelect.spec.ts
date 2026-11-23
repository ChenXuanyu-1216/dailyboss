import { expect, test } from './fixtures';

// Choosing a level on the title screen: both bosses live on the one page, the choice shows in the
// address bar and is remembered, and a ?level link still opens its level directly.

const SIMPLE = './?render=simple&fx=0';

test.describe('level picker', () => {
  test('lists both levels with the printer chosen on a first visit', async ({ game, page }) => {
    await page.goto(SIMPLE);
    const picker = page.getByRole('radiogroup', { name: '选择副本' });
    await expect(picker.getByRole('radio')).toHaveText([/地狱打印机/, /吞币售货机/]);
    await expect(picker.getByRole('radio', { name: /地狱打印机/ })).toHaveAttribute('aria-checked', 'true');
    await expect(game.titleScreen.getByRole('heading', { level: 1 })).toHaveText('地狱打印机');
    await expect(game.titleStart).toBeFocused();
    await game.expectNoHorizontalOverflow();
  });

  test('picking the vending machine shows its card, updates the address and starts its arena', async ({
    game,
    page,
  }) => {
    await page.goto(SIMPLE);
    await page.getByRole('radio', { name: /吞币售货机/ }).click();

    await expect(game.titleScreen.getByRole('heading', { level: 1 })).toHaveText('吞币售货机');
    await expect(game.titleScreen).toContainText('下课只有 10 分钟，你只想买一瓶水。');
    await expect(page.getByRole('radio', { name: /吞币售货机/ })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: /吞币售货机/ })).toBeFocused();
    const url = new URL(page.url());
    expect(url.searchParams.get('level')).toBe('vending-machine');
    expect(url.searchParams.get('render'), 'other parameters kept').toBe('simple');

    await game.enterGame();
    await expect(game.app).toHaveAttribute('data-arena', 'true');
    await expect(game.phaseTitle).toHaveText('吞币');
  });

  test('arrow keys move between levels', async ({ game, page }) => {
    await page.goto(SIMPLE);
    await page.getByRole('radio', { name: /地狱打印机/ }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(game.titleScreen.getByRole('heading', { level: 1 })).toHaveText('吞币售货机');
    await expect(page.getByRole('radio', { name: /吞币售货机/ })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(game.titleScreen.getByRole('heading', { level: 1 })).toHaveText('地狱打印机');
    await expect(page.getByRole('radio', { name: /地狱打印机/ })).toBeFocused();
  });

  test('the choice is remembered on the next visit', async ({ game, page }) => {
    await page.goto(SIMPLE);
    await page.getByRole('radio', { name: /吞币售货机/ }).click();
    await expect(game.titleScreen.getByRole('heading', { level: 1 })).toHaveText('吞币售货机');

    await page.goto(SIMPLE);
    await expect(game.titleScreen.getByRole('heading', { level: 1 })).toHaveText('吞币售货机');
    await expect(page.getByRole('radio', { name: /吞币售货机/ })).toHaveAttribute('aria-checked', 'true');
  });

  test('a ?level link opens that level, picker included', async ({ game, page }) => {
    await page.goto('./?level=vending-machine&render=simple&fx=0');
    await expect(game.titleScreen.getByRole('heading', { level: 1 })).toHaveText('吞币售货机');
    await expect(page.getByRole('radio', { name: /吞币售货机/ })).toHaveAttribute('aria-checked', 'true');
  });

  test('the result screen goes back to the title to pick another level', async ({ game, page }) => {
    // Losing the first fight takes many fake-clock steps; under a loaded machine 30 s is tight.
    test.setTimeout(90_000);
    await game.openPaused();
    await game.installBot({ idle: true });
    await game.fightStart.click();
    await game.runUntil(async () => (await game.app.getAttribute('data-outcome')) !== null);
    await game.expectOutcome('failure');

    await page.getByTestId('change-level').click();
    await expect(game.titleScreen).toBeVisible();
    await expect(page.getByRole('radio', { name: /地狱打印机/ })).toBeFocused();
    await page.getByRole('radio', { name: /吞币售货机/ }).click();
    await expect(game.titleScreen.getByRole('heading', { level: 1 })).toHaveText('吞币售货机');
  });
});

test.describe('level picker on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('both levels fit side by side without horizontal scrolling', async ({ game, page }) => {
    await page.goto(SIMPLE);
    const [a, b] = await Promise.all([
      page.getByRole('radio', { name: /地狱打印机/ }).boundingBox(),
      page.getByRole('radio', { name: /吞币售货机/ }).boundingBox(),
    ]);
    expect(a && b && Math.abs(a.y - b.y)).toBeLessThan(2);
    await page.getByRole('radio', { name: /吞币售货机/ }).tap();
    await expect(game.titleScreen.getByRole('heading', { level: 1 })).toHaveText('吞币售货机');
    await game.expectNoHorizontalOverflow();
  });
});
