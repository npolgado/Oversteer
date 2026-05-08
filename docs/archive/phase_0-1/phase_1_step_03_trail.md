# Phase 1 — Step 3: Trail State + Update + Renderer

## Context

The trail is the core mechanic: the player leaves a visible trail, and when it forms a closed loop, enemies inside are killed. This step ports the `Trail` object from `arena-drifter/world.js` (~200 lines of Trail-specific logic) into the state/update/render split pattern.

The loop detection logic (`checkLoop`) currently calls `window.Particles`, `window.ScreenFX`, `window.Audio`, and `window.EventLog` directly. In the new architecture, these side effects are emitted as events via `eventBus` — the callers (gameplayScene) subscribe to handle them.

**Prerequisite:** Step 2 (PlayerState exists, GameplayScene exists).

---

## Task 3.1 — Trail State

**Files:**
- `src/gameplay/trail/trailState.ts` — create

**Steps:**
1. Define types:
   ```typescript
   export interface TrailPoint { x: number; y: number; }

   export interface TrailState {
     // Ring buffer
     points: TrailPoint[];       // fixed-size array, length MAX_POINTS_CAP
     head: number;               // write index
     count: number;              // current filled count
     // Config (upgradeable)
     maxPoints: number;          // default 400, trail_echo → 600
     closeDist: number;          // default 40, wider_trail → 60
     // Timers
     recordTimer: number;        // record position every 0.05s
     checkTimer: number;         // check loop every 0.15s
     // Visual
     colorR: number; colorG: number; colorB: number;  // trail color (combo-level driven)
     // Loop flash polygon (temporary visual after encirclement)
     flashPoly: TrailPoint[] | null;
     flashPolyTimer: number;
   }
   ```
2. Export `makeTrailState(): TrailState` — initializes ring buffer array to 600 slots (`MAX_POINTS_CAP`), default maxPoints 400, closeDist 40, timers 0, default color cyan-ish.
3. Export `getTrailPoint(state: TrailState, i: number): TrailPoint` — ring-buffer indexed access: `points[(state.head - state.count + i + state.points.length) % state.points.length]`.
4. Export `pushTrailPoint(state: TrailState, x: number, y: number): void` — ring-buffer push.

**Depends on:** Phase 0 (no external deps)

**Verify:** `npx tsc --noEmit` clean.

---

## Task 3.2 — Trail Update

**Files:**
- `src/gameplay/trail/trailUpdate.ts` — create

**Steps:**
1. Export `updateTrail(state: TrailState, player: PlayerState, enemies: EnemyState[], dt: number, gameClock: number): TrailLoopResult | null`:
   - Increment `recordTimer`. When >= 0.05s, push player position into ring buffer, reset timer.
   - If `speedTrail` upgrade: `maxPoints = 400 + Math.floor(getPlayerSpeed(player) / 100)` (capped at 600).
   - Update trail color based on `player.comboLevel` (matches existing color ramp in world.js).
   - Increment `checkTimer`. When >= 0.15s, call `_detectLoop()`, reset timer.
   - Return `TrailLoopResult | null`.

2. Define `TrailLoopResult`:
   ```typescript
   export interface TrailLoopResult {
     killedEnemies: EnemyState[];   // enemies that were inside the loop
     polygon: TrailPoint[];          // the encirclement polygon (for flash FX)
     score: number;                  // raw score delta (no multiplier yet)
     encircleCount: number;          // number of enemies killed
   }
   ```

3. Implement `_detectLoop(state, enemies)` — the core encirclement algorithm:
   - Iterate trail from oldest to newest, skip most recent `SKIP_RECENT = 20` points
   - Find intersection point where path self-intersects within `state.closeDist`
   - Extract polygon: the slice of trail between the self-intersection point and the head
   - Test each enemy: `pointInPoly(enemy.x, enemy.y, polygon)` — kill enemies inside
   - Handle armored enemies: first hit strips armor, second kill
   - Return `TrailLoopResult` with killed enemies, polygon, scores
   - On kill: set `enemy.alive = false`
   - Set `state.flashPoly = polygon`, `state.flashPolyTimer = 0.4s`

