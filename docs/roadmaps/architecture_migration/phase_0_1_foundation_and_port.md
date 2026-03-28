# Phase 0-1: Technical Foundation + Core Gameplay Port

## Overview

Migrate Oversteer from vanilla JS / Canvas 2D to PixiJS v8 + TypeScript + Vite. Phase 0 sets up the new project scaffold. Phase 1 ports all core gameplay into the new stack. The existing `arena-drifter/` stays runnable as a reference throughout.

---

## Phase 0 — Technical Foundation

### Goal
Bootable project with PixiJS rendering, input handling, audio, and scene management. No gameplay yet.

### 0.1 Project Setup

New `src/` directory alongside existing `arena-drifter/`.

```
package.json              # Vite + TS + PixiJS + Howler
tsconfig.json             # strict, path aliases (@core/*, @gameplay/*, etc.)
vite.config.ts            # dev server, asset handling
index.html                # Vite entry (root-level)
src/
  main.ts                 # Entry: creates PixiApp, boots game
  core/
    config.ts             # CFG from logic.js, typed + frozen
    utils.ts              # U helpers from logic.js, typed
    rng.ts                # makeRng, randFloat from logic.js
    eventBus.ts           # Typed pub/sub replacing window.* globals
    saveManager.ts        # localStorage wrapper (scores, prefs, map)
  render/
    pixiApp.ts            # PixiJS Application, resize, layer setup
    camera.ts             # Camera (lead/lerp/clamp/zoom) via container transforms
  audio/
    audioManager.ts       # Port audio.js verbatim (Howler npm + Web Audio oscillators)
  input/
    inputManager.ts       # Keyboard + touch from input.js, gamepad stub
  scenes/
    sceneManager.ts       # Scene lifecycle: enter/update/render/exit
    bootScene.ts          # Asset loading with progress bar
  logic/
    index.ts              # Re-export pure functions for testing
  assets/                 # Copy from arena-drifter/assets/
```

**Dependencies:**
```json
{
  "devDependencies": {
    "typescript": "^5.4",
    "vite": "^5.4",
    "vitest": "^1.0"
  },
  "dependencies": {
    "pixi.js": "^8.0",
    "howler": "^2.2"
  }
}
```

GSAP and Three.js are NOT added in this phase.

### 0.2 Key Architecture Decisions

#### Replacing `window.*` globals

The current codebase uses `window.*` as a service locator resolved at call-time. The new architecture replaces this with:

- **Direct imports** for pure data/functions (config, utils, physics)
- **Typed EventBus** for cross-system communication (`emit('enemyKilled', data)`)
- **GameContext object** passed into scene update, holding refs to shared systems (audio, input, camera)

EventBus in `src/core/eventBus.ts`:
```typescript
type GameEvents = {
  enemyKilled: { x: number; y: number; type: string };
  nearMiss: { x: number; y: number; enemy: EnemyState };
  spawnParticles: { x: number; y: number; type: string; count: number };
  // ...
};
```

Gameplay logic emits events. Rendering and audio layers subscribe. This decouples game logic from presentation and makes logic testable without mocking renderers.

#### PixiJS layer structure (back-to-front)

```
stage
  worldContainer          # Moved by camera
    backgroundLayer
    propsLayer
    trailLayer
    pickupsLayer
    enemiesLayer
    playerLayer
    particlesLayer
  uiContainer             # Screen-fixed
    hudLayer
    eventLogLayer
    overlayLayer          # Upgrades, pause, game over
  screenFxContainer       # Vignette, flash, speed lines
```

#### Camera

Set `worldContainer.position` and `worldContainer.scale` each frame instead of `ctx.translate()`. Same lead/lerp/clamp/zoom logic from `fx.js Camera`, different application mechanism.

#### Asset pipeline

PixiJS v8 `Assets` API replaces the manual `Assets.load()` / `drawOrFallback()` system. GPU-uploaded textures, mipmapping, loading progress bar in boot scene. No more `img._loaded` checks.

Car sprites pointing UP with +90 degree rotation: `sprite.rotation = entity.heading + Math.PI/2`.

#### Input abstraction

Port keyboard/touch logic from `input.js`, typed. Add `InputAction` enum (`ACCELERATE`, `BRAKE`, `STEER_LEFT`, `STEER_RIGHT`, `DRIFT`, `PAUSE`, `CONFIRM`, `REROLL`) with configurable bindings and a gamepad polling stub for issue #9.

#### Audio migration

Port `audio.js` nearly verbatim. Install Howler via npm instead of CDN. Web Audio oscillators stay (procedural engine/drift/music synthesis). Rename `Audio` -> `AudioManager` to avoid shadowing the browser's `Audio` constructor.

