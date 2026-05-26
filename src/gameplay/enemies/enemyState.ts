// enemyState.ts — EnemyState interface, factory, and accessors.

import { CFG } from '@core/config';
import type { EnemyType } from '@core/config';
import { randChoice } from '@core/utils';
import type { PhysicsEntity } from '@gameplay/physics';

export type { EnemyType };

export interface EnemyState extends PhysicsEntity {
  // Identity
  id: number;
  type: EnemyType;
  alive: boolean;
  // Gameplay
  health: number;
  armored: boolean;
  radius: number;
  baseMaxSpeed: number;
  // Lifespan
  age: number;
  lifespan: number;
  offscreenTimer: number;
  fadeAlpha: number;
  // Near-miss cooldown
  nearMissCooldown: number;
  // Trail Burn: per-enemy cooldown (seconds) between burn damage ticks
  _trailBurnCooldown: number;
  // Visual
  glowExtra: number;
  sprite: string; // texture key

  // Drifter AI state
  driftToggleTimer?: number;
  driftDuration?: number;
  // Blocker AI state
  holdingTrail?: boolean;
  // Flanker AI state
  flankSide?: number;
  flankSwitchTimer?: number;
  striking?: boolean;
  strikeTimer?: number;
  // Bomber AI state
  bombTimer?: number;
  _dropBomb?: boolean;
  // Boss AI state
  bossPattern?: 'pursuer' | 'core' | 'reflector';
  bossPhase?: 'telegraph' | 'charge' | 'orbit' | 'spawning' | 'vulnerable' | 'invuln';
  bossPhaseTimer?: number;
  bossChargeTargetX?: number;
  bossChargeTargetY?: number;
  bossVulnerable?: boolean;
  _bossSpawnMinion?: boolean;
}

let _nextId = 0;

