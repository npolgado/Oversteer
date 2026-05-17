// upgradeCards.ts — Upgrade card selection overlay (3 cards, keyboard 1/2/3, touch).
// NOTE: card slide-in uses manual lerp + per-frame update(dt), not uiTween().
// GSAP `alpha` tweens on dynamically-added containers attached with alpha=0 fail in Pixi v8.
// See docs/fixes/gsap_ui_fixes.md (Addendum) for the underlying mechanism.

import { gsap } from 'gsap';
import { Graphics, Text, Sprite, Assets, Container } from 'pixi.js';
import type { UpgradeDef } from '@gameplay/upgrades/upgradeRegistry';
import { UPGRADE_REGISTRY } from '@gameplay/upgrades/upgradeRegistry';
import type { InputState } from '@input/inputManager';
import { CFG, S } from '@core/config';
import { makeUIStyle } from '@ui/textStyles';

const CARD_W = S(220);
const CARD_H = S(300);
const CARD_GAP = S(30);

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// back.out(1.7) — matches the feel of the old GSAP ease
function backOut(t: number): number {
  const s = 1.70158;
  const t1 = t - 1;
  return t1 * t1 * ((s + 1) * t1 + s) + 1;
}

interface CardGraphics {
  container: Container;
  targetY: number;
  hideStartY: number;
}

export class UpgradeCardsUI {
  private _layer: Container;
  private _cards: CardGraphics[] = [];
  private _rerollBtn: Graphics | null = null;
  private _rerollText: Text | null = null;
  private _cardBounds: Array<{ x: number; y: number; w: number; h: number }> = [];
  private _rerollBounds: { x: number; y: number; w: number; h: number } | null = null;
  private _visible = false;

  // Game-loop-driven animation state (replaces GSAP for container tweens)
  private _animState: 'idle' | 'in' | 'out' = 'idle';
  private _animTimer = 0;
  private _offscreenY = 0;

  constructor(overlayLayer: Container) {
    this._layer = overlayLayer;
  }

  show(cards: UpgradeDef[], rerollsLeft: number, ownedUpgrades: string[] = []): void {
    this._clearLayer();
    this._visible = true;
    this._animState = 'in';
    this._animTimer = 0;
    this._cardBounds = [];

    const offscreenY = CFG.H + CARD_H;
    this._offscreenY = offscreenY;

    // Background dim
    const dim = new Graphics();
    dim.rect(0, 0, CFG.W, CFG.H).fill({ color: 0x000000, alpha: 0.55 });
    this._layer.addChild(dim);

    // Title
    const title = new Text({ text: 'CHOOSE UPGRADE', style: makeUIStyle({ size: S(28), color: CFG.C_ACCENT, bold: true }) });
    title.anchor.set(0.5, 0);
    title.position.set(CFG.W / 2, S(40));
    this._layer.addChild(title);

    const totalW = cards.length * CARD_W + (cards.length - 1) * CARD_GAP;
    const startX = (CFG.W - totalW) / 2;
    const cardY = (CFG.H - CARD_H) / 2 - S(20);

    this._cards = cards.map((card, i) => {
      const cx = startX + i * (CARD_W + CARD_GAP);
      const container = new Container();
      container.x = cx;
      container.y = offscreenY;

      // Card background
      const bg = new Graphics();
      bg.rect(0, 0, CARD_W, CARD_H).fill({ color: 0x0d1520 });
      bg.rect(0, 0, CARD_W, CARD_H).stroke({ color: CFG.C_ACCENT, width: 2, alpha: 0.8 });
      container.addChild(bg);

      // Number hint
      const numHint = new Text({ text: `[${i + 1}]`, style: makeUIStyle({ size: S(12), color: '#888888' }) });
      numHint.position.set(S(8), S(8));
      container.addChild(numHint);

      // Icon — sprite if available, else letter placeholder
      if (card.iconSprite) {
        const spr = new Sprite(Assets.get(card.iconSprite));
        spr.anchor.set(0.5, 0);
        spr.position.set(CARD_W / 2, S(30));
        container.addChild(spr);
      } else {
        const iconTxt = new Text({ text: card.icon, style: makeUIStyle({ size: S(36), color: '#ffffff', bold: true }) });
        iconTxt.anchor.set(0.5, 0);
        iconTxt.position.set(CARD_W / 2, S(30));
        container.addChild(iconTxt);
      }

      // Name
      const nameTxt = new Text({ text: card.name, style: makeUIStyle({ size: S(16), color: CFG.C_TEXT, bold: true }) });
      nameTxt.anchor.set(0.5, 0);
      nameTxt.position.set(CARD_W / 2, S(90));
      container.addChild(nameTxt);

      // Desc (word-wrap)
      const descTxt = new Text({ text: card.desc, style: makeUIStyle({ size: S(13), color: '#aaaaaa', wordWrap: true, wordWrapWidth: CARD_W - S(20), align: 'center' }) });
      descTxt.anchor.set(0.5, 0);
      descTxt.position.set(CARD_W / 2, S(120));
      container.addChild(descTxt);

      this._layer.addChild(container);
      this._cardBounds.push({ x: cx, y: cardY, w: CARD_W, h: CARD_H });

      return { container, targetY: cardY, hideStartY: offscreenY };
    });

    // Reroll button
    const rerollColor = rerollsLeft > 0 ? '#dddddd' : '#666666';
    this._rerollText = new Text({ text: `Press [R] to reroll (${rerollsLeft} left)`, style: makeUIStyle({ size: S(15), color: rerollColor }) });
    this._rerollText.anchor.set(0.5);
    this._rerollText.position.set(CFG.W / 2, CFG.H - S(35));
    this._layer.addChild(this._rerollText);

    const rbW = S(260);
    const rbH = S(32);
    const rbX = CFG.W / 2 - rbW / 2;
    const rbY = CFG.H - S(35) - rbH / 2;
    this._rerollBounds = { x: rbX, y: rbY, w: rbW, h: rbH };

    // Owned upgrades summary
    if (ownedUpgrades.length > 0) {
      const counts = new Map<string, { name: string; count: number }>();
      for (const id of ownedUpgrades) {
        const def = UPGRADE_REGISTRY.find(u => u.id === id);
        if (!def) continue;
        const entry = counts.get(id);
        if (entry) entry.count++;
        else counts.set(id, { name: def.name, count: 1 });
      }
      const itemStr = Array.from(counts.values())
        .map(({ count, name }) => `${count}x ${name}`)
        .join('  ·  ');

      const labelY = cardY + CARD_H + S(24);
      const label = new Text({
        text: 'OWNED UPGRADES',
        style: makeUIStyle({ size: S(11), color: '#555566', letterSpacing: 1 }),
      });
      label.anchor.set(0.5, 0);
      label.position.set(CFG.W / 2, labelY);
      this._layer.addChild(label);

      const itemsTxt = new Text({
        text: itemStr,
        style: makeUIStyle({ size: S(13), color: '#99aabb', wordWrap: true, wordWrapWidth: CFG.W - S(120), align: 'center' }),
      });
      itemsTxt.anchor.set(0.5, 0);
      itemsTxt.position.set(CFG.W / 2, labelY + S(18));
      this._layer.addChild(itemsTxt);
    }
  }

