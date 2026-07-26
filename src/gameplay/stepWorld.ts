// stepWorld.ts — Durable, renderer-free per-frame game tick shared by the live game and the sim.
//
// This is the single source of truth for the per-frame *logic* pipeline. GameLoop builds a
// WorldState view over its own state fields + a WorldEffects adapter wired to Pixi/audio, then
// delegates each frame to stepWorld(); the sim harness passes the same WorldState with a no-op
// WorldEffects (seeded rng, viewport-AABB isVisible). Because both paths run this one function,
// the sim can never drift from shipped logic.
//
// Rules:
//   - No Pixi, no DOM, no globals here. Every render/audio/FX side-effect goes through `fx`.
//   - eventBus.emit(...) stays inline — the bus is headless-safe and is the sim's observation channel.
//   - Every former `Math.random()` in the tick is routed through `fx.rng()` for seed determinism.
// NOTE: not in original — extraction of GameLoop._runSystems / _tick* (Phase 4.9 sim harness).

import { CFG } from '@core/config';
import { clamp } from '@core/utils';
import { eventBus } from '@core/eventBus';
import {
  getPlayerRadius,
  getEffectiveScoreMult,
  type PlayerState,
} from '@gameplay/player/playerState';
import { updatePlayer } from '@gameplay/player/playerUpdate';
import { getTrailPoint, type TrailState } from '@gameplay/trail/trailState';
import { updateTrail } from '@gameplay/trail/trailUpdate';
import {
  checkPlayerCollision as checkPlayerPropCollision,
  handlePropCollisions,
  checkEnemyPropCollision,
  updatePropCooldowns,
  checkNearMissProp,
  type PropsState,
} from '@gameplay/world/propsSystem';
import { clearBossArena, spawnBossArena } from '@gameplay/world/bossArena';
import type { BiomeManager } from '@gameplay/world/biomeManager';
import { RunProgression, accrueScrap } from '@gameplay/world/runProgression';
import type { BiomeHazardState } from '@gameplay/world/biomeHazards';
import { makeEnemyState, makeBoss, type EnemyState } from '@gameplay/enemies/enemyState';
import { updateEnemy } from '@gameplay/enemies/enemyUpdate';
import { checkPlayerEnemyCollision, checkNearMiss } from '@gameplay/combat/collision';
import { processPlayerHit } from '@gameplay/combat/damage';
import { processNearMiss, processHazardNearMiss } from '@gameplay/combat/nearMiss';
import { applyTrailBurn } from '@gameplay/combat/trailBurn';
import { applyChainLightning } from '@gameplay/combat/chainLightning';
import {
  updateNearMissStreak,
  applyHpRegen,
  updateScraps,
  updateBoostZones,
  selectPickupType,
  computeEncircleOutcome,
  applyComboHeal,
  updateRunStats,
  applyHazardZoneDamage,
  type TrailPoint,
  type PlayerForPickup,
} from '@gameplay/pureLogic';
import { addScore, updateScoring, type ScoringState } from '@gameplay/scoring';
import {
  startWave,
  updateWave,
  tickScrapSpawn,
  tickBoostZoneSpawn,
  type WaveState,
} from '@gameplay/spawning/waveManager';

/** The subset of input the per-frame logic pipeline reads. */
export interface FrameInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  drift: boolean;
}

/** Optional particle-spawn parameters (mirrors ParticleSystem.spawn opts). */
export interface SpawnOpts {
  type?: string;
  vxMin?: number; vxMax?: number;
  vyMin?: number; vyMax?: number;
  lifeMin?: number; lifeMax?: number;
  sizeMin?: number; sizeMax?: number;
}

/**
 * Every render/audio/FX/transition side-effect the tick produces. GameLoop implements this with
 * Pixi + audio + sub-managers; the sim implements it as no-ops (plus a seeded rng and a viewport stub).
 */
export interface WorldEffects {
  /** Deterministic [0,1) source. GameLoop -> Math.random; sim -> seeded LCG. */
  rng(): number;
  /** Viewport visibility test (camera.isVisible). Sim supplies an AABB stub around the player. */
  isVisible(x: number, y: number, pad?: number): boolean;

  // Particles
  spawn(x: number, y: number, color: number, count: number, opts?: SpawnOpts): void;
  addSkid(x: number, y: number, color: number, alpha: number, heading: number, size: number): void;
  addRing(x: number, y: number, color: number): void;

  // Screen FX
  flash(color: number, alpha: number, dur: number): void;
  shake(mag: number, dur: number): void;
  slowmo(scale: number, dur: number): void;
  zoom(scale: number, dur: number): void;

