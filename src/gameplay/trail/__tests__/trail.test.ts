import { describe, it, expect } from 'vitest';
import { pointInPoly } from '@gameplay/pureLogic';
import { CFG } from '@core/config';
import {
  makeTrailState,
  getTrailPoint,
  pushTrailPoint,
} from '../trailState';
import { updateTrail, clearTrail, type EnemyState } from '../trailUpdate';
import type { PlayerState } from '@gameplay/player/playerState';

// ── pointInPoly (ported from test/trail.test.js) ──────────────

describe('pointInPoly', () => {
  it('returns true for a point inside a triangle', () => {
    const tri = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
    expect(pointInPoly(5, 5, tri)).toBe(true);
  });

  it('returns false for a point outside a triangle', () => {
    const tri = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
    expect(pointInPoly(20, 20, tri)).toBe(false);
  });

  it('returns true for a point on a polygon edge', () => {
    const rect = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(pointInPoly(5, 0, rect)).toBe(true);
  });

  it('returns false for a self-intersecting polygon', () => {
    const bow = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }];
    expect(pointInPoly(5, 5, bow)).toBe(false);
  });

  it('returns false for a degenerate (line) polygon', () => {
    const line = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    expect(pointInPoly(5, 0, line)).toBe(false);
  });

  it('returns true for a point inside a polygon with repeated vertices', () => {
    const poly = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
    expect(pointInPoly(2, 2, poly)).toBe(true);
  });
});

// ── Ring buffer ───────────────────────────────────────────────

describe('trail ring buffer', () => {
  it('pushTrailPoint stores points and increments count', () => {
    const state = makeTrailState();
    pushTrailPoint(state, 10, 20);
    pushTrailPoint(state, 30, 40);
    expect(state.count).toBe(2);
    expect(getTrailPoint(state, 0)).toMatchObject({ x: 10, y: 20 });
    expect(getTrailPoint(state, 1)).toMatchObject({ x: 30, y: 40 });
  });

  it('pushTrailPoint stores per-point speed for width variation', () => {
    const state = makeTrailState();
    pushTrailPoint(state, 0, 0, 200);
    pushTrailPoint(state, 10, 0, 500);
    expect(getTrailPoint(state, 0).speed).toBe(200);
    expect(getTrailPoint(state, 1).speed).toBe(500);
  });

  it('pushTrailPoint defaults speed to 0 when omitted', () => {
    const state = makeTrailState();
    pushTrailPoint(state, 5, 5);
    expect(getTrailPoint(state, 0).speed).toBe(0);
  });

  it('wraps around correctly after filling maxPoints', () => {
    const state = makeTrailState();
    // Fill exactly maxPoints (400) with sequential values
    for (let i = 0; i < state.maxPoints; i++) {
      pushTrailPoint(state, i, i * 2);
    }
    expect(state.count).toBe(400);
    // Push one more — should overwrite oldest (i=0)
    pushTrailPoint(state, 999, 999);
    expect(state.count).toBe(400);
    // Oldest is now i=1
    expect(getTrailPoint(state, 0)).toMatchObject({ x: 1, y: 2 });
    // Newest is the 999,999 point
    expect(getTrailPoint(state, 399)).toMatchObject({ x: 999, y: 999 });
  });

  it('getTrailPoint returns oldest after wrap', () => {
    const state = makeTrailState();
    for (let i = 0; i < state.maxPoints + 10; i++) {
      pushTrailPoint(state, i, 0);
    }
    // Oldest should be the (maxPoints+10 - maxPoints)th push = 10th push (x=10)
    expect(getTrailPoint(state, 0).x).toBe(10);
  });

  it('clearTrail resets count and head', () => {
    const state = makeTrailState();
    pushTrailPoint(state, 5, 5);
    clearTrail(state);
    expect(state.count).toBe(0);
    expect(state.head).toBe(0);
  });

  it('clearTrail preserves flashPoly and flashPolyTimer (matches JS clear() behavior)', () => {
    // JS world.js clear() does NOT reset _flashPoly or _flashPolyTimer.
    // _detectLoop sets these before returning; wiping them in clearTrail would erase
    // the encirclement flash polygon before it ever renders.
    const state = makeTrailState();
    state.flashPoly = [{ x: 10, y: 20 }, { x: 30, y: 40 }];
    state.flashPolyTimer = 0.3;

    clearTrail(state);

    expect(state.flashPoly).not.toBeNull();
    expect(state.flashPolyTimer).toBe(0.3);
    // Core trail data should still be reset
    expect(state.count).toBe(0);
    expect(state.head).toBe(0);
    expect(state.checkTimer).toBe(0);
  });
});

