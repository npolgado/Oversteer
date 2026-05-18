# Oversteer — Patch Notes

---

## 2026-05-18 - dev_1.3.5 - Phase 3.5 Visual-Audio Upgrade

- **Music overhaul**: Audio manager replaced procedural ambient pad with four .mp3 tracks (hype, neon, slipstream, tron); tracks are selected and shuffled at runtime
- **Camera shift on horde**: Camera drifts toward the horde center during horde-phase waves for better battlefield awareness (`src/render/camera.ts`)
- **Text clarity system**: Shared text-style presets in `src/ui/textStyles.ts` normalize font weight, stroke, and resolution across all HUD and menu text
- **Debug overlay suite** (dev builds): `src/debug/` — dismissible error banners, render probe, DOM overlay probe, layer inspector, watchdog, structured logger
- **Scene manager hardening**: Boot, menu, map-select, gameplay, and game-over scenes refactored; sceneManager gains explicit lifecycle guards
- **Wave manager dedup fix**: Duplicate wave-start calls eliminated in `waveManager.ts`
- **Input manager test suite**: 151 tests added for `inputManager.ts`
- **Build system**: `vitest.config.mjs` extracted for isolated Vitest config; CI aligned to Node 24; test isolation restored after environment bleed regression
- dev: 30 Vitest test files

---

## 2026-05-16 - dev_1.3.0 - Phase 3 Full Port Wrap-Up

- **Enemy system completion**: `enemyState.ts` fully expanded (+400 lines) — all 7 enemy types have complete state machines with patrol, chase, attack, and death states
- **Enemy update hardening**: `enemyUpdate.ts` expanded with correct per-type behavior branches and wall-bounce handling
- **Wave manager**: `waveManager.ts` significantly expanded — horde phases, burst queuing, break transitions all solidified
- **Pickup system bug fixes**: Multiple pickups can now be collected simultaneously; `pickupRenderer.ts` added as dedicated renderer
- **Bomb zone pure logic**: `applyBombZoneDamage` extracted to `pureLogic.ts` for testability; bomb kill integration tested end-to-end in `gameLoopBombKill.test.ts`
- **Background assets**: `background_03.png` added; background_01/02 optimized
- **Test suite**: expanded to 466 tests across 25 test files; coverage added for physics, pureLogic, scoring, combat, enemies, player, waves, trail, pickups, and game loop

---

## 2026-05-08 - dev_1.2.0 - Game Feel + Visual Polish

- **Trail thickness from speed**: Drift trail now stores per-point speed at emission time; segment width scales with `speedFrac` (matches `arena-drifter/world.js:500-501`) instead of position in trail
- **GPU-batched spark/shard particles**: Sparks and shards now render through PixiJS `ParticleContainer` (additive blending, sprite-batched) instead of per-particle `Graphics` calls; smoke retains Graphics path
- **Shard rotation restored**: Shards rotate at 10 rad/s as particles fly (matches `arena-drifter/fx.js:263`)
- **Chromatic aberration**: Red/blue edge strips appear at screen edges when driving at >80% max speed or during the death sequence (port of `arena-drifter/game.js:1297-1314`)
- **Milestone banner slide-in**: Combo crossings at x3/x5/x8 now trigger a centered slide-in banner in addition to the existing EventLog entries and rings
- **Upgrade card lerp documented**: The manual lerp + backOut easing in `upgradeCards.ts` is an intentional workaround for a PixiJS v8 alpha-on-zero-attached-container quirk — documented in `docs/fixes/gsap_ui_fixes.md`
- **FPS benchmark workflow**: Added `docs/perf/README.md` with step-by-step guide to run the vs-vanilla benchmark harness; added `npm run bench:web` convenience script

---

## 2026-04-13 - dev.1.1.0 - TypeScript + Pixi.js Port