  // Audio
  play(id: string): void;
  stopEngine(): void;
  stopDrift(): void;
  setEngineSpeed(v: number): void;
  setDriftIntensity(v: number): void;

  // HUD / camera / props renderer
  showMilestoneBanner(text: string, color: string): void;
  showWaveBanner(wave: number): void;
  eventLogAdd(text: string, color: number): void;
  setHeadingMode(on: boolean): void;
  setProps(props: PropsState['allProps']): void;

  // Death handle (no DeathSequence ref here)
  isDeathActive(): boolean;
  triggerDeath(): void;

  // Higher-level transition hooks (FX-heavy / stateful in GameLoop)
  enterUpgradeBreak(player: PlayerState, wave: WaveState, bossKilled: boolean): void;
  applyBiomeTransition(startedWave: number): void;
  tickBiomeHazards(dt: number, player: PlayerState): void;

  // Combo milestone fanfare (audio + flash + ring + banner)
  comboMilestone(oldLevel: number, newLevel: number, player: PlayerState): void;

  // Dev hooks (GameLoop wires to situationTester behind import.meta.env.DEV; sim returns null/false)
  forcedPickupType(): string | null;
  consumeBossKilled(): boolean;
}

/** Plain-data view over the game state the tick mutates. Object fields are shared references. */
export interface WorldState {
  playerState: PlayerState;
  enemies: EnemyState[];
  trailState: TrailState;
  propsState: PropsState;
  waveState: WaveState;
  scoringState: ScoringState;
  biomeHazardState: BiomeHazardState;
  biomeManager: BiomeManager;
  runProgression: RunProgression;
  /** Advanced by the caller before each step (used for enemy timing / FX). */
  gameClock: number;
  /** Fractional scrap carry for Jungle rewardMult — mutated here, read back by caller. */
  scrapCarry: number;
  // Edge-detection flags for one-shot FX (FX-only; live on state so both callers share them).
  wasHandbraking: boolean;
  wasInBoostZone: boolean;
  // Reusable scratch buffers (avoid per-frame allocation on hot paths).
  trailScratch: TrailPoint[];
  pickupPlayerScratch: PlayerForPickup;
}

export interface StepResult {
  /** True if the enemies array changed this frame (caller re-syncs its enemy renderer). */
  enemiesChanged: boolean;
}

// ── Main pipeline ─────────────────────────────────────────────────────────────
// Mirrors GameLoop._runSystems exactly. Renderers stay in the caller (not here).
export function stepWorld(
  w: WorldState,
  fx: WorldEffects,
  input: FrameInput,
  rawDt: number,
  dilatedDt: number,
): StepResult {
  tickPlayer(w, fx, input, dilatedDt);
  tickAudio(w, fx);
  tickScoring(w, fx, rawDt, dilatedDt);
  let enemiesChanged = tickWave(w, fx, dilatedDt);
  tickScraps(w, fx, dilatedDt);
  tickProps(w, fx, dilatedDt);
  tickHazardZones(w, fx, dilatedDt);
  fx.tickBiomeHazards(dilatedDt, w.playerState);
  enemiesChanged = tickEnemies(w, fx, dilatedDt) || enemiesChanged;
  enemiesChanged = tickCombat(w, fx, dilatedDt) || enemiesChanged;
  enemiesChanged = tickTrail(w, fx, dilatedDt) || enemiesChanged;
  return { enemiesChanged };
}

// ── Player ────────────────────────────────────────────────────────────────────
function tickPlayer(w: WorldState, fx: WorldEffects, input: FrameInput, dt: number): void {
  const p = w.playerState;
  updatePlayer(p, {
    dt,
    gameClock: w.gameClock,
    up: input.up,
    down: input.down,
    left: input.left,
    right: input.right,
    drift: input.drift,
  });

  // Skid marks when drifting
  if (p.drifting) {
    fx.addSkid(p.x, p.y, 0x222233, 0.5, p.heading, 14);
  }

  // Handbrake smoke burst on press edge. NOTE: not in original.
  const isHandbraking = p.handbrakeTimer > 0;
  if (isHandbraking && !w.wasHandbraking) {
    const bx = p.x - Math.cos(p.heading) * 20;
    const by = p.y - Math.sin(p.heading) * 20;
    fx.spawn(bx, by, 0x888888, 8, {
      type: 'smoke',
      vxMin: -60, vxMax: 60,
      vyMin: -60, vyMax: 60,
      lifeMin: 0.4, lifeMax: 0.7,
    });
  }
  w.wasHandbraking = isHandbraking;

  // Wall-riding sparks along arena boundary (game.js parity).
  if (p.wallRiding) {
    fx.spawn(p.x, p.y, 0x35F2D0, 1, {
      type: 'spark',
      vxMin: -20, vxMax: 20,
      vyMin: -20, vyMax: 20,
      lifeMin: 0.35, lifeMax: 0.7,
      sizeMin: 10, sizeMax: 18,
    });
  }

  // Boost zone entry FX — cyan burst when player enters a speed zone. NOTE: not in original.
  const isInBoostZone = p.speedBoostTimer > 0;
  if (isInBoostZone && !w.wasInBoostZone) {
    fx.spawn(p.x, p.y, 0x35F2D0, 8, {
      type: 'spark',
      vxMin: -180, vxMax: 180,
      vyMin: -180, vyMax: 180,
      lifeMin: 0.2, lifeMax: 0.3,
    });
  }
  w.wasInBoostZone = isInBoostZone;
}

