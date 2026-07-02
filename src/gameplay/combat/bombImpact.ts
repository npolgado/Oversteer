// bombImpact.ts — Bomb pickup: per-enemy impact resolution.
// Extracted from GameLoop._applyBombPickup so the decision tree (armor deflect vs.
// chip damage vs. outright kill) is directly unit-testable.

import { CFG } from '@core/config';
import type { EnemyState } from '@gameplay/enemies/enemyState';

export type BombImpactOutcome = 'skip' | 'deflect' | 'chip' | 'kill';

export interface BombImpactResult {
  outcome: BombImpactOutcome;
  /** Present for 'chip' and 'kill' — the enemy's health after the hit. */
  newHealth?: number;
  /** Present for 'deflect' and 'chip' — boss hit-flash duration to apply. */
  hitFlashTimer?: number;
}

/**
 * Resolve what a bomb pickup does to a single enemy.
 * - Dead or off-screen (not visible) enemies are skipped.
 * - Armored/invulnerable bosses deflect the hit (flash, no damage) — same rule as
 *   trail encirclement (trailUpdate.ts:141).
 * - Non-armored bosses take 1 chip of damage; only die once health reaches 0.
 * - Non-boss enemies always die outright.
 */
export function resolveBombImpact(enemy: EnemyState, visible: boolean): BombImpactResult {
  if (!enemy.alive || !visible) return { outcome: 'skip' };

  if (enemy.type === 'boss') {
    if (enemy.armored || enemy.bossVulnerable === false) {
      return { outcome: 'deflect', hitFlashTimer: CFG.BOSS_HIT_FLASH_S };
    }
    const newHealth = (enemy.health ?? 1) - 1;
    if (newHealth > 0) {
      return { outcome: 'chip', newHealth, hitFlashTimer: CFG.BOSS_HIT_FLASH_S };
    }
    return { outcome: 'kill', newHealth };
  }

  return { outcome: 'kill' };
}
