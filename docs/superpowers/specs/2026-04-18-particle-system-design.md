# Particle System Overhaul — Design Spec
**Date:** 2026-04-18  
**Branch:** `feature/particle-overhaul`  
**Target:** `src/` (TS/Pixi only — canvas untouched)

## Problem

The TS/Pixi particle system exists but is invisible during play. Root cause: every particle owns an individual `Graphics` object that is `clear()`'d and redrawn each frame, forcing conservative sizes (2–5px sparks) and counts to avoid frame budget collapse. Players see only the trail.

## Solution

Three parallel tracks: rendering architecture, physics model, event coverage.

---

## Rendering Architecture

| Type | Old | New |
|------|-----|-----|
| spark | Graphics rect, per-frame redraw | `Sprite` in `ParticleContainer`, `blendMode: 'add'` |
| shard | Graphics poly, per-frame redraw | `Sprite` in `ParticleContainer`, `blendMode: 'add'` |
| smoke | Graphics circle | Graphics circle (kept), ease-out alpha, 20–50px |
| ring | Graphics stroke | Graphics stroke (kept), `blendMode: 'add'`, 80–150px max |
| skid | 3×3 fillRect | Rotated quad, `angle`+`width` fields, 8s fade |

**SparkTexture:** 4×4 white `RenderTexture` created once in `pixiApp.ts`, passed to `ParticleSystem`. Sparks/shards use this as their sprite texture with `tint` for color and `alpha` for fade. Single GPU draw call for all sprites in the container.

---

## Physics Model

Two new fields on `Particle`, both optional with safe defaults:

```typescript
gravity: number  // px/s², default 0 — applied as vy += gravity * dt
drag: number     // 0–1, default 1 — applied as vx *= drag; vy *= drag per frame
```

Per-type defaults applied in `spawn()` before caller opts:

| Type  | Gravity    | Drag | Size       |
|-------|------------|------|------------|
| spark | 300 px/s²  | 0.98 | 6–14px     |
| shard | 180 px/s²  | 1.0  | 8–18px     |
| smoke | −60 px/s²  | 0.94 | 20–50px r  |
| ring  | 0          | —    | 80–150px   |

---

## Event Coverage

### New triggers
- **Handbrake burst:** 6–10 smoke behind rear wheels on handbrake press (`gameLoop.ts`)
- **Speed zone entry:** 8 cyan sparks `0x35F2D0`, forward-biased, 0.2–0.3s life
- **Drift chain upgrade:** 12–18 sparks (was 6), 8–16px, combo-colored

### Per-enemy death FX (replaces generic pink shards)
| Enemy | FX |
|-------|----|
| Chaser | 12 red sparks `0xFF4444`, ±250 vel, gravity 300 |
| Interceptor | 10 blue sparks `0x4488FF` + 1 pulse ring |
| Drifter | 8 gray smoke (rising) + 4 dark shards |
| Flanker | 14 orange sparks `0xFF8800`, forward-biased |
| Blocker | 10 green shards `0x88FF88`, low gravity |
| Bomber | 12 red shards + 6 orange smoke + shake(4, 0.2) |
| Elite | 16 gold shards `0xFFD700` (10–20px) + 10 white sparks + shake(6, 0.25) + large ring |

---

## Files Changed

| File | Change |
|------|--------|
| `src/render/particles.ts` | Core overhaul |
| `src/render/pixiApp.ts` | Create sparkTexture, pass to ParticleSystem |
| `src/gameplay/enemies/enemyDeathFx.ts` | Per-enemy death FX |
| `src/scenes/gameLoop.ts` | Handbrake, speed zone, drift chain triggers |

---

## Constraints
- All numeric constants sourced from `arena-drifter/fx.js` or `logic.js` — not from this doc
- Any code without original equivalent: `// NOTE: not in original`
- `arena-drifter/` is not touched
