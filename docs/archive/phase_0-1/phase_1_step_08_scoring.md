# Phase 1 — Step 8: Scoring + Combo System

## Context

Scoring is largely implemented as pure functions in `pureLogic.ts` (from Step 1). This step wires them into the `gameplayScene` and manages the mutable game-state fields: `score`, `comboLevel`, `lastDriftComboTick`, `driftTime`, run stats.

Sources of score:
- **Base**: 4 pts/sec during gameplay (`CFG.SCORE_PER_SEC`, modified by `score_freak` upgrade)
- **Near-miss enemy**: 25 pts (while drifting, within 8px additive to collision radius)
- **Near-miss hazard**: 15 pts (props near-miss)
- **Near-miss streak**: 50 × streak bonus at 3+ consecutive within 2s
- **Scrap pickup**: 10 pts + 35% chance combo boost
- **Encirclement**: base + bonus scaled by combo level
- **Drift combo tick**: bonus pts for sustained drift at high combo

Combo decays over time; combo_master upgrade slows decay by 50%.

**Prerequisite:** Step 6 (collision wired), Step 7 (waves + pickups wired).

---

## Task 8.1 — Scoring State

**Files:**
- `src/gameplay/scoring.ts` — create

**Steps:**
1. Define `ScoringState`:
   ```typescript
   export interface ScoringState {
     score: number;
     highScore: number;
     comboLevel: number;
     lastDriftComboTick: number;   // game-clock time of last drift combo tick
     runStats: RunStats;            // from pureLogic
   }
   ```
2. Export `makeScoringState(highScore: number): ScoringState` — initialize all to 0, load `highScore` from parameter.
3. Export `updateScoring(state: ScoringState, player: PlayerState, dt: number, gameClock: number): ScoringEvent[]`:
   ```typescript
   export interface ScoringEvent {
     type: 'score_change' | 'combo_change' | 'new_high_score';
     delta?: number;
     newScore?: number;
     newComboLevel?: number;
   }
   ```
   - Add base score: `state.score += CFG.SCORE_PER_SEC * player.scoreMult * dt`
   - Drift combo tick: call `driftComboScoreTick(player.driftTime, state.lastDriftComboTick, state.comboLevel)` — if `scoreDelta > 0`, add to score, update tick time
   - Combo decay: `state.comboLevel = applyComboDecay(state.comboLevel, player.comboMaster, dt)`
   - Check new high score: if `state.score > state.highScore`, push `new_high_score` event
   - Return events

4. Export `applyScoreAward(state: ScoringState, delta: number): void` — simple add + high score check.
5. Export `applyComboChange(state: ScoringState, newLevel: number): void` — update combo level, emit if changed.

**Depends on:** Step 1 (pureLogic), Step 2 (PlayerState)

**Verify:** `npx tsc --noEmit` clean.

---

## Task 8.2 — Wire Scoring into GameplayScene

**Files:**
- `src/scenes/gameplayScene.ts` — update

**Steps:**
1. Add `scoringState: ScoringState` to scene state (replaces ad-hoc `score` variable).
2. In `enter()`: `scoringState = makeScoringState(saveManager.getHighScore())`.
3. In `update(dt)`:
   - Call `updateScoring(scoringState, playerState, dt, gameClock)` — base score + drift combo + combo decay
   - Process scoring events: emit `eventBus.emit('scoreChanged', { score: scoringState.score, delta })` and `eventBus.emit('comboChanged', { level: scoringState.comboLevel })`
   - Near-miss awards (from collision step 6): instead of direct `score +=`, call `applyScoreAward(scoringState, nmResult.scoreDelta)`; update combo via `applyComboChange(scoringState, nmResult.newComboLevel)`
   - Encirclement awards (from trail loop result): call `computeEncircleOutcome(killCount, scoringState.comboLevel, playerState.scoreMult, playerState.encircleScoreBonus)`, then `applyScoreAward` + `applyComboChange`
   - Scrap collection: `applyScoreAward(scoringState, 10)`; if comboBoost, `applyComboChange(scoringState, scoringState.comboLevel + 1)`
4. In `exit()`: save high score `saveManager.setHighScore(scoringState.highScore)`.
5. Update `runStats` via `updateRunStats` for: `peakCombo`, `nearMissTotal`, `totalDriftTime`, `enemiesKilled` (used in Game Over screen, Step 11).

**Depends on:** Task 8.1, Steps 6, 7

**Verify:**
- `npm run dev` — score increases over time
- Near-misses and kills add points visible in console log
- Combo builds during drift, decays when not drifting

---

## Task 8.3 — Scoring Tests

**Files:**
- `src/gameplay/__tests__/scoring.test.ts` — create (if not already created in Step 1)

**Steps:**
1. These tests likely already exist as part of the Step 1 pure logic port. If not:
   - Port `test/scoring.test.js` tests to vitest
2. New integration tests for `updateScoring`:
   - Base score increases by `SCORE_PER_SEC * dt` over time
   - Drift combo tick awards score at correct intervals
   - Combo decays to 0 over time without drift
   - `score_freak` upgrade (`player.scoreMult = 1.5`) increases base score rate

**Depends on:** Task 8.1

**Verify:** `npm test` passes, `npm run test:old` passes.

---

## Verification — Full Step 8

1. `npx tsc --noEmit` — no errors
2. `npm test` — all vitest tests pass
3. `npm run test:old` — legacy tests pass
4. `npm run dev` — score visible in console, increases over time, near-misses add pts
5. Combo level builds and decays correctly
6. High score persists across page refresh (localStorage)
