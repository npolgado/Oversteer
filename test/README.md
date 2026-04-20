# Oversteer Unit Tests

Minimal unit tests live in `test/` and use the built-in Node test runner.

## Run

Legacy suite is **only** the seven `*.test.js` files in this folder (listed in `npm run test:old`). New work uses Vitest under `src/` (`npm test`).

```bash
npm run test:old
```

## Coverage Summary

- Trail geometry (`test/trail.test.js`)
- Pickup collection + boost zones (`test/pickups.test.js`)
- Upgrade touch hit-testing (`test/upgrades.test.js`)
- Wave timing + horde counts (`test/waves.test.js`)
- Near-miss scoring + streaks (`test/scoring.test.js`)

Logic helpers live in `arena-drifter/logic.js` and are shared by the game and tests.
