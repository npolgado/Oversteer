# GSAP UI Fixes — Wave Banner Text & Upgrade Cards

## Context

Two visible bugs on the `npo/gsap` branch before merge to main:

1. **Wave banner text missing** — when a wave starts, the black background rect animates in but the "WAVE X" text never appears.
2. **Upgrade cards missing** — after a wave ends, the card selection overlay shows the dim, title, and reroll text, but the three upgrade card containers are completely invisible.

### Root cause — GSAP CSS plugin hijacking

Both bugs share the same root cause. GSAP v3 recognises `x`, `y`, `scaleX`, `scaleY` as reserved **CSS transform** property names. When any of these appear in a `gsap.to()` call, GSAP activates its CSS transform plugin for the **entire** tween — including the `alpha` prop. Because PixiJS Container objects have no `style` property, the CSS plugin writes nothing and `alpha` stays at 0.

Evidence: `_waveBanner` is tweened with only `{ alpha: 1 }` and becomes visible. `_waveBannerText` and every card container are tweened with `{ y: …, alpha: 1 }` and stay invisible.

Secondary issues uncovered during investigation:
- `pulseRerollBtn` uses `scaleX`/`scaleY` which are not direct PixiJS properties (PixiJS uses `scale.x`/`scale.y`).
- `_hideUpgradeCountdown()` is called every frame with null targets, creating dead GSAP tweens that never resolve.
- The wave banner background rect is drawn at the text's *start* position (before the slide), so after animation the text lands 40 px below the background box.

---

## Task 1 — Register PixiPlugin in `tween.ts`

**Files:** `src/render/tween.ts`

**What:** GSAP ships `gsap/PixiPlugin` in its free tier. Registering it teaches GSAP how to tween PixiJS Container properties (`x`, `y`, `alpha`, `scaleX → scale.x`, etc.) without routing them through the CSS plugin.

**Steps:**
1. Add imports at the top of `tween.ts`:
   ```ts
   import { PixiPlugin } from 'gsap/PixiPlugin';
   import * as PIXI from 'pixi.js';
   ```
2. After `import gsap from 'gsap'`, register the plugin and bind it to the PixiJS build:
   ```ts
   gsap.registerPlugin(PixiPlugin);
   PixiPlugin.registerPIXI(PIXI);
   ```
