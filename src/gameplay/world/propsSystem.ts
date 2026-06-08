// propsSystem.ts — Props state, generation, collision, near-miss, and spatial lookup.
// Props are generated once per session and never change at runtime.

import { CFG } from '@core/config';
import type { PropDef } from '@core/config';
import { makeRng } from '@core/rng';
import type { PlayerState } from '@gameplay/player/playerState';
import { getPlayerRadius } from '@gameplay/player/playerState';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PropCollisionType = 'solid' | 'slow' | 'slip' | 'decoration';

export interface Prop {
  x: number;
  y: number;
  radius: number;
  type: PropCollisionType;
  textureKey: string;
  nearMissCooldown: number;
  duration?: number;
  strength?: number;
}

export interface PropsState {
  chunks: Map<string, Prop[]>;
  allProps: Prop[];
}

export interface PropCollisionEvent {
  type: 'solid_bounce' | 'slow_enter' | 'slip_enter';
  x: number;
  y: number;
}

// Minimal structural type for enemy prop collision — full EnemyState satisfies this
export interface EnemyForProp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  wallHit: boolean;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function makePropsState(): PropsState {
  return { chunks: new Map(), allProps: [] };
}

// ── Generation ────────────────────────────────────────────────────────────────

function _generateChunk(cx: number, cy: number, state: PropsState, pool: PropDef[]): void {
  const cs = CFG.PROP_CHUNK_SIZE;
  const seed = cx * 7919 + cy * 104729;
  const rng = makeRng(seed);

  const count = Math.floor(cs * cs * CFG.PROP_DENSITY);
  const key = `${cx},${cy}`;

  for (let i = 0; i < count; i++) {
    const rawX = cx * cs + rng.next() * cs;
    const rawY = cy * cs + rng.next() * cs;
    const x = Math.max(40, Math.min(CFG.WORLD_W - 40, rawX));
    const y = Math.max(40, Math.min(CFG.WORLD_H - 40, rawY));

    const dx = x - CFG.WORLD_W / 2;
    const dy = y - CFG.WORLD_H / 2;
    if (dx * dx + dy * dy < CFG.PROP_MIN_DIST * CFG.PROP_MIN_DIST) continue;

    const def = pool[Math.floor(rng.next() * pool.length)];
    const prop: Prop = {
      x,
      y,
      radius: def.radius,
      type: def.type,
      textureKey: def.image,
      nearMissCooldown: 0,
      duration: def.duration,
      strength: def.strength,
    };

    if (!state.chunks.has(key)) state.chunks.set(key, []);
    state.chunks.get(key)!.push(prop);
    state.allProps.push(prop);
  }
}

export function generateProps(state: PropsState, pool?: PropDef[]): void {
  const defPool = pool ?? CFG.PROP_POOL;
  const weightedPool = defPool.flatMap((def) => Array<PropDef>(def.weight).fill(def));
  if (weightedPool.length === 0) return;

  const cs = CFG.PROP_CHUNK_SIZE;
  const cols = Math.ceil(CFG.WORLD_W / cs);
  const rows = Math.ceil(CFG.WORLD_H / cs);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      _generateChunk(cx, cy, state, weightedPool);
    }
  }
}

/** Clear and re-seed props from a new pool (used on biome transition). */
export function regenerateProps(state: PropsState, pool: PropDef[]): void {
  state.chunks.clear();
  state.allProps.length = 0;
  generateProps(state, pool);
}

// ── Spatial lookup ────────────────────────────────────────────────────────────

export function getPropsNear(state: PropsState, x: number, y: number, range: number): Prop[] {
  const cs = CFG.PROP_CHUNK_SIZE;
  const cxMin = Math.floor((x - range) / cs);
  const cxMax = Math.floor((x + range) / cs);
  const cyMin = Math.floor((y - range) / cs);
  const cyMax = Math.floor((y + range) / cs);
  const result: Prop[] = [];
  for (let cx = cxMin; cx <= cxMax; cx++) {
    for (let cy = cyMin; cy <= cyMax; cy++) {
      const props = state.chunks.get(`${cx},${cy}`);
      if (props) result.push(...props);
    }
  }
  return result;
}

// ── Player collision ──────────────────────────────────────────────────────────

