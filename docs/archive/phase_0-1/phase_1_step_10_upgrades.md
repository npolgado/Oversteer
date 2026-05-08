# Phase 1 — Step 10: Upgrade System + UI

## Context

This step ports the 26 `ARENA_UPGRADES` definitions from `arena-drifter/waves.js` and the upgrade card selection UI from `arena-drifter/game.js renderUpgradeBreak()`. During the break phase (after each combat wave), the player sees 3 upgrade cards and picks one. They can reroll up to 3 times (extra_rerolls adds +2 per stack).

The upgrade `apply(player)` functions directly mutate player state — this is preserved in the new architecture. The UI overlay appears on the `overlayLayer` (screen-fixed) during the break phase.

**Prerequisite:** Step 7 (wave break phase triggers upgrade offer), Step 2 (PlayerState for apply logic).

---

## Task 10.1 — Upgrade Registry

**Files:**
- `src/gameplay/upgrades/upgradeRegistry.ts` — create

**Steps:**
1. Define types:
   ```typescript
   export interface UpgradeDef {
     id: string;
     name: string;
     desc: string;
     icon: string;      // emoji or short text label
     stackable: boolean;
     maxStacks?: number;
     apply(player: PlayerState): void;
   }
   ```
2. Port all 26 upgrade definitions from `waves.js ARENA_UPGRADES`, converted to TypeScript with typed `apply` functions. Preserve exact numeric values:
   - `turbo`: `player.maxSpeed *= 1.15`
   - `tight_turns`: `player.turnRate *= 1.25`
   - `drift_king`: drift boost +50%, `player.driftKing = true`
   - `shield`: `player.shield = (player.shield || 0) + 1` (stackable, max 3)
   - `magnet`: `player.magnetRange = 150`
   - `score_freak`: `player.scoreMult *= 1.5`
   - `ghost_frame`: `player.ghostFrame = true` (... use `ghostFrameTimer` field)
   - `thick_plating`: `player.thickPlating = true`
   - `afterburner`: `player.afterburner = true`
   - `combo_master`: `player.comboMaster = true`
   - `speed_demon`: `player.maxSpeed *= 1.2; player.speedDemon = true`
   - `wider_trail`: modifies trail CLOSE_DIST (pass via return value or eventBus)
   - `trail_echo`: modifies trail MAX_POINTS
   - `encircle_bonus`: `player.encircleScoreBonus = true`
   - `hp_regen`: `player.hpRegen = (player.hpRegen || 0) + 3` (stackable, max 3)
   - `max_hp`: `player.maxHp += 30; player.hp = Math.min(player.hp + 30, player.maxHp)`
   - `damage_resist`: `player.damageResist = 1 - (1 - player.damageResist) * 0.75` (stackable, max 2, diminishing)
   - `drift_shield`: `player.driftShield = true`
   - `combo_heal`: `player.comboHeal = true`
   - `trail_magnet`: `player.trailMagnet = true`
   - `speed_trail`: `player.speedTrail = true`
   - `dash_burst`: `player.dashBurst = true`
   - `trail_burn`: `player.trailBurn = true`
   - `chain_lightning`: `player.chainLightning = true`
   - `extra_rerolls`: handled by upgrade system (extra rerolls per break, not a player flag)
   - `nitro_drift`: `player.nitroDrift = true`

   **Note:** `wider_trail` and `trail_echo` affect `TrailState`, not `PlayerState`. The apply function should emit an event or return a side-effect descriptor. Simplest approach: add optional fields to `PlayerState` for trail modifiers (`trailMaxPointsBonus: number`, `trailCloseDistBonus: number`) and read them in `trailUpdate.ts`.

3. Export `UPGRADE_REGISTRY: UpgradeDef[]` array and `UPGRADE_BY_ID: Map<string, UpgradeDef>`.
4. Export `isUpgradeStackable(id: string): boolean` and `getUpgradeStacks(player: PlayerState, id: string): number`.

**Depends on:** Step 2 (PlayerState)

**Verify:** `npx tsc --noEmit` clean. All 26 upgrades defined and typed.

---

## Task 10.2 — Upgrade System Logic

**Files:**
- `src/gameplay/upgrades/upgradeSystem.ts` — create

**Steps:**
1. Export `buildUpgradeOffer(player: PlayerState, rng?: () => number): UpgradeDef[]`:
   - Filter out non-stackable upgrades already in `player.upgrades`
   - Filter out upgrades at max stacks
   - Sample 3 random upgrades from remaining pool (use `Math.random()` or seeded RNG if provided)
   - Return array of 3 (or fewer if pool is small)
2. Export `applyUpgrade(player: PlayerState, upgrade: UpgradeDef): void`:
   - Call `upgrade.apply(player)`
   - Push `upgrade.id` to `player.upgrades`
3. Export `canReroll(rerollsLeft: number): boolean`.
4. Reroll state is managed by the caller (gameplayScene), not this module.

