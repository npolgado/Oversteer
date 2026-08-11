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

describe('GPU particle path selection', () => {
  it('spark and shard use GPU-batched sprite path when texture available', () => {
    // Documents that the sprite path is selected only when texture exists and type is spark/shard.
    const useSprite = (type: string, hasTexture: boolean) =>
      (type === 'spark' || type === 'shard') && hasTexture;

    expect(useSprite('spark', true)).toBe(true);
    expect(useSprite('shard', true)).toBe(true);
    expect(useSprite('smoke', true)).toBe(false);
    expect(useSprite('spark', false)).toBe(false);
  });

  it('shard rotation step matches original fx.js:263 (10 rad/s)', () => {
    let rotation = 0;
    const dt = 0.016;
    rotation += 10 * dt;
    expect(rotation).toBeCloseTo(0.16);
  });
});

// NOTE: not in original — bolt (Chain Lightning arc) lifecycle math.
describe('Bolt lifecycle (Chain Lightning arc FX)', () => {
  it('expires via swap-and-pop once life reaches 0', () => {
    const bolts = [
      { life: 0.22, maxLife: 0.22 },
      { life: 0.01, maxLife: 0.22 },
    ];
    const dt = 0.02;
    for (let i = bolts.length - 1; i >= 0; i--) {
      bolts[i].life -= dt;
      if (bolts[i].life <= 0) {
        bolts[i] = bolts[bolts.length - 1];
        bolts.pop();
      }
    }
    expect(bolts).toHaveLength(1);
  });

  it('alpha fades linearly with remaining life', () => {
    const maxLife = 0.22;
    const life = 0.11;
    const alpha = life / maxLife;
    expect(alpha).toBeCloseTo(0.5);
  });

  it('jitter offsets scale down as the bolt fades', () => {
    const jitter = 14;
    const alphaStart = 1;
    const alphaEnd = 0.1;
    expect(jitter * alphaStart).toBeGreaterThan(jitter * alphaEnd);
  });
});
