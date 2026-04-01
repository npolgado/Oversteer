// hudManager.ts — PixiJS HUD: score, HP bar, wave timer, enemy count, drift combo, speed.
// Matches layout of arena-drifter/game.js renderHUD().

import { Graphics, Text, TextStyle, Container } from 'pixi.js';
import { CFG, S } from '@core/config';
import type { WavePhase } from '@gameplay/spawning/waveManager';

export interface HudData {
  score: number;
  newBest: boolean;
  hp: number;
  maxHp: number;
  lastHitTimer: number;
  comboLevel: number;
  drifting: boolean;
  driftTime: number;
  speed: number;
  maxSpeed: number;
  waveIndex: number;
  enemyCount: number;
  phase: WavePhase;
  waveTimer: number;
  combatDuration: number;
}

function makeStyle(size: number, color: string, bold = false): TextStyle {
  return new TextStyle({
    fontFamily: 'Courier New, monospace',
    fontSize: size,
    fontWeight: bold ? 'bold' : 'normal',
    fill: color,
    dropShadow: { color: '#000', blur: 2, distance: 1 },
  });
}

export class HudManager {
  private _layer: Container;

  // Score panel
  private _scoreBg: Graphics;
  private _scoreLabel: Text;
  private _scoreValue: Text;
  private _newBestText: Text;

  // HP bar
  private _hpBg: Graphics;
  private _hpBar: Graphics;
  private _hpLabel: Text;
  private _hpText: Text;

  // Wave timer (top-center)
  private _waveBg: Graphics;
  private _waveBar: Graphics;
  private _waveLabel: Text;

  // Enemy count (top-right)
  private _enemyText: Text;

  // Drift combo bar (bottom-left)
  private _comboBg: Graphics;
  private _comboBar: Graphics;
  private _comboLabel: Text;

  // Speed indicator (bottom-right)
  private _speedBg: Graphics;
  private _speedBar: Graphics;
  private _speedLabel: Text;
  private _controlsHint: Text;

  constructor(layer: Container) {
    this._layer = layer;

    // --- Score panel ---
    this._scoreBg = new Graphics();
    this._scoreLabel = new Text({ text: 'SCORE', style: makeStyle(12, '#BBBBBB', true) });
    this._scoreLabel.position.set(S(20), S(14));
    this._scoreValue = new Text({ text: '0', style: makeStyle(22, '#EAEFF7', true) });
    this._scoreValue.position.set(S(20), S(30));
    this._newBestText = new Text({ text: 'NEW BEST!', style: makeStyle(10, '#FFB000', true) });
    this._newBestText.position.set(S(20), S(54));
    this._newBestText.visible = false;

    // --- HP bar ---
    this._hpBg = new Graphics();
    this._hpBar = new Graphics();
    this._hpLabel = new Text({ text: 'HP', style: makeStyle(10, '#BBBBBB') });
    this._hpText = new Text({ text: '100/100', style: makeStyle(9, '#EAEFF7') });

    // --- Wave timer ---
    this._waveBg = new Graphics();
    this._waveBar = new Graphics();
    this._waveLabel = new Text({ text: 'WAVE 1', style: makeStyle(11, '#AAAAAA') });
    this._waveLabel.anchor.set(0.5, 0);

    // --- Enemy count ---
    this._enemyText = new Text({ text: 'ENEMIES: 0', style: makeStyle(11, '#AAAAAA') });
    this._enemyText.anchor.set(1, 0);
    this._enemyText.position.set(CFG.W - S(20), S(14));

    // --- Drift combo ---
    this._comboBg = new Graphics();
    this._comboBar = new Graphics();
    this._comboLabel = new Text({ text: 'DRIFT x0', style: makeStyle(13, '#35F2D0', true) });

    // --- Speed indicator ---
    this._speedBg = new Graphics();
    this._speedBar = new Graphics();
    this._speedLabel = new Text({ text: 'SPD', style: makeStyle(9, '#999999') });
    this._speedLabel.anchor.set(1, 0.5);
    this._controlsHint = new Text({ text: 'WASD + SPACE', style: makeStyle(10, '#888888') });
    this._controlsHint.anchor.set(1, 0);
    this._controlsHint.position.set(CFG.W - S(20), CFG.H - S(20));

    // Add all to layer
    layer.addChild(
      this._scoreBg, this._scoreLabel, this._scoreValue, this._newBestText,
      this._hpBg, this._hpBar, this._hpLabel, this._hpText,
      this._waveBg, this._waveBar, this._waveLabel,
      this._enemyText,
      this._comboBg, this._comboBar, this._comboLabel,
      this._speedBg, this._speedBar, this._speedLabel, this._controlsHint,
    );
  }

