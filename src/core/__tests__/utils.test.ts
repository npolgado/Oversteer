import { describe, it, expect } from 'vitest';
import { lerp, clamp, dist, normalizeAngle, approach, makeRng, randFloat } from '../../logic/index';

describe('utils', () => {
  it('lerp interpolates correctly', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(lerp(0, 100, 0)).toBe(0);
    expect(lerp(0, 100, 1)).toBe(100);
  });

  it('clamp constrains values', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('dist computes euclidean distance', () => {
    expect(dist(0, 0, 3, 4)).toBe(5);
    expect(dist(0, 0, 0, 0)).toBe(0);
  });

  it('normalizeAngle wraps to [-PI, PI]', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI, 5);
    expect(normalizeAngle(-Math.PI * 3)).toBeCloseTo(-Math.PI, 5);
  });

  it('approach moves toward target', () => {
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(10, 0, 3)).toBe(7);
    expect(approach(5, 5, 3)).toBe(5);
  });
});

describe('rng', () => {
  it('makeRng produces deterministic values', () => {
    const rng1 = makeRng(42);
    const rng2 = makeRng(42);
    expect(rng1.next()).toBe(rng2.next());
    expect(rng1.next()).toBe(rng2.next());
  });

  it('randFloat stays in range', () => {
    const rng = makeRng(999);
    for (let i = 0; i < 100; i++) {
      const v = randFloat(rng, 5, 15);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(15);
    }
  });
});
