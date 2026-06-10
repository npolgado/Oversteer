// runProgression.ts — Defines the wave→biome mapping for a run.
// Biome transitions are wave-driven and independent of boss cadence.

import type { BiomeId } from '@core/config';
export type { BiomeId };

/** Returns the biome id for the given wave index (1-based). Default linear schedule. */
export function biomeForWave(waveIndex: number): BiomeId {
  if (waveIndex <= 7)  return 'wasteland';
  if (waveIndex <= 14) return 'rupture';
  return 'jungle';
}

/** Returns true when waveIndex marks the start of a new biome. */
export function isBiomeTransition(waveIndex: number): boolean {
  return waveIndex === 8 || waveIndex === 15;
}

// ── RunProgression class (stateful per-run schedule) ──────────────────────────
// NOTE: not in original — Phase 4.5 route branching system.
// Keeps pure helpers above for tests/dev/situations; this class manages live run state.

export class RunProgression {
  private _segment1: BiomeId | null = null;
  private _segment2: BiomeId | null = null;
  private _rewardMult = 1;

  /** Biome for the given wave index, respecting any player choices. */
  biomeForWave(waveIndex: number): BiomeId {
    if (waveIndex <= 7)  return 'wasteland';
    if (waveIndex <= 14) return this._segment1 ?? 'rupture';
    return this._segment2 ?? 'jungle';
  }

  isTransition(waveIndex: number): boolean {
    return isBiomeTransition(waveIndex);
  }

  /**
   * Returns the two choosable biomes if a choice is pending for the given next wave,
   * or null if the schedule is already determined (or no choice at this wave).
   * A choice only exists at wave 8 (segment 1 unchosen).
   */
  pendingChoice(nextWave: number): [BiomeId, BiomeId] | null {
    if (nextWave === 8 && this._segment1 === null) return ['rupture', 'jungle'];
    return null;
  }

  /**
   * Record the player's biome choice for segment 1 (waves 8-14).
   * Segment 2 gets the remaining biome automatically.
   * Choosing jungle early sets rewardMult=1.5 for the harder path.
   */
  choose(id: BiomeId): void {
    if (this._segment1 !== null) return; // already chosen
    this._segment1 = id;
    this._segment2 = id === 'rupture' ? 'jungle' : 'rupture';
    this._rewardMult = id === 'jungle' ? 1.5 : 1;
  }

  /** Multiplier applied to score/scrap during segment 1 when jungle was chosen early. Resets at wave 15. */
  get rewardMult(): number { return this._rewardMult; }

  /** Called at wave 15 transition to reset the rewardMult after the bonus segment ends. */
  resetRewardMult(): void { this._rewardMult = 1; }

  reset(): void {
    this._segment1 = null;
    this._segment2 = null;
    this._rewardMult = 1;
  }
}