- **Full engine rewrite**: game ported from single-file vanilla Canvas/JS to TypeScript + Pixi.js
  - Vite dev server (`npm run dev`), modular `src/` architecture replacing `arena-drifter/` as the active codebase
  - Scene manager with **Boot → Menu → Map Select → Gameplay → Game Over** flow
  - EventBus replaces global window callbacks for inter-system communication
- **All gameplay systems ported**: physics, player, trail, enemies (all 7 types), props, waves, scoring, damage, near-misses, encirclement, upgrades (26 total), pickups, boost zones, bomb zones
- **Upgrade mechanics ported**: **Trail Burn**, **Chain Lightning**, **Dash Burst**, **Nitro Drift**, **Lucky Dice**, and all others — upgrade flags initialized in player state, applied in game loop
- **All screens ported**: menu with controls list, map select with modifier toggles (1–4), upgrade break with reroll, game over with extended stats
- **HUD ported**: HP bar, combo display, wave timer, score, **EventLog** panel, FPS counter
- **Audio ported**: engine hum, drift squeal, one-shot SFX, ambient music — all via Web Audio API with volume/mute prefs
- **Visual FX ported**: screen shake (directional), slowmo, zoom, particles, enemy death FX, arena boundary glow, wall-riding sparks
- **Save system**: map selection and audio prefs persist via localStorage
- **CI/CD**: GitHub Actions workflow added for automated test runs on push
- dev: 300 unit tests across 14 test files (Vitest); pre-push hook runs both legacy and new test suites

## 2026-03-13 - v1.0 - MVP Launch

- **3 new enemy types** (7 total):
  - **Blocker** (2000 pts): Targets trail midpoint, holds position to block encirclement. 380 px/s
  - **Flanker** (2500 pts): Approaches perpendicular to player velocity, charges within 120px. 470 px/s
  - **Bomber** (3000 pts): Orbits ahead of player, drops hazard zones every 4s. 400 px/s
    - Hazard zones: 8 DPS + 0.6x slow, last 6s, max 15 active, cleared on wave break
- **5 new upgrades** (26 total):
  - **Dash Burst**: Tap brake at speed >300 for 0.2s invuln dash, 3s cooldown
  - **Trail Burn**: Trail damages enemies on contact (1 dmg, 1s cooldown per enemy)
  - **Chain Lightning**: Loop kills chain 1 damage to nearest enemy within 200px
  - **Lucky Dice**: +2 rerolls per break (stackable, max 2)
  - **Nitro Drift**: +30% max speed while drifting
- **4th difficulty modifier**: Double Enemies — spawn intervals halved + burst count doubled (4), 1.6x score
- **Full audio system**: Procedural sound synthesis — no audio files needed
  - **Engine hum** rises in pitch and volume with speed
  - **Drift squeal** plays during drift, intensity follows slip angle
  - **One-shot SFX**: collision thuds, encirclement chimes, near-miss whooshes, horde alarm, combo stings, UI clicks
  - **Ambient music**: Low sine pad with LFO modulation during gameplay, ducks on pause, fades on death
  - Audio controls on pause screen: **[M]** mute, **[ ] ]** SFX volume, **[- =]** music volume
  - Volume/mute preferences saved to localStorage
- **Difficulty modifiers**: Toggle on map select with **1/2/3/4**
  - **Hard Mode**: enemies +100 px/s speed, 1.5x score
  - **Speed Rush**: spawn intervals halved, 1.3x score
  - **Fragile**: 50 HP only, 1.4x score
  - **Double Enemies**: spawn intervals halved + burst count doubled, 1.6x score
- **4 new upgrades** from pre-release (21 total before this batch):
  - **Drift Shield**: -40% damage while drifting
  - **Combo Medic**: Heal 10/15/25 HP at combo milestones 3/5/8
  - **Trail Magnet**: Trail points attract scraps within 80px
  - **Speed Trail**: Trail capacity grows with speed
- **EventLog HUD**: Replaced world-space floating texts with a screen-anchored HUD panel (below HP bar)
  - Shows up to 7 entries; entries fade out over 3.5s