### 0.3 TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "paths": {
      "@core/*": ["src/core/*"],
      "@render/*": ["src/render/*"],
      "@gameplay/*": ["src/gameplay/*"],
      "@scenes/*": ["src/scenes/*"],
      "@ui/*": ["src/ui/*"],
      "@audio/*": ["src/audio/*"],
      "@input/*": ["src/input/*"]
    }
  }
}
```

### 0.4 Verification — "Hello Pixi"

- [ ] `npm run dev` starts Vite, shows PixiJS canvas at 1600x900
- [ ] Canvas resizes correctly (same scaling logic as current index.html)
- [ ] Background image loads via PixiJS Assets
- [ ] Cyan rectangle (player placeholder) moves with WASD, camera follows
- [ ] Audio context resumes on first keypress
- [ ] `npm test` runs old test suite AND a new TS smoke test
- [ ] `npx serve arena-drifter` still works (old code untouched)

---

## Phase 1 — Core Gameplay Port

### Goal
Playable game from menu through gameplay to game over. One map, 2 enemy types, all 26 upgrades, basic wave progression, scoring, and HUD.

### 1.1 Module Migration Map

| Old File (lines) | What Ports | New Location | Strategy |
|---|---|---|---|
| `logic.js` (675) | CFG, U, pure functions | `core/config.ts`, `core/utils.ts`, `logic/index.ts` | Direct port with types. Already pure + tested |
| `physics.js` (109) | `updatePhysics()` | `gameplay/physics.ts` | Direct port — pure function, zero DOM |
| `entities.js` (704) | Player, Enemy | `gameplay/player/`, `gameplay/enemies/` | **Split** into state + update + renderer |
| `world.js` (557) | Props, Trail | `gameplay/world/`, `gameplay/trail/` | Logic ports directly, rendering becomes PixiJS |
| `waves.js` (621) | Waves, ARENA_UPGRADES | `gameplay/spawning/`, `gameplay/upgrades/` | Port state machine + definitions |
| `audio.js` (285) | AudioManager | `audio/audioManager.ts` | Near-verbatim port |
| `input.js` (181) | Input, ~~Assets~~ | `input/inputManager.ts` | Port input, drop Assets (PixiJS replaces it) |
| `fx.js` (493) | Camera, Particles, ScreenFX, EventLog, PerfMon | `render/`, `ui/hud/` | FXCache eliminated (PixiJS handles GPU caching natively) |
| `game.js` (1773) | State machine, HUD, menus, collision, scoring | **Decomposed** into scenes + systems | Highest risk — port one state at a time |

### 1.2 The State/Render Split Pattern

Current code mixes data, logic, and Canvas2D rendering in each class. New pattern:

```
PlayerState     — plain typed object (position, velocity, heading, hp, upgrades...)
playerUpdate()  — pure logic function (takes state + dt + input, mutates state)
PlayerRenderer  — PixiJS Container/Sprite (reads state, updates display objects)
```

Same split for Enemy, Trail, Props. Game logic stays testable without a renderer. Future renderer swaps (e.g., adding Three.js) don't touch game logic.

### 1.3 New File Structure (Phase 1)

```
src/
  gameplay/
    physics.ts              # updatePhysics() — shared player + enemy physics
    player/
      playerState.ts         # Player data (plain typed object)
      playerUpdate.ts        # Player update logic
      playerRenderer.ts      # PixiJS sprite/container
    enemies/
      enemyState.ts          # Enemy data
      enemyUpdate.ts         # Enemy AI + update (Chaser + Interceptor only)
      enemyRenderer.ts       # PixiJS sprite/container
      enemyDeathFx.ts        # Death effects per type
    combat/
      collision.ts           # Player-enemy collision detection
      damage.ts              # Damage pipeline
      nearMiss.ts            # Near-miss detection + scoring
    trail/
      trailState.ts          # Ring buffer data
      trailUpdate.ts         # Trail recording + loop detection
      trailRenderer.ts       # PixiJS Graphics
    upgrades/
      upgradeRegistry.ts     # All 26 ARENA_UPGRADES definitions, typed
      upgradeSystem.ts       # Offer generation, apply, reroll
    spawning/
      waveManager.ts         # Wave state machine (combat/break phases)
      pickups.ts             # Scrap spawning + collection (basic only)
    world/
      propsSystem.ts         # Chunk-based procedural scatter + collision
      propsRenderer.ts       # PixiJS sprites for props
  scenes/
    menuScene.ts             # Title, high score, sandbox toggle
    mapSelectScene.ts        # Map cycling, difficulty modifiers
    gameplayScene.ts         # Orchestrates all gameplay systems
    upgradeScene.ts          # Overlay: upgrade card selection
    gameOverScene.ts         # Stats, restart
  ui/
    hud/
      hudManager.ts          # Score, HP, combo, wave timer, enemy count
      eventLog.ts            # Screen-anchored event log
    menus/
      upgradeCards.ts         # Upgrade card UI components
  render/
    particles.ts             # Particle system (shard, smoke, ring, spark)
    screenFx.ts              # Slowmo, zoom, shake, flash, freeze
  content/
    maps.ts                  # MAPS definitions
