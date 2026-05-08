# GSAP UI Fixes — Wave Banner Text & Upgrade Cards

## Context

Two visible bugs on the `npo/gsap` branch before merge to main:

1. **Wave banner text missing** — when a wave starts, the black background rect animates in but the "WAVE X" text never appears.
2. **Upgrade cards missing** — after a wave ends, the card selection overlay shows the dim, title, and reroll text, but the three upgrade card containers are completely invisible.

### Root cause — GSAP transform-system hijack

Both bugs share the same class of root cause: when `y` (or `x`, `scaleX`, `scaleY`) appears in a `gsap.to()` call alongside `alpha`, GSAP 3 routes the entire tween through its internal transform system. For non-DOM objects this means the transform values are cached in GSAP's internal state rather than written directly to the target's property. The `alpha` prop is also consumed by this path and never lands on the PixiJS object, so it stays at 0.

Evidence: tweens with `{ alpha: 1 }` alone work (`_waveBanner` background, dim, title). Tweens with `{ y: …, alpha: 1 }` do not animate alpha (`_waveBannerText`, every card container).

**Fix principle**: never mix `y`/`x` with `alpha` in the same `uiTween` call on a PixiJS object. Set positional properties via direct assignment; tween only `alpha`.

### Secondary bug — wave banner text x position

The old per-frame banner code used `position.set(CFG.W / 2, slideY)`, setting both axes.
The new `showWaveBanner()` only sets `y`. With `anchor.set(0.5, 0.5)` and `x` defaulting to `0`, the text centre sits at the left edge of the screen — invisible to anyone looking at the centre.

This bug persists even after removing `y` from the tween because the alpha IS now animated, but the text still renders off-screen.

### Note on PixiPlugin

Registering PixiPlugin (Task 1 below) does NOT fix direct-property tweens like `{ alpha: 1 }`. PixiPlugin only intercepts the `pixi: {}` namespace (`gsap.to(obj, { pixi: { alpha: 1 } })`). The registration is still worth keeping — it enables correct property mapping for future `pixi: {}` tweens and is required for `scaleX → scale.x` support — but it is not the mechanism that fixes the alpha bug. The real fix is separating `y` from `alpha`.

---

## Task 1 — Register PixiPlugin in `tween.ts` ✅ DONE

**Files:** `src/render/tween.ts`

Already implemented. Imports `PixiPlugin`, calls `gsap.registerPlugin(PixiPlugin)` and `PixiPlugin.registerPIXI(PIXI)`. No further changes needed here.

---

## Task 2 — Fix wave banner: separate y from alpha + set missing x ✅ DONE (both parts)

**Files:** `src/ui/hud/hudManager.ts`

**What:** Two separate fixes required:

### 2a — Remove `y` from the `uiTween` call

The `_waveBannerText` tween previously included `y: CFG.H / 2` alongside `alpha: 1`. This triggered the transform-system hijack, leaving alpha at 0. Fix: assign `y` directly before calling `uiTween`, and pass only `alpha` to the tween.

```ts
// Before (broken — y hijacks alpha)
uiTween(this._waveBannerText, { alpha: 1, y: CFG.H / 2, duration: 0.3, ease: 'power2.out' })

// After (fixed)
this._waveBannerText.y = CFG.H / 2;
uiTween(this._waveBannerText, { alpha: 1, duration: 0.3, ease: 'power2.out' })
```

### 2b — Set the missing x position

The old per-frame code called `position.set(CFG.W / 2, slideY)`. The new code only sets `y`. Add:

```ts
this._waveBannerText.x = CFG.W / 2;
this._waveBannerText.y = CFG.H / 2;
```

Both lines must appear in `showWaveBanner()` before the `uiTween` call.

**Verify:** Wave banner text appears centred horizontally and vertically on wave start.

---

## Task 3 — Fix upgrade cards: separate y from alpha ✅ DONE

**Files:** `src/ui/menus/upgradeCards.ts`

**What:** The card container tween previously included `y: cardY` alongside `alpha: 1`, causing the same transform-system hijack. Fix: set `y` directly, tween only `alpha`.

```ts
// Before (broken)
uiTween(container, { y: cardY, alpha: 1, duration: 0.35, delay: i * 0.08, ease: 'back.out(1.4)' })

// After (fixed)
container.y = cardY;
uiTween(container, { alpha: 1, duration: 0.35, delay: i * 0.08, ease: 'back.out(1.4)' })
```

Also applied to `hide()` — the fade-out tween must not include `y` either.

**Verify:** Upgrade cards appear (staggered fade-in) after each wave ends.

---

## Task 4 — Fix `pulseRerollBtn` scale tween ✅ DONE

**Files:** `src/ui/menus/upgradeCards.ts`

**What:** `scaleX`/`scaleY` are not direct PixiJS properties (`scale.x`/`scale.y` are). Using a proxy object avoids the transform hijack and maps correctly to PixiJS scale.

