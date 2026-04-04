// gameplayScene.ts — Main gameplay scene: player, trail, props, and enemies.
// Hosts player, trail, prop state, enemy state, updates, and renderers.

import { Sprite, Assets, Graphics } from 'pixi.js';
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
import { buildUpgradeOffer, applyUpgrade, getRerollCount } from '@gameplay/upgrades/upgradeSystem';
import type { UpgradeDef } from '@gameplay/upgrades/upgradeRegistry';
import { UpgradeCardsUI } from '@ui/menus/upgradeCards';
import { inputManager } from '@input/inputManager';
import { applyMap } from '@core/config';
import { ScreenFX } from '@render/screenFx';
import { ParticleSystem } from '@render/particles';
import { DIFFICULTY_MODIFIERS, computeModifierScoreMult } from '@content/maps';
import { sceneManager } from './sceneManager';
import { GameOverScene, type GameOverData } from './gameOverScene';

export interface GameplayOptions {
  mapId?: string;
  modifierIds?: string[];
  sandbox?: boolean;
}

export class GameplayScene implements Scene {
  private _opts: GameplayOptions;
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

  // Upgrade break state
  private _upgradePhase = false;
  private _upgradeCards: UpgradeCardsUI | null = null;
  private _currentOffer: UpgradeDef[] = [];
  private _rerollsLeft = 0;
  private _upgradeChosen = false;
  private _upgradeConfirmTimer = 0;
  private _cardAnimTimer = 0;

  // Death state machine (fx.js:530-568)
  private _dying = false;
  private _deathPhase = 0; // 0=freeze, 1=slowmo+shatter, 2=desat
  private _deathTimer = 0;

  // Screen effects + particles
  private _screenFx: ScreenFX | null = null;
  private _particles: ParticleSystem | null = null;

  // Arena boundary glow graphics
  private _arenaGlow: Graphics | null = null;

  // Pause state
  private _paused = false;
  private _pauseOverlay: Graphics | null = null;
  private _pauseText: import('pixi.js').Text | null = null;
  private _preMuteMusicVol = 0;

  // Drift squeal edge detection
  private _wasDrifting = false;

  constructor(opts: GameplayOptions = {}) {
    this._opts = opts;
  }

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

    // Apply map + difficulty modifier CFG overrides before initializing game state
    applyMap(this._opts.mapId ?? saveManager.getSelectedMap());

    this._playerState = makePlayerState();
    this._dying = false;
    this._deathTimer = 0;

    // Apply difficulty modifiers (mutates CFG spawn intervals + player stats)
    if (this._opts.modifierIds && this._opts.modifierIds.length > 0) {
      const speedBonusRef = { value: 0 };
      const playerMults = { scoreMult: this._playerState.scoreMult, maxHp: undefined as number | undefined, hp: undefined as number | undefined };
      for (const id of this._opts.modifierIds) {
        const mod = DIFFICULTY_MODIFIERS.find(m => m.id === id);
        mod?.apply({ speedBonusRef, playerMults });
      }
      this._playerState.scoreMult = playerMults.scoreMult;
      if (playerMults.maxHp !== undefined) { this._playerState.maxHp = playerMults.maxHp; this._playerState.hp = playerMults.hp ?? playerMults.maxHp; }
      // Store speed bonus on wave state after creation below
    }

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
    // Apply hard_mode speed bonus to wave state
    if (this._opts.modifierIds?.includes('hard_mode')) {
      this._waveState.speedBonus = (this._waveState.speedBonus ?? 0) + 100;
    }
    if (!this._opts.sandbox) {
      startWave(this._waveState);
      eventBus.emit('waveStarted', { wave: this._waveState.waveIndex });
    }
    this._scoringState = makeScoringState(saveManager.getHighScore());

    // --- HUD ---
    const scoreH = S(42); // initial panel height (no newBest yet)
    const eventLogY = scoreH + S(12) + S(20) + S(8); // below HP bar
    this._hudManager = new HudManager(context.pixiApp.hudLayer);
    this._eventLog = new EventLog(context.pixiApp.eventLogLayer, eventLogY);

    // --- Upgrade cards ---
    this._upgradeCards = new UpgradeCardsUI(context.pixiApp.overlayLayer);
    this._upgradePhase = false;
    this._upgradeChosen = false;
    this._upgradeConfirmTimer = 0;

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

