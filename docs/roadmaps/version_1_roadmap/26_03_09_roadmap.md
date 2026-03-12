# Oversteer Development Roadmap

## Current State

Oversteer is a polished, playable top-down arena drifting game (~4060 lines, single HTML file). Core gameplay loop is complete: wave-based enemies, drift combos, trail encirclement kills, 17 upgrades, health system, pickups, and touch controls. The codebase is well-organized with clear sections, performance-conscious patterns (swap-and-pop, ring buffers, FXCache), and zero TODOs or incomplete features.

**Recent development focus (v0.9.6):** All P0 bug fixes, full mobile touch support (upgrade cards + reroll), FXCache pickup/boost glows, trail batching, chunk-based prop collision, map selection (2 maps with localStorage persistence), game-over stats screen (score/best/wave/encircled/time/upgrades/death cause), screen-edge enemy indicators, 22 unit tests with pre-push hook.

---

## Bugs & Issues Found

All 4 bugs resolved in v0.9.6:

1. ~~**Single-pickup-per-frame bug**~~ — Fixed: replaced `return` with `continue`
2. ~~**Remaining `shadowBlur` usage**~~ — Fixed: migrated to FXCache pre-rendered glows
3. ~~**Touch controls can't select upgrades**~~ — Fixed: added touch hit-testing for cards + reroll
4. ~~**Trail rendering: 1200+ draw calls/frame**~~ — Fixed: batched into single gradient path draw

---

## Phase 1: Core Polish — ✅ COMPLETE (v0.9.6)

| Task | Impact | Status |
|------|--------|--------|
| Fix pickup collection bug (early return) | Correctness | ✅ Done |
| Replace `shadowBlur` with FXCache glows | Performance | ✅ Done |
| Batch trail rendering into fewer draw calls | Performance | ✅ Done |
| Add touch hit detection for upgrade cards | Mobile playability | ✅ Done |

## Phase 2: Audio System

**Highest-impact single feature.** No audio exists at all — the game is completely silent.

- Engine hum (pitch tied to speed)
- Tire squeal during drift
- Collision crunch on enemy hits
- Satisfying ring/chime on encirclement kills
- Near-miss whoosh
- Horde warning horn
- Ambient music or beat

Uses Web Audio API. Medium complexity.

## Phase 3: Gameplay Depth

| Feature | Description |
|---------|-------------|
| Run statistics | **Partial** — game-over screen shows score/best/wave/encircled/time/upgrades/death cause. Remaining: peak combo, near-miss count, drift time, enemies killed |
| Difficulty modifiers | Pre-run choices (double enemies, reduced HP, etc.) — revive concept from Python version. Per-modifier leaderboards. |
| New enemy types | Blocker (blocks trail paths), Flanker (approaches from side), Bomber (leaves hazard zones). Each forces different strategy. |
| More upgrades + synergies | Expand to 25-30 upgrades with combo interactions. `extra_rerolls` is already commented out as a candidate. |

## Phase 4: Visual Polish

- Directional camera shake (toward impact source)
- Enemy-type-specific death animations
- Arena boundary visual effects
- Drift trail thickness varying with speed
- ~~Screen-edge indicators for off-screen enemies~~ — ✅ Done (v0.9.6, red flash bars at edges)

## Phase 5: Strategic Direction (pick one)

| Direction | Description | Tradeoff |
|-----------|-------------|----------|
| **Roguelike Depth** | 30-40 upgrades with synergies, boss waves, meta-progression, car skins | Most natural evolution, risk of scope creep |
| **Score Attack / Social** | Online leaderboards, daily seeded challenges, ghost replays | High retention, requires backend |
| **Mobile-First** | Polish touch controls, PWA manifest, mobile perf optimization | Large audience, Canvas perf constraints |
| **Multiplayer Arena** | Local/online PvP, players compete to encircle each other | Novel mechanic, massive scope |

---

## Long-Term Architecture Notes

- **Canvas 2D ceiling:** Phase 1 perf fixes resolved immediate issues. If future features reintroduce perf pressure, consider WebGL (PixiJS).
- ~~**Prop collision scaling:**~~ Chunk-based collision lookup added in v0.9.6 — no longer checking all props.
- **State machine:** As complexity grows, consider formal state objects with enter/exit/update methods instead of integer-based states.
- **File decomposition:** At ~4060 lines, approaching the ~4500 trigger. Split into ES modules when threshold exceeded. Use bundler for dev, single-file for distribution.
- **Accessibility:** Red/green/cyan color scheme may be hard for color-blind players. Add shape-based indicators.

---

## Verification

After each phase:
- Run with `npx serve arena-drifter` and play through 3+ waves
- Test on mobile (touch controls, upgrade selection)
- Check PerfMon (bottom-left HUD) for FPS regressions
- Verify no console errors
