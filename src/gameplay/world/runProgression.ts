// runProgression.ts — Defines the wave→biome mapping for a run.
// Biome transitions are wave-driven and independent of boss cadence.

import type { BiomeId } from '@core/config';
export type { BiomeId };

/** Returns the biome id for the given wave index (1-based). */
export function biomeForWave(waveIndex: number): BiomeId {
  if (waveIndex <= 7)  return 'wasteland';
  if (waveIndex <= 14) return 'rupture';
  return 'jungle';
}

/** Returns true when waveIndex marks the start of a new biome. */
export function isBiomeTransition(waveIndex: number): boolean {
  return waveIndex === 8 || waveIndex === 15;
}