// ── Audio ─────────────────────────────────────────────────────────────────────
function tickAudio(w: WorldState, fx: WorldEffects): void {
  const p = w.playerState;
  const spd = Math.hypot(p.vx, p.vy);
  fx.setEngineSpeed(spd / p.maxSpeed);
  const fwdX = Math.cos(p.heading);
  const fwdY = Math.sin(p.heading);
  const dot = p.vx * fwdX + p.vy * fwdY;
  const latSpd = Math.hypot(p.vx - fwdX * dot, p.vy - fwdY * dot);
  const driftSlip = p.drifting ? latSpd / p.maxSpeed : 0;
  fx.setDriftIntensity(driftSlip);
}

// ── Scoring (with the Phase 4.9 drift-exploit engagement gate) ──────────────────
function tickScoring(w: WorldState, _fx: WorldEffects, rawDt: number, dilatedDt: number): void {
  const p = w.playerState;
  const s = w.scoringState;
  // Score-surge timer drains in real time (rawDt) so time_slow doesn't extend the buff.
  if (p.scoreMultBoostTimer > 0) {
    p.scoreMultBoostTimer = Math.max(0, p.scoreMultBoostTimer - rawDt);
  }
  const effectiveScoreMult = getEffectiveScoreMult(p);
  s.comboLevel = p.comboLevel;
  // Drift exploit gate: combo only grows when an enemy is nearby OR a kill/near-miss just happened.
  const px = p.x, py = p.y;
  const enemyNear = w.enemies.some(e => {
    const dx = e.x - px, dy = e.y - py;
    return dx * dx + dy * dy < CFG.DRIFT_COMBO_ENGAGE_R * CFG.DRIFT_COMBO_ENGAGE_R;
  });
  const recentEngagement = s.lastEngagementTimer < CFG.DRIFT_COMBO_ENGAGE_T;
  updateScoring(
    s,
    p.drifting,
    p.driftTime,
    effectiveScoreMult,
    p.comboMaster,
    dilatedDt,
    enemyNear || recentEngagement,
  );
  p.comboLevel = s.comboLevel;
}

