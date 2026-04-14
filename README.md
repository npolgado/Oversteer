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
  render/                PixiJS app, camera, particles, screen FX
  audio/                 Procedural audio (Howler + Web Audio synthesis)
  input/                 Keyboard, touch stubs
  scenes/                sceneManager, boot, menu, mapSelect, gameplay, gameOver
  gameplay/
    physics.ts           Delta-time physics (shared player + enemy)
    pureLogic.ts         Pure scoring / spawn / encirclement logic
    scoring.ts           Passive score tick, combo decay
    combat/              Collision, damage, nearMiss, chainLightning, trailBurn
    enemies/             7 enemy types — state, update, renderer, death FX
    player/              State, update (input→physics), renderer
    trail/               Point accumulation, loop detection, renderer
    world/               Procedural props (chunked, seeded RNG)
    upgrades/            26-perk registry + apply/reroll system
    spawning/            Wave manager — combat/break phases, burst, horde
  ui/
    hud/                 Score, HP, combo, wave, EventLog panels
    menus/               Upgrade card selection UI
  content/               Map definitions + modifier data
  logic/                 Barrel re-exports for test imports
arena-drifter/           Original vanilla JS game — source of truth for mechanics
  assets/                PNG sprites (cars, props, backgrounds)
test/                    Legacy test suite (node:test)
src/**/__tests__/        Vitest unit tests (14 files, ~58 tests)
```

See [patch_notes.md](patch_notes.md) for version history.

## License
im trying to use only CC0 content for the beta's and transistion to original assets 
CC0
