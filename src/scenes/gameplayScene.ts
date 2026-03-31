// gameplayScene.ts — Main gameplay scene: player, trail, props, and enemies.
// Hosts player, trail, prop state, enemy state, updates, and renderers.

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
import { makeEnemyState, type EnemyState } from '@gameplay/enemies/enemyState';
import { updateEnemy } from '@gameplay/enemies/enemyUpdate';
import { EnemyRenderer } from '@gameplay/enemies/enemyRenderer';
import { getDeathParticles, type EnemyDeathEvent } from '@gameplay/enemies/enemyDeathFx';
import { checkPlayerEnemyCollision, checkNearMiss } from '@gameplay/combat/collision';
import { processPlayerHit } from '@gameplay/combat/damage';
import { processNearMiss } from '@gameplay/combat/nearMiss';
import {
  updateNearMissStreak,
  applyHpRegen,
  updateScraps,
  type ScrapPickup,
} from '@gameplay/pureLogic';
import { getPlayerRadius } from '@gameplay/player/playerState';
import {
  makeWaveState,
  startWave,
  updateWave,
  tickScrapSpawn,
  type WaveState,
} from '@gameplay/spawning/waveManager';
import { getTrailPoint } from '@gameplay/trail/trailState';
import { clamp } from '@core/utils';
import { eventBus } from '@core/eventBus';

export class GameplayScene implements Scene {
  private _playerState: PlayerState | null = null;
  private _playerRenderer: PlayerRenderer | null = null;
  private _trailState: TrailState | null = null;
  private _trailRenderer: TrailRenderer | null = null;
  private _propsState: PropsState | null = null;
  private _propsRenderer: PropsRenderer | null = null;
  private _enemies: EnemyState[] = [];
  private _enemyRenderer: EnemyRenderer | null = null;
  private _gameClock = 0;
  private _score = 0;
  private _waveState: WaveState | null = null;

