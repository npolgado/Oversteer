# Oversteer — Patch Notes

---

## 2026-03-11 - v0.9.6 - Various Bug Fixes
- **Pickups**: Fixed a bug where multiple pickups cannot be attained at the same time
- **Mobile**: Fixes bug where players could not start game on mobile, as well as other mobile menu issues
- **Speed Demon**: Fixed an issue where enemy speed penalty was not applied
- **Trails**: Fixed issue with trail upgrades not persisting
- **Gameplay**: Various fps and performace improvements
- dev: added unit testing (currently 22/22 passed)

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