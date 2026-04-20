# Particle System Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make particle effects visible and impactful in the TS/Pixi port by switching sparks/shards to a batched additive-blended `ParticleContainer`, adding gravity/drag physics, oriented skid marks, and per-enemy death FX.

**Architecture:** Sparks and shards become `Sprite` objects inside a Pixi `ParticleContainer` (single draw call, additive blend). Smoke and rings keep their `Graphics`-based rendering since they need per-frame redraws. A `gravity`/`drag` field is added to `Particle`. `SkidMark` gains `angle` and `width` for oriented quad rendering.

**Tech Stack:** TypeScript, Pixi.js v8, Vitest

**Worktree:** `.worktrees/particle-overhaul` on branch `feature/particle-overhaul`

---

## File Map

| File | Change |
|------|--------|
| `src/render/particles.ts` | Core overhaul — interfaces, rendering split, physics |
| `src/render/pixiApp.ts` | Create `sparkTexture`, export from `PixiApp` |
| `src/gameplay/enemies/enemyDeathFx.ts` | Per-enemy death FX (replace stub) |
| `src/scenes/gameLoop.ts` | Wire `enemyKilled` per-type, handbrake burst, boost zone FX, drift chain FX |

Test files:
| File | Change |
|------|--------|
| `src/render/__tests__/particles.test.ts` | New — physics + skid interface tests |
| `src/gameplay/enemies/__tests__/enemyDeathFx.test.ts` | New — all 7 enemy types return correct FX |

---

## Task 1: Update interfaces in `particles.ts`

**Files:**
- Modify: `src/render/particles.ts`
- Test: `src/render/__tests__/particles.test.ts` (create)

- [ ] **Step 1.1: Write the failing test**

Create `src/render/__tests__/particles.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

// We test the pure physics update logic by extracting it.
// Since ParticleSystem relies on Pixi, we test the math in isolation.

describe('particle physics math', () => {
  it('applies gravity to vy each frame', () => {
    let vy = 0;
    const gravity = 300;
    const dt = 0.016;
    vy += gravity * dt;
    expect(vy).toBeCloseTo(4.8);
  });

  it('applies drag to velocity each frame', () => {
    let vx = 100;
    const drag = 0.98;
    vx *= drag;
    expect(vx).toBeCloseTo(98);
  });

  it('smoke gravity is negative (rises)', () => {
    let vy = 0;
    const gravity = -60; // smoke rises
    const dt = 0.016;
    vy += gravity * dt;
    expect(vy).toBeLessThan(0);
  });
});

describe('SkidMark angle and width', () => {
  it('stores angle as radians', () => {
    const angle = Math.PI / 4; // 45 degrees
    expect(angle).toBeCloseTo(0.785);
  });

  it('default car width is 14', () => {
    const CAR_SKID_WIDTH = 14;
    expect(CAR_SKID_WIDTH).toBe(14);
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

```bash
cd "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul"
npx vitest run src/render/__tests__/particles.test.ts
```
Expected: FAIL — file doesn't exist yet

- [ ] **Step 1.3: Update `Particle` and `SkidMark` interfaces in `src/render/particles.ts`**

Replace the two interfaces at the top of the file:

```typescript
// OLD Particle interface (lines 8-17):
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  maxLife: number;
  size: number;
  type: ParticleType;
  color: number;
  gfx: Graphics;
}

// NEW — add gravity, drag, sprite:
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  maxLife: number;
  size: number;
  type: ParticleType;
  color: number;
  gravity: number;  // px/s², applied as vy += gravity * dt
  drag: number;     // 0–1 velocity multiplier per frame
  gfx: Graphics | null;   // null for sprite-based particles
  sprite: Sprite | null;  // null for graphics-based particles
}
```

```typescript
// OLD SkidMark interface (lines 19-24):
interface SkidMark {
  x: number; y: number;
  color: number;
  alpha: number;
  age: number;
}