export function checkPlayerCollision(state: PropsState, player: PlayerState): Prop[] {
  const pr = getPlayerRadius(player);
  const nearby = getPropsNear(state, player.x, player.y, 200);
  const hits: Prop[] = [];
  for (const prop of nearby) {
    if (prop.type === 'decoration') continue;
    const dx = player.x - prop.x;
    const dy = player.y - prop.y;
    const r2 = (pr + prop.radius) ** 2;
    if (dx * dx + dy * dy < r2) hits.push(prop);
  }
  return hits;
}

export function handlePropCollisions(hits: Prop[], player: PlayerState): PropCollisionEvent[] {
  const events: PropCollisionEvent[] = [];
  const pr = getPlayerRadius(player);
  for (const prop of hits) {
    if (prop.type === 'solid') {
      const dx = player.x - prop.x;
      const dy = player.y - prop.y;
      const dist = Math.hypot(dx, dy) || 1;
      const overlap = pr + prop.radius - dist;
      // Guard: skip if a prior pushout already resolved this prop (stale hits list)
      if (overlap <= 0) continue;
      player.x += (dx / dist) * overlap;
      player.y += (dy / dist) * overlap;
      const nx = dx / dist;
      const ny = dy / dist;
      const dot = player.vx * nx + player.vy * ny;
      if (dot < 0) {
        player.vx -= dot * nx;
        player.vy -= dot * ny;
        player.vx *= CFG.PROP_PLAYER_BOUNCE;
        player.vy *= CFG.PROP_PLAYER_BOUNCE;
      }
      player.wallHit = true;
      events.push({ type: 'solid_bounce', x: prop.x + nx * prop.radius, y: prop.y + ny * prop.radius });
    } else if (prop.type === 'slow') {
      player.slowTimer = prop.duration ?? 2.0;
      player.slowStrength = prop.strength ?? 0.5;
      events.push({ type: 'slow_enter', x: prop.x, y: prop.y });
    } else if (prop.type === 'slip') {
      player.slipTimer = prop.duration ?? 1.5;
      player.slipStrength = prop.strength ?? 0.6;
      events.push({ type: 'slip_enter', x: prop.x, y: prop.y });
    }
  }
  return events;
}

// ── Enemy prop collision ──────────────────────────────────────────────────────

export function checkEnemyPropCollision(state: PropsState, enemy: EnemyForProp): void {
  const nearby = getPropsNear(state, enemy.x, enemy.y, 200);
  for (const prop of nearby) {
    if (prop.type !== 'solid') continue;
    const dx = enemy.x - prop.x;
    const dy = enemy.y - prop.y;
    const d = Math.hypot(dx, dy) || 1;
    const sumR = enemy.radius + prop.radius;
    if (d >= sumR) continue;
    const overlap = sumR - d;
    enemy.x += (dx / d) * overlap;
    enemy.y += (dy / d) * overlap;
    const nx = dx / d;
    const ny = dy / d;
    const dot = enemy.vx * nx + enemy.vy * ny;
    if (dot < 0) {
      enemy.vx -= dot * nx;
      enemy.vy -= dot * ny;
      enemy.vx *= CFG.PROP_ENEMY_BOUNCE;
      enemy.vy *= CFG.PROP_ENEMY_BOUNCE;
    }
    enemy.wallHit = true;
  }
}

// ── Near-miss ─────────────────────────────────────────────────────────────────

export function checkNearMissProp(state: PropsState, player: PlayerState): boolean {
  if (!player.drifting) return false;
  const pr = getPlayerRadius(player);
  const nearby = getPropsNear(state, player.x, player.y, 300);
  for (const prop of nearby) {
    if (prop.type !== 'solid') continue;
    if (prop.nearMissCooldown > 0) continue;
    const dx = player.x - prop.x;
    const dy = player.y - prop.y;
    const d2 = dx * dx + dy * dy;
    const collR = pr + prop.radius;
    const nearR = collR + CFG.NEAR_MISS_HAZARD;
    if (d2 > collR * collR && d2 < nearR * nearR) {
      prop.nearMissCooldown = CFG.NEAR_MISS_COOLDOWN;
      return true;
    }
  }
  return false;
}

export function updatePropCooldowns(state: PropsState, dt: number): void {
  for (const prop of state.allProps) {
    if (prop.nearMissCooldown > 0) prop.nearMissCooldown -= dt;
  }
}
