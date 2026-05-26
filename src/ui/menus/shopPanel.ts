// shopPanel.ts — Between-wave scrap shop panel.
// Shown alongside upgrade cards during the upgrade break.
// Laid out on the right side of the screen; upgrade cards remain centered.

import { Container, Graphics, Text } from 'pixi.js';
import { CFG, S } from '@core/config';
import { makeUIStyle } from '@ui/textStyles';
import type { PlayerState } from '@gameplay/player/playerState';

const PANEL_W  = S(280);
const PANEL_H  = S(320);
const PANEL_X  = CFG.W - PANEL_W - S(30);
const PANEL_Y  = (CFG.H - PANEL_H) / 2;
const ITEM_H   = S(72);
const ITEM_GAP = S(8);

interface ShopItemDef {
  label: string;
  desc: string;
  cost: number;
  apply: (p: PlayerState) => void;
  canApply?: (p: PlayerState) => boolean;
}

const SHOP_ITEMS: ShopItemDef[] = [
  {
    label: 'Field Repair',
    desc: 'Restore 50 HP',
    cost: 8,
    canApply: (p) => p.hp < p.maxHp,
    apply: (p) => { p.hp = Math.min(p.maxHp, p.hp + 50); },
  },
  {
    label: 'Brief Invincibility',
    desc: '4s invulnerable next wave',
    cost: 5,
    apply: (p) => { p.invulnTimer = 4.0; },
  },
  {
    label: 'Score Surge',
    desc: '2× score mult for 30s',
    cost: 12,
    apply: (p) => { p.scoreMultBoostTimer = 30.0; },
  },
];

interface ItemGraphics {
  container: Container;
  buyBtn: Graphics;
  buyText: Text;
  bounds: { x: number; y: number; w: number; h: number };
}

export class ShopPanelUI {
  private _layer: Container;
  private _panel: Container | null = null;
  private _bankText: Text | null = null;
  private _items: ItemGraphics[] = [];
  private _visible = false;

  constructor(overlayLayer: Container) {
    this._layer = overlayLayer;
  }

  show(player: PlayerState): void {
    this._clearPanel();
    this._visible = true;
    this._panel = new Container();
    this._panel.position.set(PANEL_X, PANEL_Y);
    this._layer.addChild(this._panel);
    this._rebuild(player);
  }

  /** Rebuild the panel visuals to reflect current player state. */
  private _rebuild(player: PlayerState): void {
    if (!this._panel) return;
    this._panel.removeChildren();
    this._items = [];

    // Panel background
    const bg = new Graphics();
    bg.rect(0, 0, PANEL_W, PANEL_H).fill({ color: 0x0a1018, alpha: 0.92 });
    bg.rect(0, 0, PANEL_W, PANEL_H).stroke({ color: 0xFFB000, width: 1.5, alpha: 0.6 });
    this._panel.addChild(bg);

    // Title
    const title = new Text({ text: 'SHOP', style: makeUIStyle({ size: S(16), color: '#ffb000', bold: true, letterSpacing: 2 }) });
    title.anchor.set(0.5, 0);
    title.position.set(PANEL_W / 2, S(12));
    this._panel.addChild(title);

    // Scrap bank
    this._bankText = new Text({
      text: `🪙 ${player.scrapBank} scrap`,
      style: makeUIStyle({ size: S(14), color: '#ddbb44' }),
    });
    this._bankText.anchor.set(0.5, 0);
    this._bankText.position.set(PANEL_W / 2, S(34));
    this._panel.addChild(this._bankText);

    // Divider
    const div = new Graphics();
    div.rect(S(12), S(54), PANEL_W - S(24), 1).fill({ color: 0xFFB000, alpha: 0.3 });
    this._panel.addChild(div);

    // Shop items
    const itemsStartY = S(62);
    SHOP_ITEMS.forEach((def, i) => {
      const iy = itemsStartY + i * (ITEM_H + ITEM_GAP);
      const canAfford = player.scrapBank >= def.cost;
      const isUsable = !def.canApply || def.canApply(player);
      const enabled = canAfford && isUsable;
      const itemAlpha = enabled ? 1.0 : 0.4;

      const itemContainer = new Container();
      itemContainer.position.set(S(10), iy);
      itemContainer.alpha = itemAlpha;
      this._panel!.addChild(itemContainer);

      // Item bg
      const itemBg = new Graphics();
      itemBg.rect(0, 0, PANEL_W - S(20), ITEM_H).fill({ color: 0x0d1a28 });
      itemBg.rect(0, 0, PANEL_W - S(20), ITEM_H).stroke({ color: enabled ? 0x35F2D0 : 0x334455, width: 1 });
      itemContainer.addChild(itemBg);

      // Label
      const labelTxt = new Text({ text: def.label, style: makeUIStyle({ size: S(13), color: '#ffffff', bold: true }) });
      labelTxt.position.set(S(8), S(8));
      itemContainer.addChild(labelTxt);

      // Desc
      const descTxt = new Text({ text: def.desc, style: makeUIStyle({ size: S(11), color: '#99aabb' }) });
      descTxt.position.set(S(8), S(26));
      itemContainer.addChild(descTxt);

      // Buy button
      const btnW = S(72); const btnH = S(24);
      const btnX = PANEL_W - S(20) - btnW - S(6);
      const btnY = (ITEM_H - btnH) / 2;
      const buyBtn = new Graphics();
      buyBtn.rect(btnX, btnY, btnW, btnH).fill({ color: enabled ? 0x35F2D0 : 0x223344 });
      itemContainer.addChild(buyBtn);

      const buyText = new Text({
        text: `${def.cost} 🪙`,
        style: makeUIStyle({ size: S(12), color: enabled ? '#000000' : '#556677', bold: true }),
      });
      buyText.anchor.set(0.5, 0.5);
      buyText.position.set(btnX + btnW / 2, btnY + btnH / 2);
      itemContainer.addChild(buyText);

      const worldBounds = {
        x: PANEL_X + S(10) + btnX,
        y: PANEL_Y + iy + btnY,
        w: btnW,
        h: btnH,
      };
      this._items.push({ container: itemContainer, buyBtn, buyText, bounds: worldBounds });
    });
  }

  /**
   * Check if a tap hit a shop buy button. Returns the item index if purchased,
   * or null if nothing was bought.
   */
  tryPurchase(tap: { x: number; y: number } | null, player: PlayerState): number | null {
    if (!this._visible || !tap) return null;
    for (let i = 0; i < this._items.length; i++) {
      const b = this._items[i].bounds;
      if (tap.x >= b.x && tap.x <= b.x + b.w && tap.y >= b.y && tap.y <= b.y + b.h) {
        const def = SHOP_ITEMS[i];
        const canAfford = player.scrapBank >= def.cost;
        const isUsable = !def.canApply || def.canApply(player);
        if (canAfford && isUsable) {
          player.scrapBank -= def.cost;
          def.apply(player);
          this._rebuild(player); // refresh to show updated bank + disabled state
          return i;
        }
      }
    }
    return null;
  }

  hide(): void {
    this._clearPanel();
    this._visible = false;
  }

  destroy(): void {
    this._clearPanel();
  }

  private _clearPanel(): void {
    if (this._panel) {
      this._layer.removeChild(this._panel);
      this._panel.destroy({ children: true });
      this._panel = null;
    }
    this._bankText = null;
    this._items = [];
  }
}
