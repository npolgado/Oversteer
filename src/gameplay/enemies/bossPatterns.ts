// bossPatterns.ts — Per-pattern AI update functions for the boss enemy type.
// Each function mutates the boss EnemyState and returns a desired {tx, ty} target.
//
// Phase 4.9: each boss now has a telegraphed threat→dodge→punish cycle:
//   Pursuer:   telegraph (orbit) → charge (dodge) → recover (punish/loop window)
//   Core:      invuln (armored, warns at -1s) → vulnerable (loop window, spawns minions)
//   Reflector: figure-eight moving → center-pause (vulnerable, loop window) → resume

import { CFG } from '@core/config';
import type { PlayerState } from '@gameplay/player/playerState';
import type { EnemyState } from './enemyState';

export interface BossPatternResult {
  tx: number;
  ty: number;
  throttle: boolean;
}

// ── Pursuer ────────────────────────────────────────────────────────────────
// telegraph (slow orbit, builds visual tension) →
// charge (high-speed locked dash — dodge window) →
// recover (stagger, ~1.2s — punish/loop window, bossVulnerable=true)
export function updatePursuer(
  state: EnemyState,
  player: PlayerState,
  dt: number,
): BossPatternResult {
  state.bossPhaseTimer = (state.bossPhaseTimer ?? CFG.BOSS_TELEGRAPH_DUR) - dt;

  if (state.bossPhase === 'telegraph') {
    const spiralAngle = Math.atan2(state.y - player.y, state.x - player.x) + 0.015;
    const orbitR = CFG.BOSS_TELEGRAPH_ORBIT_R;
    const tx = player.x + Math.cos(spiralAngle) * orbitR;
    const ty = player.y + Math.sin(spiralAngle) * orbitR;

    if (state.bossPhaseTimer <= 0) {
      state.bossChargeTargetX = player.x;
      state.bossChargeTargetY = player.y;
      state.bossPhase = 'charge';
      state.bossPhaseTimer = CFG.BOSS_CHARGE_DUR;
      state.maxSpeed = CFG.BOSS_CHARGE_SPEED;
      state.armored = true;
      state.bossVulnerable = false;
    }
    return { tx, ty, throttle: true };
  }

  if (state.bossPhase === 'charge') {
    const tx = state.bossChargeTargetX ?? player.x;
    const ty = state.bossChargeTargetY ?? player.y;
    if (state.bossPhaseTimer <= 0) {
      // Enter recover — this is the punish/loop window
      state.bossPhase = 'recover';
      state.bossPhaseTimer = CFG.BOSS_RECOVER_DUR;
      state.maxSpeed = CFG.BOSS_SPEED * 0.4;  // slow stagger drift
      state.armored = false;
      state.bossVulnerable = true;
    }
    return { tx, ty, throttle: true };
  }

  if (state.bossPhase === 'recover') {
    // Drift slowly in place — player loops now
    if (state.bossPhaseTimer <= 0) {
      state.bossPhase = 'telegraph';
      state.bossPhaseTimer = CFG.BOSS_TELEGRAPH_DUR;
      state.maxSpeed = CFG.BOSS_SPEED;
      state.armored = false;
      state.bossVulnerable = false;
    }
    // Drift to where the charge ended — no active chasing during stagger
    const tx = state.bossChargeTargetX ?? state.x;
    const ty = state.bossChargeTargetY ?? state.y;
    return { tx, ty, throttle: false };
  }

  return { tx: player.x, ty: player.y, throttle: true };
}

// ── Core ────────────────────────────────────────────────────────────────────
// invuln (armored, stationary) → [warn at last BOSS_INVULN_WARN_T secs = gold flicker] →
// vulnerable (spawns minion ring, loop window, BOSS_VULNERABLE_DUR secs) → invuln ...
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
    // Pre-vulnerable warning window: gold flicker so player can prepare
    state.bossWarning = (state.bossPhaseTimer ?? 0) <= CFG.BOSS_INVULN_WARN_T;

    if (state.bossPhaseTimer <= 0) {
      state._bossSpawnMinion = true;
      state.bossPhase = 'vulnerable';
      state.bossPhaseTimer = CFG.BOSS_VULNERABLE_DUR;
      state.armored = false;
      state.bossVulnerable = true;
      state.bossWarning = false;
    }
  } else if (state.bossPhase === 'vulnerable') {
    state.armored = false;
    state.bossVulnerable = true;
    state.bossWarning = false;
    if (state.bossPhaseTimer <= 0) {
      state.bossPhase = 'invuln';
      state.bossPhaseTimer = CFG.BOSS_INVULN_DUR;
    }
  }

  return { tx: centerX, ty: centerY, throttle: true };
}

// ── Reflector ───────────────────────────────────────────────────────────────
// figure-eight path (armored) → when path passes near center, pause and become
// vulnerable for BOSS_REFLECTOR_PAUSE_DUR secs (loop window) → resume figure-eight.
// This removes the bomb-only dead-end: encirclement works during the center pause.
export function updateReflector(
  state: EnemyState,
  _player: PlayerState,
  dt: number,
): BossPatternResult {
  const cx = CFG.WORLD_W / 2;
  const cy = CFG.WORLD_H / 2;

  if (state.bossPhase === 'vulnerable') {
    // Center-pause vulnerable window
    state.armored = false;
    state.bossVulnerable = true;
    state.bossPhaseTimer = (state.bossPhaseTimer ?? CFG.BOSS_REFLECTOR_PAUSE_DUR) - dt;
    if (state.bossPhaseTimer <= 0) {
      // Resume figure-eight from the safe resume point we stashed before pausing
      state.bossPhase = 'telegraph';
      state.armored = true;
      state.bossVulnerable = false;
      // Restore the figure-eight timer from the stashed value (bossChargeTargetX was reused)
      state.bossPhaseTimer = state.bossChargeTargetX ?? 0;
      state.bossChargeTargetX = undefined;
    }
    return { tx: cx, ty: cy, throttle: true };
  }

  // Default: figure-eight (armored)
  state.armored = true;
  state.bossVulnerable = false;
  state.bossPhaseTimer = (state.bossPhaseTimer ?? 0) + dt;

  const t = state.bossPhaseTimer * 0.4;
  const r = 450;
  const tx = cx + r * Math.sin(t);
  const ty = cy + r * Math.sin(t) * Math.cos(t);

  // Detect passage near center — trigger pause window
  const distToCenter = Math.hypot(state.x - cx, state.y - cy);
  if (distToCenter < CFG.BOSS_REFLECTOR_VULN_R) {
    // After the pause ends we resume the figure-eight from a point away from center.
    // sin(t) = 0 at t = nπ — these are all center crossings. Snap t to π/2 + nπ
    // so the boss resumes at the extreme ends (±r) far from center.
    const currentT = state.bossPhaseTimer * 0.4;
    const n = Math.round(currentT / Math.PI);
    const safeRawT = (n + 0.5) * Math.PI;  // nearest π/2 + nπ — furthest from center
    state.bossPhaseTimer = safeRawT / 0.4;  // convert back to timer units
    state.bossPhase = 'vulnerable';
    // Store resume timer separately — vulnerable phase counts down from PAUSE_DUR
    // (we'll restore bossPhaseTimer to safeRawT / 0.4 when resuming in the vulnerable branch)
    state.bossChargeTargetX = state.bossPhaseTimer;  // reuse field to stash resume point
    state.bossPhaseTimer = CFG.BOSS_REFLECTOR_PAUSE_DUR;
    state.armored = false;
    state.bossVulnerable = true;
    return { tx: cx, ty: cy, throttle: true };
  }

  return { tx, ty, throttle: true };
}
