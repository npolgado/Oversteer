// enemyUpdate.ts — Per-frame enemy AI and physics update.
// Pure function — no side effects. Caller reads EnemyUpdateResult.

import { updatePhysics } from '@gameplay/physics';
import { angleDiff, clamp, dist } from '@core/utils';
import { CFG } from '@core/config';
import { computeFlankTarget, computeBlockerTarget } from '@gameplay/pureLogic';
import { updatePursuer, updateCore, updateReflector } from './bossPatterns';
import type { PlayerState } from '@gameplay/player/playerState';
import type { EnemyState } from './enemyState';

export interface EnemyUpdateResult {
  despawned: boolean;
}

export function updateEnemy(
  state: EnemyState,
  player: PlayerState,
  dt: number,
  gameClock: number,
  isVisible: (x: number, y: number, margin: number) => boolean,
  trailPoints?: Array<{ x: number; y: number }> | null,
): EnemyUpdateResult {
  // Declare per-type flags
  let wantDrift = false;
  let throttle = true;

  // Compute target position
  let tx = player.x;
  let ty = player.y;

  // Boss patterns override all normal AI
  if (state.type === 'boss') {
    const pattern = state.bossPattern ?? 'pursuer';
    let result;
    if (pattern === 'pursuer')   result = updatePursuer(state, player, dt);
    else if (pattern === 'core') result = updateCore(state, player, dt);
    else                         result = updateReflector(state, player, dt);

    tx = result.tx;
    ty = result.ty;
    throttle = result.throttle;
  }
  // AI branches per type (mirror entities.js update method)
  else if (state.type === 'interceptor') {
    // Lead the player
    const lookAhead = 0.5;
    tx = player.x + player.vx * lookAhead;
    ty = player.y + player.vy * lookAhead;
  } else if (state.type === 'blocker') {
    // Target trail midpoint to block encirclement routes
    if (trailPoints && trailPoints.length > 0) {
      const target = computeBlockerTarget(trailPoints);
      if (target) {
        tx = target.x;
        ty = target.y;
        const distToTarget = dist(state.x, state.y, tx, ty);
        if (distToTarget < 80) {
          state.holdingTrail = true;
          // Face the player while holding position
          tx = player.x;
          ty = player.y;
          throttle = false; // stop accelerating, park near trail
        } else {
          state.holdingTrail = false;
        }
      }
    }
  } else if (state.type === 'flanker') {
    // Flank side switching and striking
    state.flankSwitchTimer = (state.flankSwitchTimer ?? 3) - dt;
    if (state.flankSwitchTimer <= 0) {
      state.flankSide = Math.random() < 0.5 ? 1 : -1;
      state.flankSwitchTimer = 3 + Math.random() * 2;
    }
    const distToPlayer = dist(state.x, state.y, player.x, player.y);
    const pSpeed = Math.hypot(player.vx, player.vy);
    if (state.striking) {
      // Direct charge at player
      state.strikeTimer = (state.strikeTimer ?? 1) - dt;
      if (state.strikeTimer <= 0) state.striking = false;
    } else if (distToPlayer < 120) {
      // Close enough — strike!
      state.striking = true;
      state.strikeTimer = 1.0;
    } else {
      const ft = computeFlankTarget(player.x, player.y, player.vx, player.vy, state.flankSide ?? 1);
      tx = ft.x; ty = ft.y;
    }
  } else if (state.type === 'bomber') {
    // Orbit ahead of player, drop hazard zones
    const pSpeed = Math.hypot(player.vx, player.vy);
    if (pSpeed > 30) {
      tx = player.x + (player.vx / pSpeed) * 300;
      ty = player.y + (player.vy / pSpeed) * 300;
    }
    state.bombTimer = (state.bombTimer ?? CFG.BOMB_ZONE_INTERVAL) - dt;
    if (state.bombTimer <= 0) {
      state.bombTimer = CFG.BOMB_ZONE_INTERVAL;
      state._dropBomb = true;
    }
  } else if (state.type === 'drifter') {
    // Periodic drift toggles
    if (state.drifting) {
      // Currently drifting — count down duration
      state.driftDuration = (state.driftDuration ?? 0) - dt;
      if (state.driftDuration > 0) {
        wantDrift = true;
      } else {
        // Drift ended, set cooldown before next drift
        wantDrift = false;
        state.driftToggleTimer = 1.5 + Math.random() * 1.5;
      }
    } else {
      // Not drifting — count down until next drift
      state.driftToggleTimer = (state.driftToggleTimer ?? 2) - dt;
      if (state.driftToggleTimer <= 0) {
        wantDrift = true;
        state.driftDuration = 1 + Math.random() * 1.5;
      }
    }
  }
  // Elite and chaser: no special AI branch (just chase player)

  // Steering
  const desiredHeading = Math.atan2(ty - state.y, tx - state.x);
  const diff = angleDiff(state.heading, desiredHeading);
  const turnInput = clamp(diff * 3, -1, 1);

  // Reset per-frame flags before physics (mirrors playerUpdate.ts)
  state.wallHit = false;
  state.driftJustStarted = false;

  updatePhysics(state, dt, turnInput, throttle, false, wantDrift, false, gameClock);

  // Lifespan
  state.age += dt;

  // Fade out in last 2s
  const remaining = state.lifespan - state.age;
  state.fadeAlpha = remaining < 2 ? Math.max(0, remaining / 2) : 1;

  // Offscreen detection via camera viewport (matches original Camera.isVisible check)
  const offscreen = !isVisible(state.x, state.y, 40);

  if (offscreen) {
    state.offscreenTimer += dt;
    state.maxSpeed = state.baseMaxSpeed * CFG.ENEMY_OFFSCREEN_BOOST;
  } else {
    state.offscreenTimer = 0;
    state.maxSpeed = state.baseMaxSpeed;
  }

  // Near-miss cooldown
  if (state.nearMissCooldown > 0) state.nearMissCooldown -= dt;

  // Despawn conditions
  if (state.age >= state.lifespan) return { despawned: true };
  if (state.offscreenTimer > CFG.ENEMY_OFFSCREEN_DESPAWN) return { despawned: true };
  if (dist(state.x, state.y, player.x, player.y) > CFG.ENEMY_FAR_DESPAWN_DIST) return { despawned: true };

  return { despawned: false };
}
