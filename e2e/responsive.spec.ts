import { ASSIST, expect, test } from './fixtures';

const viewports = [
  { name: 'mobile portrait 390×844', width: 390, height: 844 },
  { name: 'mobile landscape 844×390', width: 844, height: 390 },
  { name: 'small portrait 360×640', width: 360, height: 640 },
];

for (const vp of viewports) {
  test.describe(vp.name, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, isMobile: true, hasTouch: true });

    test('no horizontal overflow through a full run, touch targets ≥ 44px', async ({ game, page }) => {
      await game.open(ASSIST);
      await game.expectNoHorizontalOverflow();

      const box = await game.actionButtons.first().boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

      await game.action('reconnect').tap();
      await expect(game.phaseTitle).toHaveText('队列堵塞');
      await game.action('clear-queue').tap();
      await expect(game.app).toHaveAttribute('data-intensity', 'critical');
      await game.expectNoHorizontalOverflow();

      await expect(game.bossBar).toBeVisible();
      await game.action('slap-side').tap();
      await game.action('pull-steady').tap();
      await game.action('release-paper').tap();
      await game.expectOutcome('normal');
      await game.expectNoHorizontalOverflow();

      const restart = page.getByRole('button', { name: /重新开始/ });
      await restart.scrollIntoViewIfNeeded();
      await restart.tap();
      await game.expectInitialState();
    });

    test('the skill check fits and its button is a large touch target', async ({ game }) => {
      await game.open();
      await game.action('reconnect').tap();
      await game.action('clear-queue').tap();
      await game.action('open-lid').tap();
      await expect(game.skillPanel).toBeVisible();
      await game.expectNoHorizontalOverflow();
      const box = await game.skillHit.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
      await game.skillHit.tap();
      await expect(game.skillVerdict).not.toHaveText('');
    });
  });
}
