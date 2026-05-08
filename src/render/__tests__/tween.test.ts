// tween.test.ts — Tests for the uiTween wrapper and gsap delegation.
// In test mode (import.meta.env.MODE === 'test'), uiTween applies props
// instantly via gsap.set so assertions are synchronous and deterministic.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  set: vi.fn(),
  to: vi.fn(),
  killTweensOf: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
}));

vi.mock('pixi.js', () => ({}));

vi.mock('gsap/PixiPlugin', () => ({
  PixiPlugin: { registerPIXI: vi.fn() },
}));

vi.mock('gsap', () => ({
  default: {
    ticker: { lagSmoothing: vi.fn() },
    registerPlugin: vi.fn(),
    globalTimeline: { pause: mocks.pause, resume: mocks.resume },
    set: mocks.set,
    to: mocks.to,
    killTweensOf: mocks.killTweensOf,
  },
}));

import { uiTween, pauseUITweens, resumeUITweens, killUITweens } from '@render/tween';

// ── uiTween ───────────────────────────────────────────────────────────────────

describe('uiTween — test mode (instant apply)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applies props via gsap.set in test mode', async () => {
    const target = { alpha: 0, x: 0 };
    await uiTween(target, { alpha: 1, x: 50, duration: 0.3 });
    expect(mocks.set).toHaveBeenCalledWith(target, { alpha: 1, x: 50 });
  });

  it('strips animation-only keys from the set call', async () => {
    const target = {};
    await uiTween(target, { x: 10, duration: 0.5, delay: 0.1, ease: 'power2', yoyo: true, repeat: 2 });
    const [, props] = mocks.set.mock.calls[0];
    expect(props).not.toHaveProperty('duration');
    expect(props).not.toHaveProperty('delay');
    expect(props).not.toHaveProperty('ease');
    expect(props).not.toHaveProperty('yoyo');
    expect(props).not.toHaveProperty('repeat');
    expect(props).toMatchObject({ x: 10 });
  });

  it('calls onComplete synchronously', async () => {
    const onComplete = vi.fn();
    await uiTween({}, { alpha: 1, onComplete });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('returns a resolved promise', async () => {
    await expect(uiTween({}, { alpha: 1 })).resolves.toBeUndefined();
  });

  it('does not call gsap.to in test mode', async () => {
    await uiTween({}, { alpha: 1 });
    expect(mocks.to).not.toHaveBeenCalled();
  });
});

// ── pauseUITweens / resumeUITweens ────────────────────────────────────────────

describe('pauseUITweens', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pauses the global timeline', () => {
    pauseUITweens();
    expect(mocks.pause).toHaveBeenCalledOnce();
  });
});

describe('resumeUITweens', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resumes the global timeline', () => {
    resumeUITweens();
    expect(mocks.resume).toHaveBeenCalledOnce();
  });
});

// ── killUITweens ──────────────────────────────────────────────────────────────

describe('killUITweens', () => {
  beforeEach(() => vi.clearAllMocks());

  it('kills tweens on the given target', () => {
    const target = { alpha: 1 };
    killUITweens(target);
    expect(mocks.killTweensOf).toHaveBeenCalledWith(target);
  });

  it('passes the exact reference (not a copy)', () => {
    const target = {};
    killUITweens(target);
    expect(mocks.killTweensOf.mock.calls[0][0]).toBe(target);
  });
});
