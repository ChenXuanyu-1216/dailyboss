import path from 'node:path';
import { build } from 'vite';
import { readFile } from 'node:fs/promises';
import { expect, test } from './fixtures';

test('re-entering the same critical fight starts the briefing at full boss health', async ({ game, page }, testInfo) => {
  test.setTimeout(90_000);
  const level = JSON.parse(await readFile('content/levels/printer-from-hell.json', 'utf8'));
  const [fight, choice] = level.phases;
  fight.intensity = 'critical';
  delete choice.fight;
  choice.actions = [
    { id: 'retry', label: 'Fight again', patienceCost: 0, target: { type: 'phase', id: fight.id } },
    { id: 'finish', label: 'Finish', patienceCost: 0, target: { type: 'resolve' } },
  ];
  level.phases = [fight, choice];

  // Build the alternate level through the same content loader as the shipped game.
  const outDir = testInfo.outputPath('reentry-build');
  await build({
    build: { outDir, emptyOutDir: false },
    plugins: [{
      name: 'boss-reentry-test-level',
      enforce: 'pre',
      load(id) {
        if (id.endsWith('/content/levels/printer-from-hell.json')) return JSON.stringify(level);
      },
    }],
  });
  await page.route('**/dailyboss/**', (route) => {
    const name = new URL(route.request().url()).pathname.slice('/dailyboss/'.length) || 'index.html';
    return route.fulfill({ path: path.join(outDir, name) });
  });
  await game.openPaused();
  await game.expectBossHealth(100);
  await game.installBot();
  await game.clearFight();
  await expect(game.bossBar).toHaveCount(0);
  await page.getByRole('button', { name: 'Fight again' }).click();
  await expect(game.fightStart).toBeVisible();
  await game.expectBossHealth(100);
});
