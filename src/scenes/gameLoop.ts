// gameLoop.ts — Game loop orchestrator: owns all mutable game state and dispatches per-frame systems.
// gameplayScene.ts is now a thin Pixi adapter that creates and delegates to this class.

import { Sprite, Assets, Graphics, Text, TextStyle } from 'pixi.js';
import type { GameContext } from './sceneManager';
import { CFG, S, applyMap, type EnemyType } from '@core/config';
import { makePlayerState, getPlayerSpeed, getPlayerRadius, type PlayerState } from '@gameplay/player/playerState';
import { updatePlayer } from '@gameplay/player/playerUpdate';
import { PlayerRenderer } from '@gameplay/player/playerRenderer';
import { makeTrailState, getTrailPoint, type TrailState } from '@gameplay/trail/trailState';
import { updateTrail } from '@gameplay/trail/trailUpdate';
import { TrailRenderer } from '@gameplay/trail/trailRenderer';
import {
  makePropsState,
  generateProps,
  checkPlayerCollision as checkPlayerPropCollision,
  handlePropCollisions,
  checkEnemyPropCollision,
  updatePropCooldowns,
  checkNearMissProp,
  type PropsState,
} from '@gameplay/world/propsSystem';
import { PropsRenderer } from '@gameplay/world/propsRenderer';
import { makeEnemyState, type EnemyState } from '@gameplay/enemies/enemyState';
import { updateEnemy } from '@gameplay/enemies/enemyUpdate';
import { EnemyRenderer } from '@gameplay/enemies/enemyRenderer';
import { PickupRenderer } from '@render/pickupRenderer';
import { getDeathParticles, type EnemyDeathEvent } from '@gameplay/enemies/enemyDeathFx';
import { checkPlayerEnemyCollision, checkNearMiss } from '@gameplay/combat/collision';
import { processPlayerHit } from '@gameplay/combat/damage';
import { processNearMiss, processHazardNearMiss } from '@gameplay/combat/nearMiss';
import { applyTrailBurn } from '@gameplay/combat/trailBurn';
import { applyChainLightning } from '@gameplay/combat/chainLightning';
import {
  updateNearMissStreak,
  applyHpRegen,
  updateScraps,
  computeEncircleOutcome,
  applyComboHeal,
  updateRunStats,
} from '@gameplay/pureLogic';
import { makeScoringState, updateScoring, addScore, type ScoringState } from '@gameplay/scoring';
import { saveManager } from '@core/saveManager';
import {
  makeWaveState,
  startWave,
  updateWave,
  tickScrapSpawn,
  type WaveState,
  type HazardZone,
} from '@gameplay/spawning/waveManager';
import { clamp } from '@core/utils';
import { eventBus } from '@core/eventBus';
import { HudManager, type HudData } from '@ui/hud/hudManager';
import { EventLog } from '@ui/hud/eventLog';
import { UpgradeCardsUI } from '@ui/menus/upgradeCards';
import { inputManager } from '@input/inputManager';
import type { InputState } from '@input/inputManager';
import { PerfOverlay } from '@ui/PerfOverlay';
import { ScreenFX } from '@render/screenFx';
import { SpeedLines } from '@render/speedLines';
import { ParticleSystem } from '@render/particles';
import { uiTween, pauseUITweens, resumeUITweens } from '@render/tween';
import { DIFFICULTY_MODIFIERS, computeModifierScoreMult } from '@content/maps';
import { sceneManager } from './sceneManager';
import { GameOverScene, type GameOverData } from './gameOverScene';
import { DeathSequence } from '@gameplay/death/deathSequence';
import { UpgradeBreakPhase } from '@gameplay/upgradeBreak/upgradeBreakPhase';
import type { GameplayOptions } from './gameplayScene';

const EMPTY_INPUT: InputState = {
  up: false, down: false, left: false, right: false,
  drift: false, pause: false, enter: false, reroll: false,
  select1: false, select2: false, select3: false,
  menuLeft: false, menuRight: false,
  menuMod1: false, menuMod2: false, menuMod3: false, menuMod4: false,
  mute: false, sfxDown: false, sfxUp: false, musicDown: false, musicUp: false,
  escape: false, perfToggle: false,
};

export class GameLoop {
  // --- Game state (all moved from GameplayScene) ---
  private _playerState: PlayerState;
  private _playerRenderer: PlayerRenderer;
  private _trailState: TrailState;
  private _trailRenderer: TrailRenderer;
  private _propsState: PropsState;
  private _propsRenderer: PropsRenderer;
  private _enemies: EnemyState[] = [];
  private _enemyRenderer: EnemyRenderer;
  private _pickupRenderer: PickupRenderer;
  private _gameClock = 0;
  private _scoringState: ScoringState;
  private _waveState: WaveState;
  private _hudManager: HudManager;
  private _eventLog: EventLog;
  private _evListeners: Array<() => void> = [];

  private _screenFx: ScreenFX;
  private _speedLines: SpeedLines;
  private _particles: ParticleSystem;
  private _arenaGlow: Graphics;
  private _accentColor = 0x35F2D0;

  // PerfOverlay
  private _perf: PerfOverlay;
  private _lastFrameWallMs = 0;
  private _pausePerfText: import('pixi.js').Text | null = null;

  // Benchmark mode
  private _bench: {
    scenario: string;
    drift: boolean;
    phase: 'warmup' | 'collect' | 'done';
    timer: number;
    frames: number[];
  } | null = null;

  // Pause state
  private _paused = false;
  private _pauseOverlay: Graphics | null = null;
  private _pauseText: Text | null = null;
  private _pauseHint: Text | null = null;
  private _preMuteMusicVol = 0;

  // Post-upgrade-selection countdown overlay
  private _cdBg: Graphics | null = null;
  private _cdIcon: Text | null = null;
  private _cdName: Text | null = null;
  private _cdNum: Text | null = null;
  private _cdWave: Text | null = null;

  // Drift squeal edge detection
  private _wasDrifting = false;
  // NOTE: not in original — edge detection for handbrake burst and boost zone FX.
  private _wasHandbraking = false;
  private _wasInBoostZone = false;
  private _cdVisible = false;

  // Sub-managers
  private _death: DeathSequence;
  private _upgradeBreak: UpgradeBreakPhase;