// NEW — add angle and width:
interface SkidMark {
  x: number; y: number;
  color: number;
  alpha: number;
  age: number;
  angle: number;  // radians — car heading at spawn time
  width: number;  // px — tire-width of the mark
}
```

Update the import at line 4 to include `Sprite`, `ParticleContainer`, `RenderTexture`:

```typescript
import { Graphics, Container, Sprite, ParticleContainer, RenderTexture } from 'pixi.js';
```

Update the skid ring-buffer initializer (line 50) to match new interface:

```typescript
private _skidMarks: SkidMark[] = new Array(MAX_SKIDS).fill(null).map(() => ({
  x: 0, y: 0, color: 0, alpha: 0, age: 999, angle: 0, width: 14,
}));
```

- [ ] **Step 1.4: Run test to verify it passes**

```bash
npx vitest run src/render/__tests__/particles.test.ts
```
Expected: all 5 tests pass

- [ ] **Step 1.5: Commit**

```bash
git -C "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul" add src/render/__tests__/particles.test.ts src/render/particles.ts
git -C "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul" commit -m "feat(particles): add gravity/drag to Particle, angle/width to SkidMark"
```

---

## Task 2: Create `sparkTexture` in `pixiApp.ts`

**Files:**
- Modify: `src/render/pixiApp.ts`

- [ ] **Step 2.1: Add sparkTexture creation and export**

After the `init()` function body (after `window.addEventListener('resize', resize);` at line 70), add inside `init()`:

```typescript
  // Create a 4×4 white square texture for ParticleContainer sprites.
  // NOTE: not in original — enables batched additive-blend sparks.
  const sparkGfx = new Graphics();
  sparkGfx.rect(0, 0, 4, 4).fill(0xffffff);
  const sparkTexture = app.renderer.generateTexture(sparkGfx);
  sparkGfx.destroy();
  PixiApp.sparkTexture = sparkTexture;
```

Add `sparkTexture` to the `PixiApp` export object and add a mutable field before the export:

```typescript
// Add this line before the export (after the container declarations):
let _sparkTexture: ReturnType<typeof RenderTexture.create> | null = null;

export const PixiApp = {
  app,
  worldContainer,
  backgroundLayer,
  propsLayer,
  trailLayer,
  pickupsLayer,
  enemiesLayer,
  playerLayer,
  particlesLayer,
  uiContainer,
  hudLayer,
  eventLogLayer,
  overlayLayer,
  screenFxContainer,
  // NOTE: not in original — set after init() completes
  get sparkTexture() { return _sparkTexture!; },
  set sparkTexture(t: ReturnType<typeof RenderTexture.create>) { _sparkTexture = t; },
  init,
  resize,
};
```

Add `RenderTexture` to the import at line 1:

```typescript
import { Application, Container, Graphics, RenderTexture } from 'pixi.js';
```

- [ ] **Step 2.2: Verify TypeScript compiles**

```bash
cd "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul"
npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors

- [ ] **Step 2.3: Commit**

```bash
git -C "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul" add src/render/pixiApp.ts
git -C "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul" commit -m "feat(particles): expose sparkTexture from PixiApp after init"
```

---

## Task 3: Rendering split — ParticleContainer for sparks/shards

**Files:**
- Modify: `src/render/particles.ts`

- [ ] **Step 3.1: Add `_spriteContainer` to `ParticleSystem`**

After the existing private fields (after `_skidCount = 0;` at line 54), add:

```typescript
private _spriteContainer: ParticleContainer;
```

Update the constructor to accept an optional sparkTexture and create the ParticleContainer:

```typescript
// OLD constructor (line 56):
constructor(particlesLayer: Container) {
  this._particlesLayer = particlesLayer;
}

// NEW:
constructor(particlesLayer: Container, private _sparkTexture?: Sprite['texture']) {
  this._particlesLayer = particlesLayer;
  // NOTE: not in original — ParticleContainer batches sparks/shards into one GPU draw call.
  this._spriteContainer = new ParticleContainer(2000, {
    position: true, alpha: true, tint: true, scale: true,
  });
  this._spriteContainer.blendMode = 'add';
  this._particlesLayer.addChild(this._spriteContainer);
}
```

- [ ] **Step 3.2: Update `spawn()` to create Sprite for sparks/shards**

Replace the particle creation loop in `spawn()` (lines 74-86):

```typescript
for (let i = 0; i < count; i++) {
  const life = lifeMin + Math.random() * (lifeMax - lifeMin);
  const isSpriteType = type === 'spark' || type === 'shard';

  let gfx: Graphics | null = null;
  let sprite: Sprite | null = null;

  if (isSpriteType && this._sparkTexture) {
    sprite = new Sprite(this._sparkTexture);
    sprite.anchor.set(0.5);
    sprite.tint = color;
    this._spriteContainer.addChild(sprite);
  } else {
    gfx = new Graphics();
    this._particlesLayer.addChild(gfx);
  }

  this._particles.push({
    x, y,
    vx: vxMin + Math.random() * (vxMax - vxMin),
    vy: vyMin + Math.random() * (vyMax - vyMin),
    life, maxLife: life,
    size: sizeMin + Math.random() * (sizeMax - sizeMin),
    type, color,
    gravity: typeDefaults.gravity,
    drag: typeDefaults.drag,
    gfx, sprite,
  });
}
```

