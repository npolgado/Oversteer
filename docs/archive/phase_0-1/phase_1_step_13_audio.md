# Phase 1 — Step 13: Audio Integration

## Context

The `AudioManager` was fully ported in Phase 0 (`src/audio/audioManager.ts`). It already handles engine oscillators, drift squeal, music synthesis, and one-shot SFX. This step wires it into the gameplay via `eventBus` subscriptions and direct calls in scene lifecycle methods.

The AudioContext starts suspended until first user interaction (browser autoplay policy). This is already handled in `src/main.ts` via `onFirstInteraction`. This step connects the audio calls that `game.js` and `entities.js` made directly to `window.Audio.*`.

Audio state across scenes:
- **Menu**: no music, ui_click on input
- **MapSelect**: ui_click on map cycle, ui_click on modifier toggle
- **Gameplay (combat)**: engine starts, music starts, drift squeal when drifting
- **Gameplay (pause)**: music ducks to 30%
- **Gameplay (break)**: engine continues (player can still drive), no music change
- **Gameplay (death)**: music fades out, engine stops
- **GameOver**: silence

---

## Task 13.1 — Gameplay Scene Audio Wiring

**Files:**
- `src/scenes/gameplayScene.ts` — update

**Steps:**
1. In `enter()`:
   - `ctx.audioManager.startEngine()`
   - `ctx.audioManager.startMusic()`
2. In `update(dt, ctx)`:
   - Each frame: `ctx.audioManager.setEngineSpeed(getPlayerSpeed(playerState) / playerState.maxSpeed)`
   - If drifting and wasn't last frame: `ctx.audioManager.startDrift()`
   - If not drifting and was last frame: `ctx.audioManager.stopDrift()`
   - If drifting: `ctx.audioManager.setDriftIntensity(playerState.slipTimer > 0 ? 0.3 : 1.0)` — oil reduces drift squeal
   - Track previous `drifting` state to detect transitions
3. Subscribe to eventBus events for one-shot SFX:
   - `playerDamaged` → `ctx.audioManager.play('collision')`
   - `nearMiss` → `ctx.audioManager.play('near_miss')`
   - `encirclement` → `ctx.audioManager.play('encircle')`
   - `comboChanged` (level 3, 5, 8) → `ctx.audioManager.play('combo_sting')`
   - `waveStarted` → (no SFX in Phase 1, horde warn is Phase 3)
4. In `exit()`:
   - `ctx.audioManager.stopEngine()`
   - `ctx.audioManager.stopAll()`
5. Track listener references for cleanup.

**Depends on:** Phase 0 (audioManager), Steps 6–9 (events exist)

**Verify:** Engine sound plays during gameplay, drift squeal on drift.

---

## Task 13.2 — Pause Audio

**Files:**
- `src/scenes/gameplayScene.ts` — update

**Steps:**
1. Add `paused: boolean` state to gameplay scene.
2. Toggle on `input.pause` (edge-detected from `InputManager`).
3. When pausing:
   - `ctx.audioManager.setMusicVolume(currentMusicVol * 0.3)` (duck to 30%)
   - `ctx.audioManager.stopEngine()`
   - Halt all update logic (skip all `update()` calls below the pause check)
4. When unpausing:
   - Restore music volume
   - `ctx.audioManager.startEngine()`
   - Reset `lastTime` / game clock delta to prevent dt spike on resume (important: reset dt to 0 for first frame after unpause)
5. Display pause overlay: simple "PAUSED — P to resume" `Text` on `overlayLayer`.

**Depends on:** Task 13.1

**Verify:** Music ducks on pause, engine stops, resumes correctly.

---

## Task 13.3 — Death Audio

**Files:**
- `src/scenes/gameplayScene.ts` — update

**Steps:**
1. On `playerDied` event:
   - `ctx.audioManager.stopEngine()`
   - `ctx.audioManager.fadeOutMusic(0.5)` — fade over 0.5s
2. The death sequence (freeze → slowmo from Step 12) runs its timer, then transitions to `GameOverScene`. No additional audio triggers needed.

**Depends on:** Tasks 13.1, 12.3 (death sequence)

**Verify:** Music fades on death, engine stops.

---

## Task 13.4 — Menu / Scene Transition Audio

**Files:**
- `src/scenes/menuScene.ts` — update
- `src/scenes/mapSelectScene.ts` — update

**Steps:**
1. **MenuScene**: on Enter press → `ctx.audioManager.play('ui_click')`
2. **MapSelectScene**:
   - A/D map cycle → `ctx.audioManager.play('ui_click')`
   - 1/2/3/4 modifier toggle → `ctx.audioManager.play('ui_click')`
   - Enter confirm → `ctx.audioManager.play('ui_click')`
3. **UpgradeCardsUI** (Step 10): card selection → `ctx.audioManager.play('ui_click')`; reroll → `ctx.audioManager.play('ui_click')`

**Depends on:** Tasks 11.2, 11.3, 10.3

**Verify:** UI clicks play SFX on all interactive elements.

---

## Task 13.5 — Volume Controls on Pause

**Files:**
- `src/scenes/gameplayScene.ts` — update (pause overlay handling)

**Steps:**
1. When paused, handle additional key inputs (these match the old game's pause controls):
   - M → `ctx.audioManager.setMuted(!ctx.audioManager.muted)`
   - `[` → `ctx.audioManager.setSfxVolume(vol - 0.1)`
   - `]` → `ctx.audioManager.setSfxVolume(vol + 0.1)`
   - `-` → `ctx.audioManager.setMusicVolume(vol - 0.1)`
   - `=` → `ctx.audioManager.setMusicVolume(vol + 0.1)`
2. Display current volume levels in pause overlay text.
3. Audio preferences auto-save via `AudioManager` (already implemented using `saveManager`).

**Depends on:** Task 13.2

**Verify:** M mutes/unmutes, bracket keys adjust volumes, settings persist across page reload.

---

## Verification — Full Step 13

1. `npx tsc --noEmit` — no errors
2. `npm test` — all vitest tests pass
3. `npm run test:old` — legacy tests pass
4. `npm run dev` — full audio test:
   - Engine hum plays during gameplay, pitch follows speed
   - Drift squeal activates on handbrake/drift
   - Near-miss, collision, encircle SFX play on events
   - Music plays during gameplay, ducks on pause, fades on death
   - UI clicks play on menu interactions
   - Volume controls work in pause menu
   - Audio prefs persist across reload
5. No AudioContext suspended warnings in browser console

---

## Final Phase 1 Verification Checklist

Once all 13 steps are merged, verify the full Phase 1 acceptance criteria from the roadmap (section 1.9):

- [ ] Full flow: Menu → Map Select → Gameplay → Upgrade → Game Over
- [ ] Player drift physics feel identical to `npx serve arena-drifter`
- [ ] Trail encirclement kills Chasers and Interceptors
- [ ] Waves progress with correct timing
- [ ] Scoring works (base, near-miss, encirclement, drift combo)
- [ ] HUD shows score, HP, wave, combo, enemy count
- [ ] All 26 upgrades selectable and functional
- [ ] Props generate procedurally with collision
- [ ] Camera follows with lead + dynamic zoom
- [ ] Screen effects: shake, flash, slowmo
- [ ] Audio: engine, drift, SFX, music
- [ ] All tests pass (old + new)
- [ ] 60fps on mid-range hardware
- [ ] `npx serve arena-drifter` still works (old game untouched)
- [ ] Touch controls tested on mobile (issue #7 fix)
