// physics.ts — Ported from arena-drifter/physics.js.
// Shared physics update for player and enemies.

import { CFG } from '@core/config';
import { clamp, normalizeAngle, vec2FromAngle } from '@core/utils';

export interface PhysicsEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  drifting: boolean;
  driftJustStarted: boolean;
  maxSpeed: number;
  turnRate: number;
  driftKing: boolean;
  afterburner: boolean;
  nitroDrift: boolean;
  lastDriftEndTime: number;
  driftChain: number;
  slipTimer: number;
  slipStrength: number;
  slowTimer: number;
  slowStrength: number;
  wallHit: boolean;
}

/**
 * Shared physics update — runs for both player and enemies each frame.
 *
 * @param ent       Entity to update (mutated in-place)
 * @param dt        Delta time in seconds
 * @param turnInput Steering input (-1 left, +1 right, 0 neutral)
 * @param throttle  Whether forward acceleration is applied
 * @param braking   Whether braking/reverse input is applied
 * @param wantDrift Whether the entity wants to drift this frame
 * @param isPlayer  Whether this entity is the player (enables drift chaining)
 * @param gameClock Current game clock in seconds (replaces performance.now())
 */
export function updatePhysics(
  ent: PhysicsEntity,
  dt: number,
  turnInput: number,
  throttle: boolean,
  braking: boolean,
  wantDrift: boolean,
  isPlayer: boolean,
  gameClock: number,
): void {
  const speed = Math.hypot(ent.vx, ent.vy);

  if (wantDrift && speed >= CFG.DRIFT_THRESHOLD) {
    if (!ent.drifting) {
      ent.drifting = true;
      ent.driftJustStarted = true;
      let driftBoost = CFG.DRIFT_BOOST;
      if (ent.driftKing) driftBoost *= 1.5;
      if (ent.afterburner) driftBoost *= 2;
      // NOTE: combined upgrade speed cap -- prevents Nitro Drift + Afterburner + Drift King stacking past terminal velocity
      driftBoost = Math.min(driftBoost, CFG.MAX_SPEED * 0.7);
      if (isPlayer && ent.lastDriftEndTime > 0) {
        // NOTE: diverges from original — original uses performance.now()/1000 (physics.js:20).
        const elapsed = gameClock - ent.lastDriftEndTime;
        if (elapsed < CFG.DRIFT_CHAIN_WINDOW) {
          ent.driftChain = Math.min(2, (ent.driftChain || 0) + 1);
          const chainMult = ent.driftChain === 1 ? CFG.DRIFT_CHAIN_MULT_1 : CFG.DRIFT_CHAIN_MULT_2;
          driftBoost *= chainMult;
        } else {
          ent.driftChain = 0;
        }
        ent.lastDriftEndTime = 0;
      }
      const dir = vec2FromAngle(ent.heading);
      ent.vx += dir.x * driftBoost;
      ent.vy += dir.y * driftBoost;
    }
  } else {
    ent.drifting = false;
  }

  // Turn rate reduces at high speed
  const speedFrac = clamp(speed / (ent.maxSpeed || CFG.MAX_SPEED), 0, 1);
  const turnMult = 1 - speedFrac * CFG.TURN_REDUCE_AT_MAX;
  const turnRate = (ent.turnRate || CFG.TURN_RATE) * turnMult;
  ent.heading += turnInput * turnRate * dt;
  ent.heading = normalizeAngle(ent.heading);

  const fwd = vec2FromAngle(ent.heading);
  if (throttle) {
    ent.vx += fwd.x * CFG.ACCEL * dt;
    ent.vy += fwd.y * CFG.ACCEL * dt;
  }
  if (braking) {
    const dot = ent.vx * fwd.x + ent.vy * fwd.y;
    if (dot > 30) {
      ent.vx -= fwd.x * CFG.ACCEL * 1.5 * dt;
      ent.vy -= fwd.y * CFG.ACCEL * 1.5 * dt;
    } else {
      ent.vx -= fwd.x * CFG.REVERSE_ACCEL * dt;
      ent.vy -= fwd.y * CFG.REVERSE_ACCEL * dt;
    }
  }

  // Decompose into forward and lateral components for friction
  const dot = ent.vx * fwd.x + ent.vy * fwd.y;
  const latX = ent.vx - fwd.x * dot;
  const latY = ent.vy - fwd.y * dot;

  let latFric = ent.drifting ? CFG.DRIFT_LATERAL : CFG.LATERAL_FRICTION;
  if (ent.drifting && ent.driftKing) latFric *= 0.75;
  const fwdDrag = ent.drifting ? CFG.DRIFT_DRAG : CFG.FORWARD_DRAG;

  // Oil slip reduces lateral friction — allows sliding on puddles
  const effectiveLatFric = ent.slipTimer > 0 ? latFric * (ent.slipStrength || 0.6) : latFric;

  const latDecay = Math.exp(-effectiveLatFric * dt);
  const fwdDecay = Math.exp(-fwdDrag * dt);

  ent.vx = fwd.x * dot * fwdDecay + latX * latDecay;
  ent.vy = fwd.y * dot * fwdDecay + latY * latDecay;

  const newSpeed = Math.hypot(ent.vx, ent.vy);
  let maxSpd = braking && !throttle ? CFG.REVERSE_MAX : (ent.maxSpeed || CFG.MAX_SPEED);
  if (ent.slowTimer > 0) maxSpd *= ent.slowStrength;
  if (newSpeed > maxSpd) {
    const s = maxSpd / newSpeed;
    ent.vx *= s;
    ent.vy *= s;
  }

  ent.x += ent.vx * dt;
  ent.y += ent.vy * dt;

  const pad = CFG.ARENA_PAD;
  if (ent.x < pad) { ent.x = pad; ent.vx = Math.abs(ent.vx) * CFG.BOUNCE_RETAIN; ent.wallHit = true; }
  if (ent.x > CFG.WORLD_W - pad) { ent.x = CFG.WORLD_W - pad; ent.vx = -Math.abs(ent.vx) * CFG.BOUNCE_RETAIN; ent.wallHit = true; }
  if (ent.y < pad) { ent.y = pad; ent.vy = Math.abs(ent.vy) * CFG.BOUNCE_RETAIN; ent.wallHit = true; }
  if (ent.y > CFG.WORLD_H - pad) { ent.y = CFG.WORLD_H - pad; ent.vy = -Math.abs(ent.vy) * CFG.BOUNCE_RETAIN; ent.wallHit = true; }

  if (ent.slipTimer > 0) ent.slipTimer -= dt;
}
