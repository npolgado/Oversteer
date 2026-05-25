// hudManager.ts — PixiJS HUD: score, HP bar, wave timer, enemy count, drift combo, speed.
// Matches layout of arena-drifter/game.js renderHUD().

import { Graphics, Text, Container } from 'pixi.js';
import { CFG, S } from '@core/config';
import type { WavePhase } from '@gameplay/spawning/waveManager';
import { uiTween, killUITweens } from '@render/tween';
import { makeUIStyle } from '@ui/textStyles';

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
  enemies: Array<{ x: number; y: number; alive: boolean }>;
  cameraX: number;
  cameraY: number;
}

export class HudManager {
  private _layer: Container;

  // Score panel
  private _scoreBg: Graphics;
  private _scoreLabel: Text;
  private _scoreValue: Text;
  private _newBestText: Text;
  private _newBestShown = false;

  // HP bar
  private _hpBg: Graphics;
  private _hpBar: Graphics;
  private _hpLabel: Text;
  private _hpText: Text;

  // Wave timer (top-center)
  private _waveBg: Graphics;
  private _waveBar: Graphics;
  private _waveLabel: Text;
  private _waveTimerVisible = false;

  // Enemy count (top-right)
  private _enemyText: Text;

  // Drift combo bar (bottom-left)
  private _comboBg: Graphics;
  private _comboBar: Graphics;
  private _comboLabel: Text;
  private _comboVisible = false;

  // Speed indicator (bottom-right)
  private _speedBg: Graphics;
  private _speedBar: Graphics;
  private _speedLabel: Text;
  private _controlsHint: Text;

  // Wave announce banner (game.js:1325-1338)
  private _waveBanner: Graphics;
  private _waveBannerText: Text;

  // Combo milestone banner — NOTE: not in original (canvas used EventLog only).
  private _milestoneBanner: Graphics;
  private _milestoneBannerText: Text;

  // Off-screen enemy indicators (game.js:1528-1562)
  private _offLeft: Graphics;
  private _offRight: Graphics;
  private _offTop: Graphics;
  private _offBottom: Graphics;

  constructor(layer: Container) {
    this._layer = layer;

    // --- Score panel ---
    this._scoreBg = new Graphics();
    this._scoreLabel = new Text({ text: 'SCORE', style: makeUIStyle({ size: S(12), color: '#BBBBBB', bold: true }) });
    this._scoreLabel.position.set(S(20), S(14));
    this._scoreValue = new Text({ text: '0', style: makeUIStyle({ size: S(22), color: '#EAEFF7', bold: true }) });
    this._scoreValue.position.set(S(20), S(30));
    this._newBestText = new Text({ text: 'NEW BEST!', style: makeUIStyle({ size: S(10), color: '#FFB000', bold: true }) });
    this._newBestText.position.set(S(20), S(54));
    this._newBestText.alpha = 0;

    // --- HP bar ---
    this._hpBg = new Graphics();
    this._hpBar = new Graphics();
    this._hpLabel = new Text({ text: 'HP', style: makeUIStyle({ size: S(10), color: '#BBBBBB' }) });
    this._hpText = new Text({ text: '100/100', style: makeUIStyle({ size: S(12), color: '#EAEFF7' }) });

    // --- Wave timer ---
    this._waveBg = new Graphics();
    this._waveBar = new Graphics();
    this._waveLabel = new Text({ text: 'WAVE 1', style: makeUIStyle({ size: S(14), color: '#AAAAAA' }) });
    this._waveLabel.anchor.set(0.5, 0);
    this._waveBg.alpha = 0;
    this._waveBar.alpha = 0;
    this._waveLabel.alpha = 0;

    // --- Enemy count ---
    this._enemyText = new Text({ text: 'ENEMIES: 0', style: makeUIStyle({ size: S(14), color: '#AAAAAA' }) });
    this._enemyText.anchor.set(1, 0);
    this._enemyText.position.set(CFG.W - S(20), S(14));
    this._enemyText.alpha = 0;

    // --- Drift combo ---
    this._comboBg = new Graphics();
    this._comboBar = new Graphics();
    this._comboLabel = new Text({ text: 'DRIFT x0', style: makeUIStyle({ size: S(13), color: '#35F2D0', bold: true }) });
    this._comboBg.alpha = 0;
    this._comboBar.alpha = 0;
    this._comboLabel.alpha = 0;

    // --- Speed indicator ---
    this._speedBg = new Graphics();
    this._speedBar = new Graphics();
    this._speedLabel = new Text({ text: 'SPD', style: makeUIStyle({ size: S(12), color: '#ffffff' }) });
    this._speedLabel.anchor.set(0.5, 0.5);
    this._controlsHint = new Text({ text: 'WASD + SPACE', style: makeUIStyle({ size: S(10), color: '#888888' }) });
    this._controlsHint.anchor.set(1, 0);
    this._controlsHint.position.set(CFG.W - S(20), CFG.H - S(20));

    // --- Wave announce banner ---
    this._waveBanner = new Graphics();
    this._waveBannerText = new Text({ text: 'WAVE 1', style: makeUIStyle({ size: S(26), color: '#35F2D0', bold: true }) });
    this._waveBannerText.anchor.set(0.5, 0.5);
    this._waveBanner.alpha = 0;
    this._waveBannerText.alpha = 0;

    // --- Combo milestone banner (attached at construction with alpha=0 — safe Pixi v8 alpha tween pattern) ---
    this._milestoneBanner = new Graphics();
    this._milestoneBannerText = new Text({ text: '', style: makeUIStyle({ size: S(32), color: '#35F2D0', bold: true }) });
    this._milestoneBannerText.anchor.set(0.5, 0.5);
    this._milestoneBanner.alpha = 0;
    this._milestoneBannerText.alpha = 0;

    // --- Off-screen enemy indicators ---
    this._offLeft = new Graphics();
    this._offRight = new Graphics();
    this._offTop = new Graphics();
    this._offBottom = new Graphics();

    // Add all to layer
    layer.addChild(
      this._scoreBg, this._scoreLabel, this._scoreValue, this._newBestText,
      this._hpBg, this._hpBar, this._hpLabel, this._hpText,
      this._waveBg, this._waveBar, this._waveLabel,
      this._enemyText,
      this._comboBg, this._comboBar, this._comboLabel,
      this._speedBg, this._speedBar, this._speedLabel, this._controlsHint,
      this._offLeft, this._offRight, this._offTop, this._offBottom,
      this._waveBanner, this._waveBannerText,
      this._milestoneBanner, this._milestoneBannerText,
    );
  }

