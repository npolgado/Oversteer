# Phases 2-8: Roadmap to Steam Release

## Overview

After Phase 0-1 delivers a playable PixiJS + TypeScript port of core gameplay, these phases expand content, polish visuals, add platform features, and prepare for Steam distribution. Each phase produces a playable build.

---

## Phase 2 — Game Feel + Visual Polish - dev_1.2.0

### Goal

Turn the functional port into something that looks and feels premium.

### Scope

- Full particle system via PixiJS particle containers
  - Sparks (wall-riding, collisions)
  - Smoke (enemy despawn, drift)
  - Shards (death, explosions)
  - Rings (milestones, encirclement kills)
  - Skid marks (persistent trail marks)
- PixiJS filters and post-processing
  - Bloom on trails and player glow
  - Vignette overlay
  - Speed lines at high velocity
  - Flash and desaturation on damage
- GSAP integration (add dependency here)
  - Menu fade transitions
  - Upgrade card slide-in animations (implemented via manual lerp; see docs/fixes/gsap_ui_fixes.md for the v8 alpha quirk)
  - Banner slide-ins for milestones
  - Smooth UI state transitions
- Death sequence with full freeze/slowmo/shatter FX
- Wall-riding sparks along arena boundary
- Enemy-specific death FX (red sparks, blue sparks, smoke burst, golden explosion)
- Drift trail thickness variation based on speed

### Issue #6 — FPS / Performance

Phase 2 is the first time the full visual stack is running. Before layering effects, establish a baseline FPS benchmark vs. the vanilla JS build. Fix any regressions here rather than deferring them to Phase 8.

Checklist:
- Benchmark Phase 1 build (no effects) vs. `arena-drifter/` vanilla baseline
- Profile PixiJS draw calls — especially trail rendering (400+ segments/frame)
- Fix any regressions found before adding effects on top
- Full optimization pass remains in Phase 8

### Success Criteria

