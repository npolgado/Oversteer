// situationTester.ts — DEV-only situation tester for Oversteer.
// Provides applySituation() to mutate freshly-built game state for quick test entry.
// This module is statically imported in gameLoop.ts but all call sites are guarded by
// import.meta.env.DEV, so the situation tester cannot execute in production builds.
//
// Post-startWave fields (openUpgradeBreak, rerollBonus, waveProgress, scrapTokens,
// pickupAtPlayer, disableSpawns, goal, hint) are read directly from _resolvedSituation
// by the GameLoop after startWave() runs — not applied inside applySituation().

import type { BiomeId, EnemyType } from '@core/config';
import type { WaveState, BossPattern } from '@gameplay/spawning/waveManager';
import type { PlayerState } from '@gameplay/player/playerState';
import type { TrailState } from '@gameplay/trail/trailState';
import type { BiomeManager } from '@gameplay/world/biomeManager';
import type { ScoringState } from '@gameplay/scoring';
import type { PickupType } from '@gameplay/pureLogic';
import { applyUpgrade, getUpgradeById } from '@gameplay/upgrades/upgradeSystem';
import { biomeForWave } from '@gameplay/world/runProgression';
import scenarioCatalog from './scenarios.json';

export interface SituationSpec {
  id?: string;
  /** Human-readable name, populated from catalog entries. Used as fallback banner text. */
  name?: string;
  wave: number;
  biome?: BiomeId;
  /** Force a specific boss pattern regardless of wave index. Applied by GameLoop after startWave(). */
  boss?: BossPattern | null;
  upgrades?: string[];
  hp?: number;
  maxHp?: number;
  /** Seed playerState.scrapBank for shop purchase testing. */
  scrap?: number;
  /** Set scoringState.score directly — used to cross the 3500 splitter unlock threshold. */
  score?: number;
  /** Force comboLevel on both playerState and scoringState (white <4, cyan 4–6, magenta ≥7). */
  combo?: number;
  /** Per-archetype weight multiplier layered on top of active biome weighting. */
  enemySpawnBias?: Partial<Record<EnemyType, number>>;
  /** Override the next pickup drop to this type (consumed once; subsequent drops are normal). */
  forcePickup?: PickupType;
  /** If true, the first wave_end event will carry bossKilled=true, granting the upgrade-break reroll. */
  bossDefeated?: boolean;

  // ── Post-startWave overrides (applied by GameLoop after startWave()) ────────

  /** Skip combat — enter the upgrade break / shop UI immediately on load. */
  openUpgradeBreak?: boolean;
  /** Extra rerolls on top of the base count (and any boss-kill bonus). Use 99 for unlimited. */
  rerollBonus?: number;
  /** Advance waveTimer to this fraction of combatDuration (0–1) right after startWave(). */
  waveProgress?: number;
  /** Scatter N physical scrap pickup tokens around the player at load (distinct from scrap currency). */
  scrapTokens?: number | { count: number; radius?: number };
  /** Place a forced pickup directly next to the player at load (instant, not gated by spawn timer). */
  pickupAtPlayer?: PickupType | { type: PickupType; offset?: { x: number; y: number } };
  /** Prevent enemy spawns for this scenario (sets spawnTimer = Infinity). */
  disableSpawns?: boolean;
  /** Short imperative (≤ 60 chars) shown in the persistent scenario-goal HUD. */
  goal?: string;
  /** Override text for the 1.5 s milestone banner at load. Defaults to name ?? id. */
  hint?: string;
}

interface ScenarioEntry extends SituationSpec {
  id: string;
  name: string;
  description?: string;
  branch?: string;
}

export const SITUATIONS_BY_ID = new Map<string, SituationSpec>(
  (scenarioCatalog.scenarios as ScenarioEntry[]).map(s => [s.id, s]),
);

// DEV-only one-shot override state — consumed and reset by call sites in gameLoop.ts.
let _devForcePickup: PickupType | null = null;
let _devBossKilled = false;

/** Returns and clears the forced pickup type set by the last applySituation() call. */
export function consumeDevPickup(): PickupType | null {
  const v = _devForcePickup;
  _devForcePickup = null;
  return v;
}

/** Returns true (once) if the current situation requested a simulated boss kill on wave_end. */
export function consumeDevBossKilled(): boolean {
  const v = _devBossKilled;
  _devBossKilled = false;
  return v;
}

/**
 * Mutates waveState, playerState, biomeManager, trailState, and scoringState to match spec.
 *
 * Call BEFORE startWave(). Sets waveIndex = spec.wave - 1 so the next
 * startWave() increments to spec.wave. Boss pattern override (spec.boss)
 * must be applied by the GameLoop caller AFTER startWave() because startWave()
 * overwrites bossPattern from its own round-robin.
 */
export function applySituation(
  waveState: WaveState,
  playerState: PlayerState,
  biomeManager: BiomeManager,
  trailState: TrailState,
  scoringState: ScoringState,
  spec: SituationSpec,
): void {
  // Wave: startWave() will increment by 1, landing on spec.wave
  waveState.waveIndex = Math.max(0, spec.wave - 1);

  // Biome: default to the biome that normally covers spec.wave
  const targetBiome: BiomeId = spec.biome ?? biomeForWave(spec.wave);
  biomeManager.setBiome(targetBiome);

  // Upgrades: reuse production applyUpgrade() + replicate side-effects from
  // upgradeBreakPhase.ts:118-121 (wider_trail / trail_echo / speed_demon).
  for (const id of spec.upgrades ?? []) {
    const upgrade = getUpgradeById(id);
    if (!upgrade) {
      console.warn(`[situation] unknown upgrade id "${id}" — skipped`);
      continue;
    }
    applyUpgrade(playerState, upgrade);
    if (id === 'wider_trail') trailState.closeDist = 60;
    if (id === 'trail_echo')  trailState.maxPoints = 600;
    if (id === 'speed_demon') waveState.speedBonus += 40;
  }

  // HP overrides — applied after upgrades (which may mutate maxHp)
  if (spec.maxHp !== undefined) {
    playerState.maxHp = spec.maxHp;
    playerState.hp = Math.min(playerState.hp, spec.maxHp);
  }
  if (spec.hp !== undefined) {
    playerState.hp = Math.min(spec.hp, playerState.maxHp);
  }

  // Economy + scoring
  if (spec.scrap !== undefined) playerState.scrapBank = spec.scrap;
  if (spec.score !== undefined) scoringState.score = spec.score;
  if (spec.combo !== undefined) {
    playerState.comboLevel = spec.combo;
    scoringState.comboLevel = spec.combo;
  }

  // Enemy spawn bias — layered on top of the active biome's weightMult
  biomeManager.setDevBias(spec.enemySpawnBias ?? {});

  // One-shot overrides consumed by gameLoop.ts call sites
  if (spec.forcePickup) _devForcePickup = spec.forcePickup;
  if (spec.bossDefeated) _devBossKilled = true;
}
