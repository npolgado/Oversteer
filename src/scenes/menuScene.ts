// menuScene.ts — Title screen. Transitions to MapSelectScene.

import { Graphics, Text, TextStyle } from 'pixi.js';
import type { Scene, GameContext } from './sceneManager';
import { CFG, S } from '@core/config';
import { saveManager } from '@core/saveManager';
import { sceneManager } from './sceneManager';
import { MapSelectScene } from './mapSelectScene';

export class MenuScene implements Scene {
  private _objects: Array<{ destroy(): void }> = [];
  private _clock = 0;
  private _titleText: Text | null = null;

  enter(context: GameContext): void {
    const { overlayLayer } = context.pixiApp;

    // Background
    const bg = new Graphics();
    bg.rect(0, 0, CFG.W, CFG.H).fill({ color: 0x07080b });
    overlayLayer.addChild(bg);
    this._objects.push(bg);

    // Title
    const titleStyle = new TextStyle({
      fill: CFG.C_ACCENT,
      fontSize: S(64),
      fontFamily: 'Courier New, monospace',
      fontWeight: 'bold',
      dropShadow: { color: CFG.C_ACCENT, distance: 0, blur: 24, alpha: 0.6 },
    });
    this._titleText = new Text({ text: 'OVERSTEER', style: titleStyle });
    this._titleText.anchor.set(0.5);
    this._titleText.position.set(CFG.W / 2, CFG.H * 0.35);
    overlayLayer.addChild(this._titleText);
    this._objects.push(this._titleText);

    // High score
    const hs = saveManager.getHighScore();
    const hsStyle = new TextStyle({ fill: '#aaaaaa', fontSize: S(18), fontFamily: 'Courier New, monospace' });
    const hsTxt = new Text({ text: hs > 0 ? `BEST: ${hs}` : '', style: hsStyle });
    hsTxt.anchor.set(0.5);
    hsTxt.position.set(CFG.W / 2, CFG.H * 0.48);
    overlayLayer.addChild(hsTxt);
    this._objects.push(hsTxt);

    // Controls hint
    const hintStyle = new TextStyle({ fill: '#666666', fontSize: S(14), fontFamily: 'Courier New, monospace' });
    const hintTxt = new Text({ text: 'WASD / drive  •  SPACE / drift  •  ENTER / play  •  S / sandbox', style: hintStyle });
    hintTxt.anchor.set(0.5);
    hintTxt.position.set(CFG.W / 2, CFG.H * 0.9);
    overlayLayer.addChild(hintTxt);
    this._objects.push(hintTxt);

    // Press Enter
    const enterStyle = new TextStyle({ fill: CFG.C_TEXT, fontSize: S(22), fontFamily: 'Courier New, monospace', fontWeight: 'bold' });
    const enterTxt = new Text({ text: 'PRESS ENTER TO PLAY', style: enterStyle });
    enterTxt.anchor.set(0.5);
    enterTxt.position.set(CFG.W / 2, CFG.H * 0.62);
    overlayLayer.addChild(enterTxt);
    this._objects.push(enterTxt);

    this._clock = 0;
  }

  update(dt: number, context: GameContext): void {
    this._clock += dt;

    // Pulse title
    if (this._titleText) {
      this._titleText.alpha = 0.85 + 0.15 * Math.sin(this._clock * 1.5);
    }

    const input = context.getInput();
    if (input.enter) {
      context.audioManager.play('ui_click');
      this._go(context, false);
    } else if (input.menuLeft || input.menuRight) {
      // S key: menuLeft maps to KeyA — but for sandbox we specifically want KeyS
      // Handled via rawKeys check; since InputState doesn't expose KeyS directly,
      // use 'down' as a proxy (KeyS = move backward = down)
    }
    // KeyS check via 'down' (KeyS = brake/down in driving, but only in menu context)
    // NOTE: 'down' is also used for driving — only valid since player isn't active here
    if (input.down) {
      context.audioManager.play('ui_click');
      this._go(context, true);
    }
  }

  private _go(_context: GameContext, sandbox: boolean): void {
    sceneManager.switchTo(new MapSelectScene({ sandbox }), { fade: 0.25 });
  }

  exit(context: GameContext): void {
    context.pixiApp.overlayLayer.removeChildren();
    this._objects = [];
    this._titleText = null;
  }
}
