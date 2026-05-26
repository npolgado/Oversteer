// biomeManager.ts — Owns the active biome descriptor for the run.
// Calling setBiome() swaps the active descriptor and emits 'biomeChanged'.

import { BIOMES_BY_ID, type BiomeDescriptor } from '@core/config';
import { eventBus } from '@core/eventBus';

export class BiomeManager {
  private _active: BiomeDescriptor;

  constructor(startId: string = 'wasteland') {
    this._active = BIOMES_BY_ID[startId] ?? Object.values(BIOMES_BY_ID)[0];
  }

  get active(): BiomeDescriptor { return this._active; }

  setBiome(id: string): void {
    const next = BIOMES_BY_ID[id];
    if (!next || next === this._active) return;
    this._active = next;
    eventBus.emit('biomeChanged', { id });
  }
}
