# Phase 1 — Step 12: Screen Effects + Particles

## Context

This step ports `Particles` and `ScreenFX` from `arena-drifter/fx.js` (~350 lines combined). These are the last major presentation layer components. PixiJS replaces Canvas 2D rendering throughout.

Key systems:
- **Particles**: shard (death/explosions), smoke (despawn), ring (milestones/encirclement), spark (wall-riding). Uses PixiJS `Graphics` objects.
- **Skid marks**: ring buffer of 600 fading marks. PixiJS `Graphics` lines.
- **ScreenFX**: time dilation (slowmo), directional shake (biased toward source direction), flash (color overlay), zoom pulse, freeze, desaturation. Applied by manipulating `worldContainer` transform and `screenFxContainer` overlay.

**Prerequisite:** Step 6+ (gameplay events exist to trigger FX).

---

## Task 12.1 — Particle System

**Files:**
- `src/render/particles.ts` — create

**Steps:**
1. Define types:
   ```typescript
   export type ParticleType = 'shard' | 'smoke' | 'ring' | 'spark';

   export interface Particle {
     x: number; y: number;
     vx: number; vy: number;
     life: number;      // seconds remaining
     maxLife: number;
     size: number;
     type: ParticleType;
     color: number;     // PixiJS hex int (0xRRGGBB)
     gfx: Graphics;     // PixiJS Graphics object
   }

   export interface SkidMark {
     x: number; y: number;
     color: number;
     alpha: number;
   }

   export interface Ring {
     x: number; y: number;
     radius: number;
     maxRadius: number;
     color: number;
     alpha: number;
   }
   ```
2. Create `ParticleSystem` class:
   ```typescript
   export class ParticleSystem {
     constructor(layers: { particlesLayer: Container; trailLayer: Container });
     spawn(x: number, y: number, color: number, count: number, opts?: {
       type?: ParticleType;
       speed?: number;
       size?: number;
       life?: number;
     }): void;
     addSkid(x: number, y: number, color: number, alpha: number): void;
     addRing(x: number, y: number, color: number): void;
     update(dt: number): void;
     renderSkids(ctx: Graphics): void;   // draws skids onto a persistent graphics layer
     destroy(): void;
   }
   ```
3. In `spawn()`: create `count` particles with randomized velocity directions, add `Graphics` circles to `particlesLayer`.
4. In `update(dt)`:
   - For each particle: `life -= dt`, move by velocity, decay velocity
   - **Smoke**: size grows by 2×dt, alpha fades
   - **Shard**: bounces off floor (no actual physics — just linear motion + fade)
   - **Ring**: radius grows to `maxRadius` over 0.5s, alpha fades
   - Use swap-and-pop removal, `gfx.destroy()` on removal
5. Skid marks: ring buffer of 600, alpha decays at 0.3/s.
6. Ring: expanding circle drawn as `Graphics.circle()`, fades out.

**Depends on:** Phase 0 (pixiApp particlesLayer)

**Verify:** `npx tsc --noEmit` clean.

---

## Task 12.2 — ScreenFX

**Files:**
- `src/render/screenFx.ts` — create

**Steps:**
1. Define effect state:
   ```typescript
   export interface ScreenFxState {
     // Shake
     shakeIntensity: number;
     shakeDur: number;
     shakeDir: { x: number; y: number };
     // Flash
     flashAlpha: number;
     flashColor: number;
     flashDur: number;
     // Zoom
     zoomPulse: number;    // additive to base zoom, fades out
     // Slowmo
     slowmoFactor: number; // 0 = frozen, 1 = normal
     slowmoDur: number;
     // Freeze
     freezeDur: number;
     // Desaturation
     desatAlpha: number;
   }
   ```
2. Create `ScreenFX` class:
   ```typescript
   export class ScreenFX {
     constructor(containers: { worldContainer: Container; screenFxContainer: Container });
     shake(intensity: number, dur: number, dirX?: number, dirY?: number): void;
     flash(color: number, alpha: number, dur: number): void;
     zoomPulse(amount: number): void;
     slowmo(factor: number, dur: number): void;
     freeze(dur: number): void;
     desaturate(alpha: number): void;
     update(rawDt: number): number;   // returns dilated dt (or 0 during freeze)
     applyTransform(): void;          // apply shake + zoom to worldContainer
     destroy(): void;
   }
   ```