// ── Waves ───────────────────────────────────────────────────────────────────────
function tickWave(w: WorldState, fx: WorldEffects, dt: number): boolean {
  let changed = false;
  const bossAlive = w.enemies.some(e => e.type === 'boss');
  const waveEvents = updateWave(
    w.waveState, dt, w.scoringState.score, w.enemies.length,
    bossAlive,
    w.biomeManager.effectiveWeightMult,
    fx.rng,
  );
  for (const ev of waveEvents) {
    if (ev.type === 'spawn') {
      for (const req of ev.requests) {
        const x = clamp(w.playerState.x + Math.cos(req.angle) * req.distance, 10, CFG.WORLD_W - 10);
        const y = clamp(w.playerState.y + Math.sin(req.angle) * req.distance, 10, CFG.WORLD_H - 10);
        w.enemies.push(makeEnemyState(req.type, x, y, w.waveState.speedBonus, fx.rng));
        changed = true;
      }
    } else if (ev.type === 'wave_end') {
      for (const e of w.enemies) e.alive = false;
      w.enemies.length = 0;
      clearBossArena(w.propsState);
      fx.setProps(w.propsState.allProps);
      changed = true;
      fx.setHeadingMode(false);
      fx.stopEngine();
      fx.stopDrift();
      eventBus.emit('waveEnded', { wave: w.waveState.waveIndex });
      const bossKilled = (ev.bossKilled ?? false) || fx.consumeBossKilled();
      if (bossKilled) {
        fx.flash(0xFFCC00, 0.6, 0.9);
        fx.shake(6, 0.4);
        fx.showMilestoneBanner('BOSS DEFEATED!', '#FFCC00');
        eventBus.emit('eventLog', { text: 'BOSS DEFEATED! +REROLL', color: '#ffcc00' });
      }
      fx.enterUpgradeBreak(w.playerState, w.waveState, bossKilled);
    } else if (ev.type === 'horde') {
      for (const req of ev.spawnRequests) {
        const x = clamp(w.playerState.x + Math.cos(req.angle) * req.distance, 10, CFG.WORLD_W - 10);
        const y = clamp(w.playerState.y + Math.sin(req.angle) * req.distance, 10, CFG.WORLD_H - 10);
        w.enemies.push(makeEnemyState(req.type, x, y, w.waveState.speedBonus, fx.rng));
        changed = true;
      }
      fx.eventLogAdd('HORDE' + '!'.repeat(ev.count), 0xFF4444);
      fx.showMilestoneBanner('HORDE' + '!'.repeat(ev.count), '#FF4444');
      fx.shake(5, 0.3);
      fx.setHeadingMode(true);
    } else if (ev.type === 'boss_spawn') {
      const bossAngle = fx.rng() * Math.PI * 2;
      const bossDist = CFG.BOSS_SPAWN_DIST_MIN + fx.rng() * CFG.BOSS_SPAWN_DIST_RANGE;
      const bossPad = CFG.BOSS_RADIUS;
      const bossX = clamp(w.playerState.x + Math.cos(bossAngle) * bossDist, bossPad, CFG.WORLD_W - bossPad);
      const bossY = clamp(w.playerState.y + Math.sin(bossAngle) * bossDist, bossPad, CFG.WORLD_H - bossPad);
      const boss = makeBoss(ev.pattern, bossX, bossY, w.waveState.waveIndex, fx.rng);
      w.enemies.push(boss);
      spawnBossArena(w.propsState, ev.pattern);
      fx.setProps(w.propsState.allProps);
      changed = true;
      fx.flash(0xFF4040, 0.5, 0.6);
      fx.shake(8, 0.5);
      fx.showMilestoneBanner(`WAVE ${w.waveState.waveIndex} — BOSS`, '#FF4040');
      fx.play('boss_sting');
      eventBus.emit('eventLog', { text: 'BOSS WAVE!', color: '#FF4040' });
    } else if (ev.type === 'break_end') {
      // NOTE: In normal gameplay the live path is UpgradeBreakPhase calling startWave() then the
      // _onWaveStart callback (applyBiomeTransition). This branch only fires in dev/sandbox scenarios.
      startWave(w.waveState, fx.rng);
      fx.applyBiomeTransition(w.waveState.waveIndex);
      eventBus.emit('waveStarted', { wave: w.waveState.waveIndex });
      fx.showWaveBanner(w.waveState.waveIndex);
    }
  }
  return changed;
}

// NOTE: not in original — Splitter death spawns two chasers (not triggered by bomb kills).
function spawnSplitChasers(w: WorldState, fx: WorldEffects, x: number, y: number): void {
  const baseAngle = fx.rng() * Math.PI * 2;
  for (const offset of [Math.PI / 4, -Math.PI / 4]) {
    const a = baseAngle + offset;
    const cx = clamp(x + Math.cos(a) * 22, 10, CFG.WORLD_W - 10);
    const cy = clamp(y + Math.sin(a) * 22, 10, CFG.WORLD_H - 10);
    w.enemies.push(makeEnemyState('chaser', cx, cy, w.waveState.speedBonus, fx.rng));
  }
  eventBus.emit('spawnParticles', { x, y, type: 'spark', count: 8, color: 0xFF8800 });
}

// NOTE: not in original — Core boss minion mechanic.
function spawnMinionRing(w: WorldState, fx: WorldEffects, sourceX: number, sourceY: number, count: number): void {
  let chaserCount = 0;
  for (const e of w.enemies) if (e.type === 'chaser') chaserCount++;
  const allowed = Math.max(0, CFG.BOSS_MINION_MAX - chaserCount);
  const toSpawn = Math.min(count, allowed);
  if (toSpawn === 0) return;
  for (let i = 0; i < toSpawn; i++) {
    const angle = (Math.PI * 2 * i) / toSpawn;
    const x = clamp(sourceX + Math.cos(angle) * CFG.BOSS_MINION_RADIUS, 10, CFG.WORLD_W - 10);
    const y = clamp(sourceY + Math.sin(angle) * CFG.BOSS_MINION_RADIUS, 10, CFG.WORLD_H - 10);
    w.enemies.push(makeEnemyState('chaser', x, y, w.waveState.speedBonus, fx.rng));
  }
}