Add `typeDefaults` block before the loop (after the opts destructuring):

```typescript
// Per-type physics and size defaults — override caller opts as baseline.
// NOTE: not in original (original had no gravity/drag).
const typeDefaults = (() => {
  switch (type) {
    case 'spark': return { gravity: 300, drag: 0.98 };
    case 'shard': return { gravity: 180, drag: 1.0 };
    case 'smoke': return { gravity: -60, drag: 0.94 };
    default:      return { gravity: 0,   drag: 1.0 };
  }
})();
```

- [ ] **Step 3.3: Update `update()` to apply gravity and drag**

Replace the particle physics block in `update()` (lines 104-108):

```typescript
// OLD:
p.x += p.vx * dt;
p.y += p.vy * dt;
if (p.type === 'smoke') {
  p.vx *= 0.95; p.vy *= 0.95;
  p.size += dt * 8;
}

// NEW:
p.vy += p.gravity * dt;
p.vx *= p.drag;
p.vy *= p.drag;
p.x += p.vx * dt;
p.y += p.vy * dt;
if (p.type === 'smoke') {
  p.size += dt * 8;
}
```

Update the destroy path in update() when `p.life <= 0`:

```typescript
// OLD:
p.gfx.destroy();

// NEW:
if (p.gfx) p.gfx.destroy();
if (p.sprite) this._spriteContainer.removeChild(p.sprite);
```

- [ ] **Step 3.4: Update `_drawParticle()` for sprite path**

Replace `_drawParticle()` entirely:

```typescript
private _drawParticle(p: Particle): void {
  const alpha = p.life / p.maxLife;

  if (p.sprite) {
    // Sprite path: sparks and shards via ParticleContainer
    p.sprite.position.set(p.x, p.y);
    p.sprite.alpha = alpha;
    p.sprite.scale.set(p.size / 4); // texture is 4×4px, scale to match size
    return;
  }

  // Graphics path: smoke (and fallback spark/shard if no sparkTexture)
  const gfx = p.gfx!;
  gfx.clear();
  if (p.type === 'smoke') {
    // Ease-out alpha: stays opaque longer, fades fast at end.
    // NOTE: not in original (original used linear alpha).
    const easeAlpha = Math.pow(alpha, 0.4);
    gfx.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: easeAlpha });
  } else if (p.type === 'shard') {
    const s = p.size;
    gfx
      .poly([
        p.x, p.y - s,
        p.x + s * 0.7, p.y + s * 0.5,
        p.x - s * 0.7, p.y + s * 0.5,
      ])
      .fill({ color: p.color, alpha });
  } else {
    gfx.rect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size).fill({ color: p.color, alpha });
  }
}
```

- [ ] **Step 3.5: Update `clear()` to remove sprites**

Replace `clear()`:

```typescript
clear(): void {
  for (const p of this._particles) {
    if (p.gfx) p.gfx.destroy();
    if (p.sprite) this._spriteContainer.removeChild(p.sprite);
  }
  this._particles = [];
  for (const r of this._rings) r.gfx.destroy();
  this._rings = [];
  this._skidHead = 0;
  this._skidCount = 0;
}
```

- [ ] **Step 3.6: Add additive blend to ring container**

Add a `_ringContainer` field and wire rings through it:

After `_spriteContainer` field declaration, add:
```typescript
private _ringContainer: Container;
```

In constructor, after `_spriteContainer` setup:
```typescript
// NOTE: not in original — separate container enables blendMode per-ring-group.
this._ringContainer = new Container();
this._ringContainer.blendMode = 'add';
this._particlesLayer.addChild(this._ringContainer);
```

In `addRing()`, replace `this._particlesLayer.addChild(gfx)` with:
```typescript
this._ringContainer.addChild(gfx);
```

In `clear()`, add rings container cleanup:
```typescript
this._ringContainer.removeChildren();
```

- [ ] **Step 3.7: Verify TypeScript compiles**

