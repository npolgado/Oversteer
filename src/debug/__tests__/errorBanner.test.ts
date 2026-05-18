// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  initErrorBanner,
  pushError,
  clearErrors,
  getBannerState,
  _resetBannerForTest,
} from '../errorBanner';

beforeEach(() => {
  initErrorBanner();
  _resetBannerForTest();
});

describe('errorBanner', () => {
  it('is hidden before any error is pushed', () => {
    expect(getBannerState().visible).toBe(false);
  });

  it('becomes visible after pushError', () => {
    pushError('sys', 'something broke');
    expect(getBannerState().visible).toBe(true);
  });

  it('appends an entry with the correct tag and first line of msg', () => {
    pushError('scene', 'line one\nline two\nline three');
    const { entries } = getBannerState();
    expect(entries.length).toBe(1);
    expect(entries[0].tag).toBe('scene');
    expect(entries[0].msg).toBe('line one');
  });

  it('shows "+N more" when more than 5 errors are pushed', () => {
    for (let i = 0; i < 7; i++) pushError('t', `error ${i}`);
    const banner = document.getElementById('oversteer-error-banner');
    expect(banner?.innerHTML).toContain('and 2 more');
  });

  it('clearErrors marks all entries dismissed and hides the banner', () => {
    pushError('a', 'err 1');
    pushError('b', 'err 2');
    clearErrors();
    const state = getBannerState();
    expect(state.visible).toBe(false);
    expect(state.entries.every(e => e.dismissed)).toBe(true);
  });

  it('dismissing all entries one by one hides the banner', () => {
    pushError('a', 'err 1');
    pushError('b', 'err 2');
    const banner = document.getElementById('oversteer-error-banner')!;

    const buttons = banner.querySelectorAll<HTMLButtonElement>('[data-dismiss]');
    buttons.forEach(btn => btn.click());

    expect(getBannerState().visible).toBe(false);
  });

  it('banner element has z-index 2147483647', () => {
    const banner = document.getElementById('oversteer-error-banner');
    expect(banner?.style.zIndex).toBe('2147483647');
  });

  it('caps the ring buffer at 50 entries', () => {
    for (let i = 0; i < 60; i++) pushError('x', `msg ${i}`);
    expect(getBannerState().entries.length).toBe(50);
  });

  it('active count decreases when an entry is dismissed', () => {
    pushError('a', 'err');
    pushError('b', 'err');
    const banner = document.getElementById('oversteer-error-banner')!;
    const firstDismiss = banner.querySelector<HTMLButtonElement>('[data-dismiss]');
    firstDismiss?.click();
    const active = getBannerState().entries.filter(e => !e.dismissed);
    expect(active.length).toBe(1);
    expect(getBannerState().visible).toBe(true);
  });
});
