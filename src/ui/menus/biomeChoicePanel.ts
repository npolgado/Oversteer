// biomeChoicePanel.ts — Biome route selection overlay (2 options, keyboard/gamepad/touch).
// Shown at upgrade breaks when a biome choice is pending (only at wave 7→8).
// NOTE: not in original — Phase 4.5 route branching system.
// Uses manual-lerp slide-in (no GSAP alpha tweens on dynamically-added containers in Pixi v8).

import { Graphics, Text, Container } from 'pixi.js';
import type { InputState } from '@input/inputManager';
import type { BiomeId } from '@core/config';
import { CFG, S } from '@core/config';
import { makeUIStyle } from '@ui/textStyles';
import { lerp } from '@core/utils';

const PANEL_W = S(280);
const PANEL_H = S(200);
const PANEL_GAP = S(40);

const BIOME_INFO: Record<string, { icon: string; blurb: string; color: string }> = {
  rupture: { icon: '❄️', blurb: 'Ice plains & crystal hazards.\nHigh-skill handling challenge.', color: '#99BBFF' },
  jungle:  { icon: '🌿', blurb: 'Spreading corruption zones.\nHigher risk — +50% SCORE.', color: '#66DD66' },
};

export class BiomeChoicePanel {
  private _layer: Container;
  private _container: Container | null = null;
  private _choices: BiomeId[] = [];
  private _panelBounds: Array<{ x: number; y: number; w: number; h: number }> = [];
  private _visible = false;
  private _animTimer = 0;
  private _offscreenY = 0;
  private _targetY = 0;

  constructor(overlayLayer: Container) {
    this._layer = overlayLayer;
  }

  show(choices: [BiomeId, BiomeId]): void {
    this.hide();
    this._choices = choices;
    this._panelBounds = [];
    this._visible = true;
    this._animTimer = 0;

    const c = new Container();
    this._offscreenY = CFG.H + PANEL_H;
    this._targetY = 0;
    c.y = this._offscreenY;
    this._container = c;

    // Dim background
    const dim = new Graphics();
    dim.rect(0, 0, CFG.W, CFG.H).fill({ color: 0x000000, alpha: 0.45 });
    c.addChild(dim);

    // Title
    const title = new Text({ text: 'CHOOSE YOUR PATH', style: makeUIStyle({ size: S(24), color: CFG.C_ACCENT, bold: true }) });
    title.anchor.set(0.5, 0);
    title.position.set(CFG.W / 2, S(60));
    c.addChild(title);

    const subtitle = new Text({ text: 'Your choice shapes waves 8-14', style: makeUIStyle({ size: S(13), color: '#888888' }) });
    subtitle.anchor.set(0.5, 0);
    subtitle.position.set(CFG.W / 2, S(92));
    c.addChild(subtitle);

    const totalW = choices.length * PANEL_W + (choices.length - 1) * PANEL_GAP;
    const startX = (CFG.W - totalW) / 2;
    const panelY = S(120);

    choices.forEach((id, i) => {
      const info = BIOME_INFO[id] ?? { icon: '?', blurb: '', color: '#ffffff' };
      const px = startX + i * (PANEL_W + PANEL_GAP);

      const bg = new Graphics();
      bg.rect(px, panelY, PANEL_W, PANEL_H).fill({ color: 0x0d1520 });
      bg.rect(px, panelY, PANEL_W, PANEL_H).stroke({ color: info.color, width: 2, alpha: 0.8 });
      c.addChild(bg);

      // Keyboard hint
      const hint = new Text({ text: `[${i === 0 ? '←' : '→'}] / ${i === 0 ? 'X' : 'Y'}`, style: makeUIStyle({ size: S(11), color: '#666666' }) });
      hint.position.set(px + S(8), panelY + S(8));
      c.addChild(hint);

      const iconTxt = new Text({ text: info.icon, style: makeUIStyle({ size: S(36), color: '#ffffff' }) });
      iconTxt.anchor.set(0.5, 0);
      iconTxt.position.set(px + PANEL_W / 2, panelY + S(28));
      c.addChild(iconTxt);

      const nameTxt = new Text({ text: id.toUpperCase(), style: makeUIStyle({ size: S(16), color: info.color, bold: true }) });
      nameTxt.anchor.set(0.5, 0);
      nameTxt.position.set(px + PANEL_W / 2, panelY + S(78));
      c.addChild(nameTxt);

      const blurbTxt = new Text({ text: info.blurb, style: makeUIStyle({ size: S(12), color: '#aaaaaa', wordWrap: true, wordWrapWidth: PANEL_W - S(20), align: 'center' }) });
      blurbTxt.anchor.set(0.5, 0);
      blurbTxt.position.set(px + PANEL_W / 2, panelY + S(106));
      c.addChild(blurbTxt);

      this._panelBounds.push({ x: px, y: panelY, w: PANEL_W, h: PANEL_H });
    });

    this._layer.addChild(c);
  }

  hide(): void {
    if (this._container) {
      this._layer.removeChild(this._container);
      this._container = null;
    }
    this._visible = false;
    this._panelBounds = [];
  }

  update(dt: number): void {
    if (!this._visible || !this._container) return;
    this._animTimer += dt;
    const t = Math.min(this._animTimer / 0.35, 1);
    const eased = t * t * (3 - 2 * t); // smoothstep
    this._container.y = lerp(this._offscreenY, this._targetY, eased);
  }

  checkInput(
    input: Pick<InputState, 'menuLeft' | 'menuRight' | 'select1' | 'select2' | 'enter'>,
    tap: { x: number; y: number } | null,
  ): number | null {
    if (!this._visible) return null;

    // Keyboard: left/X = first choice, right/Y = second choice
    if (input.menuLeft || input.select1) return 0;
    if (input.menuRight || input.select2) return 1;

    // Touch hit-test
    if (tap) {
      for (let i = 0; i < this._panelBounds.length; i++) {
        const b = this._panelBounds[i];
        if (tap.x >= b.x && tap.x <= b.x + b.w && tap.y >= b.y && tap.y <= b.y + b.h) {
          return i;
        }
      }
    }

    return null;
  }

  get choices(): BiomeId[] { return this._choices; }

  destroy(): void { this.hide(); }
}
