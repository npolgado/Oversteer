# Phase 1 — Step 6: Collision + Damage + Near-Miss

## Context

This step extracts the collision detection, damage pipeline, and near-miss system from `arena-drifter/game.js`. In the old code, these are deeply interleaved with FX calls and state mutations in `Game.update()`. The new architecture separates them into pure detection functions + a damage pipeline that returns events.

Key mechanics:
- **Collision**: Circle-circle test between player and each enemy. On hit: damage + knockback + invulnerability frames.
- **Shield absorption**: Shield upgrade absorbs one collision (no damage, but knockback + 1s invulnerability).
- **Damage resistance**: `damage_resist` upgrade reduces damage by 25% per stack (diminishing).
- **Drift shield**: `drift_shield` upgrade reduces damage 40% while drifting.
- **Near-miss**: Enemy passes within `NEAR_MISS_ENEMY` (8px) additive to collision radius while player is drifting. Awards 25 pts, combo boost, ghost frame activation.
- **Near-miss streak**: 3+ consecutive within 2s → 50 × streak bonus.

**Prerequisite:** Steps 2 (PlayerState), 5 (EnemyState).

---

## Task 6.1 — Collision Detection

**Files:**
- `src/gameplay/combat/collision.ts` — create

**Steps:**
1. Export `checkPlayerEnemyCollision(player: PlayerState, enemy: EnemyState): boolean`:
   - Circle-circle test: `dist(player, enemy) < getPlayerRadius(player) + enemy.radius`
   - Skip if `enemy.alive === false` or `player.invulnTimer > 0`
2. Export `checkNearMiss(player: PlayerState, enemy: EnemyState): boolean`:
   - Only when `player.drifting === true`
   - Distance < `getPlayerRadius(player) + enemy.radius + CFG.NEAR_MISS_ENEMY`
   - But distance >= collision threshold (not a hit)
   - `enemy.nearMissCooldown <= 0` (1.2s cooldown per enemy)
3. Export `applyKnockback(player: PlayerState, source: { x: number; y: number }, strength: number): void`:
   - Direction from source → player
   - Add `strength` velocity along that direction

**Depends on:** Steps 2, 5 (PlayerState, EnemyState)

**Verify:** `npx tsc --noEmit` clean.

---

## Task 6.2 — Damage Pipeline

**Files:**
- `src/gameplay/combat/damage.ts` — create

**Steps:**
1. Define result type:
   ```typescript
   export interface DamageResult {
     type: 'hit' | 'shield_break' | 'blocked';
     finalDamage: number;
     knockbackDir: { x: number; y: number };
   }
   ```
2. Export `processPlayerHit(player: PlayerState, enemy: EnemyState, waveIndex: number): DamageResult`:
   - If `player.invulnTimer > 0`: return `{ type: 'blocked', finalDamage: 0, ... }`
   - Compute base damage from `CFG.DMG_CHASER` / `CFG.DMG_INTERCEPTOR` based on `enemy.type`
   - Scale by wave: `computeCollisionDamage(baseDmg, waveIndex)` from pure logic
   - Apply `applyDriftShield(damage, player.drifting, player.driftShield)` from pure logic
   - If `player.shield > 0`: call `applyShieldBreak(player)`, set `player.invulnTimer = 1.0`, apply knockback, return `{ type: 'shield_break', finalDamage: 0, ... }`
   - Otherwise: call `applyPlayerDamage(player, damage, player.drifting)`, set `player.invulnTimer = CFG.HIT_INVULN_DUR` (0.8s), apply knockback 120 px/s, return `{ type: 'hit', finalDamage: damage, ... }`
   - Check death: if `player.hp <= 0`, emit via eventBus later (caller handles)
3. Pure functions `applyPlayerDamage`, `applyShieldBreak`, `applyDriftShield` already exist in `pureLogic.ts` from Step 1 — reuse them.

**Depends on:** Task 6.1, Step 1 (pure logic functions)

**Verify:** `npx tsc --noEmit` clean.

