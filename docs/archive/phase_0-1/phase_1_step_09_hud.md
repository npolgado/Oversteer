# Phase 1 — Step 9: HUD + EventLog

## Context

This step ports the HUD rendering from `arena-drifter/game.js renderHUD()` (~150 lines Canvas 2D) and the `EventLog` from `arena-drifter/fx.js` (~40 lines) into PixiJS `Text`/`Graphics` objects on the `hudLayer` and `eventLogLayer` (screen-fixed UI containers, not moved by camera).

Key HUD elements:
- **Score panel**: current score (top-left), wave number, enemy count
- **HP bar**: filled rectangle, color changes at low HP
- **Drift combo bar**: horizontal bar, grows with combo level (max 8)
- **Speed indicator**: current speed as fraction of max
- **Upgrade icons**: small icons for owned upgrades
- **EventLog**: max 7 entries below HP bar, fade over 3.5s

**Prerequisite:** Steps 7–8 (score, combo, wave data available in gameplayScene).

---

## Task 9.1 — HUD Manager

**Files:**
- `src/ui/hud/hudManager.ts` — create

**Steps:**
1. Create `HudData` interface (what the HUD reads each frame):
   ```typescript
   export interface HudData {
     score: number;
     highScore: number;
     hp: number;
     maxHp: number;
     comboLevel: number;       // 0–8
     waveIndex: number;
     enemyCount: number;
     speed: number;            // current player speed
     maxSpeed: number;
     drifting: boolean;
     driftTime: number;
     phase: WavePhase;
     breakTimer: number;       // seconds remaining in break
     upgrades: string[];       // list of upgrade IDs owned
   }
   ```
2. Create `HudManager` class:
   ```typescript
   export class HudManager {
     constructor(layers: { hudLayer: Container });
     update(data: HudData): void;
     destroy(): void;
   }
   ```
3. In the constructor, create PixiJS `Text` and `Graphics` objects for each HUD element:
   - Score text (top-left, large white font)
   - Wave text (top-left, below score)
   - Enemy count text
   - HP bar background + fill `Graphics`
   - Combo bar background + fill `Graphics`
   - Speed indicator `Text`
4. In `update(data)`:
   - Update text content: `scoreText.text = String(Math.floor(data.score))`
   - Update HP bar fill width proportional to `data.hp / data.maxHp`. Color: green if hp > 50%, yellow if > 25%, red otherwise.
   - Update combo bar fill width: `(data.comboLevel / CFG.MAX_COMBO)` fraction of bar width.
   - Wave text: during combat phase show `Wave data.waveIndex | data.enemyCount enemies`. During break show `Break data.breakTimer.toFixed(1)s`.
   - Speed text: `${Math.round(data.speed)} px/s`.
5. Use `S(px)` from config for all measurements to support viewport scaling.
6. No Canvas 2D — PixiJS Text/Graphics only.

**Depends on:** Phase 0 (pixiApp hudLayer), Steps 7–8 (WavePhase type)

**Verify:** `npx tsc --noEmit` clean.

---

## Task 9.2 — EventLog

**Files:**
- `src/ui/hud/eventLog.ts` — create

**Steps:**
1. Define:
   ```typescript
   interface LogEntry {
     text: string;
     color: string;    // hex color string
     age: number;      // seconds since added
     pixiText: Text;   // PixiJS Text object
   }
   ```
2. Create `EventLog` class:
   ```typescript
   export class EventLog {
     constructor(layers: { eventLogLayer: Container });
     add(text: string, color?: string): void;
     update(dt: number): void;
     clear(): void;
     destroy(): void;
   }
   ```
3. In `add(text, color)`:
   - Max 7 entries — if full, remove oldest
   - Create a PixiJS `Text` object, position below HP bar (anchored to left side)
   - Push to entries array
4. In `update(dt)`:
   - For each entry: `entry.age += dt`
   - If `entry.age > 3.5`: remove entry, destroy PixiJS text
   - Fade alpha: `entry.pixiText.alpha = entry.age < 0.2 ? entry.age / 0.2 : entry.age > 3.0 ? (3.5 - entry.age) / 0.5 : 1.0`
   - Reposition stacked entries after removal (index × line height)
5. In `clear()`: remove all entries and their PixiJS objects.
6. Anchor position: `S(20)` from left, `S(160)` from top (below HP bar). Each entry is `S(18)` tall.

**Depends on:** Phase 0 (pixiApp eventLogLayer)

**Verify:** `npx tsc --noEmit` clean.

---

## Task 9.3 — Wire into GameplayScene

**Files:**
- `src/scenes/gameplayScene.ts` — update

**Steps:**
1. Create `hudManager = new HudManager(ctx.pixiApp)` and `eventLog = new EventLog(ctx.pixiApp)` in `enter()`.
2. In `update(dt)`:
   - Build `HudData` from current state and pass to `hudManager.update(data)`
   - Call `eventLog.update(dt)`
3. Subscribe to eventBus events to populate event log:
   - `nearMiss` → `eventLog.add('Near Miss! +25', '#ffff00')`
   - `encirclement` with count → `eventLog.add('Encircled ×${count}! +${score}', '#00ffcc')`
   - `playerDamaged` → `eventLog.add('Hit! -${amount} HP', '#ff4444')`
   - `upgradeApplied` → `eventLog.add('Upgrade: ${id}', '#aaccff')`
4. Store eventBus listener references for cleanup in `exit()`.
5. In `exit()`: remove event listeners, destroy HUD and EventLog.

**Depends on:** Tasks 9.1, 9.2, Steps 7–8

**Verify:**
- `npm run dev` — score, HP bar, wave info visible on screen
- Event log shows game events as they happen

---

## Verification — Full Step 9

1. `npx tsc --noEmit` — no errors
2. `npm test` — all vitest tests pass
3. `npm run test:old` — legacy tests pass
4. `npm run dev` — HUD shows score, HP, wave, combo, enemy count
5. Event log populates with game events (near miss, encirclement, hit)
6. HP bar changes color at low health
7. Combo bar grows with combo level