    // --- Screen FX + Particles ---
    this._screenFx = new ScreenFX(context.pixiApp.screenFxContainer);
    this._particles = new ParticleSystem(context.pixiApp.particlesLayer);
    this._dying = false;
    this._deathPhase = 0;
    this._deathTimer = 0;

    // FX event subscriptions
    const onNearMissFx = (data: { x: number; y: number }) => {
      this._screenFx?.slowmo(0.85, 0.15);
      this._particles?.spawn(data.x, data.y, 0xffff00, 4, { type: 'spark', sizeMin: 2, sizeMax: 4 });
    };
    const onDamagedFx = (data: { amount: number; x: number; y: number }) => {
      this._screenFx?.shake(4, 0.2);
      this._screenFx?.slowmo(0.9, 0.1);
    };
    const onEncircleFx = (data: { count: number; x: number; y: number }) => {
      this._screenFx?.shake(6, 0.25);
      this._particles?.addRing(data.x, data.y, 0x00ffcc);
    };
    const onEnemyKilledFx = (data: { x: number; y: number; type: string }) => {
      this._particles?.spawn(data.x, data.y, 0xff3b6b, 6, {
        type: 'shard', vxMin: -200, vxMax: 200, vyMin: -200, vyMax: 200,
        lifeMin: 0.3, lifeMax: 0.6, sizeMin: 3, sizeMax: 7,
      });
    };
    const onSpawnParticles = (data: { x: number; y: number; type: string; count: number }) => {
      this._particles?.spawn(data.x, data.y, 0xffffff, data.count, { type: 'spark' });
    };

    eventBus.on('nearMiss', onNearMissFx);
    eventBus.on('playerDamaged', onDamagedFx);
    eventBus.on('encirclement', onEncircleFx);
    eventBus.on('enemyKilled', onEnemyKilledFx);
    eventBus.on('spawnParticles', onSpawnParticles);

