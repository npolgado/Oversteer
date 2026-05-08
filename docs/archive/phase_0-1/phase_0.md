# Phase 0 — Technical Foundation

## Context

Oversteer is a vanilla JS/Canvas 2D game in `arena-drifter/` (9 scripts, window.* globals, no build system). Phase 0 creates a new `src/` project alongside it with PixiJS v8 + TypeScript + Vite — no gameplay yet, just a bootable scaffold with rendering, input, audio, camera, and scene management. The old game stays untouched and runnable.

---

## Task 0.1 — Project Scaffold & Build Config

**Files:**
- `package.json` — create with Vite + TS + PixiJS + Howler deps
- `tsconfig.json` — strict mode, path aliases (@core/*, @render/*, etc.)
- `vite.config.ts` — dev server, path alias resolution, asset handling
- `index.html` — root-level Vite entry with `<canvas>` and `<script type="module" src="/src/main.ts">`
- `.gitignore` — add `node_modules/`, `dist/`

**Steps:**
1. Create `package.json` with:
   - devDeps: `typescript ^5.4`, `vite ^5.4`, `vitest ^1.0`
   - deps: `pixi.js ^8.0`, `howler ^2.2`
   - scripts: `dev`, `build`, `preview`, `test`
2. Create `tsconfig.json` — target ES2022, module ESNext, moduleResolution bundler, strict true, path aliases for `@core/*`, `@render/*`, `@gameplay/*`, `@scenes/*`, `@ui/*`, `@audio/*`, `@input/*`
3. Create `vite.config.ts` — resolve aliases matching tsconfig paths, publicDir pointing to `src/assets`
4. Create root `index.html` — minimal HTML with `<div id="game">` container, module script entry
5. Update `.gitignore` — add `node_modules/`, `dist/`
6. Run `npm install`

**Depends on:** none

**Verify:** `npm run dev` starts without errors (blank page is fine)

---

## Task 0.2 — Core Config & Utils

**Files:**
- `src/core/config.ts` — typed CFG object, frozen
- `src/core/utils.ts` — math helpers from U (no canvas drawing helpers)
- `src/core/rng.ts` — makeRng, randFloat from logic.js

**Steps:**
1. Port `CFG` from `arena-drifter/logic.js` lines 3-171 into a typed, `Object.freeze()`-d export. Use `as const` where appropriate. Include `CFG_BASE` snapshot pattern and `applyMap()`.
2. Port math utilities from `U` (lines 203-298): `lerp`, `clamp`, `randInt`, `randFloat`, `randChoice`, `randSample`, `approach`, `normalizeAngle`, `angleLerp`, `angleDiff`, `vec2FromAngle`, `dist`. Skip canvas drawing helpers (`drawRotatedRect`, `roundRect`, `text`, `wrapText`) — PixiJS replaces those.
3. Port `makeRng` and `randFloat` from logic.js exported functions into `rng.ts`.

**Depends on:** Task 0.1

**Verify:** `import { CFG } from '@core/config'` resolves. Write a quick vitest smoke test that asserts `CFG.W === 1600`.

---

## Task 0.3 — EventBus & SaveManager

**Files:**
- `src/core/eventBus.ts` — typed pub/sub
- `src/core/saveManager.ts` — localStorage wrapper

**Steps:**
1. Create `EventBus` class with typed event map (`GameEvents`). Methods: `on(event, handler)`, `off(event, handler)`, `emit(event, data)`. Start with a minimal event map — expand as Phase 1 needs arise:
   ```typescript
   type GameEvents = {
     enemyKilled: { x: number; y: number; type: string };
     nearMiss: { x: number; y: number };
     spawnParticles: { x: number; y: number; type: string; count: number };
   };
   ```
2. Create `SaveManager` wrapping localStorage for keys: `oversteer_highscore_v1`, `oversteer_map_v1`, `oversteer_audio_v1`. Typed get/set methods.

**Depends on:** Task 0.1

**Verify:** Unit test — emit event, listener receives correct typed data.

---

## Task 0.4 — PixiJS Application & Layer Setup

**Files:**
- `src/render/pixiApp.ts` — PixiJS Application init, resize handler, layer containers
- `src/main.ts` — entry point, creates app, boots game

**Steps:**
1. Create `pixiApp.ts`:
   - Init PixiJS `Application` at 1600x900
   - Responsive resize using same letterbox logic as current `index.html` (fit to viewport, maintain aspect ratio)
   - Create layer containers per roadmap spec:
     ```
     stage
       worldContainer (backgroundLayer, propsLayer, trailLayer, pickupsLayer, enemiesLayer, playerLayer, particlesLayer)
       uiContainer (hudLayer, eventLogLayer, overlayLayer)
       screenFxContainer
     ```
   - Export `PixiApp` object with `init()`, container refs, and `resize()` method
2. Create `main.ts`:
   - Import and init PixiApp
   - Append canvas to `#game` div
   - Start PixiJS ticker

**Depends on:** Task 0.1

**Verify:** `npm run dev` shows PixiJS canvas at 1600x900, resizes correctly with browser window.

---

## Task 0.5 — Camera

**Files:**
- `src/render/camera.ts` — camera system using container transforms

**Steps:**
1. Port camera logic from `arena-drifter/fx.js` lines 393-435. Same lead/lerp/clamp/zoom math.
2. Instead of `ctx.translate()`, set `worldContainer.position` and `worldContainer.scale` each frame.
3. Methods: `update(dt, px, py, pvx, pvy, pSpeed)`, `isVisible(wx, wy, margin)`, `reset(px, py)`.
4. Camera takes a reference to `worldContainer` (from pixiApp) in its constructor/init.

**Depends on:** Task 0.4

**Verify:** Camera updates worldContainer transform when called with test values (unit test).

---

## Task 0.6 — Input Manager

**Files:**
- `src/input/inputManager.ts` — keyboard + touch + gamepad stub

**Steps:**
1. Define `InputAction` enum: `ACCELERATE`, `BRAKE`, `STEER_LEFT`, `STEER_RIGHT`, `DRIFT`, `PAUSE`, `CONFIRM`, `REROLL`.
2. Port keyboard handling from `arena-drifter/input.js` lines 47-177. Map key codes to InputActions with configurable bindings.
3. Port touch handling (virtual joystick left side, drift button right side, two-finger pause).
4. Add gamepad polling stub — `pollGamepad()` method that reads `navigator.getGamepads()` but doesn't process yet (returns early). This satisfies issue #9's Phase 0 requirement.
5. `poll()` method returns an `InputState` object with boolean flags for each action + edge-detected triggers for pause/confirm/reroll.

**Depends on:** Task 0.1

**Verify:** `npm run dev` — press WASD keys, confirm InputManager reports correct actions via console.log in main.ts.

---

## Task 0.7 — Audio Manager

**Files:**
- `src/audio/audioManager.ts` — port of audio.js

**Steps:**
1. Port `audio.js` nearly verbatim. Rename `Audio` -> `AudioManager` to avoid shadowing browser's `Audio` constructor.
2. Replace CDN Howler with npm `howler` import.
3. Keep all three subsystems: Howler one-shots (procedural WAV blob synthesis), Web Audio engine oscillator, Web Audio drift/music oscillators.
4. Keep localStorage persistence for volume/mute prefs via SaveManager.
5. Export singleton `audioManager` instance.

**Depends on:** Task 0.3 (SaveManager)

**Verify:** `npm run dev` — first keypress resumes AudioContext (check console), engine sound plays on manual trigger.

---

## Task 0.8 — Scene Manager & Boot Scene

**Files:**
- `src/scenes/sceneManager.ts` — scene lifecycle
- `src/scenes/bootScene.ts` — asset loading with progress bar

**Steps:**
1. Create `Scene` interface: `enter()`, `update(dt: number, context: GameContext)`, `exit()`. GameContext holds refs to shared systems (audioManager, inputManager, camera, pixiApp containers).
2. Create `SceneManager`: holds current scene, `switchTo(scene)` calls `exit()` on old + `enter()` on new. `update(dt)` delegates to current scene.
3. Create `BootScene`:
   - Uses PixiJS v8 `Assets` API to load all sprites (player, enemies, props, backgrounds) with progress callback
   - Renders a simple progress bar during load
   - On complete, transitions to a placeholder "ready" state (no gameplay scenes yet in Phase 0)
4. Wire SceneManager into main.ts ticker loop.

**Depends on:** Tasks 0.4, 0.6, 0.7

**Verify:** `npm run dev` shows progress bar, then transitions to ready state after assets load.

---

## Task 0.9 — Copy Assets

**Files:**
- `src/assets/` — copy of `arena-drifter/assets/`

**Steps:**
1. Copy `arena-drifter/assets/` to `src/assets/` (backgrounds, cars, props subdirs).
2. Configure Vite `publicDir` to serve `src/assets` as `/assets/` or use import-based asset loading.
3. Ensure both the old game (`npx serve arena-drifter`) and new game (`npm run dev`) can access their respective assets.

**Depends on:** Task 0.1

**Verify:** Background image loads in BootScene. Old game still loads assets via `npx serve arena-drifter`.

---

## Task 0.10 — Logic Re-exports & Test Setup

**Files:**
- `src/logic/index.ts` — re-export pure functions for testing
- `vitest.config.ts` or vitest section in `vite.config.ts`
- One new test file (e.g., `src/core/__tests__/config.test.ts`)

**Steps:**
1. Create `src/logic/index.ts` that re-exports pure functions from `@core/config`, `@core/utils`, `@core/rng`.
2. Configure vitest (can be in vite.config.ts or separate vitest.config.ts).
3. Write a smoke test: import CFG, assert `CFG.W === 1600`, `CFG.H === 900`.
4. Verify old tests still run: `node --test test/` must pass unchanged.

**Depends on:** Task 0.2

**Verify:** `npm test` runs vitest and passes. `node --test test/` still passes.

---

## Task 0.11 — Hello Pixi Integration Test

**Files:**
- `src/scenes/playgroundScene.ts` — temporary scene for Phase 0 verification

**Steps:**
1. Create a `PlaygroundScene` that:
   - Loads background image onto backgroundLayer
   - Creates a cyan rectangle (PixiJS Graphics) on playerLayer as player placeholder
   - Reads InputManager each frame, moves rectangle with WASD
   - Updates Camera to follow the rectangle
   - Resumes AudioContext on first keypress
2. Wire BootScene to transition to PlaygroundScene after asset load.
3. Test the full verification checklist from the roadmap.

**Depends on:** Tasks 0.5, 0.8, 0.9

**Verify (full Phase 0 checklist):**
- `npm run dev` starts Vite, shows PixiJS canvas at 1600x900
- Canvas resizes correctly with browser window
- Background image loads via PixiJS Assets
- Cyan rectangle moves with WASD, camera follows
- Audio context resumes on first keypress
- `npm test` runs old test suite AND new TS smoke test
- `npx serve arena-drifter` still works (old code untouched)

---

## Verification — Full Phase 0

1. `npm run dev` — PixiJS canvas renders at 1600x900, resizes with viewport
2. Background loads, cyan rectangle moves with WASD, camera follows smoothly
3. First keypress resumes AudioContext (no console errors)
4. `npm test` — vitest passes (config smoke test)
5. `node --test test/` — old test suite passes
6. `npx serve arena-drifter` — original game plays correctly
7. No TypeScript errors: `npx tsc --noEmit` clean
