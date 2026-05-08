# Phase 1 — Step 7: Wave Manager + Pickups

## Context

This step ports the wave state machine from `arena-drifter/waves.js` (~300 lines of wave logic). The wave system alternates between combat phases (enemies spawn) and break phases (player picks upgrades). Phase 1 scope: combat/break phases, single + burst spawning, scrap pickups only. Horde events, special pickups (bomb, trail_boost, speed_pickup), and boost zones are deferred to Phase 3.

Key wave mechanics:
- **Combat phase**: 30s base + 10s/wave, capped at 120s. Enemies spawn on interval.
- **Spawn ramp** (linear wave 1→5): first spawn delay 2.5s→0.6s, interval 4.0s→1.5s
- **Burst spawning** (wave 2+): every 8s, spawns 2 enemies with 0.3s delay
- **Speed bonus**: at 2000+ score, enemies get up to +120 px/s
- **Break phase**: 8s. All enemies cleared. (Upgrade selection in Step 10.)

**Prerequisite:** Steps 5 (enemy spawning), 6 (collision context for game loop).

---

## Task 7.1 — Wave Manager State & Logic

**Files:**
- `src/gameplay/spawning/waveManager.ts` — create

**Steps:**
1. Define types:
   ```typescript
   export type WavePhase = 'combat' | 'break' | 'idle';

   export interface WaveState {
     waveIndex: number;
     phase: WavePhase;
     waveTimer: number;            // seconds into current combat phase
     spawnTimer: number;            // countdown to next spawn
     burstTimer: number;            // countdown to next burst event
     breakTimer: number;            // countdown until break ends
     // Computed per-wave
     currentFirstSpawn: number;
     currentSpawnInterval: number;
     currentCombatDuration: number;
     noBursts: boolean;             // wave 1 = no bursts
     // Burst queue
     burstQueue: number;            // enemies remaining in current burst
     burstDelay: number;            // timer between burst spawns (0.3s)
     // Speed bonus
     speedBonus: number;
   }
   ```
2. Export `makeWaveState(): WaveState` — initialize at `waveIndex: 0`, `phase: 'idle'`.
3. Export `startWave(state: WaveState): void`:
   - Increment `waveIndex`
   - Compute timing via `computeWaveTiming(state.waveIndex)` from pure logic
   - Set `phase = 'combat'`, reset all timers
4. Export `computeSpeedBonus(score: number): number`:
   - `score >= 2000 ? Math.min((score - 2000) / 8000 * 120, 120) : 0` (matches old code)

**Depends on:** Step 1 (computeWaveTiming, pure logic)

**Verify:** `npx tsc --noEmit` clean.

---

## Task 7.2 — Wave Update Logic

**Files:**
- `src/gameplay/spawning/waveManager.ts` — extend

**Steps:**
1. Define spawn event type:
   ```typescript
   export interface SpawnRequest {
     type: EnemyType;
     count: number;
     angle: number;        // spawn direction from player
     distance: number;     // spawn distance from player (default 550)
   }
   ```
2. Define wave event type:
   ```typescript
   export type WaveEvent =
     | { type: 'spawn'; requests: SpawnRequest[] }
     | { type: 'wave_end' }       // combat phase ended, transition to break
     | { type: 'break_end' };     // break phase ended, ready for next wave
   ```
3. Export `updateWave(state: WaveState, dt: number, score: number, enemyCount: number): WaveEvent[]`:
   - Returns an array of events (usually 0-2 per frame).
   - **Combat phase:**
     - Increment `waveTimer`
     - Decrement `spawnTimer`. When <= 0: push `SpawnRequest` event, reset timer to `currentSpawnInterval`
     - Handle burst queue: if `burstQueue > 0`, decrement `burstDelay`. When <= 0: push spawn, decrement queue, reset delay to 0.3s
     - Burst trigger: decrement `burstTimer`. When <= 0: if `!noBursts`, set `burstQueue = 2`, reset timer to 8s
     - Wave end: if `waveTimer >= currentCombatDuration`, push `{ type: 'wave_end' }`, set `phase = 'break'`, reset `breakTimer = CFG.WAVE_BREAK`
   - **Break phase:**
     - Decrement `breakTimer`. When <= 0: push `{ type: 'break_end' }`, set `phase = 'idle'`
   - **Idle phase:** no-op (waiting for external call to `startWave`)
   - Update `speedBonus = computeSpeedBonus(score)`
