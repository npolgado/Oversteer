// gameOverScene.ts — Game over screen with final score, stats, restart/menu.

import { Graphics, Text, TextStyle } from 'pixi.js';
import type { Scene, GameContext } from './sceneManager';
import { CFG, S } from '@core/config';
import type { RunStats } from '@gameplay/pureLogic';
import { sceneManager } from './sceneManager';
import { MenuScene } from './menuScene';
import { GameplayScene } from './gameplayScene';

export interface GameOverData {
  score: number;
  highScore: number;
  newBest: boolean;
  waveReached: number;
  runStats: RunStats;
  modifierMult: number;
  lastMapId: string;
  lastModifierIds: string[];
  sandbox: boolean;
}

export class GameOverScene implements Scene {
  private _data: GameOverData;
  private _lockTimer = 1.5; // input locked for 1.5s (from game.js gameOverTimer)

  constructor(data: GameOverData) {
    this._data = data;
  }

  enter(context: GameContext): void {
    const { overlayLayer } = context.pixiApp;
    const d = this._data;

    // Background dim
    const bg = new Graphics();
    bg.rect(0, 0, CFG.W, CFG.H).fill({ color: 0x07080b });
    overlayLayer.addChild(bg);

    let y = S(80);

    // Title
    const titleStyle = new TextStyle({ fill: '#FF3B6B', fontSize: S(48), fontFamily: 'Courier New, monospace', fontWeight: 'bold' });
    const title = new Text({ text: 'GAME OVER', style: titleStyle });
    title.anchor.set(0.5, 0);
    title.position.set(CFG.W / 2, y);
    overlayLayer.addChild(title);
    y += S(70);

    // New best banner
    if (d.newBest) {
      const bestStyle = new TextStyle({ fill: CFG.C_ACCENT, fontSize: S(22), fontFamily: 'Courier New, monospace', fontWeight: 'bold' });
      const best = new Text({ text: '★ NEW BEST! ★', style: bestStyle });
      best.anchor.set(0.5, 0);
      best.position.set(CFG.W / 2, y);
      overlayLayer.addChild(best);
      y += S(36);
    }

    // Score
    const scoreStyle = new TextStyle({ fill: CFG.C_TEXT, fontSize: S(32), fontFamily: 'Courier New, monospace', fontWeight: 'bold' });
    const scoreTxt = new Text({ text: `SCORE: ${Math.floor(d.score)}`, style: scoreStyle });
    scoreTxt.anchor.set(0.5, 0);
    scoreTxt.position.set(CFG.W / 2, y);
    overlayLayer.addChild(scoreTxt);
    y += S(44);

    // High score
    const hsStyle = new TextStyle({ fill: '#888888', fontSize: S(16), fontFamily: 'Courier New, monospace' });
    const hsTxt = new Text({ text: `BEST: ${Math.floor(d.highScore)}`, style: hsStyle });
    hsTxt.anchor.set(0.5, 0);
    hsTxt.position.set(CFG.W / 2, y);
    overlayLayer.addChild(hsTxt);
    y += S(40);

    // Wave reached
    const waveStyle = new TextStyle({ fill: '#aaaaaa', fontSize: S(18), fontFamily: 'Courier New, monospace' });
    const waveTxt = new Text({ text: `WAVE REACHED: ${d.waveReached}`, style: waveStyle });
    waveTxt.anchor.set(0.5, 0);
    waveTxt.position.set(CFG.W / 2, y);
    overlayLayer.addChild(waveTxt);
    y += S(40);

    // Modifier mult
    if (d.modifierMult > 1) {
      const multStyle = new TextStyle({ fill: CFG.C_ACCENT, fontSize: S(15), fontFamily: 'Courier New, monospace' });
      const multTxt = new Text({ text: `Score multiplier: ${d.modifierMult.toFixed(2)}×`, style: multStyle });
      multTxt.anchor.set(0.5, 0);
      multTxt.position.set(CFG.W / 2, y);
      overlayLayer.addChild(multTxt);
      y += S(32);
    }

    // Run stats
    const statStyle = new TextStyle({ fill: '#666666', fontSize: S(14), fontFamily: 'Courier New, monospace' });
    const stats = [
      `Peak combo: ${d.runStats.peakCombo}`,
      `Near misses: ${d.runStats.nearMissTotal}`,
      `Drift time: ${d.runStats.totalDriftTime.toFixed(1)}s`,
      `Enemies killed: ${d.runStats.enemiesKilled}`,
    ];
    for (const stat of stats) {
      const txt = new Text({ text: stat, style: statStyle });
      txt.anchor.set(0.5, 0);
      txt.position.set(CFG.W / 2, y);
      overlayLayer.addChild(txt);
      y += S(22);
    }

    // Input hints
    const hintStyle = new TextStyle({ fill: '#555555', fontSize: S(15), fontFamily: 'Courier New, monospace' });
    const hintTxt = new Text({ text: 'R / ENTER — Restart  •  M / ESC — Menu', style: hintStyle });
    hintTxt.anchor.set(0.5);
    hintTxt.position.set(CFG.W / 2, CFG.H * 0.93);
    overlayLayer.addChild(hintTxt);

    this._lockTimer = 1.5;
  }

  update(dt: number, context: GameContext): void {
    this._lockTimer -= dt;
    if (this._lockTimer > 0) return;

    const input = context.getInput();
    const d = this._data;

    if (input.reroll || input.enter) {
      sceneManager.switchTo(new GameplayScene({
        mapId: d.lastMapId,
        modifierIds: d.lastModifierIds,
        sandbox: d.sandbox,
      }));
    } else if (input.mute || input.escape) {
      sceneManager.switchTo(new MenuScene(), { fade: 0.25 });
    }
  }

  exit(context: GameContext): void {
    context.pixiApp.overlayLayer.removeChildren();
  }
}
