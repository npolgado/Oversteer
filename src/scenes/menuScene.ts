// menuScene.ts — Title screen. Transitions to MapSelectScene.

import { Graphics, Text } from 'pixi.js';
import type { Scene, GameContext } from './sceneManager';
import { CFG, S } from '@core/config';
import { saveManager } from '@core/saveManager';
import { sceneManager } from './sceneManager';
import { MapSelectScene } from './mapSelectScene';
import { makeUIStyle } from '@ui/textStyles';
import { watchdogMenuEntered, watchdogMenuInputReceived } from '@debug/watchdog';

export class MenuScene implements Scene {
  private _objects: Array<{ destroy(): void }> = [];
  private _clock = 0;
  private _titleText: Text | null = null;

  enter(context: GameContext): void {
    watchdogMenuEntered();
    const { overlayLayer } = context.pixiApp;

    // Background
    const bg = new Graphics();
    bg.rect(0, 0, CFG.W, CFG.H).fill({ color: 0x07080b });
    overlayLayer.addChild(bg);
    this._objects.push(bg);

    // Title — custom glow dropshadow (not the standard black shadow)
    this._titleText = new Text({ text: 'OVERSTEER', style: makeUIStyle({
      size: S(64), color: CFG.C_ACCENT, bold: true,
      dropShadow: { color: CFG.C_ACCENT, distance: 0, blur: 24, alpha: 0.6 },
    }) });
    this._titleText.anchor.set(0.5);
    this._titleText.position.set(CFG.W / 2, CFG.H * 0.35);
    overlayLayer.addChild(this._titleText);
    this._objects.push(this._titleText);

    // High score
    const hs = saveManager.getHighScore();
    const hsTxt = new Text({ text: hs > 0 ? `BEST: ${hs}` : '', style: makeUIStyle({ size: S(18), color: '#aaaaaa' }) });
    hsTxt.anchor.set(0.5);
    hsTxt.position.set(CFG.W / 2, CFG.H * 0.48);
    overlayLayer.addChild(hsTxt);
    this._objects.push(hsTxt);

    // Controls hint
    const hintTxt = new Text({ text: 'WASD / drive  •  SPACE / drift  •  ENTER / play  •  S / sandbox', style: makeUIStyle({ size: S(14), color: '#666666' }) });
    hintTxt.anchor.set(0.5);
    hintTxt.position.set(CFG.W / 2, CFG.H * 0.9);
    overlayLayer.addChild(hintTxt);
    this._objects.push(hintTxt);

    // Press Enter
    const enterTxt = new Text({ text: 'PRESS ENTER TO PLAY', style: makeUIStyle({ size: S(22), color: CFG.C_TEXT, bold: true }) });
    enterTxt.anchor.set(0.5);
    enterTxt.position.set(CFG.W / 2, CFG.H * 0.62);
    overlayLayer.addChild(enterTxt);
    this._objects.push(enterTxt);

    this._clock = 0;
    context.audioManager.startBgMusic();
  }

  update(dt: number, context: GameContext): void {
    this._clock += dt;

    // Pulse title
    if (this._titleText) {
      this._titleText.alpha = 0.85 + 0.15 * Math.sin(this._clock * 1.5);
    }

    const input = context.getInput();
    if (input.enter) {
      watchdogMenuInputReceived();
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
      watchdogMenuInputReceived();
      context.audioManager.play('ui_click');
      this._go(context, true);
    }
  }

  private _go(_context: GameContext, sandbox: boolean): void {
    sceneManager.switchTo(new MapSelectScene({ sandbox }), { fade: 0.25 });
  }

  exit(context: GameContext): void {
    watchdogMenuInputReceived(); // cancel idle timer on any exit, not just key press
    context.audioManager.fadeBgMusic(0.5);
    context.pixiApp.overlayLayer.removeChildren();
    this._objects = [];
    this._titleText = null;
  }
}
