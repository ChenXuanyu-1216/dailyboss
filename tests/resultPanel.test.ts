import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ResultPanel } from '../src/ui/ResultPanel';

describe('ResultPanel sharing', () => {
  it('offers an independent copy-result action before any native share attempt', () => {
    const html = renderToStaticMarkup(
      createElement(ResultPanel, {
        outcome: 'failure',
        ending: { title: '耐心已耗尽', description: '再试一次' },
        patienceSpent: 5,
        steps: 1,
        printed: '打印成功',
        onRestart: () => {},
        shareTitle: 'DailyBoss',
        shareText: '挑战失败：耐心已耗尽',
      }),
    );
    expect(html).toMatch(/<button[^>]*>复制结果<\/button>/);
  });
});
