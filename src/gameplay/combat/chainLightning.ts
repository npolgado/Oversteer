// chainLightning.ts — Chain Lightning upgrade: each encirclement kill chains to 1 nearby enemy.
// Ported from arena-drifter/world.js:397–424.

import type { EnemyState } from '@gameplay/enemies/enemyState';

export interface ChainResult {
  /** Midpoint x between killer and target (for spark FX). */
  midX: number;
  /** Midpoint y between killer and target (for spark FX). */
  midY: number;
  targetDied: boolean;
}

const CHAIN_RANGE = 200;

/**
 * For each killed enemy, find the nearest surviving enemy within CHAIN_RANGE and deal 1 HP.
 * Returns one result per successful chain; caller handles FX.
 */
export function applyChainLightning(
  killedEnemies: EnemyState[],
  allEnemies: EnemyState[],
  scoreMult: number,
): { chains: ChainResult[]; scoreGained: number } {
  const chains: ChainResult[] = [];
  let scoreGained = 0;

  for (const dead of killedEnemies) {
    let closest: EnemyState | null = null;
    let closestDist = CHAIN_RANGE;

    for (const e of allEnemies) {
      if (!e.alive) continue;
      const dx = e.x - dead.x;
      const dy = e.y - dead.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < closestDist) {
        closestDist = d;
        closest = e;
      }
    }

    if (!closest) continue;

    closest.health--;
    const midX = (dead.x + closest.x) / 2;
    const midY = (dead.y + closest.y) / 2;

    if (closest.health <= 0) {
      closest.alive = false;
      scoreGained += 50 * scoreMult;
      chains.push({ midX, midY, targetDied: true });
    } else {
      closest.armored = false;
      chains.push({ midX, midY, targetDied: false });
    }
  }

  return { chains, scoreGained };
}