- First 30 seconds feel exciting ✅
- Kills feel rewarding with clear visual/audio feedback ✅
- Visuals support clarity, not clutter ✅
- Stable 60fps with effects active ✅ (benchmark pending — run `npm run bench:web`, see `docs/perf/README.md`)
- No FPS regression vs. vanilla JS baseline (issue #6) — pending captured report at `docs/perf/`

**Phase 2 closed: dev_1.2.0 (2026-05-08)**

---

## Phase 3 — Full Content Port - dev_1.3.0

### Goal

Port everything from the original game that was deferred in Phase 1.

### Scope

- Remaining 5 enemy types
  - Drifter (alternates normal driving and sustained drifts)
  - Blocker (targets trail midpoint to block encirclement)
  - Flanker (perpendicular approach, charges within 120px)
  - Bomber (orbits ahead, drops hazard zones)
  - Elite (armored 2 HP, larger hitbox)
- Bomber hazard zones (pulsing red circles, DPS + slow)
- Horde events (wave 2+, 4 + 0.5x wave enemies)
- All pickup types
  - trail_boost (+100 MAX_POINTS for 3s)
  - speed_pickup (1.2x speed for 2s)
  - bomb (explosion kills nearby, wave 5+)
- Boost zones (1.3x speed for 1.5s)
- Difficulty modifiers (Hard Mode, Speed Rush, Fragile, Double Enemies)
- Second map ("Loopy")
- Extended run stats on game over screen
- Expanded test suite for all enemy AI behaviors

### Success Criteria

- All original game features present in the new stack
- Feature parity with `arena-drifter/` vanilla JS version
- Performance maintained with full enemy roster

**### Phase 3.9 - Pre-Phase-4 Cleanup - dev_1.3.9**

**Closed: dev_1.3.9 (2026-05-23)**

Bug audit against live_test_2026-05-16: all major bugs fixed in Phase 3.5 (bomb corpse #7, peakCombo #8, boost zones #9, scrap feedback #10, pause overlay #6). Phase 3.9 adds input completeness before biome work begins.

- Mobile touch overlay (mobileControls.ts)
- Baseline gamepad/controller support
- Elite encirclement count corrected to 3 kills

---

## Phase 4 — New Content + World System - dev_1.4.0

### Goal

Expand beyond the original game with a world/biome system and new content.

### Scope

- World/biome framework — each world defines:
  - Background art layers and lighting palette
  - Fog/post-processing settings
  - Prop set and obstacle types
  - Hazard rules
  - Enemy type weighting
  - Music pack
  - Upgrade weighting bias
- Target worlds (from vision doc):
  - **Neon Wasteland** — synthwave desert, glowing cracks, heat haze, balanced difficulty (onboarding world)
  - **Frozen Rupture** — ice plains, low-traction zones, crystal hazards, clean visibility (handling variation)
  - **Corruption Jungle** — bioluminescent overgrowth, spreading corruption zones, dense terrain (stress test)
- World-specific upgrade weighting (speed upgrades in Wasteland, control in Rupture, sustain in Jungle)
- New enemy archetypes beyond original 7
- Run structure: progress through multiple worlds per run
- Route branching / risk-reward decisions between worlds

### Success Criteria

- Worlds feel meaningfully different (visuals AND gameplay)
- Gameplay changes per world, not just visuals
- Loading and switching worlds is clean

---

## Phase 5 — Three.js Integration - dev_1.5.0

### Goal

Add atmospheric depth and cinematic presentation using Three.js for non-gameplay layers.

### Scope

- Add Three.js dependency
- Three.js for atmospheric 3D backgrounds
  - Parallax depth layers
  - Particle fog and weather effects
  - Dynamic lighting (world-specific palettes)
- Three.js for cinematic menu scene
  - Spinning car model or sprite with drift trail effects
  - Depth-of-field background
- Rendering approach: Three.js renders to a separate canvas or render texture, composited under the PixiJS gameplay layer
- PixiJS remains the renderer for all 2D gameplay — Three.js is atmosphere only
- Custom shaders / post-processing for bloom, glow, fog, distortion, heat haze, color grading

### Implementation Note

PixiJS and Three.js are two separate rendering contexts. Options:

1. Two canvases layered via CSS (simpler, may have compositing overhead)
2. Three.js renders to texture, displayed as PixiJS sprite (more integrated, more complex)

Evaluate both approaches. Start with option 1 for simplicity.

### Success Criteria

- Menu and backgrounds feel cinematic and atmospheric
- No performance regression on gameplay (Three.js only renders non-gameplay layers)
- Clean separation between gameplay rendering (PixiJS) and atmosphere (Three.js)

---

## Phase 6 — Steam Wrapper + Platform Features - dev_1.6.0

### Goal

Package the game for Steam distribution with platform-specific features.

### Scope

- **Desktop wrapper** — evaluate Electron vs Tauri
  - Electron: Chromium-based, battle-tested for web games, larger binary (~150MB)
  - Tauri: System webview, much smaller (~10MB), less proven for games, may have audio/rendering quirks
  - Decision: test both with the game, pick based on compatibility and binary size
- **Steamworks integration**
  - Achievements (drift milestones, kill counts, wave records, upgrade builds)
  - Leaderboards (per-map, per-difficulty, daily challenge)
  - Cloud saves (run history, unlocks, settings)
  - Use `steamworks.js` or `greenworks` npm package
- **Gamepad full support** (complete the stub from Phase 0)
  - Xbox/PS controller mappings
  - Analog stick steering with deadzone
  - Vibration/rumble on collisions, kills, combos
- **Rebindable controls UI**
  - Keyboard and gamepad bindings
  - Saved to localStorage / cloud saves
- **Display settings**
  - Fullscreen toggle
  - Resolution options
  - VSync toggle
  - Quality presets (particles, post-processing)
- **Build pipeline**
  - `vite build` -> optimized bundle
  - Wrapper packages for Windows/Mac/Linux
  - Steam upload via Steamworks SDK

### Success Criteria

- Game runs as a native desktop app
- Steam overlay works
- Achievements trigger correctly
- Gamepad is fully playable (no keyboard needed)
- Build pipeline is automated

---

## Phase 7 — Meta-Progression + Narrative - dev_1.7.0

### Goal

Add long-term replay value and lightweight story.

### Scope

- **Persistent progression**
  - Persistent currency earned per run
  - Vehicle unlocks (new cars with different stats/visuals)
  - Cosmetic skins
  - Permanent perk tree (small bonuses that persist across runs)
  - World unlocks (complete one to access the next)
- **Run systems**
  - Run history with stats
  - Daily/seeded challenge runs
  - Difficulty modifiers expanded
  - Challenge runs (specific constraints for bonus rewards)
  - Leaderboard-ready scoring model
- **Narrative (lightweight)**
  - Short mission intros before each world
  - Between-world transmissions
  - Boss dialogue stingers
  - Unlockable lore fragments and codex entries
  - End-of-run summaries
  - Core premise: test pilot navigating unstable worlds created by a spreading phenomenon, where velocity and containment loops are the only combat method
- **SaveManager expansion**
  - Cloud sync via Steam
  - Migration from localStorage to structured save format

### Success Criteria

- Players feel motivated to do "one more run"
- Distinct builds are viable and rewarding
- Narrative supports atmosphere without slowing pace
- Progression feels rewarding, not grindy

---

## Phase 8 — Final Polish + Steam Release - beta_2.0.0
this will be beta 2.0 instead of prod 1.0.0 for testing, any addition scope, and iterative feedback and design from testing.

### Goal

Ship-quality game ready for Steam Early Access or full release.

### Scope

- **Performance optimization pass**
  - GPU profiling for PixiJS + Three.js
  - Memory allocation audit (GC pressure)
  - Asset loading optimization (bundle splitting, lazy loading)
  - Target: stable 60fps on integrated graphics
- **Accessibility**
  - Colorblind mode (configurable palette)
  - Screen shake intensity slider
  - UI scale options
  - Audio descriptions for key events
- **Audio polish**
  - Full sound mix pass
  - Music transitions by tension level (calm -> combat -> boss -> death)
  - Adaptive audio layers
  - Sound variety (multiple variants per SFX)
- **Visual consistency pass**
  - All sprites at consistent quality and style
  - UI element polish
  - Animation smoothing
  - Loading screen polish
- **Localization support** (if targeting international)
  - String extraction
  - Font support for non-Latin scripts
- **Release prep**
  - Steam store page (description, tags, screenshots)
  - Trailer capture and editing
  - Press kit
  - Beta testing / playtesting feedback round
  - Bug bash
- **Launch**
  - Steam Early Access or full release
  - Community feedback pipeline

### Success Criteria

- Game feels premium and polished
- No major bugs or performance issues
- Store page is compelling
- Positive reception from playtesters

---

## Timeline Notes

These phases are sequential but overlap is expected. Rough sizing:


| Phase                      | Effort       | Dependencies                                 |
| -------------------------- | ------------ | -------------------------------------------- |
| Phase 2: Visual Polish     | Medium       | Phase 1 complete                             |
| Phase 3: Full Content Port | Medium       | Phase 1 complete (can parallel with Phase 2) |
| Phase 4: New Worlds        | Large        | Phases 2-3 complete                          |
| Phase 5: Three.js          | Medium       | Phase 2 complete (visual foundation)         |
| Phase 6: Steam Wrapper     | Medium       | Phase 1 complete (can start early)           |
| Phase 7: Meta-Progression  | Large        | Phase 4 complete (worlds exist)              |
| Phase 8: Polish + Beta Release  | Medium-Large | All phases complete                          |


Phase 6 (Steam wrapper) can start as early as Phase 1 completion — wrapping the game in Electron/Tauri doesn't require visual polish. Getting Steam builds running early allows continuous testing on the target platform.

---

## What's NOT in This Roadmap

- **Matter.js** — the custom arcade physics work well for this game. A rigid body engine adds complexity without benefit.
- **Multiplayer** — out of scope for 1.0. Could be explored post-launch.
- **Mobile app store release** — the web version works on mobile browsers. Native mobile is a separate effort.
- **Level editor / modding** — potential post-launch feature, not 1.0 scope.

