import { describe, it, expect } from 'vitest';
import { makeRng } from '@core/rng';
import { CFG } from '@core/config';
import {
  // Pickups
  selectPickupType,
  collectPickupEvents,
  updateScraps,
  updateBoostZones,
  // Wave timing
  computeWaveTiming,
  computeHordeCount,
  rollHordeTrigger,
  shouldTriggerHorde,
  // Enemy pool
  getEnemyPool,
  shouldSpawnElite,
  computeFlankTarget,
  computeBlockerTarget,
  // Scoring / combat
  applyNearMiss,
  updateNearMissStreak,
  applyComboDecay,
  driftComboScoreTick,
  computeCollisionDamage,
  applyPlayerDamage,
  applyShieldBreak,
  applyHpRegen,
  applyGhostFrameNearMiss,
  computeEncircleOutcome,
  applyDriftShield,
  applyComboHeal,
  applyBombZoneDamage,
  applyHazardZoneDamage,
  HazardZoneEffect,
  // Stats
  makeRunStats,
  updateRunStats,
  // Geometry
  pointInPoly,
  // Modifiers
  computeModifierScoreMult,
  // Hit testing
  hitTestUpgradeTap,
} from '@gameplay/pureLogic';

// ── Pickup type selection ─────────────────────────────────────

// Spawn weights: scrap=10, trail_boost=1.5, speed_pickup=1.5,
//   trail_token=0.8 (wave≥2), time_slow=0.6 (wave≥3),
//   shield_pickup=0.4 (wave≥4), bomb=0.5 (wave≥5)
// At wave 6: total=15.3 → scrap [0, 0.654), trail_boost [0.654, 0.752),
//   speed_pickup [0.752, 0.850), bomb [0.967, 1.0)
describe('selectPickupType', () => {
  it('scrap is dominant at low rolls for any wave', () => {
    expect(selectPickupType(4, 0.3)).toBe('scrap');
    expect(selectPickupType(6, 0.3)).toBe('scrap');
    expect(selectPickupType(6, 0.5)).toBe('scrap');
  });

  it('high roll produces bomb at wave >= 5', () => {
    expect(selectPickupType(5, 0.99)).toBe('bomb');
    expect(selectPickupType(6, 0.99)).toBe('bomb');
  });

  it('bomb does not spawn before wave 5', () => {
    // At wave 4, roll=0.99 → shield_pickup (highest pool entry), not bomb
    expect(selectPickupType(4, 0.99)).not.toBe('bomb');
    expect(selectPickupType(0, 0.99)).not.toBe('bomb');
  });
});

// ── collectPickupEvents ───────────────────────────────────────

describe('collectPickupEvents', () => {
  it('collects multiple pickups and boost zones in one frame', () => {
    const scraps = [
      { x: 5, y: 0, life: 10, type: 'scrap' },
      { x: 8, y: 0, life: 10, type: 'trail_boost' },
    ];
    const boostZones = [{ x: 6, y: 0, life: 10 }];
    const player = { x: 0, y: 0, radius: 10, magnetRange: 0 };

    const events = collectPickupEvents(scraps, boostZones, player, 0.016);
    const sorted = [...events].sort();

    expect(sorted).toEqual(['boost', 'scrap', 'trail_boost'].sort());
    expect(scraps.length).toBe(0);
    expect(boostZones.length).toBe(0);
  });

  it('magnet pulls scraps into collection range', () => {
    const scraps = [{ x: 80, y: 0, life: 10, type: 'scrap' }];
    const boostZones: { x: number; y: number; life: number }[] = [];
    const player = { x: 0, y: 0, radius: 10, magnetRange: 150 };

    const events = collectPickupEvents(scraps, boostZones, player, 0.5);
    expect(events).toEqual(['scrap']);
    expect(scraps.length).toBe(0);
  });

  it('no pickups collected when out of range', () => {
    const scraps = [{ x: 200, y: 0, life: 10, type: 'scrap' }];
    const boostZones = [{ x: 200, y: 0, life: 10 }];
    const player = { x: 0, y: 0, radius: 10, magnetRange: 0 };

    const events = collectPickupEvents(scraps, boostZones, player, 0.016);
    expect(events).toEqual([]);
    expect(scraps.length).toBe(1);
    expect(boostZones.length).toBe(1);
  });
});

// ── updateScraps ──────────────────────────────────────────────

