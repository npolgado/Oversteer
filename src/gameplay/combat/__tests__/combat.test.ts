import { describe, it, expect, beforeEach } from 'vitest';
import { CFG } from '@core/config';
import { makePlayerState, getPlayerRadius } from '@gameplay/player/playerState';
import { makeEnemyState } from '@gameplay/enemies/enemyState';
import {
  checkPlayerEnemyCollision,
  checkNearMiss,
  applyKnockback,
} from '../collision';
import { processPlayerHit } from '../damage';
import { processNearMiss } from '../nearMiss';

// ── getPlayerRadius ─────────────────────────────────────────────

describe('getPlayerRadius', () => {
  it('returns base radius when not drifting, no upgrades', () => {
    const p = makePlayerState();
    expect(getPlayerRadius(p)).toBe(CFG.PLAYER_RADIUS);
  });

  it('reduces radius while drifting', () => {
    const p = makePlayerState();
    p.drifting = true;
    expect(getPlayerRadius(p)).toBe(CFG.PLAYER_RADIUS - CFG.PLAYER_DRIFT_SHRINK);
  });

  it('reduces radius with thickPlating', () => {
    const p = makePlayerState();
    p.thickPlating = true;
    expect(getPlayerRadius(p)).toBe(CFG.PLAYER_RADIUS - 3);
  });

  it('stacks drift shrink and thickPlating', () => {
    const p = makePlayerState();
    p.drifting = true;
    p.thickPlating = true;
    expect(getPlayerRadius(p)).toBe(CFG.PLAYER_RADIUS - CFG.PLAYER_DRIFT_SHRINK - 3);
  });
});

// ── checkPlayerEnemyCollision ───────────────────────────────────

describe('checkPlayerEnemyCollision', () => {
  it('returns true when circles overlap', () => {
    const p = makePlayerState();
    const e = makeEnemyState('chaser', p.x + 1, p.y, 0); // 1px away, well within radii
    expect(checkPlayerEnemyCollision(p, e)).toBe(true);
  });

  it('returns false when circles are far apart', () => {
    const p = makePlayerState();
    const e = makeEnemyState('chaser', p.x + 500, p.y, 0);
    expect(checkPlayerEnemyCollision(p, e)).toBe(false);
  });

  it('returns false when enemy is dead', () => {
    const p = makePlayerState();
    const e = makeEnemyState('chaser', p.x + 1, p.y, 0);
    e.alive = false;
    expect(checkPlayerEnemyCollision(p, e)).toBe(false);
  });

  it('returns false when player has invulnTimer > 0', () => {
    const p = makePlayerState();
    p.invulnTimer = 0.5;
    const e = makeEnemyState('chaser', p.x + 1, p.y, 0);
    expect(checkPlayerEnemyCollision(p, e)).toBe(false);
  });

  it('returns false when player has ghostFrameTimer > 0', () => {
    const p = makePlayerState();
    p.ghostFrameTimer = 0.1;
    const e = makeEnemyState('chaser', p.x + 1, p.y, 0);
    expect(checkPlayerEnemyCollision(p, e)).toBe(false);
  });
});

// ── checkNearMiss ───────────────────────────────────────────────

describe('checkNearMiss', () => {
  it('triggers when drifting and in near-miss range (not colliding)', () => {
    const p = makePlayerState();
    p.drifting = true;
    // Place enemy just outside collision but inside near-miss threshold
    const gap = getPlayerRadius(p) + CFG.ENEMY_RADIUS + CFG.NEAR_MISS_ENEMY / 2;
    const e = makeEnemyState('chaser', p.x + gap, p.y, 0);
    e.nearMissCooldown = 0;
    expect(checkNearMiss(p, e)).toBe(true);
  });

  it('returns false when not drifting', () => {
    const p = makePlayerState();
    p.drifting = false;
    const gap = getPlayerRadius(p) + CFG.ENEMY_RADIUS + CFG.NEAR_MISS_ENEMY / 2;
    const e = makeEnemyState('chaser', p.x + gap, p.y, 0);
    e.nearMissCooldown = 0;
    expect(checkNearMiss(p, e)).toBe(false);
  });

  it('returns false when enemy cooldown is active', () => {
    const p = makePlayerState();
    p.drifting = true;
    const gap = getPlayerRadius(p) + CFG.ENEMY_RADIUS + CFG.NEAR_MISS_ENEMY / 2;
    const e = makeEnemyState('chaser', p.x + gap, p.y, 0);
    e.nearMissCooldown = 0.5;
    expect(checkNearMiss(p, e)).toBe(false);
  });

  it('returns false when enemy is dead', () => {
    const p = makePlayerState();
    p.drifting = true;
    const gap = getPlayerRadius(p) + CFG.ENEMY_RADIUS + CFG.NEAR_MISS_ENEMY / 2;
    const e = makeEnemyState('chaser', p.x + gap, p.y, 0);
    e.alive = false;
    e.nearMissCooldown = 0;
    expect(checkNearMiss(p, e)).toBe(false);
  });

  it('returns false when overlapping (collision, not near-miss)', () => {
    const p = makePlayerState();
    p.drifting = true;
    const e = makeEnemyState('chaser', p.x + 1, p.y, 0); // inside collision radius
    e.nearMissCooldown = 0;
    expect(checkNearMiss(p, e)).toBe(false);
  });
});

