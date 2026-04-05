// playerUpdate.ts — Pure player update function.
// Ported from arena-drifter/entities.js Player.update().
// No audio or particle calls — callers read state and emit events.

import { CFG } from '@core/config';
import { vec2FromAngle } from '@core/utils';
import { updatePhysics } from '@gameplay/physics';
import { applyComboDecay, applyHpRegen, updateNearMissStreak } from '@gameplay/pureLogic';
import type { PlayerState } from './playerState';

export interface PlayerUpdateContext {
  dt: number;
  gameClock: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  drift: boolean;
}

export function updatePlayer(state: PlayerState, ctx: PlayerUpdateContext): void {
  const { dt } = ctx;

  state.glowPhase += dt;
  if (state.frozen) return;

  // Turn input
  let turnInput = 0;
  if (ctx.left) turnInput -= 1;
  if (ctx.right) turnInput += 1;

  // Lean FX
  if (turnInput !== 0) { state.leanTimer = 0.08; state.leanDir = turnInput; }
  if (state.leanTimer > 0) state.leanTimer -= dt;

  // Exhaust FX
  if (ctx.up) state.exhaustTimer = 0.06;
  if (state.exhaustTimer > 0) state.exhaustTimer -= dt;

  state.braking = ctx.down;

  // Handbrake: reverse while moving forward fast
  const speed = Math.hypot(state.vx, state.vy);
  if (ctx.down && speed > CFG.DRIFT_THRESHOLD && !state.drifting) {
    const fwd = vec2FromAngle(state.heading);
    const dot = state.vx * fwd.x + state.vy * fwd.y;
    if (dot > 30 && state.handbrakeTimer <= 0) {
      state.handbrakeTimer = CFG.HANDBRAKE_DURATION;
    }
  }
  if (state.handbrakeTimer > 0) state.handbrakeTimer -= dt;

  // Speed boost timer
  if (state.speedBoostTimer > 0) state.speedBoostTimer -= dt;

  // Near-miss streak timer
  updateNearMissStreak(state, dt);

  // HP regen
  applyHpRegen(state, dt);

  // Drift denied FX
  if (ctx.drift && speed < CFG.DRIFT_THRESHOLD && !state.drifting) {
    state.driftDeniedTimer = 0.12;
  }
  if (state.driftDeniedTimer > 0) state.driftDeniedTimer -= dt;

  // Temporary modifier overrides
  const origTurn = state.turnRate;
  const origMaxSpeed = state.maxSpeed;

  if (state.tightTurns) state.turnRate = CFG.TURN_RATE * 1.25;
  if (state.handbrakeTimer > 0) state.turnRate *= CFG.HANDBRAKE_TURN_MULT;
  if (state.speedBoostTimer > 0) state.maxSpeed *= CFG.BOOST_ZONE_MULT;
  if (state.nitroDrift && state.drifting) state.maxSpeed *= 1.3;

  // Dash burst
  if (state.dashCooldown > 0) state.dashCooldown -= dt;
  if (state.dashBurst && ctx.down && speed > 300 && state.dashCooldown <= 0 && !state.drifting) {
    state.dashCooldown = 3.0;
    state.invulnTimer = 0.2;
    state.maxSpeed *= 1.3;
  }

  state.wallHit = false;
  state.driftJustStarted = false;
  updatePhysics(state, dt, turnInput, ctx.up, ctx.down, ctx.drift, true, ctx.gameClock);

  // Restore temp modifiers
  state.turnRate = origTurn;
  state.maxSpeed = origMaxSpeed;

  // Handbrake deceleration
  if (state.handbrakeTimer > 0) {
    const spd = Math.hypot(state.vx, state.vy);
    if (spd > 10) {
      const decel = Math.min(CFG.HANDBRAKE_DECEL * dt, spd * 0.5);
      const s = (spd - decel) / spd;
      state.vx *= s;
      state.vy *= s;
    }
  }

  // Wall riding detection
  const pad = CFG.ARENA_PAD;
  const wd = CFG.WALL_RIDE_DIST;
  state.wallRiding = state.drifting && (
    state.x < pad + wd || state.x > CFG.WORLD_W - pad - wd ||
    state.y < pad + wd || state.y > CFG.WORLD_H - pad - wd
  );
  if (state.wallRiding) {
    const fwd = vec2FromAngle(state.heading);
    const boost = CFG.WALL_RIDE_SPEED_BONUS * state.maxSpeed * dt;
    state.vx += fwd.x * boost;
    state.vy += fwd.y * boost;
  }

  // Drift time tracking + chain recording
  const wasDrifting = state.driftTime > 0;
  if (state.drifting) {
    state.driftTime += dt;
  } else {
    if (wasDrifting) {
      // NOTE: diverges from original — original uses performance.now()/1000 (entities.js:207).
      // Both store and compare use gameClock so chaining is internally consistent,
      // but if gameClock resets mid-session (e.g., scene restart), lastDriftEndTime
      // becomes stale and drift chaining will fail until the next drift ends.
      state.lastDriftEndTime = state.driftTime > 0.1 ? ctx.gameClock : 0;
    }
    state.driftTime = 0;
    state.comboLevel = applyComboDecay(state.comboLevel, state.comboMaster, dt);
  }

  // Timers
  if (state.invulnTimer > 0) state.invulnTimer -= dt;
  if (state.ghostFrameTimer > 0) state.ghostFrameTimer -= dt;
  if (state.slowTimer > 0) state.slowTimer -= dt;
}