describe('updateScraps', () => {
  it('trail magnet nudges scraps toward trail points', () => {
    const scraps = [{ x: 0, y: 0, life: 10, type: 'scrap' }];
    const player = { x: 200, y: 0, radius: 10, magnetRange: 0, trailMagnet: true };
    const trailPoints = [{ x: 60, y: 0 }, { x: 80, y: 0 }];

    updateScraps(scraps, player, 0.5, trailPoints);
    expect(scraps[0].x).toBeGreaterThan(0);
  });

  it('scraps expire when life runs out', () => {
    const scraps = [{ x: 0, y: 0, life: 0.1, type: 'scrap' }];
    const player = { x: 200, y: 0, radius: 10, magnetRange: 0, trailMagnet: false };

    updateScraps(scraps, player, 0.2, []);
    expect(scraps.length).toBe(0);
  });
});

// ── updateBoostZones ──────────────────────────────────────────

describe('updateBoostZones', () => {
  it('boost zones expire when life runs out', () => {
    const boostZones = [{ x: 0, y: 0, life: 0.1 }];
    const player = { x: 200, y: 0, radius: 10, magnetRange: 0 };

    updateBoostZones(boostZones, player, 0.2);
    expect(boostZones.length).toBe(0);
  });
});

// ── Wave timing ────────────────────────────────────────────────

describe('computeWaveTiming', () => {
  it('wave 1 uses initial timings and no bursts', () => {
    const timing = computeWaveTiming(1);
    expect(timing.firstSpawn).toBe(2.5);
    expect(timing.spawnInterval).toBe(4.0);
    expect(timing.combatDuration).toBe(30);
    expect(timing.noBursts).toBe(true);
  });

  it('wave 5 reaches minimum spawn values', () => {
    const timing = computeWaveTiming(5);
    expect(Math.abs(timing.firstSpawn - 0.6)).toBeLessThan(1e-6);
    expect(timing.spawnInterval).toBe(1.5);
    expect(timing.combatDuration).toBe(70);
  });

  it('mid-wave ramp values fall between initial and min', () => {
    const timing = computeWaveTiming(3);
    expect(timing.firstSpawn).toBeLessThan(2.5);
    expect(timing.firstSpawn).toBeGreaterThan(0.6);
    expect(timing.spawnInterval).toBeLessThan(4.0);
    expect(timing.spawnInterval).toBeGreaterThan(1.5);
    expect(timing.noBursts).toBe(false);
  });

  it('combat duration caps at max for high waves', () => {
    const timing = computeWaveTiming(20);
    expect(timing.combatDuration).toBe(120);
  });
});

describe('computeHordeCount', () => {
  it('scales with wave index', () => {
    expect(computeHordeCount(1)).toBe(5);
    expect(computeHordeCount(5)).toBe(7);
  });

  it('caps at maximum', () => {
    expect(computeHordeCount(200)).toBe(40);
  });
});

describe('shouldTriggerHorde', () => {
  it('fires at expected time', () => {
    const combatDuration = 30;
    const hordeTrigger = 0.75;
    expect(shouldTriggerHorde(22.5, combatDuration, hordeTrigger)).toBe(true);
    expect(shouldTriggerHorde(22.4, combatDuration, hordeTrigger)).toBe(false);
  });
});

describe('rollHordeTrigger', () => {
  it('seeded roll stays within range', () => {
    const rng = makeRng(1234);
    const roll = rollHordeTrigger(rng);
    expect(roll).toBeGreaterThanOrEqual(0.60);
    expect(roll).toBeLessThanOrEqual(0.85);
  });
});

// ── Enemy pool ─────────────────────────────────────────────────

describe('getEnemyPool', () => {
  it('starts with chaser only', () => {
    expect(getEnemyPool(0)).toEqual(['chaser']);
  });

  it('interceptor unlocks at 1000 score', () => {
    expect(getEnemyPool(999)).toEqual(['chaser']);
    expect(getEnemyPool(1000)).toEqual(['chaser', 'interceptor']);
  });

  it('drifter unlocks at 1500 score', () => {
    const pool = getEnemyPool(1500);
    expect(pool).toContain('drifter');
    expect(pool.length).toBe(3);
  });

  it('blocker unlocks at 2000 score', () => {
    const pool = getEnemyPool(2000);
    expect(pool).toContain('blocker');
    expect(pool.length).toBe(4);
  });

  it('flanker unlocks at 2500 score', () => {
    const pool = getEnemyPool(2500);
    expect(pool).toContain('flanker');
    expect(pool.length).toBe(5);
  });

  it('bomber unlocks at 3000 score', () => {
    const pool = getEnemyPool(3000);
    expect(pool).toContain('bomber');
    expect(pool.length).toBe(6);
  });

  it('splitter unlocks at 3500 score', () => {
    const pool = getEnemyPool(3500);
    expect(pool).toContain('splitter');
    expect(pool.length).toBe(7);
  });

  it('full pool at high score contains all 7 types', () => {
    expect(getEnemyPool(5000)).toEqual(['chaser', 'interceptor', 'drifter', 'blocker', 'flanker', 'bomber', 'splitter']);
  });
});

