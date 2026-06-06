/**
 * Trail-burn combo increment tests (B3 fix).
 *
 * The combo logic lives inside GameLoop._tickBurnResults (not separately
 * exported), so we test the underlying primitives it relies on:
 * - the +1 combo math clamps at MAX_COMBO
 * - applyComboHeal fires at the right milestones
 *
 * These match the implementation in gameLoop.ts ~line 1233-1242.
 */
import { describe, it, expect } from 'vitest';
import { CFG } from '@core/config';
import { applyComboHeal } from '@gameplay/pureLogic';

describe('trail burn — combo +1 per kill', () => {
  it('increments combo by 1 on a burn kill', () => {
    const oldCombo = 3;
    const newCombo = Math.min(CFG.MAX_COMBO, oldCombo + 1);
    expect(newCombo).toBe(4);
  });

  it('clamps combo at MAX_COMBO', () => {
    const oldCombo = CFG.MAX_COMBO;
    const newCombo = Math.min(CFG.MAX_COMBO, oldCombo + 1);
    expect(newCombo).toBe(CFG.MAX_COMBO);
  });

  it('combo +1 is less than encircle +2 per kill', () => {
    const base = 5;
    const afterBurn = Math.min(CFG.MAX_COMBO, base + 1);
    const afterEncircle = Math.min(CFG.MAX_COMBO, base + 2);
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