  constructor(private _opts: GameplayOptions, private _ctx: GameContext) {
    const {
      worldContainer,
      backgroundLayer,
      playerLayer,
      playerBloomLayer,
      trailLayer,
      trailBloomLayer,
      propsLayer,
      enemiesLayer,
    } = _ctx.pixiApp;

    _ctx.camera.attachContainer(worldContainer);

    // Apply map + difficulty modifier CFG overrides before initializing game state
    applyMap(_opts.mapId ?? saveManager.getSelectedMap());
    {
      const parsedAccent = parseInt(CFG.C_ACCENT.replace('#', ''), 16);
      this._accentColor = Number.isFinite(parsedAccent) ? parsedAccent : 0x35F2D0;
    }

    this._playerState = makePlayerState();
    this._paused = false;

    // Apply difficulty modifiers (mutates CFG spawn intervals + player stats)
    if (_opts.modifierIds && _opts.modifierIds.length > 0) {
      const speedBonusRef = { value: 0 };
      const playerMults = {
        scoreMult: this._playerState.scoreMult,
        maxHp: undefined as number | undefined,
        hp: undefined as number | undefined,
      };
      for (const id of _opts.modifierIds) {
        const mod = DIFFICULTY_MODIFIERS.find(m => m.id === id);
        mod?.apply({ speedBonusRef, playerMults });
      }
      this._playerState.scoreMult = playerMults.scoreMult;
      if (playerMults.maxHp !== undefined) {
        this._playerState.maxHp = playerMults.maxHp;
        this._playerState.hp = playerMults.hp ?? playerMults.maxHp;
      }
    }

    this._playerRenderer = new PlayerRenderer({ playerLayer, playerBloomLayer });
    this._trailState = makeTrailState();
    this._trailRenderer = new TrailRenderer({ trailLayer, trailBloomLayer });
    this._propsState = makePropsState();
    generateProps(this._propsState);
    this._propsRenderer = new PropsRenderer({ propsLayer });
    this._propsRenderer.setProps(this._propsState.allProps);

    this._enemyRenderer = new EnemyRenderer({ enemiesLayer });
    this._enemyRenderer.sync(this._enemies);
    this._pickupRenderer = new PickupRenderer(this._ctx.pixiApp.pickupsLayer);
    this._waveState = makeWaveState();
    if (_opts.modifierIds?.includes('hard_mode')) {
      this._waveState.speedBonus = (this._waveState.speedBonus ?? 0) + 100;
    }
    this._scoringState = makeScoringState(saveManager.getHighScore());

    // --- HUD ---
    const scoreH = S(42);
    const eventLogY = scoreH + S(12) + S(20) + S(8);
    this._hudManager = new HudManager(_ctx.pixiApp.hudLayer);
    this._eventLog = new EventLog(_ctx.pixiApp.eventLogLayer, eventLogY);
    this._perf = new PerfOverlay(_ctx.pixiApp.hudLayer);

    // --- Screen FX + Particles ---
    this._screenFx = new ScreenFX(_ctx.pixiApp.screenFxContainer, true);
    // SpeedLines sits on top of vignette/flash inside screenFxContainer (port of game.js:1270-1294).
    this._speedLines = new SpeedLines(_ctx.pixiApp.screenFxContainer);
    this._particles = new ParticleSystem(_ctx.pixiApp.particlesLayer, _ctx.pixiApp.sparkTexture, _ctx.camera.isVisible);

    // --- Sub-managers ---
    this._death = new DeathSequence(
      this._screenFx,
      this._particles,
      () => this._transitionToGameOver(),
    );
    this._upgradeBreak = new UpgradeBreakPhase(
      new UpgradeCardsUI(_ctx.pixiApp.overlayLayer),
      _ctx.audioManager,
      (waveIndex) => { this._hudManager.showWaveBanner(waveIndex); },
    );

    // --- Event subscriptions ---
    const onNearMiss    = () => this._eventLog.add('NEAR MISS +25', 0xffff00);
    const onDamaged     = (data: { amount: number; x: number; y: number }) =>
      this._eventLog.add(`HIT -${data.amount}HP`, 0xff4444);
    const onEncircle    = (data: { count: number; x: number; y: number }) =>
      this._eventLog.add(`ENCIRCLE x${data.count}!`, 0x00ffcc);
    const onWave        = (data: { wave: number }) =>
      this._eventLog.add(`WAVE ${data.wave}`, 0x35f2d0);

    eventBus.on('nearMiss',       onNearMiss);
    eventBus.on('playerDamaged',  onDamaged);
    eventBus.on('encirclement',   onEncircle);
    eventBus.on('waveStarted',    onWave);

    const onNearMissFx = (data: { x: number; y: number }) => {
      _ctx.audioManager.play('near_miss');
      this._screenFx.slowmo(0.85, 0.15);
      this._particles.spawn(data.x, data.y, 0xffff00, 4, { type: 'spark', sizeMin: 2, sizeMax: 4 });
    };
    const onDamagedFx = (_data: { amount: number; x: number; y: number }) => {
      _ctx.audioManager.play('collision');
      this._screenFx.shake(4, 0.2);
      this._screenFx.slowmo(0.9, 0.1);
    };
    const onEncircleFx = (data: { count: number; x: number; y: number }) => {
      _ctx.audioManager.play('encircle');
      this._screenFx.shake(6, 0.25);
      this._particles.addRing(data.x, data.y, 0x00ffcc);
    };
    const onEnemyKilledFx = (data: { x: number; y: number; type: string; isElite?: boolean }) => {
      const requests = getDeathParticles({
        type: data.type as EnemyType,
        x: data.x, y: data.y,
        isElite: data.isElite ?? false,
      });
      for (const req of requests) {
        if (req.type === 'ring') {
          if (req.pulse) this._particles.addPulseRing(req.x, req.y, req.color);
          else           this._particles.addRing(req.x, req.y, req.color);
          continue;
        }
        const v = req.vMin ?? -200;
        const vMax = req.vMax ?? 200;
        this._particles.spawn(req.x, req.y, req.color, req.count, {
          type: req.type,
          vxMin: v, vxMax: vMax,
          vyMin: v, vyMax: vMax,
        });
      }
      if (data.type === 'bomber') this._screenFx.shake(4, 0.2);
      if (data.type === 'elite')  this._screenFx.shake(6, 0.25);
    };
    const onSpawnParticles = (data: { x: number; y: number; type: string; count: number; color?: number }) => {
      this._particles.spawn(data.x, data.y, data.color ?? 0xffffff, data.count, { type: 'spark' });
    };
    const onEventLog = (data: { text: string; color: string }) => {
      this._eventLog.add(data.text, parseInt(data.color.replace('#', ''), 16));
    };
    const onPlayerDied = () => {
      _ctx.audioManager.stopEngine();
      _ctx.audioManager.stopDrift();
      _ctx.audioManager.fadeOutMusic(0.5);
    };

    eventBus.on('nearMiss',       onNearMissFx);
    eventBus.on('playerDamaged',  onDamagedFx);
    eventBus.on('encirclement',   onEncircleFx);
    eventBus.on('enemyKilled',    onEnemyKilledFx);
    eventBus.on('spawnParticles', onSpawnParticles);
    eventBus.on('eventLog',       onEventLog);
    eventBus.on('playerDied',     onPlayerDied);

    this._evListeners = [
      () => eventBus.off('nearMiss',       onNearMiss),
      () => eventBus.off('playerDamaged',  onDamaged),
      () => eventBus.off('encirclement',   onEncircle),
      () => eventBus.off('waveStarted',    onWave),
      () => eventBus.off('nearMiss',       onNearMissFx),
      () => eventBus.off('playerDamaged',  onDamagedFx),
      () => eventBus.off('encirclement',   onEncircleFx),
      () => eventBus.off('enemyKilled',    onEnemyKilledFx),
      () => eventBus.off('spawnParticles', onSpawnParticles),
      () => eventBus.off('eventLog',       onEventLog),
      () => eventBus.off('playerDied',     onPlayerDied),
    ];

    // Start first wave after listeners are bound so initial "WAVE N" log is not missed.
    if (!_opts.sandbox && !_opts.benchmark) {
      startWave(this._waveState);
      eventBus.emit('waveStarted', { wave: this._waveState.waveIndex });
      this._hudManager.showWaveBanner(this._waveState.waveIndex);
      _ctx.audioManager.startEngine();
      _ctx.audioManager.startMusic();
    }

    _ctx.camera.reset(this._playerState.x, this._playerState.y);
    this._gameClock = 0;

    if (_opts.benchmark) {
      this._setupBenchmark(_opts.benchmark);
    }

    const bgTexture = Assets.get(CFG.BACKGROUND_SPRITE);
    if (bgTexture) {
      const bg = new Sprite(bgTexture);
      bg.width = CFG.WORLD_W;
      bg.height = CFG.WORLD_H;
      backgroundLayer.addChild(bg);
    }

    // Arena boundary glow (redrawn each frame for pulse effect)
    const arenaGlow = new Graphics();
    this._arenaGlow = arenaGlow;
    backgroundLayer.addChild(arenaGlow);
  }