// ── Scraps / pickups / boost zones ─────────────────────────────────────────────
function tickScraps(w: WorldState, fx: WorldEffects, dt: number): void {
  const scrapPos = tickScrapSpawn(
    w.waveState, dt, w.playerState.x, w.playerState.y,
    w.propsState.allProps, // NOTE: not in original — obstacle avoidance (Bug 1.5)
    fx.rng,
  );
  if (scrapPos) {
    const forced = fx.forcedPickupType();
    w.waveState.scraps.push({
      x: scrapPos.x, y: scrapPos.y, life: 15,
      type: forced ?? selectPickupType(w.waveState.waveIndex, fx.rng()),
    });
  }

  tickBoostZoneSpawn(w.waveState, dt, w.playerState.x, w.playerState.y, w.propsState.allProps, fx.rng);

  // Collection — repopulate scratch in place.
  w.trailScratch.length = w.trailState.count;
  for (let i = 0; i < w.trailState.count; i++) {
    w.trailScratch[i] = getTrailPoint(w.trailState, i);
  }
  const sc = w.pickupPlayerScratch;
  sc.x = w.playerState.x;
  sc.y = w.playerState.y;
  sc.radius = getPlayerRadius(w.playerState);
  sc.magnetRange = w.playerState.magnetRange;
  sc.trailMagnet = w.playerState.trailMagnet;
  for (const ev of updateScraps(w.waveState.scraps, sc, dt, w.trailScratch)) {
    handlePickupEvent(w, fx, ev);
  }
  for (const ev of updateBoostZones(w.waveState.boostZones, sc, dt)) {
    handlePickupEvent(w, fx, ev);
  }
}

function handlePickupEvent(w: WorldState, fx: WorldEffects, ev: string): void {
  const p = w.playerState;
  if (ev === 'scrap') {
    const scoreDelta = Math.round(10 * getEffectiveScoreMult(p));
    addScore(w.scoringState, scoreDelta);
    const { grant, carry } = accrueScrap(w.scrapCarry, w.runProgression.rewardMult);
    w.scrapCarry = carry;
    p.scrapBank += grant;
    w.scoringState.runStats.scrapCollected += grant;
    eventBus.emit('scoreChanged', { score: w.scoringState.score, delta: scoreDelta });
    eventBus.emit('spawnParticles', { x: p.x, y: p.y, type: 'spark', count: 8, color: 0xFFB000 });
    eventBus.emit('eventLog', { text: '+SCRAP', color: '#35f2d0' });
    fx.play('scrap_pickup');
  } else if (ev === 'speed_pickup' || ev === 'boost') {
    p.speedBoostTimer = CFG.BOOST_ZONE_DURATION;
    eventBus.emit('spawnParticles', { x: p.x, y: p.y, type: 'spark', count: 14, color: 0x35F2D0 });
    eventBus.emit('eventLog', { text: ev === 'boost' ? 'SPEED BOOST!' : 'SPEED!', color: '#35f2d0' });
    fx.play('scrap_pickup');
  } else if (ev === 'trail_boost') {
    w.trailState.maxPoints = Math.min(600, w.trailState.maxPoints + 200);
    eventBus.emit('spawnParticles', { x: p.x, y: p.y, type: 'spark', count: 12, color: 0xAA88FF });
    eventBus.emit('eventLog', { text: 'TRAIL+', color: '#cc66ff' });
    fx.play('scrap_pickup');
  } else if (ev === 'bomb') {
    applyBombPickup(w, fx);
  } else if (ev === 'time_slow') {
    fx.slowmo(0.3, 3.0);
    eventBus.emit('spawnParticles', { x: p.x, y: p.y, type: 'spark', count: 12, color: 0x44AAFF });
    eventBus.emit('eventLog', { text: 'TIME SLOW!', color: '#44aaff' });
    fx.play('scrap_pickup');
  } else if (ev === 'trail_token') {
    w.trailState.maxPoints = Math.min(800, w.trailState.maxPoints + 200);
    eventBus.emit('spawnParticles', { x: p.x, y: p.y, type: 'spark', count: 14, color: 0xFF44CC });
    eventBus.emit('eventLog', { text: 'TRAIL++', color: '#ff44cc' });
    fx.play('scrap_pickup');
  } else if (ev === 'shield_pickup') {
    p.shield = true;
    eventBus.emit('spawnParticles', { x: p.x, y: p.y, type: 'spark', count: 16, color: 0x44FF88 });
    eventBus.emit('eventLog', { text: 'SHIELD!', color: '#44ff88' });
    fx.play('scrap_pickup');
  }
}

