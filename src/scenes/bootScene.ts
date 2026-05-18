// bootScene.ts — Asset loading scene with progress bar.
// Uses PixiJS v8 Assets API to GPU-upload all sprites.
// Transitions to MenuScene when done.
import { Assets, Graphics, Text, TextStyle } from 'pixi.js';
import type { Scene, GameContext } from './sceneManager';
import { CFG } from '@core/config';
import { makeUIStyle } from '@ui/textStyles';
import { log, logError } from '@debug/logger';

const ASSETS_TO_LOAD = [
  { alias: 'player', src: CFG.PLAYER_SPRITE },
  // Enemy sprites
  { alias: 'enemy_red',    src: 'cars/enemy_red.png' },
  { alias: 'enemy_orange', src: 'cars/enemy_orange.png' },
  { alias: 'police',       src: 'cars/police.png' },
  { alias: 'ambulance',    src: 'cars/ambulance.png' },
  { alias: 'taxi',         src: 'cars/taxi.png' },
  { alias: 'mini_van',     src: 'cars/mini_van.png' },
  { alias: 'mini_truck',   src: 'cars/mini_truck.png' },
  { alias: 'truck',        src: 'cars/truck.png' },
  // Props
  { alias: 'tree_1',  src: 'props/tree_1.png' },
  { alias: 'rock_1',  src: 'props/rock_1.png' },
  { alias: 'mud_1',   src: 'props/mud_1.png' },
  { alias: 'bush_1',  src: 'props/bush_1.png' },
  // Backgrounds
  { alias: 'backgrounds/background_01.png', src: 'backgrounds/background_01.png' },
  { alias: 'backgrounds/background_02.png', src: 'backgrounds/background_02.png' },
];

export class BootScene implements Scene {
  private _bar: Graphics | null = null;
  private _label: Text | null = null;
  private _onReady: (() => void) | null = null;
  private _done = false;

  constructor(onReady: () => void) {
    this._onReady = onReady;
  }

  enter(context: GameContext): void {
    log('boot', 'BootScene.enter()');
    this._sanityDump();
    const { overlayLayer } = context.pixiApp;

    // Progress bar background
    const bg = new Graphics();
    bg.rect(CFG.W / 2 - 200, CFG.H / 2 - 10, 400, 20).fill({ color: 0x1a2233 });
    overlayLayer.addChild(bg);

    // Progress bar fill
    this._bar = new Graphics();
    overlayLayer.addChild(this._bar);

    // Label
    this._label = new Text({ text: 'Loading...', style: makeUIStyle({ size: 14, color: '#EAEFF7' }) });
    this._label.anchor.set(0.5);
    this._label.position.set(CFG.W / 2, CFG.H / 2 + 30);
    overlayLayer.addChild(this._label);

    this._loadAssets();
  }

  private _sanityDump(): void {
    try {
      const LS_KEYS = ['oversteer_highscore_v1', 'oversteer_audio_v2', 'oversteer_perf_v1'];
      const lsSummary = LS_KEYS.map(k => `${k.replace('oversteer_', '')}=${localStorage.getItem(k) ?? 'null'}`).join('  ');
      log('boot', `localStorage: ${lsSummary}`);
    } catch (_) {}

    try {
      const cfgSpot: Array<[string, number]> = [
        ['MAX_SPEED', CFG.MAX_SPEED], ['WORLD_W', CFG.WORLD_W], ['WORLD_H', CFG.WORLD_H],
        ['ACCEL', CFG.ACCEL], ['W', CFG.W], ['H', CFG.H],
      ];
      const bad = cfgSpot.filter(([, v]) => !Number.isFinite(v)).map(([k]) => k);
      log('boot', `CFG: ${cfgSpot.map(([k, v]) => `${k}=${v}`).join(' ')}`);
      if (bad.length > 0) logError('boot', `CFG NON-FINITE VALUES: ${bad.join(', ')}`);
    } catch (_) {}
  }

  private _drawBar(progress: number): void {
    if (!this._bar) return;
    this._bar.clear();
    this._bar.rect(CFG.W / 2 - 200, CFG.H / 2 - 10, 400 * progress, 20).fill({ color: 0x35f2d0 });
  }

  private async _loadAssets(): Promise<void> {
    log('boot', `Assets.loadBundle start — ${ASSETS_TO_LOAD.length} assets`);

    // Load assets individually so we can report WHICH ones fail rather than just
    // "bundle failed". This serializes loads but gives us precise failure attribution.
    const failed: Array<{ alias: string; src: string }> = [];
    for (let i = 0; i < ASSETS_TO_LOAD.length; i++) {
      const a = ASSETS_TO_LOAD[i];
      try {
        await Assets.load({ alias: a.alias, src: a.src });
      } catch (err) {
        logError('boot', `asset failed: ${a.alias} (${a.src})`, err);
        failed.push(a);
      }
      this._drawBar((i + 1) / ASSETS_TO_LOAD.length);
      if (this._label) this._label.text = `Loading... ${Math.round(((i + 1) / ASSETS_TO_LOAD.length) * 100)}%`;
    }

    if (failed.length > 0) {
      logError('boot', `${failed.length} asset(s) failed to load — boot cannot continue`);
      this._showAssetError(failed);
      return; // _done stays false; onReady never fires
    }

    // Log loaded aliases so users can verify what's available downstream.
    // Truncate long lists — we only need to know what loaded, not in what order.
    const loaded = ASSETS_TO_LOAD.map(a => a.alias);
    const summary = loaded.length <= 8
      ? loaded.join(',')
      : `${loaded.slice(0, 8).join(',')}…+${loaded.length - 8}`;
    log('boot', `Assets.loadBundle complete — ${loaded.length} loaded: ${summary}`);
    this._done = true;
    if (this._label) this._label.text = 'Ready!';
    this._drawBar(1);
  }

  private _showAssetError(failed: Array<{ alias: string; src: string }>): void {
    if (!this._label) return;
    const ol = this._label.parent; // overlayLayer
    if (!ol) return;
    this._label.text = 'ASSET LOAD FAILED — see console';
    this._label.style = new TextStyle({ fill: '#ff4040', fontSize: 24, fontFamily: 'monospace', fontWeight: 'bold' });

    const detail = new Text({
      text: failed.slice(0, 3).map(a => a.alias).join(', ') + (failed.length > 3 ? ` + ${failed.length - 3} more` : ''),
      style: new TextStyle({ fill: '#ff8080', fontSize: 14, fontFamily: 'monospace' }),
    });
    detail.anchor.set(0.5);
    detail.position.set(CFG.W / 2, CFG.H / 2 + 60);
    ol.addChild(detail);
  }

  update(_dt: number, _context: GameContext): void {
    if (this._done && this._onReady) {
      log('boot', 'BootScene onReady fired — calling transition callback');
      const cb = this._onReady;
      this._onReady = null;
      cb(); // sceneManager.switchTo in cb handles exit via fade
    }
  }

  exit(context: GameContext): void {
    const { overlayLayer } = context.pixiApp;
    overlayLayer.removeChildren();
    this._bar = null;
    this._label = null;
  }
}
