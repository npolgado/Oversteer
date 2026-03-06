# Oversteer

## Project Overview
Oversteer is a top-down arena drifting game. The entire game lives in a single self-contained HTML/Canvas/JS file.

- **Source of truth**: `arena-drifter/index.html` (~3500 lines)
- **Run**: `npx serve arena-drifter`
- **Game**: Arena-based (fixed 3000x3000 world), wave-based enemy spawning, drift combos, near-miss scoring, delta-time physics

## Project Structure
```
arena-drifter/
  index.html                    The game (single-file, self-contained)
  assets/                       PNG sprites (cars, props)
    cars/                       Car sprites (point UP in PNG, rotated -90° in code)
    props/                      Prop sprites (trees, rocks, mud, etc.)
docs/PRD.md                     Game design document
references/reference_mock.png   Visual inspiration
.gitignore                      Repo config
CLAUDE.md                       This file
```

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
