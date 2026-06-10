// biomeHazards.ts — Per-biome hazard zone logic (heat cracks, corruption zones).
// Pure module: no Pixi, no globals. Injected rng for deterministic tests.
// NOTE: not in original — Phase 4.5 biome differentiation system.

import { CFG } from '@core/config';
import type { BiomeHazardRules } from '@core/config';

export interface BiomeHazardZone {
  x: number;
  y: number;
  radius: number;
  phase: number;
  /** 'telegraph' = warning phase (no damage); 'active' = live */
  state: 'telegraph' | 'active';
  stateTimer: number;
  /** Corruption only: timer to next multiplication */
  multiplyTimer: number;
  /** Heat crack only: burst damage applied exactly once */
  didBurst: boolean;
}

export interface BiomeHazardState {
  zones: BiomeHazardZone[];
  spawnTimer: number;
}

export type BiomeHazardResult = {
  burstDamage: number;
  inCorruption: boolean;
};

// Module-scoped result object — avoids per-frame allocation on the hot path
const _result: BiomeHazardResult = { burstDamage: 0, inCorruption: false };

export function makeBiomeHazardState(): BiomeHazardState {
  return { zones: [], spawnTimer: 0 };
}

export function clearBiomeHazards(state: BiomeHazardState): void {
  state.zones.length = 0;
  state.spawnTimer = 0;
}

function _spawnZone(
  state: BiomeHazardState,
  rules: BiomeHazardRules,
  px: number,
  py: number,
  rng: () => number,
): void {
  if (state.zones.length >= rules.maxZones) return;
  const angle = rng() * Math.PI * 2;
  const dist = 200 + rng() * 400;
  const x = Math.max(60, Math.min(CFG.WORLD_W - 60, px + Math.cos(angle) * dist));
  const y = Math.max(60, Math.min(CFG.WORLD_H - 60, py + Math.sin(angle) * dist));
  state.zones.push({
    x, y,
    radius: rules.radius,
    phase: 0,
    state: rules.kind === 'heat_crack' ? 'telegraph' : 'active',
    stateTimer: rules.kind === 'heat_crack' ? (rules.telegraphTime ?? 1.5) : 0,
    multiplyTimer: rules.multiplyInterval ?? 0,
    didBurst: false,
  });
}

/**
 * Update biome hazard zones each frame.
 * Returns a result object (stable reference, not a new allocation) with:
 *   burstDamage: total damage from heat crack eruptions this frame (0 if not hit)
 *   inCorruption: true if player is inside any active corruption zone (for DPS in gameLoop)
 *
 * Caller (gameLoop) is responsible for applying burstDamage and corruption DPS to playerState,
 * respecting invuln/ghostFrame/damageResist.
 */
export function updateBiomeHazards(
  state: BiomeHazardState,
  rules: BiomeHazardRules,
  dt: number,
  px: number,
  py: number,
  rng: () => number,
): BiomeHazardResult {
  _result.burstDamage = 0;
  _result.inCorruption = false;

  if (rules.kind === 'none') return _result;

  // Spawn timer
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    state.spawnTimer = rules.spawnInterval;
    _spawnZone(state, rules, px, py, rng);
  }

  const zones = state.zones;
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    z.phase += dt;

    if (rules.kind === 'heat_crack') {
      z.stateTimer -= dt;
      if (z.state === 'telegraph' && z.stateTimer <= 0) {
        z.state = 'active';
        z.stateTimer = rules.eruptDuration ?? 1.2;
      }
      // Separate check (not else-if) so active logic runs on the same tick as transition
      if (z.state === 'active') {
        if (!z.didBurst) {
          const dx = px - z.x;
          const dy = py - z.y;
          if (dx * dx + dy * dy < z.radius * z.radius) {
            _result.burstDamage += rules.burstDamage ?? 12;
          }
          z.didBurst = true;
        }
        // Expire check uses remaining time after the eruptDuration (stateTimer was reset at transition)
        // For large dt spanning both phases: stateTimer reset to eruptDuration but not further decremented here.
        // Expiry fires on a subsequent tick once stateTimer ticks down normally.
        if (z.stateTimer <= 0) {
          zones[i] = zones[zones.length - 1];
          zones.pop();
          continue;
        }
      }
    } else if (rules.kind === 'corruption') {
      // Grow radius toward maxRadius
      const maxR = rules.maxRadius ?? 140;
      if (z.radius < maxR) {
        z.radius = Math.min(maxR, z.radius + (rules.growthRate ?? 12) * dt);
      }

      // Check player inside
      const dx = px - z.x;
      const dy = py - z.y;
      if (dx * dx + dy * dy < z.radius * z.radius) {
        _result.inCorruption = true;
      }

      // Multiply at edge toward cap
      if (rules.multiplyInterval && rules.multiplyInterval > 0) {
        z.multiplyTimer -= dt;
        if (z.multiplyTimer <= 0) {
          z.multiplyTimer = rules.multiplyInterval;
          if (zones.length < rules.maxZones) {
            const angle = rng() * Math.PI * 2;
            const spawnX = Math.max(60, Math.min(CFG.WORLD_W - 60, z.x + Math.cos(angle) * z.radius));
            const spawnY = Math.max(60, Math.min(CFG.WORLD_H - 60, z.y + Math.sin(angle) * z.radius));
            zones.push({
              x: spawnX, y: spawnY,
              radius: rules.radius,
              phase: 0,
              state: 'active',
              stateTimer: 0,
              multiplyTimer: rules.multiplyInterval,
              didBurst: false,
            });
          }
        }
      }
    }
  }

  return _result;
}
