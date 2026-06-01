// bossPatterns.test.ts — Unit tests for the three boss AI update functions.

import { describe, it, expect } from 'vitest';
import { updatePursuer, updateCore, updateReflector } from '../bossPatterns';
import { CFG } from '@core/config';
import type { EnemyState } from '../enemyState';
import type { PlayerState } from '@gameplay/player/playerState';

function makeBoss(overrides: Partial<EnemyState> = {}): EnemyState {
  return {
    id: 0,
    type: 'boss',
    alive: true,
    x: CFG.WORLD_W / 2,
    y: CFG.WORLD_H / 2,
    vx: 0, vy: 0, heading: 0,
    drifting: false, driftJustStarted: false,
    maxSpeed: CFG.BOSS_SPEED, turnRate: 0,
    driftKing: false, afterburner: false, nitroDrift: false,
    lastDriftEndTime: 0, driftChain: 0,
    slipTimer: 0, slipStrength: 0,
    slowTimer: 0, slowStrength: 0,
    wallHit: false,
    health: CFG.BOSS_HP,
    armored: false,
    radius: CFG.BOSS_RADIUS,
    baseMaxSpeed: CFG.BOSS_SPEED,
    age: 0, lifespan: 9999,
    offscreenTimer: 0, fadeAlpha: 1,
    nearMissCooldown: 0, _trailBurnCooldown: 0, glowExtra: 0,
    sprite: 'cars/truck.png',
    holdingTrail: false, striking: false, strikeTimer: 0,
    _dropBomb: false,
    bossPattern: 'pursuer',
    bossPhase: 'telegraph',
    bossPhaseTimer: CFG.BOSS_TELEGRAPH_DUR,
    bossVulnerable: true,
    _bossSpawnMinion: false,
    ...overrides,
  } as EnemyState;
}

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    x: 1000, y: 1000,
    vx: 0, vy: 0,
    ...overrides,
  } as unknown as PlayerState;
}

// ── Pursuer ────────────────────────────────────────────────────────────────

describe('updatePursuer', () => {
  it('stays in telegraph phase before timer expires', () => {
    const boss = makeBoss({ bossPhase: 'telegraph', bossPhaseTimer: 1.0 });
    const result = updatePursuer(boss, makePlayer(), 0.1);
    expect(boss.bossPhase).toBe('telegraph');
    expect(result.throttle).toBe(true);
  });

  it('switches to charge phase when telegraph timer expires', () => {
    const boss = makeBoss({ bossPhase: 'telegraph', bossPhaseTimer: 0.05 });
    updatePursuer(boss, makePlayer({ x: 500, y: 600 }), 0.1);
    expect(boss.bossPhase).toBe('charge');
    expect(boss.bossChargeTargetX).toBe(500);
    expect(boss.bossChargeTargetY).toBe(600);
    expect(boss.maxSpeed).toBe(CFG.BOSS_CHARGE_SPEED);
  });

  it('returns to telegraph after charge expires', () => {
    const boss = makeBoss({
      bossPhase: 'charge',
      bossPhaseTimer: 0.05,
      bossChargeTargetX: 400,
      bossChargeTargetY: 400,
    });
    updatePursuer(boss, makePlayer(), 0.1);
    expect(boss.bossPhase).toBe('telegraph');
    expect(boss.maxSpeed).toBe(CFG.BOSS_SPEED);
  });
});

// ── Core ───────────────────────────────────────────────────────────────────

