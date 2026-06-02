# Oversteer

A top-down arena drifting game. Drift through waves of enemies, chain near-misses for points, and encircle foes with your trail to destroy them. Ships as a vanilla JS game (`arena-drifter/`) with a full TypeScript + PixiJS port in progress under `src/`.

## Play Online

**[https://npolgado.github.io/Oversteer/](https://npolgado.github.io/Oversteer/)** — no install required.

## Gameplay

- **Arena**: Fixed 3000x3000 world with wall bouncing
- **Drift**: Slide your car to build combos and score multipliers
- **Encircle**: Your car leaves a trail — form a closed loop around enemies to kill them
- **Near-miss**: Graze enemies and hazards while drifting for bonus points
- **Upgrades**: Choose from 26 upgrades between waves to customize your build
- **Enemies**: 7 types with distinct behaviors — Chaser, Interceptor, Drifter, Blocker, Flanker, Bomber, and armored Elite

## Controls

| Key | Action |
|-----|--------|
| W / Up | Accelerate |
| S / Down | Reverse / Handbrake (at speed) |
| A/D or Left/Right | Steer |
| Space (hold) | Drift (speed >= 180) |
| P / Escape | Pause |
| R | Reroll upgrades (during selection) |
| 1/2/3/4 | Select upgrade card / map modifier |
| Enter | Confirm map modifier selection |
| S (menu only) | Sandbox mode |

**Touch (mobile, TO DO TEST)**: Tap to start, left-side virtual stick, right-side drift button, two-finger pause.

## Setup

Requires [Node.js](https://nodejs.org/).

### New architecture (PixiJS + TypeScript + Vite)

```bash
git clone https://github.com/npolgado/Oversteer.git
cd Oversteer
npm install
npm run dev
```

Vite opens the browser automatically. The new stack lives in `src/`.

### Legacy (vanilla JS)

The original game in `arena-drifter/` is still runnable:

```bash
npx serve arena-drifter
```

Then open the URL shown in your terminal (usually `http://localhost:3000`).

## Situation Tester (DEV only)

Skip straight to any game state without playing through earlier waves — useful for validating boss changes, biome behavior, or upgrade interactions.

**Named presets** are defined in `src/dev/scenarios.json`. Use the preset id in the URL when running the dev server:

```bash
npm run dev
# then open:
http://localhost:5173/?situation=boss-core-w10
```

| Preset | What it loads |
|--------|---------------|
| `boss-pursuer-w5` | Wave 5 Pursuer boss, wasteland biome |
| `boss-core-w10` | Wave 10 Core boss, rupture biome |
| `boss-reflector-w15` | Wave 15 Reflector boss, jungle biome |
| `boss-core-w10-loaded` | Wave 10 Core boss + 4 upgrades (turbo, shield, magnet, combo master) |
| `biome-jungle-fresh` | Wave 15, jungle biome, no upgrades |
| `splitter-stress-w8` | Wave 8, rupture biome, offensive upgrades (trail burn, chain lightning) |
| `boss-pursuer-w5-fragile` | Wave 5 Pursuer boss, 1 HP |

**Live iteration** — reload any situation mid-session from the browser console without a page refresh:

```js
__oversteer.loadSituation('boss-pursuer-w5-fragile')

// Ad-hoc one-off (no preset needed):
__oversteer.loadSituation({ wave: 20, biome: 'jungle', boss: 'reflector', upgrades: ['turbo', 'shield'], hp: 1 })
```

To add a preset for your branch, append an entry to `src/dev/scenarios.json`. Fields: `id`, `name`, `wave` (required), plus optional `biome`, `boss` (`pursuer`/`core`/`reflector`), `upgrades` (array of upgrade ids), `hp`, `maxHp`.

> The situation tester is **DEV-only** — it cannot be activated in production builds.

## Benchmarking

Compares the TypeScript/PixiJS build against the vanilla `arena-drifter/` build across 6 scenarios (idle/drift × 5/15/30 enemies).

```bash
npm run bench:web
```

Then open `http://localhost:3000/benchmark.html` and click **Run Benchmark**.

## Developers

To enable the pre-push test hook, run:

```bash
scripts/install-hooks
```

On Linux/macOS you may need:

```bash
chmod +x .githooks/pre-push scripts/install-hooks
```

## Project Structure

```
src/                     PixiJS + TypeScript port
  core/                  Config, RNG, utils, event bus, save manager
  render/                PixiJS app, camera, particles, screen FX, speed lines, pickups, tweens
  audio/                 Procedural audio (Web Audio API synthesis + .mp3 music tracks)
  input/                 Keyboard, touch stubs
  debug/                 Dev-only overlay: logger, errorBanner, watchdog, renderProbe, layerInspect
  bench/                 Benchmark utilities
  scenes/                sceneManager, boot, menu, mapSelect, gameplay, gameOver
  gameplay/
    physics.ts           Delta-time physics (shared player + enemy)
    pureLogic.ts         Pure scoring / spawn / encirclement logic
    scoring.ts           Passive score tick, combo decay
    combat/              Collision, damage, nearMiss, chainLightning, trailBurn
    death/               Death sequence and animation
    enemies/             7 enemy types — state, update, renderer, death FX
    player/              State, update (input→physics), renderer
    trail/               Point accumulation, loop detection, renderer
    world/               Procedural props (chunked, seeded RNG)
    upgrades/            26-perk registry + apply/reroll system
    upgradeBreak/        Upgrade-selection phase logic
    spawning/            Wave manager — combat/break phases, burst, horde
  ui/
    textStyles.ts        Shared text style presets
    hud/                 Score, HP, combo, wave, EventLog panels
    menus/               Upgrade card selection UI
  content/               Map definitions + modifier data
  logic/                 Barrel re-exports for test imports
arena-drifter/           Original vanilla JS game — source of truth for mechanics
  assets/                PNG sprites (cars, props, backgrounds)
test/                    Legacy test suite (node:test)
src/**/__tests__/        Vitest unit tests (30 files, ~600 tests)
```

See [patch_notes.md](docs/patch_notes.md) for version history.

## License
im trying to use only CC0 content for the beta's and transistion to original assets 
CC0
