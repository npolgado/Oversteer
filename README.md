# Oversteer

A top-down arena drifting game built entirely in a single HTML/Canvas/JS file. Drift through waves of enemies, chain near-misses for points, and encircle foes with your trail to destroy them.

## Gameplay

- **Arena**: Fixed 3000x3000 world with wall bouncing
- **Drift**: Slide your car to build combos and score multipliers
- **Encircle**: Your car leaves a trail — form a closed loop around enemies to kill them
- **Near-miss**: Graze enemies and hazards while drifting for bonus points
- **Upgrades**: Choose from 17 upgrades between waves to customize your build
- **Enemies**: 4 types with distinct behaviors — chasers, interceptors, drifters, and armored elites

## Controls

| Key | Action |
|-----|--------|
| W / Up | Accelerate |
| S / Down | Reverse / Handbrake (at speed) |
| A/D or Left/Right | Steer |
| Space (hold) | Drift (speed >= 180) |
| P / Escape | Pause |
| R | Reroll upgrades (during selection) |
| 1/2/3 | Select upgrade card |
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
src/                  New PixiJS + TypeScript architecture
  core/               Config, utils, RNG, event bus, save manager
  render/             PixiJS app setup, camera
  audio/              AudioManager (Howler + Web Audio)
  input/              InputManager (keyboard, touch, gamepad stub)
  scenes/             Scene manager, boot scene, playground scene
  logic/              Pure function re-exports for testing
arena-drifter/        Legacy vanilla JS game (9 modules + index.html)
  assets/             PNG sprites (cars, props, backgrounds)
test/                 Old test suite (node:test)
```

See [patch_notes.md](patch_notes.md) for version history.

## License
im trying to use only CC0 content for the beta's and transistion to original assets 
CC0