export function makeEnemyState(
  type: EnemyType,
  x: number,
  y: number,
  speedBonus: number,
): EnemyState {
  const spritePool = CFG.ENEMY_SPRITES_BY_TYPE[type] ?? CFG.ENEMY_SPRITES_BY_TYPE['chaser'];
  const sprite = randChoice(spritePool);

  switch (type) {
    case 'chaser':
      return {
        id: _nextId++,
        type,
        alive: true,
        x,
        y,
        vx: 0,
        vy: 0,
        heading: 0,
        drifting: false,
        driftJustStarted: false,
        maxSpeed: CFG.CHASER_SPEED + speedBonus,
        turnRate: CFG.ENEMY_TURN_RATE * 1.0,
        driftKing: false,
        afterburner: false,
        nitroDrift: false,
        lastDriftEndTime: 0,
        driftChain: 0,
        slipTimer: 0,
        slipStrength: 0,
        slowTimer: 0,
        slowStrength: 0,
        wallHit: false,
        health: 1,
        armored: false,
        radius: CFG.ENEMY_RADIUS,
        baseMaxSpeed: CFG.CHASER_SPEED + speedBonus,
        age: 0,
        lifespan:
          CFG.ENEMY_LIFESPAN_MIN +
          Math.random() * (CFG.ENEMY_LIFESPAN_MAX - CFG.ENEMY_LIFESPAN_MIN),
        offscreenTimer: 0,
        fadeAlpha: 1,
        nearMissCooldown: 0,
        _trailBurnCooldown: 0,
        glowExtra: 0,
        sprite,
        driftToggleTimer: undefined,
        driftDuration: undefined,
        holdingTrail: false,
        flankSide: undefined,
        flankSwitchTimer: undefined,
        striking: false,
        strikeTimer: 0,
        bombTimer: undefined,
        _dropBomb: false,
      };
    case 'interceptor':
      return {
        id: _nextId++,
        type,
        alive: true,
        x,
        y,
        vx: 0,
        vy: 0,
        heading: 0,
        drifting: false,
        driftJustStarted: false,
        maxSpeed: CFG.INTERCEPTOR_SPEED + speedBonus,
        turnRate: CFG.ENEMY_TURN_RATE * 0.85,
        driftKing: false,
        afterburner: false,
        nitroDrift: false,
        lastDriftEndTime: 0,
        driftChain: 0,
        slipTimer: 0,
        slipStrength: 0,
        slowTimer: 0,
        slowStrength: 0,
        wallHit: false,
        health: 1,
        armored: false,
        radius: CFG.ENEMY_RADIUS,
        baseMaxSpeed: CFG.INTERCEPTOR_SPEED + speedBonus,
        age: 0,
        lifespan:
          CFG.ENEMY_LIFESPAN_MIN +
          Math.random() * (CFG.ENEMY_LIFESPAN_MAX - CFG.ENEMY_LIFESPAN_MIN),
        offscreenTimer: 0,
        fadeAlpha: 1,
        nearMissCooldown: 0,
        _trailBurnCooldown: 0,
        glowExtra: 0,
        sprite,
        driftToggleTimer: undefined,
        driftDuration: undefined,
        holdingTrail: false,
        flankSide: undefined,
        flankSwitchTimer: undefined,
        striking: false,
        strikeTimer: 0,
        bombTimer: undefined,
        _dropBomb: false,
      };
    case 'drifter':
      return {
        id: _nextId++,
        type,
        alive: true,
        x,
        y,
        vx: 0,
        vy: 0,
        heading: 0,
        drifting: false,
        driftJustStarted: false,
        maxSpeed: CFG.DRIFTER_SPEED + speedBonus,
        turnRate: CFG.ENEMY_TURN_RATE * 1.1,
        driftKing: false,
        afterburner: false,
        nitroDrift: false,
        lastDriftEndTime: 0,
        driftChain: 0,
        slipTimer: 0,
        slipStrength: 0,
        slowTimer: 0,
        slowStrength: 0,
        wallHit: false,
        health: 1,
        armored: false,
        radius: CFG.ENEMY_RADIUS,
        baseMaxSpeed: CFG.DRIFTER_SPEED + speedBonus,
        age: 0,
        lifespan:
          CFG.ENEMY_LIFESPAN_MIN +
          Math.random() * (CFG.ENEMY_LIFESPAN_MAX - CFG.ENEMY_LIFESPAN_MIN),
        offscreenTimer: 0,
        fadeAlpha: 1,
        nearMissCooldown: 0,
        _trailBurnCooldown: 0,
        glowExtra: 0,
        sprite,
        driftToggleTimer: 2 + Math.random() * 3,
        driftDuration: 0,
        holdingTrail: false,
        flankSide: undefined,
        flankSwitchTimer: undefined,
        striking: false,
        strikeTimer: 0,
        bombTimer: undefined,
        _dropBomb: false,
      };
    case 'blocker':
      return {
        id: _nextId++,
        type,
        alive: true,
        x,
        y,
        vx: 0,
        vy: 0,
        heading: 0,
        drifting: false,
        driftJustStarted: false,
        maxSpeed: CFG.BLOCKER_SPEED + speedBonus,
        turnRate: CFG.ENEMY_TURN_RATE * 0.7,
        driftKing: false,
        afterburner: false,
        nitroDrift: false,
        lastDriftEndTime: 0,
        driftChain: 0,
        slipTimer: 0,
        slipStrength: 0,
        slowTimer: 0,
        slowStrength: 0,
        wallHit: false,
        health: 1,
        armored: false,
        radius: CFG.ENEMY_RADIUS,
        baseMaxSpeed: CFG.BLOCKER_SPEED + speedBonus,
        age: 0,
        lifespan:
          CFG.ENEMY_LIFESPAN_MIN +
          Math.random() * (CFG.ENEMY_LIFESPAN_MAX - CFG.ENEMY_LIFESPAN_MIN),
        offscreenTimer: 0,
        fadeAlpha: 1,
        nearMissCooldown: 0,
        _trailBurnCooldown: 0,
        glowExtra: 0,
        sprite,
        driftToggleTimer: undefined,
        driftDuration: undefined,
        holdingTrail: false,
        flankSide: undefined,
        flankSwitchTimer: undefined,
        striking: false,
        strikeTimer: 0,
        bombTimer: undefined,
        _dropBomb: false,
      };
    case 'flanker':
      return {
        id: _nextId++,
        type,
        alive: true,
        x,
        y,
        vx: 0,
        vy: 0,
        heading: 0,
        drifting: false,
        driftJustStarted: false,
        maxSpeed: CFG.FLANKER_SPEED + speedBonus,
        turnRate: CFG.ENEMY_TURN_RATE * 0.9,
        driftKing: false,
        afterburner: false,
        nitroDrift: false,
        lastDriftEndTime: 0,
        driftChain: 0,
        slipTimer: 0,
        slipStrength: 0,
        slowTimer: 0,
        slowStrength: 0,
        wallHit: false,
        health: 1,
        armored: false,
        radius: CFG.ENEMY_RADIUS,
        baseMaxSpeed: CFG.FLANKER_SPEED + speedBonus,
        age: 0,
        lifespan:
          CFG.ENEMY_LIFESPAN_MIN +
          Math.random() * (CFG.ENEMY_LIFESPAN_MAX - CFG.ENEMY_LIFESPAN_MIN),
        offscreenTimer: 0,
        fadeAlpha: 1,
        nearMissCooldown: 0,
        _trailBurnCooldown: 0,
        glowExtra: 0,
        sprite,
        driftToggleTimer: undefined,
        driftDuration: undefined,
        holdingTrail: false,
        flankSide: Math.random() < 0.5 ? 1 : -1,
        flankSwitchTimer: 3 + Math.random() * 2,
        striking: false,
        strikeTimer: 0,
        bombTimer: undefined,
        _dropBomb: false,
      };
    case 'bomber':
      return {
        id: _nextId++,
        type,
        alive: true,
        x,
        y,
        vx: 0,
        vy: 0,
        heading: 0,
        drifting: false,
        driftJustStarted: false,
        maxSpeed: CFG.BOMBER_SPEED + speedBonus,
        turnRate: CFG.ENEMY_TURN_RATE * 0.75,
        driftKing: false,
        afterburner: false,
        nitroDrift: false,
        lastDriftEndTime: 0,
        driftChain: 0,
        slipTimer: 0,
        slipStrength: 0,
        slowTimer: 0,
        slowStrength: 0,
        wallHit: false,
        health: 1,
        armored: false,
        radius: CFG.ENEMY_RADIUS,
        baseMaxSpeed: CFG.BOMBER_SPEED + speedBonus,
        age: 0,
        lifespan:
          CFG.ENEMY_LIFESPAN_MIN +
          Math.random() * (CFG.ENEMY_LIFESPAN_MAX - CFG.ENEMY_LIFESPAN_MIN),
        offscreenTimer: 0,
        fadeAlpha: 1,
        nearMissCooldown: 0,
        _trailBurnCooldown: 0,
        glowExtra: 0,
        sprite,
        driftToggleTimer: undefined,
        driftDuration: undefined,
        holdingTrail: false,
        flankSide: undefined,
        flankSwitchTimer: undefined,
        striking: false,
        strikeTimer: 0,
        bombTimer: CFG.BOMB_ZONE_INTERVAL,
        _dropBomb: false,
      };
    case 'elite':
      return {
        id: _nextId++,
        type,
        alive: true,
        x,
        y,
        vx: 0,
        vy: 0,
        heading: 0,
        drifting: false,
        driftJustStarted: false,
        maxSpeed: CFG.CHASER_SPEED * 0.9 + speedBonus,
        turnRate: CFG.ENEMY_TURN_RATE * 0.8,
        driftKing: false,
        afterburner: false,
        nitroDrift: false,
        lastDriftEndTime: 0,
        driftChain: 0,
        slipTimer: 0,
        slipStrength: 0,
        slowTimer: 0,
        slowStrength: 0,
        wallHit: false,
        health: 2,
        armored: true,
        radius: 14,
        baseMaxSpeed: CFG.CHASER_SPEED * 0.9 + speedBonus,
        age: 0,
        lifespan:
          (CFG.ENEMY_LIFESPAN_MIN + Math.random() * (CFG.ENEMY_LIFESPAN_MAX - CFG.ENEMY_LIFESPAN_MIN)) * 1.5,
        offscreenTimer: 0,
        fadeAlpha: 1,
        nearMissCooldown: 0,
        _trailBurnCooldown: 0,
        glowExtra: 0,
        sprite,
        driftToggleTimer: undefined,
        driftDuration: undefined,
        holdingTrail: false,
        flankSide: undefined,
        flankSwitchTimer: undefined,
        striking: false,
        strikeTimer: 0,
        bombTimer: undefined,
        _dropBomb: false,
      };
    case 'boss':
      return {
        id: _nextId++,
        type,
        alive: true,
        x,
        y,
        vx: 0,
        vy: 0,
        heading: 0,
        drifting: false,
        driftJustStarted: false,
        maxSpeed: CFG.BOSS_SPEED,
        turnRate: CFG.ENEMY_TURN_RATE * 0.6,
        driftKing: false,
        afterburner: false,
        nitroDrift: false,
        lastDriftEndTime: 0,
        driftChain: 0,
        slipTimer: 0,
        slipStrength: 0,
        slowTimer: 0,
        slowStrength: 0,
        wallHit: false,
        health: CFG.BOSS_HP,
        armored: false,
        radius: CFG.BOSS_RADIUS,
        baseMaxSpeed: CFG.BOSS_SPEED,
        age: 0,
        lifespan: 9999,
        offscreenTimer: 0,
        fadeAlpha: 1,
        nearMissCooldown: 0,
        _trailBurnCooldown: 0,
        glowExtra: 0,
        sprite,
        driftToggleTimer: undefined,
        driftDuration: undefined,
        holdingTrail: false,
        flankSide: undefined,
        flankSwitchTimer: undefined,
        striking: false,
        strikeTimer: 0,
        bombTimer: undefined,
        _dropBomb: false,
        bossPhase: 'telegraph',
        bossPhaseTimer: CFG.BOSS_TELEGRAPH_DUR,
        bossVulnerable: true,
        _bossSpawnMinion: false,
      };
    default:
      // Fallback for unknown type (should not occur with valid types)
      return {
        id: _nextId++,
        type,
        alive: true,
        x,
        y,
        vx: 0,
        vy: 0,
        heading: 0,
        drifting: false,
        driftJustStarted: false,
        maxSpeed: CFG.CHASER_SPEED + speedBonus,
        turnRate: CFG.ENEMY_TURN_RATE * 1.0,
        driftKing: false,
        afterburner: false,
        nitroDrift: false,
        lastDriftEndTime: 0,
        driftChain: 0,
        slipTimer: 0,
        slipStrength: 0,
        slowTimer: 0,
        slowStrength: 0,
        wallHit: false,
        health: 1,
        armored: false,
        radius: CFG.ENEMY_RADIUS,
        baseMaxSpeed: CFG.CHASER_SPEED + speedBonus,
        age: 0,
        lifespan:
          CFG.ENEMY_LIFESPAN_MIN +
          Math.random() * (CFG.ENEMY_LIFESPAN_MAX - CFG.ENEMY_LIFESPAN_MIN),
        offscreenTimer: 0,
        fadeAlpha: 1,
        nearMissCooldown: 0,
        _trailBurnCooldown: 0,
        glowExtra: 0,
        sprite,
        driftToggleTimer: undefined,
        driftDuration: undefined,
        holdingTrail: false,
        flankSide: undefined,
        flankSwitchTimer: undefined,
        striking: false,
        strikeTimer: 0,
        bombTimer: undefined,
        _dropBomb: false,
      };
  }
}

export function getEnemySpeed(state: EnemyState): number {
  return Math.hypot(state.vx, state.vy);
}
