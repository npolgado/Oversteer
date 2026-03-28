// bootScene.ts — Asset loading scene with progress bar.
// Uses PixiJS v8 Assets API to GPU-upload all sprites.
// Transitions to PlaygroundScene when done.
import { Assets, Graphics, Text, TextStyle } from 'pixi.js';
import type { Scene, GameContext } from './sceneManager';
import { CFG } from '@core/config';

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
  { alias: 'background_01', src: 'backgrounds/background_01.png' },
  { alias: 'background_02', src: 'backgrounds/background_02.png' },
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
    const { overlayLayer } = context.pixiApp;

    // Progress bar background
    const bg = new Graphics();
    bg.rect(CFG.W / 2 - 200, CFG.H / 2 - 10, 400, 20).fill({ color: 0x1a2233 });
    overlayLayer.addChild(bg);

    // Progress bar fill
    this._bar = new Graphics();
    overlayLayer.addChild(this._bar);

    // Label
    const style = new TextStyle({ fill: '#EAEFF7', fontSize: 14, fontFamily: 'Courier New, monospace' });
    this._label = new Text({ text: 'Loading...', style });
    this._label.anchor.set(0.5);
    this._label.position.set(CFG.W / 2, CFG.H / 2 + 30);
    overlayLayer.addChild(this._label);

    this._loadAssets();
  }

  private _drawBar(progress: number): void {
    if (!this._bar) return;
    this._bar.clear();
    this._bar.rect(CFG.W / 2 - 200, CFG.H / 2 - 10, 400 * progress, 20).fill({ color: 0x35f2d0 });
  }

  private async _loadAssets(): Promise<void> {
    Assets.addBundle('game', ASSETS_TO_LOAD);

    await Assets.loadBundle('game', (progress: number) => {
      this._drawBar(progress);
      if (this._label) this._label.text = `Loading... ${Math.round(progress * 100)}%`;
    });

    this._done = true;
    if (this._label) this._label.text = 'Ready!';
    this._drawBar(1);
  }

  update(_dt: number, context: GameContext): void {
    if (this._done && this._onReady) {
      const cb = this._onReady;
      this._onReady = null;
      this.exit(context);
      cb();
    }
  }

  exit(context: GameContext): void {
    const { overlayLayer } = context.pixiApp;
    overlayLayer.removeChildren();
    this._bar = null;
    this._label = null;
  }
}