```

### 1.4 Decomposing `game.js`

`game.js` is 1,773 lines handling state machine, update logic, collision, FX orchestration, scoring, and all UI/HUD rendering. This is the highest-risk migration.

| Current State | New Home | Contains |
|---|---|---|
| MENU | `scenes/menuScene.ts` | Title, high score display, sandbox toggle |
| MAP_SELECT | `scenes/mapSelectScene.ts` | Map cycling, difficulty modifiers, confirm |
| PLAYING | `scenes/gameplayScene.ts` | Orchestrates all gameplay systems |
| PAUSED | Overlay in gameplayScene | Pause UI, volume controls |
| UPGRADE | Overlay in gameplayScene | Card display, reroll, countdown |
| DYING | Sub-state of gameplayScene | Death freeze + slowmo sequence |
| GAME_OVER | `scenes/gameOverScene.ts` | Stats display, restart |

Pause and Upgrade are overlays (not separate scenes) because the game world remains visible behind them.

### 1.5 Porting Order

Execute in this sequence — each step builds on the previous and can be tested incrementally:

1. **Config + Utils + Physics** — foundation, testable immediately
2. **Player state + update + renderer** — car drives around the arena
3. **Trail state + update + renderer** — core mechanic visible
4. **Props system** — arena feels populated
5. **Enemy state + update + renderer** (Chaser + Interceptor only)
6. **Collision + damage + near-miss** — gameplay loop closes
7. **Wave manager** (combat/break phases, single + burst spawns, no horde yet)
8. **Scoring + combo** — already mostly in logic.js, wire up
9. **HUD** — PixiJS Text for score, HP, wave, combo
10. **Upgrade system** — all 26 definitions + selection UI overlay
11. **Menu + Map Select + Game Over scenes** — full flow
12. **Screen effects** — shake, flash, slowmo, zoom
13. **Audio integration** — engine hum, drift, SFX, music

### 1.6 Phase 1 Scope Boundaries

**Included:**
- All 26 upgrades (definitions + apply logic)
- 2 enemy types (Chaser, Interceptor)
- Scrap pickups only
- Single + burst spawning
- One map (City Boys)

**Deferred to Phase 3:**
- 5 remaining enemy types (Drifter, Blocker, Flanker, Bomber, Elite)
- Bomber hazard zones
- Horde events
- Trail_boost, speed_pickup, bomb pickups
- Boost zones
- Difficulty modifiers
- Second map (Loopy)

### 1.7 Test Strategy

- Keep `arena-drifter/logic.js` and old Node tests working during migration
- `src/logic/index.ts` re-exports typed pure functions
- Add `vitest` — runs TypeScript natively via Vite
- Port existing test files incrementally to vitest + TypeScript
- New tests for decomposed systems (e.g., trail loop detection returns `LoopResult` instead of directly mutating score)

### 1.8 Critical Details

- **Drift feel preservation**: Port `updatePhysics()` exactly. Compare side-by-side with the original. The physics values (friction 8.5/3.2, drag 1.7/2.1, handbrake decel 1800 px/s^2) must be identical.
- **Game clock**: Replace `performance.now() / 1000` timestamps (used for drift chaining) with a game-clock value passed into update functions. Avoids coupling to wall clock.
- **Player constructor discipline**: Initialize all 40+ fields explicitly in a factory function (per CLAUDE.md coding convention).
- **`_resetTiming` pattern**: PixiJS ticker's `deltaMS` handles frame gaps, but still cap dt at 0.05s as the current code does.

### 1.9 Verification — "Playable Port"

- [ ] Full flow: Menu -> Map Select -> Gameplay -> Upgrade -> Game Over
- [ ] Player drift physics feel identical to original
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

---

## Risks + Mitigations

| Risk | Mitigation |
|---|---|
| **Trail rendering perf** — 400+ segments/frame in PixiJS Graphics | Use Mesh with custom geometry buffer if Graphics rebuild is too slow |
| **game.js decomposition** — 1,773 lines, highest complexity | Port one state at a time starting with PLAYING. Keep old game runnable as reference |
| **Drift feel regression** — physics must feel identical | Port `updatePhysics()` exactly, compare side-by-side |
| **Scope creep within Phase 1** | Strict scope boundaries defined above. Only Chaser + Interceptor, scrap pickups only |
