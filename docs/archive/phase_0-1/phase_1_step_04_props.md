# Phase 1 — Step 4: Props System

## Context

Props are the arena obstacles: trees (solid), rocks (solid), mud patches (slow), and puddles (slip). They are generated procedurally per 500×500px chunk using a seeded RNG, so the arena looks the same every run. This step ports the `Props` singleton from `arena-drifter/world.js` (~300 lines of Props logic).

Props have three gameplay effects:
1. **Solid** (tree, rock): push-out collision + bounce
2. **Slow** (mud): applies `slowTimer` + `slowStrength` debuff to player
3. **Slip** (puddle): applies `slipTimer` + `slipStrength` debuff to player

In the old code, `Props.handleCollisions` directly called `window.Particles` for FX. In the new architecture, it returns events and the caller dispatches them.

**Prerequisite:** Step 2 (PlayerState exists, GameplayScene exists).

---

## Task 4.1 — Props Types & Generation

**Files:**
- `src/gameplay/world/propsSystem.ts` — create

**Steps:**
1. Define types:
   ```typescript
   export type PropCollisionType = 'solid' | 'slow' | 'slip' | 'decoration';

   export interface Prop {
     x: number; y: number;
     radius: number;
     type: PropCollisionType;
     textureKey: string;           // asset key for PixiJS texture
     nearMissCooldown: number;     // seconds remaining on near-miss cooldown
   }

   export interface PropsState {
     chunks: Map<string, Prop[]>;  // key = 'cx,cy'
     allProps: Prop[];
   }
   ```
2. Export `makePropsState(): PropsState`.
3. Implement `generateProps(state: PropsState): void`:
   - Compute chunk grid size: `Math.ceil(CFG.WORLD_W / CFG.PROP_CHUNK_SIZE)` × same for H
   - For each chunk (cx, cy), call `_generateChunk(cx, cy, centerX, centerY, state)`
4. Implement `_generateChunk(cx, cy, centerX, centerY, state)`:
   - Seed: `cx * 7919 + cy * 104729`
   - Use `makeRng(seed)` from `@core/rng`
   - Per-chunk area × `CFG.PROP_DENSITY` → expected prop count (~2.5 per chunk)
   - Rejection-sample: must be >100px from world center (1500, 1500)
   - Select prop type via weighted random from `CFG.PROP_POOL`
   - Push to `state.chunks.get(key)` and `state.allProps`
5. Implement `getPropsNear(state: PropsState, x: number, y: number, range: number): Prop[]` — spatial lookup using chunk keys overlapping the query rect.

**Depends on:** Phase 0 (config, rng)

**Verify:** `npx tsc --noEmit` clean. `generateProps` creates expected density.

---

## Task 4.2 — Props Collision

**Files:**
- `src/gameplay/world/propsSystem.ts` — extend

**Steps:**

1. Define collision event type:
   ```typescript
   export interface PropCollisionEvent {
     type: 'solid_bounce' | 'slow_enter' | 'slip_enter';
     x: number; y: number;
   }
   ```

2. Export `checkPlayerCollision(state: PropsState, player: PlayerState): Prop[]`:
   - Get props near player using spatial lookup
   - Return props whose circle overlaps player's circle (radius from `getPlayerRadius(player)`)

3. Export `handlePropCollisions(hits: Prop[], player: PlayerState): PropCollisionEvent[]`:
   - For `solid` props: push player out of collision, reverse velocity component toward prop, multiply by `CFG.BOUNCE_RETAIN`. Set `player.wallHit = true`.
   - For `slow` props: set `player.slowTimer = CFG.MUD_SLOW_DUR`, `player.slowStrength = CFG.MUD_SLOW_STRENGTH`
   - For `slip` props: set `player.slipTimer = CFG.SLIP_DUR`, `player.slipStrength = CFG.SLIP_STRENGTH`
   - Return events for FX (caller handles particles, audio)