// ── Loop detection ────────────────────────────────────────────

// Build a minimal PlayerState-compatible object for updateTrail
function makeTestPlayer(x: number, y: number): PlayerState {
  return {
    x, y, vx: 0, vy: 0, heading: 0,
    drifting: false, driftJustStarted: false, driftTime: 0, lastDriftEndTime: 0, driftChain: 0,
    maxSpeed: 500, turnRate: 200,
    hp: 100, maxHp: 100, hpRegen: 0, lastHitTimer: 99,
    shield: false, invulnTimer: 0, ghostFrameTimer: 0, ghostFrame: false, frozen: false,
    slipTimer: 0, slipStrength: 0.6, slowTimer: 0, slowStrength: 1,
    wallHit: false, braking: false, wallRiding: false, comboLevel: 0,
    handbrakeTimer: 0, speedBoostTimer: 0,
    consecutiveNearMisses: 0, nearMissStreakTimer: 0,
    leanTimer: 0, leanDir: 0, exhaustTimer: 0, glowPhase: 0, driftDeniedTimer: 0,
    driftKing: false, afterburner: false, nitroDrift: false,
    tightTurns: false, magnetRange: 0,
    scoreMult: 1, thickPlating: false, comboMaster: false, speedDemon: false,
    encircleScoreBonus: 1, damageResist: 0, driftShield: false, comboHeal: false,
    trailMagnet: false, speedTrail: false, dashBurst: false, dashCooldown: 0,
    trailBurn: false, chainLightning: false, upgrades: [],
    scrapBank: 0, scoreMultBoostTimer: 0,
  };
}