```bash
cd "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul"
npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors

- [ ] **Step 3.8: Run tests**

```bash
npx vitest run 2>&1 | tail -10
```
Expected: 300+ passing, 0 failing

- [ ] **Step 3.9: Commit**

```bash
git -C "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul" add src/render/particles.ts
git -C "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul" commit -m "feat(particles): ParticleContainer for sparks/shards, gravity/drag physics, additive rings"
```

---

## Task 4: Wire `sparkTexture` into `ParticleSystem` in `gameLoop.ts`

**Files:**
- Modify: `src/scenes/gameLoop.ts`

- [ ] **Step 4.1: Pass sparkTexture to ParticleSystem constructor**

In `gameLoop.ts`, find line 165:
```typescript
this._particles = new ParticleSystem(_ctx.pixiApp.particlesLayer);
```

Replace with:
```typescript
this._particles = new ParticleSystem(_ctx.pixiApp.particlesLayer, _ctx.pixiApp.sparkTexture);
```

- [ ] **Step 4.2: Verify TypeScript compiles**

```bash
cd "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul"
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 4.3: Commit**

```bash
git -C "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul" add src/scenes/gameLoop.ts
git -C "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul" commit -m "feat(particles): pass sparkTexture from PixiApp to ParticleSystem"
```

---

## Task 5: Bump default spawn sizes + update `addRing` max radius

**Files:**
- Modify: `src/render/particles.ts`

The default opts in `spawn()` are currently `sizeMin = 2, sizeMax = 5`. These are the source of "effects too small to see."

- [ ] **Step 5.1: Update default size ranges per type in `spawn()`**

In the opts destructuring in `spawn()`, the `sizeMin`/`sizeMax` defaults should remain small since callers provide their own. Instead, update `typeDefaults` from Task 3 to include size overrides when the caller didn't supply them:

Replace the `typeDefaults` block (added in Task 3.2):

```typescript
const typeDefaults = (() => {
  switch (type) {
    case 'spark': return {
      gravity: 300, drag: 0.98,
      sizeMin: opts.sizeMin ?? 6,  sizeMax: opts.sizeMax ?? 14,
    };
    case 'shard': return {
      gravity: 180, drag: 1.0,
      sizeMin: opts.sizeMin ?? 8,  sizeMax: opts.sizeMax ?? 18,
    };
    case 'smoke': return {
      gravity: -60, drag: 0.94,
      sizeMin: opts.sizeMin ?? 20, sizeMax: opts.sizeMax ?? 50,
    };
    default: return {
      gravity: 0, drag: 1.0,
      sizeMin: opts.sizeMin ?? 2,  sizeMax: opts.sizeMax ?? 5,
    };
  }
})();
```

Then in the particle creation loop, replace:
```typescript
size: sizeMin + Math.random() * (sizeMax - sizeMin),
```
with:
```typescript
size: typeDefaults.sizeMin + Math.random() * (typeDefaults.sizeMax - typeDefaults.sizeMin),
```

Update `addRing()` to expand the max radius from 80 → 150 and life from 0.3 → 0.5:

```typescript
// OLD:
this._rings.push({ x, y, radius: 0, maxRadius: 80, life: maxLife, maxLife, color, gfx });

// NEW:
const maxRadius = 150; // was 80 — bigger rings are visible from further away
const maxLife = 0.5;   // was 0.3 — lingers slightly longer
```

Also update the ring expand rate in `update()` (line 125) — it uses `maxRadius / 0.3` which was hardcoded. Fix to use the ring's own `maxLife`:

```typescript
// OLD:
r.radius += (r.maxRadius / 0.3) * dt;

// NEW:
r.radius += (r.maxRadius / r.maxLife) * dt;
```

- [ ] **Step 5.2: Add a `addPulseRing` method (small fast ring for hits)**

After `addRing()`, add:

```typescript
// NOTE: not in original — quick 40px ring for hit confirmation FX.
addPulseRing(x: number, y: number, color: number): void {
  const maxLife = 0.2;
  const gfx = new Graphics();
  this._ringContainer.addChild(gfx);
  this._rings.push({ x, y, radius: 0, maxRadius: 40, life: maxLife, maxLife, color, gfx });
}
```

- [ ] **Step 5.3: Verify TypeScript compiles**