// ── applyKnockback ──────────────────────────────────────────────

describe('applyKnockback', () => {
  it('adds velocity away from source', () => {
    const p = makePlayerState();
    p.x = 100; p.y = 100;
    p.vx = 0; p.vy = 0;
    const source = { x: 90, y: 100 }; // source is to the left
    applyKnockback(p, source, 100);
    expect(p.vx).toBeGreaterThan(0); // player pushed right
    expect(p.vy).toBeCloseTo(0, 3);
  });

  it('handles source directly on player (no divide-by-zero)', () => {
    const p = makePlayerState();
    p.vx = 0; p.vy = 0;
    const source = { x: p.x, y: p.y };
    expect(() => applyKnockback(p, source, 100)).not.toThrow();
  });
});

// ── processPlayerHit ────────────────────────────────────────────

describe('processPlayerHit', () => {
  let player: ReturnType<typeof makePlayerState>;
  let enemy: ReturnType<typeof makeEnemyState>;

  beforeEach(() => {
    player = makePlayerState();
    enemy = makeEnemyState('chaser', player.x + 50, player.y, 0);
  });

  it('returns hit type and reduces HP', () => {
    const before = player.hp;
    const result = processPlayerHit(player, enemy, 0);
    expect(result.type).toBe('hit');
    expect(result.finalDamage).toBeGreaterThan(0);
    expect(player.hp).toBe(before - result.finalDamage);
  });

  it('shield absorbs first hit without HP loss', () => {
    player.shield = true;
    const before = player.hp;
    const result = processPlayerHit(player, enemy, 0);
    expect(result.type).toBe('shield_break');
    expect(result.finalDamage).toBe(0);
    expect(player.hp).toBe(before);
    expect(player.shield).toBe(false);
    expect(player.invulnTimer).toBe(CFG.SHIELD_INVULN);
  });

  it('second hit after shield break does damage', () => {
    player.shield = true;
    processPlayerHit(player, enemy, 0); // breaks shield
    player.invulnTimer = 0; // clear invuln so second hit lands
    const before = player.hp;
    const result = processPlayerHit(player, enemy, 0);
    expect(result.type).toBe('hit');
    expect(player.hp).toBeLessThan(before);
  });

  it('damage scales with wave index above 5', () => {
    const r0 = processPlayerHit(makePlayerState(), enemy, 0);
    const p2 = makePlayerState();
    const r10 = processPlayerHit(p2, enemy, 10);
    expect(r10.finalDamage).toBeGreaterThan(r0.finalDamage);
  });

  it('returns blocked when invulnTimer > 0', () => {
    player.invulnTimer = 0.5;
    const result = processPlayerHit(player, enemy, 0);
    expect(result.type).toBe('blocked');
    expect(result.finalDamage).toBe(0);
  });

  it('sets invulnTimer after hit', () => {
    processPlayerHit(player, enemy, 0);
    expect(player.invulnTimer).toBe(CFG.HIT_INVULN);
  });

  it('applies knockback on normal hit', () => {
    player.vx = 0; player.vy = 0;
    processPlayerHit(player, enemy, 0);
    expect(Math.hypot(player.vx, player.vy)).toBeGreaterThan(0);
  });
});

// ── processNearMiss ─────────────────────────────────────────────

describe('processNearMiss', () => {
  it('returns updated score', () => {
    const p = makePlayerState();
    const e = makeEnemyState('chaser', p.x + 50, p.y, 0);
    const result = processNearMiss(p, e, 0);
    expect(result.score).toBeGreaterThan(0);
  });

  it('increments combo level', () => {
    const p = makePlayerState();
    p.comboLevel = 2;
    const e = makeEnemyState('chaser', p.x + 50, p.y, 0);
    processNearMiss(p, e, 0);
    expect(p.comboLevel).toBe(3);
  });

  it('sets enemy nearMissCooldown', () => {
    const p = makePlayerState();
    const e = makeEnemyState('chaser', p.x + 50, p.y, 0);
    e.nearMissCooldown = 0;
    processNearMiss(p, e, 0);
    expect(e.nearMissCooldown).toBe(CFG.NEAR_MISS_COOLDOWN);
  });

  it('applies streak invuln at 3+ consecutive', () => {
    const p = makePlayerState();
    p.consecutiveNearMisses = 2; // will become 3 after this miss
    const e = makeEnemyState('chaser', p.x + 50, p.y, 0);
    processNearMiss(p, e, 0);
    expect(p.invulnTimer).toBeGreaterThan(0);
  });

  it('no invuln bonus at 2 consecutive', () => {
    const p = makePlayerState();
    p.consecutiveNearMisses = 1; // will become 2
    const e = makeEnemyState('chaser', p.x + 50, p.y, 0);
    processNearMiss(p, e, 0);
    expect(p.invulnTimer).toBe(0);
  });
});
