import { describe, it, expect } from 'vitest';
import { computePlayerRotation } from '../playerRendererUtils';

describe('computePlayerRotation', () => {
  it('returns heading + PI/2 for heading=0', () => {
    expect(computePlayerRotation(0)).toBeCloseTo(Math.PI / 2);
  });

  it('returns heading + PI/2 for arbitrary heading', () => {
    expect(computePlayerRotation(Math.PI)).toBeCloseTo(Math.PI + Math.PI / 2);
    expect(computePlayerRotation(-Math.PI / 4)).toBeCloseTo(-Math.PI / 4 + Math.PI / 2);
  });

  it('regression: heading=0 does not return PI (the reverse-flip angle)', () => {
    // Before fix: Math.atan2(-500, 0) + PI/2 = PI when reversing with heading=0
    expect(computePlayerRotation(0)).not.toBeCloseTo(Math.PI);
  });
});
