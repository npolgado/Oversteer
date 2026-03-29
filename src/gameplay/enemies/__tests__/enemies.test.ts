import { describe, it, expect } from 'vitest';
import {
  getEnemyPool,
  shouldSpawnElite,
  computeFlankTarget,
  computeBlockerTarget,
} from '@gameplay/pureLogic';
import { makeEnemyState, getEnemySpeed } from '../enemyState';
import { updateEnemy } from '../enemyUpdate';
import { CFG } from '@core/config';
import { makePlayerState } from '@gameplay/player/playerState';

// ── Enemy pool ─────────────────────────────────────────────────

describe('enemy pool', () => {
  it('chaser always available', () => {
    expect(getEnemyPool(0)).toContain('chaser');
  });

  it('starts with only chaser at score 0', () => {
    expect(getEnemyPool(0)).toEqual(['chaser']);
  });

  it('interceptor unlocked at 1000', () => {
    expect(getEnemyPool(999)).not.toContain('interceptor');
    expect(getEnemyPool(1000)).toContain('interceptor');
  });

  it('drifter unlocked at 1500', () => {
    expect(getEnemyPool(1500)).toContain('drifter');
    expect(getEnemyPool(1499)).not.toContain('drifter');
  });

  it('blocker unlocked at 2000', () => {
    expect(getEnemyPool(2000)).toContain('blocker');
  });

  it('flanker unlocked at 2500', () => {
    expect(getEnemyPool(2500)).toContain('flanker');
  });

  it('bomber unlocked at 3000', () => {
    expect(getEnemyPool(3000)).toContain('bomber');
  });

  it('full pool at high score', () => {
    expect(getEnemyPool(5000)).toEqual([
      'chaser',
      'interceptor',
      'drifter',
      'blocker',
      'flanker',
      'bomber',
    ]);
  });
});

// ── shouldSpawnElite ───────────────────────────────────────────

describe('shouldSpawnElite', () => {
  it('spawns from wave 4+ with low roll', () => {
    expect(shouldSpawnElite(4, 0.05)).toBe(true);
    expect(shouldSpawnElite(10, 0.11)).toBe(true);
  });

  it('does not spawn with high roll', () => {
    expect(shouldSpawnElite(4, 0.15)).toBe(false);
  });

  it('does not spawn before wave 4', () => {
    expect(shouldSpawnElite(3, 0.01)).toBe(false);
    expect(shouldSpawnElite(1, 0.05)).toBe(false);
  });
});

// ── makeEnemyState ─────────────────────────────────────────────

describe('makeEnemyState', () => {
  it('chaser speed = CFG.CHASER_SPEED + bonus', () => {
    const e = makeEnemyState('chaser', 0, 0, 50);
    expect(e.maxSpeed).toBe(CFG.CHASER_SPEED + 50);
  });

  it('interceptor speed = CFG.INTERCEPTOR_SPEED + bonus', () => {
    const e = makeEnemyState('interceptor', 0, 0, 0);
    expect(e.maxSpeed).toBe(CFG.INTERCEPTOR_SPEED);
  });

  it('interceptor turn rate = ENEMY_TURN_RATE * 0.85', () => {
    const e = makeEnemyState('interceptor', 0, 0, 0);
    expect(e.turnRate).toBeCloseTo(CFG.ENEMY_TURN_RATE * 0.85);
  });

  it('chaser turn rate = ENEMY_TURN_RATE * 1.0', () => {
    const e = makeEnemyState('chaser', 0, 0, 0);
    expect(e.turnRate).toBeCloseTo(CFG.ENEMY_TURN_RATE);
  });

  it('structurally satisfies EnemyState (x, y, alive, armored)', () => {
    const e = makeEnemyState('chaser', 100, 200, 0);
    expect(e.x).toBe(100);
    expect(e.y).toBe(200);
    expect(e.alive).toBe(true);
    expect(e.armored).toBe(false);
  });

  it('has valid lifespan within expected range', () => {
    const e = makeEnemyState('chaser', 0, 0, 0);
    expect(e.lifespan).toBeGreaterThanOrEqual(CFG.ENEMY_LIFESPAN_MIN);
    expect(e.lifespan).toBeLessThanOrEqual(CFG.ENEMY_LIFESPAN_MAX);
  });

  it('has a sprite string from the sprite pool', () => {
    const e = makeEnemyState('chaser', 0, 0, 0);
    expect(typeof e.sprite).toBe('string');
    expect(e.sprite.length).toBeGreaterThan(0);
    expect(CFG.ENEMY_SPRITES_BY_TYPE['chaser']).toContain(e.sprite);
  });

  it('baseMaxSpeed equals maxSpeed on creation', () => {
    const e = makeEnemyState('chaser', 0, 0, 30);
    expect(e.baseMaxSpeed).toBe(e.maxSpeed);
  });
});

