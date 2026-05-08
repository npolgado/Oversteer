# Oversteer v1.0 — Technical Design Document

## Architecture Overview

v1.0 retains the single-file HTML/Canvas/JS architecture (`arena-drifter/index.html`, ~4060 lines). All changes are modifications to this file plus new audio assets. No build tooling, no module system, no framework migration.

**Rationale:** The current codebase is well-organized with clear module boundaries (CFG, FXCache, PerfMon, Utils, Assets, Input, Physics, Player, Enemy, Props, Particles, ScreenFX, Camera, Trail, Waves, Upgrades, HUD, Game). Performance is adequate after planned optimizations. A rewrite would discard finely tuned physics constants and game-feel parameters that live in the code.

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Rendering | Canvas 2D | Retained. Adequate after trail batching + shadowBlur removal. |
| Audio | Howler.js (v2.2+) | Loaded via CDN `<script>` tag. Handles audio sprites, looping, volume, format fallback. |
| Build | None | Zero-build-step. Open `index.html` or `npx serve arena-drifter`. |
| Dependencies | Howler.js only | Single external dependency added for v1.0. |

---

## Bug Fix Specifications

All 4 P0 bugs were resolved in v0.9.6:

| Bug | Fix Applied |
|-----|-------------|
| Pickup early-return | Replaced `return pType` with `continue` in `Waves.update()` |
| shadowBlur on pickups/boosts | Migrated to FXCache pre-rendered glow canvases (`pickupGlow`, `boostGlow`) |
| Touch upgrade selection | Added touch hit-testing for upgrade cards and reroll button |
| Trail draw call batching | Batched into single gradient path draw instead of per-segment strokes |

---

## Audio System Design

### Integration

