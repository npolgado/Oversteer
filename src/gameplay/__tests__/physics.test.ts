import { describe, it, expect } from 'vitest';
import { updatePhysics } from '@gameplay/physics';
import type { PhysicsEntity } from '@gameplay/physics';
import { CFG } from '@core/config';

function makeEntity(overrides: Partial<PhysicsEntity> = {}): PhysicsEntity {
  return {
    x: CFG.WORLD_W / 2,
    y: CFG.WORLD_H / 2,
    vx: 0,
    vy: 0,
    heading: 0, // facing right
    drifting: false,
    driftJustStarted: false,
    maxSpeed: CFG.MAX_SPEED,
    turnRate: CFG.TURN_RATE,
    driftKing: false,
    afterburner: false,
    nitroDrift: false,
    lastDriftEndTime: 0,
    driftChain: 0,
    slipTimer: 0,
    slipStrength: 0.6,
    slowTimer: 0,
    slowStrength: 1.0,
    wallHit: false,
    ...overrides,
  };
}

describe('updatePhysics — acceleration', () => {
  it('accelerating from rest increases speed', () => {
    const ent = makeEntity();
    updatePhysics(ent, 0.1, 0, true, false, false, false, 0);
    const speed = Math.hypot(ent.vx, ent.vy);
    expect(speed).toBeGreaterThan(0);
  });

  it('speed increases proportionally to dt', () => {
    const ent1 = makeEntity();
    const ent2 = makeEntity();
    updatePhysics(ent1, 0.05, 0, true, false, false, false, 0);
    updatePhysics(ent2, 0.1, 0, true, false, false, false, 0);
    const speed1 = Math.hypot(ent1.vx, ent1.vy);
    const speed2 = Math.hypot(ent2.vx, ent2.vy);
    expect(speed2).toBeGreaterThan(speed1);
  });
});

describe('updatePhysics — braking', () => {
  it('braking reduces speed', () => {
    // Give entity some forward velocity
    const ent = makeEntity({ vx: 300, vy: 0 });
    const speedBefore = Math.hypot(ent.vx, ent.vy);
    updatePhysics(ent, 0.1, 0, false, true, false, false, 0);
    const speedAfter = Math.hypot(ent.vx, ent.vy);
    expect(speedAfter).toBeLessThan(speedBefore);
  });
});

describe('updatePhysics — drift', () => {
  it('drift activates when speed >= threshold and wantDrift is true', () => {
    const ent = makeEntity({ vx: CFG.DRIFT_THRESHOLD + 10, vy: 0 });
    expect(ent.drifting).toBe(false);
    updatePhysics(ent, 0.016, 0, false, false, true, true, 0);
    expect(ent.drifting).toBe(true);
  });

  it('drift does not activate below threshold speed', () => {
    const ent = makeEntity({ vx: CFG.DRIFT_THRESHOLD - 10, vy: 0 });
    updatePhysics(ent, 0.016, 0, false, false, true, true, 0);
    expect(ent.drifting).toBe(false);
  });

  it('drifting flag clears when wantDrift is false', () => {
    const ent = makeEntity({ vx: 300, vy: 0, drifting: true });
    updatePhysics(ent, 0.016, 0, false, false, false, true, 0);
    expect(ent.drifting).toBe(false);
  });
});

describe('updatePhysics — arena boundary clamp', () => {
  it('entity is clamped to left boundary', () => {
    const ent = makeEntity({ x: 0, y: CFG.WORLD_H / 2, vx: -100 });
    updatePhysics(ent, 0.1, 0, false, false, false, false, 0);
    expect(ent.x).toBeGreaterThanOrEqual(CFG.ARENA_PAD);
    expect(ent.wallHit).toBe(true);
  });

  it('entity is clamped to right boundary', () => {
    const ent = makeEntity({ x: CFG.WORLD_W, y: CFG.WORLD_H / 2, vx: 100 });
    updatePhysics(ent, 0.1, 0, false, false, false, false, 0);
    expect(ent.x).toBeLessThanOrEqual(CFG.WORLD_W - CFG.ARENA_PAD);
    expect(ent.wallHit).toBe(true);
  });

  it('entity is clamped to top boundary', () => {
    const ent = makeEntity({ x: CFG.WORLD_W / 2, y: 0, vy: -100 });
    updatePhysics(ent, 0.1, 0, false, false, false, false, 0);
    expect(ent.y).toBeGreaterThanOrEqual(CFG.ARENA_PAD);
    expect(ent.wallHit).toBe(true);
  });

  it('entity is clamped to bottom boundary', () => {
    const ent = makeEntity({ x: CFG.WORLD_W / 2, y: CFG.WORLD_H, vy: 100 });
    updatePhysics(ent, 0.1, 0, false, false, false, false, 0);
    expect(ent.y).toBeLessThanOrEqual(CFG.WORLD_H - CFG.ARENA_PAD);
    expect(ent.wallHit).toBe(true);
  });

  it('velocity bounces off wall with BOUNCE_RETAIN factor', () => {
    const ent = makeEntity({ x: 0, y: CFG.WORLD_H / 2, vx: -200 });
    // Use tiny dt so forward drag is negligible and we isolate the bounce factor
    updatePhysics(ent, 0.001, 0, false, false, false, false, 0);
    expect(ent.vx).toBeGreaterThan(0);
    expect(ent.vx).toBeCloseTo(200 * CFG.BOUNCE_RETAIN, 0);
  });
});

describe('updatePhysics — drift chaining', () => {
  it('second drift within chain window increments driftChain', () => {
    const ent = makeEntity({
      vx: CFG.DRIFT_THRESHOLD + 50,
      vy: 0,
      lastDriftEndTime: 9.9, // set recently
    });
    // gameClock=10.0 → elapsed=0.1, within DRIFT_CHAIN_WINDOW (0.5s)
    updatePhysics(ent, 0.016, 0, false, false, true, true, 10.0);
    expect(ent.driftChain).toBe(1);
  });

  it('drift chain resets when elapsed exceeds window', () => {
    const ent = makeEntity({
      vx: CFG.DRIFT_THRESHOLD + 50,
      vy: 0,
      lastDriftEndTime: 9.0, // 1.0s ago
    });
    // gameClock=10.0 → elapsed=1.0 > DRIFT_CHAIN_WINDOW (0.5s)
    updatePhysics(ent, 0.016, 0, false, false, true, true, 10.0);
    expect(ent.driftChain).toBe(0);
  });
});
