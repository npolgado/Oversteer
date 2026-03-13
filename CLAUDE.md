# Oversteer

## Project Overview
Oversteer is a top-down arena drifting game. The entire game lives in a single self-contained HTML/Canvas/JS file.

- **Source of truth**: `arena-drifter/index.html` (~4600 lines)
- **Run**: `npx serve arena-drifter`
- **Game**: Arena-based (fixed 3000x3000 world), wave-based enemy spawning, drift combos, near-miss scoring, trail encirclement kills, delta-time physics (px/sec)

## Project Structure
```
arena-drifter/
  index.html                    The game (single-file, self-contained)
  assets/                       PNG sprites (cars, props)
    backgrounds/                Background images per map
    cars/                       Car sprites (point UP in PNG, rotated +90° in code to face RIGHT)
    props/                      Prop sprites (trees, rocks, mud, etc.)
test/                           Node tests (logic mirrored from index.html)
docs/roadmaps/                  PRD, TDD, version roadmaps
scripts/                        install-hooks
.githooks/                      pre-push (runs tests before push)
references/reference_mock.png   Visual inspiration
.gitignore                      Repo config
CLAUDE.md                       This file
HISTORY.md                      Removed code history
patch_notes.md                  Version history
```

## Game States
`MENU` → `MAP_SELECT` → `PLAYING` (combat/break phases) → `UPGRADE` → `PLAYING` → `DYING` → `GAME_OVER` → `MENU`
- `MAP_SELECT`: Choose map with A/D, confirm with Enter/Tap, Escape to go back. Selection persisted in localStorage.
- `PAUSED`: Toggle with P/Escape during gameplay. Displays wave number, difficulty stats, and enemy speed bonus. Resume with P or return to menu.
- `SANDBOX`: Free drive mode (no enemies), toggled with S on menu (goes through MAP_SELECT)

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
| 1/2/3/4 or Numpad 1/2/3 | Select upgrade card / Toggle difficulty modifiers (map select) |
| S (menu only) | Sandbox mode |
| A/D (map select) | Cycle maps |
| Escape (map select) | Back to menu |
| Enter | Confirm / Start |
| M (pause) | Toggle mute |
| [ / ] (pause) | SFX volume down/up |
| - / = (pause) | Music volume down/up |

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
| Blocker | 380 px/s | 140°/s (0.7x) | Targets trail midpoint, holds position to block encirclement | truck, enemy_red | 2000 pts |
| Flanker | 470 px/s | 180°/s (0.9x) | Approaches perpendicular to player velocity, charges within 120px | police, enemy_orange | 2500 pts |
| Bomber | 400 px/s | 150°/s (0.75x) | Orbits ahead of player, drops hazard zones every 4s | mini_truck, mini_van | 3000 pts |
| Elite | 378 px/s | 160°/s (0.8x) | Armored (2 HP), larger hitbox (r=14), 1.5x lifespan | truck, mini_truck | Wave 4+, 12% chance |

Sprites configured via `CFG.ENEMY_SPRITES_BY_TYPE` (per-type sprite pools with random selection).
Enemies spawn 550px from player, lifespan 10-18s, despawn if offscreen >5s or >1200px away.

### Bomber Hazard Zones
- Bomber enemies drop hazard zones every `BOMB_ZONE_INTERVAL` (4s) at their current position
- Zones last `BOMB_ZONE_DURATION` (6s), max `BOMB_ZONE_MAX` (15) active zones
- Player inside zone: `BOMB_ZONE_DMG` (8) DPS + `BOMB_ZONE_SLOW` (0.6x) speed multiplier
- Zones cleared on wave break, rendered as pulsing red circles with inner core
- Damage respects invulnerability, damage_resist, and ghost_frame

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

## Upgrades (26 total, no rarity system)
Offered during wave break phase (pick 1 of 3). No selection timer — player takes as long as needed.
- **Rerolls**: Press R to reroll upgrade cards (up to 3 per break, resets each break; extra_rerolls adds +2 per stack)
- **Post-selection**: After choosing, cards disappear and a centered 3-second countdown plays before next wave
- **Stackable upgrades**: shield, hp_regen (max 3), max_hp, damage_resist, extra_rerolls (max 2) can be picked multiple times

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
| drift_shield | -40% damage while drifting |
| combo_heal | Heal 10/15/25 HP at combo milestones 3/5/8 |
| trail_magnet | Trail points attract scraps within 80px |
| speed_trail | Trail MAX_POINTS scales with speed (+1 per 100px/s) |
| dash_burst | Tap brake at speed >300 for 0.2s invuln dash, 3s cooldown |
| trail_burn | Trail damages enemies that touch it (1 dmg, 1s cooldown per enemy) |
| chain_lightning | Loop kills chain 1 damage to nearest enemy within 200px |
| extra_rerolls | +2 rerolls per break (stackable, max 2) |
| nitro_drift | +30% max speed while drifting |

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

## Map System
- `MAPS` array defines available maps, each with `id`, `name`, `desc`, and `cfg` overrides
- `CFG_BASE` stores a snapshot of default config; `applyMap()` resets CFG to base then applies map-specific overrides
- Maps can override any CFG key (e.g., `BACKGROUND_SPRITE`, `PROP_POOL`)
- Selected map stored in `localStorage` as `oversteer_map_v1`
- `FXCache.propGlow` is rebuilt when switching maps (prop pool may change)

| Map | ID | Description |
|-----|----|-------------|
| City Boys | arena | Standard props, original arena |
| Loopy | arena_02 | Rocky ring, no trees or mud |