  /** Trigger the wave banner animation (replaces the per-frame waveAnnounceTimer math). */
  showWaveBanner(num: number): void {
    killUITweens(this._waveBanner);
    killUITweens(this._waveBannerText);

    this._waveBannerText.text = `WAVE ${num}`;
    this._waveBanner.alpha = 0;
    this._waveBannerText.alpha = 0;
    this._waveBannerText.x = CFG.W / 2;
    this._waveBannerText.y = CFG.H / 2;

    this._waveBanner.clear();
    this._waveBanner.roundRect(CFG.W / 2 - S(100), CFG.H / 2 - S(18), S(200), S(36), S(6))
      .fill({ color: 0x000000, alpha: 0.5 });
    const tl = [
      uiTween(this._waveBannerText, { alpha: 1, duration: 0.3, ease: 'power2.out' }),
      uiTween(this._waveBanner,     { alpha: 1, duration: 0.3, ease: 'power2.out' }),
    ];
    Promise.all(tl).then(() => {
      uiTween(this._waveBannerText, { alpha: 0, duration: 0.3, delay: 1.4, ease: 'power2.in' });
      uiTween(this._waveBanner,     { alpha: 0, duration: 0.3, delay: 1.4, ease: 'power2.in' });
    });
  }

  /** Slide in a combo milestone banner (x3/x5/x8 COMBO!) then fade out. */
  showMilestoneBanner(label: string, color: string): void {
    killUITweens(this._milestoneBanner);
    killUITweens(this._milestoneBannerText);

    this._milestoneBannerText.style.fill = color;
    this._milestoneBannerText.text = label;
    // Reset to fully transparent at the position where it will animate.
    this._milestoneBannerText.alpha = 0;
    this._milestoneBanner.alpha = 0;
    // Place slightly below wave banner so they don't overlap when both fire.
    this._milestoneBannerText.x = CFG.W / 2;
    this._milestoneBannerText.y = CFG.H * 0.6;

    this._milestoneBanner.clear();
    const bh = S(44);
    const bw = Math.max(S(200), this._milestoneBannerText.width + S(32));
    this._milestoneBanner.roundRect(CFG.W / 2 - bw / 2, CFG.H * 0.6 - bh / 2, bw, bh, S(6))
      .fill({ color: 0x000000, alpha: 0.5 });

    const tl = [
      uiTween(this._milestoneBannerText, { alpha: 1, duration: 0.25, ease: 'power2.out' }),
      uiTween(this._milestoneBanner,     { alpha: 1, duration: 0.25, ease: 'power2.out' }),
    ];
    Promise.all(tl).then(() => {
      uiTween(this._milestoneBannerText, { alpha: 0, duration: 0.3, delay: 1.0, ease: 'power2.in' });
      uiTween(this._milestoneBanner,     { alpha: 0, duration: 0.3, delay: 1.0, ease: 'power2.in' });
    });
  }

