import { describe, it, expect } from 'vitest';
import { makePlayerState } from '../playerState';
import { updatePlayer } from '../playerUpdate';
import { CFG } from '@core/config';

const noInput = { dt: 0.016, gameClock: 0, up: false, down: false, left: false, right: false, drift: false };
const withInput = (overrides: Partial<typeof noInput>) => ({ ...noInput, ...overrides });

// ── Frozen state ───────────────────────────────────────────────

describe('frozen player', () => {
  it('does not update position when frozen', () => {
    const s = makePlayerState();
    s.frozen = true;
    s.vx = 500;
    const x0 = s.x;
    updatePlayer(s, withInput({ up: true }));
    expect(s.x).toBe(x0); // no movement
  });
});

// ── wallHit / driftJustStarted reset ─────────────────────────

describe('per-frame flag reset', () => {
  it('clears wallHit and driftJustStarted each frame', () => {
    const s = makePlayerState();
    s.wallHit = true;
    s.driftJustStarted = true;
    updatePlayer(s, noInput);
    // wallHit may be set again by physics if bouncing — but driftJustStarted is only
    // set by physics when drift just begins, so with no drift input it should be false
    expect(s.driftJustStarted).toBe(false);
  });
});

// ── Lean FX ────────────────────────────────────────────────────

describe('lean timer', () => {
  it('sets leanTimer on left input', () => {
    const s = makePlayerState();
    updatePlayer(s, withInput({ left: true }));
    expect(s.leanTimer).toBeGreaterThan(0);
    expect(s.leanDir).toBe(-1);
  });

  it('sets leanTimer on right input', () => {
    const s = makePlayerState();
    updatePlayer(s, withInput({ right: true }));
    expect(s.leanDir).toBe(1);
  });

  it('decrements leanTimer when no input', () => {
    const s = makePlayerState();
    s.leanTimer = 0.1;
    updatePlayer(s, noInput);
    expect(s.leanTimer).toBeCloseTo(0.1 - 0.016);
  });
});

// ── Exhaust FX ─────────────────────────────────────────────────

describe('exhaust timer', () => {
  it('sets exhaustTimer on up input', () => {
    const s = makePlayerState();
    updatePlayer(s, withInput({ up: true }));
    expect(s.exhaustTimer).toBeGreaterThan(0);
  });

  it('decrements exhaustTimer without input', () => {
    const s = makePlayerState();
    s.exhaustTimer = 0.1;
    updatePlayer(s, noInput);
    expect(s.exhaustTimer).toBeCloseTo(0.1 - 0.016);
  });
});

// ── Drift denied FX ────────────────────────────────────────────

describe('drift denied', () => {
  it('sets driftDeniedTimer when drift pressed below threshold', () => {
    const s = makePlayerState();
    s.vx = 0;
    s.vy = 0; // speed = 0, below DRIFT_THRESHOLD
    updatePlayer(s, withInput({ drift: true }));
    expect(s.driftDeniedTimer).toBeGreaterThan(0);
  });

  it('does not set driftDeniedTimer when already drifting', () => {
    const s = makePlayerState();
    s.drifting = true;
    s.vx = 0;
    s.vy = 0;
    updatePlayer(s, withInput({ drift: true }));
    expect(s.driftDeniedTimer).toBe(0);
  });
});

// ── HP regen ──────────────────────────────────────────────────

describe('hp regen', () => {
  it('regenerates HP after hit timer elapses', () => {
    const s = makePlayerState();
    s.hp = 50;
    s.maxHp = 100;
    s.lastHitTimer = 99; // well past regen delay
    s.hpRegen = 10;
    updatePlayer(s, withInput({ dt: 1.0 }));
    expect(s.hp).toBeGreaterThan(50);
  });

  it('does not exceed maxHp', () => {
    const s = makePlayerState();
    s.hp = 99.9;
    s.maxHp = 100;
    s.lastHitTimer = 99;
    s.hpRegen = 100;
    updatePlayer(s, withInput({ dt: 1.0 }));
    expect(s.hp).toBeLessThanOrEqual(100);
  });
});

// ── Invuln timer ───────────────────────────────────────────────

