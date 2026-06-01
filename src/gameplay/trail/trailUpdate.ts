// trailUpdate.ts — Trail update logic (recording, loop detection).
// No side-effect calls (audio, particles, eventBus) — caller reads the result.

import { getPlayerSpeed, type PlayerState } from '@gameplay/player/playerState';
import { pointInPoly } from '@gameplay/pureLogic';
import { CFG } from '@core/config';
import {
  getTrailPoint,
  pushTrailPoint,
  type TrailPoint,
  type TrailState,
} from './trailState';

const RECORD_INTERVAL = 0.05;
const CHECK_INTERVAL = 0.15;
const SKIP_RECENT = 20;

// Minimal enemy shape required by trail. Step 5 (EnemyState) must satisfy this structurally.
export interface EnemyState {
  x: number;
  y: number;
  alive: boolean;
  armored: boolean;
  type?: string;
  health?: number;
  radius?: number;
  hitFlashTimer?: number;
  bossVulnerable?: boolean;
}

export interface TrailLoopResult {
  killedEnemies: EnemyState[];
  hitBosses: EnemyState[];   // bosses damaged this loop but not yet dead
  polygon: TrailPoint[];
  score: number;          // raw score delta (no multiplier)
  encircleCount: number;
}

export function updateTrail(
  state: TrailState,
  player: PlayerState,
  enemies: EnemyState[],
  dt: number,
): TrailLoopResult | null {
  // Update trail color based on combo level
  const comboInt = Math.floor(player.comboLevel);
  if (comboInt >= 5) {
    // Purple (#7C5CFF)
    state.colorR = 124; state.colorG = 92; state.colorB = 255;
  } else {
    // Cyan (#35F2D0)
    state.colorR = 53; state.colorG = 242; state.colorB = 208;
  }

  // Speed trail: grow capacity with player speed (capped at MAX_POINTS_CAP = 600)
  if (player.speedTrail) {
    state.maxPoints = Math.min(state.points.length, 400 + Math.floor(getPlayerSpeed(player) / 100));
  }

  // Record position
  state.recordTimer += dt;
  if (state.recordTimer >= RECORD_INTERVAL) {
    pushTrailPoint(state, player.x, player.y, Math.hypot(player.vx, player.vy));
    state.recordTimer = 0;
  }

  // Flash polygon timer
  if (state.flashPolyTimer > 0) state.flashPolyTimer -= dt;

  // Loop check
  state.checkTimer += dt;
  if (state.checkTimer >= CHECK_INTERVAL) {
    state.checkTimer = 0;
    const result = _detectLoop(state, player.x, player.y, enemies);
    if (result !== null) {
      clearTrail(state);
      return result;
    }
  }

  return null;
}

export function clearTrail(state: TrailState): void {
  state.head = 0;
  state.count = 0;
  state.recordTimer = 0;
  state.checkTimer = 0;
  // flashPoly and flashPolyTimer intentionally NOT reset here — matches JS clear() behavior.
  // _detectLoop sets these before returning; clearing them here would erase the encirclement flash.
}

function _detectLoop(
  state: TrailState,
  px: number,
  py: number,
  enemies: EnemyState[],
): TrailLoopResult | null {
  if (state.count < SKIP_RECENT + 5) return null;

  const searchEnd = state.count - SKIP_RECENT;

  for (let i = 0; i < searchEnd; i++) {
    const pt = getTrailPoint(state, i);
    const d = Math.hypot(px - pt.x, py - pt.y);
    if (d >= state.closeDist) continue;

    // Build polygon from trail point i through to player's current position
    const poly: TrailPoint[] = [];
    for (let j = i; j < state.count; j++) {
      poly.push(getTrailPoint(state, j));
    }
    poly.push({ x: px, y: py });

    if (poly.length < 10) continue;

    const killedEnemies: EnemyState[] = [];
    const hitBosses: EnemyState[] = [];
    let encircleCount = 0;

    for (const e of enemies) {
      if (!e.alive) continue;

      if (e.type === 'boss') {
        // Radius-aware hit: test center + 4 cardinal offsets so near-misses count
        const r = e.radius ?? 0;
        const D = r * 0.707; // diagonal offsets at 45° so edge tangency is not missed
        const hit = pointInPoly(e.x, e.y, poly)
          || (r > 0 && (
            pointInPoly(e.x + r, e.y, poly) ||
            pointInPoly(e.x - r, e.y, poly) ||
            pointInPoly(e.x, e.y + r, poly) ||
            pointInPoly(e.x, e.y - r, poly) ||
            pointInPoly(e.x + D, e.y + D, poly) ||
            pointInPoly(e.x + D, e.y - D, poly) ||
            pointInPoly(e.x - D, e.y + D, poly) ||
            pointInPoly(e.x - D, e.y - D, poly)
          ));
        if (!hit) continue;
        // Armored or invulnerable boss deflects trail — show flash but don't deal damage
        if (e.armored || e.bossVulnerable === false) {
          e.hitFlashTimer = CFG.BOSS_HIT_FLASH_S;
          continue;
        }
        e.health = (e.health ?? 1) - 1;
        e.hitFlashTimer = CFG.BOSS_HIT_FLASH_S;
        if (e.health <= 0) {
          e.alive = false;
          killedEnemies.push(e);
          encircleCount += 1;
        } else {
          hitBosses.push(e);
        }
        continue;
      }

      if (!pointInPoly(e.x, e.y, poly)) continue;

      if (e.armored) {
        // First hit strips armor; enemy survives
        e.armored = false;
      } else {
        e.alive = false;
        killedEnemies.push(e);
        encircleCount += e.type === 'elite' ? CFG.ELITE_ENCIRCLE_KILLS : 1;
      }
    }

    // Fire result when any enemy was killed or any boss took damage
    if (encircleCount === 0 && hitBosses.length === 0) break;

    const baseScore = 100 * encircleCount + (encircleCount >= 2 ? 50 * encircleCount : 0);

    if (encircleCount > 0) {
      state.flashPoly = poly.slice();
      state.flashPolyTimer = 0.3;
    }

    return { killedEnemies, hitBosses, polygon: poly, score: baseScore, encircleCount };
  }

  return null;
}
