# Oversteer

## Project Overview
Oversteer is a top-down arena drifting game. The entire game lives in a single self-contained HTML/Canvas/JS file.

- **Source of truth**: `arena-drifter/index.html` (~3800 lines)
- **Run**: `npx serve arena-drifter`
- **Game**: Arena-based (fixed 3000x3000 world), wave-based enemy spawning, drift combos, near-miss scoring, trail encirclement kills, delta-time physics (px/sec)

## Project Structure
```
arena-drifter/
  index.html                    The game (single-file, self-contained)
  assets/                       PNG sprites (cars, props)
    cars/                       Car sprites (point UP in PNG, rotated +90° in code to face RIGHT)
    props/                      Prop sprites (trees, rocks, mud, etc.)
references/reference_mock.png   Visual inspiration
.gitignore                      Repo config
CLAUDE.md                       This file
```

## Game States
`MENU` → `PLAYING` (combat/break phases) → `UPGRADE` → `PLAYING` → `DYING` → `GAME_OVER` → `MENU`
- `PAUSED`: Toggle with P/Escape during gameplay
- `SANDBOX`: Free drive mode (no enemies), toggled with S on menu

## Player Physics
- Free 2D movement with angle-based heading (0=right)
- **Drift system**: Lateral friction drops from 8.5 to 3.2 when drifting; forward drag rises from 1.7 to 2.1
- **Handbrake**: Triggered by reverse input + speed > 180 px/s. Turn rate x2.0, duration 0.3s, deceleration 1800 px/s²
- **Visual angle**: Sprite follows `atan2(vy, vx)` so the car visually slides during drift
- **Wall riding**: Drifting within 30px of arena wall grants +10% speed bonus
- **Drift chaining**: Re-entering drift within 0.5s grants score multipliers (1.5x first chain, 2.0x second)
- Controls: W/Up=accel, S/Down=reverse, A/D or Left/Right=turn, Down=handbrake/drift

## Enemy Types
Enemies share the same physics engine as the player. Unlocked by score, not wave number.

| Type | Speed | Turn Rate | Behavior | Sprites | Unlock |
|------|-------|-----------|----------|---------|--------|
| Chaser | 420 px/s | 200°/s (1.0x) | Drives straight at player | enemy_red, enemy_orange | Always |
| Interceptor | 460 px/s | 170°/s (0.85x) | Leads player position by 0.5s | police, ambulance | 1000 pts |
| Drifter | 440 px/s | 220°/s (1.1x) | Alternates normal driving (1.5-3s) and sustained drifts (1-2.5s) | taxi, mini_van | 1500 pts |
| Elite | 378 px/s | 160°/s (0.8x) | Armored (2 HP), larger hitbox (r=14), 1.5x lifespan | truck, mini_truck | Wave 4+, 12% chance |

Sprites configured via `CFG.ENEMY_SPRITES_BY_TYPE` (per-type sprite pools with random selection).
Enemies spawn 550px from player, lifespan 10-18s, despawn if offscreen >5s or >1200px away.

## Wave System
- **Combat phase**: Starts at 30s, +10s per wave, capped at 120s. Enemies spawn on interval.
- **Break phase**: 8s. All enemies cleared, player picks 1 of 3 upgrades.
- **Spawn ramp** (linear wave 1→5, then constant):
  - First spawn delay: 2.5s → 0.6s
  - Spawn interval: 4.0s → 1.5s
- **Burst spawning** (disabled wave 1): Every 8s, spawns 2 enemies with 0.3s delay
- **Speed bonus**: At 2000+ score, enemies get up to +120 px/s bonus
- **Horde event**: Triggers once per wave (wave 2+) at a random point between 60-85% of combat duration (`CFG.HORDE_TRIGGER_MIN`/`MAX`). Spawns 4 + 0.5×wave enemies (max 15) at 950px from player with 1.5s warning.

