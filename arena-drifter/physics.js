// physics.js — Shared physics engine (updatePhysics)
(function() {
  'use strict';
  const { CFG, U } = window.OversteerLogic;

  function updatePhysics(ent, dt, turnInput, throttle, braking, wantDrift, isPlayer) {
    const speed = Math.hypot(ent.vx, ent.vy);

    // Drift activation
    if (wantDrift && speed >= CFG.DRIFT_THRESHOLD) {
      if (!ent.drifting) {
        ent.drifting = true;
        ent.driftJustStarted = true;
        // Boost impulse (Drift King: +50%, Afterburner: x2, drift chain stacks)
        let driftBoost = CFG.DRIFT_BOOST;
        if (ent.driftKing) driftBoost *= 1.5;
        if (ent.afterburner) driftBoost *= 2;
        // Drift chaining: re-entering drift within window
        if (isPlayer && ent.lastDriftEndTime > 0) {
          const elapsed = performance.now() / 1000 - ent.lastDriftEndTime;
          if (elapsed < CFG.DRIFT_CHAIN_WINDOW) {
            ent.driftChain = Math.min(2, (ent.driftChain || 0) + 1);
            const chainMult = ent.driftChain === 1 ? CFG.DRIFT_CHAIN_MULT_1 : CFG.DRIFT_CHAIN_MULT_2;
            driftBoost *= chainMult;
          } else {
            ent.driftChain = 0;
          }
          ent.lastDriftEndTime = 0;
        }
        const dir = U.vec2FromAngle(ent.heading);
        ent.vx += dir.x * driftBoost;
        ent.vy += dir.y * driftBoost;
      }
    } else {
      ent.drifting = false;
    }

    // Turn rate (reduced at high speed)
    const speedFrac = U.clamp(speed / (ent.maxSpeed || CFG.MAX_SPEED), 0, 1);
    const turnMult = 1 - speedFrac * CFG.TURN_REDUCE_AT_MAX;
    const turnRate = (ent.turnRate || CFG.TURN_RATE) * turnMult;
    ent.heading += turnInput * turnRate * dt;
    ent.heading = U.normalizeAngle(ent.heading);

    // Acceleration
    const fwd = U.vec2FromAngle(ent.heading);
    if (throttle) {
      ent.vx += fwd.x * CFG.ACCEL * dt;
      ent.vy += fwd.y * CFG.ACCEL * dt;
    }
    if (braking) {
      // If moving forward, brake; if slow, reverse
      const dot = ent.vx * fwd.x + ent.vy * fwd.y;
      if (dot > 30) {
        // Brake
        ent.vx -= fwd.x * CFG.ACCEL * 1.5 * dt;
        ent.vy -= fwd.y * CFG.ACCEL * 1.5 * dt;
      } else {
        // Reverse
        ent.vx -= fwd.x * CFG.REVERSE_ACCEL * dt;
        ent.vy -= fwd.y * CFG.REVERSE_ACCEL * dt;
      }
    }

    // Decompose velocity into forward and lateral
    const dot = ent.vx * fwd.x + ent.vy * fwd.y;
    const latX = ent.vx - fwd.x * dot;
    const latY = ent.vy - fwd.y * dot;

    // Apply friction
    let latFric = ent.drifting ? CFG.DRIFT_LATERAL : CFG.LATERAL_FRICTION;
    if (ent.drifting && ent.driftKing) latFric *= 0.75; // Drift King: reduced drift lateral friction
    const fwdDrag = ent.drifting ? CFG.DRIFT_DRAG : CFG.FORWARD_DRAG;

    // Oil slip override — reduce lateral friction when on puddle
    const effectiveLatFric = ent.slipTimer > 0 ? latFric * (ent.slipStrength || 0.6) : latFric;

    const latDecay = Math.exp(-effectiveLatFric * dt);
    const fwdDecay = Math.exp(-fwdDrag * dt);

    ent.vx = fwd.x * dot * fwdDecay + latX * latDecay;
    ent.vy = fwd.y * dot * fwdDecay + latY * latDecay;

    // Clamp speed
    const newSpeed = Math.hypot(ent.vx, ent.vy);
    let maxSpd = braking && !throttle ? CFG.REVERSE_MAX : (ent.maxSpeed || CFG.MAX_SPEED);
    if (ent.slowTimer > 0) maxSpd *= ent.slowStrength;
    if (newSpeed > maxSpd) {
      const s = maxSpd / newSpeed;
      ent.vx *= s; ent.vy *= s;
    }

    // Move
    ent.x += ent.vx * dt;
    ent.y += ent.vy * dt;

    // Arena bounds (world-sized)
    const pad = CFG.ARENA_PAD;
    if (ent.x < pad) { ent.x = pad; ent.vx = Math.abs(ent.vx) * CFG.BOUNCE_RETAIN; ent.wallHit = true; }
    if (ent.x > CFG.WORLD_W - pad) { ent.x = CFG.WORLD_W - pad; ent.vx = -Math.abs(ent.vx) * CFG.BOUNCE_RETAIN; ent.wallHit = true; }
    if (ent.y < pad) { ent.y = pad; ent.vy = Math.abs(ent.vy) * CFG.BOUNCE_RETAIN; ent.wallHit = true; }
    if (ent.y > CFG.WORLD_H - pad) { ent.y = CFG.WORLD_H - pad; ent.vy = -Math.abs(ent.vy) * CFG.BOUNCE_RETAIN; ent.wallHit = true; }

    // Slip timer
    if (ent.slipTimer > 0) ent.slipTimer -= dt;
  }

  window.updatePhysics = updatePhysics;
})();
