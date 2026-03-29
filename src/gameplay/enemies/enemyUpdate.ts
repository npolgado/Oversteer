// enemyUpdate.ts — Per-frame enemy AI and physics update.
// Pure function — no side effects. Caller reads EnemyUpdateResult.

import { updatePhysics } from '@gameplay/physics';
import { angleDiff, clamp } from '@core/utils';
import { CFG } from '@core/config';
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
): EnemyUpdateResult {
  // Compute target position
  let tx = player.x;
  let ty = player.y;

  if (state.type === 'interceptor') {
    tx = player.x + player.vx * 0.5;
    ty = player.y + player.vy * 0.5;
  }

  // Steering
  const desiredHeading = Math.atan2(ty - state.y, tx - state.x);
  const diff = angleDiff(state.heading, desiredHeading);
  const turnInput = clamp(diff * 3, -1, 1);

  const dx = state.x - player.x;
  const dy = state.y - player.y;
  const distToPlayer = Math.hypot(dx, dy);

  // Reset per-frame flags before physics (mirrors playerUpdate.ts)
  state.wallHit = false;
  state.driftJustStarted = false;

  // isPlayer=false, braking=false, wantDrift=false
  updatePhysics(state, dt, turnInput, true, false, false, false, gameClock);

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
  if (distToPlayer > CFG.ENEMY_FAR_DESPAWN_DIST) return { despawned: true };

  return { despawned: false };
}
