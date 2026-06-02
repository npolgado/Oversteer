// biomeManager.ts — Owns the active biome descriptor for the run.
// Calling setBiome() swaps the active descriptor and emits 'biomeChanged'.

import { BIOMES_BY_ID, type BiomeDescriptor, type BiomeId, type EnemyType } from '@core/config';
import { eventBus } from '@core/eventBus';

export class BiomeManager {
  private _active: BiomeDescriptor;
  private _devBias: Partial<Record<EnemyType, number>> = {};
  private _cachedEffective: Partial<Record<EnemyType, number>>;
  private _effectiveDirty = false;

  constructor(startId: BiomeId = 'wasteland') {
    this._active = BIOMES_BY_ID[startId];
    this._cachedEffective = this._active.enemyWeightMult;
  }

  get active(): BiomeDescriptor { return this._active; }

  /**
   * Returns the active biome's enemyWeightMult merged with any dev bias set via setDevBias().
   * Returns a stable object reference when nothing has changed (cache-friendly for waveManager).
   */
  get effectiveWeightMult(): Partial<Record<EnemyType, number>> {
    if (this._effectiveDirty) {
      if (Object.keys(this._devBias).length === 0) {
        this._cachedEffective = this._active.enemyWeightMult;
      } else {
        const merged: Partial<Record<EnemyType, number>> = { ...this._active.enemyWeightMult };
        for (const [k, v] of Object.entries(this._devBias)) {
          merged[k as EnemyType] = (merged[k as EnemyType] ?? 1) * v;
        }
        this._cachedEffective = merged;
      }
      this._effectiveDirty = false;
    }
    return this._cachedEffective;
  }

  setBiome(id: BiomeId): void {
    const next = BIOMES_BY_ID[id];
    if (import.meta.env?.DEV && !next) throw new Error(`BiomeManager.setBiome: unknown biome id "${id}"`);
    if (!next || next === this._active) return;
    this._active = next;
    this._effectiveDirty = true;
    eventBus.emit('biomeChanged', { id });
  }

  /** DEV-only: layer additional per-archetype weight multipliers on top of the active biome. */
  setDevBias(bias: Partial<Record<EnemyType, number>>): void {
    this._devBias = bias;
    this._effectiveDirty = true;
  }
}
