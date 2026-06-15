// trailBurn.ts — Trail Burn upgrade: enemies touching the trail take 1 HP per second of contact.
// Ported from arena-drifter/game.js:717–743.

import type { PlayerState } from '@gameplay/player/playerState';
import type { EnemyState } from '@gameplay/enemies/enemyState';
import { getTrailPoint, type TrailState } from '@gameplay/trail/trailState';

export interface TrailBurnResult {
  enemyDied: boolean;
  ex: number;
  ey: number;
  enemyType?: string;
}

/**
 * Check living enemies against trail points. If a living enemy touches the trail and
 * its per-enemy cooldown has expired, deal 1 HP damage (1s cooldown per enemy).
 * Returns one result per enemy that was hit this frame; caller handles FX + score.
 */
export function applyTrailBurn(
  player: PlayerState,
  enemies: EnemyState[],
  trail: TrailState,
  dt: number,
): TrailBurnResult[] {
  if (!player.trailBurn || trail.count === 0) return [];

  const results: TrailBurnResult[] = [];
  const step = Math.max(1, Math.floor(trail.count / 40));

  for (const e of enemies) {
    if (!e.alive) continue;

    // Decrement per-enemy cooldown
    if (e._trailBurnCooldown > 0) {
      e._trailBurnCooldown -= dt;
      continue;
    }

    // Sample trail points
    let hit = false;
    for (let ti = 0; ti < trail.count && !hit; ti += step) {
      const pt = getTrailPoint(trail, ti);
      const dx = e.x - pt.x;
      const dy = e.y - pt.y;
      if (dx * dx + dy * dy < (8 + e.radius) * (8 + e.radius)) {  // §4.9: reduced from 15+r to 8+r
        hit = true;
      }
    }

    if (!hit) continue;

    e.health--;
    e._trailBurnCooldown = 1.0;

    if (e.health <= 0) {
      e.alive = false;
      results.push({ enemyDied: true, ex: e.x, ey: e.y, enemyType: e.type });
    } else {
      e.armored = false;
      results.push({ enemyDied: false, ex: e.x, ey: e.y });
    }
  }

  return results;
}