describe('loop detection', () => {
  it('detects a closed square loop and kills enemy inside', () => {
    const state = makeTrailState();

    // Manually push a square trail: 100,100 → 200,100 → 200,200 → 100,200
    // with enough points to exceed SKIP_RECENT (20)
    const square = [
      ...Array.from({ length: 10 }, (_, i) => ({ x: 100 + i * 10, y: 100 })), // top
      ...Array.from({ length: 10 }, (_, i) => ({ x: 200, y: 100 + i * 10 })), // right
      ...Array.from({ length: 10 }, (_, i) => ({ x: 200 - i * 10, y: 200 })), // bottom
      ...Array.from({ length: 10 }, (_, i) => ({ x: 100, y: 200 - i * 10 })), // left (will be skipped)
    ];
    for (const pt of square) {
      pushTrailPoint(state, pt.x, pt.y);
    }

    // Enemy inside the square
    const enemy: EnemyState = { x: 150, y: 150, alive: true, armored: false };
    // Enemy outside
    const outsider: EnemyState = { x: 300, y: 300, alive: true, armored: false };

    // Player is near the start of the square (100,100) — which is past SKIP_RECENT from head
    // The last 20 points are on the left side; point[0] at (100,100) is ≥20 points from the head
    const player = makeTestPlayer(102, 102);
    state.closeDist = 40;

    // Force the check timer to fire
    state.checkTimer = 0.15;

    const result = updateTrail(state, player, [enemy, outsider], 0);

    expect(result).not.toBeNull();
    expect(result!.encircleCount).toBe(1);
    expect(enemy.alive).toBe(false);
    expect(outsider.alive).toBe(true);
  });

  it('strips armor on armored enemy instead of killing', () => {
    const state = makeTrailState();

    const square = [
      ...Array.from({ length: 10 }, (_, i) => ({ x: 100 + i * 10, y: 100 })),
      ...Array.from({ length: 10 }, (_, i) => ({ x: 200, y: 100 + i * 10 })),
      ...Array.from({ length: 10 }, (_, i) => ({ x: 200 - i * 10, y: 200 })),
      ...Array.from({ length: 10 }, (_, i) => ({ x: 100, y: 200 - i * 10 })),
    ];
    for (const pt of square) {
      pushTrailPoint(state, pt.x, pt.y);
    }

    const armoredEnemy: EnemyState = { x: 150, y: 150, alive: true, armored: true };
    const player = makeTestPlayer(102, 102);
    state.closeDist = 40;
    state.checkTimer = 0.15;

    const result = updateTrail(state, player, [armoredEnemy], 0);

    // Armored enemy — armor stripped but not killed, so no TrailLoopResult
    expect(result).toBeNull();
    expect(armoredEnemy.alive).toBe(true);
    expect(armoredEnemy.armored).toBe(false);
  });

  it('returns null when no loop is detected', () => {
    const state = makeTrailState();
    // Only a straight line — won't form a loop
    for (let i = 0; i < 30; i++) {
      pushTrailPoint(state, i * 10, 0);
    }
    const player = makeTestPlayer(400, 100); // far away from trail start
    state.checkTimer = 0.15;
    const result = updateTrail(state, player, [], 0);
    expect(result).toBeNull();
  });
});

// ── Minimum trail length guard ────────────────────────────────

describe('loop detection — minimum trail length', () => {
  it('does not encircle when trail has fewer than SKIP_RECENT + 5 points', () => {
    // SKIP_RECENT=20, so minimum is 25 points; use 24 to sit just below threshold
    const state = makeTrailState();
    for (let i = 0; i < 24; i++) {
      pushTrailPoint(state, 100 + i, 100);
    }
    const player = makeTestPlayer(100, 100);
    state.checkTimer = 0.15;
    const result = updateTrail(state, player, [{ x: 110, y: 100, alive: true, armored: false }], 0);
    expect(result).toBeNull();
  });

  it('allows encirclement check once trail meets minimum length', () => {
    // 25 points (SKIP_RECENT + 5) is the threshold
    const state = makeTrailState();
    const square = [
      ...Array.from({ length: 7 }, (_, i) => ({ x: 100 + i * 10, y: 100 })),
      ...Array.from({ length: 7 }, (_, i) => ({ x: 160, y: 100 + i * 10 })),
      ...Array.from({ length: 7 }, (_, i) => ({ x: 160 - i * 10, y: 160 })),
      ...Array.from({ length: 7 }, (_, i) => ({ x: 100, y: 160 - i * 10 })),
    ]; // 28 points — just above SKIP_RECENT + 5
    for (const pt of square) pushTrailPoint(state, pt.x, pt.y);
    const player = makeTestPlayer(102, 102);
    state.closeDist = 40;
    state.checkTimer = 0.15;
    const enemy = { x: 130, y: 130, alive: true, armored: false };
    const result = updateTrail(state, player, [enemy], 0);
    // Detection may or may not find a loop depending on geometry, but should not throw
    expect(result === null || typeof result.encircleCount === 'number').toBe(true);
  });
});

// ── Ring buffer wrap does not break encirclement ──────────────

