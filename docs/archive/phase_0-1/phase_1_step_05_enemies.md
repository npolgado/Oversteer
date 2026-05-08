# Phase 1 — Step 5: Enemy State + Update + Renderer

## Context

This step ports the `Enemy` class from `arena-drifter/entities.js` into the state/update/render split. **Phase 1 scope includes only 2 of 7 enemy types: Chaser and Interceptor.** The remaining 5 (Drifter, Blocker, Flanker, Bomber, Elite) are deferred to Phase 3.

- **Chaser**: drives straight at the player at 420 px/s
- **Interceptor**: leads the player position by 0.5s (predicts where player will be)

Both use the shared `updatePhysics()`. Enemy sprites point UP (same as player), need +90° rotation.

Enemy lifespan: 10–18s. Despawn if off-screen > 5s or > 1200px away.

**Prerequisite:** Step 2 (PlayerState, updatePhysics). Step 3 provides the minimal EnemyState interface already; this step makes it canonical.

---

## Task 5.1 — Enemy State

**Files:**
- `src/gameplay/enemies/enemyState.ts` — create

**Steps:**
1. Define `EnemyType`:
   ```typescript
   export type EnemyType = 'chaser' | 'interceptor';
   // (other types deferred to Phase 3)
   ```
2. Define `EnemyState` interface:
   ```typescript
   export interface EnemyState {
     // Identity
     id: number;              // unique ID for tracking
     type: EnemyType;
     alive: boolean;
     // Physics (implements PhysicsEntity)
     x: number; y: number; vx: number; vy: number; heading: number;
     drifting: boolean; driftJustStarted: boolean;
     maxSpeed: number; turnRate: number;
     driftKing: boolean; afterburner: boolean; nitroDrift: boolean;
     lastDriftEndTime: number; driftChain: number;
     slipTimer: number; slipStrength: number; slowTimer: number; slowStrength: number;
     wallHit: boolean;
     // Gameplay
     health: number;          // 1 for normal, 2 for elite (Phase 3)
     armored: boolean;        // armor absorbs one loop kill
     radius: number;
     baseMaxSpeed: number;
     // Lifespan
     age: number;             // seconds alive
     lifespan: number;        // random 10–18s
     offscreenTimer: number;  // seconds off-screen
     fadeAlpha: number;       // fade out on death/despawn
     // Near-miss cooldown
     nearMissCooldown: number;
     // Visual
     glowExtra: number;
     sprite: string;          // texture key
   }
   ```
3. Export `makeEnemyState(type: EnemyType, x: number, y: number, speedBonus: number): EnemyState`:
   - Set `maxSpeed` from `CFG.CHASER_SPEED` / `CFG.INTERCEPTOR_SPEED` + `speedBonus`
   - Set `turnRate` from `CFG.TURN_RATE * 1.0` (chaser) / `CFG.TURN_RATE * 0.85` (interceptor)
   - Set `lifespan = randFloat(rng, 10, 18)` — use `Math.random()` here (non-deterministic spawning is fine)
   - Select `sprite` from `CFG.ENEMY_SPRITES_BY_TYPE[type]` (random pool)
   - Set `radius = CFG.ENEMY_RADIUS`, `health = 1`, `armored = false`
4. Export `getEnemySpeed(state: EnemyState): number` — `Math.hypot(state.vx, state.vy)`.

**Depends on:** Step 1 (config, physics interface)

**Verify:** `npx tsc --noEmit` clean. `EnemyState` satisfies `PhysicsEntity`.

---

## Task 5.2 — Enemy Update

**Files:**
- `src/gameplay/enemies/enemyUpdate.ts` — create

**Steps:**
1. Export `updateEnemy(state: EnemyState, player: PlayerState, dt: number, gameClock: number): EnemyUpdateResult`:
   ```typescript
   export interface EnemyUpdateResult {
     despawned: boolean;   // true if lifespan expired or offscreen too long
   }
   ```
2. AI logic per type — compute `desiredHeading`, clamp turn input:
   - **chaser**: `desiredHeading = Math.atan2(player.y - state.y, player.x - state.x)`
   - **interceptor**: `leadX = player.x + player.vx * 0.5`, `leadY = player.y + player.vy * 0.5`; then `desiredHeading = Math.atan2(leadY - state.y, leadX - state.x)`. Uses `computeFlankTarget` is not needed here — interceptor is simpler.
3. From `desiredHeading`, compute `turnInput` in [-1, 1]:
   - `diff = angleDiff(state.heading, desiredHeading)`
   - `turnInput = clamp(diff / (state.turnRate * dt), -1, 1)`
4. Call `updatePhysics(state, dt, turnInput, 1.0 /*throttle*/, false, false, false, gameClock)`.
5. Off-screen / lifespan handling:
   - `state.age += dt`
   - Check if outside camera viewport (use a generous margin, e.g. 300px) — if so, `state.offscreenTimer += dt`, else reset to 0
   - If `state.offscreenTimer > 5` or `state.age > state.lifespan`: return `{ despawned: true }`
   - When despawning off-screen, accelerate toward player (`offscreenTimer > 2` → increase maxSpeed by 20% to help pathing back)
6. Update `state.fadeAlpha`: smoothly fade to 0 when despawning.
7. Decrement `state.nearMissCooldown` if > 0.
8. Return `{ despawned: false }` normally.

