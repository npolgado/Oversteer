# Phase 1 — Step 1: Physics + Pure Logic Functions

## Context

Phase 0 delivered `src/core/config.ts`, `src/core/utils.ts`, and `src/core/rng.ts`. About 30 pure functions from `arena-drifter/logic.js` remain un-ported (scoring, combat, wave timing, pickup selection, enemy pool logic, etc.). The physics engine (`arena-drifter/physics.js`) is 109 lines and is the shared update function for both player and enemies — it must be ported before either can move.

This step creates the full pure-logic foundation that all subsequent gameplay steps build on.

---

## Task 1.1 — Port `updatePhysics()`

**Files:**
- `src/gameplay/physics.ts` — create

**Steps:**
1. Port `updatePhysics(ent, dt, turnInput, throttle, braking, wantDrift, isPlayer)` from `arena-drifter/physics.js` verbatim, with these changes:
   - Replace all `window.OversteerLogic.CFG` / `window.CFG` references with `import { CFG } from '@core/config'`
   - Replace all `U.*` calls with `import { lerp, clamp, angleDiff } from '@core/utils'` (or whichever helpers are used)
   - Replace `performance.now()` (used for drift chain timing) with a `gameClock: number` parameter added to the function signature. The entity's `lastDriftEndTime` is stored in game-clock seconds, not wall-clock ms.
   - Keep the exact numeric constants: lateral friction 8.5/3.2, forward drag 1.7/2.1, handbrake decel 1800 px/s², turn rate reduction factor, bounce retain, all else verbatim
2. Define the `PhysicsEntity` interface that `updatePhysics` accepts — a structural duck type covering all fields the function reads/writes:
   ```typescript
   export interface PhysicsEntity {
     x: number; y: number; vx: number; vy: number; heading: number;
     drifting: boolean; driftJustStarted: boolean; maxSpeed: number; turnRate: number;
     driftKing: boolean; afterburner: boolean; nitroDrift: boolean;
     lastDriftEndTime: number; driftChain: number;
     slipTimer: number; slipStrength: number; slowTimer: number; slowStrength: number;
     wallHit: boolean;
   }
   ```
3. Export `updatePhysics` as a named export.

**Depends on:** Phase 0 (config, utils)

**Verify:** `npx tsc --noEmit` clean. Import resolves.

---

## Task 1.2 — Port Remaining Pure Functions from `logic.js`

**Files:**
- `src/gameplay/pureLogic.ts` — create (groups all remaining pure functions)
- `src/logic/index.ts` — update re-exports

**Steps:**

Port the following functions from `arena-drifter/logic.js`, replacing `window.OversteerLogic.CFG` with `import { CFG }` and `U.*` with individual util imports. Keep logic identical:

**Pickup / scrap:**
- `selectPickupType(waveIndex, roll)` → returns `'bomb' | 'trail_boost' | 'speed_pickup' | 'scrap'`
- `collectPickupEvents(scraps, boostZones, player, dt)` — mutates arrays, returns events array
- `updateScraps(scraps, player, dt, trailPoints)` — mutates scraps, returns pickup events
- `updateBoostZones(boostZones, player, dt)` — mutates array, returns events

**Wave timing:**
- `computeWaveTiming(waveIndex)` → `{ firstSpawn, spawnInterval, combatDuration, noBursts }`
- `computeHordeCount(waveIndex)` → number
- `rollHordeTrigger(rng)` → float
- `shouldTriggerHorde(waveTimer, combatDuration, hordeTrigger)` → bool

**Enemy pool:**
- `getEnemyPool(score)` → array of enemy type strings
- `shouldSpawnElite(waveIndex, roll)` → bool
- `computeFlankTarget(px, py, pvx, pvy, flankSide)` → `{ x, y }`
- `computeBlockerTarget(trailPoints)` → `{ x, y } | null`

**Scoring / combat:**
- `applyNearMiss(score, player, type)` → `{ score, comboLevel, consecutiveNearMisses }`
- `updateNearMissStreak(player, dt)` — mutates player
- `applyComboDecay(comboLevel, comboMaster, dt)` → new combo level
- `driftComboScoreTick(driftTime, lastDriftComboTick, comboLevel)` → `{ scoreDelta, nextTick }`
- `computeCollisionDamage(baseDmg, waveIndex)` → damage
- `applyPlayerDamage(player, dmg, drifting)` → final damage (mutates player)
- `applyShieldBreak(player)` — mutates player
- `applyHpRegen(player, dt)` — mutates player
- `applyGhostFrameNearMiss(player, hasGhostFrame)` — mutates player
- `computeEncircleOutcome(killCount, comboLevel, scoreMult, encircleScoreBonus)` → `{ scoreDelta, comboLevel }`
- `applyDriftShield(dmg, drifting, hasDriftShield)` → modified damage
- `applyComboHeal(oldLevel, newLevel, hasComboHeal, hp, maxHp)` → new hp
- `applyBombZoneDamage(dmg, dt, damageResist)` → damage

**Stats:**
- `makeRunStats()` → fresh stats object
- `updateRunStats(stats, event)` — mutates stats

**Geometry:**
- `pointInPoly(x, y, poly)` → bool (ray-casting, already in logic.js)

**Modifiers:**
- `computeModifierScoreMult(modifiers)` → multiplier

**Hit testing:**
- `hitTestUpgradeTap(tap, cardBounds, rerollBounds)` — pure hit test

Add typed interfaces for any complex parameter shapes (e.g., `ScrapPickup`, `BoostZone`, `RunStats`, `NearMissResult`, `EncircleResult`).

Update `src/logic/index.ts` to re-export everything from `pureLogic.ts`.

**Depends on:** Task 1.1

**Verify:** `npx tsc --noEmit` clean.

---

## Task 1.3 — Port Pure Function Tests

**Files:**
- `src/gameplay/__tests__/physics.test.ts` — create
- `src/gameplay/__tests__/pureLogic.test.ts` — create

**Steps:**
1. Write vitest tests for `updatePhysics`:
   - Accelerating from rest increases speed
   - Braking decreases speed
   - Drift activates when speed >= threshold and wantDrift is true
   - Arena boundary clamp: entity clamped to world bounds
   - Drift chain: second drift within 0.5s (in game-clock) sets `driftChain = 1`
2. Port the old Node test suite to vitest, importing from `src/gameplay/pureLogic.ts` instead of `arena-drifter/logic.js`:
   - Pickup type selection, wave timing, horde count/trigger, near-miss scoring, combo mechanics, damage pipeline, encirclement outcomes, modifier score multiplier, enemy pool, elite spawning, flanker/blocker targets, run stats
   - Keep all existing assertions — they document expected behavior
   - New tests can import from `@gameplay/pureLogic` instead of relative `../arena-drifter/logic`
3. Ensure `npm run test:old` still passes unchanged (old tests import from `arena-drifter/logic.js` directly).

**Depends on:** Tasks 1.1, 1.2

**Verify:**
- `npm test` — all vitest tests pass (new + existing `src/core/__tests__/`)
- `npm run test:old` — legacy node tests pass
- `npx tsc --noEmit` — clean

---

## Verification — Full Step 1

1. `npx tsc --noEmit` — no errors
2. `npm test` — all vitest tests pass
3. `npm run test:old` — legacy node tests pass
4. `updatePhysics` is importable via `import { updatePhysics } from '@gameplay/physics'`
5. All pure logic functions importable via `import { ... } from '@gameplay/pureLogic'`
6. `npx serve arena-drifter` — old game unaffected