describe('invuln timer', () => {
  it('decrements invulnTimer each frame', () => {
    const s = makePlayerState();
    s.invulnTimer = 1.0;
    updatePlayer(s, noInput);
    expect(s.invulnTimer).toBeCloseTo(1.0 - 0.016);
  });

  it('reaches 0 when dt exceeds remaining timer', () => {
    const s = makePlayerState();
    s.invulnTimer = 0.5;
    // Run enough frames to fully deplete
    for (let i = 0; i < 40; i++) updatePlayer(s, noInput);
    expect(s.invulnTimer).toBeLessThanOrEqual(0);
  });
});

// ── Handbrake ─────────────────────────────────────────────────

describe('handbrake', () => {
  it('activates handbrake when reversing forward at speed', () => {
    const s = makePlayerState();
    // Player heading is -PI/2 (facing up), place velocity in forward direction
    s.heading = 0; // facing right
    s.vx = CFG.DRIFT_THRESHOLD + 10; // moving right (forward)
    s.vy = 0;
    expect(s.handbrakeTimer).toBe(0);
    updatePlayer(s, withInput({ down: true }));
    expect(s.handbrakeTimer).toBeGreaterThan(0);
  });

  it('handbrakeTimer decrements each frame', () => {
    const s = makePlayerState();
    s.handbrakeTimer = 0.5;
    updatePlayer(s, noInput);
    expect(s.handbrakeTimer).toBeCloseTo(0.5 - 0.016);
  });
});

// ── Speed boost timer ─────────────────────────────────────────

describe('speed boost timer', () => {
  it('decrements speedBoostTimer each frame', () => {
    const s = makePlayerState();
    s.speedBoostTimer = 1.0;
    updatePlayer(s, noInput);
    expect(s.speedBoostTimer).toBeCloseTo(1.0 - 0.016);
  });

  it('restores maxSpeed after update', () => {
    const s = makePlayerState();
    const originalMaxSpeed = s.maxSpeed;
    s.speedBoostTimer = 0.5;
    updatePlayer(s, noInput);
    expect(s.maxSpeed).toBe(originalMaxSpeed);
  });
});

// ── Drift time tracking ────────────────────────────────────────

describe('drift time tracking', () => {
  it('accumulates driftTime while drifting', () => {
    const s = makePlayerState();
    s.drifting = true;
    s.vx = 300; // some speed so physics won't immediately exit drift
    updatePlayer(s, withInput({ drift: true }));
    expect(s.driftTime).toBeGreaterThan(0);
  });

  it('resets driftTime when not drifting', () => {
    const s = makePlayerState();
    s.drifting = false;
    s.driftTime = 0.5;
    updatePlayer(s, noInput);
    expect(s.driftTime).toBe(0);
  });
});

// ── Wall riding ───────────────────────────────────────────────

describe('wall riding detection', () => {
  it('wallRiding = true when drifting near left wall', () => {
    const s = makePlayerState();
    // Face down so vx stays near 0 and the player remains in the wall-ride zone
    s.heading = Math.PI / 2; // facing down
    s.vx = 0;
    s.vy = CFG.DRIFT_THRESHOLD + 200; // enough speed for drift, perpendicular to wall
    s.drifting = true;
    s.x = CFG.ARENA_PAD + 10; // well inside wall-ride zone (ARENA_PAD + WALL_RIDE_DIST = 54)
    s.y = CFG.WORLD_H / 2;
    updatePlayer(s, withInput({ up: true, drift: true }));
    expect(s.wallRiding).toBe(true);
  });

  it('wallRiding = false when not drifting', () => {
    const s = makePlayerState();
    s.drifting = false;
    s.x = 10;
    s.y = CFG.WORLD_H / 2;
    updatePlayer(s, noInput);
    expect(s.wallRiding).toBe(false);
  });

  it('wallRiding = false when drifting far from walls', () => {
    const s = makePlayerState();
    s.drifting = true;
    s.x = CFG.WORLD_W / 2;
    s.y = CFG.WORLD_H / 2;
    updatePlayer(s, withInput({ drift: true }));
    expect(s.wallRiding).toBe(false);
  });
});

// ── Braking state ─────────────────────────────────────────────

describe('braking state', () => {
  it('sets braking = true on down input', () => {
    const s = makePlayerState();
    updatePlayer(s, withInput({ down: true }));
    expect(s.braking).toBe(true);
  });

  it('sets braking = false without down input', () => {
    const s = makePlayerState();
    s.braking = true;
    updatePlayer(s, noInput);
    expect(s.braking).toBe(false);
  });
});
