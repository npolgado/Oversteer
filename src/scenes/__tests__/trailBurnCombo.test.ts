/**
 * Trail-burn combo increment tests (B3 fix).
 *
 * gameLoop.ts's trail-burn kill path (_tickTrail, ~line 1300-1317) calls the real
 * exported applyComboIncrement()/applyComboHeal() from pureLogic.ts directly, so
 * these tests exercise the actual implementation, not a reimplementation of it.
 */
import { describe, it, expect } from 'vitest';
import { CFG } from '@core/config';
import { applyComboHeal, applyComboIncrement } from '@gameplay/pureLogic';

describe('trail burn — combo +1 per kill', () => {
  it('increments combo by 1 on a burn kill', () => {
    expect(applyComboIncrement(3, 1)).toBe(4);
  });

  it('clamps combo at MAX_COMBO', () => {
    expect(applyComboIncrement(CFG.MAX_COMBO, 1)).toBe(CFG.MAX_COMBO);
  });

  it('combo +1 is less than encircle +2 per kill', () => {
    const base = 5;
    const afterBurn = applyComboIncrement(base, 1);
    const afterEncircle = applyComboIncrement(base, 2);
    expect(afterBurn).toBeLessThan(afterEncircle);
  });

  it('applyComboHeal triggers at milestone 3 after burn pushes combo across', () => {
    // combo 2 → 3 via burn: milestone fires (combo_heal upgrade)
    const hp = 80;
    const maxHp = 100;
    const newHp = applyComboHeal(2, 3, true, hp, maxHp);
    expect(newHp).toBeGreaterThan(hp);
  });

  it('applyComboHeal does not trigger when combo stays below milestone', () => {
    const hp = 80;
    const maxHp = 100;
    const newHp = applyComboHeal(0, 1, true, hp, maxHp);
    expect(newHp).toBe(hp);
  });
});
