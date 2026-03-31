// collision.ts — Circle-circle collision and near-miss detection between player and enemies.

import { CFG } from '@core/config';
import { getPlayerRadius, type PlayerState } from '@gameplay/player/playerState';
import type { EnemyState } from '@gameplay/enemies/enemyState';
import { dist } from '@core/utils';

export function checkPlayerEnemyCollision(player: PlayerState, enemy: EnemyState): boolean {
  if (!enemy.alive) return false;
  if (player.invulnTimer > 0 || player.ghostFrameTimer > 0) return false;
  const d = dist(player.x, player.y, enemy.x, enemy.y);
  return d < getPlayerRadius(player) + enemy.radius;
}

export function checkNearMiss(player: PlayerState, enemy: EnemyState): boolean {
  if (!player.drifting || !enemy.alive) return false;
  if (enemy.nearMissCooldown > 0) return false;
  const pr = getPlayerRadius(player);
  const d = dist(player.x, player.y, enemy.x, enemy.y);
  const collDist = pr + enemy.radius;
  const nearDist = pr + enemy.radius + CFG.NEAR_MISS_ENEMY;
  return d >= collDist && d < nearDist;
}

export function applyKnockback(
  player: PlayerState,
  source: { x: number; y: number },
  strength: number,
): void {
  const dx = player.x - source.x;
  const dy = player.y - source.y;
  const d = Math.hypot(dx, dy) || 1;
  player.vx += (dx / d) * strength;
  player.vy += (dy / d) * strength;
}