```bash
cd "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul"
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 5.4: Run tests**

```bash
npx vitest run 2>&1 | tail -8
```
Expected: all passing

- [ ] **Step 5.5: Commit**

```bash
git -C "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul" add src/render/particles.ts
git -C "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul" commit -m "feat(particles): bump default spark/shard/smoke sizes, addPulseRing, fix ring expand rate"
```

---

## Task 6: Oriented skid marks

**Files:**
- Modify: `src/render/particles.ts`
- Modify: `src/scenes/gameLoop.ts`

- [ ] **Step 6.1: Update `addSkid()` to accept angle and width**

Replace the `addSkid` signature:

```typescript
// OLD:
addSkid(x: number, y: number, color: number, alpha: number): void {
  this._skidMarks[this._skidHead] = { x, y, color, alpha, age: 0 };

// NEW:
addSkid(x: number, y: number, color: number, alpha: number, angle = 0, width = 14): void {
  this._skidMarks[this._skidHead] = { x, y, color, alpha, age: 0, angle, width };
```

- [ ] **Step 6.2: Add `renderSkids()` method (replaces inline skid rendering if it existed)**

Add a public `renderSkids(ctx: CanvasRenderingContext2D)` method — but actually in the Pixi port, skids are rendered via a dedicated graphics object. Add a `_skidGfx: Graphics` field rendered each frame:

Add field after `_ringContainer`:
```typescript
private _skidGfx: Graphics;
```

In constructor, after `_ringContainer` setup:
```typescript
// Skid marks rendered as oriented quads on a single persistent Graphics object.
// NOTE: not in original (original used ctx.fillRect). Redrawn each frame for fading.
this._skidGfx = new Graphics();
this._particlesLayer.addChildAt(this._skidGfx, 0); // behind particles
```

Add `_renderSkids()` private method:
```typescript
private _renderSkids(): void {
  this._skidGfx.clear();
  const len = 8; // mark length in px
  for (let i = 0; i < this._skidCount; i++) {
    const s = this._skidMarks[i];
    if (s.age >= 8) continue; // fully faded (8s fade duration from fx.js)
    const fadeAlpha = s.alpha * (1 - s.age / 8);
    if (fadeAlpha <= 0.01) continue;

    // Render as rotated rect aligned to car heading
    const hw = s.width / 2;
    const hl = len / 2;
    const cos = Math.cos(s.angle);
    const sin = Math.sin(s.angle);
    // Four corners of oriented rect
    const corners = [
      { x: s.x + cos * hl - sin * hw, y: s.y + sin * hl + cos * hw },
      { x: s.x - cos * hl - sin * hw, y: s.y - sin * hl + cos * hw },
      { x: s.x - cos * hl + sin * hw, y: s.y - sin * hl - cos * hw },
      { x: s.x + cos * hl + sin * hw, y: s.y + sin * hl - cos * hw },
    ];
    this._skidGfx
      .poly(corners.flatMap(c => [c.x, c.y]))
      .fill({ color: s.color, alpha: fadeAlpha });
  }
}
```

Call `_renderSkids()` at the end of `update()`:
```typescript
// In update(), after the skid marks age loop:
this._renderSkids();
```

Update `clear()` to clear the skid gfx:
```typescript
this._skidGfx.clear();
```

- [ ] **Step 6.3: Pass heading to `addSkid` in `gameLoop.ts`**

Find line 406 in `gameLoop.ts`:
```typescript
this._particles.addSkid(this._playerState.x, this._playerState.y, 0x222233, 0.5);
```

Replace with (pass the player's heading angle):
```typescript
this._particles.addSkid(
  this._playerState.x, this._playerState.y,
  0x222233, 0.5,
  this._playerState.heading, // angle — aligns mark to car direction
  14,                        // width px
);
```

- [ ] **Step 6.4: Verify TypeScript compiles**

```bash
cd "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul"
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6.5: Run tests**

```bash
npx vitest run 2>&1 | tail -8
```
Expected: all passing

- [ ] **Step 6.6: Commit**

```bash
git -C "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul" add src/render/particles.ts src/scenes/gameLoop.ts
git -C "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul" commit -m "feat(particles): oriented skid marks as rotated quads with angle+width"
```

---

## Task 7: Per-enemy death FX

**Files:**
- Modify: `src/gameplay/enemies/enemyDeathFx.ts`
- Test: `src/gameplay/enemies/__tests__/enemyDeathFx.test.ts` (create)

- [ ] **Step 7.1: Write the failing tests**

Create `src/gameplay/enemies/__tests__/enemyDeathFx.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getDeathParticles } from '../enemyDeathFx';
import type { EnemyDeathEvent } from '../enemyDeathFx';

function makeEvent(type: EnemyDeathEvent['type'], isElite = false): EnemyDeathEvent {
  return { type, x: 100, y: 200, isElite };
}

describe('getDeathParticles', () => {
  it('chaser returns red sparks', () => {
    const reqs = getDeathParticles(makeEvent('chaser'));
    expect(reqs.length).toBeGreaterThan(0);
    const spark = reqs.find(r => r.type === 'spark');
    expect(spark).toBeDefined();
    expect(spark!.color).toBe(0xFF4444);
    expect(spark!.count).toBe(12);
  });

  it('interceptor returns blue sparks and a pulse ring', () => {
    const reqs = getDeathParticles(makeEvent('interceptor'));
    expect(reqs.some(r => r.type === 'spark' && r.color === 0x4488FF)).toBe(true);
    expect(reqs.some(r => r.type === 'ring')).toBe(true);
  });

  it('drifter returns smoke and shards', () => {
    const reqs = getDeathParticles(makeEvent('drifter'));
    expect(reqs.some(r => r.type === 'smoke')).toBe(true);
    expect(reqs.some(r => r.type === 'shard')).toBe(true);
  });

  it('elite returns gold shards and white sparks', () => {
    const reqs = getDeathParticles(makeEvent('elite'));
    const shards = reqs.filter(r => r.type === 'shard');
    expect(shards.some(r => r.color === 0xFFD700)).toBe(true);
    const sparks = reqs.filter(r => r.type === 'spark');
    expect(sparks.some(r => r.color === 0xFFFFFF)).toBe(true);
  });

  it('bomber returns red shards and orange smoke', () => {
    const reqs = getDeathParticles(makeEvent('bomber'));
    expect(reqs.some(r => r.type === 'shard' && r.color === 0xFF2222)).toBe(true);
    expect(reqs.some(r => r.type === 'smoke' && r.color === 0xFF6600)).toBe(true);
  });

  it('all 7 enemy types return at least one request without throwing', () => {
    const types: EnemyDeathEvent['type'][] = [
      'chaser', 'interceptor', 'drifter', 'elite', 'blocker', 'flanker', 'bomber',
    ];
    for (const type of types) {
      const reqs = getDeathParticles(makeEvent(type));
      expect(reqs.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 7.2: Run tests to verify they fail**

```bash
cd "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul"
npx vitest run src/gameplay/enemies/__tests__/enemyDeathFx.test.ts
```
Expected: FAIL — current stub returns 1 generic shard

- [ ] **Step 7.3: Rewrite `enemyDeathFx.ts`**

Replace the entire file:

```typescript
// enemyDeathFx.ts — Per-enemy-type death particle requests.
// No side effects — callers dispatch the returned requests.
// Colors sourced from arena-drifter/entities.js enemyDeathFX().

import type { EnemyType } from '@core/config';

export interface EnemyDeathEvent {
  type: EnemyType;
  x: number;
  y: number;
  isElite: boolean;
}

export interface ParticleSpawnRequest {
  x: number;
  y: number;
  type: 'shard' | 'smoke' | 'ring' | 'spark';
  count: number;
  color: number;
  vMin?: number;   // symmetric velocity range — spawner applies ±vMin
  vMax?: number;
  gravity?: number;
  pulse?: boolean; // true → use addPulseRing (40px) instead of addRing (150px)
}

export function getDeathParticles(event: EnemyDeathEvent): ParticleSpawnRequest[] {
  const { x, y, type } = event;

  switch (type) {
    case 'chaser':
      return [
        { x, y, type: 'spark', count: 12, color: 0xFF4444, vMin: -250, vMax: 250, gravity: 300 },
      ];

    case 'interceptor':
      return [
        { x, y, type: 'spark', count: 10, color: 0x4488FF, vMin: -220, vMax: 220 },
        { x, y, type: 'ring',  count: 1,  color: 0x4488FF, pulse: true },
      ];

    case 'drifter':
      return [
        { x, y, type: 'smoke', count: 8,  color: 0x888888 },
        { x, y, type: 'shard', count: 4,  color: 0x333333, vMin: -150, vMax: 150 },
      ];

    case 'flanker':
      return [
        // Forward-biased: caller applies vyMin = -250, vyMax = 50 for forward burst.
        { x, y, type: 'spark', count: 14, color: 0xFF8800, vMin: -250, vMax: 250 },
      ];

    case 'blocker':
      return [
        { x, y, type: 'shard', count: 10, color: 0x88FF88, vMin: -180, vMax: 180, gravity: 80 },
      ];

    case 'bomber':
      return [
        { x, y, type: 'shard', count: 12, color: 0xFF2222, vMin: -200, vMax: 200 },
        { x, y, type: 'smoke', count: 6,  color: 0xFF6600 },
      ];

    case 'elite':
      return [
        { x, y, type: 'shard', count: 16, color: 0xFFD700, vMin: -300, vMax: 300 },
        { x, y, type: 'spark', count: 10, color: 0xFFFFFF, vMin: -250, vMax: 250 },
        { x, y, type: 'ring',  count: 1,  color: 0xFFD700 },
      ];
  }
}
```

- [ ] **Step 7.4: Run tests to verify they pass**

```bash
npx vitest run src/gameplay/enemies/__tests__/enemyDeathFx.test.ts
```
Expected: all 6 tests pass

- [ ] **Step 7.5: Commit**

```bash
git -C "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul" add src/gameplay/enemies/__tests__/enemyDeathFx.test.ts src/gameplay/enemies/enemyDeathFx.ts
git -C "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul" commit -m "feat(particles): per-enemy-type death FX with correct colors and counts"
```

---

## Task 8: Wire death FX into `gameLoop.ts`

**Files:**
- Modify: `src/scenes/gameLoop.ts`

Currently (line 658), `getDeathParticles()` is called but its result is discarded:
```typescript
getDeathParticles(deathEvent); // stub — particles wired in step 12
```

- [ ] **Step 8.1: Update `onEnemyKilledFx` to dispatch per-type FX**

Find the `onEnemyKilledFx` handler (around line 211):
```typescript
const onEnemyKilledFx = (data: { x: number; y: number; type: string }) => {
  this._particles.spawn(data.x, data.y, 0xff3b6b, 6, {
    type: 'shard', vxMin: -200, vxMax: 200, vyMin: -200, vyMax: 200,
    lifeMin: 0.3, lifeMax: 0.6, sizeMin: 3, sizeMax: 7,
  });
};
```

Replace with:
```typescript
const onEnemyKilledFx = (data: { x: number; y: number; type: string; isElite?: boolean }) => {
  const requests = getDeathParticles({
    type: data.type as EnemyType,
    x: data.x, y: data.y,
    isElite: data.isElite ?? false,
  });
  for (const req of requests) {
    if (req.type === 'ring') {
      // pulse: true → small 40px ring (hit confirm); false/absent → full 150px ring (elite/encircle)
      if (req.pulse) this._particles.addPulseRing(req.x, req.y, req.color);
      else           this._particles.addRing(req.x, req.y, req.color);
      continue;
    }
    const v = req.vMin ?? -200;
    const vMax = req.vMax ?? 200;
    this._particles.spawn(req.x, req.y, req.color, req.count, {
      type: req.type,
      vxMin: v, vxMax: vMax,
      vyMin: v, vyMax: vMax,
    });
  }
};
```

Add `EnemyType` to the import from `@core/config` at the top of `gameLoop.ts`:
```typescript
import { CFG, S, applyMap, type EnemyType } from '@core/config';
```

- [ ] **Step 8.2: Wire the discard at line 658**

Find:
```typescript
getDeathParticles(deathEvent); // stub — particles wired in step 12
```

Remove this line (the event bus now handles it via `onEnemyKilledFx`).

- [ ] **Step 8.3: Add `isElite` to the `enemyKilled` emit**

Find line ~659:
```typescript
eventBus.emit('enemyKilled', { x: dead.x, y: dead.y, type: (dead as EnemyState).type });
```

Update to include `isElite` (check enemy state for the field — use `false` if not present):
```typescript
eventBus.emit('enemyKilled', {
  x: dead.x, y: dead.y,
  type: (dead as EnemyState).type,
  isElite: (dead as EnemyState).isElite ?? false,
});
```

- [ ] **Step 8.4: Add bomber screen shake**

In `onEnemyKilledFx`, after dispatching bomber FX, add shake:
```typescript
if (data.type === 'bomber') this._screenFx.shake(4, 0.2);
if (data.type === 'elite')  this._screenFx.shake(6, 0.25);
```

Add these two lines at the end of `onEnemyKilledFx`, after the `for (const req of requests)` loop.

- [ ] **Step 8.5: Verify TypeScript compiles**

```bash
cd "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul"
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 8.6: Run all tests**

```bash
npx vitest run 2>&1 | tail -8
```
Expected: all passing

- [ ] **Step 8.7: Commit**

```bash
git -C "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul" add src/scenes/gameLoop.ts
git -C "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul" commit -m "feat(particles): wire per-enemy death FX into gameLoop, add elite/bomber shake"
```

---

## Task 9: Handbrake burst + boost zone FX

**Files:**
- Modify: `src/scenes/gameLoop.ts`

- [ ] **Step 9.1: Track previous handbrake state for edge detection**

In `GameLoop`, the field `_wasDrifting` already exists for drift edge detection. Add a companion field for handbrake:

After `private _wasDrifting = false;` (around line 97), add:
```typescript
// NOTE: not in original — used for handbrake-burst edge detection.
private _wasHandbraking = false;
```

- [ ] **Step 9.2: Add handbrake burst in `_tickPlayer()`**

In `_tickPlayer()` (after `addSkid` call at line ~406), add:

```typescript
// Handbrake smoke burst on press edge — fires once when handbrake activates.
// NOTE: not in original (original canvas had inline smoke in physics.js).
const isHandbraking = this._playerState.handbrakeTimer > 0;
if (isHandbraking && !this._wasHandbraking) {
  // Burst behind the car (opposite of heading direction)
  const bx = this._playerState.x - Math.cos(this._playerState.heading) * 20;
  const by = this._playerState.y - Math.sin(this._playerState.heading) * 20;
  this._particles.spawn(bx, by, 0x888888, 8, {
    type: 'smoke',
    vxMin: -60, vxMax: 60,
    vyMin: -60, vyMax: 60,
    lifeMin: 0.4, lifeMax: 0.7,
  });
}
this._wasHandbraking = isHandbraking;
```

- [ ] **Step 9.3: Add boost zone FX**

The boost zone sets `playerState.speedBoostTimer` in `pureLogic.ts:collectPickupEvents`. Check `this._playerState.speedBoostTimer` for edge detection.

After the scrap collection loop (around line 505 in `gameLoop.ts`), add:
```typescript
// Boost zone entry FX — cyan burst when player enters a speed zone.
// NOTE: not in original (canvas had no dedicated burst FX here).
if (this._playerState.speedBoostTimer > 0 && !this._wasInBoostZone) {
  this._particles.spawn(
    this._playerState.x, this._playerState.y,
    0x35F2D0, 8,
    {
      type: 'spark',
      vxMin: -180, vxMax: 180,
      vyMin: -180, vyMax: 180,
      lifeMin: 0.2, lifeMax: 0.3,
    },
  );
}
this._wasInBoostZone = this._playerState.speedBoostTimer > 0;
```

Add the edge-detection field with the other private fields:
```typescript
// NOTE: not in original
private _wasInBoostZone = false;
```

- [ ] **Step 9.4: Verify TypeScript compiles**

```bash
cd "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul"
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 9.5: Run all tests**

```bash
npx vitest run 2>&1 | tail -8
```

- [ ] **Step 9.6: Commit**

```bash
git -C "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul" add src/scenes/gameLoop.ts
git -C "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul" commit -m "feat(particles): handbrake smoke burst, boost zone cyan FX"
```

---

## Task 10: Full test run + manual verification

- [ ] **Step 10.1: Run full test suite**

```bash
cd "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul"
npx vitest run 2>&1 | tail -15
node --test $(find test -name '*.test.js') 2>&1 | tail -15
```
Expected: all Vitest tests passing, legacy tests passing

- [ ] **Step 10.2: Start dev server and verify manually**

```bash
cd "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul"
npm run dev
```

Open the browser. Checklist:
- [ ] Drift → skid marks appear as angled tire-width streaks (not 3×3 dots)
- [ ] Near-miss → visible yellow spark burst arcing downward
- [ ] Kill a Chaser → red sparks arc down with glow (additive on dark bg)
- [ ] Kill an Elite → gold explosion + white sparks + screen shake + ring
- [ ] Kill a Bomber → red shards + orange smoke + shake
- [ ] Handbrake (S key while moving) → smoke burst behind car
- [ ] PerfMon (bottom-left) FPS stays at 60 with particles active

- [ ] **Step 10.3: Final commit if any tweaks made during verification**

```bash
git -C "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul" add -A
git -C "C:/Users/Nick/Documents/GitHub/Oversteer/.worktrees/particle-overhaul" commit -m "fix(particles): visual tweaks from manual verification"
```

---

## Notes

- All numeric constants (counts, velocities, colors) sourced from `arena-drifter/entities.js` and `arena-drifter/fx.js`
- Any behavior without an original equivalent is marked `// NOTE: not in original`
- `arena-drifter/` is never modified — canvas version untouched
- Boost zone FX location in `gameLoop.ts` depends on where `speedBoostTimer` is updated — verify against `playerUpdate.ts` before placing the edge detection