  update(data: HudData): void {
    const scoreH = data.newBest ? S(56) : S(42);
    const hpY = scoreH + S(12);

    // --- Score panel ---
    this._scoreBg.clear();
    this._scoreBg.roundRect(S(12), S(8), S(110), scoreH, S(4)).fill({ color: 0x000000, alpha: 0.45 });

    this._scoreValue.text = Math.floor(data.score).toLocaleString();
    this._scoreValue.style.fill = data.newBest ? '#FFB000' : '#EAEFF7';
    this._newBestText.visible = data.newBest;

    // --- HP bar ---
    const hpFrac = Math.max(0, data.hp / data.maxHp);
    let hpColor: string;
    if (data.lastHitTimer < 0.2) hpColor = '#FF0000';
    else if (hpFrac > 0.6) hpColor = '#5BFF4A';
    else if (hpFrac > 0.3) hpColor = '#FFD93D';
    else hpColor = '#FF3B6B';

    const hpX = S(12);
    const barX = hpX + S(24);
    const barY = hpY + S(6);
    const barW = S(54);
    const barH = S(8);

    this._hpBg.clear();
    this._hpBg.roundRect(hpX, hpY, S(110), S(20), S(4))
      .fill({ color: 0x1a2233 })
      .stroke({ color: 0xffffff, alpha: 0.2, width: 1 });

    this._hpBar.clear();
    this._hpBar.rect(barX, barY, Math.max(1, barW * hpFrac), barH).fill({ color: hpColor });

    this._hpLabel.position.set(hpX + S(6), hpY + S(12));
    this._hpText.text = `${Math.ceil(data.hp)}/${data.maxHp}`;
    this._hpText.position.set(barX + barW + S(4), hpY + S(12));

    // --- Wave timer (top-center, combat only) ---
    const inCombat = data.phase === 'combat';
    this._waveBg.visible = inCombat;
    this._waveBar.visible = inCombat;
    this._waveLabel.visible = inCombat;
    this._enemyText.visible = inCombat;

    if (inCombat) {
      const bw = S(200);
      const bh = S(10);
      const bx = CFG.W / 2 - bw / 2;
      const by = S(14);
      const frac = data.combatDuration > 0 ? Math.min(1, data.waveTimer / data.combatDuration) : 0;

      this._waveBg.clear();
      this._waveBg.roundRect(bx - S(6), by - S(4), bw + S(12), bh + S(24), S(4))
        .fill({ color: 0x1a2233 })
        .stroke({ color: 0xffffff, alpha: 0.1, width: 1 });
      this._waveBg.rect(bx, by, bw, bh).fill({ color: 0x1a2233 });

      this._waveBar.clear();
      this._waveBar.rect(bx, by, Math.max(1, bw * frac), bh).fill({ color: 0x35f2d0 });

      this._waveLabel.text = `WAVE ${data.waveIndex}`;
      this._waveLabel.position.set(CFG.W / 2, by + bh + S(14));

      this._enemyText.text = `ENEMIES: ${data.enemyCount}`;
    }

    // --- Drift combo bar (bottom-left, only when drifting or combo > 0.5) ---
    const showCombo = data.drifting || data.comboLevel > 0.5;
    this._comboBg.visible = showCombo;
    this._comboBar.visible = showCombo;
    this._comboLabel.visible = showCombo;

    if (showCombo) {
      const cbx = S(20);
      const cby = CFG.H - S(30);
      const cbw = S(120);
      const cbh = S(8);
      const comboFrac = CFG.DRIFT_COMBO_INTERVAL > 0
        ? (data.driftTime % CFG.DRIFT_COMBO_INTERVAL) / CFG.DRIFT_COMBO_INTERVAL
        : 0;

      this._comboBg.clear();
      this._comboBg.roundRect(cbx - S(6), cby - S(20), cbw + S(12), cbh + S(34), S(4))
        .fill({ color: 0x1a2233 })
        .stroke({ color: 0xffffff, alpha: 0.1, width: 1 });
      this._comboBg.rect(cbx, cby, cbw, cbh).fill({ color: 0x1a2233 });

      this._comboBar.clear();
      this._comboBar.rect(cbx, cby, Math.max(1, cbw * comboFrac), cbh).fill({ color: 0x35f2d0 });

      const comboInt = Math.floor(data.comboLevel);
      this._comboLabel.text = `DRIFT x${comboInt}`;
      this._comboLabel.position.set(cbx, cby - S(16));
    }

    // --- Speed indicator (bottom-right) ---
    const sbw = S(60);
    const sbh = S(6);
    const sbx = CFG.W - S(20) - sbw;
    const sby = CFG.H - S(34);
    const speedFrac = data.maxSpeed > 0 ? Math.min(1, data.speed / data.maxSpeed) : 0;
    const atDrift = data.speed >= CFG.DRIFT_THRESHOLD;
    const driftFrac = data.maxSpeed > 0 ? Math.min(1, CFG.DRIFT_THRESHOLD / data.maxSpeed) : 0;

    this._speedBg.clear();
    this._speedBg.roundRect(sbx - S(30), sby - S(6), sbw + S(38), sbh + S(12), S(4))
      .fill({ color: 0x1a2233 })
      .stroke({ color: 0xffffff, alpha: 0.1, width: 1 });
    this._speedBg.rect(sbx, sby, sbw, sbh).fill({ color: 0x1a2233 });

    this._speedBar.clear();
    this._speedBar.rect(sbx, sby, Math.max(1, sbw * speedFrac), sbh)
      .fill({ color: atDrift ? 0x35f2d0 : 0x999999 });
    // Drift threshold marker
    this._speedBar.rect(sbx + sbw * driftFrac - 1, sby - 1, 2, sbh + 2)
      .fill({ color: 0xaaaaaa });

    this._speedLabel.position.set(sbx - S(6), sby + sbh / 2);
  }

  destroy(): void {
    this._layer.removeChildren();
  }
}
