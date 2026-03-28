// gameplayScene.ts — Main gameplay scene: player, trail, and props.

import { Sprite, Assets } from 'pixi.js';
import type { Scene, GameContext } from './sceneManager';
import { CFG } from '@core/config';
import { makePlayerState, getPlayerSpeed, type PlayerState } from '@gameplay/player/playerState';
import { updatePlayer } from '@gameplay/player/playerUpdate';
import { PlayerRenderer } from '@gameplay/player/playerRenderer';
import { makeTrailState, type TrailState } from '@gameplay/trail/trailState';
import { updateTrail } from '@gameplay/trail/trailUpdate';
import { TrailRenderer } from '@gameplay/trail/trailRenderer';
import {
  makePropsState,
  generateProps,
  checkPlayerCollision as checkPlayerPropCollision,
  handlePropCollisions,
  updatePropCooldowns,
  checkNearMissProp,
  type PropsState,
} from '@gameplay/world/propsSystem';
import { PropsRenderer } from '@gameplay/world/propsRenderer';
import { eventBus } from '@core/eventBus';

export class GameplayScene implements Scene {
  private _playerState: PlayerState | null = null;
  private _playerRenderer: PlayerRenderer | null = null;
  private _trailState: TrailState | null = null;
  private _trailRenderer: TrailRenderer | null = null;
  private _propsState: PropsState | null = null;
  private _propsRenderer: PropsRenderer | null = null;
  private _gameClock = 0;

  enter(context: GameContext): void {
    const { worldContainer, backgroundLayer, playerLayer, trailLayer, propsLayer } = context.pixiApp;

    context.camera.attachContainer(worldContainer);

    this._playerState = makePlayerState();
    this._playerRenderer = new PlayerRenderer({ playerLayer });
    this._trailState = makeTrailState();
    this._trailRenderer = new TrailRenderer({ trailLayer });
    this._propsState = makePropsState();
    generateProps(this._propsState);
    this._propsRenderer = new PropsRenderer({ propsLayer });
    this._propsRenderer.setProps(this._propsState.allProps);
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
    if (!this._playerState || !this._playerRenderer || !this._trailState || !this._trailRenderer || !this._propsState) return;

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

    const propHits = checkPlayerPropCollision(this._propsState, this._playerState);
    const propEvents = handlePropCollisions(propHits, this._playerState);
    for (const ev of propEvents) {
      if (ev.type === 'solid_bounce') {
        eventBus.emit('spawnParticles', { x: ev.x, y: ev.y, type: 'shard', count: 2 });
      }
    }
    updatePropCooldowns(this._propsState, dt);
    // Near-miss prop: result will be used by scoring system in a later step
    checkNearMissProp(this._propsState, this._playerState);

    const loopResult = updateTrail(this._trailState, this._playerState, [], dt);
    if (loopResult !== null) {
      eventBus.emit('encirclement', {
        count: loopResult.encircleCount,
        x: loopResult.polygon[0].x,
        y: loopResult.polygon[0].y,
      });
    }

    this._trailRenderer.update(this._trailState);
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
    this._trailRenderer?.destroy();
    this._propsRenderer?.destroy();
    this._playerRenderer = null;
    this._playerState = null;
    this._trailRenderer = null;
    this._trailState = null;
    this._propsRenderer = null;
    this._propsState = null;

    const { backgroundLayer, playerLayer, trailLayer, propsLayer } = context.pixiApp;
    backgroundLayer.removeChildren();
    playerLayer.removeChildren();
    trailLayer.removeChildren();
    propsLayer.removeChildren();
  }
}
