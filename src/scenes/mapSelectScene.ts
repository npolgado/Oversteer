// mapSelectScene.ts — Map + difficulty modifier selection.

import { Graphics, Text, TextStyle } from 'pixi.js';
import type { Scene, GameContext } from './sceneManager';
import { CFG, S, applyMap } from '@core/config';
import { saveManager } from '@core/saveManager';
import { sceneManager } from './sceneManager';
import { MAPS, DIFFICULTY_MODIFIERS, computeModifierScoreMult } from '@content/maps';
import { MenuScene } from './menuScene';
import { GameplayScene, type GameplayOptions } from './gameplayScene';

interface MapSelectOptions {
  sandbox: boolean;
}

export class MapSelectScene implements Scene {
  private _sandbox: boolean;
  private _mapIndex = 0;
  private _activeModIds: string[] = [];
  private _modTexts: Text[] = [];
  private _mapNameText: Text | null = null;
  private _mapDescText: Text | null = null;
  private _multText: Text | null = null;

  constructor(opts: MapSelectOptions) {
    this._sandbox = opts.sandbox;
  }

  enter(context: GameContext): void {
    const { overlayLayer } = context.pixiApp;

    const savedMap = saveManager.getSelectedMap();
    const idx = MAPS.findIndex((m: { id: string }) => m.id === savedMap);
    this._mapIndex = idx >= 0 ? idx : 0;
    this._activeModIds = [];

    // Background
    const bg = new Graphics();
    bg.rect(0, 0, CFG.W, CFG.H).fill({ color: 0x07080b });
    overlayLayer.addChild(bg);

    // Title
    const titleStyle = new TextStyle({ fill: CFG.C_ACCENT, fontSize: S(28), fontFamily: 'Courier New, monospace', fontWeight: 'bold' });
    const title = new Text({ text: this._sandbox ? 'SANDBOX — SELECT MAP' : 'SELECT MAP', style: titleStyle });
    title.anchor.set(0.5, 0);
    title.position.set(CFG.W / 2, S(40));
    overlayLayer.addChild(title);

    // Map name
    const nameStyle = new TextStyle({ fill: CFG.C_TEXT, fontSize: S(32), fontFamily: 'Courier New, monospace', fontWeight: 'bold' });
    this._mapNameText = new Text({ text: '', style: nameStyle });
    this._mapNameText.anchor.set(0.5);
    this._mapNameText.position.set(CFG.W / 2, CFG.H * 0.38);
    overlayLayer.addChild(this._mapNameText);

    // Map desc
    const descStyle = new TextStyle({ fill: '#888888', fontSize: S(16), fontFamily: 'Courier New, monospace' });
    this._mapDescText = new Text({ text: '', style: descStyle });
    this._mapDescText.anchor.set(0.5);
    this._mapDescText.position.set(CFG.W / 2, CFG.H * 0.46);
    overlayLayer.addChild(this._mapDescText);

    // Map nav hint
    const navStyle = new TextStyle({ fill: '#555555', fontSize: S(13), fontFamily: 'Courier New, monospace' });
    const navTxt = new Text({ text: '← A/D →', style: navStyle });
    navTxt.anchor.set(0.5);
    navTxt.position.set(CFG.W / 2, CFG.H * 0.54);
    overlayLayer.addChild(navTxt);

    // Modifier labels
    this._modTexts = [];
    const modY = CFG.H * 0.65;
    for (let i = 0; i < DIFFICULTY_MODIFIERS.length; i++) {
      const mod = DIFFICULTY_MODIFIERS[i];
      const mStyle = new TextStyle({ fill: '#888888', fontSize: S(15), fontFamily: 'Courier New, monospace' });
      const mTxt = new Text({ text: `[${mod.key}] ${mod.label} — ${mod.desc}`, style: mStyle });
      mTxt.anchor.set(0.5);
      mTxt.position.set(CFG.W / 2, modY + i * S(28));
      overlayLayer.addChild(mTxt);
      this._modTexts.push(mTxt);
    }

    // Multiplier display
    const multStyle = new TextStyle({ fill: CFG.C_ACCENT, fontSize: S(16), fontFamily: 'Courier New, monospace' });
    this._multText = new Text({ text: '', style: multStyle });
    this._multText.anchor.set(0.5);
    this._multText.position.set(CFG.W / 2, CFG.H * 0.87);
    overlayLayer.addChild(this._multText);

    // Controls hint
    const hintStyle = new TextStyle({ fill: '#555555', fontSize: S(13), fontFamily: 'Courier New, monospace' });
    const hintTxt = new Text({ text: 'ENTER to start  •  ESC to go back', style: hintStyle });
    hintTxt.anchor.set(0.5);
    hintTxt.position.set(CFG.W / 2, CFG.H * 0.93);
    overlayLayer.addChild(hintTxt);

    this._refreshDisplay();
  }

  update(_dt: number, context: GameContext): void {
    const input = context.getInput();

    if (input.menuLeft) {
      context.audioManager.play('ui_click');
      this._mapIndex = (this._mapIndex - 1 + MAPS.length) % MAPS.length;
      saveManager.setSelectedMap(MAPS[this._mapIndex].id);
      this._refreshDisplay();
    }
    if (input.menuRight) {
      context.audioManager.play('ui_click');
      this._mapIndex = (this._mapIndex + 1) % MAPS.length;
      saveManager.setSelectedMap(MAPS[this._mapIndex].id);
      this._refreshDisplay();
    }

    // Modifier toggles
    const modKeys = [input.menuMod1, input.menuMod2, input.menuMod3, input.menuMod4];
    for (let i = 0; i < DIFFICULTY_MODIFIERS.length; i++) {
      if (modKeys[i]) {
        context.audioManager.play('ui_click');
        const id = DIFFICULTY_MODIFIERS[i].id;
        const idx = this._activeModIds.indexOf(id);
        if (idx >= 0) this._activeModIds.splice(idx, 1);
        else this._activeModIds.push(id);
        this._refreshDisplay();
      }
    }

    if (input.escape) {
      context.audioManager.play('ui_click');
      sceneManager.switchTo(new MenuScene(), { fade: 0.25 });
      return;
    }

    if (input.enter) {
      context.audioManager.play('ui_click');
      const mapId = MAPS[this._mapIndex].id;
      sceneManager.switchTo(new GameplayScene({
        mapId,
        modifierIds: this._activeModIds.slice(),
        sandbox: this._sandbox,
      }));
    }
  }

  private _refreshDisplay(): void {
    const map = MAPS[this._mapIndex];
    if (this._mapNameText) this._mapNameText.text = map.name;
    if (this._mapDescText) this._mapDescText.text = map.desc;

    for (let i = 0; i < this._modTexts.length; i++) {
      const mod = DIFFICULTY_MODIFIERS[i];
      const active = this._activeModIds.includes(mod.id);
      this._modTexts[i].style.fill = active ? '#ffffff' : '#555555';
      this._modTexts[i].text = `[${mod.key}] ${mod.label} — ${mod.desc}`;
    }

    if (this._multText) {
      const mult = computeModifierScoreMult(this._activeModIds);
      this._multText.text = this._activeModIds.length > 0
        ? `Score multiplier: ${mult.toFixed(2)}×`
        : '';
    }
  }

  exit(context: GameContext): void {
    context.pixiApp.overlayLayer.removeChildren();
    this._mapNameText = null;
    this._mapDescText = null;
    this._multText = null;
    this._modTexts = [];
  }
}
