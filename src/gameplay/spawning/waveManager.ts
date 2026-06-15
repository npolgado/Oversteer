// waveManager.ts — Wave state machine: combat/break phases, spawning, bursts.
// Pure functions from pureLogic handle timing computation; this manages mutable state.

import { CFG, type EnemyType } from '@core/config';
import { clamp } from '@core/utils';
import { makeRng } from '@core/rng';
import { rollHordeTrigger, computeHordeCount, shouldTriggerHorde, type ScrapPickup, type BoostZone, getEnemyPool, shouldSpawnElite, computeWaveTiming, computeWaveSpawnBatch } from '@gameplay/pureLogic';
import type { Prop } from '@gameplay/world/propsSystem';

// ── Types ─────────────────────────────────────────────────────────

export type WavePhase = 'combat' | 'break' | 'idle';

export interface HazardZone {
  x: number;
  y: number;
  life: number;       // seconds remaining (from CFG.BOMB_ZONE_DURATION)
  radius: number;     // from CFG.BOMB_ZONE_RADIUS
  phase: number;      // animation phase, starts at 0, increases each frame
}

export interface WaveState {
  waveIndex: number;
  phase: WavePhase;
  waveTimer: number;
  spawnTimer: number;
  burstTimer: number;
  breakTimer: number;
  currentFirstSpawn: number;
  currentSpawnInterval: number;
  currentCombatDuration: number;
  noBursts: boolean;
  burstQueue: number;
  burstDelay: number;
  speedBonus: number;
  cadenceMult: number;
  scraps: ScrapPickup[];
  scrapTimer: number;
  hazardZones: HazardZone[];
  boostZones: BoostZone[];
  boostZoneTimer: number;
  hordeTriggered: boolean;
  hordeSpawnTimer: number;
  hordeTrigger: number;
  // Boss state
  bossActive: boolean;
  bossPattern: BossPattern | null;
  bossSpawned: boolean;
  bossTelegraphTimer: number;
  hasSpawnedThisWave: boolean;  // NOTE: not in original — guards instant wave-end before first spawn
}

export interface SpawnRequest {
  type: EnemyType;
  count: number;
  angle: number;
  distance: number;
}

export type BossPattern = 'pursuer' | 'core' | 'reflector';

export type WaveEvent =
  | { type: 'spawn'; requests: SpawnRequest[] }
  | { type: 'wave_end'; bossKilled?: boolean }
  | { type: 'break_end' }
  | { type: 'horde'; spawnRequests: SpawnRequest[]; count: number }
  | { type: 'boss_spawn'; pattern: BossPattern };

export function isBossWave(waveIndex: number): boolean {
  return waveIndex > 0 && waveIndex % CFG.BOSS_WAVE_INTERVAL === 0;
}

export function getBossPattern(waveIndex: number): BossPattern {
  const patterns: BossPattern[] = ['pursuer', 'core', 'reflector'];
  return patterns[Math.floor(waveIndex / CFG.BOSS_WAVE_INTERVAL - 1) % patterns.length];
}

// ── Factory ────┐───────┐─────────────┐───────┐─────────

export function makeWaveState(): WaveState {
  return {
    waveIndex: 0,
    phase: 'idle',
    waveTimer: 0,
    spawnTimer: 0,
    burstTimer: 0,
    breakTimer: 0,
    currentFirstSpawn: CFG.FIRST_SPAWN_INITIAL,
    currentSpawnInterval: CFG.SPAWN_INTERVAL_INITIAL,
    currentCombatDuration: CFG.WAVE_COMBAT_WAVE1,
    noBursts: true,
    burstQueue: 0,
    burstDelay: 0,
    speedBonus: 0,
    cadenceMult: 1,
    scraps: [],
    scrapTimer: CFG.SCRAP_INTERVAL,
    hazardZones: [],
    boostZones: [],
    boostZoneTimer: CFG.BOOST_ZONE_SPAWN_INTERVAL,
    hordeTriggered: false,
    hordeSpawnTimer: 0,
    hordeTrigger: 0,
    bossActive: false,
    bossPattern: null,
    bossSpawned: false,
    bossTelegraphTimer: 0,
    hasSpawnedThisWave: false,
  };
}

// ── startWave ────┐─────────┐───────────┐─────────

