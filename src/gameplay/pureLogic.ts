// pureLogic.ts — Ported from arena-drifter/logic.js.
// All remaining pure game logic functions.

import { CFG } from '@core/config';
import { dist, lerp } from '@core/utils';
import { type Rng, randFloat } from '@core/rng';
import type { EnemyType } from '@core/config';

// ── Interfaces ─────────────────────────────────────────────────

export interface ScrapPickup {
  x: number;
  y: number;
  life: number;
  type?: string;
}

export interface BoostZone {
  x: number;
  y: number;
  life: number;
}

export interface PlayerForPickup {
  x: number;
  y: number;
  radius: number;
  magnetRange: number;
  trailMagnet?: boolean;
}

export interface TrailPoint {
  x: number;
  y: number;
}

export interface WaveTiming {
  firstSpawn: number;
  spawnInterval: number;
  combatDuration: number;
  noBursts: boolean;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface NearMissResult {
  score: number;
  comboLevel: number;
  consecutiveNearMisses: number;
}

export interface PlayerForNearMiss {
  scoreMult: number;
  comboLevel: number;
  consecutiveNearMisses: number;
}

export interface PlayerForStreak {
  nearMissStreakTimer: number;
  consecutiveNearMisses: number;
}

export interface DriftComboResult {
  scoreDelta: number;
  nextTick: number;
}

export interface PlayerForDamage {
  hp: number;
  damageResist: number;
  driftShield?: boolean;
  invulnTimer: number;
  lastHitTimer: number;
}

export interface PlayerForShield {
  shield: boolean;
  invulnTimer: number;
}

export interface PlayerForRegen {
  hp: number;
  maxHp: number;
  hpRegen: number;
  lastHitTimer: number;
}

export interface PlayerForGhostFrame {
  ghostFrameTimer: number;
}

export interface EncircleResult {
  scoreDelta: number;
  comboLevel: number;
}

export interface RunStats {
  peakCombo: number;
  nearMissTotal: number;
  totalDriftTime: number;
  enemiesKilled: number;
}

export type RunStatEvent =
  | { type: 'near_miss'; comboLevel: number }
  | { type: 'encircle'; killCount: number; comboLevel: number }
  | { type: 'drift_tick'; drifting: boolean; dt: number }
  | { type: 'bomb'; killCount: number };

export interface DifficultyModifiers {
  hardMode: boolean;
  speedRush: boolean;
  fragile: boolean;
  doubleEnemies: boolean;
}

export interface UpgradeTapResult {
  selectedIndex: number;
  reroll: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ── Pickup / scrap ─────────────────────────────────────────────

export type PickupType = 'bomb' | 'trail_boost' | 'speed_pickup' | 'scrap';

export function selectPickupType(waveIndex: number, roll: number): PickupType {
  if (waveIndex >= 5 && roll < 0.04) return 'bomb';
  if (roll < 0.12) return 'trail_boost';
  if (roll < 0.20) return 'speed_pickup';
  return 'scrap';
}

export function collectPickupEvents(
  scraps: ScrapPickup[],
  boostZones: BoostZone[],
  player: PlayerForPickup,
  dt: number,
): string[] {
  const events: string[] = [];
  for (let i = scraps.length - 1; i >= 0; i--) {
    const s = scraps[i];
    if (player.magnetRange > 0) {
      const d = dist(s.x, s.y, player.x, player.y);
      if (d < player.magnetRange) {
        const pull = 200 * dt / Math.max(d, 1);
        s.x += (player.x - s.x) * pull;
        s.y += (player.y - s.y) * pull;
      }
    }
    if (dist(s.x, s.y, player.x, player.y) < CFG.SCRAP_RADIUS + player.radius + 10) {
      events.push(s.type ?? 'scrap');
      scraps[i] = scraps[scraps.length - 1];
      scraps.pop();
    }
  }

  for (let i = boostZones.length - 1; i >= 0; i--) {
    const bz = boostZones[i];
    if (dist(bz.x, bz.y, player.x, player.y) < CFG.BOOST_ZONE_RADIUS + player.radius) {
      events.push('boost');
      boostZones[i] = boostZones[boostZones.length - 1];
      boostZones.pop();
    }
  }

  return events;
}

export function updateScraps(
  scraps: ScrapPickup[],
  player: PlayerForPickup,
  dt: number,
  trailPoints: TrailPoint[],
): string[] {
  const events: string[] = [];
  for (let i = scraps.length - 1; i >= 0; i--) {
    const s = scraps[i];
    s.life -= dt;
    if (player.magnetRange > 0) {
      const d = dist(s.x, s.y, player.x, player.y);
      if (d < player.magnetRange) {
        const pull = 200 * dt / Math.max(d, 1);
        s.x += (player.x - s.x) * pull;
        s.y += (player.y - s.y) * pull;
      }
    }
    if (player.trailMagnet && trailPoints && trailPoints.length > 0) {
      for (let ti = 0; ti < trailPoints.length; ti += 5) {
        const tp = trailPoints[ti];
        const tdx = tp.x - s.x;
        const tdy = tp.y - s.y;
        const td = Math.hypot(tdx, tdy);
        if (td < 80 && td > 1) {
          s.x += (tdx / td) * 60 * dt;
          s.y += (tdy / td) * 60 * dt;
          break;
        }
      }
    }
    if (dist(s.x, s.y, player.x, player.y) < CFG.SCRAP_RADIUS + player.radius + 10) {
      events.push(s.type ?? 'scrap');
      scraps[i] = scraps[scraps.length - 1];
      scraps.pop();
      continue;
    }
    if (s.life <= 0) {
      scraps[i] = scraps[scraps.length - 1];
      scraps.pop();
    }
  }
  return events;
}

export function updateBoostZones(
  boostZones: BoostZone[],
  player: PlayerForPickup,
  dt: number,
): string[] {
  const events: string[] = [];
  for (let i = boostZones.length - 1; i >= 0; i--) {
    const bz = boostZones[i];
    bz.life -= dt;
    if (dist(bz.x, bz.y, player.x, player.y) < CFG.BOOST_ZONE_RADIUS + player.radius) {
      events.push('boost');
      boostZones[i] = boostZones[boostZones.length - 1];
      boostZones.pop();
      continue;
    }
    if (bz.life <= 0) {
      boostZones[i] = boostZones[boostZones.length - 1];
      boostZones.pop();
    }
  }
  return events;
}

// ── Wave timing ────────────────────────────────────────────────

export function computeWaveTiming(waveIndex: number): WaveTiming {
  const ramp = Math.min(1, (waveIndex - 1) / 4);
  const firstSpawn = lerp(CFG.FIRST_SPAWN_INITIAL, CFG.FIRST_SPAWN_MIN, ramp);
  const spawnInterval = lerp(CFG.SPAWN_INTERVAL_INITIAL, CFG.SPAWN_INTERVAL_MIN, ramp);
  const combatDuration = Math.min(
    CFG.WAVE_COMBAT_MAX,
    CFG.WAVE_COMBAT_WAVE1 + CFG.WAVE_TIME_GROWTH * (waveIndex - 1),
  );
  const noBursts = waveIndex === 1;
  return { firstSpawn, spawnInterval, combatDuration, noBursts };
}

export function computeHordeCount(waveIndex: number): number {
  return Math.min(CFG.HORDE_MAX_COUNT, CFG.HORDE_BASE_COUNT + Math.floor(waveIndex * CFG.HORDE_WAVE_GROWTH));
}

export function rollHordeTrigger(rng: Rng): number {
  return randFloat(rng, CFG.HORDE_TRIGGER_MIN, CFG.HORDE_TRIGGER_MAX);
}

export function shouldTriggerHorde(waveTimer: number, combatDuration: number, hordeTrigger: number): boolean {
  return waveTimer >= combatDuration * hordeTrigger;
}

// ── Enemy pool ─────────────────────────────────────────────────

export function getEnemyPool(score: number): EnemyType[] {
  const pool: EnemyType[] = ['chaser'];
  if (score >= 1000) pool.push('interceptor');
  if (score >= 1500) pool.push('drifter');
  if (score >= 2000) pool.push('blocker');
  if (score >= 2500) pool.push('flanker');
  if (score >= 3000) pool.push('bomber');
  return pool;
}

export function shouldSpawnElite(waveIndex: number, roll: number): boolean {
  return waveIndex >= 4 && roll < 0.12;
}

export function computeFlankTarget(
  px: number,
  py: number,
  pvx: number,
  pvy: number,
  flankSide: number,
): Vec2 {
  const pSpeed = Math.hypot(pvx, pvy);
  if (pSpeed < 50) return { x: px, y: py };
  const perpX = -pvy / pSpeed * flankSide;
  const perpY = pvx / pSpeed * flankSide;
  return { x: px + perpX * 200, y: py + perpY * 200 };
}

export function computeBlockerTarget(trailPoints: TrailPoint[] | null): Vec2 | null {
  if (!trailPoints || trailPoints.length === 0) return null;
  let sx = 0;
  let sy = 0;
  const step = Math.max(1, Math.floor(trailPoints.length / 50));
  let count = 0;
  for (let i = 0; i < trailPoints.length; i += step) {
    sx += trailPoints[i].x;
    sy += trailPoints[i].y;
    count++;
  }
  return { x: sx / count, y: sy / count };
}

// ── Scoring / combat ───────────────────────────────────────────

export function applyNearMiss(score: number, player: PlayerForNearMiss, type: string): NearMissResult {
  const pts = type === 'enemy' ? CFG.NEAR_MISS_ENEMY_PTS : CFG.NEAR_MISS_HAZARD_PTS;
  let nextScore = score + pts * player.scoreMult;
  const nextCombo = Math.min(CFG.MAX_COMBO, (player.comboLevel || 0) + 1);
  const streak = (player.consecutiveNearMisses || 0) + 1;
  if (streak >= 3) {
    const streakBonus = 50 * streak;
    nextScore += streakBonus * player.scoreMult;
  }
  return {
    score: nextScore,
    comboLevel: nextCombo,
    consecutiveNearMisses: streak,
  };
}

export function updateNearMissStreak(player: PlayerForStreak, dt: number): void {
  if (player.nearMissStreakTimer > 0) {
    player.nearMissStreakTimer -= dt;
    if (player.nearMissStreakTimer <= 0) player.consecutiveNearMisses = 0;
  }
}

export function applyComboDecay(comboLevel: number, comboMaster: boolean, dt: number): number {
  const comboDecay = comboMaster ? 1.0 : 2.0;
  return Math.max(0, comboLevel - dt * comboDecay);
}

export function driftComboScoreTick(
  driftTime: number,
  lastDriftComboTick: number,
  comboLevel: number,
): DriftComboResult {
  const ticks = Math.floor(driftTime / CFG.DRIFT_COMBO_INTERVAL);
  if (ticks > lastDriftComboTick) {
    const pts = CFG.DRIFT_COMBO_BASE * Math.floor(comboLevel + 1);
    return { scoreDelta: pts, nextTick: ticks };
  }
  return { scoreDelta: 0, nextTick: lastDriftComboTick };
}

export function computeCollisionDamage(baseDmg: number, waveIndex: number): number {
  const waveScale = waveIndex > 5
    ? Math.min(CFG.DMG_SCALE_MAX, 1 + CFG.DMG_SCALE_PER_WAVE * (waveIndex - 5))
    : 1;
  return Math.round(baseDmg * waveScale);
}

export function applyPlayerDamage(player: PlayerForDamage, dmg: number, drifting: boolean): number {
  let finalDmg = Math.round(dmg * (1 - (player.damageResist || 0)));
  if (player.driftShield && drifting) finalDmg = Math.round(finalDmg * 0.6);
  finalDmg = Math.max(finalDmg, 1);
  player.hp -= finalDmg;
  player.invulnTimer = CFG.HIT_INVULN;
  player.lastHitTimer = 0;
  return finalDmg;
}

export function applyShieldBreak(player: PlayerForShield): void {
  player.shield = false;
  player.invulnTimer = CFG.SHIELD_INVULN;
}

export function applyHpRegen(player: PlayerForRegen, dt: number): void {
  player.lastHitTimer += dt;
  if (player.hpRegen > 0 && player.lastHitTimer > CFG.HP_REGEN_DELAY) {
    player.hp = Math.min(player.hp + player.hpRegen * dt, player.maxHp);
  }
}

export function applyGhostFrameNearMiss(player: PlayerForGhostFrame, hasGhostFrame: boolean): void {
  if (hasGhostFrame) player.ghostFrameTimer = 0.3;
}

export function computeEncircleOutcome(
  killCount: number,
  comboLevel: number,
  scoreMult: number,
  encircleScoreBonus: number,
): EncircleResult {
  const comboMult = Math.max(1, Math.floor(comboLevel + 1));
  const baseScore = 100 * killCount;
  const bonus = killCount >= 2 ? 50 * killCount : 0;
  const encircleBonus = encircleScoreBonus || 1;
  const total = Math.floor((baseScore + bonus) * comboMult * encircleBonus);
  const newCombo = Math.min(CFG.MAX_COMBO, comboLevel + 2 * killCount);
  return {
    scoreDelta: total * scoreMult,
    comboLevel: newCombo,
  };
}

export function applyDriftShield(dmg: number, drifting: boolean, hasDriftShield: boolean): number {
  if (hasDriftShield && drifting) return Math.max(1, Math.round(dmg * 0.6));
  return dmg;
}

export function applyComboHeal(
  oldLevel: number,
  newLevel: number,
  hasComboHeal: boolean,
  hp: number,
  maxHp: number,
): number {
  if (!hasComboHeal) return hp;
  const milestones = [3, 5, 8];
  for (const m of milestones) {
    if (Math.floor(oldLevel) < m && Math.floor(newLevel) >= m) {
      const healAmt = m >= 8 ? 25 : m >= 5 ? 15 : 10;
      return Math.min(maxHp, hp + healAmt);
    }
  }
  return hp;
}

export function applyBombZoneDamage(dmg: number, dt: number, damageResist: number): number {
  const raw = Math.round(dmg * dt);
  if (raw < 1) return 0;
  return Math.max(1, Math.round(raw * (1 - (damageResist || 0))));
}

// ── Stats ──────────────────────────────────────────────────────

export function makeRunStats(): RunStats {
  return { peakCombo: 0, nearMissTotal: 0, totalDriftTime: 0, enemiesKilled: 0 };
}

export function updateRunStats(stats: RunStats, event: RunStatEvent): { comboLevel?: number } {
  switch (event.type) {
    case 'near_miss': {
      stats.nearMissTotal++;
      const newCombo = Math.min(CFG.MAX_COMBO, (event.comboLevel || 0) + 1);
      stats.peakCombo = Math.max(stats.peakCombo, Math.floor(newCombo));
      return { comboLevel: newCombo };
    }
    case 'encircle': {
      const killCount = event.killCount || 0;
      stats.enemiesKilled += killCount;
      const newCombo = Math.min(CFG.MAX_COMBO, (event.comboLevel || 0) + 2 * killCount);
      stats.peakCombo = Math.max(stats.peakCombo, Math.floor(newCombo));
      return { comboLevel: newCombo };
    }
    case 'drift_tick': {
      if (event.drifting) stats.totalDriftTime += event.dt;
      return {};
    }
    case 'bomb': {
      stats.enemiesKilled += event.killCount || 0;
      return {};
    }
  }
}

// ── Geometry ───────────────────────────────────────────────────

export function pointInPoly(x: number, y: number, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// ── Modifiers ──────────────────────────────────────────────────

export function computeModifierScoreMult(modifiers: DifficultyModifiers): number {
  let mult = 1;
  if (modifiers.hardMode) mult *= 1.5;
  if (modifiers.speedRush) mult *= 1.3;
  if (modifiers.fragile) mult *= 1.4;
  if (modifiers.doubleEnemies) mult *= 1.6;
  return mult;
}

// ── Hit testing ────────────────────────────────────────────────

export function hitTestUpgradeTap(
  tap: Vec2,
  cardBounds: Rect[],
  rerollBounds: Rect | null,
): UpgradeTapResult {
  const within = (p: Vec2, r: Rect | null): boolean =>
    r != null && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

  for (let i = 0; i < cardBounds.length; i++) {
    if (within(tap, cardBounds[i])) return { selectedIndex: i, reroll: false };
  }
  if (within(tap, rerollBounds)) return { selectedIndex: -1, reroll: true };
  return { selectedIndex: -1, reroll: false };
}