3. In `update(rawDt)`:
   - If `freezeDur > 0`: `freezeDur -= rawDt`, return 0
   - Apply slowmo: `dt = rawDt * slowmoFactor`; decrement `slowmoDur`, lerp `slowmoFactor` back to 1.0
   - Decay shake, flash, zoom pulse
   - Return dilated `dt`
4. In `applyTransform()`:
   - Shake offset: `70%` biased toward `shakeDir`, `30%` random. Apply to `worldContainer.x/y`.
   - Zoom: base 1.0 + speed-based zoom (from camera) + `zoomPulse`. Apply to `worldContainer.scale`.
   - Flash overlay: update `screenFxContainer` Graphics alpha and fill color.
5. Desaturation: apply via PixiJS `ColorMatrixFilter` on `worldContainer` with a grayscale matrix at `desatAlpha` blend.

**Note:** The Camera already handles speed-based zoom and position lerp. `ScreenFX` adds transient effects on top (shake offset, zoom pulse) that are separate from the smooth follow.

**Depends on:** Phase 0 (pixiApp worldContainer, screenFxContainer)

**Verify:** `npx tsc --noEmit` clean.

---

## Task 12.3 — Wire Into GameplayScene

**Files:**
- `src/scenes/gameplayScene.ts` — update

**Steps:**
1. Create `particleSystem = new ParticleSystem(ctx.pixiApp)` and `screenFx = new ScreenFX(ctx.pixiApp)` in `enter()`.
2. In `update(rawDt)`:
   - Get dilated dt: `const dt = screenFx.update(rawDt)`
   - Pass dilated `dt` to all game logic updates (player, enemies, trail, waves, etc.)
   - `screenFx.applyTransform()` after all updates
3. Subscribe to eventBus for FX triggers:
   - `nearMiss`: `screenFx.slowmo(0.85, 0.15)` + `particleSystem.spawn(x, y, 0xffff00, 4, { type: 'spark' })`
   - `playerDamaged`: `screenFx.shake(4, 0.2, knockbackDir.x, knockbackDir.y)` + `screenFx.slowmo(0.9, 0.1)`
   - `enemyKilled` (from encirclement): `particleSystem.addRing(x, y, 0x00ffcc)`
   - `encirclement`: `screenFx.shake(6, 0.25)` + ring particle per kill
   - `playerDied`: `screenFx.freeze(0.1)` + `screenFx.slowmo(0.35, 0.35)` + `screenFx.desaturate(0.8)` + shards
4. Wire enemy death FX: replace stub from Step 5 with actual particle calls using `getDeathParticles()` → `particleSystem.spawn(...)`.
5. Player wall-riding: spawn spark particles along nearest wall edge each frame while drifting near boundary.
6. Skid marks: call `particleSystem.addSkid()` from player renderer when drifting (read `playerState.drifting`).

**Depends on:** Tasks 12.1, 12.2, Step 6+

**Verify:**
- `npm run dev` — near-miss causes brief slowmo
- Enemy death spawns colored sparks
- Player collision shakes the screen
- Death triggers freeze + slowmo + desaturation
- Trail sparks appear when wall-riding

---

## Task 12.4 — Arena Boundary Rendering

**Files:**
- `src/scenes/gameplayScene.ts` or `src/render/arenaRenderer.ts` (if desired) — update

**Steps:**
1. Draw the arena boundary as a multi-pass glow on `backgroundLayer`:
   - 3 passes: lineWidth 14/8/2, opacity pulsing with `Math.sin(gameClock * 2)`
   - Color: `CFG.C_ACCENT` (cyan)
   - Rect: 0,0 to `CFG.WORLD_W × CFG.WORLD_H`
2. This can be a static `Graphics` object updated each frame for the pulse, or pre-rendered if performance demands.

**Depends on:** Phase 0 (pixiApp backgroundLayer)

**Verify:** Glowing arena boundary visible in browser.

---

## Verification — Full Step 12

1. `npx tsc --noEmit` — no errors
2. `npm test` — all vitest tests pass
3. `npm run test:old` — legacy tests pass
4. `npm run dev`:
   - Near-miss: brief slowmo + sparks
   - Enemy death: colored particle burst
   - Player hit: screen shake
   - Death: freeze + slowmo + desaturation + shards
   - Wall-riding: spark particles
   - Arena boundary glows and pulses
   - Skid marks appear during drift
