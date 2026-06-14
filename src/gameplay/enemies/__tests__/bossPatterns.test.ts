// bossPatterns.test.ts — Unit tests for the three boss AI update functions.

import { describe, it, expect } from 'vitest';
import { updatePursuer, updateCore, updateReflector } from '../bossPatterns';
import { makeBoss as makeRealBoss } from '../enemyState';
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

// Reflector tests must start the boss away from center to avoid triggering the pause
function makeReflectorBossAway(overrides: Partial<EnemyState> = {}): EnemyState {
  return makeBoss({
    bossPattern: 'reflector',
    bossPhase: 'telegraph',
    armored: true,
    bossVulnerable: false,
    bossPhaseTimer: 0,
    // Place at world-edge (±450 from center, far from BOSS_REFLECTOR_VULN_R = 180)
    x: CFG.WORLD_W / 2 + 450,
    y: CFG.WORLD_H / 2,
    ...overrides,
  });
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
    expect(boss.armored).toBe(true);
    expect(boss.bossVulnerable).toBe(false);
  });

  it('enters recover phase (not telegraph) after charge expires', () => {
    const boss = makeBoss({
      bossPhase: 'charge',
      bossPhaseTimer: 0.05,
      bossChargeTargetX: 400,
      bossChargeTargetY: 400,
    });
    updatePursuer(boss, makePlayer(), 0.1);
    expect(boss.bossPhase).toBe('recover');
    expect(boss.maxSpeed).toBeLessThan(CFG.BOSS_SPEED);   // slowed during stagger
    expect(boss.armored).toBe(false);
    expect(boss.bossVulnerable).toBe(true);               // loop window is open
  });

  it('returns to telegraph from recover after BOSS_RECOVER_DUR', () => {
    const boss = makeBoss({
      bossPhase: 'recover',
      bossPhaseTimer: 0.05,
      bossChargeTargetX: 400,
      bossChargeTargetY: 400,
    });
    updatePursuer(boss, makePlayer(), 0.1);
    expect(boss.bossPhase).toBe('telegraph');
    expect(boss.maxSpeed).toBe(CFG.BOSS_SPEED);
    expect(boss.bossVulnerable).toBe(false);
  });

  it('recover phase: throttle = false (stagger drift)', () => {
    const boss = makeBoss({ bossPhase: 'recover', bossPhaseTimer: 1.0, bossChargeTargetX: 400, bossChargeTargetY: 400 });
    const result = updatePursuer(boss, makePlayer(), 0.1);
    expect(result.throttle).toBe(false);
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

  it('sets bossWarning when within BOSS_INVULN_WARN_T of end', () => {
    const boss = makeBoss({ bossPattern: 'core', bossPhase: 'invuln', bossPhaseTimer: CFG.BOSS_INVULN_WARN_T - 0.1 });
    updateCore(boss, makePlayer(), 0.01);
    expect(boss.bossWarning).toBe(true);
    expect(boss.armored).toBe(true);  // still armored during warning
  });

  it('bossWarning is false when timer is far from end', () => {
    const boss = makeBoss({ bossPattern: 'core', bossPhase: 'invuln', bossPhaseTimer: 3.0 });
    updateCore(boss, makePlayer(), 0.01);
    expect(boss.bossWarning).toBe(false);
  });

  it('becomes vulnerable and sets _bossSpawnMinion after invuln timer expires', () => {
    const boss = makeBoss({ bossPattern: 'core', bossPhase: 'invuln', bossPhaseTimer: 0.05 });
    updateCore(boss, makePlayer(), 0.1);
    expect(boss.bossPhase).toBe('vulnerable');
    expect(boss.bossVulnerable).toBe(true);
    expect(boss.armored).toBe(false);
    expect(boss._bossSpawnMinion).toBe(true);
    expect(boss.bossWarning).toBe(false);
  });

  it('returns to invuln after vulnerable timer expires', () => {
    const boss = makeBoss({ bossPattern: 'core', bossPhase: 'vulnerable', bossPhaseTimer: 0.05 });
    updateCore(boss, makePlayer(), 0.1);
    expect(boss.bossPhase).toBe('invuln');
  });
});

// ── Reflector ──────────────────────────────────────────────────────────────