3. Remove the `/// <reference types="vite/client" />` comment if it ends up unused (it can stay — it's fine either way).
4. Run `npm run dev` and verify the dev server still starts cleanly (no TypeScript errors, no console errors on load).

**Depends on:** nothing

**Verify:** Dev server starts without errors. No TypeScript errors on `PixiPlugin` import.

---

## Task 2 — Fix wave banner background position

**Files:** `src/ui/hud/hudManager.ts`

**What:** In `showWaveBanner()`, the background `roundRect` is drawn centred at `CFG.H/2 - S(40)` (the text's *starting* y before the slide animation). After the tween, the text lands at `CFG.H/2`, which is 40 px below the background box. Fix the background to be centred at the text's final landing position.

**Steps:**
1. Locate the `roundRect` call inside `showWaveBanner()` (~line 176):
   ```ts
   this._waveBanner.roundRect(CFG.W / 2 - S(100), CFG.H / 2 - S(18) - S(40), S(200), S(36), S(6))
   ```
2. Change the y coordinate from `CFG.H / 2 - S(18) - S(40)` to `CFG.H / 2 - S(18)`:
   ```ts
   this._waveBanner.roundRect(CFG.W / 2 - S(100), CFG.H / 2 - S(18), S(200), S(36), S(6))
   ```
   This centres the box at `CFG.H/2`, matching where the text ends up after the slide.

**Depends on:** Task 1 (text must be visible before layout can be verified)

**Verify:** After Task 1, wave banner shows text centred inside the background box.

---

## Task 3 — Fix `pulseRerollBtn` scale tween

**Files:** `src/ui/menus/upgradeCards.ts`

**What:** `pulseRerollBtn` tweens `scaleX`/`scaleY` directly on a PixiJS Text object. In PixiJS these are not direct properties (`scale.x`/`scale.y` are). After Task 1, PixiPlugin maps `scaleX → container.scale.x` automatically, so verify the pulse works. If it doesn't (PixiPlugin version difference), replace with a proxy approach.

**Steps:**
1. After Task 1 is applied, open the game, reach the upgrade phase, press R to reroll.
2. If the reroll button pulses correctly, this task is done — PixiPlugin handles `scaleX`/`scaleY`.
3. If the pulse still does nothing, replace the tween in `pulseRerollBtn()`:
   ```ts
   pulseRerollBtn(): void {
     if (!this._rerollText) return;
     const proxy = { s: 1 };
     gsap.to(proxy, {
       s: 0.92, duration: 0.08, yoyo: true, repeat: 1,
       onUpdate: () => { this._rerollText!.scale.set(proxy.s); },
     });
   }
   ```

**Depends on:** Task 1

**Verify:** Pressing R on the upgrade screen causes the reroll text to briefly squish.

---

## Task 4 — Fix `_hideUpgradeCountdown` called every frame

**Files:** `src/scenes/gameLoop.ts`

**What:** `_hideUpgradeCountdown()` is an `async` method that `await`s five sequential GSAP tweens. It is called **every frame** during normal gameplay and during the upgrade break (when cards are shown). When the countdown elements are null (before the first upgrade), each `uiTween(null, …)` creates a Promise that never resolves, accumulating dead GSAP tweens over time. Even after the elements exist, calling it 60× per second fires 60 competing fade tweens per second on the same objects.

**Steps:**
1. Add a private flag to `GameLoop`:
   ```ts
   private _cdVisible = false;
   ```
2. In `_renderUpgradeCountdown()`, set `this._cdVisible = true` at the end.
3. Replace the every-frame call pattern in `update()`:

   Current pattern (problematic):
   ```ts
   if (this._upgradeBreak.active) {
     ...
     if (this._upgradeBreak.upgradeChosen) {
       this._renderUpgradeCountdown(...);
     } else {
       this._hideUpgradeCountdown(); // called every frame
     }
     return;
   }
   this._hideUpgradeCountdown(); // called every frame
   ```

   New pattern:
   ```ts
   if (this._upgradeBreak.active) {
     ...
     if (this._upgradeBreak.upgradeChosen) {
       this._renderUpgradeCountdown(...);
     }
     return;
   }
   // Hide countdown once when transitioning out of upgrade break or on first frame
   if (this._cdVisible) {
     this._cdVisible = false;
     this._hideUpgradeCountdown();
   }
   ```

4. Guard `_hideUpgradeCountdown()` against null targets:
   ```ts
   private async _hideUpgradeCountdown(): Promise<void> {
     if (!this._cdBg) return;
     await uiTween(this._cdBg,   { alpha: 0, duration: 0.3 });
     await uiTween(this._cdIcon, { alpha: 0, duration: 0.3 });
     await uiTween(this._cdName, { alpha: 0, duration: 0.3 });
     await uiTween(this._cdNum,  { alpha: 0, duration: 0.3 });
     await uiTween(this._cdWave, { alpha: 0, duration: 0.3 });
   }
   ```

**Depends on:** nothing (independent cleanup)

**Verify:**
- No console errors about null GSAP targets.
- Upgrade countdown overlay fades out correctly after upgrade selection and before the next wave banner appears.
- No performance regression: browser DevTools timeline should not show 300+ GSAP tween allocations per second.

---

## Order of work

| Order | Task | Risk |
|-------|------|------|
| 1st | Task 1 (PixiPlugin) | Fixes both bugs; low risk |
| 2nd | Task 2 (banner position) | Cosmetic fix; depends on Task 1 |
| 3rd | Task 3 (scaleX/Y) | May be a no-op after Task 1 |
| 4th | Task 4 (every-frame guard) | Independent cleanup; do last to not confuse debugging |
