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

// ── biome transition activation contract ──────────────────────────────────────

describe('biome transition activation contract', () => {
  it('_applyBiomeTransition contract: at wave 8, biomeForWave returns rupture and isBiomeTransition is true', () => {
    expect(isBiomeTransition(8)).toBe(true);
    expect(biomeForWave(8)).toBe('rupture');
  });

  it('_applyBiomeTransition contract: at wave 15, biomeForWave returns jungle and isBiomeTransition is true', () => {
    expect(isBiomeTransition(15)).toBe(true);
    expect(biomeForWave(15)).toBe('jungle');
  });

  it('BiomeManager driven by the _onWaveStart sequence ends on rupture at wave 8', () => {
    const mgr = new BiomeManager('wasteland');
    // Simulate what _applyBiomeTransition does for the wave-8 callback
    if (isBiomeTransition(8)) mgr.setBiome(biomeForWave(8));
    expect(mgr.active.id).toBe('rupture');
  });

  it('BiomeManager driven by the _onWaveStart sequence ends on jungle at wave 15', () => {
    const mgr = new BiomeManager('wasteland');
    if (isBiomeTransition(8))  mgr.setBiome(biomeForWave(8));
    if (isBiomeTransition(15)) mgr.setBiome(biomeForWave(15));
    expect(mgr.active.id).toBe('jungle');
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

  it('setBiome with unknown id throws in dev', () => {
    const mgr = new BiomeManager('wasteland');
    expect(() => (mgr as any).setBiome('nonexistent')).toThrow(/unknown biome id/);
    expect(mgr.active.id).toBe('wasteland'); // state is unchanged — throw precedes mutation
  });
});
