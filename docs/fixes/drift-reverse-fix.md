# Drift & Reverse Visual Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the sprite rotation bug in `playerRenderer.ts` that causes reverse to flip the car 180° and drift to look visually wrong, plus add regression tests to lock in correct behavior.

**Architecture:** Extract a `computePlayerRotation` pure function into a PixiJS-free utils file so it can be unit tested. Update the renderer to use it — always heading-based, never velocity-based. Fix the invuln blink to match the original hard 10 Hz pattern. Add `// NOTE` comments documenting the gameClock divergence from the original.

**Tech Stack:** TypeScript, PixiJS v8, Vitest (Node environment — no jsdom, no PixiJS mocking)

---

## Root Cause

`playerRenderer.ts` contains a velocity-direction rotation branch **not present in the original**:

```typescript
// WRONG — speed > 20 causes sprite to face velocity direction
this._sprite.rotation = speed > 20
  ? Math.atan2(state.vy, state.vx) + Math.PI / 2
  : state.heading + Math.PI / 2;
```

During reverse, `vx/vy` oppose `heading` → `atan2` returns heading + π → 180° visual flip.
During drift, velocity diverges from heading (that's the point of a drift) → sprite snaps sideways.

The original (`entities.js:230`) always uses `ctx.rotate(this.heading)`. The fix is unconditional.

---

## File Map

| Action | File |
|--------|------|
| **Create** | `src/gameplay/player/playerRendererUtils.ts` |
| **Create** | `src/gameplay/player/__tests__/playerRenderer.test.ts` |
| **Modify** | `src/gameplay/player/playerRenderer.ts` |
| **Modify** | `src/gameplay/player/__tests__/playerUpdate.test.ts` |
| **Modify** | `src/gameplay/player/playerUpdate.ts` |
| **Modify** | `src/gameplay/physics.ts` |

---

## Task 1: Write failing test for `computePlayerRotation`

**Files:**
- Create: `src/gameplay/player/__tests__/playerRenderer.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// src/gameplay/player/__tests__/playerRenderer.test.ts
import { describe, it, expect } from 'vitest';
import { computePlayerRotation } from '../playerRendererUtils';

describe('computePlayerRotation', () => {
  it('returns heading + PI/2 for heading=0', () => {
    expect(computePlayerRotation(0)).toBeCloseTo(Math.PI / 2);
  });

  it('returns heading + PI/2 for arbitrary heading', () => {
    expect(computePlayerRotation(Math.PI)).toBeCloseTo(Math.PI + Math.PI / 2);
    expect(computePlayerRotation(-Math.PI / 4)).toBeCloseTo(-Math.PI / 4 + Math.PI / 2);
  });

  it('regression: heading=0 does not return PI (the reverse-flip angle)', () => {
    // Before fix: Math.atan2(-500, 0) + PI/2 = PI when reversing with heading=0
    expect(computePlayerRotation(0)).not.toBeCloseTo(Math.PI);
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

```bash
npx vitest run src/gameplay/player/__tests__/playerRenderer.test.ts
```

Expected: `FAIL` — "Cannot find module '../playerRendererUtils'"

---

## Task 2: Create `playerRendererUtils.ts` — make the test pass

**Files:**
- Create: `src/gameplay/player/playerRendererUtils.ts`

- [ ] **Step 1: Create the utils file**

```typescript
// src/gameplay/player/playerRendererUtils.ts
// Pure math helpers for player rendering — no PixiJS imports, fully testable.

/**
 * Converts a player heading (radians, 0 = right) to sprite rotation.
 * Car PNG points UP, so +PI/2 offset aligns the asset with the heading.
 * Always uses heading — never velocity direction. See entities.js:230.
 */
export function computePlayerRotation(heading: number): number {
  return heading + Math.PI / 2;
}
```

- [ ] **Step 2: Run the test — verify it passes**

```bash
npx vitest run src/gameplay/player/__tests__/playerRenderer.test.ts
```

Expected: `PASS` — 3 tests passing.

- [ ] **Step 3: Commit**

```bash
git add src/gameplay/player/playerRendererUtils.ts src/gameplay/player/__tests__/playerRenderer.test.ts
git commit -m "test: add computePlayerRotation helper and regression tests"
```

---

## Task 3: Fix `playerRenderer.ts` — rotation and invuln blink

**Files:**
- Modify: `src/gameplay/player/playerRenderer.ts`

- [ ] **Step 1: Replace the entire file content**

```typescript
// playerRenderer.ts — PixiJS player sprite renderer.
// No Canvas 2D — PixiJS only.

import { Sprite, Container, Graphics, Assets } from 'pixi.js';
import { CFG } from '@core/config';
import { type PlayerState } from './playerState';
import { computePlayerRotation } from './playerRendererUtils';

export class PlayerRenderer {
  readonly container: Container;
  private _sprite: Container;

  constructor(layers: { playerLayer: Container }) {
    this.container = layers.playerLayer;

    const texture = Assets.get(CFG.PLAYER_SPRITE);
    if (texture) {
      const spr = new Sprite(texture);
      spr.anchor.set(0.5);
      spr.width = CFG.PLAYER_SPRITE_S;
      spr.height = CFG.PLAYER_SPRITE_S;
      this._sprite = spr;
    } else {
      const g = new Graphics();
      g.rect(-CFG.PLAYER_W / 2, -CFG.PLAYER_H / 2, CFG.PLAYER_W, CFG.PLAYER_H).fill({ color: 0x00ffff });
      this._sprite = g;
    }

    // Car PNG points UP — rotate +90° to face RIGHT
    this._sprite.rotation = Math.PI / 2;
    this.container.addChild(this._sprite);
  }

  update(state: PlayerState): void {
    this._sprite.x = state.x;
    this._sprite.y = state.y;

    // Always rotate to heading — never velocity direction. See entities.js:230.
    this._sprite.rotation = computePlayerRotation(state.heading);

    // Invuln blink: hard 10 Hz flash matching original (entities.js:233-235)
    this._sprite.alpha = state.invulnTimer > 0
      ? (Math.floor(state.invulnTimer * 10) % 2 === 0 ? 0.4 : 1.0)
      : 1.0;
  }

  destroy(): void {
    this._sprite.destroy();
  }
}
```

- [ ] **Step 2: Run all tests — verify nothing broke**

```bash
npx vitest run
```

Expected: All tests pass, including the new `playerRenderer.test.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/gameplay/player/playerRenderer.ts
git commit -m "fix: player sprite always rotates to heading, not velocity direction

Removes velocity-based atan2 rotation that caused 180deg flip on reverse
and sideways snap during drift. Matches original entities.js:230 behavior.
Also fixes invuln blink from sine-wave pulse to hard 10 Hz flash."
```

---

## Task 4: Add regression test — heading unchanged during reverse

**Files:**
- Modify: `src/gameplay/player/__tests__/playerUpdate.test.ts`

- [ ] **Step 1: Add this test block at the end of the file**

```typescript
// ── Reverse heading ───────────────────────────────────────────

describe('reverse behavior', () => {
  it('heading does not change when reverse input is applied without turn input', () => {
    const s = makePlayerState();
    s.heading = 1.0; // arbitrary heading
    s.vx = 300;      // moving forward
    s.vy = 0;
    const initialHeading = s.heading;

    for (let i = 0; i < 30; i++) {
      updatePlayer(s, withInput({ down: true, gameClock: i * 0.016 }));
    }

    // Heading must not flip — reverse is velocity change only
    expect(s.heading).toBeCloseTo(initialHeading);
  });
});
```

- [ ] **Step 2: Run the test — verify it passes (physics is already correct)**

```bash
npx vitest run src/gameplay/player/__tests__/playerUpdate.test.ts
```

Expected: All tests pass including the new one.

- [ ] **Step 3: Commit**

```bash
git add src/gameplay/player/__tests__/playerUpdate.test.ts
git commit -m "test: assert heading is unchanged during reverse input"
```

---

## Task 5: Add `// NOTE` comments for gameClock divergence

**Files:**
- Modify: `src/gameplay/player/playerUpdate.ts` — line where `lastDriftEndTime` is stored
- Modify: `src/gameplay/physics.ts` — line where `lastDriftEndTime` is compared

- [ ] **Step 1: In `playerUpdate.ts`, find the line assigning `lastDriftEndTime` and add a NOTE**

Find the line (around line 125):
```typescript
state.lastDriftEndTime = state.driftTime > 0.1 ? ctx.gameClock : 0;
```

Replace with:
```typescript
// NOTE: diverges from original — original uses performance.now()/1000 (entities.js:207).
// Both store and compare use gameClock so chaining is internally consistent,
// but if gameClock resets mid-session (e.g., scene restart), lastDriftEndTime
// becomes stale and drift chaining will fail until the next drift ends.
state.lastDriftEndTime = state.driftTime > 0.1 ? ctx.gameClock : 0;
```

- [ ] **Step 2: In `physics.ts`, find the elapsed calculation and add a NOTE**

Find the line (around line 61):
```typescript
const elapsed = gameClock - ent.lastDriftEndTime;
```

Replace with:
```typescript
// NOTE: diverges from original — original uses performance.now()/1000 (physics.js:20).
const elapsed = gameClock - ent.lastDriftEndTime;
```

- [ ] **Step 3: Run all tests — verify still passing**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/gameplay/player/playerUpdate.ts src/gameplay/physics.ts
git commit -m "docs: note gameClock vs performance.now divergence from original"
```

---

## Task 6: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 2: Run legacy tests**

```bash
node --test $(find test -name '*.test.js')
```

Expected: All legacy tests pass (these are unrelated to this change but must not regress).

- [ ] **Step 3: Manual smoke test**

Start the dev server:
```bash
npm run dev
```

Verify:
- Car sprite points in the direction it's heading at all times
- Pressing down/S to reverse: car slows then moves backward, sprite stays facing forward (does NOT flip 180°)
- Holding Space at speed ≥ 180: car visually drifts with sprite facing heading direction (not sideways)
- Taking damage: sprite blinks with hard on/off flash (not a smooth pulse)