## Asset & Sprite Conventions
- Assets must live under `arena-drifter/assets/` (not a sibling directory) because `npx serve arena-drifter` sets the serve root
- Car PNGs point UP; code rotates +90° (`Math.PI/2`) to face RIGHT before drawing
- Because of the 90° rotation, W/H must be swapped in `drawImage()` calls so on-screen dimensions match the fallback rectangles
- Sprites drawn into square bounding box via `drawImage(img, -s/2, -s/2, s, s)`
- `Assets.load()` creates Image elements; `Assets.preload()` loads all configured paths at init
- FXCache pre-renders expensive effects (vignette, prop glows) to offscreen canvases
- Responsive canvas scaling via `S()` helper function (reference resolution 1920×1080)

## Audio System
- **Dependency**: Howler.js 2.2.4 (CDN) for one-shot SFX; Web Audio API for continuous sounds
- **AudioManager** (`Audio` object): Hybrid approach — live Web Audio oscillators for engine/drift/music, Howler for one-shots
- **Procedural synthesis**: All sounds generated at init as WAV blob URLs (no audio files needed)
- **Live sounds**: Engine (sawtooth 80-200Hz, pitch follows speed), drift squeal (high-pass noise), music (sine pad 110+165Hz with LFO)
- **One-shot SFX**: collision, encircle, near_miss, horde_warn, combo_sting, ui_click
- **Lifecycle**: Engine+music start on PLAYING, stop on pause/death/menu. Music ducks to 30% on pause, fades out on death.
- **AudioContext resume**: Called on first keydown/touchstart to satisfy browser autoplay policy
- **Persistence**: Volume/mute prefs saved to `localStorage` as `oversteer_audio_v1`
- **Pause controls**: M=mute, [/]=SFX volume, -/==music volume

## Difficulty Modifiers
- Toggled on MAP_SELECT screen with number keys (1/2/3/4) or touch
- Applied in `Game.reset()` after `applyMap()`
- Reset on GAME_OVER → MENU transition
- Active modifiers and combined score multiplier displayed on game-over screen

| Modifier | Effect | Score Multiplier |
|----------|--------|-----------------|
| Hard Mode | Enemy speed +100 px/s | 1.5x |
| Speed Rush | Spawn intervals halved | 1.3x |
| Fragile | 50 HP max | 1.4x |
| Double Enemies | Spawn intervals halved + burst count doubled (4) | 1.6x |

## Extended Run Stats
- Tracked during gameplay: `peakCombo`, `nearMissTotal`, `totalDriftTime`, `enemiesKilled`
- Reset in `Game.reset()`
- Displayed on game-over screen below existing stats

## Visual Effects
- **ScreenFX**: Manages slowmo, dynamic zoom, screen shake, flash, and freeze effects
  - Near-miss: 0.85× slowmo for 0.15s
  - Damage taken: 0.9× slowmo for 0.1s
  - Combo: 0.9× slowmo
  - Dynamic zoom: ±4% based on speed, +1-4% boost on drift chains
  - **Directional shake**: `shake(intensity, dur, dirX, dirY)` — 70% biased toward direction, 30% random
- **FXCache**: Pre-renders vignette overlay and per-type prop glows to offscreen canvases
- **Particles**: Shard (death/explosions), smoke (enemy despawn), ring (milestones/encirclement), spark (wall-riding)
- **Death sequence**: 0.10s freeze → 0.35× slowmo for 0.35s, 10-14 shard particles, screen flash + vignette
- **Enemy death FX**: Type-specific via `enemyDeathFX()` — red sparks (chaser), blue sparks (interceptor), smoke burst (drifter), golden explosion + screen shake (elite)
- **Arena boundary**: Multi-pass glow (3 passes: lineWidth 14/8/2, pulsing with `sin(time*2)`) using `CFG.C_ACCENT`
- **Wall-riding sparks**: 1-2 spark particles emitted along nearest wall when drifting near boundary
- **Drift trail thickness**: Trail `lineWidth` varies per segment based on speed (base + 3×speedFrac)

## Testing
- Pure logic extracted to `arena-drifter/logic.js` (mirrors functions from `index.html`); tests in `test/*.test.js` files
- Run tests: `node --test test/`
- When adding new game mechanics, extract the testable logic into `arena-drifter/logic.js` with a matching export, then write tests against it
- Tests run in Node (no browser/DOM) — keep test helpers dependency-free
- Test files: `upgrades.test.js`, `pickups.test.js`, `waves.test.js`, `scoring.test.js`, `trail.test.js`, `enemies.test.js`
- logic.js exports include: `getEnemyPool`, `shouldSpawnElite`, `computeFlankTarget`, `computeBlockerTarget`, `applyBombZoneDamage`, `computeModifierScoreMult`

## Coding Conventions
- Avoid `.filter()` on per-frame arrays (enemies, particles) — use in-place swap-and-pop to reduce GC pressure
- Reset `lastTime = timestamp` in the game loop when transitioning between states (e.g. UPGRADE→PLAYING) to prevent dt spikes
- When adding new upgrades, always initialize their player flags explicitly in the Player constructor — relying on `undefined`-is-falsy creates inconsistency bugs
- `startWave()` must clean up scraps, boostZones, and `_burstQueue` — these don't auto-reset between waves

## Tutorial
- Activates on wave 1 when enemies exist and the player hasn't encircled yet
- Displays "Drive a loop to encircle enemies and destroy them" for 6s
- Dismissed on first successful encirclement or timeout
- Fades in/out over 0.5s

---

> Historical versions (Python roguelike, lane-based web prototype) documented in [HISTORY.md](HISTORY.md).