**Depends on:** Task 10.1, Step 2 (PlayerState)

**Verify:** `npx tsc --noEmit` clean.

---

## Task 10.3 — Upgrade Card UI

**Files:**
- `src/ui/menus/upgradeCards.ts` — create

**Steps:**
1. Create `UpgradeCardsUI` class:
   ```typescript
   export class UpgradeCardsUI {
     constructor(layers: { overlayLayer: Container });
     show(cards: UpgradeDef[], rerollsLeft: number): void;
     hide(): void;
     update(dt: number): void;
     // Returns index of card tapped/clicked, or -1 for reroll, or null if no input
     checkInput(tap: { x: number; y: number } | null, keys: { key1: boolean; key2: boolean; key3: boolean; reroll: boolean }): number | 'reroll' | null;
     destroy(): void;
   }
   ```
2. In `show(cards, rerollsLeft)`:
   - Create 3 card panels (PixiJS `Graphics` + `Text`): each 220px wide × 300px tall, centered horizontally
   - Each card shows: icon, name, description text (wrapped)
   - Reroll button (bottom) with remaining count `R: Reroll (${rerollsLeft} left)`
   - Animate in: cards slide up from bottom over 0.3s
3. In `hide()`: destroy all card objects (or hide with alpha = 0).
4. In `checkInput(tap, keys)`:
   - Keyboard: 1/2/3 → return 0/1/2, R → return 'reroll'
   - Touch: tap position hit-test against card bounds → return index
   - Return `null` if no input this frame
5. No countdown timer in this step — the 3-second countdown before wave starts (the "upgradeConfirmTimer") is implemented in the scene after selection.

**Depends on:** Task 10.1, Phase 0 (pixiApp overlayLayer)

**Verify:** Cards display correctly with upgrade names and descriptions.

---

## Task 10.4 — Wire into GameplayScene

**Files:**
- `src/scenes/gameplayScene.ts` — update

**Steps:**
1. Add `upgradeCardsUI`, `currentOffer: UpgradeDef[]`, `rerollsLeft: number`, `upgradeConfirmTimer: number` to scene state.
2. Handle `wave_end` event from wave manager:
   - `currentOffer = buildUpgradeOffer(playerState)`
   - `rerollsLeft = 3 + (extra_rerolls stacks * 2)` — check player.upgrades for extra_rerolls
   - `upgradeCardsUI.show(currentOffer, rerollsLeft)`
3. During break phase (while `upgradeConfirmTimer <= 0` and cards visible):
   - `const action = upgradeCardsUI.checkInput(input.consumeTap(), { key1: input.key1, ... })`
   - If card index: `applyUpgrade(playerState, currentOffer[action])`; `upgradeCardsUI.hide()`; `upgradeConfirmTimer = 3.0`; emit `eventBus.emit('upgradeApplied', { id: upgrade.id })`
   - If 'reroll' and `canReroll(rerollsLeft)`: `rerollsLeft--`; `currentOffer = buildUpgradeOffer(playerState)`; `upgradeCardsUI.show(currentOffer, rerollsLeft)`
4. When `upgradeConfirmTimer > 0`: decrement each frame. Show countdown in HUD overlay. When reaches 0: call `startWave(waveState)`.
5. In `exit()`: hide and destroy upgrade cards UI.

**Depends on:** Tasks 10.1–10.3, Step 7 (wave break phase)

**Verify:**
- `npm run dev` — after wave 1 break, 3 upgrade cards appear
- Selecting a card applies the upgrade and starts wave 2 after 3s countdown
- Reroll button cycles to new cards (3 rerolls available)

---

## Task 10.5 — Upgrade Tests

**Files:**
- `src/gameplay/upgrades/__tests__/upgrades.test.ts` — create

**Steps:**
1. Port tests from `test/upgrades.test.js`:
   - `hitTestUpgradeTap` — touch hit-test for upgrade cards
2. New tests:
   - `buildUpgradeOffer` excludes already-owned non-stackable upgrades
   - `buildUpgradeOffer` includes stackable upgrades at max stacks minus 1
   - `applyUpgrade('turbo', ...)` increases player maxSpeed by 15%
   - `applyUpgrade('max_hp', ...)` increases both maxHp and hp by 30
   - `applyUpgrade('damage_resist', ...)` applies diminishing returns on second stack

**Depends on:** Tasks 10.1, 10.2

**Verify:** `npm test` passes, `npm run test:old` passes.

---

## Verification — Full Step 10

1. `npx tsc --noEmit` — no errors
2. `npm test` — all vitest tests pass
3. `npm run test:old` — legacy tests pass
4. `npm run dev` — full upgrade flow: wave ends, 3 cards appear, select one, 3s countdown, wave 2 starts
5. Upgrade effects apply correctly (turbo makes car faster, shield blocks a hit, etc.)
6. Reroll cycles to different cards