// ── getEnemySpeed ──────────────────────────────────────────────

describe('getEnemySpeed', () => {
  it('returns 0 for stationary enemy', () => {
    const e = makeEnemyState('chaser', 0, 0, 0);
    expect(getEnemySpeed(e)).toBe(0);
  });

  it('returns correct speed for moving enemy', () => {
    const e = makeEnemyState('chaser', 0, 0, 0);
    e.vx = 300;
    e.vy = 400;
    expect(getEnemySpeed(e)).toBe(500);
  });
});

// ── updateEnemy ────────────────────────────────────────────────

describe('updateEnemy', () => {
  it('despawned = false normally', () => {
    const e = makeEnemyState('chaser', 1550, 1500, 0);
    const player = makePlayerState();
    const result = updateEnemy(e, player, 0.016, 0);
    expect(result.despawned).toBe(false);
  });

  it('despawned = true when age > lifespan', () => {
    const e = makeEnemyState('chaser', 1500, 1500, 0);
    e.lifespan = 0.01;
    const player = makePlayerState();
    const result = updateEnemy(e, player, 0.1, 0);
    expect(result.despawned).toBe(true);
  });

  it('despawned = true when far from player', () => {
    const e = makeEnemyState('chaser', 0, 0, 0);
    const player = makePlayerState();
    e.x = player.x + CFG.ENEMY_FAR_DESPAWN_DIST + 100;
    e.y = player.y;
    const result = updateEnemy(e, player, 0.016, 0);
    expect(result.despawned).toBe(true);
  });

  it('enemy moves toward player over time (chaser)', () => {
    const player = makePlayerState();
    const e = makeEnemyState('chaser', player.x + 600, player.y, 0);
    const initialDist = Math.hypot(e.x - player.x, e.y - player.y);

    for (let i = 0; i < 180; i++) {
      updateEnemy(e, player, 0.016, i * 0.016);
    }

    const finalDist = Math.hypot(e.x - player.x, e.y - player.y);
    expect(finalDist).toBeLessThan(initialDist);
  });

  it('fadeAlpha decreases in last 2s of lifespan', () => {
    const e = makeEnemyState('chaser', 1500, 1500, 0);
    e.lifespan = 1.0;
    e.age = 0.5;
    const player = makePlayerState();
    updateEnemy(e, player, 0.016, 0);
    expect(e.fadeAlpha).toBeLessThan(1);
  });

  it('nearMissCooldown decrements over time', () => {
    const e = makeEnemyState('chaser', 1500, 1500, 0);
    e.nearMissCooldown = 1.0;
    const player = makePlayerState();
    updateEnemy(e, player, 0.1, 0);
    expect(e.nearMissCooldown).toBeCloseTo(0.9);
  });
});

// ── computeFlankTarget ─────────────────────────────────────────

describe('computeFlankTarget', () => {
  it('targets perpendicular to player velocity', () => {
    const t = computeFlankTarget(100, 100, 200, 0, 1);
    expect(t.x).toBe(100);
    expect(Math.abs(t.y - 300)).toBeLessThan(1);
  });

  it('targets other side with flankSide -1', () => {
    const t = computeFlankTarget(100, 100, 200, 0, -1);
    expect(t.x).toBe(100);
    expect(Math.abs(t.y - -100)).toBeLessThan(1);
  });

  it('falls back to player position when speed is low', () => {
    const t = computeFlankTarget(100, 100, 10, 10, 1);
    expect(t.x).toBe(100);
    expect(t.y).toBe(100);
  });
});

// ── computeBlockerTarget ───────────────────────────────────────

describe('computeBlockerTarget', () => {
  it('targets trail midpoint', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    const mid = computeBlockerTarget(points);
    expect(mid).not.toBeNull();
    expect(Math.abs(mid!.x - 200 / 3)).toBeLessThan(1);
    expect(Math.abs(mid!.y - 100 / 3)).toBeLessThan(1);
  });

  it('returns null for empty trail', () => {
    expect(computeBlockerTarget([])).toBeNull();
    expect(computeBlockerTarget(null)).toBeNull();
  });
});