function applyBombPickup(w: WorldState, fx: WorldEffects): void {
  let kills = 0;
  for (const e of w.enemies) {
    if (!e.alive) continue;
    if (!fx.isVisible(e.x, e.y, 50)) continue;

    if (e.type === 'boss') {
      // Bomb respects boss armor — same rule as encirclement (trailUpdate.ts).
      if (e.armored || e.bossVulnerable === false) {
        e.hitFlashTimer = CFG.BOSS_HIT_FLASH_S;
        continue;
      }
      e.health = (e.health ?? 1) - 1;
      e.hitFlashTimer = CFG.BOSS_HIT_FLASH_S;
      if (e.health > 0) continue;
    }

    e.alive = false;
    kills++;
    eventBus.emit('enemyKilled', { x: e.x, y: e.y, type: e.type, isElite: e.armored });
  }
  if (kills > 0) {
    const bonus = Math.round(kills * 50 * getEffectiveScoreMult(w.playerState));
    addScore(w.scoringState, bonus);
    eventBus.emit('scoreChanged', { score: w.scoringState.score, delta: bonus });
    updateRunStats(w.scoringState.runStats, { type: 'bomb', killCount: kills });
    eventBus.emit('spawnParticles', { x: w.playerState.x, y: w.playerState.y, type: 'shard', count: 30 });
    fx.flash(0xFF2200, 0.55, 0.35);
    fx.shake(10, 0.45);
    fx.zoom(0.92, 0.3);
    eventBus.emit('eventLog', { text: `BOMB! x${kills}`, color: '#FF4444' });
  }
  sweepDead(w.enemies);
}

// ── Props ───────────────────────────────────────────────────────────────────────
function tickProps(w: WorldState, fx: WorldEffects, dt: number): void {
  const p = w.playerState;
  const propHits = checkPlayerPropCollision(w.propsState, p);
  const propEvents = handlePropCollisions(propHits, p);
  for (const ev of propEvents) {
    if (ev.type === 'solid_bounce') {
      eventBus.emit('spawnParticles', { x: ev.x, y: ev.y, type: 'shard', count: 2 });
    } else if (ev.type === 'hazard_hit') {
      if (p.invulnTimer <= 0 && p.ghostFrameTimer <= 0) {
        const dmg = Math.ceil((ev.damage ?? 8) * (1 - (p.damageResist ?? 0)));
        if (dmg > 0) {
          p.hp = Math.max(0, p.hp - dmg);
          p.invulnTimer = CFG.HIT_INVULN;
          p.lastHitTimer = 0;
          eventBus.emit('playerDamaged', { amount: dmg, x: ev.x, y: ev.y });
          eventBus.emit('spawnParticles', { x: ev.x, y: ev.y, type: 'shard', count: 4 });
          if (p.hp <= 0 && !fx.isDeathActive()) fx.triggerDeath();
        }
      }
    }
  }
  updatePropCooldowns(w.propsState, dt);
  if (checkNearMissProp(w.propsState, p)) {
    const hmResult = processHazardNearMiss(p, w.scoringState.score);
    w.scoringState.score = hmResult.score;
    w.scoringState.comboLevel = hmResult.comboLevel;
    p.comboLevel = hmResult.comboLevel;
    eventBus.emit('nearMiss', { x: p.x, y: p.y });
  }
}

// ── Bomb / hazard zones ───────────────────────────────────────────────────────
function tickHazardZones(w: WorldState, fx: WorldEffects, dt: number): void {
  const p = w.playerState;
  const zones = w.waveState.hazardZones;
  for (let i = zones.length - 1; i >= 0; i--) {
    zones[i].life -= dt;
    zones[i].phase += dt;
    if (zones[i].life <= 0) {
      zones[i] = zones[zones.length - 1];
      zones.pop();
      continue;
    }
    const dx = p.x - zones[i].x;
    const dy = p.y - zones[i].y;
    if (Math.hypot(dx, dy) < zones[i].radius) {
      const prevHp = p.hp;
      const effect = applyHazardZoneDamage(
        p.hp, p.slowTimer ?? 0, p.invulnTimer, p.ghostFrameTimer, p.damageResist,
        zones[i].x, zones[i].y, zones[i].radius, p.x, p.y, dt,
      );
      p.hp = effect.hp;
      p.slowTimer = effect.slowTimer;
      p.slowStrength = effect.slowStrength;
      if (prevHp !== effect.hp) p.lastHitTimer = 0;
      if (p.hp <= 0 && !fx.isDeathActive()) fx.triggerDeath();
    }
  }
}

