# Phase 1 — Step 11: Menu + Map Select + Game Over Scenes

## Context

This step builds the full game scene flow: `MenuScene` → `MapSelectScene` → `GameplayScene` → `GameOverScene` → `MenuScene`. It ports the menu rendering and state transitions from `arena-drifter/game.js` (renderMenu, renderMapSelect, game over stats screen).

Currently, `BootScene` → `GameplayScene` directly (Phase 0 wiring). This step inserts the proper scene flow.

Key features:
- **Menu**: title text, high score, sandbox toggle (S key), "Press Enter to Play"
- **Map Select**: A/D to cycle maps, 1/2/3/4 for difficulty modifiers, Enter to confirm, Escape to go back
- **Game Over**: score, high score, wave reached, run stats (peak combo, near-miss total, drift time, kills), restart/menu options
- Difficulty modifiers stored in game session state (not saved to localStorage)

**Prerequisite:** Step 8 (scoring/run stats), Phase 0 (saveManager, sceneManager).

---

## Task 11.1 — Content Maps File

**Files:**
- `src/content/maps.ts` — create (thin wrapper, `MAPS` already in config.ts)

**Steps:**
1. Export `MAPS` re-export from `@core/config` with a typed convenience wrapper if needed.
2. Export `getDifficultyModifiers()`: returns the 4 difficulty modifier definitions:
   ```typescript
   export interface DifficultyModifier {
     id: string;
     name: string;
     desc: string;
     scoreMult: number;
     apply(cfg: typeof CFG): void;  // mutates CFG overrides
   }
   ```
   - `hard_mode`: enemy speed +100 px/s, 1.5× score
   - `speed_rush`: spawn intervals halved, 1.3× score
   - `fragile`: 50 HP max, 1.4× score
   - `double_enemies`: spawn intervals halved + burst count doubled (4), 1.6× score
3. Export `computeModifierScoreMult(activeIds: string[]): number` — multiply all active modifiers' score mults together.

**Depends on:** Phase 0 (config)

**Verify:** `npx tsc --noEmit` clean.

---

## Task 11.2 — Menu Scene

**Files:**
- `src/scenes/menuScene.ts` — create

**Steps:**
1. Create `MenuScene` implementing `Scene`:
   - `enter()`: create PixiJS `Text` for title ("OVERSTEER"), high score, controls hint ("WASD to drive • SPACE to drift • ENTER to play • S for sandbox"), optional decorative trail animation (simplified — a few moving cyan dots)
   - `update(dt, ctx)`:
     - Poll input
     - If Enter pressed: switch to `MapSelectScene`
     - If S pressed: set `sandbox = true`, switch to `MapSelectScene`
     - Animate title (gentle pulse using `Math.sin(gameClock)`)
   - `exit()`: clean up PixiJS objects
2. Display high score from `saveManager.getHighScore()`.
3. Pass `sandbox` flag and selected map to `MapSelectScene` via constructor parameter or shared game session state.
4. Update `bootScene.ts` to transition to `MenuScene` (not `GameplayScene`).

**Depends on:** Phase 0 (sceneManager, saveManager, pixiApp)

**Verify:** `npm run dev` — menu screen visible with title and high score.

---

## Task 11.3 — Map Select Scene

**Files:**
- `src/scenes/mapSelectScene.ts` — create

**Steps:**
1. Create `MapSelectScene` implementing `Scene`:
   - Constructor: accepts `{ sandbox: boolean }` options
   - `enter()`: create PixiJS `Text` for map name/description, difficulty modifier toggles, controls hint, "ENTER to Start"
   - `update(dt, ctx)`:
     - A/D: `selectedMapIndex = (selectedMapIndex ± 1 + MAPS.length) % MAPS.length`
     - 1/2/3/4: toggle difficulty modifiers (stored in local array)
     - Escape: switch back to `MenuScene`
     - Enter: apply map + modifiers, switch to `GameplayScene` passing config
   - `exit()`: clean up PixiJS objects
2. Persist selected map ID to `saveManager.setSelectedMap()` on change.
3. Display map name + description from `MAPS[selectedMapIndex]`.
4. Show active modifier count and combined score multiplier.

**Depends on:** Task 11.1, Phase 0 (saveManager)

**Verify:** `npm run dev` — A/D cycles maps, Enter starts gameplay.

---

## Task 11.4 — Game Over Scene

**Files:**
- `src/scenes/gameOverScene.ts` — create

**Steps:**
1. Define `GameOverData`:
   ```typescript
   export interface GameOverData {
     score: number;
     highScore: number;
     newBest: boolean;
     waveReached: number;
     runStats: RunStats;   // from pureLogic
     modifierMult: number;
   }
   ```
2. Create `GameOverScene` implementing `Scene`:
   - Constructor: accepts `GameOverData`
   - `enter()`: create PixiJS `Text` objects for:
     - "GAME OVER" title
     - Score (with "NEW BEST!" banner if `newBest`)
     - Wave reached
     - Run stats: peak combo, near-miss total, drift time, kills
     - Combined modifier score multiplier
     - "R: Restart" and "M: Menu" hints
   - `update(dt, ctx)`:
     - R / Enter: switch to `MapSelectScene` (restarts with same settings)
     - M / Escape: switch to `MenuScene`
   - `exit()`: clean up
3. Save high score in `GameplayScene` before transitioning here (if new best).

**Depends on:** Task 8.1 (RunStats), Phase 0 (sceneManager)

**Verify:** Game over screen shows after player dies.

---

## Task 11.5 — Wire Full Scene Flow

**Files:**
- `src/scenes/gameplayScene.ts` — update
- `src/scenes/bootScene.ts` — update

**Steps:**
1. On `playerDied` eventBus event in `gameplayScene`:
   - Implement brief death sequence: ~0.1s freeze (set `dt = 0` for a few frames), then transition
   - (Full death animation in Step 12 — for now, a short pause)
   - Save high score: `saveManager.setHighScore(scoringState.highScore)`
   - Switch to `GameOverScene` passing `GameOverData`
2. `bootScene.ts`: on load complete, switch to `MenuScene` (not `GameplayScene` directly).
3. Ensure `applyMap(selectedMapId)` is called in `GameplayScene.enter()` before initializing game state.
4. Ensure difficulty modifier CFG overrides are applied in `GameplayScene.enter()`.

**Depends on:** Tasks 11.1–11.4, Steps 7–8, Phase 0

**Verify:**
- `npm run dev` — full scene flow works: Menu → MapSelect → Gameplay → GameOver → Menu
- Map selection persists across page refresh

---

## Verification — Full Step 11

1. `npx tsc --noEmit` — no errors
2. `npm test` — all vitest tests pass
3. `npm run test:old` — legacy tests pass
4. `npm run dev` — full flow playable: Menu → Map Select → Gameplay → Upgrades → Game Over → Menu
5. High score saves and loads correctly
6. Map selection persists
7. Difficulty modifiers apply (enemies faster in Hard Mode)