## Health System
- **Player HP**: 100 base, displayed as HP bar in HUD
- **Damage by type**: Chaser 15, Interceptor 18, Drifter 15, Elite 25
- **Damage scaling**: After wave 5, damage scales by +12% per wave (`DMG_SCALE_PER_WAVE`), capped at 3.0x
- **Hit invulnerability**: 0.8s after taking damage, knockback 120 px/s
- **HP regen**: Activates after `CFG.HP_REGEN_DELAY` (2.0s) without taking a hit. Rate set by hp_regen upgrade (3 HP/s per stack)
- **Death**: Player dies when HP reaches 0, triggers death freeze + slowmo sequence

## Scoring
- Base: 4 pts/sec (modified by score_freak upgrade)
- Near-miss enemy: 25 pts (while drifting, within ~16px, 1.2s cooldown per target)
- Near-miss hazard: 15 pts (within ~20px)
- Near-miss streak: 3+ consecutive within 2s grants 50 × streak bonus
- Encirclement kills: base + bonus with combo multiplier
- Bomb kills: 50 pts per enemy
- Combo system: Combo level 1-8, decays over time, multiplies encirclement score
- Drift chain multipliers: 1.5x / 2.0x for chained drifts
- High score persisted in localStorage

## Trail & Encirclement
Core mechanic: the player leaves a visible trail. When the trail forms a closed loop, enemies inside are killed.
- Trail records position every 0.05s, checks for loops every 0.15s
- `MAX_POINTS`: 400 (upgradeable to 600 via trail_echo)
- `CLOSE_DIST`: 40px detection radius (upgradeable to 60 via wider_trail)
- Both values reset on death/new run via `Trail.reset()`
- Loop kills trigger shockwave particles + score award

## Upgrades (17 total, no rarity system)
Offered during wave break phase (pick 1 of 3). No selection timer — player takes as long as needed.
- **Rerolls**: Press R to reroll upgrade cards (up to 3 per break, resets each break)
- **Post-selection**: After choosing, cards disappear and a centered 3-second countdown plays before next wave
- **Stackable upgrades**: shield, hp_regen (max 3), max_hp, damage_resist can be picked multiple times

| Upgrade | Effect |
|---------|--------|
| turbo | +15% top speed |
| tight_turns | +25% turn rate |
| drift_king | Drift boost +50%, drift lateral friction ×0.75 |
| shield | Absorbs one collision (knockback + 1s invulnerability) |
| magnet | Auto-collect scraps within 150px |
| score_freak | Score multiplier ×1.5 |
| ghost_frame | 0.3s invulnerability after near-miss |
| thick_plating | Collision radius -3px |
| afterburner | Drift boost doubled |
| combo_master | Combo decays 50% slower |
| speed_demon | +20% player speed (+10% enemy speed too) |
| wider_trail | Loop detection radius +50% (CLOSE_DIST: 40→60) |
| trail_echo | Trail lasts 50% longer (MAX_POINTS: 400→600) |
| encircle_bonus | +50% score from encirclement |
| hp_regen | +3 HP/sec regen after 2s without damage (stackable, max 3) |
| max_hp | +30 max HP, heals +30 immediately (stackable) |
| damage_resist | Take 25% less damage, diminishing per stack: 1-(1-x)×0.75 |

## Pickups
Scraps spawn every 6s during combat. Types determined by random roll:
- **scrap** (80%): 10 pts, 35% chance to grant +1 combo
- **trail_boost** (8%): +100 trail MAX_POINTS for 3s
- **speed_pickup** (8%): ×1.2 max speed for 2s
- **bomb** (4%, wave 5+ only): Explosion kills nearby enemies, 50 pts each
- **Speed boost zones**: Spawn every 12s, grant ×1.3 speed for 1.5s

## Prop System
- Chunk-based procedural scatter: 500×500px chunks, seeded RNG (`seed = cx*7919 + cy*104729`)
- Density: 0.00001 per sq px (~2.5 props per chunk)
- Min distance from center: 100px clear zone
- 4 types: solid (tree r=50, rock r=40), slow (mud r=62), slip (puddle r=55), decoration (bush r=25)
- Chunks load/unload dynamically as camera moves
- Props use `Assets.drawOrFallback()` with procedural fallback if PNG missing

