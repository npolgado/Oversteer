// bossPatterns.ts — Per-pattern AI update functions for the boss enemy type.
// Each function mutates the boss EnemyState and returns a desired {tx, ty} target.

import { CFG } from '@core/config';
import type { PlayerState } from '@gameplay/player/playerState';
import type { EnemyState } from './enemyState';

export interface BossPatternResult {
  tx: number;
  ty: number;
  throttle: boolean;
}

// ── Pursuer ────────────────────────────────────────────────────────────────
// Alternates telegraph (slow spiral) and charge (locked straight dash) phases.
export function updatePursuer(
  state: EnemyState,
  player: PlayerState,
  dt: number,
): BossPatternResult {
  state.bossPhaseTimer = (state.bossPhaseTimer ?? CFG.BOSS_TELEGRAPH_DUR) - dt;

  if (state.bossPhase === 'telegraph') {
    // Circle around the player while "telegraphing"
    const spiralAngle = Math.atan2(state.y - player.y, state.x - player.x) + 0.015;
    const orbitR = 350;
    const tx = player.x + Math.cos(spiralAngle) * orbitR;
    const ty = player.y + Math.sin(spiralAngle) * orbitR;

    if (state.bossPhaseTimer <= 0) {
      // Lock target and start charge
      state.bossChargeTargetX = player.x;
      state.bossChargeTargetY = player.y;
      state.bossPhase = 'charge';
      state.bossPhaseTimer = CFG.BOSS_CHARGE_DUR;
      state.maxSpeed = CFG.BOSS_CHARGE_SPEED;
    }
    return { tx, ty, throttle: true };
  }

  if (state.bossPhase === 'charge') {
    const tx = state.bossChargeTargetX ?? player.x;
    const ty = state.bossChargeTargetY ?? player.y;
    if (state.bossPhaseTimer <= 0) {
      state.bossPhase = 'telegraph';
      state.bossPhaseTimer = CFG.BOSS_TELEGRAPH_DUR;
      state.maxSpeed = CFG.BOSS_SPEED;
    }
    return { tx, ty, throttle: true };
  }

  return { tx: player.x, ty: player.y, throttle: true };
}

// ── Core ────────────────────────────────────────────────────────────────────
// Stationary near arena center. Periodically spawns minion rings (vulnerable
// during the spawn-cooldown window). Invulnerable otherwise.
export function updateCore(
  state: EnemyState,
  _player: PlayerState,
  dt: number,
): BossPatternResult {
  const centerX = CFG.WORLD_W / 2;
  const centerY = CFG.WORLD_H / 2;

  state.bossPhaseTimer = (state.bossPhaseTimer ?? CFG.BOSS_INVULN_DUR) - dt;

  if (state.bossPhase === 'invuln' || state.bossPhase === 'telegraph') {
    state.armored = true;
    state.bossVulnerable = false;
    if (state.bossPhaseTimer <= 0) {
      // Spawn a ring of minions then become vulnerable
      state._bossSpawnMinion = true;
      state.bossPhase = 'vulnerable';
      state.bossPhaseTimer = CFG.BOSS_VULNERABLE_DUR;
      state.armored = false;
      state.bossVulnerable = true;
    }
  } else if (state.bossPhase === 'vulnerable') {
    state.armored = false;
    state.bossVulnerable = true;
    if (state.bossPhaseTimer <= 0) {
      state.bossPhase = 'invuln';
      state.bossPhaseTimer = CFG.BOSS_INVULN_DUR;
    }
  }

  // Hover near arena center
  return { tx: centerX, ty: centerY, throttle: true };
}

// ── Reflector ───────────────────────────────────────────────────────────────
// Moves in a figure-eight at moderate speed. Permanently armored — trail
// encirclement strips armor but it re-arms each phase. Must use bomb pickup.
export function updateReflector(
  state: EnemyState,
  _player: PlayerState,
  dt: number,
): BossPatternResult {
  // Always re-arm so trail encirclement can't get the kill
  state.armored = true;
  state.bossVulnerable = false;

  state.bossPhaseTimer = (state.bossPhaseTimer ?? 0) + dt;

  // Figure-eight parametric path centered in arena
  const t = state.bossPhaseTimer * 0.4;
  const r = 450;
  const tx = CFG.WORLD_W / 2 + r * Math.sin(t);
  const ty = CFG.WORLD_H / 2 + r * Math.sin(t) * Math.cos(t);

  return { tx, ty, throttle: true };
}
