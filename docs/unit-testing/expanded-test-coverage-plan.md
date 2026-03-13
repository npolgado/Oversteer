# Expanded Unit Test Coverage Plan

This document identifies gaps in the current test suite and proposes concrete
new tests. It builds on `initial-testing-plan.md` — the infrastructure and
patterns are already in place (`node:test`, `logic.js`, `test/*.test.js`).

## Current Coverage Summary

Already covered in `test/`:
- Enemy pool unlocking and elite spawning
- Wave timing ramps (first spawn delay, spawn interval, combat duration)
- Horde trigger timing and count scaling
- Upgrade card hit detection
- Pickup type selection by wave/score
- Near-miss scoring and streak bonuses
- Combo decay (with/without `combo_master`)
- Encirclement kill scoring
- Damage pipeline (resistance, drift shield, min-1 clamp)
- HP regen delay and clamping
- Shield break behavior
- Run stat tracking (peak combo, enemies killed, drift time, near misses)
- Difficulty modifier score multipliers
- Bomb zone damage (DPS + slow)
- Blocker/flanker AI targeting
- Trail `pointInPoly` encirclement detection

## Gaps and Proposed Tests

### 1. Physics Helpers — HIGH priority

`updatePhysics` in `physics.js` has zero test coverage. It is the most
load-bearing pure-logic code in the game. Extract the following calculations
into `logic.js` and test them.

**Functions to extract:**

```js
// Compute effective lateral friction for a physics entity
computeLatFric(drifting, driftKing, baseLat)
// Returns: drifting ? base * (driftKing ? 0.75 : 1) : 8.5

// Compute turn-rate speed-scalar
computeTurnMult(speed, maxSpeed)
// Returns: 1 - clamp(speed / maxSpeed, 0, 1) * 0.45

// Compute effective max speed during drift
computeDriftMaxSpeed(baseMax, nitroDrift, drifting)
// Returns: drifting && nitroDrift ? baseMax * 1.3 : baseMax
```

**Test cases to add to `test/physics.test.js`:**

| Test | Input | Expected |
|------|-------|----------|
| Base lat fric when not drifting | `drifting=false` | `8.5` |
| Lat fric drops while drifting | `drifting=true, driftKing=false` | `3.2` |
| `driftKing` reduces lat fric further | `drifting=true, driftKing=true` | `3.2 * 0.75 = 2.4` |
| Full speed turn reduction | `speed=maxSpeed` | `0.55` (45% reduced) |
| Zero speed turn scalar | `speed=0` | `1.0` (no reduction) |
| Half speed turn scalar | `speed=maxSpeed/2` | `0.775` |
| `nitro_drift` at max speed while drifting | `drifting=true, nitroDrift=true, base=500` | `650` |
| `nitro_drift` not drifting — no change | `drifting=false, nitroDrift=true, base=500` | `500` |

---

### 2. Drift Chain Logic — HIGH priority

Chain multipliers affect both score and boost impulse. Extract the state
machine logic for tracking drift chain level.

**Function to extract:**

```js
// Given elapsed seconds since last drift ended and current chain level,
// return the new chain level.
computeDriftChain(elapsed, currentChain)
// elapsed < 0.5 → min(2, currentChain + 1)
// elapsed >= 0.5 → 0

// Given chain level, return the boost multiplier.
driftChainBoostMult(chain)
// 0 → 1.0, 1 → 1.5, 2 → 2.0
```

**Test cases to add to `test/physics.test.js`:**

| Test | Input | Expected |
|------|-------|----------|
| Chain increments within window | `elapsed=0.3, chain=0` | `1` |
| Chain caps at 2 | `elapsed=0.3, chain=2` | `2` |
| Chain resets after window | `elapsed=0.6, chain=1` | `0` |
| Boost mult at chain 0 | `chain=0` | `1.0` |
| Boost mult at chain 1 | `chain=1` | `1.5` |
| Boost mult at chain 2 | `chain=2` | `2.0` |

---

### 3. Wall Riding Detection — HIGH priority

Pure geometry — no canvas dependency.

**Function to extract:**

```js
// Returns true when drifting within `margin` px of any arena boundary.
isWallRiding(x, y, drifting, margin, worldW, worldH)
```

**Test cases to add to `test/physics.test.js`:**

| Test | Input | Expected |
|------|-------|----------|
| Not drifting — never wall riding | `drifting=false, x=10` | `false` |
| Near left wall while drifting | `drifting=true, x=20, margin=30` | `true` |
| Near right wall | `drifting=true, x=2980, worldW=3000` | `true` |
| Near top wall | `drifting=true, y=15, worldH=3000` | `true` |
| Near bottom wall | `drifting=true, y=2985, worldH=3000` | `true` |
| Center of arena — not wall riding | `drifting=true, x=1500, y=1500` | `false` |
| Exactly at margin boundary | `drifting=true, x=30, margin=30` | `true` (≤) |
| One pixel outside margin | `drifting=true, x=31, margin=30` | `false` |

---