- **Extended run stats** on game-over screen: peak combo, near misses, drift time, enemies killed
- **Game-over screen**: Shows active difficulty modifiers and combined score multiplier
- **Arena boundary glow**: Multi-pass pulsing glow border replaces flat stroke
- **Wall-riding sparks**: Spark particles along nearest wall when drifting near boundary
- **Enemy death FX**: Type-specific effects — red sparks (chaser), blue sparks (interceptor), smoke burst (drifter), golden explosion + screen shake (elite)
- **Directional camera shake**: Collision shake biased toward impact direction
- **Drift trail thickness**: Trail line width varies with speed per segment
- **Modular code split**: Game refactored from single index.html into 9 JS modules
- dev: 58 total unit tests across 7 test files

## 2026-03-12 - v0.9.6 - Bug Fixes, Mobile Touch & Performance

- **Another Map!**: use a and d or <- / -> for map selection on a new game 
- **Pickups**: Fixed a bug where multiple pickups could not be collected at the same time
- **Speed Demon**: Fixed enemy speed bonus not applying when selecting **Speed Demon** upgrade
- **Trails**: Fixed trail upgrades (**Wider Trail**, **Trail Echo**) not persisting between waves
- **Mobile touch**: Tap to start from menu, tap upgrade cards and reroll button during wave breaks
  - Updated menu hints and start prompt for touch controls
- **Performance**: Pre-rendered pickup and boost zone glows via **FXCache** (removed `shadowBlur`)
  - Prop collision now uses chunk-based lookup instead of checking all props
  - Trail rendering batched into single gradient path draw instead of per-segment strokes
- **Menu**: Added **Reverse/Handbrake** and **Reroll** to the controls list
- dev: added unit testing (currently 22/22 passed), pre-push test hook, docs and roadmap files

## 2026-03-09 - v0.9.5 - Horde and Upgrade Rerolls

- **Horde event**: At 75% of each combat phase (wave 2+), a ring of enemies spawns around the player with a "HORDE INCOMING!" warning banner and screen shake
  - Base 4 enemies, +0.5 per wave, up to 15 max
  - 1.5s delay between warning and spawn
- **Upgrade rerolls**: Press **R** during upgrade selection to reroll all 3 cards (up to 3 rerolls per break, resets each wave)
- Removed upgrade selection timer — take as long as you want to choose
- After selecting an upgrade, cards disappear and a centered 3-second countdown plays before the next wave starts
- Enemy damage now scales after wave 5 (+12% per wave, up to 3x max)
- Trail changes color to purple at combo level 5+
- Wave combat duration now increases each wave (+10s per wave, starting at 30s, capped at 120s)
- FPS display for diagnostics
- FPS drop improvements on wave start
- Balanced wave 6+ (late game)
- Increased hp regen stacking count

## 2026-03-08 - v0.9 - Health System (hp_system branch)

- Added player HP system (100 HP, configurable per-enemy damage values)
- Per-enemy-type damage: Chaser 15, Interceptor 18, Drifter 15, Elite 25
- Hit invulnerability (0.8s) and knockback on damage
- HP regeneration after 3s out of combat
- HP bar added to HUD with color-coded thresholds (green/yellow/red, flash on hit)
- 3 new upgrades: 
  - **Auto Repair** (3 HP/sec regen)
  - **Reinforced Frame** (+30 max HP)
  - **Armor Plating** (25% damage resist)
- Trail now resets between waves
- Thicker, more visible trail lines and glow
- HUD panels now have dark backdrop for readability
- Background image optimized (2.4 MB → 280 KB)

## 2026-03-08 - v0.8.5 - Enemy Sprite Variety

- Added per-enemy-type sprite pools (`CFG.ENEMY_SPRITES_BY_TYPE`)
  - Chasers: enemy_red, enemy_orange
  - Interceptors: police, ambulance
  - Drifters: taxi, mini_van
  - Elites: truck, mini_truck