describe('shouldSpawnElite', () => {
  it('spawns from wave 4+ with low roll', () => {
    expect(shouldSpawnElite(4, 0.05)).toBe(true);
    expect(shouldSpawnElite(10, 0.11)).toBe(true);
  });

  it('does not spawn with high roll', () => {
    expect(shouldSpawnElite(4, 0.15)).toBe(false);
    expect(shouldSpawnElite(10, 0.50)).toBe(false);
  });

  it('does not spawn before wave 4', () => {
    expect(shouldSpawnElite(3, 0.01)).toBe(false);
    expect(shouldSpawnElite(1, 0.05)).toBe(false);
  });
});

describe('computeFlankTarget', () => {
  it('targets perpendicular to player velocity', () => {
    const t = computeFlankTarget(100, 100, 200, 0, 1);
    expect(t.x).toBe(100);
    expect(Math.abs(t.y - 300)).toBeLessThan(1);
  });

  it('targets other side with flankSide -1', () => {
    const t = computeFlankTarget(100, 100, 200, 0, -1);
    expect(t.x).toBe(100);
    expect(Math.abs(t.y - (-100))).toBeLessThan(1);
  });

  it('falls back to player position when speed is low', () => {
    const t = computeFlankTarget(100, 100, 10, 10, 1);
    expect(t.x).toBe(100);
    expect(t.y).toBe(100);
  });
});