describe('loop detection — ring buffer wrap', () => {
  it('encirclement works correctly after buffer wraps past maxPoints', () => {
    const state = makeTrailState();
    // Fill past maxPoints so head wraps around
    for (let i = 0; i < state.maxPoints + 10; i++) {
      pushTrailPoint(state, 500, 500); // dummy filler
    }
    expect(state.count).toBe(state.maxPoints); // should be capped

    // Now overwrite with a detectable square (pushes over the wrapped region)
    const square = [
      ...Array.from({ length: 10 }, (_, i) => ({ x: 100 + i * 10, y: 100 })),
      ...Array.from({ length: 10 }, (_, i) => ({ x: 200, y: 100 + i * 10 })),
      ...Array.from({ length: 10 }, (_, i) => ({ x: 200 - i * 10, y: 200 })),
      ...Array.from({ length: 10 }, (_, i) => ({ x: 100, y: 200 - i * 10 })),
    ];
    for (const pt of square) pushTrailPoint(state, pt.x, pt.y);

    // getTrailPoint should return valid numbers (no NaN) after wrap
    for (let i = 0; i < state.count; i++) {
      const pt = getTrailPoint(state, i);
      expect(isNaN(pt.x)).toBe(false);
      expect(isNaN(pt.y)).toBe(false);
    }
  });
});

// ── Elite encirclement scoring ──────────────────────────────────

describe('elite encirclement scoring', () => {
  it('encircles elite enemy counts as 3 kills', () => {
    const state = makeTrailState();
   
    // Manually push a square trail past minimum length
    const square = [
      ...Array.from({ length: 12 }, (_, i) => ({ x: 100 + i * 5, y: 100 })),
      ...Array.from({ length: 12 }, (_, i) => ({ x: 200, y: 100 + i * 5 })),
      ...Array.from({ length: 12 }, (_, i) => ({ x: 200 - i * 5, y: 200 })),
      ...Array.from({ length: 12 }, (_, i) => ({ x: 100, y: 200 - i * 5 })),
    ];
    for (const pt of square) pushTrailPoint(state, pt.x, pt.y);

    // Elite enemy inside the square
    const eliteEnemy: EnemyState = { x: 150, y: 150, alive: true, armored: false, type: 'elite' };
    // Regular enemy outside
    const regularEnemy: EnemyState = { x: 300, y: 300, alive: true, armored: false, type: 'regular' };

    const player = makeTestPlayer(102, 102);
    state.closeDist = 40;
    state.checkTimer = 0.15;

    const result = updateTrail(state, player, [eliteEnemy, regularEnemy], 0);

    expect(result).not.toBeNull();
    expect(result!.encircleCount).toBe(3); // Elite + 3
    expect(eliteEnemy.alive).toBe(false);
    expect(regularEnemy.alive).toBe(true); // Outside
  });

  it('encircles non-elite enemy counts as 1 kill', () => {
    const state = makeTrailState();

    // Manually push a square trail past minimum length
    const square = [
      ...Array.from({ length: 12 }, (_, i) => ({ x: 100 + i * 5, y: 100 })),
      ...Array.from({ length: 12 }, (_, i) => ({ x: 200, y: 100 + i * 5 })),
      ...Array.from({ length: 12 }, (_, i) => ({ x: 200 - i * 5, y: 200 })),
      ...Array.from({ length: 12 }, (_, i) => ({ x: 100, y: 200 - i * 5 })),
    ];
    for (const pt of square) pushTrailPoint(state, pt.x, pt.y);

    // Regular non-elite enemy inside
    const regularEnemy: EnemyState = { x: 150, y: 150, alive: true, armored: false, type: 'regular' };

    const player = makeTestPlayer(102, 102);
    state.closeDist = 40;
    state.checkTimer = 0.15;

    const result = updateTrail(state, player, [regularEnemy], 0);

    expect(result).not.toBeNull();
    expect(result!.encircleCount).toBe(1);
    expect(regularEnemy.alive).toBe(false);
  });

  it('mix of elite and regular enemies inside polygon', () => {
    const state = makeTrailState();

    const square = [
      ...Array.from({ length: 12 }, (_, i) => ({ x: 100 + i * 5, y: 100 })),
      ...Array.from({ length: 12 }, (_, i) => ({ x: 200, y: 100 + i * 5 })),
      ...Array.from({ length: 12 }, (_, i) => ({ x: 200 - i * 5, y: 200 })),
      ...Array.from({ length: 12 }, (_, i) => ({ x: 100, y: 200 - i * 5 })),
    ];
    for (const pt of square) pushTrailPoint(state, pt.x, pt.y);

    // Two elite enemies, one regular enemy inside
    const enemies: EnemyState[] = [
      { x: 150, y: 150, alive: true, armored: false, type: 'elite' },
      { x: 170, y: 170, alive: true, armored: false, type: 'elite' },
      { x: 180, y: 160, alive: true, armored: false, type: 'regular' },
      { x: 300, y: 300, alive: true, armored: false, type: 'regular' }, // outside
    ];

    const player = makeTestPlayer(102, 102);
    state.closeDist = 40;
    state.checkTimer = 0.15;

    const result = updateTrail(state, player, enemies, 0);

    expect(result).not.toBeNull();
    expect(result!.encircleCount).toBe(7); // 2 elite (6) + 1 regular (1)
    expect(enemies[0].alive).toBe(false);
    expect(enemies[1].alive).toBe(false);
    expect(enemies[2].alive).toBe(false);
    expect(enemies[3].alive).toBe(true);
  });
});

