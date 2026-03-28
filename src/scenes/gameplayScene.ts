// gameplayScene.ts — Main gameplay scene shell.
// Hosts player, trail, and enemy state, updates, and renderers.

import { Sprite, Assets } from 'pixi.js';
import type { Scene, GameContext } from './sceneManager';
import { CFG } from '@core/config';
import { makePlayerState, getPlayerSpeed, type PlayerState } from '@gameplay/player/playerState';
import { updatePlayer } from '@gameplay/player/playerUpdate';
import { PlayerRenderer } from '@gameplay/player/playerRenderer';
import { makeTrailState, type TrailState } from '@gameplay/trail/trailState';
import { updateTrail } from '@gameplay/trail/trailUpdate';
import { TrailRenderer } from '@gameplay/trail/trailRenderer';
import { makeEnemyState, type EnemyState } from '@gameplay/enemies/enemyState';
import { updateEnemy } from '@gameplay/enemies/enemyUpdate';
import { EnemyRenderer } from '@gameplay/enemies/enemyRenderer';
import { getDeathParticles, type EnemyDeathEvent } from '@gameplay/enemies/enemyDeathFx';
import { eventBus } from '@core/eventBus';

export class GameplayScene implements Scene {
  private _playerState: PlayerState | null = null;
  private _playerRenderer: PlayerRenderer | null = null;
  private _trailState: TrailState | null = null;
  private _trailRenderer: TrailRenderer | null = null;
  private _enemies: EnemyState[] = [];
  private _enemyRenderer: EnemyRenderer | null = null;
  private _gameClock = 0;

  enter(context: GameContext): void {
    const { worldContainer, backgroundLayer, playerLayer, trailLayer, enemiesLayer } =
      context.pixiApp;

    context.camera.attachContainer(worldContainer);

    this._playerState = makePlayerState();
    this._playerRenderer = new PlayerRenderer({ playerLayer });
    this._trailState = makeTrailState();
    this._trailRenderer = new TrailRenderer({ trailLayer });

    // Spawn 2 test enemies near the player
    this._enemies = [];
    this._enemies.push(makeEnemyState('chaser', 1700, 1500, 0));
    this._enemies.push(makeEnemyState('interceptor', 1500, 1700, 0));
    this._enemyRenderer = new EnemyRenderer({ enemiesLayer });
    this._enemyRenderer.sync(this._enemies);

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
    if (
      !this._playerState ||
      !this._playerRenderer ||
      !this._trailState ||
      !this._trailRenderer
    )
      return;

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

    // Update enemies — swap-and-pop despawn
    let enemiesChanged = false;
    for (let i = this._enemies.length - 1; i >= 0; i--) {
      const result = updateEnemy(
        this._enemies[i],
        this._playerState,
        dt,
        this._gameClock,
      );
      if (result.despawned) {
        this._enemies[i] = this._enemies[this._enemies.length - 1];
        this._enemies.pop();
        enemiesChanged = true;
      }
    }

    const loopResult = updateTrail(this._trailState, this._playerState, this._enemies, dt);
    if (loopResult !== null) {
      eventBus.emit('encirclement', {
        count: loopResult.encircleCount,
        x: loopResult.polygon[0].x,
        y: loopResult.polygon[0].y,
      });

      // Handle killed enemies
      for (const dead of loopResult.killedEnemies) {
        const deathEvent: EnemyDeathEvent = {
          type: (dead as EnemyState).type,
          x: dead.x,
          y: dead.y,
          isElite: false,
        };
        getDeathParticles(deathEvent); // stub — particles wired in step 12
        eventBus.emit('enemyKilled', {
          x: dead.x,
          y: dead.y,
          type: (dead as EnemyState).type,
        });
        enemiesChanged = true;
      }

      // Remove dead enemies from array (swap-and-pop)
      for (let i = this._enemies.length - 1; i >= 0; i--) {
        if (!this._enemies[i].alive) {
          this._enemies[i] = this._enemies[this._enemies.length - 1];
          this._enemies.pop();
        }
      }
    }

    if (enemiesChanged) this._enemyRenderer?.sync(this._enemies);
    this._enemyRenderer?.update(this._enemies);

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
    this._enemyRenderer?.destroy();
    this._playerRenderer = null;
    this._playerState = null;
    this._trailRenderer = null;
    this._trailState = null;
    this._enemyRenderer = null;
    this._enemies = [];

    const { backgroundLayer, playerLayer, trailLayer, enemiesLayer } = context.pixiApp;
    backgroundLayer.removeChildren();
    playerLayer.removeChildren();
    trailLayer.removeChildren();
    enemiesLayer.removeChildren();
  }
}
