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
  // Visual
  glowExtra: number;
  sprite: string; // texture key
}

let _nextId = 0;

export function makeEnemyState(
  type: EnemyType,
  x: number,
  y: number,
  speedBonus: number,
): EnemyState {
  const isInterceptor = type === 'interceptor';
  const baseSpeed = isInterceptor ? CFG.INTERCEPTOR_SPEED : CFG.CHASER_SPEED;
  const maxSpeed = baseSpeed + speedBonus;
  const turnRate = CFG.ENEMY_TURN_RATE * (isInterceptor ? 0.85 : 1.0);

  const spritePool = CFG.ENEMY_SPRITES_BY_TYPE[type] ?? CFG.ENEMY_SPRITES_BY_TYPE['chaser'];
  const sprite = randChoice(spritePool);

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
    maxSpeed,
    turnRate,
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
    baseMaxSpeed: maxSpeed,
    age: 0,
    lifespan:
      CFG.ENEMY_LIFESPAN_MIN +
      Math.random() * (CFG.ENEMY_LIFESPAN_MAX - CFG.ENEMY_LIFESPAN_MIN),
    offscreenTimer: 0,
    fadeAlpha: 1,
    nearMissCooldown: 0,
    glowExtra: 0,
    sprite,
  };
}

export function getEnemySpeed(state: EnemyState): number {
  return Math.hypot(state.vx, state.vy);
}