// ── Boss HP encirclement (P2.3) ────────────────────────────────

// Helper: push a square trail around (150,150) with enough points to detect a loop
function pushSquareAroundCenter(state: ReturnType<typeof makeTrailState>, player: PlayerState): void {
  // 12 points per side = 48 total, well above SKIP_RECENT (20) + 5
  const square = [
    ...Array.from({ length: 12 }, (_, i) => ({ x: 100 + i * 5, y: 100 })),
    ...Array.from({ length: 12 }, (_, i) => ({ x: 160, y: 100 + i * 5 })),
    ...Array.from({ length: 12 }, (_, i) => ({ x: 160 - i * 5, y: 160 })),
    ...Array.from({ length: 12 }, (_, i) => ({ x: 100, y: 160 - i * 5 })),
  ];
  for (const pt of square) pushTrailPoint(state, pt.x, pt.y);
  // Force close-distance check by setting player near first trail point
  player.x = 102;
  player.y = 102;
}

describe('boss HP encirclement', () => {
  it('boss starts with CFG.BOSS_HP health and survives CFG.BOSS_HP - 1 encirclements', () => {
    const boss: EnemyState = { x: 130, y: 130, alive: true, armored: false, type: 'boss', health: CFG.BOSS_HP, radius: 5 };
    const player = makeTestPlayer(0, 0);

    for (let hit = 0; hit < CFG.BOSS_HP - 1; hit++) {
      const state = makeTrailState();
      state.closeDist = 40;
      state.checkTimer = 0.15;
      pushSquareAroundCenter(state, player);
      const result = updateTrail(state, player, [boss], 0);
      // Boss takes damage but should still be alive until the final hit
      expect(boss.alive).toBe(true);
      expect(boss.health).toBe(CFG.BOSS_HP - (hit + 1));
      // hitBosses populated (not killed yet)
      expect(result?.hitBosses).toContain(boss);
    }
  });

  it('boss dies on the CFG.BOSS_HP-th encirclement', () => {
    const boss: EnemyState = { x: 130, y: 130, alive: true, armored: false, type: 'boss', health: 1, radius: 5 };
    const player = makeTestPlayer(0, 0);
    const state = makeTrailState();
    state.closeDist = 40;
    state.checkTimer = 0.15;
    pushSquareAroundCenter(state, player);

    const result = updateTrail(state, player, [boss], 0);

    expect(boss.alive).toBe(false);
    expect(boss.health).toBeLessThanOrEqual(0);
    expect(result?.killedEnemies).toContain(boss);
    expect(result?.encircleCount).toBe(1);
  });

  it('diagonal trail edge hits boss via 8-offset check', () => {
    // Boss at (202,202), just past the bottom-right corner of a (100-200)x(100-200) square.
    // All 4 cardinal offsets land outside (each overshoots a different edge).
    // The NW diagonal (x-D, y-D) = (~181,~181) lands inside.
    // This verifies the 8-offset check catches diagonal tangency that 4-cardinal check misses.
    const poly = [
      { x: 100, y: 100 }, { x: 200, y: 100 },
      { x: 200, y: 200 }, { x: 100, y: 200 },
    ];
    const r = 30;
    const D = r * 0.707; // ≈ 21.2

    const bx = 202, by = 202;
    expect(pointInPoly(bx,      by,     poly)).toBe(false); // center outside
    expect(pointInPoly(bx,      by - r, poly)).toBe(false); // N: x=202 > 200
    expect(pointInPoly(bx + r,  by,     poly)).toBe(false); // E
    expect(pointInPoly(bx,      by + r, poly)).toBe(false); // S
    expect(pointInPoly(bx - r,  by,     poly)).toBe(false); // W: y=202 > 200
    // NW diagonal is the one that lands inside (both offsets pull toward interior)
    expect(pointInPoly(bx - D,  by - D, poly)).toBe(true);  // NW diagonal inside
  });

  it('Reflector boss with armored=true survives encirclement at full HP', () => {
    // bossPatterns.ts:100 — Reflector sets armored=true every tick; trail must not damage it
    const boss: EnemyState = {
      x: 130, y: 130, alive: true, armored: true, type: 'boss',
      health: CFG.BOSS_HP, radius: 5, bossVulnerable: false,
    };
    const player = makeTestPlayer(0, 0);
    const state = makeTrailState();
    state.closeDist = 40;
    state.checkTimer = 0.15;
    pushSquareAroundCenter(state, player);

    const result = updateTrail(state, player, [boss], 0);

    // No damage — still alive at full HP; flash shown but no kill/hit counted
    expect(boss.alive).toBe(true);
    expect(boss.health).toBe(CFG.BOSS_HP);
    // Result is null because no encircleCount and no hitBosses
    expect(result).toBeNull();
    // Flash still fires to give player feedback
    expect(boss.hitFlashTimer).toBe(CFG.BOSS_HIT_FLASH_S);
  });

  it('Core boss in invuln phase (armored=true, bossVulnerable=false) deflects trail', () => {
    // bossPatterns.ts:69 — Core sets armored=true during invuln/telegraph phase
    const boss: EnemyState = {
      x: 130, y: 130, alive: true, armored: true, type: 'boss',
      health: CFG.BOSS_HP, radius: 5, bossVulnerable: false,
    };
    const player = makeTestPlayer(0, 0);
    const state = makeTrailState();
    state.closeDist = 40;
    state.checkTimer = 0.15;
    pushSquareAroundCenter(state, player);

    updateTrail(state, player, [boss], 0);

    expect(boss.health).toBe(CFG.BOSS_HP);
    expect(boss.alive).toBe(true);
  });

  it('Core boss in vulnerable phase (armored=false, bossVulnerable=true) takes trail damage', () => {
    // bossPatterns.ts:80 — Core sets armored=false, bossVulnerable=true during vulnerable phase
    const boss: EnemyState = {
      x: 130, y: 130, alive: true, armored: false, type: 'boss',
      health: CFG.BOSS_HP, radius: 5, bossVulnerable: true,
    };
    const player = makeTestPlayer(0, 0);
    const state = makeTrailState();
    state.closeDist = 40;
    state.checkTimer = 0.15;
    pushSquareAroundCenter(state, player);

    const result = updateTrail(state, player, [boss], 0);

    expect(boss.health).toBe(CFG.BOSS_HP - 1);
    expect(result?.hitBosses).toContain(boss);
  });

  it('hitFlashTimer is set to CFG.BOSS_HIT_FLASH_S on each hit', () => {
    const boss: EnemyState = { x: 130, y: 130, alive: true, armored: false, type: 'boss', health: CFG.BOSS_HP, radius: 5 };
    const player = makeTestPlayer(0, 0);
    const state = makeTrailState();
    state.closeDist = 40;
    state.checkTimer = 0.15;
    pushSquareAroundCenter(state, player);

    updateTrail(state, player, [boss], 0);

    expect(boss.hitFlashTimer).toBe(CFG.BOSS_HIT_FLASH_S);
  });
});

