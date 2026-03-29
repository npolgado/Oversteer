# Phase 1 — Step 2: Player State + Update + Renderer + GameplayScene Shell

## Context

Step 1 delivered `updatePhysics()` and pure logic functions. This step splits the old `Player` class (from `entities.js`) into the state/render pattern and creates the `gameplayScene` shell that will host all gameplay systems. After this step, a car drives around the arena with camera following — no enemies yet.

`arena-drifter/entities.js` Player class has:
- 40+ state fields (position, velocity, heading, drift state, hp, upgrades, timers, etc.)
- `reset()` that initializes all fields
- `update(dt)` that reads from `window.Input`, `window.Audio`, calls `window.updatePhysics`, handles wall-riding, drift time, regen, etc.
- `render(ctx)` that draws the sprite + effects with Canvas 2D API

---

## Task 2.1 — Player State

**Files:**
- `src/gameplay/player/playerState.ts` — create

**Steps:**
1. Define `PlayerState` interface with all 40+ fields from `Player.reset()`, typed:
   ```typescript
   export interface PlayerState {
     // Position / velocity
     x: number; y: number; vx: number; vy: number; heading: number;
     // Drift
     drifting: boolean; driftJustStarted: boolean; driftTime: number;
     lastDriftEndTime: number; driftChain: number;
     // Stats
     maxSpeed: number; turnRate: number;
     hp: number; maxHp: number; hpRegen: number; lastHitTimer: number;
     // Defense
     shield: number; invulnTimer: number; ghostFrameTimer: number; frozen: boolean;
     // Debuffs
     slipTimer: number; slipStrength: number; slowTimer: number; slowStrength: number;
     // State
     wallHit: boolean; braking: boolean; wallRiding: boolean; comboLevel: number;
     // Handbrake
     handbrakeTimer: number;
     // Speed boost
     speedBoostTimer: number;
     // Near-miss
     consecutiveNearMisses: number; nearMissStreakTimer: number;
     // Visual
     leanTimer: number; leanDir: number; exhaustTimer: number;
     glowPhase: number; driftDeniedTimer: number;
     // Upgrades (flags)
     tightTurns: boolean; driftKing: boolean; magnetRange: number;
     scoreMult: number; thickPlating: boolean; afterburner: boolean;
     comboMaster: boolean; speedDemon: boolean; encircleScoreBonus: number;
     damageResist: number; driftShield: boolean; comboHeal: boolean;
     trailMagnet: boolean; speedTrail: boolean; dashBurst: boolean;
     dashCooldown: number; trailBurn: boolean; chainLightning: boolean;
     nitroDrift: boolean;
     // Upgrade list
     upgrades: string[];
   }
   ```
2. Export `makePlayerState(): PlayerState` factory that initializes all fields to their starting values (same values as `Player.reset()` in entities.js). Use `CFG.MAX_SPEED`, `CFG.TURN_RATE`, `CFG.PLAYER_HP` etc. for defaults.
3. Export `getPlayerSpeed(state: PlayerState): number` computed getter (replaces `player.speed` getter).
4. Export `getPlayerRadius(state: PlayerState): number` computed getter (radius shrinks 20% during drift, minus `thick_plating` reduction).

**Depends on:** Step 1 (config, physics)

**Verify:** `npx tsc --noEmit` clean. `makePlayerState()` returns correctly typed object.

---

## Task 2.2 — Player Update

**Files:**
- `src/gameplay/player/playerUpdate.ts` — create

**Steps:**
1. Define `PlayerUpdateContext` interface (inputs the update function receives):
   ```typescript
   export interface PlayerUpdateContext {
     dt: number;
     gameClock: number;        // For drift chain timing
     up: boolean; down: boolean; left: boolean; right: boolean; drift: boolean;
   }
   ```
2. Port `Player.update(dt)` logic from `entities.js` as a pure function `updatePlayer(state: PlayerState, ctx: PlayerUpdateContext): void`:
   - Compute `turnInput`, `throttle`, `braking`, `wantDrift` from input flags
   - Apply tight turns / handbrake turn rate modifier (temporarily change `state.turnRate`, restore after)
   - Apply speed demon / nitro drift / speed boost max speed modifier (temporarily change `state.maxSpeed`, restore after)
   - Call `updatePhysics(state, ctx.dt, ..., ctx.gameClock)` — state implements `PhysicsEntity`
   - Handbrake deceleration
   - Wall riding detection (within 30px of world edge while drifting)
   - Drift time accumulation
   - Apply combo decay via `applyComboDecay()`
   - HP regen via `applyHpRegen()`
   - Decrement invuln, ghostFrame, slow timers
   - Near-miss streak timer via `updateNearMissStreak()`
   - **Do NOT** call audio or particle functions — callers read state and emit events