**Note:** Speed bonus scaling (enemies get faster at high scores) is applied by the wave spawner at spawn time by setting `baseMaxSpeed + speedBonus` — no need to recalculate in update.

**Depends on:** Tasks 5.1, 1.1 (updatePhysics), 2.1 (PlayerState), 1.2 (angleDiff, clamp, computeFlankTarget)

**Verify:** `npx tsc --noEmit` clean.

---

## Task 5.3 — Enemy Renderer

**Files:**
- `src/gameplay/enemies/enemyRenderer.ts` — create

**Steps:**
1. Create `EnemyRenderer` class managing a pool of sprites:
   ```typescript
   export class EnemyRenderer {
     constructor(layers: { enemiesLayer: Container });
     sync(enemies: EnemyState[]): void;   // add/remove sprites to match state array
     update(enemies: EnemyState[]): void; // update existing sprite positions
     destroy(): void;
   }
   ```
2. `sync(enemies)`: Create a `Sprite` (or `Graphics` fallback) for each new enemy, destroy sprites for removed enemies. Maintain a `Map<number, Sprite>` keyed by `enemy.id`.
3. `update(enemies)`:
   - For each enemy: `sprite.x = enemy.x`, `sprite.y = enemy.y`
   - `sprite.rotation = enemy.heading + Math.PI / 2` (sprite points UP → needs +90° to face heading direction)
   - `sprite.alpha = enemy.fadeAlpha`
   - Scale to `CFG.ENEMY_SPRITE_S`
4. Enemy-type-specific tint: chaser → no tint; interceptor → slight blue tint. (Full per-type colors in Phase 3.)

**Depends on:** Task 5.1, Phase 0 (pixiApp layers)

**Verify:** Enemy sprites appear in browser.

---

## Task 5.4 — Enemy Death FX Stub

**Files:**
- `src/gameplay/enemies/enemyDeathFx.ts` — create

**Steps:**
1. Export `EnemyDeathEvent`:
   ```typescript
   export interface EnemyDeathEvent {
     type: EnemyType;
     x: number; y: number;
     isElite: boolean;
   }
   ```
2. Export `getDeathParticles(event: EnemyDeathEvent): ParticleSpawnRequest[]`:
   - Returns an array of particle spawn requests describing what the particle system should create.
   - **Stub for now**: return a single shard burst `{ x, y, type: 'shard', count: 6, color: '#ff4444' }` for chaser, `{ ..., color: '#4444ff' }` for interceptor.
   - Full per-type FX wired in Step 12 (Screen FX + Particles).
   ```typescript
   export interface ParticleSpawnRequest {
     x: number; y: number;
     type: 'shard' | 'smoke' | 'ring' | 'spark';
     count: number;
     color: string;
   }
   ```

**Depends on:** Task 5.1

**Verify:** `npx tsc --noEmit` clean.

---

## Task 5.5 — Wire into GameplayScene

**Files:**
- `src/scenes/gameplayScene.ts` — update

**Steps:**
1. Add `enemies: EnemyState[] = []` to scene state.
2. For testing purposes, spawn a few test enemies in `enter()` — e.g., 2 chasers at random positions near the player.
3. Create `enemyRenderer = new EnemyRenderer(ctx.pixiApp)`.
4. In `update(dt)`:
   - For each enemy: call `updateEnemy(enemy, playerState, dt, gameClock)`. If `despawned`, remove from array (swap-and-pop).
   - Call `enemyRenderer.sync(enemies)` when array changes.
   - Call `enemyRenderer.update(enemies)` each frame.
   - Pass `enemies` to `updateTrail(trailState, playerState, enemies, dt, gameClock)` — trail loop detection can now kill enemies.
   - If trail `loopResult` has killed enemies: for each dead enemy, get `getDeathParticles()` result (log for now), emit `eventBus.emit('enemyKilled', { x, y, type })`.
5. In `exit()`: destroy enemy renderer.

**Depends on:** Tasks 5.1–5.4, 2.4, 3.4

**Verify:**
- `npm run dev` — enemies spawn and chase the player
- Trail encirclement kills chasers (enemies disappear when looped)

---

## Task 5.6 — Enemy Tests

**Files:**
- `src/gameplay/enemies/__tests__/enemies.test.ts` — create

**Steps:**
1. Port tests from `test/enemies.test.js`:
   - `getEnemyPool(score)` — correct types unlocked at score thresholds
   - `shouldSpawnElite(waveIndex, roll)` — elite spawn conditions
   - `computeFlankTarget` — flanker targeting geometry (Phase 3 enemy, but function is in pureLogic)
   - `computeBlockerTarget` — blocker targeting
2. New tests:
   - `makeEnemyState('chaser', ...)` — speed = CFG.CHASER_SPEED + bonus
   - `makeEnemyState('interceptor', ...)` — turn rate = CFG.TURN_RATE * 0.85
   - `updateEnemy` with age > lifespan → `despawned: true`

**Depends on:** Tasks 5.1, 5.2

**Verify:** `npm test` passes, `npm run test:old` passes.

---

## Verification — Full Step 5

1. `npx tsc --noEmit` — no errors
2. `npm test` — all vitest tests pass
3. `npm run test:old` — legacy tests pass
4. `npm run dev` — chasers and interceptors chase the player
5. Drawing a trail loop encircles and kills enemies inside
6. Enemies despawn after lifespan or when off-screen too long
