// bossArena.test.ts — Tests for boss-wave structural pillar system.

import { describe, it, expect, beforeEach } from 'vitest';
import { spawnBossArena, clearBossArena, BOSS_ARENA_TEXTURE } from '../bossArena';
import { makePropsState, getPropsNear } from '../propsSystem';
import type { PropsState } from '../propsSystem';
import { CFG } from '@core/config';

function countBossPillars(state: PropsState): number {
  return state.allProps.filter(p => p.textureKey === BOSS_ARENA_TEXTURE).length;
}

describe('spawnBossArena', () => {
  let state: PropsState;
  beforeEach(() => { state = makePropsState(); });

  it('adds solid boss pillars for pursuer pattern', () => {
    spawnBossArena(state, 'pursuer');
    const pillars = state.allProps.filter(p => p.textureKey === BOSS_ARENA_TEXTURE);
    expect(pillars.length).toBeGreaterThan(0);
    for (const p of pillars) expect(p.type).toBe('solid');
  });

  it('adds pillars for core and reflector patterns', () => {
    const s2 = makePropsState(); spawnBossArena(s2, 'core');
    expect(countBossPillars(s2)).toBeGreaterThan(0);
    const s3 = makePropsState(); spawnBossArena(s3, 'reflector');
    expect(countBossPillars(s3)).toBeGreaterThan(0);
  });

  it('registers each pillar in chunk buckets (large-radius gotcha)', () => {
    spawnBossArena(state, 'pursuer');
    const pillars = state.allProps.filter(p => p.textureKey === BOSS_ARENA_TEXTURE);
    // Every pillar must appear in at least one chunk bucket
    for (const pillar of pillars) {
      let found = false;
      for (const bucket of state.chunks.values()) {
        if (bucket.includes(pillar)) { found = true; break; }
      }
      expect(found).toBe(true);
    }
  });

  it('getPropsNear finds boss pillars from center', () => {
    spawnBossArena(state, 'pursuer');
    const cx = CFG.WORLD_W / 2;
    const cy = CFG.WORLD_H / 2;
    // Query from center — should find the ring pillars at ringR=280
    const nearby = getPropsNear(state, cx, cy, 400);
    const bossPillars = nearby.filter(p => p.textureKey === BOSS_ARENA_TEXTURE);
    expect(bossPillars.length).toBeGreaterThan(0);
  });

  it('pillars are clamped within arena bounds', () => {
    for (const pattern of ['pursuer', 'core', 'reflector'] as const) {
      const s = makePropsState();
      spawnBossArena(s, pattern);
      for (const p of s.allProps.filter(q => q.textureKey === BOSS_ARENA_TEXTURE)) {
        expect(p.x).toBeGreaterThanOrEqual(60);
        expect(p.x).toBeLessThanOrEqual(CFG.WORLD_W - 60);
        expect(p.y).toBeGreaterThanOrEqual(60);
        expect(p.y).toBeLessThanOrEqual(CFG.WORLD_H - 60);
      }
    }
  });
});

describe('clearBossArena', () => {
  it('removes all boss pillars from allProps', () => {
    const state = makePropsState();
    spawnBossArena(state, 'pursuer');
    expect(countBossPillars(state)).toBeGreaterThan(0);
    clearBossArena(state);
    expect(countBossPillars(state)).toBe(0);
  });

  it('removes boss pillars from chunk buckets', () => {
    const state = makePropsState();
    spawnBossArena(state, 'core');
    clearBossArena(state);
    for (const bucket of state.chunks.values()) {
      const remaining = bucket.filter(p => p.textureKey === BOSS_ARENA_TEXTURE);
      expect(remaining.length).toBe(0);
    }
  });

  it('preserves non-boss props after clear', () => {
    const state = makePropsState();
    const normalProp = {
      x: 100, y: 100, radius: 40, type: 'solid' as const,
      textureKey: 'props/rock_1.png', nearMissCooldown: 0,
    };
    state.allProps.push(normalProp);
    spawnBossArena(state, 'pursuer');
    clearBossArena(state);
    expect(state.allProps).toContain(normalProp);
  });

  it('is safe to call when no boss arena was spawned', () => {
    const state = makePropsState();
    expect(() => clearBossArena(state)).not.toThrow();
    expect(countBossPillars(state)).toBe(0);
  });
});