  hide(): void {
    if (!this._visible) return;
    this._visible = false;

    if (this._cards.length === 0) {
      this._clearLayer();
      return;
    }

    // Record current y as start of slide-out (may be mid-slide-in)
    for (const c of this._cards) c.hideStartY = c.container.y;
    this._animState = 'out';
    this._animTimer = 0;
  }

  /** Pulse reroll button when clicked. */
  pulseRerollBtn(): void {
    // Capture ref: show() may nullify _rerollText before the tween fires
    const rt = this._rerollText;
    if (!rt) return;
    const proxy = { s: 1 };
    gsap.to(proxy, { s: 0.92, duration: 0.08, yoyo: true, repeat: 1, onUpdate: () => { rt.scale.set(proxy.s); } });
  }

  update(dt: number): void {
    if (this._animState === 'idle' || this._cards.length === 0) return;
    this._animTimer += dt;

    if (this._animState === 'in') {
      let allDone = true;
      for (let i = 0; i < this._cards.length; i++) {
        const c = this._cards[i];
        const elapsed = this._animTimer - i * 0.1; // stagger delay
        if (elapsed <= 0) { allDone = false; continue; }
        const t = Math.min(elapsed / 0.4, 1);
        c.container.y = lerp(this._offscreenY, c.targetY, backOut(t));
        if (t < 1) allDone = false;
      }
      if (allDone) {
        for (const c of this._cards) c.container.y = c.targetY;
        this._animState = 'idle';
      }
    } else {
      // 'out' — power2.in slide back off-screen
      const t = Math.min(this._animTimer / 0.2, 1);
      const eased = t * t;
      for (const c of this._cards) {
        c.container.y = lerp(c.hideStartY, this._offscreenY, eased);
      }
      if (t >= 1) {
        this._clearLayer();
        this._animState = 'idle';
      }
    }
  }

  checkInput(
    input: Pick<InputState, 'select1' | 'select2' | 'select3' | 'reroll'>,
    tap: { x: number; y: number } | null,
  ): number | 'reroll' | null {
    if (!this._visible) return null;

    if (input.select1) return 0;
    if (input.select2) return 1;
    if (input.select3) return 2;
    if (input.reroll) return 'reroll';

    if (tap) {
      for (let i = 0; i < this._cardBounds.length; i++) {
        const b = this._cardBounds[i];
        if (tap.x >= b.x && tap.x <= b.x + b.w && tap.y >= b.y && tap.y <= b.y + b.h) {
          return i;
        }
      }
      if (this._rerollBounds) {
        const rb = this._rerollBounds;
        if (tap.x >= rb.x && tap.x <= rb.x + rb.w && tap.y >= rb.y && tap.y <= rb.y + rb.h) {
          return 'reroll';
        }
      }
    }

    return null;
  }

  destroy(): void {
    this._animState = 'idle';
    this._clearLayer();
  }

  private _clearLayer(): void {
    this._layer.removeChildren();
    this._cards = [];
    this._rerollBtn = null;
    this._rerollText = null;
    this._cardBounds = [];
    this._rerollBounds = null;
  }
}
