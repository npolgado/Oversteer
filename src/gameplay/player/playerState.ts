// playerState.ts — Player state definition and factory.
// PlayerState extends PhysicsEntity so it satisfies updatePhysics() directly.

import { CFG } from '@core/config';
import type { PhysicsEntity } from '@gameplay/physics';

export interface PlayerState extends PhysicsEntity {
  // Drift (drifting, driftJustStarted, lastDriftEndTime, driftChain inherited)
  driftTime: number;
  // Stats
  hp: number; maxHp: number; hpRegen: number; lastHitTimer: number;
  // Defense
  shield: boolean; invulnTimer: number; ghostFrameTimer: number; ghostFrame: boolean; frozen: boolean;
  // State
  braking: boolean; wallRiding: boolean; comboLevel: number;
  // Handbrake
  handbrakeTimer: number;
  // Speed boost
  speedBoostTimer: number;
  // Near-miss
  consecutiveNearMisses: number; nearMissStreakTimer: number;
  // Visual
  leanTimer: number; leanDir: number; exhaustTimer: number;
  glowPhase: number; driftDeniedTimer: number;
  // Upgrades (flags)
  tightTurns: boolean; magnetRange: number;
  scoreMult: number; thickPlating: boolean;
  comboMaster: boolean; speedDemon: boolean; encircleScoreBonus: number;
  damageResist: number; driftShield: boolean; comboHeal: boolean;
  trailMagnet: boolean; speedTrail: boolean; dashBurst: boolean;
  dashCooldown: number; trailBurn: boolean; chainLightning: boolean;
  // Upgrade list
  upgrades: string[];
  // Scrap economy (M2)
  scrapBank: number;
  scoreMultBoostTimer: number;
}

export function makePlayerState(): PlayerState {
  return {
    // Position / velocity
    x: CFG.WORLD_W / 2,
    y: CFG.WORLD_H / 2,
    vx: 0,
    vy: 0,
    heading: -Math.PI / 2, // facing up
    // Drift
    drifting: false,
    driftJustStarted: false,
    driftTime: 0,
    lastDriftEndTime: 0,
    driftChain: 0,
    // Stats
    maxSpeed: CFG.MAX_SPEED,
    turnRate: CFG.TURN_RATE,
    hp: CFG.PLAYER_HP,
    maxHp: CFG.PLAYER_HP_MAX,
    hpRegen: CFG.HP_REGEN,
    lastHitTimer: 99,
    // Defense
    shield: false,
    invulnTimer: 0,
    ghostFrameTimer: 0,
    ghostFrame: false,
    frozen: false,
    // Debuffs
    slipTimer: 0,
    slipStrength: 0.6,
    slowTimer: 0,
    slowStrength: 1,
    // State
    wallHit: false,
    braking: false,
    wallRiding: false,
    comboLevel: 0,
    // Handbrake
    handbrakeTimer: 0,
    // Speed boost
    speedBoostTimer: 0,
    // Near-miss
    consecutiveNearMisses: 0,
    nearMissStreakTimer: 0,
    // Visual
    leanTimer: 0,
    leanDir: 0,
    exhaustTimer: 0,
    glowPhase: 0,
    driftDeniedTimer: 0,
    // Upgrades (flags) — PhysicsEntity fields
    driftKing: false,
    afterburner: false,
    nitroDrift: false,
    // Upgrades (flags) — player-specific
    tightTurns: false,
    magnetRange: 0,
    scoreMult: 1,
    thickPlating: false,
    comboMaster: false,
    speedDemon: false,
    encircleScoreBonus: 1,
    damageResist: 0,
    driftShield: false,
    comboHeal: false,
    trailMagnet: false,
    speedTrail: false,
    dashBurst: false,
    dashCooldown: 0,
    trailBurn: false,
    chainLightning: false,
    upgrades: [],
    scrapBank: 0,
    scoreMultBoostTimer: 0,
  };
}

export function getPlayerSpeed(state: PlayerState): number {
  return Math.hypot(state.vx, state.vy);
}

export function getEffectiveScoreMult(p: PlayerState): number {
  return p.scoreMultBoostTimer > 0 ? p.scoreMult * 2 : p.scoreMult;
}

export function getPlayerRadius(state: PlayerState): number {
  let r = CFG.PLAYER_RADIUS;
  if (state.drifting) r -= CFG.PLAYER_DRIFT_SHRINK;
  if (state.thickPlating) r -= 3; // NOTE: matches game.js:946
  return r;
}