4. Export `checkEnemyPropCollision(state: PropsState, enemy: { x: number; y: number; vx: number; vy: number; radius: number; wallHit: boolean }): void`:
   - Bounce enemies off solid props (same push-out logic, no debuffs)

5. Export `checkNearMissProp(state: PropsState, player: PlayerState): boolean`:
   - Only when player is drifting
   - Check solid props for near-miss (within prop.radius + player.radius + `CFG.NEAR_MISS_HAZARD`)
   - Respect per-prop `nearMissCooldown` (1.2s)
   - Return true if near-miss detected, mutate cooldown on hit prop

6. Export `updatePropCooldowns(state: PropsState, dt: number): void` — decrement all nearMissCooldown values.

**Depends on:** Task 4.1, Step 2 (PlayerState)

**Verify:** `npx tsc --noEmit` clean.

---

## Task 4.3 — Props Renderer

**Files:**
- `src/gameplay/world/propsRenderer.ts` — create

**Steps:**
1. Create `PropsRenderer` class:
   ```typescript
   export class PropsRenderer {
     constructor(layers: { propsLayer: Container });
     setProps(props: Prop[]): void;
     destroy(): void;
   }
   ```
2. In `setProps(props)`:
   - Destroy existing children of `propsLayer`
   - For each prop: create a PixiJS `Sprite` from `Assets.get(prop.textureKey)`. If texture missing, create a `Graphics` circle (fallback color by type: green=tree, grey=rock, brown=mud, blue=puddle).
   - Set `sprite.x = prop.x`, `sprite.y = prop.y`, center anchor (0.5, 0.5)
   - Scale to `prop.radius * 2`
   - Add to `propsLayer`
3. Props are static — `setProps` is called once on arena generate, no per-frame update needed.

**Depends on:** Task 4.1, Phase 0 (pixiApp layers)

**Verify:** Props visible in arena in browser.

---

## Task 4.4 — Wire into GameplayScene

**Files:**
- `src/scenes/gameplayScene.ts` — update

**Steps:**
1. In `enter()`:
   - Create `propsState = makePropsState()`
   - Call `generateProps(propsState)`
   - Create `propsRenderer = new PropsRenderer(ctx.pixiApp)` and call `propsRenderer.setProps(propsState.allProps)`
2. In `update(dt)`:
   - `const propHits = checkPlayerCollision(propsState, playerState)`
   - `const propEvents = handlePropCollisions(propHits, playerState)`
   - For each `propEvents` entry of type `solid_bounce`, emit `eventBus.emit('spawnParticles', { x, y, type: 'shard', count: 2 })`
   - `updatePropCooldowns(propsState, dt)`
   - Check near-miss props: if `checkNearMissProp(propsState, playerState)`, handle scoring (Step 8 will wire this up fully)
3. In `exit()`: destroy props renderer.

**Depends on:** Tasks 4.1–4.3, 2.4

**Verify:**
- `npm run dev` — props visible in arena
- Driving into a tree bounces the car off
- Driving through mud slows the car (visible speed difference)

---

## Task 4.5 — Props Tests

**Files:**
- `src/gameplay/world/__tests__/props.test.ts` — create

**Steps:**
1. Test `_generateChunk` determinism: same seed → identical prop positions
2. Test `checkPlayerCollision`: circle overlap detection correct for solid + soft props
3. Test `handlePropCollisions`: solid bounce pushes player out; slow sets slowTimer; slip sets slipTimer
4. Test `getPropsNear`: returns only props within range query

**Depends on:** Tasks 4.1, 4.2

**Verify:** `npm test` passes, `npm run test:old` passes.

---

## Verification — Full Step 4

1. `npx tsc --noEmit` — no errors
2. `npm test` — all vitest tests pass
3. `npm run test:old` — legacy tests pass
4. `npm run dev` — props render, collisions work, mud/puddle debuffs apply
5. Props are deterministic across refreshes (seeded RNG)