  update(dt: number): void {
    // Wall-clock frame time for PerfOverlay (not clamped like dt)
    const nowMs = performance.now();
    const rawDtMs = this._lastFrameWallMs ? nowMs - this._lastFrameWallMs : dt * 1000;
    this._lastFrameWallMs = nowMs;
    this._perf.update(rawDtMs);

    if (this._bench) this._tickBench(rawDtMs);

    const rawDt = dt;
    const dilatedDt = this._screenFx.update(rawDt);

    this._gameClock += dilatedDt;

    // --- Death state machine (from game.js:530-568, values from CFG) ---
    // Render first so _onComplete (→ destroy) runs after state is accessed.
    if (this._death.active) {
      this._particles.update(dilatedDt || rawDt);
      this._eventLog.update(dilatedDt || rawDt);
      this._screenFx.applyToContainer(this._ctx.pixiApp.worldContainer);
      this._drawArenaGlow();
      this._death.update(rawDt, this._playerState.x, this._playerState.y);
      // No state access after _death.update() — _onComplete may have run and destroyed the loop.
      return;
    }

    const input = this._ctx.getInput();

    // --- Pause toggle (game.js:655-662, 493-508) ---
    if (input.pause) {
      this._paused = !this._paused;
      if (this._paused) {
        this._preMuteMusicVol = this._ctx.audioManager.musicVolume;
        this._ctx.audioManager.setVolume('music', this._preMuteMusicVol * 0.3);
        this._ctx.audioManager.stopEngine();
        this._ctx.audioManager.stopDrift();
        pauseUITweens();
      } else {
        this._ctx.audioManager.setVolume('music', this._preMuteMusicVol);
        this._ctx.audioManager.startEngine();
        resumeUITweens();
      }
    }
    if (input.perfToggle) this._perf.toggle();

    if (this._paused) {
      if (input.mute)      this._ctx.audioManager.setMuted(!this._ctx.audioManager.muted);
      if (input.sfxDown)   this._ctx.audioManager.setVolume('sfx',   this._ctx.audioManager.sfxVolume   - 0.1);
      if (input.sfxUp)     this._ctx.audioManager.setVolume('sfx',   this._ctx.audioManager.sfxVolume   + 0.1);
      if (input.musicDown) {
        this._preMuteMusicVol = Math.max(0, this._preMuteMusicVol - 0.1);
        this._ctx.audioManager.setVolume('music', this._preMuteMusicVol * 0.3);
      }
      if (input.musicUp) {
        this._preMuteMusicVol = Math.min(1, this._preMuteMusicVol + 0.1);
        this._ctx.audioManager.setVolume('music', this._preMuteMusicVol * 0.3);
      }
      this._renderPauseOverlay();
      this._renderPausePerfText();
      return;
    } else {
      if (this._pausePerfText) this._pausePerfText.visible = false;
      if (this._pauseOverlay) this._pauseOverlay.visible = false;
      if (this._pauseText)    this._pauseText.visible    = false;
      if (this._pauseHint)    this._pauseHint.visible    = false;
    }

    // --- Upgrade break phase: skip game logic, handle card UI ---
    if (this._upgradeBreak.active) {
      this._upgradeBreak.update(dt, input, this._playerState, this._trailState, this._waveState);
      if (this._upgradeBreak.upgradeChosen) {
        this._renderUpgradeCountdown(
          this._upgradeBreak.chosenUpgrade,
          this._upgradeBreak.upgradeConfirmTimer,
          this._waveState.waveIndex,
        );
      }
      // Render scene during break (same as end of main loop, minus enemies)
      this._trailRenderer.update(this._trailState);
      this._playerRenderer.update(this._playerState);
      const hudData: HudData = {
        score:              this._scoringState.score,
        newBest:            this._scoringState.newBest,
        hp:                 this._playerState.hp,
        maxHp:              this._playerState.maxHp,
        lastHitTimer:       this._playerState.lastHitTimer,
        comboLevel:         this._scoringState.comboLevel,
        drifting:           this._playerState.drifting,
        driftTime:          this._playerState.driftTime,
        speed:              getPlayerSpeed(this._playerState),
        maxSpeed:           this._playerState.maxSpeed,
        waveIndex:          this._waveState.waveIndex,
        enemyCount:         0,
        phase:              'break',
        waveTimer:          0,
        combatDuration:     this._waveState.currentCombatDuration,
        enemies:            this._enemies,
        cameraX:            this._ctx.camera.state.x,
        cameraY:            this._ctx.camera.state.y,
      };
      this._hudManager.update(hudData);
      this._eventLog.update(dt);
      this._ctx.camera.update(dilatedDt, this._playerState.x, this._playerState.y, 0, 0, 0);
      this._screenFx.applyToContainer(this._ctx.pixiApp.worldContainer);
      this._speedLines.update(
        getPlayerSpeed(this._playerState),
        this._playerState.maxSpeed,
        this._playerState.heading,
        this._gameClock,
        !this._death.active,
      );
      this._particles.update(dilatedDt);
      this._drawArenaGlow();
      return;
    }

    if (this._cdVisible) {
      this._cdVisible = false;
      this._hideUpgradeCountdown();
    }
    this._runSystems(rawDt, dilatedDt, input);
  }