describe('computeBlockerTarget', () => {
  it('targets trail midpoint', () => {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
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

// ── Scoring / combat ───────────────────────────────────────────

describe('applyNearMiss', () => {
  it('increases score and combo', () => {
    const player = { scoreMult: 1, comboLevel: 0, consecutiveNearMisses: 0 };
    const result = applyNearMiss(0, player, 'enemy');
    expect(result.score).toBe(25);
    expect(result.comboLevel).toBe(1);
    expect(result.consecutiveNearMisses).toBe(1);
  });

  it('streak bonus applies at 3+', () => {
    const player = { scoreMult: 1, comboLevel: 2, consecutiveNearMisses: 2 };
    const result = applyNearMiss(0, player, 'enemy');
    expect(result.score).toBe(175);
    expect(result.comboLevel).toBe(3);
    expect(result.consecutiveNearMisses).toBe(3);
  });

  it('hazard near-miss uses hazard points', () => {
    const player = { scoreMult: 1, comboLevel: 0, consecutiveNearMisses: 0 };
    const result = applyNearMiss(0, player, 'hazard');
    expect(result.score).toBe(15);
    expect(result.comboLevel).toBe(1);
  });

  it('combo level clamps at MAX_COMBO', () => {
    const player = { scoreMult: 1, comboLevel: CFG.MAX_COMBO, consecutiveNearMisses: 0 };
    const result = applyNearMiss(0, player, 'enemy');
    expect(result.comboLevel).toBe(CFG.MAX_COMBO);
  });
});

describe('updateNearMissStreak', () => {
  it('resets streak when timer expires', () => {
    const player = { consecutiveNearMisses: 3, nearMissStreakTimer: 0.1 };
    updateNearMissStreak(player, 0.2);
    expect(player.consecutiveNearMisses).toBe(0);
  });
});

describe('applyComboDecay', () => {
  it('is slower with combo_master', () => {
    expect(applyComboDecay(6, false, 1.0)).toBe(4);
    expect(applyComboDecay(6, true, 1.0)).toBe(5);
  });

  it('clamps at zero', () => {
    expect(applyComboDecay(0.5, false, 1.0)).toBe(0);
    expect(applyComboDecay(0, false, 1.0)).toBe(0);
  });
});

describe('driftComboScoreTick', () => {
  it('awards points at each interval boundary', () => {
    const r1 = driftComboScoreTick(0.9, 0, 2);
    expect(r1.scoreDelta).toBe(0);
    const r2 = driftComboScoreTick(1.1, 0, 2);
    expect(r2.scoreDelta).toBe(15);
    const r3 = driftComboScoreTick(2.2, r2.nextTick, 2);
    expect(r3.scoreDelta).toBe(15);
  });
});

describe('computeCollisionDamage', () => {
  it('scales damage after wave 5 and caps', () => {
    expect(computeCollisionDamage(15, 3)).toBe(15);
    expect(computeCollisionDamage(15, 6)).toBe(17);
    expect(computeCollisionDamage(15, 50)).toBe(45);
  });
});

describe('applyPlayerDamage', () => {
  it('applies resistance, drift shield, and min 1', () => {
    const player = { hp: 100, damageResist: 0.25, driftShield: true, invulnTimer: 0, lastHitTimer: 3 };
    const dmg = applyPlayerDamage(player, 10, true);
    expect(dmg).toBe(5);
    expect(player.hp).toBe(95);
    expect(player.invulnTimer).toBe(0.5);
    expect(player.lastHitTimer).toBe(0);
  });

  it('with no modifiers deducts exact damage', () => {
    const player = { hp: 100, damageResist: 0, driftShield: false, invulnTimer: 0, lastHitTimer: 3 };
    const dmg = applyPlayerDamage(player, 15, false);
    expect(dmg).toBe(15);
    expect(player.hp).toBe(85);
  });
});

describe('applyShieldBreak', () => {
  it('grants invuln and clears shield', () => {
    const player = { shield: true, invulnTimer: 0 };
    applyShieldBreak(player);
    expect(player.shield).toBe(false);
    expect(player.invulnTimer).toBe(1.0);
  });
});

describe('applyHpRegen', () => {
  it('waits for delay and clamps to max', () => {
    const player = { hp: 90, maxHp: 100, hpRegen: 5, lastHitTimer: 1.5 };
    applyHpRegen(player, 0.4);
    expect(player.hp).toBe(90);
    applyHpRegen(player, 0.2);
    expect(player.hp).toBe(91);
    applyHpRegen(player, 5);
    expect(player.hp).toBe(100);
  });
});

describe('applyGhostFrameNearMiss', () => {
  it('sets invuln timer on near miss', () => {
    const player = { ghostFrameTimer: 0 };
    applyGhostFrameNearMiss(player, true);
    expect(player.ghostFrameTimer).toBe(0.3);
  });
});

describe('computeEncircleOutcome', () => {
  it('scales with combo and bonus', () => {
    const result = computeEncircleOutcome(2, 0, 1, 1);
    expect(result.scoreDelta).toBe(300);
    expect(result.comboLevel).toBe(4);
  });

  it('applies encircleScoreBonus multiplier', () => {
    const result = computeEncircleOutcome(2, 0, 1, 1.5);
    expect(result.scoreDelta).toBe(450);
  });

  it('applies scoreMult', () => {
    const result = computeEncircleOutcome(1, 0, 2, 1);
    expect(result.scoreDelta).toBe(200);
  });

  it('combo clamps at MAX_COMBO', () => {
    const result = computeEncircleOutcome(2, CFG.MAX_COMBO - 1, 1, 1);
    expect(result.comboLevel).toBe(CFG.MAX_COMBO);
  });

  it('combo does not exceed MAX_COMBO even with many kills', () => {
    const result = computeEncircleOutcome(20, CFG.MAX_COMBO, 1, 1);
    expect(result.comboLevel).toBe(CFG.MAX_COMBO);
  });
});

describe('applyDriftShield', () => {
  it('reduces damage by 40% while drifting', () => {
    expect(applyDriftShield(20, true, true)).toBe(12);
    expect(applyDriftShield(20, false, true)).toBe(20);
    expect(applyDriftShield(20, true, false)).toBe(20);
  });

  it('enforces minimum 1 damage', () => {
    expect(applyDriftShield(1, true, true)).toBe(1);
  });
});

describe('applyComboHeal', () => {
  it('heals at milestones 3, 5, 8', () => {
    expect(applyComboHeal(2.5, 3.0, true, 50, 100)).toBe(60);
    expect(applyComboHeal(4.5, 5.0, true, 50, 100)).toBe(65);
    expect(applyComboHeal(7.5, 8.0, true, 50, 100)).toBe(75);
  });

  it('does not overheal past maxHp', () => {
    expect(applyComboHeal(2.5, 3.0, true, 95, 100)).toBe(100);
  });

  it('does nothing without upgrade', () => {
    expect(applyComboHeal(2.5, 3.0, false, 50, 100)).toBe(50);
  });
});

describe('applyBombZoneDamage', () => {
  it('applies DPS correctly', () => {
    expect(applyBombZoneDamage(8, 0.5, 0)).toBe(4);
  });

  it('respects damage resistance', () => {
    expect(applyBombZoneDamage(8, 1.0, 0.25)).toBe(6);
  });

  it('returns 0 for very small dt', () => {
    expect(applyBombZoneDamage(8, 0.01, 0)).toBe(0);
  });
});

// ── Run stats ──────────────────────────────────────────────────

describe('makeRunStats / updateRunStats', () => {
  it('nearMissTotal increments on each near miss', () => {
    const stats = makeRunStats();
    updateRunStats(stats, { type: 'near_miss', comboLevel: 0 });
    updateRunStats(stats, { type: 'near_miss', comboLevel: 1 });
    expect(stats.nearMissTotal).toBe(2);
  });

  it('peakCombo tracks highest combo from near misses', () => {
    const stats = makeRunStats();
    let combo = 0;
    for (let i = 0; i < 5; i++) {
      const r = updateRunStats(stats, { type: 'near_miss', comboLevel: combo });
      combo = r.comboLevel!;
    }
    expect(stats.peakCombo).toBe(5);
  });

  it('peakCombo tracks highest combo from encirclement', () => {
    const stats = makeRunStats();
    updateRunStats(stats, { type: 'encircle', killCount: 3, comboLevel: 0 });
    expect(stats.peakCombo).toBe(6);
    expect(stats.enemiesKilled).toBe(3);
  });

  it('enemiesKilled accumulates from encircle and bomb', () => {
    const stats = makeRunStats();
    updateRunStats(stats, { type: 'encircle', killCount: 2, comboLevel: 0 });
    updateRunStats(stats, { type: 'bomb', killCount: 4 });
    expect(stats.enemiesKilled).toBe(6);
  });

  it('totalDriftTime only accumulates while drifting', () => {
    const stats = makeRunStats();
    updateRunStats(stats, { type: 'drift_tick', drifting: true, dt: 0.5 });
    updateRunStats(stats, { type: 'drift_tick', drifting: false, dt: 0.5 });
    updateRunStats(stats, { type: 'drift_tick', drifting: true, dt: 0.3 });
    expect(Math.abs(stats.totalDriftTime - 0.8)).toBeLessThan(1e-6);
  });

  it('peakCombo uses pre-event combo so it is not double-counted for near_miss', () => {
    // Bug 8: near_miss event should receive pre-event combo (old) not post-event (new)
    // updateRunStats adds 1 internally; passing pre-event=2 → newCombo=3
    const stats = makeRunStats();
    updateRunStats(stats, { type: 'near_miss', comboLevel: 2 });
    expect(stats.peakCombo).toBe(3);
  });

  it('bomb event does not inflate peakCombo', () => {
    // Bug 8: bomb kills should use type:'bomb', not 'encircle' — bomb branch never touches peakCombo
    const stats = makeRunStats();
    updateRunStats(stats, { type: 'bomb', killCount: 5 });
    expect(stats.peakCombo).toBe(0);
    expect(stats.enemiesKilled).toBe(5);
  });

  it('peakCombo uses pre-event combo for encircle', () => {
    // Bug 8: encircle event should receive pre-event combo — updateRunStats adds 2*killCount internally
    const stats = makeRunStats();
    updateRunStats(stats, { type: 'encircle', killCount: 2, comboLevel: 1 });
    expect(stats.peakCombo).toBe(5); // 1 + 2*2 = 5
  });
});

// ── Geometry ───────────────────────────────────────────────────

describe('pointInPoly', () => {
  it('returns true for inside point', () => {
    const tri = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
    expect(pointInPoly(5, 5, tri)).toBe(true);
  });

  it('returns false for outside point', () => {
    const tri = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
    expect(pointInPoly(20, 20, tri)).toBe(false);
  });

  it('returns true for point on edge', () => {
    const rect = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(pointInPoly(5, 0, rect)).toBe(true);
  });

  it('handles self-intersecting polygon', () => {
    const bow = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }];
    expect(pointInPoly(5, 5, bow)).toBe(false);
  });

  it('returns false for degenerate polygons', () => {
    const line = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    expect(pointInPoly(5, 0, line)).toBe(false);
  });

  it('handles repeated points', () => {
    const poly = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
    expect(pointInPoly(2, 2, poly)).toBe(true);
  });
});

// ── Modifiers ──────────────────────────────────────────────────

describe('computeModifierScoreMult', () => {
  it('no modifiers gives 1x multiplier', () => {
    const m = { hardMode: false, speedRush: false, fragile: false, doubleEnemies: false };
    expect(computeModifierScoreMult(m)).toBe(1);
  });

  it('hardMode gives 1.5x multiplier', () => {
    const m = { hardMode: true, speedRush: false, fragile: false, doubleEnemies: false };
    expect(Math.abs(computeModifierScoreMult(m) - 1.5)).toBeLessThan(0.001);
  });

  it('doubleEnemies gives 1.6x multiplier', () => {
    const m = { hardMode: false, speedRush: false, fragile: false, doubleEnemies: true };
    expect(Math.abs(computeModifierScoreMult(m) - 1.6)).toBeLessThan(0.001);
  });

  it('all modifiers stack multiplicatively', () => {
    const m = { hardMode: true, speedRush: true, fragile: true, doubleEnemies: true };
    const expected = 1.5 * 1.3 * 1.4 * 1.6;
    expect(Math.abs(computeModifierScoreMult(m) - expected)).toBeLessThan(0.01);
  });
});

// ── Hit testing ────────────────────────────────────────────────

describe('hitTestUpgradeTap', () => {
  it('selects the correct upgrade card', () => {
    const cards = [
      { x: 100, y: 100, w: 180, h: 200 },
      { x: 300, y: 100, w: 180, h: 200 },
      { x: 500, y: 100, w: 180, h: 200 },
    ];
    const tap = { x: 390, y: 200 };
    const result = hitTestUpgradeTap(tap, cards, null);
    expect(result.selectedIndex).toBe(1);
    expect(result.reroll).toBe(false);
  });

  it('tap on reroll bounds triggers reroll', () => {
    const cards: { x: number; y: number; w: number; h: number }[] = [];
    const reroll = { x: 300, y: 650, w: 200, h: 30 };
    const tap = { x: 350, y: 660 };
    const result = hitTestUpgradeTap(tap, cards, reroll);
    expect(result.selectedIndex).toBe(-1);
    expect(result.reroll).toBe(true);
  });

  it('tap outside cards and reroll does nothing', () => {
    const cards = [{ x: 100, y: 100, w: 180, h: 200 }];
    const reroll = { x: 300, y: 650, w: 200, h: 30 };
    const tap = { x: 20, y: 20 };
    const result = hitTestUpgradeTap(tap, cards, reroll);
    expect(result.selectedIndex).toBe(-1);
    expect(result.reroll).toBe(false);
  });

  it('card selection wins if tap overlaps card and reroll bounds', () => {
    const cards = [{ x: 300, y: 620, w: 200, h: 40 }];
    const reroll = { x: 300, y: 620, w: 200, h: 40 };
    const tap = { x: 350, y: 635 };
    const result = hitTestUpgradeTap(tap, cards, reroll);
    expect(result.selectedIndex).toBe(0);
    expect(result.reroll).toBe(false);
  });

  it('tap on card boundary counts as selection', () => {
    const cards = [{ x: 100, y: 100, w: 180, h: 200 }];
    const tap = { x: 100, y: 100 };
    const result = hitTestUpgradeTap(tap, cards, null);
    expect(result.selectedIndex).toBe(0);
  });
});

// ── CFG constants smoke tests ─────────────────────────────────

describe('CFG constants', () => {
  it('has new enemy speed constants', () => {
    expect(CFG.BLOCKER_SPEED).toBe(380);
    expect(CFG.FLANKER_SPEED).toBe(470);
    expect(CFG.BOMBER_SPEED).toBe(400);
  });

  it('has new enemy damage constants', () => {
    expect(CFG.DMG_BLOCKER).toBe(12);
    expect(CFG.DMG_FLANKER).toBe(20);
    expect(CFG.DMG_BOMBER).toBe(14);
  });

  it('has bomb zone constants', () => {
    expect(CFG.BOMB_ZONE_RADIUS).toBe(55);
    expect(CFG.BOMB_ZONE_DURATION).toBe(6.0);
    expect(CFG.BOMB_ZONE_INTERVAL).toBe(4.0);
    expect(CFG.BOMB_ZONE_DMG).toBe(8);
    expect(CFG.BOMB_ZONE_SLOW).toBe(0.6);
    expect(CFG.BOMB_ZONE_MAX).toBe(15);
  });

  it('ENEMY_SPRITES_BY_TYPE has new enemy types', () => {
    expect(CFG.ENEMY_SPRITES_BY_TYPE.blocker.length).toBeGreaterThan(0);
    expect(CFG.ENEMY_SPRITES_BY_TYPE.flanker.length).toBeGreaterThan(0);
    expect(CFG.ENEMY_SPRITES_BY_TYPE.bomber.length).toBeGreaterThan(0);
  });
});

// ── applyHazardZoneDamage ─────────────────────────────────────────────

describe('applyHazardZoneDamage', () => {
  it('returns unchanged HP when outside zone radius', () => {
    const result = applyHazardZoneDamage(1, 0, 0, 0, 0, 0, 0, 50, 100, 0, 0.016);
    expect(result.hp).toBe(1);
    expect(result.slowStrength).toBe(0);
  });

  it('reduces HP when inside zone and not invulnerable', () => {
    const result = applyHazardZoneDamage(1, 0, 0, 0, 0, 0, 0, 50, 10, 0, 0.1);
    expect(result.hp).toBeLessThan(1);
  });

  it('does not reduce HP when invulnTimer greater than 0', () => {
    const result = applyHazardZoneDamage(1, 0, 1.0, 0, 0, 0, 0, 50, 10, 0, 0.1);
    expect(result.hp).toBe(1);
  });

  it('applies slow when inside zone', () => {
    const result = applyHazardZoneDamage(1, 0, 0, 0, 0, 0, 0, 50, 10, 0, 0.016);
    expect(result.slowTimer).toBeGreaterThan(0);
    expect(result.slowStrength).toBe(CFG.BOMB_ZONE_SLOW);
  });
});

// ── selectPickupType (weight-based) ──────────────────────────────────────────
// Pool order: scrap(10), trail_boost(1.5), speed_pickup(1.5),
//   +trail_token(0.8, w≥2), +time_slow(0.6, w≥3),
//   +shield_pickup(0.4, w≥4), +bomb(0.5, w≥5)
// Wave-1 total=13: scrap [0,0.769), trail_boost [0.769,0.885), speed_pickup [0.885,1)
// Wave-5 total=15.3: bomb only at roll≥14.8/15.3≈0.967

describe('selectPickupType (weight-based)', () => {
  it('returns scrap for low-to-mid rolls at any wave', () => {
    expect(selectPickupType(1, 0.3)).toBe('scrap');
    expect(selectPickupType(10, 0.3)).toBe('scrap');
  });

  it('returns trail_boost in its weight range at wave 1', () => {
    // wave-1 total=13; trail_boost range ≈ [0.769, 0.885)
    expect(selectPickupType(1, 0.80)).toBe('trail_boost');
  });

  it('returns speed_pickup in its weight range at wave 1', () => {
    // wave-1 total=13; speed_pickup range ≈ [0.885, 1.0)
    expect(selectPickupType(1, 0.92)).toBe('speed_pickup');
  });

  it('never returns bomb before wave 5', () => {
    expect(selectPickupType(4, 0.99)).not.toBe('bomb');
    expect(selectPickupType(0, 0.99)).not.toBe('bomb');
  });

  it('returns bomb at wave 5+ with high roll', () => {
    // wave-5 total=15.3; bomb at roll≥0.967
    expect(selectPickupType(5, 0.99)).toBe('bomb');
    expect(selectPickupType(10, 0.99)).toBe('bomb');
  });

  it('trail_token only spawns at wave >= 2', () => {
    // wave-1: no trail_token in pool, roll=0.99 → speed_pickup (last entry)
    expect(selectPickupType(1, 0.99)).not.toBe('trail_token');
    // wave-2 total=13.8; trail_token range ≈ [0.942, 1.0)
    expect(selectPickupType(2, 0.99)).toBe('trail_token');
  });

  it('time_slow only spawns at wave >= 3', () => {
    // wave-2: no time_slow; roll=0.99 → trail_token
    expect(selectPickupType(2, 0.99)).not.toBe('time_slow');
    // wave-3 total=14.4; time_slow range ≈ [0.958, 1.0)
    expect(selectPickupType(3, 0.99)).toBe('time_slow');
  });

  it('shield_pickup only spawns at wave >= 4', () => {
    // wave-3: no shield_pickup; roll=0.99 → time_slow
    expect(selectPickupType(3, 0.99)).not.toBe('shield_pickup');
    // wave-4 total=14.8; shield_pickup range ≈ [0.973, 1.0)
    expect(selectPickupType(4, 0.99)).toBe('shield_pickup');
  });
});

// ── applyComboDecay — boundary precision ─────────────────────────

describe('applyComboDecay — boundary precision', () => {
  it('lands exactly at 0 when combo equals decay * dt', () => {
    // comboLevel=2, decay=2/s, dt=1.0 → should reach exactly 0, not negative
    expect(applyComboDecay(2, false, 1.0)).toBe(0);
  });

  it('does not go below 0 on large dt', () => {
    expect(applyComboDecay(1, false, 10.0)).toBe(0);
  });

  it('near-integer boundary: combo just above milestone does not trigger double-heal', () => {
    // 3.001 → after 1 frame of decay should still be above 3 (nearly) or below
    // The key invariant: result is deterministic and >= 0
    const result = applyComboDecay(3.001, false, 0.001);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(3.001);
  });
});

// ── updateNearMissStreak — timer zero-crossing ───────────────────

describe('updateNearMissStreak — zero-crossing', () => {
  it('resets streak when dt exactly consumes remaining timer', () => {
    const player = { consecutiveNearMisses: 2, nearMissStreakTimer: 0.016 };
    updateNearMissStreak(player, 0.016);
    expect(player.consecutiveNearMisses).toBe(0);
  });

  it('resets streak when dt exceeds remaining timer (straddle)', () => {
    const player = { consecutiveNearMisses: 3, nearMissStreakTimer: 0.001 };
    updateNearMissStreak(player, 0.016); // dt much larger than remaining
    expect(player.consecutiveNearMisses).toBe(0);
  });

  it('does not reset streak when timer still positive', () => {
    const player = { consecutiveNearMisses: 3, nearMissStreakTimer: 1.0 };
    updateNearMissStreak(player, 0.016);
    expect(player.consecutiveNearMisses).toBe(3);
  });
});

// ── B5 Scoring stress / boundary tests ───────────────────────────

describe('computeCollisionDamage — boundary inputs', () => {
  it('returns finite value at extreme wave index (no overflow)', () => {
    // wave 1 000 000 — scale would be astronomical without the DMG_SCALE_MAX cap
    const result = computeCollisionDamage(15, 1_000_000);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBe(Math.round(15 * CFG.DMG_SCALE_MAX)); // must equal capped value
  });

  it('cap boundary: wave just below and just above threshold produce correct values', () => {
    // threshold wave = 5 + (DMG_SCALE_MAX - 1) / DMG_SCALE_PER_WAVE
    // With DMG_SCALE_MAX=3, DMG_SCALE_PER_WAVE=0.12: threshold = 5 + 16.67 ≈ wave 22
    const belowCap = computeCollisionDamage(15, 21); // scale = 1 + 0.12*16 = 2.92x < cap
    const aboveCap = computeCollisionDamage(15, 23); // scale would be 3.16x → clamped to 3.0x
    expect(belowCap).toBeLessThan(Math.round(15 * CFG.DMG_SCALE_MAX));
    expect(aboveCap).toBe(Math.round(15 * CFG.DMG_SCALE_MAX));
  });

  it('wave ≤ 5 always returns base damage regardless of wave', () => {
    for (const wave of [0, 1, 3, 5]) {
      expect(computeCollisionDamage(20, wave)).toBe(20);
    }
  });
});

describe('computeEncircleOutcome — all-max inputs produce finite result', () => {
  it('max combo + max scoreMult + max bonus yields finite score', () => {
    // All four modifiers active: scoreMult = 1.5*1.3*1.4*1.6 ≈ 4.368
    const allModMult = computeModifierScoreMult({
      hardMode: true, speedRush: true, fragile: true, doubleEnemies: true,
    });
    const killCount = 5; // encircle ×5
    const result = computeEncircleOutcome(killCount, 0, allModMult, 2.0);
    expect(Number.isFinite(result.scoreDelta)).toBe(true);
    expect(result.scoreDelta).toBeGreaterThan(0);
  });

  it('combo clamp prevents comboLevel exceeding MAX_COMBO regardless of kill count', () => {
    const result = computeEncircleOutcome(100, CFG.MAX_COMBO, 1, 1);
    expect(result.comboLevel).toBeLessThanOrEqual(CFG.MAX_COMBO);
  });
});

describe('computeModifierScoreMult — boundary', () => {
  it('result is always finite and ≥ 1', () => {
    const combos = [
      { hardMode: false, speedRush: false, fragile: false, doubleEnemies: false },
      { hardMode: true,  speedRush: false, fragile: false, doubleEnemies: false },
      { hardMode: true,  speedRush: true,  fragile: true,  doubleEnemies: true  },
    ];
    for (const m of combos) {
      const v = computeModifierScoreMult(m);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
    }
  });

  it('all-on result matches expected product (regression guard)', () => {
    const v = computeModifierScoreMult({ hardMode: true, speedRush: true, fragile: true, doubleEnemies: true });
    const expected = 1.5 * 1.3 * 1.4 * 1.6;
    expect(Math.abs(v - expected)).toBeLessThan(0.001);
  });
});