3. Export `updatePlayer` as named export.

**Note on performance.now() removal:** The drift chain uses `lastDriftEndTime` compared to current time. Pass `ctx.gameClock` instead — same logic, no wall-clock dependency.

**Depends on:** Tasks 1.1, 1.2, 2.1

**Verify:** `npx tsc --noEmit` clean.

---

## Task 2.3 — Player Renderer

**Files:**
- `src/gameplay/player/playerRenderer.ts` — create

**Steps:**
1. Create `PlayerRenderer` class:
   ```typescript
   export class PlayerRenderer {
     readonly container: Container;
     constructor(layers: { playerLayer: Container });
     update(state: PlayerState): void;
     destroy(): void;
   }
   ```
2. In the constructor:
   - Create a PixiJS `Sprite` from `Assets.get(CFG.PLAYER_SPRITE)` (or fallback `Graphics` if texture missing)
   - `sprite.rotation` starts at `Math.PI / 2` (car PNG points UP, needs +90° to face RIGHT)
   - Add to `playerLayer`
3. In `update(state)`:
   - `sprite.x = state.x`, `sprite.y = state.y`
   - `sprite.rotation = Math.atan2(state.vy, state.vx)` when `getPlayerSpeed(state) > 20` (visual heading follows velocity = drift feel)
   - Otherwise `sprite.rotation = state.heading + Math.PI / 2`
   - `sprite.alpha = state.invulnTimer > 0 ? (Math.sin(state.invulnTimer * 30) > 0 ? 0.4 : 1.0) : 1.0` (flicker during invuln)
   - Set sprite size to `CFG.PLAYER_SPRITE_S × CFG.PLAYER_SPRITE_S`
4. No Canvas 2D — PixiJS only.

**Depends on:** Tasks 2.1, Phase 0 (pixiApp layers)

**Verify:** Sprite appears at player position in browser.

---

## Task 2.4 — GameplayScene Shell

**Files:**
- `src/scenes/gameplayScene.ts` — create
- `src/scenes/bootScene.ts` — update (transition to gameplayScene instead of playgroundScene)

**Steps:**
1. Create `GameplayScene` implementing the `Scene` interface:
   ```typescript
   class GameplayScene implements Scene {
     enter(ctx: GameContext): void;
     update(dt: number, ctx: GameContext): void;
     exit(ctx: GameContext): void;
   }
   ```
2. In `enter()`:
   - Create `playerState = makePlayerState()` — spawn at world center (1500, 1500)
   - Create `PlayerRenderer` wired to `ctx.pixiApp.playerLayer`
   - Reset camera: `ctx.camera.reset(playerState.x, playerState.y)`
   - Initialize `gameClock = 0`
3. In `update(dt, ctx)`:
   - `gameClock += dt`
   - Read input: `const input = ctx.getInput().poll()`
   - Call `updatePlayer(playerState, { dt, gameClock, up: input.up, down: input.down, left: input.left, right: input.right, drift: input.drift })`
   - Call `playerRenderer.update(playerState)`
   - Call `ctx.camera.update(dt, playerState.x, playerState.y, playerState.vx, playerState.vy, getPlayerSpeed(playerState))`
4. In `exit()`:
   - Destroy player renderer
   - Clear all world-layer children
5. Update `bootScene.ts` to transition to `GameplayScene` on load complete instead of `PlaygroundScene`.

**Depends on:** Tasks 2.1, 2.2, 2.3, Phase 0 (sceneManager)

**Verify:**
- `npm run dev` — car sprite visible, moves with WASD, camera follows
- Drift feel: holding Space while moving causes lateral slide
- Car sprite rotates to follow velocity direction during drift
- `npx tsc --noEmit` clean

---

## Verification — Full Step 2

1. `npx tsc --noEmit` — no errors
2. `npm test` — all vitest tests pass
3. `npm run test:old` — legacy tests pass
4. `npm run dev` — car drives around arena, WASD controls work, camera follows
5. Drift mechanics feel correct (compare side-by-side with `npx serve arena-drifter`)
6. Wall boundary: car cannot leave the 3000×3000 world
7. No console errors in browser