## Asset & Sprite Conventions
- Assets must live under `arena-drifter/assets/` (not a sibling directory) because `npx serve arena-drifter` sets the serve root
- Car PNGs point UP; code rotates +90° (`Math.PI/2`) to face RIGHT before drawing
- Because of the 90° rotation, W/H must be swapped in `drawImage()` calls so on-screen dimensions match the fallback rectangles
- Sprites drawn into square bounding box via `drawImage(img, -s/2, -s/2, s, s)`
- `Assets.load()` creates Image elements; `Assets.preload()` loads all configured paths at init
- FXCache pre-renders expensive effects (vignette, prop glows) to offscreen canvases
- Responsive canvas scaling via `S()` helper function (reference resolution 1920×1080)

## Death & Effects
- Death freeze: 0.10s pause, then slowmo 0.35× for 0.35s
- Shard particles: 10-14 shards on death
- Screen flash and vignette effects
- Near-miss triggers brief slowmo (0.85× for 0.15s)

---

## Removed Code

The following code was removed from the repository in March 2026 as it represents older, superseded versions of the game. Documented here for historical reference.

### Python Roguelike Version (`src/`, `main.py`, `requirements.txt`, `assets/`)

A free-driving survival roguelike built with Python 3.11 + Pygame 2.6.1. The player drove freely in an infinite 2D world, avoiding enemies and collecting fuel to survive as long as possible.

**State machine**: MENU -> MODIFIER_SELECT -> PLAYING <-> UPGRADE_SELECT -> GAME_OVER -> MENU

#### Player Physics (`src/player.py`, `src/constants.py`)
- Free 2D movement with angle-based heading (0=right, 270=up)
- **Drift system**: Velocity lags behind heading via grip parameter, creating natural slide/drift
- **Effective grip**: `max(0.45, grip / (1 + |speed| * 0.06))` — grip decreases at high speed
- **Handbrake (SPACE)**: Grip drops to 0.18, turn rate x1.35, speed decays x0.88/frame for power-sliding
- **W + SPACE = power slide**: Speed maintained while grip is low, enabling sustained drifts
- **Nitro (N key)**: +3 speed cap for 90 frames, consumed from limited charges
- **Visual angle**: Follows `atan2(vy, vx)` (not heading), so the car sprite visually "slides"
- Controls: W/Up=accel, S/Down=reverse, A/D=turn, SPACE=handbrake, N=nitro

