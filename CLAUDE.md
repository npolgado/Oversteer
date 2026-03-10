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
HISTORY.md                      Removed code history
patch_notes.md                  Version history
```

## Game States
`MENU` → `PLAYING` (combat/break phases) → `UPGRADE` → `PLAYING` → `DYING` → `GAME_OVER` → `MENU`
- `PAUSED`: Toggle with P/Escape during gameplay. Displays wave number, difficulty stats, and enemy speed bonus. Resume with P or return to menu.
- `SANDBOX`: Free drive mode (no enemies), toggled with S on menu

## Controls

### Keyboard
| Key | Action |
|-----|--------|
| W / Up | Accelerate |
| S / Down | Reverse / Handbrake (at speed > 180 px/s) |
| A/D or Left/Right | Steer |
| Space | Handbrake (alias for S/Down at speed) |
| P / Escape | Pause |
| R | Reroll upgrades (during upgrade selection) |
| 1/2/3 or Numpad 1/2/3 | Select upgrade card |
| S (menu only) | Sandbox mode |
| Enter | Confirm / Start |

### Touch (mobile browsers)
- **Left side**: Virtual analog stick (appears on first touch)
- **Right side**: Drift button
- **Two-finger tap**: Pause
- Touch UI only renders after the first touch event. Menu shows a hint text for touch controls.

## Player Physics
- Free 2D movement with angle-based heading (0=right)
- **Drift system**: Lateral friction drops from 8.5 to 3.2 when drifting; forward drag rises from 1.7 to 2.1
- **Handbrake**: Triggered by reverse input + speed > 180 px/s. Turn rate x2.0, duration 0.3s, deceleration 1800 px/s²
- **Visual angle**: Sprite follows `atan2(vy, vx)` so the car visually slides during drift
- **Wall riding**: Drifting within 30px of arena wall grants +10% speed bonus
- **Drift chaining**: Re-entering drift within 0.5s grants score multipliers (1.5x first chain, 2.0x second)

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
- Near-miss enemy: 25 pts (while drifting, within `CFG.NEAR_MISS_ENEMY` = 8px additive to collision radius, 1.2s cooldown per target)
- Near-miss hazard: 15 pts (within `CFG.NEAR_MISS_HAZARD` = 10px additive to collision radius)
- Near-miss streak: 3+ consecutive within 2s grants 50 × streak bonus
- Encirclement kills: base + bonus with combo multiplier
- Bomb kills: 50 pts per enemy
- Combo system: Combo level 1-8, decays over time, multiplies encirclement score
- Drift chain multipliers: 1.5x / 2.0x for chained drifts

### Milestones
- Score milestones trigger every 250 points with an animated banner and screen flash
- Combo level milestones at levels 3, 5, and 8 trigger additional banners
- Banners display for ~0.57s with fade in/out

### High Score
- Stored in `localStorage` as `oversteer_highscore_v1`
- Displayed on the menu screen

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
Scraps spawn every 6s during combat. Types determined by cascading random roll:

| Type | Waves 1-4 | Wave 5+ |
|------|-----------|---------|
| bomb | — | 4% |
| trail_boost | 12% | 8% |
| speed_pickup | 8% | 8% |
| scrap | 80% | 80% |

- **scrap**: 10 pts, 35% chance to grant +1 combo
- **trail_boost**: +100 trail MAX_POINTS for 3s
- **speed_pickup**: ×1.2 max speed for 2s
- **bomb** (wave 5+ only): Explosion kills nearby enemies, 50 pts each
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

## Visual Effects
- **ScreenFX**: Manages slowmo, dynamic zoom, screen shake, flash, and freeze effects
  - Near-miss: 0.85× slowmo for 0.15s
  - Damage taken: 0.9× slowmo for 0.1s
  - Combo: 0.9× slowmo
  - Dynamic zoom: ±4% based on speed, +1-4% boost on drift chains
- **FXCache**: Pre-renders vignette overlay and per-type prop glows to offscreen canvases
- **Particles**: Shard (death/explosions), smoke (enemy despawn), ring (milestones/encirclement)
- **Death sequence**: 0.10s freeze → 0.35× slowmo for 0.35s, 10-14 shard particles, screen flash + vignette

## Tutorial
- Activates on wave 1 when enemies exist and the player hasn't encircled yet
- Displays "Drive a loop to encircle enemies and destroy them" for 6s
- Dismissed on first successful encirclement or timeout
- Fades in/out over 0.5s

---

> Historical versions (Python roguelike, lane-based web prototype) documented in [HISTORY.md](HISTORY.md).