4. **Spawn position calculation:** not in updateWave — the caller converts `SpawnRequest` into actual `EnemyState` via `makeEnemyState`. The angle is random, distance is 550px from player, clamped to world bounds.

**Depends on:** Task 7.1

**Verify:** `npx tsc --noEmit` clean.

---

## Task 7.3 — Scrap Pickups

**Files:**
- `src/gameplay/spawning/pickups.ts` — create

**Steps:**
1. Define types:
   ```typescript
   export interface ScrapPickup {
     x: number; y: number;
     alive: boolean;
     radius: number;       // default 12
   }

   export interface PickupEvent {
     type: 'scrap_collected';
     x: number; y: number;
     scoreDelta: number;
     comboBoost: boolean;   // 35% chance
   }
   ```
2. Export `makeScrapPickup(x: number, y: number): ScrapPickup`.
3. Export `updatePickups(pickups: ScrapPickup[], player: PlayerState, dt: number): PickupEvent[]`:
   - For each alive pickup: check collection distance (player radius + pickup radius; if magnet upgrade, extend to `player.magnetRange`)
   - On collection: `pickup.alive = false`, push `PickupEvent` with `scoreDelta: 10` and `comboBoost: Math.random() < 0.35`
   - Swap-and-pop dead pickups
4. Scrap spawning is driven by a timer (every 6s during combat) — managed by the gameplayScene, not the pickup module.

**Depends on:** Step 2 (PlayerState)

**Verify:** `npx tsc --noEmit` clean.

---

## Task 7.4 — Wire into GameplayScene

**Files:**
- `src/scenes/gameplayScene.ts` — update

**Steps:**
1. Add `waveState`, `pickups: ScrapPickup[]`, `scrapSpawnTimer: number` to scene state.
2. In `enter()`: `waveState = makeWaveState()`, call `startWave(waveState)`.
3. In `update(dt)`:
   - `const waveEvents = updateWave(waveState, dt, score, enemies.length)`
   - Process events:
     - `spawn`: for each request, compute position (random angle × 550px from player, clamped to world), call `makeEnemyState(type, x, y, waveState.speedBonus)`, push to enemies array, `enemyRenderer.sync(enemies)`
     - `wave_end`: clear all enemies (set `alive = false`), clear pickups. Emit `eventBus.emit('waveEnded', { wave: waveState.waveIndex })`. (Upgrade selection handled in Step 10.)
     - `break_end`: call `startWave(waveState)`. Emit `eventBus.emit('waveStarted', { wave: waveState.waveIndex })`.
   - Scrap spawning: decrement `scrapSpawnTimer`. When <= 0 and phase === 'combat': spawn scrap at random position near player (within 400px), reset timer to 6s.
   - `const pickupEvents = updatePickups(pickups, playerState, dt)` — process score awards.
4. Remove the test enemy spawning from Step 5 — enemies now spawn via waves.

**Depends on:** Tasks 7.1–7.3, 5.5, 6.4

**Verify:**
- `npm run dev` — wave 1 starts, enemies spawn periodically
- After combat duration, enemies clear and break phase begins
- Scraps spawn and can be collected for points

---

## Task 7.5 — Wave Tests

**Files:**
- `src/gameplay/spawning/__tests__/waves.test.ts` — create

**Steps:**
1. Port tests from `test/waves.test.js`:
   - `computeWaveTiming` — first spawn delay, spawn interval, combat duration ramp
   - `computeHordeCount` — base + wave scaling (tested even though horde not wired yet)
   - Horde trigger timing
2. New tests:
   - `startWave` increments waveIndex
   - `updateWave` in combat phase generates spawn events at correct intervals
   - `updateWave` transitions to break after combatDuration
   - Burst spawning activates wave 2+ at 8s intervals
   - `computeSpeedBonus` ramps correctly

**Depends on:** Tasks 7.1, 7.2

**Verify:** `npm test` passes, `npm run test:old` passes.

---

## Verification — Full Step 7

1. `npx tsc --noEmit` — no errors
2. `npm test` — all vitest tests pass
3. `npm run test:old` — legacy tests pass
4. `npm run dev` — waves progress, enemies spawn with correct timing
5. Break phase clears enemies, timer visible in console log
6. Scraps spawn every 6s, collectible for 10 pts
