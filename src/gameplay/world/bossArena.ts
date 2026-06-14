// bossArena.ts — Structural loop-anchors spawned during boss waves.
// NOTE: not in original — Phase 4.9 boss geography.
//
// On boss spawn, a ring of solid pillars + cover blocks is placed around arena
// center so the player always has structure to drift around during boss fights.
// Structures are added directly into PropsState (same chunk lookup used for all
// props/collision), then removed on boss death / wave_end.
//
// Chunk-registration note: getPropsNear queries a 200px radius. Pillars with
// radius > ~100 can span multiple chunks (chunk size = 500). We register each
// pillar in every chunk its circle overlaps so the collision lookup is reliable.

import { CFG } from '@core/config';
import type { BiomeStructureDef } from '@core/config';
import type { PropsState, Prop } from './propsSystem';

const CHUNK_SIZE = () => CFG.PROP_CHUNK_SIZE;  // 500

// Tags boss-arena props so they can be selectively removed
const BOSS_ARENA_TEXTURE = '__boss_pillar__';

interface PillarDef {
  x: number;
  y: number;
  radius: number;
}

// ── Layout ────────────────────────────────────────────────────────────────────

function _getPillarLayout(pattern: 'pursuer' | 'core' | 'reflector'): PillarDef[] {
  const cx = CFG.WORLD_W / 2;
  const cy = CFG.WORLD_H / 2;
  const pillars: PillarDef[] = [];

  // Central ring of 6 pillars — gives the player anchor points to loop around
  const ringR = 280;
  const pillarR = 55;
  const count = 6;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    pillars.push({ x: cx + Math.cos(angle) * ringR, y: cy + Math.sin(angle) * ringR, radius: pillarR });
  }

  // Pattern-specific cover blocks
  if (pattern === 'pursuer') {
    // 4 offset cover blocks — good for ducking a charge
    const coverR = 40;
    const coverDist = 520;
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI / 4 + (Math.PI / 2) * i;
      pillars.push({ x: cx + Math.cos(angle) * coverDist, y: cy + Math.sin(angle) * coverDist, radius: coverR });
    }
  } else if (pattern === 'core') {
    // No outer cover — the minion ring is the hazard, keep space open for looping
  } else if (pattern === 'reflector') {
    // 2 side pylons flanking the figure-eight path — narrow the usable corridor
    pillars.push({ x: cx - 200, y: cy - 350, radius: 45 });
    pillars.push({ x: cx + 200, y: cy + 350, radius: 45 });
  }

  return pillars;
}

// ── Chunk registration ────────────────────────────────────────────────────────

function _registerInChunks(prop: Prop, state: PropsState): void {
  const cs = CHUNK_SIZE();
  // Register in every chunk the circle overlaps
  const cxMin = Math.floor((prop.x - prop.radius) / cs);
  const cxMax = Math.floor((prop.x + prop.radius) / cs);
  const cyMin = Math.floor((prop.y - prop.radius) / cs);
  const cyMax = Math.floor((prop.y + prop.radius) / cs);
  for (let cx = cxMin; cx <= cxMax; cx++) {
    for (let cy = cyMin; cy <= cyMax; cy++) {
      const key = `${cx},${cy}`;
      if (!state.chunks.has(key)) state.chunks.set(key, []);
      state.chunks.get(key)!.push(prop);
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Spawn boss-arena pillars into the PropsState for the given boss pattern.
 * Called on `boss_spawn` event.
 */
export function spawnBossArena(
  state: PropsState,
  pattern: 'pursuer' | 'core' | 'reflector',
): void {
  const layout = _getPillarLayout(pattern);
  for (const def of layout) {
    const prop: Prop = {
      x: Math.max(60, Math.min(CFG.WORLD_W - 60, def.x)),
      y: Math.max(60, Math.min(CFG.WORLD_H - 60, def.y)),
      radius: def.radius,
      type: 'solid',
      textureKey: BOSS_ARENA_TEXTURE,
      nearMissCooldown: 0,
    };
    _registerInChunks(prop, state);
    state.allProps.push(prop);
  }
}

/**
 * Remove all boss-arena pillars from PropsState.
 * Called on boss death / wave_end.
 */
export function clearBossArena(state: PropsState): void {
  // Remove from allProps
  const before = state.allProps.length;
  for (let i = before - 1; i >= 0; i--) {
    if (state.allProps[i].textureKey === BOSS_ARENA_TEXTURE) {
      state.allProps.splice(i, 1);
    }
  }
  // Remove from every chunk bucket
  for (const bucket of state.chunks.values()) {
    for (let i = bucket.length - 1; i >= 0; i--) {
      if (bucket[i].textureKey === BOSS_ARENA_TEXTURE) {
        bucket.splice(i, 1);
      }
    }
  }
}

export { BOSS_ARENA_TEXTURE };

// ── Biome persistent geometry ─────────────────────────────────────────────────

const BIOME_STRUCTURE_TEXTURE = '__biome_structure__';

/**
 * Spawn the biome's persistent landmark structures into PropsState.
 * Called once per biome transition (in biomeSystem.applyTransition).
 * Registered in all overlapping chunks so getPropsNear is reliable.
 */
export function spawnBiomeStructures(state: PropsState, structures: BiomeStructureDef[]): void {
  for (const def of structures) {
    const prop: Prop = {
      x: Math.max(60, Math.min(CFG.WORLD_W - 60, def.x)),
      y: Math.max(60, Math.min(CFG.WORLD_H - 60, def.y)),
      radius: def.radius,
      type: def.type,
      textureKey: BIOME_STRUCTURE_TEXTURE,
      nearMissCooldown: 0,
      // slip/slow props also need duration + strength
      duration: def.type === 'slip' ? 1.5 : def.type === 'slow' ? 2.0 : undefined,
      strength: def.type === 'slip' ? 0.65 : def.type === 'slow' ? 0.5 : undefined,
    };
    _registerInChunks(prop, state);
    state.allProps.push(prop);
  }
}

/**
 * Remove all biome landmark structures from PropsState.
 * Called before spawning structures for the next biome.
 */
export function clearBiomeStructures(state: PropsState): void {
  const before = state.allProps.length;
  for (let i = before - 1; i >= 0; i--) {
    if (state.allProps[i].textureKey === BIOME_STRUCTURE_TEXTURE) {
      state.allProps.splice(i, 1);
    }
  }
  for (const bucket of state.chunks.values()) {
    for (let i = bucket.length - 1; i >= 0; i--) {
      if (bucket[i].textureKey === BIOME_STRUCTURE_TEXTURE) {
        bucket.splice(i, 1);
      }
    }
  }
}

export { BIOME_STRUCTURE_TEXTURE };
