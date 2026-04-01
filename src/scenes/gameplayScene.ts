// gameplayScene.ts — Main gameplay scene: player, trail, props, and enemies.
// Hosts player, trail, prop state, enemy state, updates, and renderers.

import { Sprite, Assets } from 'pixi.js';
import type { Scene, GameContext } from './sceneManager';
import { CFG, S } from '@core/config';
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
import { processNearMiss, processHazardNearMiss } from '@gameplay/combat/nearMiss';
import {
  updateNearMissStreak,
  applyHpRegen,
  updateScraps,
  computeEncircleOutcome,
  applyComboHeal,
  type ScrapPickup,
} from '@gameplay/pureLogic';
import { getPlayerRadius } from '@gameplay/player/playerState';
import { makeScoringState, updateScoring, addScore, type ScoringState } from '@gameplay/scoring';
import { saveManager } from '@core/saveManager';
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
import { HudManager, type HudData } from '@ui/hud/hudManager';
import { EventLog } from '@ui/hud/eventLog';

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
  private _scoringState: ScoringState | null = null;
  private _waveState: WaveState | null = null;
  private _hudManager: HudManager | null = null;
  private _eventLog: EventLog | null = null;
  private _evListeners: Array<() => void> = [];

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
    this._scoringState = makeScoringState(saveManager.getHighScore());

    // --- HUD ---
    const scoreH = S(42); // initial panel height (no newBest yet)
    const eventLogY = scoreH + S(12) + S(20) + S(8); // below HP bar
    this._hudManager = new HudManager(context.pixiApp.hudLayer);
    this._eventLog = new EventLog(context.pixiApp.eventLogLayer, eventLogY);

    // Subscribe to eventBus for log messages; store removers for cleanup
    const onNearMiss = () => this._eventLog?.add('NEAR MISS +25', 0xffff00);
    const onDamaged = (data: { amount: number; x: number; y: number }) =>
      this._eventLog?.add(`HIT -${data.amount}HP`, 0xff4444);
    const onEncircle = (data: { count: number; x: number; y: number }) =>
      this._eventLog?.add(`ENCIRCLE x${data.count}!`, 0x00ffcc);
    const onWave = (data: { wave: number }) =>
      this._eventLog?.add(`WAVE ${data.wave}`, 0x35f2d0);

    eventBus.on('nearMiss', onNearMiss);
    eventBus.on('playerDamaged', onDamaged);
    eventBus.on('encirclement', onEncircle);
    eventBus.on('waveStarted', onWave);

    this._evListeners = [
      () => eventBus.off('nearMiss', onNearMiss),
      () => eventBus.off('playerDamaged', onDamaged),
      () => eventBus.off('encirclement', onEncircle),
      () => eventBus.off('waveStarted', onWave),
    ];

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
      !this._waveState ||
      !this._scoringState
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

    // --- Per-frame scoring: base score, drift combo, combo decay ---
    // Sync combo from player into scoring state first (near-miss may have changed it last frame)
    this._scoringState.comboLevel = this._playerState.comboLevel;
    updateScoring(
      this._scoringState,
      this._playerState.drifting,
      this._playerState.driftTime,
      this._playerState.scoreMult,
      this._playerState.comboMaster,
      dt,
    );
    // Sync combo back to player (decay may have reduced it)
    this._playerState.comboLevel = this._scoringState.comboLevel;

    let enemiesChanged = false;

    // --- Wave manager ---
    const waveEvents = updateWave(this._waveState, dt, this._scoringState.score, this._enemies.length);
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
        addScore(this._scoringState, 10); // +10 per scrap (intentional improvement over original)
        eventBus.emit('scoreChanged', { score: this._scoringState.score, delta: 10 });
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
    if (checkNearMissProp(this._propsState, this._playerState)) {
      const hmResult = processHazardNearMiss(this._playerState, this._scoringState.score);
      this._scoringState.score = hmResult.score;
      this._scoringState.comboLevel = hmResult.comboLevel;
      this._playerState.comboLevel = hmResult.comboLevel;
      eventBus.emit('nearMiss', { x: this._playerState.x, y: this._playerState.y });
    }

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
        const oldCombo = this._scoringState.comboLevel;
        const nmResult = processNearMiss(this._playerState, enemy, this._scoringState.score);
        this._scoringState.score = nmResult.score;
        this._scoringState.comboLevel = nmResult.comboLevel;
        this._playerState.comboLevel = nmResult.comboLevel;
        // Combo_heal at milestones 3/5/8 (intentional: also fires from near-miss like original)
        this._playerState.hp = applyComboHeal(
          oldCombo, nmResult.comboLevel,
          this._playerState.comboHeal,
          this._playerState.hp, this._playerState.maxHp,
        );
        // Near-miss scrap spawn: 35% chance (matches original game.js)
        if (Math.random() < CFG.SCRAP_NEAR_MISS_CHANCE) {
          this._waveState.scraps.push({ x: enemy.x, y: enemy.y, life: 15, type: 'scrap' });
        }
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
      const killCount = loopResult.killedEnemies.length;
      if (killCount > 0) {
        const oldCombo = this._scoringState.comboLevel;
        const encircleResult = computeEncircleOutcome(
          killCount,
          this._scoringState.comboLevel,
          this._playerState.scoreMult,
          this._playerState.encircleScoreBonus,
        );
        addScore(this._scoringState, encircleResult.scoreDelta);
        this._scoringState.comboLevel = encircleResult.comboLevel;
        this._playerState.comboLevel = encircleResult.comboLevel;
        // Combo_heal at milestones (intentional improvement: also fires from encirclement)
        this._playerState.hp = applyComboHeal(
          oldCombo, encircleResult.comboLevel,
          this._playerState.comboHeal,
          this._playerState.hp, this._playerState.maxHp,
        );
        eventBus.emit('scoreChanged', { score: this._scoringState.score, delta: encircleResult.scoreDelta });
      }

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

    // --- HUD ---
    if (this._hudManager && this._eventLog) {
      const hudData: HudData = {
        score: this._scoringState.score,
        newBest: this._scoringState.newBest,
        hp: this._playerState.hp,
        maxHp: this._playerState.maxHp,
        lastHitTimer: this._playerState.lastHitTimer,
        comboLevel: this._scoringState.comboLevel,
        drifting: this._playerState.drifting,
        driftTime: this._playerState.driftTime,
        speed: getPlayerSpeed(this._playerState),
        maxSpeed: this._playerState.maxSpeed,
        waveIndex: this._waveState.waveIndex,
        enemyCount: this._enemies.length,
        phase: this._waveState.phase,
        waveTimer: this._waveState.waveTimer,
        combatDuration: this._waveState.currentCombatDuration,
      };
      this._hudManager.update(hudData);
      // Keep EventLog Y in sync with score panel height
      const logPanelY = (hudData.newBest ? S(56) : S(42)) + S(12) + S(20) + S(8);
      this._eventLog.setPanelY(logPanelY);
      this._eventLog.update(dt);
    }

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
    this._scoringState = null;
    this._hudManager?.destroy();
    this._hudManager = null;
    this._eventLog?.destroy();
    this._eventLog = null;
    for (const remove of this._evListeners) remove();
    this._evListeners = [];

    const { backgroundLayer, playerLayer, trailLayer, propsLayer, enemiesLayer } =
      context.pixiApp;
    backgroundLayer.removeChildren();
    playerLayer.removeChildren();
    trailLayer.removeChildren();
    propsLayer.removeChildren();
    enemiesLayer.removeChildren();
  }
}