#### Enemy AI (`src/traffic.py`)
- Waypoint-following navigation with intelligent pursuit
- **Chase mode** (within 900px): 72% chance to lead-shot the player's predicted position
- Lead-shot: Predicts position ~0.4*(dist/speed) frames ahead with +-80px noise
- **Outside chase range**: Random waypoint wander
- Grip = 0.88 (higher than player's default 0.82)
- Spawns at 500px from player, despawns at 1300px
- Difficulty ramp: +1 enemy every 20s, speed grows 0.025/s, caps at 7.0

#### Fuel System (`src/pickups.py`, `src/game.py`)
- Constant drain: 0.038/frame (always draining)
- Fuel canisters spawn every 10s at 250-550px from player
- **Magnet upgrade**: Fuel pulled toward player at 4.0*(1 - dist/160) speed
- 2 canisters pre-spawned at run start
- Game over when fuel hits 0

#### Upgrade System (`src/upgrades.py`) — 11 upgrades, 3 rarities
Offered every 40 seconds (freezes gameplay for selection, pick 1 of 3):

| Rarity | Upgrade | Effect |
|--------|---------|--------|
| Common | wide_tires | Grip +0.07 (max 0.96) |
| Common | fuel_tank | Capacity x1.30, instant +20 fuel |
| Common | steady_hands | Turn rate +0.45 (max 6.0 deg/frame) |
| Common | lead_foot | Max speed +1.5 (max 14.0) |
| Uncommon | nitro | +1 nitro charge |
| Uncommon | shield | +1 hit absorption |
| Uncommon | magnet | Auto-pulls fuel (160px radius) |
| Uncommon | overdrive | Max speed +1.0, grip +0.04 |
| Rare | ghost | +2 shields |
| Rare | overclock | Enemy speed growth x0.60 |
| Rare | double_fuel | Fuel pickup value x2.0 |

#### Modifier System (`src/modifiers.py`) — 8 run modifiers
Chosen at run start, affects entire run:

| Modifier | Effect |
|----------|--------|
| rush_hour | Enemy count x2 |
| black_ice | Grip x0.78 |
| gridlock | Enemy count x1.5 |
| low_fuel | Start fuel x0.5 |
| fog | Top 55% of screen fades to black |
| lucky_start | Free random upgrade at start |
| adrenaline | Max speed x1.25 |
| no_fuel | Fuel drain disabled |

#### Prop System (`src/props.py`, `src/maps.py`)
- **Chunk-based procedural scatter**: 500x500px chunks, seeded RNG (`seed = cx*7919 + cy*104729`)
- Density: ~75 props per chunk (0.0003 * area)
- 4 prop types:
  - **solid**: Blocks movement, bounces player, zeroes velocity in collision normal, speed x0.3 (trees, rocks)
  - **slow**: Speed debuff zone with duration/strength (mud)
  - **slip**: Grip debuff zone with duration/strength (puddles)
  - **decoration**: Visual only (bushes)
- Chunks load/unload dynamically as camera moves
- 200px clear zone around world origin

#### World & Rendering (`src/world.py`, `src/ui.py`, `src/assets.py`)
- **Infinite tiled world**: 100x100px checkerboard (grass_a/grass_b tiles or colored rects)
- Camera follows player; player always drawn at screen center (450, 350)
- **Asset system**: PNG loader with procedural fallback for every visual
- **Rotation cache**: `(sprite_key, int_angle_deg) -> Surface`, max 360 entries per sprite
- **UI**: Card-based upgrade/modifier selection, HUD (fuel bar, speed bar, time MM:SS, nitro/shield indicators, upgrade list), fog overlay, game over screen with stats
- **Font caching**: SysFont cached by (size, bold), never recreated per frame
- Score: Primary = time alive (MM:SS), Secondary = distance (px driven)

#### Map System (`src/maps.py`)
- JSON-driven: `assets/maps/grasslands.json`
- PropDef/MapDef dataclasses defining tiles, prop pools, enemy/player sprites
- Default map hardcoded as fallback

#### Unused Road Renderer (`src/road.py`)
- ~130-line pseudo-3D scrolling road class, left over from the earlier lane-based prototype
- Infinite horizontal road strips, curve generation, lane markers, rumble strips
- Was not imported or used in the free-driving version but remained in the codebase

### Lane-Based Web Version (`roguelike-racer/`)

An earlier prototype using pseudo-3D scrolling road (Outrun-style). Multi-file JS application:
```
roguelike-racer/
├── index.html      Entry point
└── js/
    ├── main.js       Game loop and initialization
    ├── config.js     Constants and tuning values
    ├── road.js       Pseudo-3D road rendering
    ├── entities.js   Player, traffic, and pickup entities
    ├── roguelike.js  Upgrade/roguelike systems
    └── utils.js      Shared utility functions
```
- 3-lane road with lane switching (mouse or keyboard)
- Fuel burn scales with speed
- Weather effects: rain, snow, night (color overrides)
- Difficulty scaling: speed bonus + traffic density per km
- Score: per-metre + near-miss bonuses
- Roguelike upgrades every 3000m

### Removed Assets (`assets/`)

The Python version used a PNG-first asset system with procedural fallback: `AssetManager` would attempt to load PNGs from disk, and if files were missing, it generated shapes programmatically at runtime (colored rectangles for cars, circles for props/pickups, colored rects for tiles). This meant the game was playable with zero asset files.

- `assets/cars/`: player.png, enemy_orange.png, enemy_red.png (34x56px, pointing UP)
- `assets/tiles/`: 100x100px grass tile PNGs
- `assets/pickups/`: Directory for fuel canister sprites (empty — procedural fallback was used at runtime)
- `assets/props/`: Tree, rock, mud, puddle, bush sprites
- `assets/maps/grasslands.json`: Map definition file

### Other Removed Files
- `.lprof/`: Python profiling data
