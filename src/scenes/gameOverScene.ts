// gameOverScene.ts — Game over screen with final score, stats, restart/menu.

import { Graphics, Text } from 'pixi.js';
import type { Scene, GameContext } from './sceneManager';
import { CFG, S } from '@core/config';
import type { RunStats } from '@gameplay/pureLogic';
import { sceneManager } from './sceneManager';
import { MenuScene } from './menuScene';
import { GameplayScene } from './gameplayScene';
import { makeUIStyle } from '@ui/textStyles';

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
    const title = new Text({ text: 'GAME OVER', style: makeUIStyle({ size: S(48), color: '#FF3B6B', bold: true }) });
    title.anchor.set(0.5, 0);
    title.position.set(CFG.W / 2, y);
    overlayLayer.addChild(title);
    y += S(70);

    // New best banner
    if (d.newBest) {
      const best = new Text({ text: '★ NEW BEST! ★', style: makeUIStyle({ size: S(22), color: CFG.C_ACCENT, bold: true }) });
      best.anchor.set(0.5, 0);
      best.position.set(CFG.W / 2, y);
      overlayLayer.addChild(best);
      y += S(36);
    }

    // Score
    const scoreTxt = new Text({ text: `SCORE: ${Math.floor(d.score)}`, style: makeUIStyle({ size: S(32), color: CFG.C_TEXT, bold: true }) });
    scoreTxt.anchor.set(0.5, 0);
    scoreTxt.position.set(CFG.W / 2, y);
    overlayLayer.addChild(scoreTxt);
    y += S(44);

    // High score
    const hsTxt = new Text({ text: `BEST: ${Math.floor(d.highScore)}`, style: makeUIStyle({ size: S(16), color: '#888888' }) });
    hsTxt.anchor.set(0.5, 0);
    hsTxt.position.set(CFG.W / 2, y);
    overlayLayer.addChild(hsTxt);
    y += S(40);

    // Wave reached
    const waveTxt = new Text({ text: `WAVE REACHED: ${d.waveReached}`, style: makeUIStyle({ size: S(18), color: '#aaaaaa' }) });
    waveTxt.anchor.set(0.5, 0);
    waveTxt.position.set(CFG.W / 2, y);
    overlayLayer.addChild(waveTxt);
    y += S(40);

    // Modifier mult
    if (d.modifierMult > 1) {
      const multTxt = new Text({ text: `Score multiplier: ${d.modifierMult.toFixed(2)}×`, style: makeUIStyle({ size: S(15), color: CFG.C_ACCENT }) });
      multTxt.anchor.set(0.5, 0);
      multTxt.position.set(CFG.W / 2, y);
      overlayLayer.addChild(multTxt);
      y += S(32);
    }

    // Run stats
    const statStyle = makeUIStyle({ size: S(14), color: '#666666' });
    const stats = [
      `Peak combo: ${d.runStats.peakCombo}`,
      `Near misses: ${d.runStats.nearMissTotal}`,
      `Drift time: ${d.runStats.totalDriftTime.toFixed(1)}s`,
      `Enemies killed: ${d.runStats.enemiesKilled}`,
      `Scrap collected: ${d.runStats.scrapCollected}`,
    ];
    for (const stat of stats) {
      const txt = new Text({ text: stat, style: statStyle });
      txt.anchor.set(0.5, 0);
      txt.position.set(CFG.W / 2, y);
      overlayLayer.addChild(txt);
      y += S(22);
    }

    // Input hints
    const hintTxt = new Text({ text: 'R / Enter / Start — Restart  •  M / Esc / B — Menu', style: makeUIStyle({ size: S(15), color: '#555555' }) });
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

    if (input.reroll || input.enter || input.menuLaunch) {
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