export function startWave(state: WaveState): void {
  state.waveIndex++;
  const timing = computeWaveTiming(state.waveIndex);
  state.currentFirstSpawn = timing.firstSpawn;
  state.currentSpawnInterval = timing.spawnInterval;
  state.currentCombatDuration = timing.combatDuration;
  state.noBursts = timing.noBursts;
  state.phase = 'combat';
  state.waveTimer = 0;
  state.spawnTimer = timing.firstSpawn;
  state.burstTimer = CFG.BURST_INTERVAL;
  state.breakTimer = 0;
  state.burstQueue = 0;
  state.burstDelay = 0;
  // startWave clears scraps (matches original waves.js startWave)
  state.scraps.length = 0;
  state.scrapTimer = CFG.SCRAP_INTERVAL;
  state.hazardZones.length = 0;
  state.boostZones.length = 0;
  state.boostZoneTimer = CFG.BOOST_ZONE_SPAWN_INTERVAL;
  state.hordeTriggered = false;
  state.hordeSpawnTimer = 0;
  state.hordeTrigger = rollHordeTrigger(makeRng(Date.now() + Math.random() * 0xFFFFFF | 0));
  // Boss wave setup
  if (isBossWave(state.waveIndex)) {
    state.bossActive = true;
    state.bossPattern = getBossPattern(state.waveIndex);
    state.bossSpawned = false;
    state.bossTelegraphTimer = 1.5; // 1.5s telegraph before boss appears
  } else {
    state.bossActive = false;
    state.bossPattern = null;
    state.bossSpawned = false;
    state.bossTelegraphTimer = 0;
  }
  state.hasSpawnedThisWave = false;
}

// ── Speed bonus ─────────────────┐─────────

export function computeSpeedBonus(score: number): number {
  return Math.min(120, Math.max(0, Math.floor((score - 2000) / 500) * 12));
}

// ── Spawn type selection ──────┐────────

// Weighted pool cache — rebuilt only when score bucket or biome changes.
// Using reference equality on base (getEnemyPool returns stable array refs)
// and on weightMult (biome objects are stable per active biome).
let _cachedBase: readonly EnemyType[] | null = null;
let _cachedMult: Partial<Record<EnemyType, number>> | null = null;
let _cachedPool: EnemyType[] = [];

function _buildWeightedPool(
  base: readonly EnemyType[],
  weightMult: Partial<Record<EnemyType, number>>,
): EnemyType[] {
  const out: EnemyType[] = [];
  for (const t of base) {
    // Math.max(1, ...) prevents a mult < 0.125 from silently dropping the type
    const copies = Math.max(1, Math.round((weightMult[t] ?? 1) * 4));
    for (let k = 0; k < copies; k++) out.push(t);
  }
  return out;
}

function pickEnemyType(
  score: number,
  waveIndex: number,
  weightMult: Partial<Record<EnemyType, number>> = {},
): EnemyType {
  const base = getEnemyPool(score);
  if (base !== _cachedBase || weightMult !== _cachedMult) {
    _cachedBase = base;
    _cachedMult = weightMult;
    _cachedPool = _buildWeightedPool(base, weightMult);
  }
  const pool = _cachedPool.length > 0 ? _cachedPool : (base as EnemyType[]);
  const type = pool[Math.floor(Math.random() * pool.length)];
  // Elite override: 12% chance from wave 4+
  if (waveIndex >= 4 && Math.random() < 0.12) return 'elite';
  return type;
}

// ── Update ────┐───────────┐───────────────┐──────────

