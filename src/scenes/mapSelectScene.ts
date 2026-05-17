// mapSelectScene.ts — Map + difficulty modifier selection.

import { Graphics, Text } from 'pixi.js';
import type { Scene, GameContext } from './sceneManager';
import { CFG, S, applyMap } from '@core/config';
import { saveManager } from '@core/saveManager';
import { sceneManager } from './sceneManager';
import { MAPS, DIFFICULTY_MODIFIERS, computeModifierScoreMult } from '@content/maps';
import { MenuScene } from './menuScene';
import { GameplayScene, type GameplayOptions } from './gameplayScene';
import { makeUIStyle } from '@ui/textStyles';

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
    const title = new Text({ text: this._sandbox ? 'SANDBOX — SELECT MAP' : 'SELECT MAP', style: makeUIStyle({ size: S(28), color: CFG.C_ACCENT, bold: true }) });
    title.anchor.set(0.5, 0);
    title.position.set(CFG.W / 2, S(40));
    overlayLayer.addChild(title);

    // Map name
    this._mapNameText = new Text({ text: '', style: makeUIStyle({ size: S(32), color: CFG.C_TEXT, bold: true }) });
    this._mapNameText.anchor.set(0.5);
    this._mapNameText.position.set(CFG.W / 2, CFG.H * 0.38);
    overlayLayer.addChild(this._mapNameText);

    // Map desc
    this._mapDescText = new Text({ text: '', style: makeUIStyle({ size: S(16), color: '#888888' }) });
    this._mapDescText.anchor.set(0.5);
    this._mapDescText.position.set(CFG.W / 2, CFG.H * 0.46);
    overlayLayer.addChild(this._mapDescText);

    // Map nav hint
    const navTxt = new Text({ text: '← A/D →', style: makeUIStyle({ size: S(13), color: '#555555' }) });
    navTxt.anchor.set(0.5);
    navTxt.position.set(CFG.W / 2, CFG.H * 0.54);
    overlayLayer.addChild(navTxt);

    // Modifier labels
    this._modTexts = [];
    const modY = CFG.H * 0.65;
    for (let i = 0; i < DIFFICULTY_MODIFIERS.length; i++) {
      const mod = DIFFICULTY_MODIFIERS[i];
      const mTxt = new Text({ text: `[${mod.key}] ${mod.label} — ${mod.desc}`, style: makeUIStyle({ size: S(15), color: '#888888' }) });
      mTxt.anchor.set(0.5);
      mTxt.position.set(CFG.W / 2, modY + i * S(28));
      overlayLayer.addChild(mTxt);
      this._modTexts.push(mTxt);
    }

    // Multiplier display
    this._multText = new Text({ text: '', style: makeUIStyle({ size: S(16), color: CFG.C_ACCENT }) });
    this._multText.anchor.set(0.5);
    this._multText.position.set(CFG.W / 2, CFG.H * 0.87);
    overlayLayer.addChild(this._multText);

    // Controls hint
    const hintTxt = new Text({ text: 'ENTER to start  •  ESC to go back', style: makeUIStyle({ size: S(13), color: '#555555' }) });
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