Howler.js loaded via CDN in `<head>`:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/howler/2.2.4/howler.min.js"></script>
```

### AudioManager Object

A global `AudioManager` object within index.html manages all audio:

```javascript
const AudioManager = {
  sounds: {},        // Howl instances keyed by name
  musicVolume: 0.5,
  sfxVolume: 0.7,
  muted: false,

  init() { /* Create Howl instances, handle AudioContext unlock */ },
  play(name) { /* Play one-shot SFX */ },
  loop(name) { /* Start/stop looped sounds */ },
  setEngineSpeed(speed) { /* Adjust engine pitch/volume by player speed */ },
  setMuted(bool) { /* Global mute toggle */ },
  setVolume(category, val) { /* Per-category volume */ },
  stopAll() { /* Stop everything (state transitions) */ }
};
```

### Sound Design

| Sound | Howl Config | Trigger |
|-------|-------------|---------|
| `engine` | `loop: true`, rate adjusted 0.5-1.5 by speed | Start on PLAYING, stop on death/pause/menu |
| `drift_squeal` | `loop: true`, volume by slip angle | Start when `player.drifting`, stop when not |
| `collision` | One-shot, short impact | `Player.takeDamage()` |
| `encircle` | One-shot, ascending chime | `Trail` loop kill detected |
| `near_miss` | One-shot, quick whoosh | Near-miss score event |
| `horde_warn` | One-shot, alarm horn | Horde event warning (1.5s before spawn) |
| `combo_sting` | One-shot, escalating pitch per level | Combo milestones (3, 5, 8) |
| `ui_click` | One-shot, subtle click | Upgrade card selection, menu actions |
| `music` | `loop: true`, low volume | Start on PLAYING, fade on death, stop on menu |

### AudioContext Lifecycle

Browsers block autoplay until user interaction. On first `click`/`touchstart`/`keydown`, call `Howler.ctx.resume()` if suspended. The menu "Press Enter to Start" / touch-to-start flow naturally provides this interaction.

### Audio Asset Strategy

Options for sourcing audio (to be decided during implementation):
1. **Free asset packs** — freesound.org, Kenney.nl (CC0 licensed)
2. **AI-generated** — Tools like Stable Audio or ElevenLabs Sound Effects
3. **Procedural** — Howler.js can load Web Audio API generated buffers if synthesized at init

Format: `.webm` primary (smaller), `.mp3` fallback (wider support). Howler handles format selection automatically.

### Pause Menu Audio Controls

Add to the existing pause overlay:
- Mute/unmute toggle
- Master volume slider (or SFX/Music separate)
- Visual feedback for current state

---

## Performance Targets

| Metric | Current | v1.0 Target |
|--------|---------|-------------|
| Trail draw calls | ✅ Batched (single gradient path) | <10/frame |
| shadowBlur usage | ✅ 0 instances | 0 instances |
| FPS (mid-range) | ✅ 60 stable | 60 stable |
| Pickup accuracy | ✅ Fixed (continue instead of return) | 100% collection |

Verification: PerfMon HUD (bottom-left) shows FPS and worst frame time. Test with 10+ enemies on screen, active trail, and drifting.

---

## Asset Requirements

### Audio Files

Directory: `arena-drifter/assets/audio/`

| File | Format | Duration | Notes |
|------|--------|----------|-------|
| engine.webm / .mp3 | Loop | ~2s loop | Low rumble, must loop cleanly |
| drift.webm / .mp3 | Loop | ~1s loop | Tire screech/squeal |
| collision.webm / .mp3 | One-shot | ~0.3s | Crunch/impact |
| encircle.webm / .mp3 | One-shot | ~0.5s | Ascending chime/ring |
| near_miss.webm / .mp3 | One-shot | ~0.2s | Quick whoosh |
| horde_warn.webm / .mp3 | One-shot | ~1s | Alarm/horn |
| combo.webm / .mp3 | One-shot | ~0.3s | Sting/accent |
| ui_click.webm / .mp3 | One-shot | ~0.1s | Subtle click |
| music.webm / .mp3 | Loop | 60-120s | Background track |

### Missing Visual Asset

`puddle_1.png` is configured in `CFG.PROP_POOL` but the PNG file doesn't exist. The fallback system renders it as a rectangle. Either add the PNG or remove from config.

---

## Post-v1.0 Technical Roadmap

### v1.1 — Gameplay Depth

**Focus:** Content expansion within the existing architecture.

| Feature | Description |
|---------|-------------|
| New enemy types | Blocker (blocks trail paths), Flanker (approaches from side), Bomber (leaves hazard zones) |
| New upgrades (5-8) | Synergy-tagged upgrades: dash burst, trail burn damage, chain lightning on loop kill, heal on combo threshold, extra rerolls |
| Run statistics | Advanced per-run metrics (peak combo, near-miss count, drift time, enemies killed) — basic stats (score/best/wave/encircled/time/upgrades/death cause) already on game-over screen |
| Difficulty modifiers | Pre-run toggles with score multipliers (double enemies, half HP, speed boost) |

### v1.2 — Architecture Migration

**Focus:** Modernize the codebase without changing gameplay.

| Step | Action |
|------|--------|
| 1 | Extract `CFG` object to `src/config.js` |
| 2 | Extract utility functions to `src/utils.js` |
| 3 | Extract `updatePhysics()` to `src/physics.js` |
| 4 | Extract Player, Enemy classes to `src/entities/` |
| 5 | Extract systems (Trail, Waves, Props, Particles, ScreenFX, Camera) to `src/systems/` |
| 6 | Extract rendering (HUD, upgrade UI, menus) to `src/rendering/` |
| 7 | Extract Input handling to `src/input.js` |
| 8 | Extract Game state machine to `src/game.js` |
| 9 | Add Vite, convert to TypeScript (`.ts`), add type annotations |
| 10 | Configure Vite to output single HTML file for distribution |

**Key constraint:** Every step must produce a working game. No big-bang rewrite.

### v1.5 — Visual Upgrade

**Focus:** Evaluate whether Canvas 2D meets feature ambitions.

**Decision point:** If planned features (particle-heavy effects, parallax backgrounds, bloom/glow shaders) cause Canvas 2D to drop below 60fps, migrate rendering to PixiJS v8.

**Migration approach:** Swap the rendering layer only. All game logic (physics, AI, trail detection, wave system, upgrades) stays unchanged. PixiJS replaces `ctx.beginPath()/stroke()/fillRect()` calls with Sprite/Graphics objects.

### v2.0 — World Expansion

**Source:** [Visual Implementation Plan](oversteer_visual_implementation_plan.md)

This phase brings the game from a single-arena experience to a multi-world run-based game.

#### Biome/World System

Each world defines: background art, lighting palette, fog/post-processing, obstacle set, hazard rules, enemy weighting, music pack, upgrade weighting bias.

| World | Theme | Mechanic Hook |
|-------|-------|---------------|
| Neon Wasteland | Synthwave sci-fi desert, neon cracks, heat haze | Balanced difficulty, onboarding |
| Frozen Rupture | Ice plains, blue fog, crystal formations | Low-traction zones, slippery handling |
| Corruption Jungle | Bioluminescent overgrowth, toxic mist | Spreading corruption zones, ambush enemies |

#### Boss Fights

One per world, phase-based encounters:
- **Wasteland Colossus**: Massive armored rig, drops mines, must be encircled multiple times
- **Cryo Serpent**: Ice arc attacks, slippery trail zones, constriction patterns
- **Bloom Core**: Stationary corruption heart, spawns tendrils and swarms, transformation phases

#### Upgrade Expansion

Expand from 17 to 30+ upgrades with world-themed categories:
- **Mobility**: Dash burst, ghost phase, wider encirclement radius
- **Offense**: Shockwave on loop, chain lightning, trail burn damage, orbiting drone
- **Defense**: Shield pulse, heal on combo, speed-based damage reduction
- **Utility**: Minimap, enemy reveal pulse, enhanced pickup magnet

Upgrades should have synergy tags and rarity tiers. World-specific upgrades favor different playstyles (Wasteland = speed/chain, Frozen = control/precision, Jungle = sustain/area denial).

#### Narrative Framework

Lightweight, non-intrusive:
- Short mission intros before runs
- Between-world transmissions
- Unlockable lore fragments
- Boss dialogue stingers
- Core premise: Test pilot navigating unstable worlds, using velocity and containment loops to combat hostile entities

#### Meta-Progression

- Persistent currency earned per run
- Vehicle unlocks with different handling profiles
- Permanent perk tree (small bonuses across runs)
- Cosmetic skins for player car and trail
- Challenge runs with specific constraints
- World unlock progression

### Beyond v2.0 — Future Considerations

| Feature | Complexity | Notes |
|---------|-----------|-------|
| Online leaderboards | Medium | Requires backend (could use serverless) |
| Daily seeded runs | Low | RNG seed from date, fixed upgrade/enemy rolls |
| Ghost replays | Medium | Record input stream, replay deterministically |
| Cosmetic unlocks | Low | Sprite swaps, trail colors, particle themes |
| Multiplayer arena | Very High | Local split-screen feasible; online requires netcode |
| PWA / Mobile-first | Medium | Service worker, manifest, mobile perf optimization |
| Controller support | Low | Gamepad API, map axes to steering/acceleration |

---

## Related Documents

- [Product Requirements Document](PRD.md)
- [Development Roadmap](26_03_09_roadmap.md)
- [Visual Implementation Plan](oversteer_visual_implementation_plan.md)