describe('updateReflector', () => {
  it('is armored and moving when away from center', () => {
    const boss = makeReflectorBossAway();
    updateReflector(boss, makePlayer(), 0.1);
    expect(boss.armored).toBe(true);
    expect(boss.bossVulnerable).toBe(false);
  });

  it('returns a throttle=true result during figure-eight', () => {
    const boss = makeReflectorBossAway();
    const result = updateReflector(boss, makePlayer(), 0.1);
    expect(result.throttle).toBe(true);
  });

  it('target position changes over time (figure-eight moves)', () => {
    const boss = makeReflectorBossAway();
    const r1 = updateReflector(boss, makePlayer(), 0.5);
    const r2 = updateReflector(boss, makePlayer(), 0.5);
    expect(r1.tx !== r2.tx || r1.ty !== r2.ty).toBe(true);
  });

  it('figure-eight parametric formula: tx and ty match sin/cos expression within epsilon', () => {
    // Boss placed at the right extreme (bossPhaseTimer=0 → sin(0)=0, position is at center).
    // Start timer at π/2/0.4 so boss is at extreme right, then advance dt.
    const startTimer = (Math.PI / 2) / 0.4; // sin(π/2)=1 → boss at cx+450
    const dt = 0.5;
    const boss = makeReflectorBossAway({
      x: CFG.WORLD_W / 2 + 450,
      y: CFG.WORLD_H / 2,
      bossPhaseTimer: startTimer,
    });
    const result = updateReflector(boss, makePlayer(), dt);

    const timerAfter = startTimer + dt;
    const t = timerAfter * 0.4;
    const r = 450;
    const expectedTx = CFG.WORLD_W / 2 + r * Math.sin(t);
    const expectedTy = CFG.WORLD_H / 2 + r * Math.sin(t) * Math.cos(t);

    expect(result.tx).toBeCloseTo(expectedTx, 5);
    expect(result.ty).toBeCloseTo(expectedTy, 5);
  });

  it('figure-eight stays bounded within arena (r=450 never reaches world edge)', () => {
    const boss = makeReflectorBossAway({
      // Start at extreme right to avoid center-pause for this sweep
      bossPhaseTimer: (Math.PI / 2) / 0.4,
      x: CFG.WORLD_W / 2 + 450,
      y: CFG.WORLD_H / 2,
    });
    let nonCenterCount = 0;
    for (let step = 0; step < 400; step++) {
      if (boss.bossPhase !== 'vulnerable') {
        const result = updateReflector(boss, makePlayer(), 0.04);
        expect(result.tx).toBeGreaterThanOrEqual(CFG.WORLD_W / 2 - 451);
        expect(result.tx).toBeLessThanOrEqual(CFG.WORLD_W / 2 + 451);
        expect(result.ty).toBeGreaterThanOrEqual(CFG.WORLD_H / 2 - 226);
        expect(result.ty).toBeLessThanOrEqual(CFG.WORLD_H / 2 + 226);
        nonCenterCount++;
      } else {
        // Advance through the vulnerable pause quickly
        updateReflector(boss, makePlayer(), 0.04);
      }
    }
    expect(nonCenterCount).toBeGreaterThan(0);
  });

  it('becomes vulnerable when passing near center', () => {
    // Boss positioned just inside the center-pause trigger radius
    const boss = makeReflectorBossAway({
      x: CFG.WORLD_W / 2 + CFG.BOSS_REFLECTOR_VULN_R - 10,
      y: CFG.WORLD_H / 2,
      bossPhaseTimer: (Math.PI / 4) / 0.4, // arbitrary non-zero start
    });
    updateReflector(boss, makePlayer(), 0.01);
    expect(boss.bossPhase).toBe('vulnerable');
    expect(boss.armored).toBe(false);
    expect(boss.bossVulnerable).toBe(true);
  });

  it('becomes armored again after center-pause ends', () => {
    const boss = makeBoss({
      bossPattern: 'reflector',
      bossPhase: 'vulnerable',
      bossPhaseTimer: 0.05,
      armored: false,
      bossVulnerable: true,
      x: CFG.WORLD_W / 2,
      y: CFG.WORLD_H / 2,
    });
    updateReflector(boss, makePlayer(), 0.1);
    expect(boss.bossPhase).toBe('telegraph');
    expect(boss.armored).toBe(true);
    expect(boss.bossVulnerable).toBe(false);
  });
});

// ── makeBoss factory (enemyState.ts) ──────────────────────────

describe('makeBoss initial state', () => {
  it('core boss spawns with BOSS_INVULN_DUR timer (not TELEGRAPH_DUR)', () => {
    const boss = makeRealBoss('core', 0, 0);
    expect(boss.bossPhase).toBe('invuln');
    expect(boss.bossPhaseTimer).toBe(CFG.BOSS_INVULN_DUR);
  });

  it('pursuer boss spawns with BOSS_TELEGRAPH_DUR timer', () => {
    const boss = makeRealBoss('pursuer', 0, 0);
    expect(boss.bossPhase).toBe('telegraph');
    expect(boss.bossPhaseTimer).toBe(CFG.BOSS_TELEGRAPH_DUR);
  });

  it('reflector boss spawns with BOSS_TELEGRAPH_DUR timer', () => {
    const boss = makeRealBoss('reflector', 0, 0);
    expect(boss.bossPhase).toBe('telegraph');
    expect(boss.bossPhaseTimer).toBe(CFG.BOSS_TELEGRAPH_DUR);
  });
});
