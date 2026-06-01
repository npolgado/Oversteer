// biomeManager.ts — Owns the active biome descriptor for the run.
// Calling setBiome() swaps the active descriptor and emits 'biomeChanged'.

import { BIOMES_BY_ID, type BiomeDescriptor, type BiomeId } from '@core/config';
import { eventBus } from '@core/eventBus';

export class BiomeManager {
  private _active: BiomeDescriptor;

  constructor(startId: BiomeId = 'wasteland') {
    this._active = BIOMES_BY_ID[startId];
  }

  get active(): BiomeDescriptor { return this._active; }

  setBiome(id: BiomeId): void {
    const next = BIOMES_BY_ID[id];
    if (import.meta.env?.DEV && !next) throw new Error(`BiomeManager.setBiome: unknown biome id "${id}"`);
    if (!next || next === this._active) return;
    this._active = next;
    eventBus.emit('biomeChanged', { id });
  }
}
