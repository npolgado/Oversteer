# Oversteer v1.1 - Product Requirements Document

## Product Vision

Oversteer v1.1 deepens gameplay without changing the core architecture. It expands enemy variety, upgrades, run metrics, and difficulty modifiers to increase replayability and strategic depth while keeping the single-file HTML build.

---

## Baseline (v1.0)

v1.0 delivers a polished, audio-complete arena drifting game with stable performance, mobile support, and zero known P0 bugs. Core loop, wave system, upgrades, and scoring are complete.

---

## Shipped in v1.1.0 (PR #4)

The following items were implemented and merged:

- **3 new enemy types**: Blocker (targets trail midpoint), Flanker (perpendicular strike charges), Bomber (drops hazard zones every 4s)
- **5 new upgrades**: dash_burst, trail_burn, chain_lightning, combo_heal, extra_rerolls
- **Double Enemies modifier**: spawn intervals halved + burst count doubled (1.6× score multiplier)
- **Extended run stats**: peakCombo, nearMissTotal, totalDriftTime, enemiesKilled — tracked during run and shown on game-over screen
- **Modular architecture refactor**: game split from single `index.html` (~4600 lines) into 9 JS modules

---

## Goals

- Fix P0 bugs introduced or uncovered during v1.1.0 implementation.
- Resolve balance issues that create unplayable or frustrating run states.
- Polish UX gaps identified in post-ship reviews.
- Maintain current performance and modular architecture.

---

## Scope

### P0 — Bug Fixes (Must Ship)

Bugs confirmed by the 2026-03-22 code review and game review:

| Bug | File:Line | Description |
|-----|-----------|-------------|
| Horde triggers on wave 1 | `waves.js:169` | Guard condition is `>= 1`; horde events should begin at wave 2+. Fix: change to `>= 2`. |
| trail_boost is permanent | `game.js:877` | Adds +200 to `Trail.MAX_POINTS` permanently. Documented behavior is +100 for 3s. Fix: implement timer-based reversal. |
| Hard Mode UI text mismatch | `game.js:1718` | UI displays "Enemies +25% speed"; actual effect is +100 px/s flat. Fix: update display string to match actual behavior. |
| EventLog background does not fade | `fx.js:467` | Panel background stays opaque after entries fade, leaving a dark ghost rectangle on screen. Fix: fade background with oldest entry's alpha, or skip background when all entries are below ~0.05 alpha. |
| EventLog clips long messages | `fx.js:470` | Fixed width `S(110)` truncates messages like "STREAK x5! +250". Fix: use `ctx.measureText()` or increase to `S(140)`. |

### P1 — Balance & UX (Should Ship)

#### Balance

- **HORDE_MAX_COUNT mismatch** (`logic.js:108`): Config value is 40; design ceiling is 15. Align config to match documented intent.
- **Speed Rush + Double Enemies stack** (`game.js:383-396`): Both modifiers halve spawn intervals independently, resulting in 0.25× intervals (4× enemy density) when combined. Add diminishing returns or prevent compound application on the same fields.
- **Combo decay grace period** (`entities.js:210-211`): Decay starts instantly when the player stops drifting, punishing normal repositioning. Add a 0.3–0.5s grace window before decay begins.
- **Damage scaling ceiling** (`logic.js:100-101`): Damage triples by wave 22 (`DMG_SCALE_MAX` = 3.0, `DMG_SCALE_PER_WAVE` = 0.12). Consider softening the ramp or adding HP scaling past wave 15 to avoid frustration walls.

#### UX

- **Pause screen controls text** (`game.js:1405-1407`): Rendered in #555 at size 11 — illegible against the semi-transparent overlay. Increase contrast and break into readable lines.
- **Tutorial duration** (`game.js:748`): Tutorial message displays for only 6s. Extend to 10s or dismiss on first successful encirclement to ensure new players absorb it.
- **No stack count on upgrade cards** (`waves.js:563-617`): Stackable upgrades (hp_regen, damage_resist, extra_rerolls, etc.) show no current-stack or max indicator. Add a visible counter on cards for these types.
- **Blocker AI fallback behavior** (`entities.js:418-419`): When trail has fewer than 10 points, `_trailMidpoint` is null and Blocker falls back to direct pursuit, making it behaviorally identical to a slow Chaser. Add a fallback target (e.g., midpoint between player and nearest wall).

### P2 — Nice to Have

- Additional upgrade synergies beyond the initial 5-8.
- Expanded enemy tuning variations (elite versions of new types).
- Map preview thumbnails or background sample on map select screen.
- Upgrade card descriptions with full mechanical detail (additive vs. multiplicative, per-stack behavior, caps).
- Near-miss scoring for non-drift maneuvering at reduced point value (acknowledges tight non-drift play).

---

## Non-Goals

- No architecture migration, module split, or TypeScript conversion (targeted for v1.2).
- No rendering overhaul or PixiJS migration.
- No multi-world/biome system, bosses, or narrative framework.
- No online leaderboards, daily runs, or multiplayer.

---

## Requirements

### Gameplay

- New enemy behaviors must be readable and telegraphed.
- Encirclement remains the primary kill mechanic.
- Wave balance must accommodate new threats without invalidating existing upgrades.

### Upgrades

- Upgrades must be data-driven and fit the current upgrade card flow.
- Synergy tags should be visible or implied in descriptions.
- Reroll behavior must remain capped and predictable.

### Run Statistics

- Stats must be collected during runtime with minimal overhead.
- Game-over screen must display new stats without clutter.

### Difficulty Modifiers

- Modifiers must be selectable before a run.
- Score multipliers must be transparent and displayed in HUD or summary.
- Stacked modifier effects must not produce unplayable spawn rates.

### Testing Suite Updates

- Add unit tests for new enemy behaviors and hazard interactions.
- Add tests for new upgrade effects and synergy tags.
- Add tests for new run statistics aggregation and reset logic.
- Add tests for difficulty modifier application and score multiplier math.

---

## Risks

- **Modifier stacking confirmed hazardous**: Speed Rush + Double Enemies at 0.25× spawn intervals is likely unplayable. Must be addressed before any additional modifiers are added.
- **EventLog UX debt**: Panel fade and width bugs create visual artifacts on every play session. Adding more event types will compound the problem until these are fixed.
- **Damage scaling frustration wall**: Runs reaching wave 15+ may feel punishing due to uncapped damage growth. Monitor session data or playtester feedback past wave 12.
- New enemies could overwhelm readability or inflate difficulty spikes.
- Upgrade synergies may produce runaway scoring or trivialize waves.
- Added stats and modifiers could clutter UI on small screens.

---

## Dependencies

- Existing modular JS architecture remains intact.
- No new external dependencies required for v1.1.x patches.

---

## Verification

- Confirm horde events do **not** trigger on wave 1 — first horde should appear at wave 2.
- Confirm trail_boost is temporary: MAX_POINTS reverts after 3s.
- Confirm Hard Mode UI text reads "+100 px/s enemy speed" (or equivalent accurate description).
- Verify EventLog renders without ghost background after entries fade.
- Verify EventLog panel is wide enough to display "STREAK x5! +250" and similar messages without clipping.
- Play through 5+ waves with each modifier combination, including Speed Rush + Double Enemies together.
- Validate all new stats against manual observation.
- Ensure mobile touch flow works for modifier selection and upgrade picks.
- PerfMon shows stable FPS with new enemies and hazards on screen.