  enter(context: GameContext): void {
    const {
      worldContainer,
      backgroundLayer,
      playerLayer,
      trailLayer,
      propsLayer,
      enemiesLayer,
    } = context.pixiApp;

    context.camera.attachContainer(worldContainer);

    this._playerState = makePlayerState();
    this._playerRenderer = new PlayerRenderer({ playerLayer });
    this._trailState = makeTrailState();
    this._trailRenderer = new TrailRenderer({ trailLayer });
    this._propsState = makePropsState();
    generateProps(this._propsState);
    this._propsRenderer = new PropsRenderer({ propsLayer });
    this._propsRenderer.setProps(this._propsState.allProps);

    this._enemies = [];
    this._enemyRenderer = new EnemyRenderer({ enemiesLayer });
    this._enemyRenderer.sync(this._enemies);
    this._waveState = makeWaveState();
    startWave(this._waveState);
    eventBus.emit('waveStarted', { wave: this._waveState.waveIndex });

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
      !this._trailRenderer ||
      !this._propsState ||
      !this._waveState
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

    let enemiesChanged = false;

    // --- Wave manager ---
    const waveEvents = updateWave(this._waveState, dt, this._score, this._enemies.length);
    for (const ev of waveEvents) {
      if (ev.type === 'spawn') {
        for (const req of ev.requests) {
          const angle = req.angle;
          const rawX = this._playerState.x + Math.cos(angle) * req.distance;
          const rawY = this._playerState.y + Math.sin(angle) * req.distance;
          const x = clamp(rawX, 10, CFG.WORLD_W - 10);
          const y = clamp(rawY, 10, CFG.WORLD_H - 10);
          this._enemies.push(makeEnemyState(req.type, x, y, this._waveState.speedBonus));
          enemiesChanged = true;
        }
      } else if (ev.type === 'wave_end') {
        // Clear enemies (scraps persist into break)
        for (const e of this._enemies) e.alive = false;
        this._enemies.length = 0;
        enemiesChanged = true;
        eventBus.emit('waveEnded', { wave: this._waveState.waveIndex });
      } else if (ev.type === 'break_end') {
        startWave(this._waveState);
        eventBus.emit('waveStarted', { wave: this._waveState.waveIndex });
      }
    }
    if (enemiesChanged) this._enemyRenderer?.sync(this._enemies);

    // --- Scrap spawning ---
    const scrapPos = tickScrapSpawn(
      this._waveState,
      dt,
      this._playerState.x,
      this._playerState.y,
    );
    if (scrapPos) {
      this._waveState.scraps.push({ x: scrapPos.x, y: scrapPos.y, life: 15, type: 'scrap' });
    }

    // --- Scrap collection (near-miss scrap spawning deferred to Step 7 TODO) ---
    const trailPointsForScraps = Array.from(
      { length: this._trailState.count },
      (_, i) => getTrailPoint(this._trailState!, i),
    );
    const pickupForPlayer = {
      x: this._playerState.x,
      y: this._playerState.y,
      radius: getPlayerRadius(this._playerState),
      magnetRange: this._playerState.magnetRange,
      trailMagnet: this._playerState.trailMagnet,
    };
    const scrapEvents = updateScraps(
      this._waveState.scraps,
      pickupForPlayer,
      dt,
      trailPointsForScraps,
    );
    for (const ev of scrapEvents) {
      if (ev === 'scrap') {
        this._score += 10;
      }
    }

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

    // Update enemies — swap-and-pop despawn
    for (let i = this._enemies.length - 1; i >= 0; i--) {
      const result = updateEnemy(
        this._enemies[i],
        this._playerState,
        dt,
        this._gameClock,
        context.camera.isVisible,
      );
      if (result.despawned) {
        this._enemies[i] = this._enemies[this._enemies.length - 1];
        this._enemies.pop();
        enemiesChanged = true;
      }
    }

    // --- Combat: near-miss + collision (before trail update so encirclement doesn't remove enemies first) ---
    for (let i = this._enemies.length - 1; i >= 0; i--) {
      const enemy = this._enemies[i];
      if (!enemy.alive) continue;

      // Near-miss check before collision (collision would put enemy out of near-miss range)
      if (checkNearMiss(this._playerState, enemy)) {
        const nmResult = processNearMiss(this._playerState, enemy, this._score);
        this._score = nmResult.score;
        this._playerState.comboLevel = nmResult.comboLevel;
        eventBus.emit('nearMiss', { x: enemy.x, y: enemy.y });
      }

      // Collision check
      if (checkPlayerEnemyCollision(this._playerState, enemy)) {
        const dmgResult = processPlayerHit(this._playerState, enemy, this._waveState.waveIndex);
        if (dmgResult.type === 'hit') {
          eventBus.emit('playerDamaged', {
            amount: dmgResult.finalDamage,
            x: this._playerState.x,
            y: this._playerState.y,
          });
        }
        if (this._playerState.hp <= 0) {
          eventBus.emit('playerDied', {});
          // TODO: transition to death state (Step 11/12)
        }
        enemiesChanged = true;
      }
    }

    // Per-frame player timers
    updateNearMissStreak(this._playerState, dt);
    applyHpRegen(this._playerState, dt);

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
    this._propsRenderer?.destroy();
    this._enemyRenderer?.destroy();
    this._playerRenderer = null;
    this._playerState = null;
    this._trailRenderer = null;
    this._trailState = null;
    this._propsRenderer = null;
    this._propsState = null;
    this._enemyRenderer = null;
    this._enemies = [];
    this._waveState = null;

    const { backgroundLayer, playerLayer, trailLayer, propsLayer, enemiesLayer } =
      context.pixiApp;
    backgroundLayer.removeChildren();
    playerLayer.removeChildren();
    trailLayer.removeChildren();
    propsLayer.removeChildren();
    enemiesLayer.removeChildren();
  }
}
