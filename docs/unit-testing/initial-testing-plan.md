# Oversteer Unit Test Plan

This document describes a minimal, practical plan to add unit testing for the
single-file Oversteer game while keeping the current no-build, no-framework
workflow intact.

## Goals

- Validate core gameplay logic that is deterministic and easy to isolate.
- Keep tooling lightweight and optional for contributors.
- Avoid slowing down iteration on the main single-file game.

## Non-Goals

- Full end-to-end browser automation.
- Pixel-perfect rendering validation.
- Deep physics correctness (focus is regression detection, not simulation proof).

## Recommended Approach

Add a small, dependency-light test harness that runs in Node and targets pure
logic extracted to a tiny `test/` folder. Where extraction is not desirable,
wrap existing functions so they can be called from tests without changing the
runtime behavior.

## Minimal Tooling

- Node 18+.
- Optional: `vitest` or `node:test` (built-in). Prefer `node:test` to avoid
  installing dependencies.

## What to Unit Test (Priority Order)

1. **Trail Encirclement Logic**
   - Given a trail polyline and an enemy point, encirclement detection returns
     expected true/false for a set of canonical cases.
   - Edge cases: self-intersections, very small loops, enemy on boundary.

2. **Pickup Collection Logic**
   - Multiple pickups in range in a single frame are all collected.
   - Boost zones still processed after pickup collection.
   - Magnet upgrade increases effective pickup radius.

3. **Upgrade Selection Logic**
   - Given card bounds and a touch point, correct card index is selected.
   - Reroll button hit-test triggers reroll.
   - Touch coordinates with scaling (canvas scale) map correctly.

4. **Wave Spawning Rules (Lightweight)**
   - Spawn counts and difficulty ramps match expected outputs for early waves.
   - Horde timing triggers at correct wave intervals.

5. **Combo / Scoring Rules**
   - Near-miss scoring increments as expected.
   - Combo level increases at correct thresholds.

## Test Organization

Create a small folder structure:

- `test/` (new)
- `test/helpers/` (optional)

Suggested layout:

- `test/trail.test.js`
- `test/pickups.test.js`
- `test/upgrades.test.js`
- `test/waves.test.js`
- `test/scoring.test.js`

## Extraction Strategy

To keep the single-file game intact:

- Move pure logic into a tiny new module (e.g. `test/logic.js`) that exposes
  functions used by tests.
- In `index.html`, import the same functions by inlining a copy or by adding
  a small `<script>` block that defines them. Keep runtime unchanged.

If duplicating logic feels risky, extract logic into `arena-drifter/logic.js`
and include it via `<script>` in `index.html`. This still preserves the single
file for distribution if a bundling step is not required.

## Example Test Cases

### Trail Encirclement
- Triangle loop around enemy point -> true.
- Line segment only -> false.
- Enemy on the trail line -> true (or decide expected behavior and codify it).

### Pickup Collection
- Two scraps within radius -> both removed after update.
- Scrap + boost zone within radius -> both processed in same frame.

### Upgrade Selection
- Touch at center of card 2 -> selects upgrade index 1.
- Touch outside any card -> no selection.
- Touch on reroll button -> triggers reroll handler.

## Pass/Fail Criteria

- Tests run via `node --test` or `npx vitest` and exit with code 0.
- New logic changes require tests for regressions in the affected area.

## Future Enhancements

- Add a small headless canvas test for geometry if needed.
- Add a pre-commit hook to run `node --test` (optional).
