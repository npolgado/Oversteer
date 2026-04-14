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

**Docs:** `docs/roadmaps/`, `patch_notes.md`. Old experiments: `HISTORY.md`.

## Arena-drifter module load order (`index.html`)

Globals via `window.*` (call-time resolution). Order: `logic.js` → `audio.js` → `fx.js` → `input.js` → `physics.js` → `entities.js` → `world.js` → `waves.js` → `game.js`.

Key exports: `OversteerLogic`, `Audio`, `FXCache` / `Particles` / `ScreenFX` / `Camera` / `EventLog`, `Assets` / `Input`, `updatePhysics`, `Player` / `Enemy` / `enemyDeathFX`, `Props` / `Trail`, `Waves` / `ARENA_UPGRADES`, `STATE` / `Game`.

## States & controls

**Flow:** `MENU` → `MAP_SELECT` → `PLAYING` (combat / break) → `UPGRADE` → … → `DYING` → `GAME_OVER`. `PAUSED` (P/Esc), `SANDBOX` (S on menu, then map select).

**Input:** WASD/steer, Space/S+speed = handbrake, P/Esc pause, R reroll upgrades, 1–4 cards & map modifiers, Enter confirm. Touch: left stick, right drift, two-finger pause. Pause: M mute, `[]` / `-=` SFX/music.

## Gameplay (where numbers live)

- **Player:** Angle heading; drift changes lateral/forward friction; handbrake when reversing above speed threshold; sprite heading follows velocity when moving fast. Wall-riding near edge while drifting speeds up; drift chains within 0.5s apply score multipliers. Details: `physics.js`, `entities.js`, `CFG`.
- **Trail:** Points on an interval, loop check on another; `MAX_POINTS` / `CLOSE_DIST` upgradeable — see `world.js` / `Trail`.
- **Enemies:** Same physics as player; types (Chaser, Interceptor, Drifter, Blocker, Flanker, Bomber, Elite) differ by AI, speed, turn rate, unlock score — **full table in `CFG` / `entities.js`**. Bombers drop timed hazard zones (`BOMB_ZONE_*` in CFG).
- **Waves:** Combat timer ramps per wave; break phase for 1-of-3 upgrades; spawn intervals ramp; bursts; optional horde event; high-score enemy speed bonus — **`waves.js` / `CFG`**.
- **Health / damage:** Base HP, per-type hit damage, wave scaling after 5, i-frames, regen after delay — **`CFG`, `game.js`**.
- **Score / combo:** Passive tick, near-misses (enemy vs hazard radii in CFG), encirclement + combo, milestones — **`logic.js`, `game.js`**.
- **Upgrades:** 26 stackable/non-stackable perks (rerolls, trail, combat, economy) — definitions in **`waves.js` / `ARENA_UPGRADES`**; don’t duplicate the table here.
- **Pickups & boost zones:** Periodic scraps with weighted types; speed zones — **`waves.js` / `CFG`**.
- **Props:** Chunked procedural props, seeded RNG, collision types — **`world.js` / `CFG.PROP_*`**.
- **Maps:** `MAPS` + `applyMap()`, localStorage `oversteer_map_v1`.
- **Modifiers (map select):** Hard, Speed Rush, Fragile, Double Enemies — score multipliers in **`logic.js`** (`computeModifierScoreMult`).
- **Audio:** Howler one-shots + Web Audio loops; prefs `oversteer_audio_v1`. **`audio.js`**.
- **FX:** ScreenFX slowmo/shake/zoom, particles, EventLog HUD, death sequence — **`fx.js`, `game.js`**.
- **Assets:** Under `arena-drifter/assets/` (serve root). Cars point **up**; gameplay rotates +90° to face right; swap W/H when drawing if needed — **`input.js` / `Assets`**.

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

## Tutorial

Wave 1 hint until first encircle or timeout — **`game.js`**.

---
Old Roadmaps: [0.9.6 Cleanup](docs/roadmaps/version_0_9_6_cleanup/cleanup.md).
Historical versions: [HISTORY](docs/HISTORY.md).
