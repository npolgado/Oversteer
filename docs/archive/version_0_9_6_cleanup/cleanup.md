# Oversteer v0.9.6 Cleanup Plan

Purpose: lock down correctness, mobile playability, and performance before v1.0.
Inputs: `docs/reviews/2026-03-11.md` and `docs/unit-testing/initial-testing-plan.md`.

## Goals

- Fix known blockers that prevent full runs.
- Remove remaining performance hotspots that are already documented.
- Add a minimal test harness for deterministic logic.
- Keep the single-file game workflow intact.

## Phase 0: Baseline

- ~~Desktop: play 3+ waves and note any regressions~~. None noticed
- ~~Mobile: confirm you can start a run and reach the upgrade break.~~ Cannot reach on mobile
- ~~Record PerfMon worst frame time for a baseline.~~ roughly 17FPS, and 16.7ms

## Phase 1: P0 Blockers (Correctness + Mobile)

1. Fix pickup early-return bug.
   - Location: `arena-drifter/index.html:2123` in `Waves.update()`.
   - Requirement: multiple pickups and boost zones can be processed in the same frame.
   - Implementation: collect events during loops and handle them after both loops.

2. Menu tap-to-start on mobile.
   - Location: `arena-drifter/index.html` in `Game.update()` MENU state.
   - Requirement: one tap starts a run.
   - Implementation: add a touch flag in `Input` and consume it in MENU.

3. Mobile upgrade selection.
   - Locations: `renderUpgradeBreak()` and UPGRADE input handling.
   - Requirement: tap upgrade cards and reroll.
   - Implementation: store card bounds during render, hit-test on `touchend`.

4. Fix `Speed Demon` downside being overwritten.
   - Location: `applyUpgrade()` and `speedBonus` score scaling.
   - Requirement: enemy speed penalty always applies.
   - Implementation: separate `speedBonusFromScore` and `speedBonusFromUpgrades`.

5. Trail upgrades persist across waves.
   - Location: `Trail.reset()` and wave transition.
   - Requirement: `wider_trail` and `trail_echo` persist after break.
   - Implementation: add `Trail.clear()` or re-apply upgrade tuning on wave start.

## Phase 2: Performance Cleanup

1. Remove remaining `shadowBlur` usage.
   - Locations: `Waves.renderScraps()`, `Waves.renderBoostZones()`.
   - Implementation: pre-render glows via `FXCache` and draw sprites instead.

2. Batch trail rendering.
   - Location: `Trail.render()`.
   - Implementation: batch segments into 1-2 paths per pass.

3. Optional: props collision spatial query.
   - Location: `Props.checkPlayerCollision()`.
   - Implementation: check nearby chunks only (avoid scanning `allProps`).

## Phase 3: Asset + UX Consistency

1. Resolve missing `puddle_1.png`.
   - Location: `CFG.PROP_POOL` references `props/puddle_1.png`.
   - Action: add the asset or remove/replace the config entry.

2. Align controls text.
   - Location: `README.md` vs `renderMenu()`.
   - Action: ensure drift control and upgrade selection are consistent in both.

3. Add "Tap to start" prompt.
   - Location: `renderMenu()`.
   - Action: show for touch devices or always show both keyboard + touch prompts.

## Phase 4: Unit Tests (Minimal, High-Value)

Reference: `docs/unit-testing/unit-tests.md`.

1. Harness setup.
   - Create `test/` and use `node --test`.
   - Extract pure functions into `test/logic.js` or `arena-drifter/logic.js`.

2. Implement tests (priority order).
   - `test/trail.test.js`: encirclement geometry cases.
   - `test/pickups.test.js`: multi-collect + boost zone processing.
   - `test/upgrades.test.js`: touch hit-testing for cards + reroll.
   - `test/waves.test.js`: early wave spawn counts + horde timing.
   - `test/scoring.test.js`: near-miss and combo thresholds.

3. Pass criteria.
   - `node --test` exits 0.
   - Phase 1 and Phase 2 changes have coverage.

## Acceptance Checklist

- Desktop run: 3+ waves without regressions.
- Mobile run: tap to start + upgrade selection works.
- Pickup collection supports multiple items per frame.
- Trail upgrades persist across waves.
- `Speed Demon` penalty applies consistently.
- No remaining `shadowBlur` render paths.
- FPS worst frame time improved vs baseline.
- `node --test` passes.

## References

- `docs/reviews/2026-03-11.md`
- `docs/unit-testing/initial-testing-plan.md`