// ── Enemies ───────────────────────────────────────────────────────────────────
function tickEnemies(w: WorldState, fx: WorldEffects, dt: number): boolean {
  let changed = false;
  w.trailScratch.length = w.trailState.count;
  for (let i = 0; i < w.trailState.count; i++) {
    w.trailScratch[i] = getTrailPoint(w.trailState, i);
  }
  const trailPts = w.trailScratch;

  for (let i = w.enemies.length - 1; i >= 0; i--) {
    const enemy = w.enemies[i];
    if (!enemy.alive) {
      w.enemies[i] = w.enemies[w.enemies.length - 1];
      w.enemies.pop();
      changed = true;
      continue;
    }
    const result = updateEnemy(enemy, w.playerState, dt, w.gameClock, fx.isVisible, trailPts, fx.rng);

    if (enemy._dropBomb) {
      enemy._dropBomb = false;
      w.waveState.hazardZones.push({
        x: enemy.x, y: enemy.y,
        life: CFG.BOMB_ZONE_DURATION, radius: CFG.BOMB_ZONE_RADIUS, phase: 0,
      });
    }
    if (enemy._bossSpawnMinion) {
      enemy._bossSpawnMinion = false;
      spawnMinionRing(w, fx, enemy.x, enemy.y, 6);
      changed = true;
    }
    checkEnemyPropCollision(w.propsState, enemy);
    if (result.despawned) {
      w.enemies[i] = w.enemies[w.enemies.length - 1];
      w.enemies.pop();
      changed = true;
    }
  }
  return changed;
}

// ── Combat: near-miss + collision ──────────────────────────────────────────────
function tickCombat(w: WorldState, fx: WorldEffects, dt: number): boolean {
  let changed = false;
  const p = w.playerState;
  const s = w.scoringState;

  for (let i = w.enemies.length - 1; i >= 0; i--) {
    const enemy = w.enemies[i];
    if (!enemy.alive) continue;

    if (checkNearMiss(p, enemy)) {
      const oldCombo = s.comboLevel;
      const nmResult = processNearMiss(p, enemy, s.score);
      s.score = nmResult.score;
      s.comboLevel = nmResult.comboLevel;
      p.comboLevel = nmResult.comboLevel;
      updateRunStats(s.runStats, { type: 'near_miss', comboLevel: oldCombo });
      s.lastEngagementTimer = 0;
      p.hp = applyComboHeal(oldCombo, nmResult.comboLevel, p.comboHeal, p.hp, p.maxHp);
      fx.comboMilestone(oldCombo, nmResult.comboLevel, p);
      if (fx.rng() < CFG.SCRAP_NEAR_MISS_CHANCE) {
        w.waveState.scraps.push({ x: enemy.x, y: enemy.y, life: 15, type: 'scrap' });
      }
      eventBus.emit('nearMiss', { x: enemy.x, y: enemy.y });
    }

    if (checkPlayerEnemyCollision(p, enemy)) {
      const dmgResult = processPlayerHit(p, enemy, w.waveState.waveIndex);
      if (dmgResult.type === 'hit') {
        eventBus.emit('playerDamaged', { amount: dmgResult.finalDamage, x: p.x, y: p.y });
      }
      if (p.hp <= 0 && !fx.isDeathActive()) fx.triggerDeath();
      changed = true;
    }
  }

  updateNearMissStreak(p, dt);
  applyHpRegen(p, dt);
  return changed;
}

