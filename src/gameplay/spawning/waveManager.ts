// waveManager.ts — Wave state machine: combat/break phases, spawning, bursts.
// Pure functions from pureLogic handle timing computation; this manages mutable state.

import { CFG, type EnemyType } from '@core/config';
import { clamp } from '@core/utils';
import { makeRng } from '@core/rng';
import { rollHordeTrigger, computeHordeCount, shouldTriggerHorde, type ScrapPickup, type BoostZone, getEnemyPool, shouldSpawnElite, computeWaveTiming } from '@gameplay/pureLogic';

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
  | { type: 'wave_end' }
  | { type: 'break_end' }
  | { type: 'horde'; spawnRequests: SpawnRequest[]; count: number }
  | { type: 'boss_spawn'; pattern: BossPattern };

export function isBossWave(waveIndex: number): boolean {
  return waveIndex > 0 && waveIndex % 5 === 0;
}

export function getBossPattern(waveIndex: number): BossPattern {
  const patterns: BossPattern[] = ['pursuer', 'core', 'reflector'];
  return patterns[Math.floor(waveIndex / 5 - 1) % patterns.length];
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
}

// ── Speed bonus ─────────────────┐─────────

export function computeSpeedBonus(score: number): number {
  return Math.min(120, Math.max(0, Math.floor((score - 2000) / 500) * 12));
}

// ── Spawn type selection ──────┐────────

function pickEnemyType(
  score: number,
  waveIndex: number,
  weightMult: Partial<Record<EnemyType, number>> = {},
): EnemyType {
  const base = getEnemyPool(score);
  // Apply biome weight multipliers — entries > 1 appear more frequently
  const weighted: EnemyType[] = [];
  for (const t of base) {
    const mult = Math.round((weightMult[t] ?? 1) * 4);
    for (let k = 0; k < mult; k++) weighted.push(t);
  }
  const pool = weighted.length > 0 ? weighted : base;
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
      } else if (enemyCount === 0) {
        // Boss is dead — end combat phase
        state.phase = 'break';
        state.breakTimer = CFG.WAVE_BREAK;
        events.push({ type: 'wave_end' });
        return events;
      }
      // Suppress all normal spawning during boss waves
      return events;
    }

    // Normal wave: end on timer
    if (state.waveTimer >= state.currentCombatDuration) {
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
        const count = computeHordeCount(state.waveIndex);
        const requests: SpawnRequest[] = [];
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count;
          requests.push({ type: pickEnemyType(score, state.waveIndex, enemyWeightMult), count: 1, angle, distance: CFG.HORDE_SPAWN_DIST });
        }
        events.push({ type: 'horde', spawnRequests: requests, count });
      }
    }

    // Regular spawn timer
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      const type = pickEnemyType(score, state.waveIndex, enemyWeightMult);
      const angle = Math.random() * Math.PI * 2;
      events.push({
        type: 'spawn',
        requests: [{ type, count: 1, angle, distance: 550 }],
      });
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

    // Burst trigger
    if (!state.noBursts) {
      state.burstTimer -= dt;
      if (state.burstTimer <= 0) {
        state.burstQueue = CFG.BURST_COUNT;
        state.burstDelay = CFG.BURST_DELAY;
        state.burstTimer = CFG.BURST_INTERVAL;
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

/** Returns a spawn position for a scrap near the player, or null if timer not ready. */
export function tickScrapSpawn(
  state: WaveState,
  dt: number,
  playerX: number,
  playerY: number,
): ScrapSpawnResult | null {
  if (state.phase !== 'combat') return null;
  state.scrapTimer -= dt;
  if (state.scrapTimer > 0) return null;
  state.scrapTimer = CFG.SCRAP_INTERVAL;

  // Spawn 220-340px from player at random angle, clamped to world
  const dist = 220 + Math.random() * 120;
  const angle = Math.random() * Math.PI * 2;
  const x = clamp(playerX + Math.cos(angle) * dist, 40, CFG.WORLD_W - 40);
  const y = clamp(playerY + Math.sin(angle) * dist, 40, CFG.WORLD_H - 40);
  return { x, y };
}

export function tickBoostZoneSpawn(
  state: WaveState,
  dt: number,
  playerX: number,
  playerY: number,
): void {
  if (state.phase !== 'combat') return;
  state.boostZoneTimer -= dt;
  if (state.boostZoneTimer > 0) return;
  state.boostZoneTimer = CFG.BOOST_ZONE_SPAWN_INTERVAL;
  const spawnDist = 200 + Math.random() * 200;
  const angle = Math.random() * Math.PI * 2;
  state.boostZones.push({
    x: clamp(playerX + Math.cos(angle) * spawnDist, 60, CFG.WORLD_W - 60),
    y: clamp(playerY + Math.sin(angle) * spawnDist, 60, CFG.WORLD_H - 60),
    life: 12,
  });
}
