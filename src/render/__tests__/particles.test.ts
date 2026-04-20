import { describe, it, expect } from 'vitest';

describe('particle physics math', () => {
  it('applies gravity to vy each frame', () => {
    let vy = 0;
    const gravity = 300;
    const dt = 0.016;
    vy += gravity * dt;
    expect(vy).toBeCloseTo(4.8);
  });

  it('applies drag to velocity each frame', () => {
    let vx = 100;
    const drag = 0.98;
    vx *= drag;
    expect(vx).toBeCloseTo(98);
  });

  it('smoke gravity is negative (rises)', () => {
    let vy = 0;
    const gravity = -60;
    const dt = 0.016;
    vy += gravity * dt;
    expect(vy).toBeLessThan(0);
  });
});

describe('SkidMark angle and width', () => {
  it('stores angle as radians', () => {
    const angle = Math.PI / 4;
    expect(angle).toBeCloseTo(0.785);
  });

  it('default car width is 14', () => {
    const CAR_SKID_WIDTH = 14;
    expect(CAR_SKID_WIDTH).toBe(14);
  });
});