  // ---------------------------------------------------------------------------
  // Per-frame system pipeline
  // ---------------------------------------------------------------------------

  private _runSystems(
    rawDt: number,
    dilatedDt: number,
    input: ReturnType<GameContext['getInput']>,
  ): void {
    this._tickPlayer(dilatedDt, input);
    this._tickAudio();
    this._tickScoring(dilatedDt);
    let enemiesChanged = this._tickWave(dilatedDt);
    this._tickScraps(dilatedDt);
    this._tickProps(dilatedDt);
    this._tickHazardZones(dilatedDt);
    enemiesChanged = this._tickEnemies(dilatedDt) || enemiesChanged;
    enemiesChanged = this._tickCombat(rawDt, dilatedDt) || enemiesChanged;
    enemiesChanged = this._tickTrail(dilatedDt) || enemiesChanged;
    if (enemiesChanged) this._enemyRenderer.sync(this._enemies);
    this._tickRenderers(dilatedDt);
  }

  private _tickPlayer(dilatedDt: number, input: ReturnType<GameContext['getInput']>): void {
    updatePlayer(this._playerState, {
      dt: dilatedDt,
      gameClock: this._gameClock,
      up:    input.up,
      down:  input.down,
      left:  input.left,
      right: input.right,
      drift: input.drift,
    });

    // Skid marks when drifting
    if (this._playerState.drifting) {
      this._particles.addSkid(
        this._playerState.x, this._playerState.y,
        0x222233, 0.5,
        this._playerState.heading,
        14,
      );
    }

    // Handbrake smoke burst on press edge. NOTE: not in original (canvas had inline smoke in physics.js).
    const isHandbraking = this._playerState.handbrakeTimer > 0;
    if (isHandbraking && !this._wasHandbraking) {
      const bx = this._playerState.x - Math.cos(this._playerState.heading) * 20;
      const by = this._playerState.y - Math.sin(this._playerState.heading) * 20;
      this._particles.spawn(bx, by, 0x888888, 8, {
        type: 'smoke',
        vxMin: -60, vxMax: 60,
        vyMin: -60, vyMax: 60,
        lifeMin: 0.4, lifeMax: 0.7,
      });
    }
    this._wasHandbraking = isHandbraking;

    // Wall-riding sparks along arena boundary (game.js parity).
    if (this._playerState.wallRiding) {
      this._particles.spawn(
        this._playerState.x,
        this._playerState.y,
        this._accentColor,
        1,
        {
          type: 'spark',
          vxMin: -20, vxMax: 20,
          vyMin: -20, vyMax: 20,
          lifeMin: 0.35, lifeMax: 0.7,
          sizeMin: 10, sizeMax: 18,
        },
      );
    }

    // Boost zone entry FX — cyan burst when player enters a speed zone. NOTE: not in original.
    const isInBoostZone = this._playerState.speedBoostTimer > 0;
    if (isInBoostZone && !this._wasInBoostZone) {
      this._particles.spawn(
        this._playerState.x, this._playerState.y,
        0x35F2D0, 8,
        {
          type: 'spark',
          vxMin: -180, vxMax: 180,
          vyMin: -180, vyMax: 180,
          lifeMin: 0.2, lifeMax: 0.3,
        },
      );
    }
    this._wasInBoostZone = isInBoostZone;
  }

  private _tickAudio(): void {
    // Per-frame engine pitch + drift squeal modulation (game.js update loop)
    const spd   = getPlayerSpeed(this._playerState);
    this._ctx.audioManager.setEngineSpeed(spd / this._playerState.maxSpeed);
    const fwdX  = Math.cos(this._playerState.heading);
    const fwdY  = Math.sin(this._playerState.heading);
    const dot   = this._playerState.vx * fwdX + this._playerState.vy * fwdY;
    const latSpd = Math.hypot(
      this._playerState.vx - fwdX * dot,
      this._playerState.vy - fwdY * dot,
    );
    const driftSlip = this._playerState.drifting ? latSpd / this._playerState.maxSpeed : 0;
    this._ctx.audioManager.setDriftIntensity(driftSlip);
  }

  private _tickScoring(dilatedDt: number): void {
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
  }

  /** Returns true if enemies array was modified. */
  private _tickWave(dilatedDt: number): boolean {
    let changed = false;
    const waveEvents = updateWave(this._waveState, dilatedDt, this._scoringState.score, this._enemies.length);
    for (const ev of waveEvents) {
      if (ev.type === 'spawn') {
        for (const req of ev.requests) {
          const rawX = this._playerState.x + Math.cos(req.angle) * req.distance;
          const rawY = this._playerState.y + Math.sin(req.angle) * req.distance;
          const x = clamp(rawX, 10, CFG.WORLD_W - 10);
          const y = clamp(rawY, 10, CFG.WORLD_H - 10);
          this._enemies.push(makeEnemyState(req.type, x, y, this._waveState.speedBonus));
          changed = true;
        }
      } else if (ev.type === 'wave_end') {
        // Clear enemies (scraps persist into break)
        for (const e of this._enemies) e.alive = false;
        this._enemies.length = 0;
        changed = true;
        this._ctx.audioManager.stopEngine();
        this._ctx.audioManager.stopDrift();
        eventBus.emit('waveEnded', { wave: this._waveState.waveIndex });
        // Enter upgrade break phase (from game.js:911-928)
        this._upgradeBreak.enter(this._playerState, this._waveState);
      } else if (ev.type === 'horde') {
        for (const req of ev.spawnRequests) {
          const rawX = this._playerState.x + Math.cos(req.angle) * req.distance;
          const rawY = this._playerState.y + Math.sin(req.angle) * req.distance;
          const x = clamp(rawX, 10, CFG.WORLD_W - 10);
          const y = clamp(rawY, 10, CFG.WORLD_H - 10);
          this._enemies.push(makeEnemyState(req.type, x, y, this._waveState.speedBonus));
          changed = true;
        }
        this._eventLog.add('HORDE! x' + ev.count, 0xFF4444);
        this._hudManager.showMilestoneBanner('HORDE! x' + ev.count, '#FF4444');
        this._screenFx.shake(5, 0.3);
      } else if (ev.type === 'break_end') {
        startWave(this._waveState);
        eventBus.emit('waveStarted', { wave: this._waveState.waveIndex });
        this._hudManager.showWaveBanner(this._waveState.waveIndex);
      }
    }
    return changed;
  }