4. Export `clearTrail(state: TrailState): void` — resets ring buffer (called on death/new run).

5. **No calls to audioManager, particles, eventBus** inside this module — the caller (gameplayScene) reads the result and dispatches events.

**Depends on:** Tasks 3.1, 2.1 (EnemyState needed — define a minimal `interface EnemyState { x: number; y: number; alive: boolean; armored: boolean; }` here if EnemyState doesn't exist yet), 1.2 (pointInPoly)

**Note:** `EnemyState` is formally defined in Step 5. For now, define a local interface or import a minimal one. Keep it structurally compatible so Step 5 can satisfy it.

**Verify:** `npx tsc --noEmit` clean.

---

## Task 3.3 — Trail Renderer

**Files:**
- `src/gameplay/trail/trailRenderer.ts` — create

**Steps:**
1. Create `TrailRenderer` class:
   ```typescript
   export class TrailRenderer {
     constructor(layers: { trailLayer: Container });
     update(state: TrailState): void;
     destroy(): void;
   }
   ```
2. In the constructor, create a PixiJS `Graphics` object and add it to `trailLayer`.
3. In `update(state)`:
   - Clear the graphics object each frame.
   - Draw the trail as a poly-line: iterate trail points oldest→newest, use `Graphics.moveTo/lineTo`.
   - Line width varies per segment based on point index (approximate speed proxy — use `2 + 3 * (i / state.count)` as a simple approximation; exact speed-based width from world.js can be added later).
   - Trail color from `state.colorR/G/B`.
   - If `state.flashPoly !== null && state.flashPolyTimer > 0`: draw the flash polygon as a filled transparent shape (alpha proportional to remaining timer).
4. Cull entirely if `state.count < 2`.

**Depends on:** Task 3.1, Phase 0 (pixiApp layers)

**Verify:** Trail renders as line behind player in browser.

---

## Task 3.4 — Wire into GameplayScene

**Files:**
- `src/scenes/gameplayScene.ts` — update

**Steps:**
1. In `enter()`: create `trailState = makeTrailState()`, create `TrailRenderer`.
2. In `update(dt)`:
   - Call `updateTrail(trailState, playerState, [], dt, gameClock)` — pass empty enemies array for now.
   - Read the `TrailLoopResult` return value. If non-null, emit `eventBus.emit('encirclement', { count: result.encircleCount, x: result.polygon[0].x, y: result.polygon[0].y })`.
   - Call `trailRenderer.update(trailState)`.
   - Update trail layer order (trail behind player).
3. In `exit()`: destroy trail renderer.

**Depends on:** Tasks 3.1–3.3, 2.4

**Verify:**
- `npm run dev` — trail renders behind car
- Driving a loop causes `encirclement` event (visible in console if logged)

---

## Task 3.5 — Trail Tests

**Files:**
- `src/gameplay/trail/__tests__/trail.test.ts` — create

**Steps:**
1. Port existing trail tests from `test/trail.test.js`:
   - `pointInPoly` — square polygon, point inside returns true, point outside returns false
   - Points exactly on edge
2. New tests for trail ring buffer:
   - `pushTrailPoint` wraps around correctly
   - `getTrailPoint` returns oldest point after wrap
3. New test for loop detection:
   - Simulate a trail that forms a simple loop (manually set `state.points` to a square path)
   - Verify `updateTrail` returns a non-null `TrailLoopResult` with the correct polygon
   - Enemy inside polygon → `alive = false`
   - Enemy outside → `alive = true`

**Depends on:** Tasks 3.1, 3.2

**Verify:** `npm test` passes, `npm run test:old` passes.

---

## Verification — Full Step 3

1. `npx tsc --noEmit` — no errors
2. `npm test` — all vitest tests pass
3. `npm run test:old` — legacy tests pass
4. `npm run dev` — trail renders behind car, updates as player moves
5. Drawing a loop in the browser (no enemies yet) produces flash polygon FX on trail layer
