// nearMiss.ts — Near-miss event processing: scoring, combo, streak, ghost frame.

import { CFG } from '@core/config';
import type { PlayerState } from '@gameplay/player/playerState';
import type { EnemyState } from '@gameplay/enemies/enemyState';
import { applyNearMiss, applyGhostFrameNearMiss, type NearMissResult } from '@gameplay/pureLogic';

export type { NearMissResult };

export function processNearMiss(
  player: PlayerState,
  enemy: EnemyState,
  score: number,
): NearMissResult {
  const result = applyNearMiss(score, player, 'enemy');

  // Ghost frame upgrade: brief collision immunity on near-miss
  applyGhostFrameNearMiss(player, player.upgrades.includes('ghost_frame'));

  // Per-enemy cooldown prevents repeat near-miss spam
  enemy.nearMissCooldown = CFG.NEAR_MISS_COOLDOWN;

  // Streak timer: 2s window — reset on each near-miss, streak resets to 0 when it expires
  player.nearMissStreakTimer = 2.0;

  // Streak invuln reward (3+ consecutive) — from game.js:1082, not captured in pureLogic
  if (result.consecutiveNearMisses >= 3) {
    player.invulnTimer = Math.max(player.invulnTimer, 0.3);
  }

  // Apply returned state back to player
  player.comboLevel = result.comboLevel;
  player.consecutiveNearMisses = result.consecutiveNearMisses;

  // TODO: scrap spawn chance (Step 7 — CFG.SCRAP_NEAR_MISS_CHANCE = 0.35)

  return result;
}

export function processHazardNearMiss(
  player: PlayerState,
  score: number,
): NearMissResult {
  const result = applyNearMiss(score, player, 'hazard');

  player.nearMissStreakTimer = 2.0;

  if (result.consecutiveNearMisses >= 3) {
    player.invulnTimer = Math.max(player.invulnTimer, 0.3);
  }

  player.comboLevel = result.comboLevel;
  player.consecutiveNearMisses = result.consecutiveNearMisses;

  return result;
}
