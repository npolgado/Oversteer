// gameplayScene.ts — Thin Pixi scene adapter. Creates and delegates to GameLoop.
// All game state and per-frame logic lives in GameLoop.

import type { Scene, GameContext } from './sceneManager';
import { GameLoop } from './gameLoop';

export interface GameplayOptions {
  mapId?: string;
  modifierIds?: string[];
  sandbox?: boolean;
  benchmark?: string; // scenario name e.g. 'idle_5', 'drift_15'
}

export class GameplayScene implements Scene {
  private _loop: GameLoop | null = null;

  constructor(private _opts: GameplayOptions = {}) {}

  enter(context: GameContext): void {
    this._loop = new GameLoop(this._opts, context);
  }

  update(dt: number, _context: GameContext): void {
    this._loop!.update(dt);
  }

  exit(context: GameContext): void {
    this._loop!.destroy();
    this._loop = null;
  }
}