export function updateWave(
  state: WaveState,
  dt: number,
  score: number,
  enemyCount: number,
  bossAlive = false,
  enemyWeightMult: Partial<Record<EnemyType, number>> = {},
): WaveEvent[] {
  const events: WaveEvent[] = [];

  // Update speed bonus + cadence multiplier each frame
  state.speedBonus = computeSpeedBonus(score);
  state.cadenceMult = score >= 500 ? 0.9 : 1;

  if (state.phase === 'combat') {
    state.waveTimer += dt;

    // Boss wave: telegraph countdown → spawn → wait for kill
    if (state.bossActive) {
      if (!state.bossSpawned) {
        state.bossTelegraphTimer -= dt;
        if (state.bossTelegraphTimer <= 0) {
          state.bossSpawned = true;
          events.push({ type: 'boss_spawn', pattern: state.bossPattern! });
        }
      } else if (!bossAlive) {
        // Boss is dead — end combat phase (minions may still be alive; use bossAlive not enemyCount)
        state.phase = 'break';
        state.breakTimer = CFG.WAVE_BREAK;
        events.push({ type: 'wave_end', bossKilled: true });
        return events;
      }
      // Boss waves allow regular spawning to continue alongside the boss
    }

    // Normal wave: end on timer, but only after at least one enemy has spawned this wave
    // (guards race condition where timer expires before first-spawn delay elapses on fast loads)
    if (state.waveTimer >= state.currentCombatDuration && state.hasSpawnedThisWave) {
      state.phase = 'break';
      state.breakTimer = CFG.WAVE_BREAK;
      // wave_end does NOT clear scraps (they persist into break phase)
      events.push({ type: 'wave_end' });
      return events;
    }

    // Horde event logic (fires once per wave after trigger fraction of combat time)
    if (!state.hordeTriggered &&
        shouldTriggerHorde(state.waveTimer, state.currentCombatDuration, state.hordeTrigger)) {
      state.hordeTriggered = true;
      state.hordeSpawnTimer = CFG.HORDE_DELAY;
    }

    // Horde spawn countdown
    if (state.hordeTriggered && state.hordeSpawnTimer > 0) {
      state.hordeSpawnTimer -= dt;
      if (state.hordeSpawnTimer <= 0) {
        // NOTE: not in original — scale number of horde batches by wave
        const batchCount = state.waveIndex >= CFG.HORDE_BATCH_WAVE_3 ? 3
          : state.waveIndex >= CFG.HORDE_BATCH_WAVE_2 ? 2
          : 1;
        const count = computeHordeCount(state.waveIndex);
        for (let b = 0; b < batchCount; b++) {
          const requests: SpawnRequest[] = [];
          const baseAngle = Math.random() * Math.PI * 2;
          for (let i = 0; i < count; i++) {
            const t = count > 1 ? (i / (count - 1) - 0.5) : 0;
            const angle = baseAngle + t * CFG.HORDE_ARC_RAD;
            requests.push({ type: pickEnemyType(score, state.waveIndex, enemyWeightMult), count: 1, angle, distance: CFG.HORDE_SPAWN_DIST });
          }
          events.push({ type: 'horde', spawnRequests: requests, count });
        }
      }
    }

    // Regular spawn timer
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      // NOTE: not in original — emit a batch of enemies per tick at higher waves
      const batch = computeWaveSpawnBatch(state.waveIndex);
      const baseAngle = Math.random() * Math.PI * 2;
      const requests: SpawnRequest[] = [];
      for (let b = 0; b < batch; b++) {
        const type = pickEnemyType(score, state.waveIndex, enemyWeightMult);
        // Spread batch members at slightly different angles to avoid perfect overlap
        const angle = baseAngle + (b / Math.max(1, batch)) * Math.PI * 2;
        requests.push({ type, count: 1, angle, distance: 550 });
      }
      events.push({ type: 'spawn', requests });
      state.hasSpawnedThisWave = true;
      state.spawnTimer = state.currentSpawnInterval * state.cadenceMult;
    }

    // Burst queue processing
    if (state.burstQueue > 0) {
      state.burstDelay -= dt;
      if (state.burstDelay <= 0) {
        const type = pickEnemyType(score, state.waveIndex, enemyWeightMult);
        const angle = Math.random() * Math.PI * 2;
        events.push({
          type: 'spawn',
          requests: [{ type, count: 1, angle, distance: 550 }],
        });
        state.burstQueue--;
        state.burstDelay = CFG.BURST_DELAY;
      }
    }

    // Burst trigger — NOTE: not in original: burst count and interval scale with wave
    if (!state.noBursts) {
      state.burstTimer -= dt;
      if (state.burstTimer <= 0) {
        const waveScale = Math.min(1, Math.max(0, (state.waveIndex - 1) / 9));
        const scaledBurstCount = CFG.BURST_COUNT + Math.floor(waveScale * 3); // 2→5 over waves 1-10
        const scaledBurstInterval = Math.max(4, CFG.BURST_INTERVAL - waveScale * 4); // 8s→4s over waves 1-10
        state.burstQueue = scaledBurstCount;
        state.burstDelay = CFG.BURST_DELAY;
        state.burstTimer = scaledBurstInterval;
      }
    }
  } else if (state.phase === 'break') {
    state.breakTimer -= dt;
    if (state.breakTimer <= 0) {
      state.phase = 'idle';
      events.push({ type: 'break_end' });
    }
  }
  // idle: no-op

  return events;
}

