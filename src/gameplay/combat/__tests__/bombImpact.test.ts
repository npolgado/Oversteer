// bombImpact.test.ts — resolveBombImpact: bomb pickup per-enemy decision tree.
// Extracted from GameLoop._applyBombPickup (was previously untested inline branching).

import { describe, it, expect } from 'vitest';
import { CFG } from '@core/config';
import { makeEnemyState, makeBoss } from '@gameplay/enemies/enemyState';
import { resolveBombImpact } from '../bombImpact';

describe('resolveBombImpact — non-boss enemies', () => {
  it('kills a regular enemy outright when alive and visible', () => {
    const e = makeEnemyState('chaser', 0, 0, 0);
    const result = resolveBombImpact(e, true);
    expect(result.outcome).toBe('kill');
    expect(result.newHealth).toBeUndefined();
  });

  it('skips a dead enemy', () => {
    const e = makeEnemyState('chaser', 0, 0, 0);
    e.alive = false;
    const result = resolveBombImpact(e, true);
    expect(result.outcome).toBe('skip');
  });

  it('skips an enemy that is not visible on screen', () => {
    const e = makeEnemyState('chaser', 0, 0, 0);
    const result = resolveBombImpact(e, false);
    expect(result.outcome).toBe('skip');
  });
});

describe('resolveBombImpact — boss armor deflection', () => {
  it('deflects (no damage) when boss is armored', () => {
    const boss = makeBoss('core', 0, 0);
    boss.armored = true;
    const result = resolveBombImpact(boss, true);
    expect(result.outcome).toBe('deflect');
    expect(result.hitFlashTimer).toBe(CFG.BOSS_HIT_FLASH_S);
  });

  it('deflects when bossVulnerable is explicitly false, even if not armored', () => {
    const boss = makeBoss('core', 0, 0);
    boss.armored = false;
    boss.bossVulnerable = false;
    const result = resolveBombImpact(boss, true);
    expect(result.outcome).toBe('deflect');
  });

  it('Reflector (always armored) always deflects — bomb cannot one-shot it', () => {
    const boss = makeBoss('reflector', 0, 0);
    boss.armored = true; // Reflector re-arms every tick (bossPatterns.ts updateReflector)
    const result = resolveBombImpact(boss, true);
    expect(result.outcome).toBe('deflect');
  });
});

describe('resolveBombImpact — boss chip damage vs. kill', () => {
  it('chips a non-armored boss above 1 health, boss survives', () => {
    const boss = makeBoss('pursuer', 0, 0);
    boss.armored = false;
    boss.bossVulnerable = true;
    boss.health = CFG.BOSS_HP; // > 1, must chip not kill
    const result = resolveBombImpact(boss, true);
    expect(result.outcome).toBe('chip');
    expect(result.newHealth).toBe(CFG.BOSS_HP - 1);
    expect(result.hitFlashTimer).toBe(CFG.BOSS_HIT_FLASH_S);
  });

  it('kills a non-armored boss at 1 health', () => {
    const boss = makeBoss('pursuer', 0, 0);
    boss.armored = false;
    boss.bossVulnerable = true;
    boss.health = 1;
    const result = resolveBombImpact(boss, true);
    expect(result.outcome).toBe('kill');
    expect(result.newHealth).toBe(0);
  });

  it('a fully-armored boss can never be one-shot by a single bomb regardless of health', () => {
    const boss = makeBoss('core', 0, 0);
    boss.armored = true;
    boss.health = 1;
    const result = resolveBombImpact(boss, true);
    expect(result.outcome).toBe('deflect');
  });
});
