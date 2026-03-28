import { describe, it, expect } from 'vitest';
import { CFG, S, MAPS, MAPS_BY_ID } from '../config';

describe('CFG', () => {
  it('has correct resolution', () => {
    expect(CFG.W).toBe(1600);
    expect(CFG.H).toBe(900);
  });

  it('has correct physics constants', () => {
    expect(CFG.MAX_SPEED).toBe(520);
    expect(CFG.LATERAL_FRICTION).toBe(8.5);
    expect(CFG.DRIFT_LATERAL).toBe(3.2);
    expect(CFG.FORWARD_DRAG).toBe(1.7);
    expect(CFG.DRIFT_DRAG).toBe(2.1);
    expect(CFG.HANDBRAKE_DECEL).toBe(1800);
  });

  it('has correct world dimensions', () => {
    expect(CFG.WORLD_W).toBe(3000);
    expect(CFG.WORLD_H).toBe(3000);
  });

  it('has two maps defined', () => {
    expect(MAPS).toHaveLength(2);
    expect(MAPS_BY_ID['arena']).toBeDefined();
    expect(MAPS_BY_ID['arena_02']).toBeDefined();
  });

  it('S() scales reference resolution pixels', () => {
    // At 1600x900 vs 1280x720, S = min(1600/1280, 900/720) = min(1.25, 1.25) = 1.25
    expect(S(100)).toBe(Math.round(100 * Math.min(1600 / 1280, 900 / 720)));
  });
});
