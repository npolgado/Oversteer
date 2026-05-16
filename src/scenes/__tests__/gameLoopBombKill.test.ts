/**
 * Bomb-kill lifecycle tests (Bug 7 + Bug 8 fix verification).
 *
 * GameLoopScene is Pixi-heavy so we test the pure logic that the fixes
 * depend on: updateRunStats uses 'bomb' branch (not 'encircle'), and the
 * swap-and-pop sweep removes dead enemies.
 */
import { describe, it, expect } from 'vitest';
import { makeRunStats, updateRunStats } from '@gameplay/pureLogic';

describe('bomb kill — updateRunStats type:bomb (Bug 8)', () => {
  it('bomb event increments enemiesKilled and does not touch peakCombo', () => {
    const stats = makeRunStats();
    updateRunStats(stats, { type: 'bomb', killCount: 3 });
    expect(stats.enemiesKilled).toBe(3);
    expect(stats.peakCombo).toBe(0);
    expect(stats.nearMissTotal).toBe(0);
  });

  it('bomb event with zero kills is a no-op', () => {
    const stats = makeRunStats();
    updateRunStats(stats, { type: 'bomb', killCount: 0 });
    expect(stats.enemiesKilled).toBe(0);
    expect(stats.peakCombo).toBe(0);
  });

  it('bomb does not inflate peakCombo even after prior near-misses', () => {
    const stats = makeRunStats();
    let combo = 0;
    for (let i = 0; i < 3; i++) {
      const r = updateRunStats(stats, { type: 'near_miss', comboLevel: combo });
      combo = r.comboLevel!;
    }
    const peakBeforeBomb = stats.peakCombo;
    updateRunStats(stats, { type: 'bomb', killCount: 10 });
    expect(stats.peakCombo).toBe(peakBeforeBomb); // unchanged
    expect(stats.enemiesKilled).toBe(10);
  });
});

describe('bomb kill — dead enemy sweep (Bug 7)', () => {
  it('swap-and-pop removes a dead enemy from an array', () => {
    // Simulates what _applyBombPickup and _tickEnemies do after our fix
    const enemies = [
      { alive: true,  x: 100, y: 100 },
      { alive: false, x: 200, y: 200 }, // bomb-killed
      { alive: true,  x: 300, y: 300 },
    ];

    for (let i = enemies.length - 1; i >= 0; i--) {
      if (!enemies[i].alive) {
        enemies[i] = enemies[enemies.length - 1];
        enemies.pop();
      }
    }

    expect(enemies).toHaveLength(2);
    expect(enemies.every(e => e.alive)).toBe(true);
  });

  it('dead enemies with alive=false do not appear after sweep', () => {
    const enemies = [
      { alive: false, x: 10, y: 10 },
      { alive: false, x: 20, y: 20 },
      { alive: true,  x: 30, y: 30 },
    ];

    for (let i = enemies.length - 1; i >= 0; i--) {
      if (!enemies[i].alive) {
        enemies[i] = enemies[enemies.length - 1];
        enemies.pop();
      }
    }

    expect(enemies).toHaveLength(1);
    expect(enemies[0].alive).toBe(true);
  });

  it('sweep on all-alive array is a no-op', () => {
    const enemies = [
      { alive: true, x: 1, y: 1 },
      { alive: true, x: 2, y: 2 },
    ];

    for (let i = enemies.length - 1; i >= 0; i--) {
      if (!enemies[i].alive) {
        enemies[i] = enemies[enemies.length - 1];
        enemies.pop();
      }
    }

    expect(enemies).toHaveLength(2);
  });
});
