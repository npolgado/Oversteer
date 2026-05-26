// biomeFramework.test.ts — Tests for BiomeManager, runProgression, and biome descriptors.

import { describe, it, expect, vi } from 'vitest';
import { BiomeManager } from '../biomeManager';
import { biomeForWave, isBiomeTransition } from '../runProgression';
import { BIOMES, BIOMES_BY_ID } from '@core/config';

vi.mock('@core/eventBus', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

// ── biomeForWave ──────────────────────────────────────────────────────────────

describe('biomeForWave', () => {
  it('waves 1–7 → wasteland', () => {
    for (let i = 1; i <= 7; i++) expect(biomeForWave(i)).toBe('wasteland');
  });

  it('waves 8–14 → rupture', () => {
    for (let i = 8; i <= 14; i++) expect(biomeForWave(i)).toBe('rupture');
  });

  it('wave 15+ → jungle', () => {
    expect(biomeForWave(15)).toBe('jungle');
    expect(biomeForWave(30)).toBe('jungle');
    expect(biomeForWave(100)).toBe('jungle');
  });
});

// ── isBiomeTransition ─────────────────────────────────────────────────────────

describe('isBiomeTransition', () => {
  it('fires at wave 8 and 15', () => {
    expect(isBiomeTransition(8)).toBe(true);
    expect(isBiomeTransition(15)).toBe(true);
  });

  it('does not fire at other waves', () => {
    [1, 5, 7, 9, 10, 14, 16, 20].forEach(w => {
      expect(isBiomeTransition(w)).toBe(false);
    });
  });
});

// ── BIOMES registry ───────────────────────────────────────────────────────────

describe('BIOMES registry', () => {
  it('contains exactly three biomes', () => {
    expect(BIOMES.length).toBe(3);
  });

  it('BIOMES_BY_ID contains wasteland, rupture, jungle', () => {
    expect(BIOMES_BY_ID['wasteland']).toBeDefined();
    expect(BIOMES_BY_ID['rupture']).toBeDefined();
    expect(BIOMES_BY_ID['jungle']).toBeDefined();
  });

  it('each biome has a non-empty propPool', () => {
    for (const b of BIOMES) {
      expect(b.propPool.length).toBeGreaterThan(0);
    }
  });

  it('each biome has fog density between 0 and 1', () => {
    for (const b of BIOMES) {
      expect(b.fogDensity).toBeGreaterThanOrEqual(0);
      expect(b.fogDensity).toBeLessThanOrEqual(1);
    }
  });
});

// ── BiomeManager ──────────────────────────────────────────────────────────────

describe('BiomeManager', () => {
  it('starts with the wasteland biome', () => {
    const mgr = new BiomeManager('wasteland');
    expect(mgr.active.id).toBe('wasteland');
  });

  it('setBiome swaps the active descriptor', () => {
    const mgr = new BiomeManager('wasteland');
    mgr.setBiome('rupture');
    expect(mgr.active.id).toBe('rupture');
  });

  it('setBiome emits biomeChanged', async () => {
    const { eventBus } = await import('@core/eventBus');
    const mgr = new BiomeManager('wasteland');
    mgr.setBiome('jungle');
    expect(eventBus.emit).toHaveBeenCalledWith('biomeChanged', { id: 'jungle' });
  });

  it('setBiome with same id does not change active or emit', async () => {
    const { eventBus } = await import('@core/eventBus');
    vi.mocked(eventBus.emit).mockClear();
    const mgr = new BiomeManager('wasteland');
    mgr.setBiome('wasteland');
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('setBiome with unknown id does nothing', () => {
    const mgr = new BiomeManager('wasteland');
    mgr.setBiome('nonexistent');
    expect(mgr.active.id).toBe('wasteland');
  });
});