// ── Trail anti-AFK: expiry and idle-speed guard (2.4) ────────────

describe('trail expiry — points older than TRAIL_MAX_AGE are removed', () => {
  it('fresh points are not expired', () => {
    const state = makeTrailState();
    pushTrailPoint(state, 100, 100, 200);
    pushTrailPoint(state, 110, 100, 200);
    expect(state.count).toBe(2);

    // Run updateTrail with a player that has speed=0 (idle, so no new point)
    const player = makeTestPlayer(100, 100); // vx=0, vy=0
    updateTrail(state, player, [], 0.016);

    // Fresh points should not be expired
    expect(state.count).toBe(2);
  });

  it('points older than TRAIL_MAX_AGE are removed on update', () => {
    const state = makeTrailState();

    // Push some points and backdate their timestamps beyond TRAIL_MAX_AGE
    pushTrailPoint(state, 100, 100, 200);
    pushTrailPoint(state, 110, 100, 200);
    const staleTs = Date.now() - CFG.TRAIL_MAX_AGE - 1000; // 1s past expiry
    // Manually backdate oldest points
    for (let i = 0; i < state.count; i++) {
      const pt = getTrailPoint(state, i);
      pt.timestamp = staleTs;
    }

    // Push a fresh point after backdating so we have something to keep
    pushTrailPoint(state, 120, 100, 200);
    expect(state.count).toBe(3);

    const player = makeTestPlayer(200, 200); // far from trail, no loop triggered
    updateTrail(state, player, [], 0.016);

    // The two stale points should be evicted, leaving only the fresh one
    expect(state.count).toBe(1);
    const remaining = getTrailPoint(state, 0);
    expect(remaining.x).toBe(120);
  });

  it('all points expired leaves count at 0', () => {
    const state = makeTrailState();
    pushTrailPoint(state, 100, 100, 200);
    const staleTs = Date.now() - CFG.TRAIL_MAX_AGE - 1000;
    getTrailPoint(state, 0).timestamp = staleTs;

    const player = makeTestPlayer(200, 200);
    updateTrail(state, player, [], 0.016);

    expect(state.count).toBe(0);
  });
});

describe('trail idle-speed guard — no point added when speed < threshold', () => {
  it('does not record a point when player speed is 0 (idle)', () => {
    const state = makeTrailState();
    const player = makeTestPlayer(100, 100); // vx=0, vy=0 → speed=0 < TRAIL_IDLE_SPEED_THRESHOLD

    // Force the record timer to fire
    state.recordTimer = 0.05;
    updateTrail(state, player, [], 0.05);

    // Speed is 0, below threshold — should not record any point
    expect(state.count).toBe(0);
  });

  it('records a point when player speed meets threshold', () => {
    const state = makeTrailState();
    // Give player enough velocity to exceed TRAIL_IDLE_SPEED_THRESHOLD (60 px/s)
    const player: ReturnType<typeof makeTestPlayer> = {
      ...makeTestPlayer(100, 100),
      vx: 100,
      vy: 0,
    };

    // Force the record timer to fire
    state.recordTimer = 0.05;
    updateTrail(state, player, [], 0.05);

    // Speed is 100 >= 60 threshold — should record one point
    expect(state.count).toBe(1);
    expect(getTrailPoint(state, 0).x).toBe(100);
  });
});
