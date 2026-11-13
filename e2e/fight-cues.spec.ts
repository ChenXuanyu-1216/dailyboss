import { expect, test } from './fixtures';

test('overlapping volleys are announced separately and a paired shot names both lanes', async ({ game, page }) => {
  test.setTimeout(90_000);
  await game.openPaused();
  await game.installBot();
  await game.clearFight();
  await game.clearFight();
  await game.installBot({ idle: true });
  await game.fightStart.click();

  const cue = game.fight.getByRole('alert');
  await page.clock.runFor(1600);
  await expect(cue).toContainText('中路来纸');
  const first = await cue.locator('span').elementHandle();
  await page.clock.runFor(650);
  await expect(game.fight.getByTestId('paper')).toHaveCount(2);
  expect(await first!.evaluate((node) => node.isConnected)).toBe(false);
  await expect(cue).toContainText('中路来纸');
  await page.clock.runFor(1600);
  await expect(cue).toHaveText(/中路、[左右]路来纸，闪避。 你在中路。/);
});

test('paper cues repeat for each volley, stay quiet between volleys, and identify player movement', async ({ game, page }) => {
  await game.openPaused();
  const cue = game.fight.getByRole('alert');
  await game.fightStart.click();
  await expect(cue).toHaveText('你在中路。');
  await page.clock.runFor(1300);
  await expect(cue).toHaveText('中路来纸，闪避。 你在中路。');

  // A repeated volley aimed at the same lane must still mutate the live region.
  const first = await cue.locator('span').elementHandle();
  await page.clock.runFor(400);
  expect(await first!.evaluate((node) => node.isConnected)).toBe(true);
  await page.clock.runFor(2100);
  expect(await first!.evaluate((node) => node.isConnected)).toBe(false);
  await expect(cue).toHaveText('中路来纸，闪避。 你在中路。');

  await page.keyboard.press('ArrowLeft');
  await page.clock.runFor(32);
  await expect(cue).toHaveText('你在左路。');
  await page.clock.runFor(2400);
  await expect(cue).toHaveText(/[中右]路露出.+，到该路拽纸。 你在左路。/);
});

test('toner, charging and interrupt weak points produce timely spoken action cues', async ({ game, page }) => {
  test.setTimeout(60_000);
  await game.openPaused();
  await game.installBot();
  await game.clearFight();
  await game.installBot({ idle: true });
  const cue = game.fight.getByRole('alert');
  await game.fightStart.click();
  await page.clock.runFor(1300);
  await expect(cue).toContainText('按住格挡');
  await page.keyboard.down('ArrowDown');
  await page.clock.runFor(1100);
  await expect(cue).toContainText('墨粉喷射中');
  await page.clock.runFor(800);
  await expect(cue).toContainText('可松开格挡');
  await page.keyboard.up('ArrowDown');
  await game.runUntil(async () => (await cue.textContent())!.includes('按住重启'), { stepMs: 100, maxMs: 3000 });
  await page.keyboard.down('KeyK');
  await page.clock.runFor(800);
  await page.keyboard.up('KeyK');
  await expect(cue).toHaveText(/[左中右]路露出.+，到该路拽纸。 你在[左中右]路。/);
});
