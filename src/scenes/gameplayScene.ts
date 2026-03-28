// gameplayScene.ts — Main gameplay scene shell.
// Hosts player state, update, and renderer. No enemies yet.

import { Sprite, Assets } from 'pixi.js';
import type { Scene, GameContext } from './sceneManager';
import { CFG } from '@core/config';
import { makePlayerState, getPlayerSpeed, type PlayerState } from '@gameplay/player/playerState';
import { updatePlayer } from '@gameplay/player/playerUpdate';
import { PlayerRenderer } from '@gameplay/player/playerRenderer';

export class GameplayScene implements Scene {
  private _playerState: PlayerState | null = null;
  private _playerRenderer: PlayerRenderer | null = null;
  private _gameClock = 0;

  enter(context: GameContext): void {
    const { worldContainer, backgroundLayer, playerLayer } = context.pixiApp;

    context.camera.attachContainer(worldContainer);

    this._playerState = makePlayerState();
    this._playerRenderer = new PlayerRenderer({ playerLayer });
    context.camera.reset(this._playerState.x, this._playerState.y);
    this._gameClock = 0;

    const bgTexture = Assets.get('background_01');
    if (bgTexture) {
      const bg = new Sprite(bgTexture);
      bg.width = CFG.WORLD_W;
      bg.height = CFG.WORLD_H;
      backgroundLayer.addChild(bg);
    }
  }

  update(dt: number, context: GameContext): void {
    if (!this._playerState || !this._playerRenderer) return;

    this._gameClock += dt;

    const input = context.getInput();
    updatePlayer(this._playerState, {
      dt,
      gameClock: this._gameClock,
      up: input.up,
      down: input.down,
      left: input.left,
      right: input.right,
      drift: input.drift,
    });

    this._playerRenderer.update(this._playerState);

    context.camera.update(
      dt,
      this._playerState.x,
      this._playerState.y,
      this._playerState.vx,
      this._playerState.vy,
      getPlayerSpeed(this._playerState),
    );
  }

  exit(context: GameContext): void {
    this._playerRenderer?.destroy();
    this._playerRenderer = null;
    this._playerState = null;

    const { backgroundLayer, playerLayer } = context.pixiApp;
    backgroundLayer.removeChildren();
    playerLayer.removeChildren();
  }
}
