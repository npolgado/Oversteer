// upgradeCards.ts — Upgrade card selection overlay (3 cards, keyboard 1/2/3, touch).

import { Graphics, Text, TextStyle, Container } from 'pixi.js';
import type { UpgradeDef } from '@gameplay/upgrades/upgradeRegistry';
import { UPGRADE_REGISTRY } from '@gameplay/upgrades/upgradeRegistry';
import type { InputState } from '@input/inputManager';
import { CFG, S } from '@core/config';

const CARD_W = S(220);
const CARD_H = S(300);
const CARD_GAP = S(30);
const SLIDE_DUR = 0.3;

interface CardGraphics {
  container: Container;
  targetY: number;
  startY: number;
}

export class UpgradeCardsUI {
  private _layer: Container;
  private _cards: CardGraphics[] = [];
  private _rerollBtn: Graphics | null = null;
  private _rerollText: Text | null = null;
  private _cardBounds: Array<{ x: number; y: number; w: number; h: number }> = [];
  private _rerollBounds: { x: number; y: number; w: number; h: number } | null = null;
  private _animTimer = 0;
  private _visible = false;

  constructor(overlayLayer: Container) {
    this._layer = overlayLayer;
  }

  show(cards: UpgradeDef[], rerollsLeft: number, ownedUpgrades: string[] = []): void {
    this.hide();
    this._animTimer = 0;
    this._visible = true;
    this._cardBounds = [];

    // Background dim
    const dim = new Graphics();
    dim.rect(0, 0, CFG.W, CFG.H).fill({ color: 0x000000, alpha: 0.55 });
    this._layer.addChild(dim);

    // Title
    const titleStyle = new TextStyle({ fill: CFG.C_ACCENT, fontSize: S(28), fontFamily: 'Courier New, monospace', fontWeight: 'bold' });
    const title = new Text({ text: 'CHOOSE UPGRADE', style: titleStyle });
    title.anchor.set(0.5, 0);
    title.position.set(CFG.W / 2, S(40));
    this._layer.addChild(title);

    const totalW = cards.length * CARD_W + (cards.length - 1) * CARD_GAP;
    const startX = (CFG.W - totalW) / 2;
    const cardY = (CFG.H - CARD_H) / 2 - S(20);
    const offscreenY = CFG.H + CARD_H;

    this._cards = cards.map((card, i) => {
      const cx = startX + i * (CARD_W + CARD_GAP);
      const container = new Container();
      container.x = cx;
      container.y = offscreenY; // start below screen

      // Card background
      const bg = new Graphics();
      bg.rect(0, 0, CARD_W, CARD_H).fill({ color: 0x0d1520 });
      bg.rect(0, 0, CARD_W, CARD_H).stroke({ color: CFG.C_ACCENT, width: 2, alpha: 0.8 });
      container.addChild(bg);

      // Number hint
      const numStyle = new TextStyle({ fill: '#888888', fontSize: S(12), fontFamily: 'Courier New, monospace' });
      const numHint = new Text({ text: `[${i + 1}]`, style: numStyle });
      numHint.position.set(S(8), S(8));
      container.addChild(numHint);

      // Icon
      const iconStyle = new TextStyle({ fill: '#ffffff', fontSize: S(36), fontFamily: 'Courier New, monospace', fontWeight: 'bold' });
      const iconTxt = new Text({ text: card.icon, style: iconStyle });
      iconTxt.anchor.set(0.5, 0);
      iconTxt.position.set(CARD_W / 2, S(30));
      container.addChild(iconTxt);

      // Name
      const nameStyle = new TextStyle({ fill: CFG.C_TEXT, fontSize: S(16), fontFamily: 'Courier New, monospace', fontWeight: 'bold' });
      const nameTxt = new Text({ text: card.name, style: nameStyle });
      nameTxt.anchor.set(0.5, 0);
      nameTxt.position.set(CARD_W / 2, S(90));
      container.addChild(nameTxt);

      // Desc (word-wrap)
      const descStyle = new TextStyle({
        fill: '#aaaaaa',
        fontSize: S(13),
        fontFamily: 'Courier New, monospace',
        wordWrap: true,
        wordWrapWidth: CARD_W - S(20),
        align: 'center',
      });
      const descTxt = new Text({ text: card.desc, style: descStyle });
      descTxt.anchor.set(0.5, 0);
      descTxt.position.set(CARD_W / 2, S(120));
      container.addChild(descTxt);

      this._layer.addChild(container);
      this._cardBounds.push({ x: cx, y: cardY, w: CARD_W, h: CARD_H });

      return { container, targetY: cardY, startY: offscreenY };
    });

    // Reroll button
    const rerollColor = rerollsLeft > 0 ? '#dddddd' : '#666666';
    const rerollStyle = new TextStyle({ fill: rerollColor, fontSize: S(15), fontFamily: 'Courier New, monospace' });
    this._rerollText = new Text({ text: `Press [R] to reroll (${rerollsLeft} left)`, style: rerollStyle });
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
        style: new TextStyle({ fill: '#555566', fontSize: S(11), fontFamily: 'Courier New, monospace', letterSpacing: 1 }),
      });
      label.anchor.set(0.5, 0);
      label.position.set(CFG.W / 2, labelY);
      this._layer.addChild(label);

      const itemsTxt = new Text({
        text: itemStr,
        style: new TextStyle({
          fill: '#99aabb',
          fontSize: S(13),
          fontFamily: 'Courier New, monospace',
          wordWrap: true,
          wordWrapWidth: CFG.W - S(120),
          align: 'center',
        }),
      });
      itemsTxt.anchor.set(0.5, 0);
      itemsTxt.position.set(CFG.W / 2, labelY + S(18));
      this._layer.addChild(itemsTxt);
    }
  }

  hide(): void {
    this._layer.removeChildren();
    this._cards = [];
    this._rerollBtn = null;
    this._rerollText = null;
    this._cardBounds = [];
    this._rerollBounds = null;
    this._visible = false;
  }

  update(dt: number): void {
    if (!this._visible) return;
    this._animTimer = Math.min(this._animTimer + dt, SLIDE_DUR);
    const t = this._animTimer / SLIDE_DUR;
    const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic

    for (const card of this._cards) {
      card.container.y = card.startY + (card.targetY - card.startY) * ease;
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
    this.hide();
  }
}