- Enemies randomly pick from their type's sprite pool on spawn

## 2026-03-08 - v0.8.1 - Oil Slips & Prop Near-Misses

- Oil slick (puddle) props now actually reduce lateral friction when driven over
- Added near-miss scoring for hazard props (15 pts while drifting near solid props)
- Near-miss cooldown per prop to prevent spam

## 2026-03-07 - v0.8 - Background & FPS Improvements

- Added background image support (`background.png` rendered behind the arena)
- Replaced all `shadowBlur` effects with pre-rendered glow canvases (FXCache) for major FPS gains
  - Vignette pre-rendered to offscreen canvas
  - Prop glows pre-rendered per type/radius
  - Player and enemy underglow switched from shadowBlur to arc-based glow rings
- Prop radii scaled up to match PNG assets (tree 50, rock 40, mud 62, puddle 55, bush 25)

## 2026-03-05 - v0.7.5 - Cleanup & Asset Overhaul

- Removed legacy Python roguelike version (src/, main.py, requirements.txt) (see v0.1)
- Removed lane-based web version (roguelike-racer/) (see v0.2)
- New Assets: Player and enemy cars, scene props like mud, trees, and bushes
- dev: added Claude support for development
- Various asset loading and FPS drop fixes

## 2026-03-03 - v0.7 - QoL Update: Visuals & Windows Scaling

- Handbrake mechanic: reverse input at speed triggers power-slide (turn rate x2.0, 0.3s duration)
- Speed boost zones: spawn every 12s, grant x1.3 speed for 1.5s
- Drift chaining: re-entering drift within 0.5s grants 1.5x/2.0x score multipliers
- Wall riding: drifting within 30px of arena wall grants +10% speed bonus
- Near-miss streak bonus: 3+ consecutive near-misses within 2s grant 50x streak bonus
- Drift King upgrade now reduces lateral friction by 25% during drift
- Afterburner upgrade now doubles drift boost
- Major visual scaling overhaul for Windows (responsive `S()` helper)
- Viewport scaling fixes for different screen resolutions

## 2026-03-03 - v0.6 - QoL Updates: Balancing & Upgrades

- Camera lead: camera offsets in direction of travel for better visibility
- Dynamic zoom: slight zoom-out at high speed (up to 4%)
- Enemy fade-out: enemies fade and poof when nearing end of lifespan
- Encirclement score bonus upgrade added
- Trail flash polygon effect on successful encirclement
- Encircle score bonus tracking per player

## 2026-03-03 - v0.5 - Open World & Balancing

- Converted from screen-sized arena to 3000x3000 open world
- Added camera system with smooth follow and world clamping
- Trail & encirclement system: player leaves a visible trail that kills enemies when forming closed loops
- Enemy lifespan system (10-18s), off-screen speed boost for catch-up, distance-based despawn
- Wave combat/break phases with spawn ramp scaling (waves 1-5)
- Burst spawning every 8s (disabled wave 1)
- First wave gets longer combat duration (30s vs 25s)
- 14 upgrades offered between waves (pick 1 of 3)

## 2026-03-02 - v0.4 - Arena Drifter

- Initial arena drifter version: full game rewrite from Python to single-file HTML/Canvas/JS
- Core drift physics, enemy AI (chaser, interceptor, drifter types)
- Wave system, scoring, pickups, prop system
- Menu, pause, game over states

## 2026-03-02 - v0.3 - Reverse & Drifting

- Improved reverse mechanics and drifting feel in Python prototype
- Enemy AI pursuit improvements
- UI and constant tuning

## 2026-03-01 - v0.2 - Open World No Road

- Converted Python version from lane-based to free-roam open world
- Added chunk-based procedural prop system
- Fuel system, modifier system, upgrade system
- Free 2D movement with angle-based heading

## 2026-03-01 - v0.1 - Road Runner

- Initial Python roguelike racer prototype
- Pseudo-3D scrolling road concept

