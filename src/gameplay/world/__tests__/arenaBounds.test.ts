// arenaBounds.test.ts — Tests for the dynamic boss-arena shrink/restore system.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetArenaBounds,
  shrinkArena,
  restoreArena,
  tickArenaBounds,
  isArenaShrunk,
  getArenaBounds,
  BOSS_ARENA_HALF,
} from '../arenaBounds';
import { CFG } from '@core/config';

beforeEach(() => {
  resetArenaBounds();
});

describe('resetArenaBounds', () => {
  it('sets bounds to full world size', () => {
    shrinkArena(1.0);
    tickArenaBounds(2.0); // complete the shrink
    resetArenaBounds();
    const ab = getArenaBounds();
    expect(ab.cx).toBe(CFG.WORLD_W / 2);
    expect(ab.cy).toBe(CFG.WORLD_H / 2);
    expect(ab.halfW).toBeCloseTo(CFG.WORLD_W / 2);
    expect(ab.halfH).toBeCloseTo(CFG.WORLD_H / 2);
  });

  it('stops any running animation', () => {
    shrinkArena(1.0);
    resetArenaBounds();
    const before = getArenaBounds().halfW;
    tickArenaBounds(0.5); // should not advance
    expect(getArenaBounds().halfW).toBe(before);
  });
});

describe('shrinkArena + tickArenaBounds', () => {
  it('returns false when no animation is active', () => {
    expect(tickArenaBounds(0.1)).toBe(false);
  });

  it('returns true while animation is running', () => {
    shrinkArena(1.0);
    expect(tickArenaBounds(0.1)).toBe(true);
  });

  it('lerps halfW toward BOSS_ARENA_HALF over the duration', () => {
    const fullHalf = CFG.WORLD_W / 2;
    shrinkArena(1.0);
    tickArenaBounds(0.5); // halfway
    const ab = getArenaBounds();
    const expected = fullHalf + (BOSS_ARENA_HALF - fullHalf) * 0.5;
    expect(ab.halfW).toBeCloseTo(expected, 0);
  });

  it('reaches BOSS_ARENA_HALF exactly after full duration', () => {
    shrinkArena(1.0);
    tickArenaBounds(1.0);
    const ab = getArenaBounds();
    expect(ab.halfW).toBeCloseTo(BOSS_ARENA_HALF, 2);
    expect(ab.halfH).toBeCloseTo(BOSS_ARENA_HALF, 2);
  });

  it('does not overshoot when dt exceeds duration', () => {
    shrinkArena(1.0);
    tickArenaBounds(99);
    const ab = getArenaBounds();
    expect(ab.halfW).toBeCloseTo(BOSS_ARENA_HALF, 2);
  });

  it('returns false once animation completes', () => {
    shrinkArena(1.0);
    tickArenaBounds(1.0); // complete
    expect(tickArenaBounds(0.1)).toBe(false);
  });
});

describe('restoreArena', () => {
  it('lerps halfW back to full world after shrink', () => {
    shrinkArena(1.0);
    tickArenaBounds(1.0); // fully shrunk
    restoreArena(1.0);
    tickArenaBounds(1.0); // fully restored
    const ab = getArenaBounds();
    expect(ab.halfW).toBeCloseTo(CFG.WORLD_W / 2, 2);
    expect(ab.halfH).toBeCloseTo(CFG.WORLD_H / 2, 2);
  });
});

describe('isArenaShrunk', () => {
  it('returns false at full world size', () => {
    expect(isArenaShrunk()).toBe(false);
  });

  it('returns true after a complete shrink', () => {
    shrinkArena(1.0);
    tickArenaBounds(1.0);
    expect(isArenaShrunk()).toBe(true);
  });

  it('returns false after shrink + restore', () => {
    shrinkArena(1.0);
    tickArenaBounds(1.0);
    restoreArena(1.0);
    tickArenaBounds(1.0);
    expect(isArenaShrunk()).toBe(false);
  });
});
