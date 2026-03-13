# Oversteer v1.1 - Product Requirements Document

## Product Vision

Oversteer v1.1 deepens gameplay without changing the core architecture. It expands enemy variety, upgrades, run metrics, and difficulty modifiers to increase replayability and strategic depth while keeping the single-file HTML build.

---

## Baseline (v1.0)

v1.0 delivers a polished, audio-complete arena drifting game with stable performance, mobile support, and zero known P0 bugs. Core loop, wave system, upgrades, and scoring are complete.

---

## Goals

- Add meaningful gameplay depth through new enemies and upgrades.
- Provide richer run statistics for player mastery and comparison.
- Introduce optional difficulty modifiers with score multipliers.
- Maintain current performance and single-file architecture.

---

## Scope

### P0 - Must Ship

#### New Enemy Types

Add three enemies that force distinct tactics:
- Blocker: blocks trail paths and interrupts encirclement routes.
- Flanker: approaches from the side to punish predictable drift lines.
- Bomber: leaves hazard zones that alter arena control.

#### New Upgrades (5-8)

Add synergy-tagged upgrades that create build variety:
- Dash burst
- Trail burn damage
- Chain lightning on loop kill
- Heal on combo threshold
- Extra rerolls

#### Advanced Run Statistics

Expand the game-over stats with:
- Peak combo
- Near-miss count
- Drift time
- Enemies killed

#### Difficulty Modifiers

Pre-run toggles with score multipliers (examples):
- Double enemies
- Half HP
- Speed boost

### P1 - Should Ship

- Balance pass for new enemies and upgrades to avoid runaway builds.
- UI clarity for new modifiers and stats (readable at game over).
- Update run summary to include modifier list and score multiplier.

### P2 - Nice to Have

- Additional upgrade synergies beyond the initial 5-8.
- Expanded enemy tuning variations (elite versions of new types).

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

---

## Success Criteria

- Players can feel distinct playstyles from new upgrades and enemies.
- Average session length increases without raising failure frustration.
- No measurable FPS regression in PerfMon during high enemy counts.
- All new stats are correctly displayed and reset per run.

---

## Risks

- New enemies could overwhelm readability or inflate difficulty spikes.
- Upgrade synergies may produce runaway scoring or trivialize waves.
- Added stats and modifiers could clutter UI on small screens.

---

## Dependencies

- Existing single-file HTML architecture remains intact.
- No new external dependencies required for v1.1.

---

## Verification

- Play through 5+ waves with each modifier combination.
- Validate all new stats against manual observation.
- Ensure mobile touch flow works for modifier selection and upgrade picks.
- PerfMon shows stable FPS with new enemies and hazards on screen.