### 4. Enemy Elite Spawning Stats — MEDIUM priority

`shouldSpawnElite` is tested but the stat overrides applied to elites are not.

**Function to extract:**

```js
// Returns elite stat overrides given base enemy stats.
getEliteStats(baseSpeed, baseRadius, baseLifespan)
// Returns: { speed: baseSpeed * 0.9, radius: 14, lifespan: baseLifespan * 1.5, hp: 2 }
```

**Test cases to add to `test/enemies.test.js`:**

| Test | Input | Expected |
|------|-------|----------|
| Elite speed is 90% of base | `baseSpeed=420` | `378` |
| Elite radius always 14 | any | `14` |
| Elite lifespan 1.5× | `baseLifespan=12` | `18` |
| Elite HP is 2 | any | `2` |

---

### 5. Interceptor Lead Target — MEDIUM priority

`computeFlankTarget` is tested but the interceptor's leading calculation is not.

**Function to extract:**

```js
// Returns the interceptor's target position (player's position + predicted 0.5s travel).
computeInterceptTarget(playerX, playerY, playerVX, playerVY, leadTime)
// Returns: { x: playerX + playerVX * leadTime, y: playerY + playerVY * leadTime }
```

**Test cases to add to `test/enemies.test.js`:**

| Test | Input | Expected |
|------|-------|----------|
| Stationary player | `vx=0, vy=0` | Same position |
| Moving right at 200 px/s | `vx=200, vy=0, lead=0.5` | `x+100` |
| Moving diagonally | `vx=100, vy=100, lead=0.5` | `{x+50, y+50}` |

---

### 6. Upgrade Pool Filtering — MEDIUM priority

`buildUpgradeOffer` draws 3 cards from a filtered pool. The filtering rules
(max-stack limits, "already taken once" exclusions) have no tests.

**Function to extract:**

```js
// Returns available upgrade IDs given current player upgrade state.
getAvailableUpgrades(allUpgrades, takenCounts)
// Excludes upgrades where takenCounts[id] >= upgrade.maxStack (if defined)
```

**Test cases to add to `test/upgrades.test.js`:**

| Test | Input | Expected |
|------|-------|----------|
| `hp_regen` at stack 3 excluded | `takenCounts.hp_regen=3` | not in pool |
| `hp_regen` at stack 2 included | `takenCounts.hp_regen=2` | in pool |
| `extra_rerolls` at stack 2 excluded | `takenCounts.extra_rerolls=2` | not in pool |
| Non-stackable upgrade taken once excluded | `takenCounts.turbo=1` | not in pool |
| Fresh state — all upgrades available | `takenCounts={}` | full pool |

---

### 7. Score Multiplier Stacking — LOW priority

Already have `computeModifierScoreMult` tested. Add stacking with `score_freak`.

**Function to extend in `logic.js`:**

```js
// Returns total score multiplier combining modifier mult and score_freak stacks.
computeTotalScoreMult(modifierMult, scoreFreakStacks)
// Returns: modifierMult * (1.5 ** scoreFreakStacks)  [or additive — verify in code]
```

**Test cases to add to `test/scoring.test.js`:**

| Test | Input | Expected |
|------|-------|----------|
| No modifiers, no `score_freak` | `mult=1.0, stacks=0` | `1.0` |
| One `score_freak` stack | `mult=1.0, stacks=1` | `1.5` |
| Hard mode + `score_freak` | `mult=1.5, stacks=1` | `2.25` |
| Two `score_freak` stacks | `mult=1.0, stacks=2` | `2.25` |

---

### 8. Near-Miss Streak Reset — LOW priority

The streak timer is tested implicitly via score output but the reset boundary
is not tested explicitly.

**Test cases to add to `test/scoring.test.js`:**

| Test | Scenario | Expected |
|------|----------|----------|
| 3rd near-miss within 2s | streak hits 3 | `+50 * streak` bonus |
| Gap > 2s between hits | streak resets to 0 | no bonus on next hit |
| Exactly 2.0s gap (boundary) | implementation-defined | codify and test |

---

## New Test File

All physics-related tests above go into a new file:

```
test/physics.test.js
```

It follows the same pattern as existing test files:
```js
const { computeLatFric, computeTurnMult, isWallRiding, ... } = require('../arena-drifter/logic.js');
```

## Extraction Strategy

For each function listed above:
1. Add the pure function to `arena-drifter/logic.js` with a JSDoc comment.
2. Export it from the `module.exports` block at the bottom of `logic.js`.
3. Inside `index.html` (or the relevant extracted `.js` file), replace the inline
   calculation with a call to the same function via `window.OversteerLogic`.
4. Write tests in the appropriate `test/*.test.js` file.

## Priority Order

1. `test/physics.test.js` — new file, covers lat fric, turn mult, drift chain, wall riding
2. `test/enemies.test.js` additions — elite stats, interceptor lead target
3. `test/upgrades.test.js` additions — pool filtering by max stack
4. `test/scoring.test.js` additions — total score mult stacking, streak reset boundary
