# Oversteer Development Roadmap

## Current State

Oversteer is a polished, playable top-down arena drifting game (~3800 lines, single HTML file). Core gameplay loop is complete: wave-based enemies, drift combos, trail encirclement kills, 17 upgrades, health system, pickups, and touch controls. The codebase is well-organized with clear sections, performance-conscious patterns (swap-and-pop, ring buffers, FXCache), and zero TODOs or incomplete features.

**Recent development focus:** FPS optimization, health system, horde events, upgrade rerolls.

---

## Bugs & Issues Found

1. **Single-pickup-per-frame bug** — `Waves.update()` returns early on line ~2123 when a scrap is collected, skipping remaining scraps and boost zones for that frame. Causes silent pickup loss with magnet at high speed.

2. **Remaining `shadowBlur` usage** — Lines ~2285 and ~2337 still use `shadowBlur` on scraps and boost zones. Rest of codebase already eliminated this performance killer.

3. **Touch controls can't select upgrades** — Mobile players can drive but can't pick upgrades (requires keyboard 1/2/3). Blocks mobile play entirely after wave 1.

4. **Trail rendering: 1200+ draw calls/frame** — Each of up to 600 trail segments gets individual `beginPath/stroke` calls (×2 passes). Could batch into a few paths.

---

## Phase 1: Core Polish (quick wins)

| Task | Impact | Effort |
|------|--------|--------|
| Fix pickup collection bug (early return) | Correctness | ~30 min |
| Replace `shadowBlur` with FXCache glows | Performance | 1-2 hrs |
| Batch trail rendering into fewer draw calls | Performance | 2-3 hrs |
| Add touch hit detection for upgrade cards | Mobile playability | 1-2 hrs |

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
| Run statistics | Track per-run stats (enemies killed, near-misses, drift time, wave reached). Show post-run breakdown. |
| Difficulty modifiers | Pre-run choices (double enemies, reduced HP, etc.) — revive concept from Python version. Per-modifier leaderboards. |
| New enemy types | Blocker (blocks trail paths), Flanker (approaches from side), Bomber (leaves hazard zones). Each forces different strategy. |
| More upgrades + synergies | Expand to 25-30 upgrades with combo interactions. `extra_rerolls` is already commented out as a candidate. |

## Phase 4: Visual Polish

- Directional camera shake (toward impact source)
- Enemy-type-specific death animations
- Arena boundary visual effects
- Drift trail thickness varying with speed
- Screen-edge indicators for off-screen enemies

## Phase 5: Strategic Direction (pick one)

| Direction | Description | Tradeoff |
|-----------|-------------|----------|
| **Roguelike Depth** | 30-40 upgrades with synergies, boss waves, meta-progression, car skins | Most natural evolution, risk of scope creep |
| **Score Attack / Social** | Online leaderboards, daily seeded challenges, ghost replays | High retention, requires backend |
| **Mobile-First** | Polish touch controls, PWA manifest, mobile perf optimization | Large audience, Canvas perf constraints |
| **Multiplayer Arena** | Local/online PvP, players compete to encircle each other | Novel mechanic, massive scope |

---

## Long-Term Architecture Notes

- **Canvas 2D ceiling:** If perf issues persist after Phase 1, consider WebGL (PixiJS). Significant rewrite but unlocks GPU batching.
- **Prop collision scaling:** Chunk system exists for generation but not collision queries. Add spatial hashing if prop count grows.
- **State machine:** As complexity grows, consider formal state objects with enter/exit/update methods instead of integer-based states.
- **File decomposition:** Split into ES modules when file exceeds ~4500 lines. Use bundler for dev, single-file for distribution.
- **Accessibility:** Red/green/cyan color scheme may be hard for color-blind players. Add shape-based indicators.

---

## Verification

After each phase:
- Run with `npx serve arena-drifter` and play through 3+ waves
- Test on mobile (touch controls, upgrade selection)
- Check PerfMon (bottom-left HUD) for FPS regressions
- Verify no console errors
