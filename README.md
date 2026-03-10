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
| P / Escape | Pause |
| R | Reroll upgrades (during selection) |
| 1/2/3 | Select upgrade card |
| S (menu only) | Sandbox mode |

**Touch (mobile, TO DO TEST)**: Left-side virtual stick, right-side drift button, two-finger pause.

## Setup

Requires [Node.js](https://nodejs.org/) (for the static file server).

```bash
git clone https://github.com/your-username/Oversteer.git
cd Oversteer
npx serve arena-drifter
```

Then open the URL shown in your terminal (usually `http://localhost:3000`).

No build step, no dependencies, no bundler — just a static file server serving a single HTML file.

## Project Structure

```
arena-drifter/
  index.html          The entire game (~3800 lines)
  assets/
    cars/             Car sprites (player + enemies)
    props/            Environment sprites (trees, rocks, mud, etc.)
```

See [patch_notes.md](patch_notes.md) for version history.

## License

CC0