// ── Scrap spawning helper ──

export interface ScrapSpawnResult {
  x: number;
  y: number;
}

// NOTE: not in original — minimum clearance radius for pickup spawn vs solid prop collision.
const PICKUP_PROP_CLEAR_RADIUS = 30;

/**
 * NOTE: not in original — checks whether a candidate position overlaps any solid/hazard prop.
 * Rejects positions where the prop circle plus a clearance margin overlaps the spawn point.
 */
function _overlapsProps(x: number, y: number, props: Prop[]): boolean {
  for (const p of props) {
    if (p.type !== 'solid' && p.type !== 'hazard') continue;
    const dx = x - p.x;
    const dy = y - p.y;
    const minDist = p.radius + PICKUP_PROP_CLEAR_RADIUS;
    if (dx * dx + dy * dy < minDist * minDist) return true;
  }
  return false;
}

/**
 * NOTE: not in original — tries up to maxRetries candidate positions, falling back to
 * player position offset if all candidates overlap props.
 */
function _clearSpawnPos(
  candidates: Array<{ x: number; y: number }>,
  fallbackX: number,
  fallbackY: number,
  props: Prop[],
): { x: number; y: number } {
  for (const c of candidates) {
    if (!_overlapsProps(c.x, c.y, props)) return c;
  }
  // Fallback: guaranteed-clear position near player (player can't be inside a solid prop)
  return { x: fallbackX, y: fallbackY };
}

/** Returns a spawn position for a scrap near the player, or null if timer not ready. */
export function tickScrapSpawn(
  state: WaveState,
  dt: number,
  playerX: number,
  playerY: number,
  props: Prop[] = [], // NOTE: not in original — obstacle avoidance
): ScrapSpawnResult | null {
  if (state.phase !== 'combat') return null;
  state.scrapTimer -= dt;
  if (state.scrapTimer > 0) return null;
  state.scrapTimer = CFG.SCRAP_INTERVAL;

  // NOTE: not in original — generate 5 candidates, pick first clear of solid props
  const candidates: Array<{ x: number; y: number }> = [];
  for (let attempt = 0; attempt < 5; attempt++) {
    const dist = 220 + Math.random() * 120;
    const angle = Math.random() * Math.PI * 2;
    candidates.push({
      x: clamp(playerX + Math.cos(angle) * dist, 40, CFG.WORLD_W - 40),
      y: clamp(playerY + Math.sin(angle) * dist, 40, CFG.WORLD_H - 40),
    });
  }
  return _clearSpawnPos(candidates, playerX, playerY, props);
}

export function tickBoostZoneSpawn(
  state: WaveState,
  dt: number,
  playerX: number,
  playerY: number,
  props: Prop[] = [], // NOTE: not in original — obstacle avoidance
): void {
  if (state.phase !== 'combat') return;
  state.boostZoneTimer -= dt;
  if (state.boostZoneTimer > 0) return;
  state.boostZoneTimer = CFG.BOOST_ZONE_SPAWN_INTERVAL;

  // NOTE: not in original — generate 5 candidates, pick first clear of solid props
  const candidates: Array<{ x: number; y: number }> = [];
  for (let attempt = 0; attempt < 5; attempt++) {
    const spawnDist = 200 + Math.random() * 200;
    const angle = Math.random() * Math.PI * 2;
    candidates.push({
      x: clamp(playerX + Math.cos(angle) * spawnDist, 60, CFG.WORLD_W - 60),
      y: clamp(playerY + Math.sin(angle) * spawnDist, 60, CFG.WORLD_H - 60),
    });
  }
  const pos = _clearSpawnPos(candidates, playerX, playerY, props);
  state.boostZones.push({ x: pos.x, y: pos.y, life: 12 });
}
