# Oversteer v1.0 — Product Requirements Document

## Product Vision

Oversteer v1.0 is a polished, audio-complete top-down arena drift combat game ready for public release. The player survives waves of enemies by mastering drift mechanics and encircling foes with a visible trail. v1.0 ships as a self-contained browser game with full audio, mobile support, and zero known bugs.

---

## Current State (v0.9.5)

The game is playable and fun. Core gameplay loop is complete.

| Category | Status |
|----------|--------|
| Drift physics | Complete (acceleration, drag, handbrake, wall-riding, drift chaining) |
| Enemy types | 4 (Chaser, Interceptor, Drifter, Elite) |
| Upgrades | 17 with reroll mechanic (3 per break) |
| Wave system | Combat/break phases, spawn ramp, burst spawning, horde events |
| Health | 100 HP, per-enemy damage, invulnerability frames, knockback, regen |
| Scoring | Near-miss, encirclement, combo system, milestones |
| Trail & encirclement | Loop detection, shockwave kills, combo multipliers |
| Props | Chunk-based procedural generation (trees, rocks, mud, puddles, bushes) |
| Visual effects | ScreenFX (slowmo, zoom, shake, flash, freeze), particles, FXCache |
| Controls | Keyboard + touch (virtual analog stick, drift button) |
| Audio | **None** |
| Mobile UX | Partial — can drive but **cannot select upgrades** (blocks play after wave 1) |
| Architecture | Single HTML file (~3800 lines), zero dependencies |

### Known Bugs

1. **Pickup collection early-return** — `Waves.update()` returns early when a scrap is collected, skipping remaining scraps and boost zones for that frame
2. **Remaining `shadowBlur`** — Lines ~2285 and ~2337 still use `shadowBlur` on scraps/boost zones (performance killer)
3. **Touch upgrade selection missing** — Mobile players cannot select upgrades (requires keyboard 1/2/3)
4. **Trail rendering: 1200+ draw calls/frame** — Each trail segment gets individual `beginPath/stroke` calls

---

## v1.0 Release Requirements

### P0 — Must Ship

These are blockers for a v1.0 release.

#### Bug Fixes

| Bug | Description | Impact |
|-----|-------------|--------|
| Pickup early-return | `Waves.update()` exits loop on first scrap collection | Silent pickup loss, especially with magnet upgrade |
| shadowBlur on scraps/boosts | 2 remaining `shadowBlur` usages not converted to FXCache | FPS drops on weaker hardware |
| Touch upgrade selection | No touch input handler for upgrade cards | Mobile completely blocked after wave 1 |
| Trail draw call batching | 600 segments x 2 passes = 1200+ individual draw calls | Unnecessary GPU overhead |

#### Audio System

The game is completely silent. Audio is the single highest-impact missing feature.

**Required sounds:**

| Sound | Type | Behavior |
|-------|------|----------|
| Engine hum | Loop | Pitch/volume tied to player speed |
| Tire squeal | Loop/trigger | Plays during drift, intensity by slip angle |
| Collision crunch | One-shot | On enemy contact / damage taken |
| Encirclement chime | One-shot | Satisfying ring on successful loop kill |
| Near-miss whoosh | One-shot | When passing close to enemy/hazard |
| Horde warning horn | One-shot | 1.5s before horde spawn |
| Combo sting | One-shot | On combo level milestones (3, 5, 8) |
| UI click | One-shot | Upgrade selection, menu interaction |
| Background music | Loop | Ambient track, appropriate tempo for gameplay |

**Implementation:** Howler.js loaded via CDN `<script>` tag. Global `AudioManager` object within index.html.

**Controls:** Mute toggle and volume slider accessible from pause menu.

### P1 — Should Ship

High-value features that significantly improve the experience.

| Feature | Description |
|---------|-------------|
| Run statistics | Track per-run: enemies killed, encirclements, near-misses, drift time, waves reached, peak combo. Show post-run breakdown on game-over screen. |
| Screen-edge enemy indicators | Arrows/dots at screen edge showing direction of off-screen enemies |
| Improved game-over screen | Display run stats, high score comparison, "press Enter to retry" |
| Arena boundary effects | Visual treatment at arena edges (glow, particles, or fence effect) |

### P2 — Nice to Have

Polish features that enhance but aren't required for v1.0.

| Feature | Description |
|---------|-------------|
| Difficulty modifiers | Pre-run toggles (double enemies, reduced HP, faster waves) with score multipliers |
| New upgrades (3-5) | Synergy-tagged upgrades that create build variety. Candidates: `extra_rerolls`, dash burst, trail burn damage |
| Directional camera shake | Shake direction matches impact source vector |
| Drift trail thickness | Trail width varies with player speed |
| Enemy death animations | Per-type death effects (Elite explosion, Drifter spin-out, etc.) |

---

## Out of Scope for v1.0

The following are deferred to post-v1.0 releases (see [TDD.md](TDD.md) for the post-v1.0 roadmap):

- Multi-biome/world system (Neon Wasteland, Frozen Rupture, Corruption Jungle)
- Boss fights and phase-based encounters
- Narrative framework (transmissions, lore, codex)
- Meta-progression (persistent currency, unlocks, perk trees)
- PixiJS / Three.js rendering migration
- TypeScript / ES module migration
- Online leaderboards and daily challenges
- Multiplayer
- Controller/gamepad support

---

## Success Criteria

| Criteria | Target |
|----------|--------|
| Session length | Playable and fun for 10+ minutes |
| Audio | All P0 sounds present and mixed |
| Mobile | Fully playable including upgrade selection |
| Performance | 60fps on mid-range hardware (PerfMon verification) |
| Bugs | Zero known P0 bugs |
| Browser support | Chrome, Firefox, Safari, Edge (latest versions) |

---

## User Stories

### Core Loop
1. **Start**: Player opens game in browser, sees menu with high score. Presses Enter or taps to start.
2. **Play**: Player drives, drifts, and encircles enemies. Audio feedback reinforces actions. HUD shows score, HP, wave, combo.
3. **Upgrade**: After wave combat phase, player picks 1 of 3 upgrade cards (keyboard 1/2/3 or touch tap). Can reroll up to 3 times with R.
4. **Escalate**: Waves get harder (more enemies, faster spawns, horde events). Player adapts strategy with chosen upgrades.
5. **Die**: HP reaches 0. Death sequence plays (freeze + slowmo + particles). Game-over screen shows run stats.
6. **Retry**: Player sees stats breakdown, presses Enter to return to menu or start new run.

### Mobile Flow
1. Player opens game on phone/tablet. Touch hint appears on menu.
2. Left thumb controls virtual analog stick. Right thumb taps drift button.
3. During upgrade break, player taps upgrade card directly to select it.
4. Two-finger tap to pause.

---

## Related Documents

- [Technical Design Document](TDD.md)
- [Development Roadmap](26_03_09_roadmap.md)
- [Visual Implementation Plan](oversteer_visual_implementation_plan.md) (post-v1.0 vision)