  update(data: HudData): void {
    const scoreH = data.newBest ? S(56) : S(42);
    const hpY = scoreH + S(12);

    // --- Score panel ---
    this._scoreBg.clear();
    this._scoreBg.roundRect(S(12), S(8), S(110), scoreH, S(4)).fill({ color: 0x000000, alpha: 0.45 });

    this._scoreValue.text = Math.floor(data.score).toLocaleString();
    this._scoreValue.style.fill = data.newBest ? '#FFB000' : '#EAEFF7';

    // NEW BEST: animate in once when it first becomes true
    if (data.newBest && !this._newBestShown) {
      this._newBestShown = true;
      this._newBestText.scale.set(0.5);
      uiTween(this._newBestText, { alpha: 1, duration: 0.25, ease: 'back.out(2)' });
      uiTween(this._newBestText.scale, { x: 1, y: 1, duration: 0.25, ease: 'back.out(2)' });
    } else if (!data.newBest && this._newBestShown) {
      this._newBestShown = false;
      this._newBestText.alpha = 0;
    }

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

    if (inCombat !== this._waveTimerVisible) {
      this._waveTimerVisible = inCombat;
      const targetAlpha = inCombat ? 1 : 0;
      uiTween(this._waveBg,    { alpha: targetAlpha, duration: 0.2 });
      uiTween(this._waveBar,   { alpha: targetAlpha, duration: 0.2 });
      uiTween(this._waveLabel, { alpha: targetAlpha, duration: 0.2 });
      uiTween(this._enemyText, { alpha: targetAlpha, duration: 0.2 });
    }

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
    if (showCombo !== this._comboVisible) {
      this._comboVisible = showCombo;
      const targetAlpha = showCombo ? 1 : 0;
      uiTween(this._comboBg,    { alpha: targetAlpha, duration: 0.15 });
      uiTween(this._comboBar,   { alpha: targetAlpha, duration: 0.15 });
      uiTween(this._comboLabel, { alpha: targetAlpha, duration: 0.15 });
    }

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
    const sbw = S(80);
    const sbh = S(10);
    const sbx = CFG.W - S(24) - sbw;
    const sby = CFG.H - S(38);
    const speedFrac = data.maxSpeed > 0 ? Math.min(1, data.speed / data.maxSpeed) : 0;
    const atDrift = data.speed >= CFG.DRIFT_THRESHOLD;
    const driftFrac = data.maxSpeed > 0 ? Math.min(1, CFG.DRIFT_THRESHOLD / data.maxSpeed) : 0;

    this._speedBg.clear();
    this._speedBg.roundRect(sbx - S(4), sby - S(4), sbw + S(8), sbh + S(8), S(4))
      .fill({ color: 0x1a2233 })
      .stroke({ color: 0x35f2d0, alpha: 0.3, width: 1 });
    this._speedBg.rect(sbx, sby, sbw, sbh).fill({ color: 0x0d1020 });

    this._speedBar.clear();
    this._speedBar.rect(sbx, sby, Math.max(1, sbw * speedFrac), sbh)
      .fill({ color: atDrift ? 0x35f2d0 : 0x446688 });
    // Drift threshold tick — accent color for easy reference
    this._speedBar.rect(sbx + sbw * driftFrac - 1, sby - 2, 2, sbh + 4)
      .fill({ color: 0x35f2d0 });

    // 'SPD' label centered inside the bar
    this._speedLabel.position.set(sbx + sbw / 2, sby + sbh / 2);

    // --- Off-screen enemy indicators (game.js:1528-1562) ---
    const sides = { left: false, right: false, top: false, bottom: false };
    for (const e of data.enemies) {
      if (!e.alive) continue;
      const sx = e.x - data.cameraX + CFG.W / 2;
      const sy = e.y - data.cameraY + CFG.H / 2;
      if (sx < 0) sides.left = true;
      if (sx > CFG.W) sides.right = true;
      if (sy < 0) sides.top = true;
      if (sy > CFG.H) sides.bottom = true;
    }
    const flash = 0.55 + 0.15 * Math.sin(performance.now() * 0.008);
    const offBarW = S(32);
    const borderW = offBarW + S(4);

    this._offLeft.clear();
    this._offRight.clear();
    this._offTop.clear();
    this._offBottom.clear();

    if (sides.left) {
      this._offLeft.rect(0, 0, borderW, CFG.H).fill({ color: 0x000000, alpha: flash * 0.6 });
      this._offLeft.rect(0, 0, offBarW, CFG.H).fill({ color: 0xFF3B6B, alpha: flash });
    }
    if (sides.right) {
      this._offRight.rect(CFG.W - borderW, 0, borderW, CFG.H).fill({ color: 0x000000, alpha: flash * 0.6 });
      this._offRight.rect(CFG.W - offBarW, 0, offBarW, CFG.H).fill({ color: 0xFF3B6B, alpha: flash });
    }
    if (sides.top) {
      this._offTop.rect(0, 0, CFG.W, borderW).fill({ color: 0x000000, alpha: flash * 0.6 });
      this._offTop.rect(0, 0, CFG.W, offBarW).fill({ color: 0xFF3B6B, alpha: flash });
    }
    if (sides.bottom) {
      this._offBottom.rect(0, CFG.H - borderW, CFG.W, borderW).fill({ color: 0x000000, alpha: flash * 0.6 });
      this._offBottom.rect(0, CFG.H - offBarW, CFG.W, offBarW).fill({ color: 0xFF3B6B, alpha: flash });
    }
  }

  destroy(): void {
    this._layer.removeChildren();
  }
}
