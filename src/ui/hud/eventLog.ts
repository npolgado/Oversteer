// eventLog.ts — On-screen event log: max 7 entries, fade after 2.2s, gone at 3.5s.
// Matches behavior of arena-drifter/fx.js EventLog (age-based alpha, no GSAP tweens on entries).

import { Graphics, Text, Container } from 'pixi.js';
import { S } from '@core/config';
import { makeUIStyle } from '@ui/textStyles';

const MAX_ENTRIES = 7;
const ENTRY_LIFETIME = 3.5;
const FADE_START = 2.2;
const LINE_HEIGHT = () => S(17);
const PAD_V = () => S(5);
const PAD_H = () => S(7);
const PANEL_WIDTH = () => S(110);

interface LogEntry {
  text: string;
  color: number;
  pixiText: Text;
  age: number;
}

export class EventLog {
  private _layer: Container;
  private _bg: Graphics;
  private _entries: LogEntry[] = [];
  private _panelY: number;

  constructor(layer: Container, panelY: number) {
    this._layer = layer;
    this._panelY = panelY;
    this._bg = new Graphics();
    layer.addChild(this._bg);
  }

  /** Update Y position (called when score panel height changes due to newBest). */
  setPanelY(y: number): void {
    this._panelY = y;
  }

  add(text: string, color = 0xffffff): void {
    if (this._entries.length >= MAX_ENTRIES) {
      const oldest = this._entries.pop()!;
      oldest.pixiText.destroy();
    }

    const style = makeUIStyle({ size: S(14), color: `#${color.toString(16).padStart(6, '0')}` });
    const pixiText = new Text({ text, style });
    this._layer.addChild(pixiText);

    this._entries.unshift({ text, color, pixiText, age: 0 });
    this._reposition();
    this._drawBg();
  }

  update(dt: number): void {
    for (let i = this._entries.length - 1; i >= 0; i--) {
      const e = this._entries[i];
      e.age += dt;
      if (e.age >= ENTRY_LIFETIME) {
        e.pixiText.destroy();
        this._entries.splice(i, 1);
        continue;
      }
      // Match arena-drifter/fx.js:499-501 — full alpha until FADE_START, then linear fade.
      e.pixiText.alpha = e.age < FADE_START
        ? 1
        : 1 - (e.age - FADE_START) / (ENTRY_LIFETIME - FADE_START);
    }
    this._reposition();
    this._drawBg();
  }

  clear(): void {
    for (const e of this._entries) {
      e.pixiText.destroy();
    }
    this._entries = [];
    this._bg.clear();
  }

  destroy(): void {
    this.clear();
    this._bg.destroy();
    this._layer.removeChildren();
  }

  private _reposition(): void {
    const x = S(12) + PAD_H();
    for (let i = 0; i < this._entries.length; i++) {
      const e = this._entries[i];
      e.pixiText.position.set(x, this._panelY + PAD_V() + LINE_HEIGHT() * i + LINE_HEIGHT() / 2);
    }
  }

  private _drawBg(): void {
    this._bg.clear();
    if (this._entries.length === 0) return;
    const h = this._entries.length * LINE_HEIGHT() + PAD_V() * 2;
    this._bg.roundRect(S(12), this._panelY, PANEL_WIDTH(), h, S(4))
      .fill({ color: 0x000000, alpha: 0.55 });
  }
}