describe('updateCore', () => {
  it('starts invulnerable and moves toward arena center', () => {
    const boss = makeBoss({ bossPattern: 'core', bossPhase: 'invuln', bossPhaseTimer: 3.0 });
    const result = updateCore(boss, makePlayer(), 0.1);
    expect(boss.armored).toBe(true);
    expect(boss.bossVulnerable).toBe(false);
    expect(result.tx).toBeCloseTo(CFG.WORLD_W / 2);
    expect(result.ty).toBeCloseTo(CFG.WORLD_H / 2);
  });

  it('becomes vulnerable and sets _bossSpawnMinion after invuln timer expires', () => {
    const boss = makeBoss({ bossPattern: 'core', bossPhase: 'invuln', bossPhaseTimer: 0.05 });
    updateCore(boss, makePlayer(), 0.1);
    expect(boss.bossPhase).toBe('vulnerable');
    expect(boss.bossVulnerable).toBe(true);
    expect(boss.armored).toBe(false);
    expect(boss._bossSpawnMinion).toBe(true);
  });

  it('returns to invuln after vulnerable timer expires', () => {
    const boss = makeBoss({ bossPattern: 'core', bossPhase: 'vulnerable', bossPhaseTimer: 0.05 });
    updateCore(boss, makePlayer(), 0.1);
    expect(boss.bossPhase).toBe('invuln');
  });
});

// ── Reflector ──────────────────────────────────────────────────────────────

describe('updateReflector', () => {
  it('always has armored = true', () => {
    const boss = makeBoss({ bossPattern: 'reflector', armored: false, bossPhaseTimer: 0 });
    updateReflector(boss, makePlayer(), 0.1);
    expect(boss.armored).toBe(true);
    expect(boss.bossVulnerable).toBe(false);
  });

  it('returns a throttle=true result', () => {
    const boss = makeBoss({ bossPattern: 'reflector', bossPhaseTimer: 0 });
    const result = updateReflector(boss, makePlayer(), 0.1);
    expect(result.throttle).toBe(true);
  });

  it('target position changes over time (figure-eight moves)', () => {
    const boss = makeBoss({ bossPattern: 'reflector', bossPhaseTimer: 0 });
    const r1 = updateReflector(boss, makePlayer(), 0.5);
    const r2 = updateReflector(boss, makePlayer(), 0.5);
    // After two different time steps, tx/ty should differ
    expect(r1.tx !== r2.tx || r1.ty !== r2.ty).toBe(true);
  });

  it('figure-eight parametric formula: tx and ty match sin/cos expression within epsilon', () => {
    // Start timer at 0, advance by a known dt so we can compute expected values exactly.
    // Formula: t = bossPhaseTimer * 0.4; tx = WORLD_W/2 + 450*sin(t); ty = WORLD_H/2 + 450*sin(t)*cos(t)
    const dt = 2.5; // chosen so t=1.0 → non-trivial sin/cos values
    const boss = makeBoss({ bossPattern: 'reflector', bossPhaseTimer: 0 });
    const result = updateReflector(boss, makePlayer(), dt);

    const timerAfter = dt; // bossPhaseTimer starts at 0, incremented by dt
    const t = timerAfter * 0.4;
    const r = 450;
    const expectedTx = CFG.WORLD_W / 2 + r * Math.sin(t);
    const expectedTy = CFG.WORLD_H / 2 + r * Math.sin(t) * Math.cos(t);

    expect(result.tx).toBeCloseTo(expectedTx, 5);
    expect(result.ty).toBeCloseTo(expectedTy, 5);
  });

  it('figure-eight stays bounded within arena (r=450 never reaches world edge)', () => {
    // Sweep through a full figure-eight cycle (period = 2π / 0.4 ≈ 15.7s)
    const boss = makeBoss({ bossPattern: 'reflector', bossPhaseTimer: 0 });
    for (let step = 0; step < 200; step++) {
      const result = updateReflector(boss, makePlayer(), 0.08);
      expect(result.tx).toBeGreaterThanOrEqual(CFG.WORLD_W / 2 - 451);
      expect(result.tx).toBeLessThanOrEqual(CFG.WORLD_W / 2 + 451);
      expect(result.ty).toBeGreaterThanOrEqual(CFG.WORLD_H / 2 - 226); // sin*cos max = 0.5
      expect(result.ty).toBeLessThanOrEqual(CFG.WORLD_H / 2 + 226);
    }
  });
});