    this._evListeners = [
      () => eventBus.off('nearMiss', onNearMiss),
      () => eventBus.off('playerDamaged', onDamaged),
      () => eventBus.off('encirclement', onEncircle),
      () => eventBus.off('waveStarted', onWave),
      () => eventBus.off('nearMiss', onNearMissFx),
      () => eventBus.off('playerDamaged', onDamagedFx),
      () => eventBus.off('encirclement', onEncircleFx),
      () => eventBus.off('enemyKilled', onEnemyKilledFx),
      () => eventBus.off('spawnParticles', onSpawnParticles),
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

    // Arena boundary glow (redrawn each frame in update for pulse effect)
    const arenaGlow = new Graphics();
    this._arenaGlow = arenaGlow;
    backgroundLayer.addChild(arenaGlow);
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

    // dt is rawDt here; screenFx.update() returns dilated dt
    const rawDt = dt;
    const dilatedDt = this._screenFx?.update(rawDt) ?? rawDt;

    this._gameClock += dilatedDt;

    // --- Death state machine (from game.js:530-568, values from CFG) ---
    if (this._dying) {
      this._deathTimer -= rawDt;
      this._particles?.update(dilatedDt || rawDt);
      this._eventLog?.update(dilatedDt || rawDt);
      this._screenFx?.applyToContainer(context.pixiApp.worldContainer);
      this._drawArenaGlow();

      if (this._deathPhase === 0 && this._deathTimer <= 0) {
        // Phase 0 (freeze) done → phase 1: slowmo + shatter
        this._deathPhase = 1;
        this._deathTimer = CFG.DEATH_SLOWMO_DUR;
        this._screenFx?.slowmo(CFG.DEATH_SLOWMO, CFG.DEATH_SLOWMO_DUR);
        this._screenFx?.shake(10, 0.35);
        const shardCount = CFG.SHARD_COUNT_MIN + Math.floor(Math.random() * (CFG.SHARD_COUNT_MAX - CFG.SHARD_COUNT_MIN + 1));
        if (this._playerState) {
          this._particles?.spawn(this._playerState.x, this._playerState.y, 0xEAEFF7, shardCount, {
            type: 'shard', vxMin: -300, vxMax: 300, vyMin: -300, vyMax: 300,
            lifeMin: 0.4, lifeMax: 0.8, sizeMin: 4, sizeMax: 10,
          });
          this._particles?.addRing(this._playerState.x, this._playerState.y, 0xFF3B6B);
        }
        this._screenFx?.flash(0xFF3B6B, 0.15, 0.1);
      } else if (this._deathPhase === 1 && this._deathTimer <= 0) {
        // Phase 1 done → phase 2: desaturate
        this._deathPhase = 2;
        this._deathTimer = 0.5;
        this._screenFx?.desaturate(0.7);
      } else if (this._deathPhase === 2 && this._deathTimer <= 0) {
        this._transitionToGameOver(context);
      }
      return;
    }

    // Apply screen FX transform (shake + zoom) after camera updates below
    const input = context.getInput();

    // --- Upgrade break phase: skip game logic, handle card UI ---
    if (this._upgradePhase && this._playerState && this._trailState) {
      this._cardAnimTimer += dt;
      this._upgradeCards?.update(dt);
      this._eventLog?.update(dt);

      if (!this._upgradeChosen) {
        const cardAction = this._upgradeCards?.checkInput(input, inputManager.consumeTap()) ?? null;

        if (cardAction !== null && cardAction !== 'reroll') {
          // Card selected
          const upgrade = this._currentOffer[cardAction];
          if (upgrade) {
            applyUpgrade(this._playerState, upgrade);
            // Handle trail upgrades (wider_trail/trail_echo) directly here
            if (upgrade.id === 'wider_trail') this._trailState.closeDist = 60;
            if (upgrade.id === 'trail_echo') this._trailState.maxPoints = 600;
            eventBus.emit('upgradeApplied', { id: upgrade.id });
            this._upgradeChosen = true;
            this._upgradeCards?.hide();
          }
        } else if (cardAction === 'reroll' && this._rerollsLeft > 0) {
          const newOffer = buildUpgradeOffer(this._playerState);
          if (newOffer.length > 0) {
            this._rerollsLeft--;
            this._currentOffer = newOffer;
            this._cardAnimTimer = 0;
            this._upgradeCards?.show(this._currentOffer, this._rerollsLeft);
          }
        }
      }

      // Post-selection countdown (also handles empty pool auto-start)
      if (this._upgradeChosen || this._currentOffer.length === 0) {
        this._upgradeConfirmTimer -= dt;
        if (this._upgradeConfirmTimer <= 0) {
          this._upgradePhase = false;
          this._playerState.frozen = false;
          startWave(this._waveState!);
          eventBus.emit('waveStarted', { wave: this._waveState!.waveIndex });
        }
      }

      // Still render/update camera during break
      this._trailRenderer.update(this._trailState);
      this._playerRenderer?.update(this._playerState);
      if (this._hudManager && this._eventLog) {
        const hudData: HudData = {
          score: this._scoringState!.score,
          newBest: this._scoringState!.newBest,
          hp: this._playerState.hp,
          maxHp: this._playerState.maxHp,
          lastHitTimer: this._playerState.lastHitTimer,
          comboLevel: this._scoringState!.comboLevel,
          drifting: this._playerState.drifting,
          driftTime: this._playerState.driftTime,
          speed: getPlayerSpeed(this._playerState),
          maxSpeed: this._playerState.maxSpeed,
          waveIndex: this._waveState!.waveIndex,
          enemyCount: 0,
          phase: 'break',
          waveTimer: 0,
          combatDuration: this._waveState!.currentCombatDuration,
        };
        this._hudManager.update(hudData);
      }
      context.camera.update(dilatedDt, this._playerState.x, this._playerState.y, 0, 0, 0);
      this._screenFx?.applyToContainer(context.pixiApp.worldContainer);
      this._particles?.update(dilatedDt);
      this._drawArenaGlow();
      return;
    }

    updatePlayer(this._playerState, {
      dt: dilatedDt,
      gameClock: this._gameClock,
      up: input.up,
      down: input.down,
      left: input.left,
      right: input.right,
      drift: input.drift,
    });

    // Skid marks when drifting
    if (this._playerState.drifting) {
      this._particles?.addSkid(this._playerState.x, this._playerState.y, 0x222233, 0.5);
    }

    // --- Per-frame scoring: base score, drift combo, combo decay ---
    // Sync combo from player into scoring state first (near-miss may have changed it last frame)
    this._scoringState.comboLevel = this._playerState.comboLevel;
    updateScoring(
      this._scoringState,
      this._playerState.drifting,
      this._playerState.driftTime,
      this._playerState.scoreMult,
      this._playerState.comboMaster,
      dilatedDt,
    );
    // Sync combo back to player (decay may have reduced it)
    this._playerState.comboLevel = this._scoringState.comboLevel;

    let enemiesChanged = false;

    // --- Wave manager ---
    const waveEvents = updateWave(this._waveState, dilatedDt, this._scoringState.score, this._enemies.length);
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
        // Enter upgrade break phase (from game.js:911-928)
        this._upgradePhase = true;
        this._upgradeChosen = false;
        this._upgradeConfirmTimer = CFG.UPGRADE_CONFIRM_TIME;
        this._cardAnimTimer = 0;
        this._rerollsLeft = getRerollCount(this._playerState);
        this._currentOffer = buildUpgradeOffer(this._playerState);
        // Freeze player
        this._playerState.vx = 0;
        this._playerState.vy = 0;
        this._playerState.drifting = false;
        this._playerState.handbrakeTimer = 0;
        this._playerState.driftTime = 0;
        this._playerState.wallRiding = false;
        this._playerState.driftChain = 0;
        this._playerState.frozen = true;
        if (this._currentOffer.length > 0) {
          this._upgradeCards?.show(this._currentOffer, this._rerollsLeft);
        }
      } else if (ev.type === 'break_end') {
        startWave(this._waveState);
        eventBus.emit('waveStarted', { wave: this._waveState.waveIndex });
      }
    }
    if (enemiesChanged) this._enemyRenderer?.sync(this._enemies);

    // --- Scrap spawning ---
    const scrapPos = tickScrapSpawn(
      this._waveState,
      dilatedDt,
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
      dilatedDt,
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
    updatePropCooldowns(this._propsState, dilatedDt);
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
        dilatedDt,
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
        if (this._playerState.hp <= 0 && !this._dying) {
          this._dying = true;
          this._deathPhase = 0;
          this._deathTimer = CFG.FREEZE_TIME; // 0.5s freeze
          this._screenFx?.freeze(CFG.FREEZE_TIME);
          eventBus.emit('playerDied', {});
        }
        enemiesChanged = true;
      }
    }

    // Per-frame player timers
    updateNearMissStreak(this._playerState, dilatedDt);
    applyHpRegen(this._playerState, dilatedDt);

    const loopResult = updateTrail(this._trailState, this._playerState, this._enemies, dilatedDt);
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
      this._eventLog.update(dilatedDt);
    }

    context.camera.update(
      dilatedDt,
      this._playerState.x,
      this._playerState.y,
      this._playerState.vx,
      this._playerState.vy,
      getPlayerSpeed(this._playerState),
    );
    this._screenFx?.applyToContainer(context.pixiApp.worldContainer);
    this._particles?.update(dilatedDt);
    this._drawArenaGlow();
  }

  private _drawArenaGlow(): void {
    if (!this._arenaGlow) return;
    const pulse = Math.sin(this._gameClock * 2);
    const baseAlpha = 0.4 + 0.15 * pulse;
    this._arenaGlow.clear();
    // 3 passes: decreasing line width, increasing alpha — same pattern as game.js
    const widths = [14, 8, 2];
    const alphas = [baseAlpha * 0.3, baseAlpha * 0.5, baseAlpha];
    for (let i = 0; i < 3; i++) {
      this._arenaGlow
        .rect(0, 0, CFG.WORLD_W, CFG.WORLD_H)
        .stroke({ color: 0x35F2D0, width: widths[i], alpha: alphas[i] });
    }
  }

  private _transitionToGameOver(context: GameContext): void {
    if (!this._scoringState || !this._waveState) return;

    // Save high score
    if (this._scoringState.score > this._scoringState.highScore) {
      saveManager.setHighScore(Math.floor(this._scoringState.score));
    }

    const modMult = computeModifierScoreMult(this._opts.modifierIds ?? []);
    const data: GameOverData = {
      score: this._scoringState.score,
      highScore: Math.max(this._scoringState.highScore, this._scoringState.score),
      newBest: this._scoringState.newBest,
      waveReached: this._waveState.waveIndex,
      runStats: this._scoringState.runStats,
      modifierMult: modMult,
      lastMapId: this._opts.mapId ?? saveManager.getSelectedMap(),
      lastModifierIds: this._opts.modifierIds?.slice() ?? [],
      sandbox: this._opts.sandbox ?? false,
    };

    this.exit(context);
    sceneManager.switchTo(new GameOverScene(data));
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
    this._upgradeCards?.destroy();
    this._upgradeCards = null;
    this._screenFx?.destroy();
    this._screenFx = null;
    this._particles?.destroy();
    this._particles = null;
    this._arenaGlow = null; // destroyed with backgroundLayer.removeChildren() below
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