  private _tickScraps(dilatedDt: number): void {
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

    // --- Scrap collection ---
    const trailPointsForScraps = Array.from(
      { length: this._trailState.count },
      (_, i) => getTrailPoint(this._trailState, i),
    );
    const pickupForPlayer = {
      x:           this._playerState.x,
      y:           this._playerState.y,
      radius:      getPlayerRadius(this._playerState),
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
  }

  private _tickProps(dilatedDt: number): void {
    const propHits   = checkPlayerPropCollision(this._propsState, this._playerState);
    const propEvents = handlePropCollisions(propHits, this._playerState);
    for (const ev of propEvents) {
      if (ev.type === 'solid_bounce') {
        eventBus.emit('spawnParticles', { x: ev.x, y: ev.y, type: 'shard', count: 2 });
      }
    }
    updatePropCooldowns(this._propsState, dilatedDt);
    if (checkNearMissProp(this._propsState, this._playerState)) {
      const hmResult = processHazardNearMiss(this._playerState, this._scoringState.score);
      this._scoringState.score      = hmResult.score;
      this._scoringState.comboLevel = hmResult.comboLevel;
      this._playerState.comboLevel  = hmResult.comboLevel;
      eventBus.emit('nearMiss', { x: this._playerState.x, y: this._playerState.y });
    }
  }

  /** Updates and applies damage/slow effects from bomb/hazard zones. */
  private _tickHazardZones(dilatedDt: number): void {
    const zones = this._waveState.hazardZones;
    for (let i = zones.length - 1; i >= 0; i--) {
      zones[i].life -= dilatedDt;
      zones[i].phase += dilatedDt;
      if (zones[i].life <= 0) {
        zones[i] = zones[zones.length - 1];
        zones.pop();
        continue;
      }
      const dx = this._playerState.x - zones[i].x;
      const dy = this._playerState.y - zones[i].y;
      const dist = Math.hypot(dx, dy);
      if (dist < zones[i].radius) {
        // Only apply damage when invuln and ghost frames are expired (game.js:2056-2057)
        if (this._playerState.invulnTimer <= 0 && this._playerState.ghostFrameTimer <= 0) {
          const dmg = CFG.BOMB_ZONE_DMG * dilatedDt * (1 - this._playerState.damageResist);
          this._playerState.hp = Math.max(0, this._playerState.hp - dmg);
          this._playerState.lastHitTimer = 0;
          if (this._playerState.hp <= 0 && !this._death.active) {
            this._death.trigger();
          }
        }
        this._playerState.slowTimer = Math.max(this._playerState.slowTimer ?? 0, 0.1);
        this._playerState.slowStrength = CFG.BOMB_ZONE_SLOW;
      }
    }
  }

  /** Returns true if enemies array was modified. */
  private _tickEnemies(dilatedDt: number): boolean {
    let changed = false;
    const trailPts = Array.from(
      { length: this._trailState.count },
      (_, i) => getTrailPoint(this._trailState, i),
    );

    for (let i = this._enemies.length - 1; i >= 0; i--) {
      const enemy = this._enemies[i];
      const result = updateEnemy(
        enemy,
        this._playerState,
        dilatedDt,
        this._gameClock,
        this._ctx.camera.isVisible,
        trailPts,
      );

      // Check for bomb drop and spawn hazard zone
      if (enemy._dropBomb) {
        enemy._dropBomb = false;
        this._waveState.hazardZones.push({
          x: enemy.x,
          y: enemy.y,
          life: CFG.BOMB_ZONE_DURATION,
          radius: CFG.BOMB_ZONE_RADIUS,
          phase: 0,
        });
      }
      checkEnemyPropCollision(this._propsState, enemy);
      if (result.despawned) {
        // swap-and-pop
        this._enemies[i] = this._enemies[this._enemies.length - 1];
        this._enemies.pop();
        changed = true;
      }
    }
    return changed;
  }

  /** Returns true if any enemies were removed (collision kill or near-miss scrap). */
  private _tickCombat(rawDt: number, dilatedDt: number): boolean {
    let changed = false;

    // --- Near-miss + collision (before trail update so encirclement doesn't remove enemies first) ---
    for (let i = this._enemies.length - 1; i >= 0; i--) {
      const enemy = this._enemies[i];
      if (!enemy.alive) continue;

      if (checkNearMiss(this._playerState, enemy)) {
        const oldCombo = this._scoringState.comboLevel;
        const nmResult = processNearMiss(this._playerState, enemy, this._scoringState.score);
        this._scoringState.score      = nmResult.score;
        this._scoringState.comboLevel = nmResult.comboLevel;
        this._playerState.comboLevel  = nmResult.comboLevel;
        updateRunStats(this._scoringState.runStats, { type: 'near_miss', comboLevel: nmResult.comboLevel });
        // Combo heal at milestones 3/5/8 (intentional: also fires from near-miss like original)
        this._playerState.hp = applyComboHeal(
          oldCombo, nmResult.comboLevel,
          this._playerState.comboHeal,
          this._playerState.hp, this._playerState.maxHp,
        );
        this._checkComboMilestone(oldCombo, nmResult.comboLevel);
        // Near-miss scrap spawn: 35% chance (matches original game.js)
        if (Math.random() < CFG.SCRAP_NEAR_MISS_CHANCE) {
          this._waveState.scraps.push({ x: enemy.x, y: enemy.y, life: 15, type: 'scrap' });
        }
        eventBus.emit('nearMiss', { x: enemy.x, y: enemy.y });
      }

      if (checkPlayerEnemyCollision(this._playerState, enemy)) {
        const dmgResult = processPlayerHit(this._playerState, enemy, this._waveState.waveIndex);
        if (dmgResult.type === 'hit') {
          eventBus.emit('playerDamaged', {
            amount: dmgResult.finalDamage,
            x: this._playerState.x,
            y: this._playerState.y,
          });
        }
        if (this._playerState.hp <= 0 && !this._death.active) {
          this._death.trigger();
        }
        changed = true;
      }
    }

    // Per-frame player timers
    updateNearMissStreak(this._playerState, dilatedDt);
    applyHpRegen(this._playerState, dilatedDt);

    return changed;
  }

  /** Returns true if any enemies were killed (encircle or trail burn). */
  private _tickTrail(dilatedDt: number): boolean {
    let changed = false;
    const loopResult = updateTrail(this._trailState, this._playerState, this._enemies, dilatedDt);

    if (loopResult !== null) {
      const killCount = loopResult.killedEnemies.length;
      if (killCount > 0) {
        const oldCombo       = this._scoringState.comboLevel;
        const encircleResult = computeEncircleOutcome(
          killCount,
          this._scoringState.comboLevel,
          this._playerState.scoreMult,
          this._playerState.encircleScoreBonus,
        );
        addScore(this._scoringState, encircleResult.scoreDelta);
        this._scoringState.comboLevel = encircleResult.comboLevel;
        this._playerState.comboLevel  = encircleResult.comboLevel;
        updateRunStats(this._scoringState.runStats, { type: 'encircle', killCount, comboLevel: encircleResult.comboLevel });
        // Combo heal at milestones (intentional improvement: also fires from encirclement)
        this._playerState.hp = applyComboHeal(
          oldCombo, encircleResult.comboLevel,
          this._playerState.comboHeal,
          this._playerState.hp, this._playerState.maxHp,
        );
        eventBus.emit('scoreChanged', { score: this._scoringState.score, delta: encircleResult.scoreDelta });
        this._checkComboMilestone(oldCombo, encircleResult.comboLevel);

        // Chain Lightning: chain from each encirclement kill to nearest surviving enemy (world.js:397-424)
        if (this._playerState.chainLightning) {
          const { chains, scoreGained } = applyChainLightning(
            loopResult.killedEnemies as EnemyState[],
            this._enemies,
            this._playerState.scoreMult,
          );
          if (scoreGained > 0) addScore(this._scoringState, scoreGained);
          for (const c of chains) {
            eventBus.emit('spawnParticles', { x: c.midX, y: c.midY, type: 'spark', count: 6, color: 0x88CCFF });
          }
        }
      }

      eventBus.emit('encirclement', {
        count: loopResult.encircleCount,
        x:     loopResult.polygon[0].x,
        y:     loopResult.polygon[0].y,
      });

      for (const dead of loopResult.killedEnemies) {
        const deathEvent: EnemyDeathEvent = {
          type:    (dead as EnemyState).type,
          x:       dead.x,
          y:       dead.y,
          isElite: false,
        };
        eventBus.emit('enemyKilled', {
          x: dead.x, y: dead.y,
          type: (dead as EnemyState).type,
          isElite: deathEvent.isElite,
        });
        changed = true;
      }

      // Remove dead enemies from array (swap-and-pop)
      for (let i = this._enemies.length - 1; i >= 0; i--) {
        if (!this._enemies[i].alive) {
          this._enemies[i] = this._enemies[this._enemies.length - 1];
          this._enemies.pop();
        }
      }
    }

    // Trail Burn: enemies touching the trail take damage (game.js:717-743)
    const burnResults = applyTrailBurn(this._playerState, this._enemies, this._trailState, dilatedDt);
    for (const r of burnResults) {
      if (r.enemyDied) {
        addScore(this._scoringState, 50 * this._playerState.scoreMult);
        eventBus.emit('eventLog', { text: 'BURN!', color: '#FF6600' });
      }
      eventBus.emit('spawnParticles', { x: r.ex, y: r.ey, type: 'spark', count: 4, color: 0xFF6600 });
      if (r.enemyDied) changed = true;
    }

    // Sweep dead enemies from trail burn (swap-and-pop)
    if (burnResults.some(r => r.enemyDied)) {
      for (let i = this._enemies.length - 1; i >= 0; i--) {
        if (!this._enemies[i].alive) {
          this._enemies[i] = this._enemies[this._enemies.length - 1];
          this._enemies.pop();
        }
      }
    }

    return changed;
  }

  private _tickRenderers(dilatedDt: number): void {
    this._enemyRenderer.update(this._enemies);
    this._pickupRenderer.update(this._waveState.scraps, this._waveState.hazardZones);
    this._trailRenderer.update(this._trailState);
    this._playerRenderer.update(this._playerState);

    // --- HUD ---
    const hudData: HudData = {
      score:             this._scoringState.score,
      newBest:           this._scoringState.newBest,
      hp:                this._playerState.hp,
      maxHp:             this._playerState.maxHp,
      lastHitTimer:      this._playerState.lastHitTimer,
      comboLevel:        this._scoringState.comboLevel,
      drifting:          this._playerState.drifting,
      driftTime:         this._playerState.driftTime,
      speed:             getPlayerSpeed(this._playerState),
      maxSpeed:          this._playerState.maxSpeed,
      waveIndex:         this._waveState.waveIndex,
      enemyCount:        this._enemies.length,
      phase:             this._waveState.phase,
      waveTimer:         this._waveState.waveTimer,
      combatDuration:    this._waveState.currentCombatDuration,
      enemies:           this._enemies,
      cameraX:           this._ctx.camera.state.x,
      cameraY:           this._ctx.camera.state.y,
    };
    this._hudManager.update(hudData);
    // Keep EventLog Y in sync with score panel height
    const logPanelY = (hudData.newBest ? S(56) : S(42)) + S(12) + S(20) + S(8);
    this._eventLog.setPanelY(logPanelY);
    this._eventLog.update(dilatedDt);

    this._ctx.camera.update(
      dilatedDt,
      this._playerState.x,
      this._playerState.y,
      this._playerState.vx,
      this._playerState.vy,
      getPlayerSpeed(this._playerState),
    );
    this._screenFx.applyToContainer(this._ctx.pixiApp.worldContainer);
    this._speedLines.update(
      getPlayerSpeed(this._playerState),
      this._playerState.maxSpeed,
      this._playerState.heading,
      this._gameClock,
      !this._death.active,
    );
    this._screenFx.setAberration(
      getPlayerSpeed(this._playerState) / (this._playerState.maxSpeed || CFG.MAX_SPEED),
      this._playerState.hp <= 0,
    );
    this._particles.update(dilatedDt);
    this._drawArenaGlow();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Pause overlay (game.js:1399-1407) */
  private _renderPauseOverlay(): void {
    if (!this._pauseOverlay) {
      this._pauseOverlay = new Graphics();
      this._ctx.pixiApp.hudLayer.addChild(this._pauseOverlay);
    }
    if (!this._pauseText) {
      this._pauseText = new Text({
        text: 'PAUSED',
        style: new TextStyle({
          fontFamily: 'Courier New, monospace',
          fontSize: S(40),
          fontWeight: 'bold',
          fill: '#EAEFF7',
          dropShadow: { color: '#000', blur: 2, distance: 1 },
        }),
      });
      this._pauseText.anchor.set(0.5, 0.5);
      this._pauseText.position.set(CFG.W / 2, CFG.H / 2 - S(60));
      this._ctx.pixiApp.hudLayer.addChild(this._pauseText);
    }
    if (!this._pauseHint) {
      this._pauseHint = new Text({
        text: '',
        style: new TextStyle({ fontFamily: 'Courier New, monospace', fontSize: S(14), fill: '#888888' }),
      });
      this._pauseHint.anchor.set(0.5, 0.5);
      this._pauseHint.position.set(CFG.W / 2, CFG.H / 2 - S(20));
      this._ctx.pixiApp.hudLayer.addChild(this._pauseHint);
    }
    const sfxPct = Math.round(this._ctx.audioManager.sfxVolume   * 100);
    const musPct = Math.round(this._preMuteMusicVol               * 100);
    const muteStr = this._ctx.audioManager.muted ? ' (MUTED)' : '';
    this._pauseHint.text    = `P / Esc resume  |  M mute${muteStr}  |  [ ] SFX ${sfxPct}%  |  - = Music ${musPct}%`;
    this._pauseHint.visible = true;

    this._pauseOverlay.clear();
    this._pauseOverlay.rect(0, 0, CFG.W, CFG.H).fill({ color: 0x000000, alpha: 0.6 });
  }

  /** Trigger combo milestone FX + audio when combo crosses 3, 5, or 8. (game.js:1032-1051) */
  private _checkComboMilestone(oldLevel: number, newLevel: number): void {
    const milestones = [3, 5, 8];
    for (const m of milestones) {
      if (Math.floor(oldLevel) < m && Math.floor(newLevel) >= m) {
        this._ctx.audioManager.play('combo_sting');
        this._screenFx.flash(0x35F2D0, 0.12, 0.1);
        this._screenFx.zoom(1.05, 0.15);
        const color = m >= 8 ? 0xFFD700 : m >= 5 ? 0x7C5CFF : 0x35F2D0;
        this._particles.addRing(this._playerState.x, this._playerState.y, color);
        const label = m >= 8 ? '#FFD700' : m >= 5 ? '#7C5CFF' : '#35F2D0';
        eventBus.emit('eventLog', { text: `x${m} COMBO!`, color: label });
        this._hudManager.showMilestoneBanner(`x${m} COMBO!`, label);
        break;
      }
    }
  }

  private _drawArenaGlow(): void {
    const pulse     = Math.sin(this._gameClock * 2);
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

  private _transitionToGameOver(): void {
    if (this._scoringState.score > this._scoringState.highScore) {
      saveManager.setHighScore(Math.floor(this._scoringState.score));
    }
    const modMult = computeModifierScoreMult(this._opts.modifierIds ?? []);
    const data: GameOverData = {
      score:           this._scoringState.score,
      highScore:       Math.max(this._scoringState.highScore, this._scoringState.score),
      newBest:         this._scoringState.newBest,
      waveReached:     this._waveState.waveIndex,
      runStats:        this._scoringState.runStats,
      modifierMult:    modMult,
      lastMapId:       this._opts.mapId ?? saveManager.getSelectedMap(),
      lastModifierIds: this._opts.modifierIds?.slice() ?? [],
      sandbox:         this._opts.sandbox ?? false,
    };
    sceneManager.switchTo(new GameOverScene(data));
  }

  private _renderPausePerfText(): void {
    if (!this._pausePerfText) {
      this._pausePerfText = new Text({
        text: '',
        style: new TextStyle({
          fontFamily: 'Courier New, monospace',
          fontSize: S(11),
          fill: '#888888',
        }),
      });
      this._pausePerfText.anchor.set(0.5, 0);
      this._ctx.pixiApp.hudLayer.addChild(this._pausePerfText);
    }
    this._pausePerfText.visible = true;
    this._pausePerfText.text = `[F3] Perf overlay: ${this._perf.enabled ? 'ON' : 'OFF'}`;
    (this._pausePerfText.style as TextStyle).fill = this._perf.enabled ? '#00ff88' : '#666666';
    this._pausePerfText.position.set(CFG.W / 2, CFG.H / 2 + S(50));
  }

  private _renderUpgradeCountdown(
    upgrade: { icon: string; name: string } | null,
    timer: number,
    waveIndex: number,
  ): void {
    const layer = this._ctx.pixiApp.overlayLayer;

    // Create once if null; re-add to layer if UpgradeCardsUI.hide() removed it via removeChildren().
    if (!this._cdBg) {
      this._cdBg = new Graphics();
    }
    if (!this._cdBg.parent) layer.addChild(this._cdBg);

    if (!this._cdIcon) {
      this._cdIcon = new Text({ text: '', style: new TextStyle({ fontFamily: 'Courier New, monospace', fontSize: S(48), fontWeight: 'bold', fill: CFG.C_ACCENT, dropShadow: { color: '#000', blur: 2, distance: 1 } }) });
      this._cdIcon.anchor.set(0.5, 0.5);
      this._cdIcon.position.set(CFG.W / 2, CFG.H / 2 - S(60));
    }
    if (!this._cdIcon.parent) layer.addChild(this._cdIcon);

    if (!this._cdName) {
      this._cdName = new Text({ text: '', style: new TextStyle({ fontFamily: 'Courier New, monospace', fontSize: S(22), fontWeight: 'bold', fill: CFG.C_TEXT, dropShadow: { color: '#000', blur: 2, distance: 1 } }) });
      this._cdName.anchor.set(0.5, 0.5);
      this._cdName.position.set(CFG.W / 2, CFG.H / 2 - S(15));
    }
    if (!this._cdName.parent) layer.addChild(this._cdName);

    if (!this._cdNum) {
      this._cdNum = new Text({ text: '', style: new TextStyle({ fontFamily: 'Courier New, monospace', fontSize: S(48), fontWeight: 'bold', fill: CFG.C_ACCENT, dropShadow: { color: '#000', blur: 2, distance: 1 } }) });
      this._cdNum.anchor.set(0.5, 0.5);
      this._cdNum.position.set(CFG.W / 2, CFG.H / 2 + S(40));
    }
    if (!this._cdNum.parent) layer.addChild(this._cdNum);

    if (!this._cdWave) {
      this._cdWave = new Text({ text: '', style: new TextStyle({ fontFamily: 'Courier New, monospace', fontSize: S(16), fill: '#888888', dropShadow: { color: '#000', blur: 2, distance: 1 } }) });
      this._cdWave.anchor.set(0.5, 0.5);
      this._cdWave.position.set(CFG.W / 2, CFG.H / 2 + S(80));
    }
    if (!this._cdWave.parent) layer.addChild(this._cdWave);

    this._cdBg.clear();
    this._cdBg.rect(0, 0, CFG.W, CFG.H).fill({ color: 0x000000, alpha: 0.7 });
    this._cdBg.alpha   = 1;
    this._cdBg.visible = true;
    if (upgrade) {
      this._cdIcon.text = upgrade.icon;
      this._cdName.text = upgrade.name;
    }
    this._cdNum.text  = `${Math.ceil(Math.max(0, timer))}`;
    this._cdWave.text = `Wave ${waveIndex + 1} incoming...`;
    this._cdIcon.alpha   = 1; this._cdIcon.visible   = true;
    this._cdName.alpha   = 1; this._cdName.visible   = true;
    this._cdNum.alpha    = 1; this._cdNum.visible    = true;
    this._cdWave.alpha   = 1; this._cdWave.visible   = true;
    this._cdVisible = true;
  }

  private _hideUpgradeCountdown(): void {
    if (!this._cdBg) return;
    this._cdBg.visible   = false;
    if (this._cdIcon)  this._cdIcon.visible  = false;
    if (this._cdName)  this._cdName.visible  = false;
    if (this._cdNum)   this._cdNum.visible   = false;
    if (this._cdWave)  this._cdWave.visible  = false;
  }

  private _setupBenchmark(scenario: string): void {
    const BENCH_DEFS: Record<string, { enemyCount: number; drift: boolean }> = {
      idle_5:   { enemyCount: 5,  drift: false },
      idle_15:  { enemyCount: 15, drift: false },
      idle_30:  { enemyCount: 30, drift: false },
      drift_5:  { enemyCount: 5,  drift: true  },
      drift_15: { enemyCount: 15, drift: true  },
      drift_30: { enemyCount: 30, drift: true  },
    };
    const def = BENCH_DEFS[scenario];
    if (!def) return;

    this._bench = { scenario, drift: def.drift, phase: 'warmup', timer: 0, frames: [] };

    this._playerState.x = CFG.WORLD_W / 2;
    this._playerState.y = CFG.WORLD_H / 2;
    // Match vanilla bench behavior: make run non-lethal so every scenario reports.
    this._playerState.maxHp = 999999;
    this._playerState.hp = 999999;
    this._playerState.vx = def.drift ? 200 : 0;
    this._playerState.vy = 0;
    this._playerState.heading = 0;

    this._enemies.length = 0;
    const n = def.enemyCount;
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2;
      const r = 500;
      this._enemies.push(
        makeEnemyState('chaser',
          CFG.WORLD_W / 2 + Math.cos(angle) * r,
          CFG.WORLD_H / 2 + Math.sin(angle) * r,
          0
        )
      );
    }
    this._enemyRenderer.sync(this._enemies);
    this._ctx.camera.reset(this._playerState.x, this._playerState.y);
  }

  private _tickBench(rawDtMs: number): void {
    const b = this._bench!;
    if (b.phase === 'done') return;

    inputManager.overrideState = b.drift
      ? { ...EMPTY_INPUT, up: true, left: true, drift: true }
      : EMPTY_INPUT;

    b.timer += rawDtMs / 1000;

    if (b.phase === 'warmup') {
      if (b.timer >= 3) {
        b.phase = 'collect';
        b.timer = 0;
        b.frames = [];
      }
    } else if (b.phase === 'collect') {
      b.frames.push(rawDtMs);
      if (b.timer >= 10) {
        b.phase = 'done';
        inputManager.overrideState = null;
        this._finishBench();
      }
    }
  }

  private _finishBench(): void {
    const frames = this._bench!.frames;
    const sorted = [...frames].sort((a, b) => a - b);
    const n = sorted.length;
    const avg = frames.reduce((s, t) => s + t, 0) / n;
    window.parent.postMessage(
      {
        type: 'bench_result',
        build: 'Port',
        scenario: this._bench!.scenario,
        avgFps: 1000 / avg,
        p50: sorted[Math.floor(n * 0.50)],
        p95: sorted[Math.floor(n * 0.95)],
        p99: sorted[Math.floor(n * 0.99)],
        worstMs: sorted[n - 1],
      },
      '*'
    );
  }

  destroy(): void {
    inputManager.overrideState = null;
    this._cdBg?.destroy();
    this._cdIcon?.destroy();
    this._cdName?.destroy();
    this._cdNum?.destroy();
    this._cdWave?.destroy();
    this._perf.destroy();
    this._pausePerfText?.destroy();
    this._ctx.audioManager.stopAll();
    this._playerRenderer.destroy();
    this._trailRenderer.destroy();
    this._propsRenderer.destroy();
    this._enemyRenderer.destroy();
    this._pickupRenderer.destroy();
    this._upgradeBreak.destroy();
    this._death.destroy();
    this._hudManager.destroy();
    this._eventLog.destroy();
    this._screenFx.destroy();
    this._speedLines.destroy();
    this._particles.destroy();
    for (const remove of this._evListeners) remove();
    this._evListeners = [];

    const { backgroundLayer, playerLayer, trailLayer, propsLayer, enemiesLayer } = this._ctx.pixiApp;
    backgroundLayer.removeChildren();
    playerLayer.removeChildren();
    trailLayer.removeChildren();
    propsLayer.removeChildren();
    enemiesLayer.removeChildren();
  }
}