```ts
pulseRerollBtn(): void {
  if (!this._rerollText) return;
  const proxy = { s: 1 };
  gsap.to(proxy, { s: 0.92, duration: 0.08, yoyo: true, repeat: 1,
    onUpdate: () => { this._rerollText!.scale.set(proxy.s); },
  });
}
```

**Verify:** Pressing R causes the reroll text to briefly squish.

---

## Task 5 — Fix `_hideUpgradeCountdown` called every frame ✅ DONE

**Files:** `src/scenes/gameLoop.ts`

**What:** `_hideUpgradeCountdown()` was an async method called every frame, accumulating hundreds of dead GSAP tweens per second when its targets were null. Fix: guard with a `_cdVisible` flag so it fires once on transition out of upgrade break.

**Verify:** No console errors about null GSAP targets; countdown overlay fades out once after upgrade selection.

---

## Summary of actual changes required

| Bug | Root cause | Fix |
|-----|-----------|-----|
| Wave banner text invisible | `y` + `alpha` in same tween — alpha hijacked | Move `y` to direct assignment, tween only `alpha` |
| Wave banner text off-screen | `x` never set after removing per-frame `position.set()` | Add `_waveBannerText.x = CFG.W / 2` in `showWaveBanner` |
| Upgrade cards invisible | **See addendum below** | Slide-in via `y` tween only; start `alpha = 1` |
| Reroll pulse broken | `scaleX`/`scaleY` not valid PixiJS props | Proxy object with `scale.set()` in `onUpdate` |
| Countdown hide spam | async fade called 60×/frame | `_cdVisible` flag, hide once on transition |
| Countdown not hiding | Alpha tween on lazily-created Graphics/Text fails | Use `visible = false` directly |

---

## Addendum — GSAP + PixiJS v8 alpha tween findings

Found during post-fix investigation (cards still invisible after Tasks 1–5).

### PixiPlugin only activates for `pixi: {}` namespace

`PixiPlugin.name = "pixi"`. It is **only** invoked when the tween vars contain a `pixi: {}` key:

```ts
gsap.to(obj, { pixi: { alpha: 1 } })  // ← PixiPlugin handles this
gsap.to(obj, { alpha: 1 })             // ← GSAP core handles this directly
```

The original root-cause analysis ("y + alpha in same tween hijacks alpha via transform system") was **wrong for non-DOM objects**. GSAP's CSS transform-system hijack only applies to DOM elements. For plain JS objects (which PixiJS containers are), GSAP tweens `x`, `y`, `alpha` as direct property reads/writes with no special transform routing.

### The actual alpha failure

`gsap.to(pixiContainer, { alpha: 1 })` does NOT animate alpha on **dynamically-created PixiJS v8 Containers** that were added to the display tree with `alpha = 0`. Objects created at constructor time (always in layer from startup) animate correctly.

The suspected mechanism: PixiJS v8's render group marks a container with `alpha = 0` at `addChild` time as a zero-alpha renderable. Subsequent property writes via the setter (`container.alpha = interpolated`) trigger `updateRenderable`, but the render group's compiled worldAlpha for that subtree may not re-propagate. Only objects with a "live" worldAlpha at attach time animate correctly.

**Pattern that works**: animate `alpha` on objects that were attached with `alpha > 0`, or on objects created before gameplay (in class constructors).

**Pattern that fails**: attach container with `alpha = 0`, then tween to 1.

### PixiPlugin v8 compatibility

PixiPlugin 3.15 explicitly checks `PIXI.VERSION` and sets `_isV8Plus = version >= 8`. The `registerPIXI(PIXI)` call just stores the PIXI namespace reference. The plugin does handle v8-specific things (e.g. BlurFilter uses `strength` not `blur` in v8, strokeColor mapping). Safe to keep registered.

### `scaleX`/`scaleY` via direct tween

PixiPlugin maps these only inside `pixi: {}`. Without PixiPlugin, `gsap.to(obj, { scaleX: 1 })` would try to set `obj.scaleX` directly, which doesn't exist on PixiJS v8 Containers (`scale.x` does). Use a proxy with `onUpdate: () => obj.scale.set(proxy.s)` instead.

---

## Decision — Upgrade cards stay on manual lerp

**Recorded:** 2026-05-08

The upgrade card slide-in (`src/ui/menus/upgradeCards.ts:205-235`) uses a hand-rolled `lerp` + `backOut` easing function driven by `update(dt)` rather than `uiTween()`. This is the deliberate workaround for the alpha-on-zero-attached-container failure described above. The containers are created inside `show()` and immediately added with `container.y = offscreenY` (alpha stays at 1), so the slide works via `y` manipulation only. Converting to GSAP would re-introduce the alpha bug unless the containers are pre-created in the constructor (as `_waveBannerText` is), which would conflict with the dynamic card content. Manual lerp is the correct long-term approach here.
