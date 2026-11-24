import { describe, expect, it, vi } from 'vitest';
import { copyText, shareNatively, shareText, shareUrl } from '../src/ui/share';

const URL_ = 'https://lachenxuanyu.com/dailyboss/?level=printer-from-hell';

describe('shareUrl', () => {
  it('links to the same level and drops every other parameter', () => {
    expect(shareUrl({ origin: 'https://lachenxuanyu.com', pathname: '/dailyboss/' }, 'vending-machine')).toBe(
      'https://lachenxuanyu.com/dailyboss/?level=vending-machine',
    );
  });
});

describe('shareText', () => {
  it('labels a shared assisted run so it is not mistaken for an unassisted score', () => {
    const run = { mode: 'full' as const, timeMs: 83_400, hits: 0, assist: true };
    const text = shareText({
      levelTitle: '地狱打印机',
      outcome: 'perfect',
      endingTitle: '打印成功',
      run,
      patienceSpent: 0,
      url: URL_,
    });
    expect(text.split('\n')[0]).toBe('DailyBoss 人生副本 · 地狱打印机（辅助模式）');
  });

  it('a win: level, ending, clear time and hits, a dare, the link', () => {
    const text = shareText({
      levelTitle: '地狱打印机',
      outcome: 'perfect',
      endingTitle: '打印成功',
      run: { mode: 'full', timeMs: 83_400, hits: 0, assist: false },
      patienceSpent: 0,
      url: URL_,
    });
    expect(text.split('\n')).toEqual([
      'DailyBoss 人生副本 · 地狱打印机',
      '完美结局：打印成功',
      '通关时间 1:23.4 · 被击中 0 次',
      '你能比我更快吗？',
      URL_,
    ]);
  });

  it('a loss says how long you held out and asks for revenge', () => {
    const text = shareText({
      levelTitle: '吞币售货机',
      outcome: 'failure',
      endingTitle: '耐心已耗尽',
      run: { mode: 'full', timeMs: 40_000, hits: 5, assist: false },
      patienceSpent: 5,
      url: URL_,
    });
    expect(text).toContain('挑战失败：耐心已耗尽');
    expect(text).toContain('坚持时间 0:40.0 · 被击中 5 次');
    expect(text).toContain('我输了，你能打赢它吗？');
  });

  it('marks boss practice, and falls back to patience for levels without fights', () => {
    const practice = shareText({
      levelTitle: '地狱打印机',
      outcome: 'normal',
      endingTitle: '纸有点皱',
      run: { mode: 'boss', timeMs: 50_000, hits: 1, assist: false },
      patienceSpent: 1,
      url: URL_,
    });
    expect(practice.split('\n')[0]).toBe('DailyBoss 人生副本 · 地狱打印机（练习）');
    const menu = shareText({ levelTitle: '旧关卡', outcome: 'normal', endingTitle: '好了', patienceSpent: 2, url: URL_ });
    expect(menu).toContain('消耗耐心 2');
  });
});

describe('shareNatively', () => {
  const nav = (over: Partial<Navigator>) => over as Navigator;

  it('is unsupported without navigator.share, or when canShare says no', async () => {
    expect(await shareNatively('t', 'x', nav({}))).toBe('unsupported');
    const share = vi.fn();
    expect(await shareNatively('t', 'x', nav({ share, canShare: () => false }))).toBe('unsupported');
    expect(share).not.toHaveBeenCalled();
  });

  it('shares title and text', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    expect(await shareNatively('t', 'x', nav({ share }))).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 't', text: 'x' });
  });

  it('closing the sheet is a cancel; any other failure falls back to copyable text', async () => {
    const abort = vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError'));
    expect(await shareNatively('t', 'x', nav({ share: abort }))).toBe('cancelled');
    const denied = vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError'));
    expect(await shareNatively('t', 'x', nav({ share: denied }))).toBe('unsupported');
  });
});

describe('copyText', () => {
  it('reports whether the clipboard took the text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await copyText('x', { clipboard: { writeText } } as unknown as Navigator)).toBe(true);
    expect(writeText).toHaveBeenCalledWith('x');
    const refuse = vi.fn().mockRejectedValue(new Error('denied'));
    expect(await copyText('x', { clipboard: { writeText: refuse } } as unknown as Navigator)).toBe(false);
    expect(await copyText('x', {} as Navigator)).toBe(false);
  });
});
