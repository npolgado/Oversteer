# Oversteer

Top-down arena drift game: 3000×3000 world, waves, trail encirclement kills, near-miss / combo scoring. Physics use delta time (px/s).

## Run & layout

| What | Command / path |
|------|----------------|
| **Shipped game (canvas)** | `npx serve arena-drifter` — **source of truth** for mechanics |
| **Hosted (GitHub Pages)** | `https://npolgado.github.io/Oversteer/` — deploy via Actions → **Deploy Arena Drifter** → Run workflow |
| **TS / Pixi port** | `npm run dev` (Vite), sources under `src/` |
| **Resolution** | Design ref 1600×900 (`CFG.W`/`CFG.H`) |

**Repo:** `arena-drifter/` — `index.html` + 9 JS modules. Shared logic in `logic.js` (CFG, `U`/`S`, pure functions — e.g. `getEnemyPool`, `shouldSpawnElite`, `computeFlankTarget`, `computeBlockerTarget`, `applyBombZoneDamage`, `computeModifierScoreMult`). Tests: legacy **`test/*.test.js`** (allowlisted in `npm run test:old`) + Vitest `src/**/*.test.ts` (`npm test`). Pre-push runs both.

**Docs:** `docs/archive/version_1_roadmap/`, `patch_notes.md`. Old experiments: `HISTORY.md`.

## Arena-drifter module load order (`index.html`)

Globals via `window.*` (call-time resolution). Order: `logic.js` → `audio.js` → `fx.js` → `input.js` → `physics.js` → `entities.js` → `world.js` → `waves.js` → `game.js`.

Key exports: `OversteerLogic`, `Audio`, `FXCache` / `Particles` / `ScreenFX` / `Camera` / `EventLog`, `Assets` / `Input`, `updatePhysics`, `Player` / `Enemy` / `enemyDeathFX`, `Props` / `Trail`, `Waves` / `ARENA_UPGRADES`, `STATE` / `Game`.

## Testing & conventions

- Extract testable logic into **`arena-drifter/logic.js`** with exports; mirror in **`test/*.test.js`**. Run **`npm test`** (Vitest) and **`npm run test:old`** before push.
- Hot paths: avoid `.filter()` on per-frame arrays — swap-and-pop. This applies to **ported code too** — upgrade `splice()` to swap-and-pop when porting JS→TS regardless of what the original did. Reset game-loop `lastTime` on state transitions to avoid dt spikes. New upgrade flags: **initialize in `Player` constructor**. **`startWave()`** must clear scraps, boost zones, `_burstQueue`.
- **Write tests proportional to complexity.** Functions >100 lines or with many flag branches need tests even when the plan doesn't require them. Don't wait for a plan to mandate coverage on complex update functions.

## TS port rules (JS → TypeScript migration)

- **Original source is truth, not the plan.** Plans can have wrong values. For any timer, duration, or threshold constant, cross-reference the original JS file directly. Plans are guides; the `.js` file is the spec.
- **Flag all silent additions.** Any code in the port that has no direct equivalent in the original JS must have a comment: `// NOTE: not in original`. Silent behavioral additions are the hardest bugs to find.
- **Symmetric behaviors use the same CFG key.** If player bounce uses `CFG.BOUNCE_RETAIN`, enemy bounce must too. A literal on one side of a symmetric pair is a bug.
- **Trace coordinate systems before porting spatial checks.** `camera.isVisible()` is the viewport check; raw world boundary comparisons (`x < -300`) are not equivalent. Always confirm which system the original uses.
- **Per-frame flag resets travel with their physics call.** If `playerUpdate` resets `wallHit` and `driftJustStarted` before `updatePhysics()`, every other caller must do the same. Resets are part of the call contract.