---

## Task 6.3 — Near-Miss System

**Files:**
- `src/gameplay/combat/nearMiss.ts` — create

**Steps:**
1. Define result type:
   ```typescript
   export interface NearMissResult {
     scoreDelta: number;
     newComboLevel: number;
     streakBonus: number;     // 0 unless 3+ consecutive
     enemy: EnemyState;       // which enemy triggered it
   }
   ```
2. Export `processNearMiss(player: PlayerState, enemy: EnemyState, score: number): NearMissResult`:
   - Call `applyNearMiss(score, player, 'enemy')` from pure logic
   - Call `applyGhostFrameNearMiss(player, player.ghostFrameTimer !== undefined)` if ghost_frame upgrade
   - Set `enemy.nearMissCooldown = CFG.NEAR_MISS_COOLDOWN` (1.2s)
   - Return `{ scoreDelta, newComboLevel, streakBonus }`
3. Export `processHazardNearMiss(player: PlayerState, score: number): NearMissResult`:
   - Call `applyNearMiss(score, player, 'hazard')` — 15 pts instead of 25

**Depends on:** Step 1 (pure logic), Steps 2, 5

**Verify:** `npx tsc --noEmit` clean.

---

## Task 6.4 — Wire into GameplayScene

**Files:**
- `src/scenes/gameplayScene.ts` — update

**Steps:**
1. In the `update(dt)` loop, after updating player and enemies:
   ```typescript
   for (let i = enemies.length - 1; i >= 0; i--) {
     const enemy = enemies[i];
     if (!enemy.alive) continue;

     // Near-miss check (before collision, since collision removes the enemy from range)
     if (checkNearMiss(playerState, enemy)) {
       const nmResult = processNearMiss(playerState, enemy, score);
       score += nmResult.scoreDelta;
       playerState.comboLevel = nmResult.newComboLevel;
       eventBus.emit('nearMiss', { x: enemy.x, y: enemy.y });
     }

     // Collision check
     if (checkPlayerEnemyCollision(playerState, enemy)) {
       const dmgResult = processPlayerHit(playerState, enemy, waveIndex);
       if (dmgResult.type === 'hit') {
         eventBus.emit('playerDamaged', { amount: dmgResult.finalDamage, x: playerState.x, y: playerState.y });
       }
       if (playerState.hp <= 0) {
         eventBus.emit('playerDied', {});
         // transition to death state (Step 11/12 will implement full death sequence)
       }
     }
   }
   ```
2. Add `score: number`, `waveIndex: number` to scene state.

**Depends on:** Tasks 6.1–6.3, 2.4, 5.5

**Verify:**
- `npm run dev` — driving into an enemy damages the player (HP should decrease)
- Near-miss while drifting close to enemy awards points
- Shield blocks one hit (if shield upgrade given via test)

---

## Task 6.5 — Combat Tests

**Files:**
- `src/gameplay/combat/__tests__/combat.test.ts` — create

**Steps:**
1. Port tests from `test/scoring.test.js`:
   - Near-miss scoring, combo mechanics, damage pipeline, drift shield, HP regen, encirclement outcomes
   - These test the pure functions that `damage.ts` and `nearMiss.ts` call
2. New tests:
   - `checkPlayerEnemyCollision`: circles overlapping → true, apart → false
   - `processPlayerHit`: shield absorbs first hit, second hit does damage
   - `processPlayerHit`: damage scales with wave index
   - `checkNearMiss`: only triggers while drifting, respects cooldown
   - `processNearMiss`: returns correct score delta and combo level

**Depends on:** Tasks 6.1–6.3

**Verify:** `npm test` passes, `npm run test:old` passes.

---

## Verification — Full Step 6

1. `npx tsc --noEmit` — no errors
2. `npm test` — all vitest tests pass
3. `npm run test:old` — legacy tests pass
4. `npm run dev` — collisions deal damage, near-miss awards points, shield works
5. Player can die (hp → 0), triggering `playerDied` event