// ── Trail: encirclement, chain lightning, trail burn ───────────────────────────
function tickTrail(w: WorldState, fx: WorldEffects, dt: number): boolean {
  let changed = false;
  const p = w.playerState;
  const s = w.scoringState;
  const loopResult = updateTrail(w.trailState, p, w.enemies, dt);

  if (loopResult !== null) {
    for (const hitBoss of loopResult.hitBosses) {
      const b = hitBoss as EnemyState;
      const remaining = b.health ?? 0;
      fx.shake(5, 0.2);
      fx.spawn(b.x, b.y, 0x44FFCC, 18, {
        type: 'spark', vxMin: -200, vxMax: 200, vyMin: -200, vyMax: 200, lifeMin: 0.2, lifeMax: 0.35,
      });
      const kbDx = b.x - p.x;
      const kbDy = b.y - p.y;
      const kbDist = Math.hypot(kbDx, kbDy) || 1;
      b.vx += (kbDx / kbDist) * CFG.BOSS_CHIP_KNOCKBACK;
      b.vy += (kbDy / kbDist) * CFG.BOSS_CHIP_KNOCKBACK;
      eventBus.emit('eventLog', { text: `BOSS HIT! ${remaining} HP left`, color: '#44FFCC' });
    }

    const killCount = loopResult.killedEnemies.length;
    if (killCount > 0) {
      const oldCombo = s.comboLevel;
      const encircleResult = computeEncircleOutcome(
        killCount, s.comboLevel, getEffectiveScoreMult(p), p.encircleScoreBonus,
      );
      addScore(s, encircleResult.scoreDelta);
      s.comboLevel = encircleResult.comboLevel;
      p.comboLevel = encircleResult.comboLevel;
      updateRunStats(s.runStats, { type: 'encircle', killCount, comboLevel: oldCombo });
      s.lastEngagementTimer = 0;
      p.hp = applyComboHeal(oldCombo, encircleResult.comboLevel, p.comboHeal, p.hp, p.maxHp);
      eventBus.emit('scoreChanged', { score: s.score, delta: encircleResult.scoreDelta });
      fx.comboMilestone(oldCombo, encircleResult.comboLevel, p);

      if (p.chainLightning) {
        const { chains, scoreGained } = applyChainLightning(
          loopResult.killedEnemies as EnemyState[], w.enemies, getEffectiveScoreMult(p),
        );
        if (scoreGained > 0) addScore(s, scoreGained);
        for (const c of chains) {
          const steps = 5;
          for (let st = 0; st <= steps; st++) {
            const t = st / steps;
            const jx = (c.dstX - c.srcX) * t + c.srcX + (fx.rng() - 0.5) * 24;
            const jy = (c.dstY - c.srcY) * t + c.srcY + (fx.rng() - 0.5) * 24;
            fx.spawn(jx, jy, 0xAAEEFF, 3, {
              type: 'spark', vxMin: -60, vxMax: 60, vyMin: -60, vyMax: 60, lifeMin: 0.1, lifeMax: 0.22,
            });
          }
          fx.spawn(c.midX, c.midY, 0xFFFFFF, 12, {
            type: 'spark', vxMin: -120, vxMax: 120, vyMin: -120, vyMax: 120, lifeMin: 0.15, lifeMax: 0.3,
          });
          fx.play('near_miss');
        }
      }
    }

    if (loopResult.encircleCount > 0) {
      eventBus.emit('encirclement', {
        count: loopResult.encircleCount,
        x: loopResult.polygon[0].x,
        y: loopResult.polygon[0].y,
      });
    }

    for (const dead of loopResult.killedEnemies) {
      const d = dead as EnemyState;
      eventBus.emit('enemyKilled', { x: d.x, y: d.y, type: d.type, isElite: false });
      if (d.type === 'splitter') spawnSplitChasers(w, fx, d.x, d.y);
      changed = true;
    }
    sweepDead(w.enemies);
  }

  // Trail Burn
  const burnResults = applyTrailBurn(p, w.enemies, w.trailState, dt);
  for (const r of burnResults) {
    if (r.enemyDied) {
      addScore(s, 50 * getEffectiveScoreMult(p));
      const oldCombo = s.comboLevel;
      const newCombo = Math.min(CFG.MAX_COMBO, oldCombo + 1);
      s.comboLevel = newCombo;
      p.comboLevel = newCombo;
      p.hp = applyComboHeal(oldCombo, newCombo, p.comboHeal, p.hp, p.maxHp);
      fx.comboMilestone(oldCombo, newCombo, p);
      eventBus.emit('eventLog', { text: 'BURN!', color: '#FF6600' });
      if (r.enemyType === 'splitter') spawnSplitChasers(w, fx, r.ex, r.ey);
    }
    eventBus.emit('spawnParticles', { x: r.ex, y: r.ey, type: 'spark', count: 4, color: 0xFF6600 });
    if (r.enemyDied) changed = true;
  }
  if (burnResults.some(r => r.enemyDied)) sweepDead(w.enemies);

  return changed;
}

// ── Shared util ────────────────────────────────────────────────────────────────
function sweepDead(enemies: EnemyState[]): void {
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (!enemies[i].alive) {
      enemies[i] = enemies[enemies.length - 1];
      enemies.pop();
    }
  }
}
