// waveManager.ts — Wave state machine: combat/break phases, spawning, bursts.
// Pure functions from pureLogic handle timing computation; this manages mutable state.

import { CFG, type EnemyType } from '@core/config';
import { clamp } from '@core/utils';
import { makeRng } from '@core/rng';
import { rollHordeTrigger, computeHordeCount, shouldTriggerHorde, type ScrapPickup, getEnemyPool, shouldSpawnElite, computeWaveTiming } from '@gameplay/pureLogic';

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
  hordeTriggered: boolean;
  hordeSpawnTimer: number;
  hordeTrigger: number;
}

export interface SpawnRequest {
  type: EnemyType;
  count: number;
  angle: number;
  distance: number;
}

export type WaveEvent =
  | { type: 'spawn'; requests: SpawnRequest[] }
  | { type: 'wave_end' }
  | { type: 'break_end' }
  | { type: 'horde'; spawnRequests: SpawnRequest[]; count: number };

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
    hordeTriggered: false,
    hordeSpawnTimer: 0,
    hordeTrigger: 0,
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
  state.hordeTriggered = false;
  state.hordeSpawnTimer = 0;
  state.hordeTrigger = rollHordeTrigger(makeRng(Date.now() + Math.random() * 0xFFFFFF | 0));
}

// ── Speed bonus ─────────────────┐─────────

export function computeSpeedBonus(score: number): number {
  return Math.min(120, Math.max(0, Math.floor((score - 2000) / 500) * 12));
}

// ── Spawn type selection ──────┐────────

function pickEnemyType(score: number, waveIndex: number): EnemyType {
  const pool = getEnemyPool(score);
  const type = pool[Math.floor(Math.random() * pool.length)];
  // Elite override: 20% chance from wave 4+
  if (waveIndex >= 4 && Math.random() < 0.12) return 'elite';
  return type;
}

// ── Update ────┐───────────┐───────────────┐──────────

export function updateWave(
  state: WaveState,
  dt: number,
  score: number,
  enemyCount: number,
): WaveEvent[] {
  const events: WaveEvent[] = [];

  // Update speed bonus + cadence multiplier each frame
  state.speedBonus = computeSpeedBonus(score);
  state.cadenceMult = score >= 500 ? 0.9 : 1;

  if (state.phase === 'combat') {
    state.waveTimer += dt;

    // Wave end check
    if (state.waveTimer >= state.currentCombatDuration) {
      state.phase = 'break';
      state.breakTimer = CFG.WAVE_BREAK;
      // wave_end does NOT clear scraps (they persist into break phase)
      events.push({ type: 'wave_end' });
      return events;
    }

    // Horde event logic (wave 2+, fires once per wave at 75% of combat time)
    if (!state.hordeTriggered && state.waveIndex >= 2 &&
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
          requests.push({ type: pickEnemyType(score, state.waveIndex), count: 1, angle, distance: CFG.HORDE_SPAWN_DIST });
        }
        events.push({ type: 'horde', spawnRequests: requests, count });
      }
    }

    // Regular spawn timer
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      const type = pickEnemyType(score, state.waveIndex);
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
        const type = pickEnemyType(score, state.waveIndex);
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


