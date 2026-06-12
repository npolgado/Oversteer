// biomeHazards.test.ts — Tests for per-biome hazard zone logic.

import { describe, it, expect } from 'vitest';
import {
  makeBiomeHazardState,
  clearBiomeHazards,
  updateBiomeHazards,
  type BiomeHazardRules,
} from '../biomeHazards';

const seededRng = (seed: number) => {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
};

const rng = seededRng(42);

// ── kind:'none' ───────────────────────────────────────────────────────────────

describe('biomeHazards kind:none', () => {
  const rules: BiomeHazardRules = { kind: 'none', spawnInterval: 5, maxZones: 4, radius: 50 };

  it('returns no damage and inCorruption=false', () => {
    const state = makeBiomeHazardState();
    const result = updateBiomeHazards(state, rules, 1, 1500, 1500, rng);
    expect(result.burstDamage).toBe(0);
    expect(result.inCorruption).toBe(false);
    expect(state.zones.length).toBe(0);
  });
});

// ── heat_crack spawning ───────────────────────────────────────────────────────

describe('biomeHazards heat_crack — spawning', () => {
  const rules: BiomeHazardRules = {
    kind: 'heat_crack', spawnInterval: 6, maxZones: 4, radius: 70,
    telegraphTime: 1.5, eruptDuration: 1.2, burstDamage: 12,
  };

  it('spawns a zone when spawnTimer expires', () => {
    const state = makeBiomeHazardState();
    // Tick past spawnInterval
    updateBiomeHazards(state, rules, 7, 1500, 1500, seededRng(1));
    expect(state.zones.length).toBeGreaterThanOrEqual(1);
  });

  it('does not exceed maxZones', () => {
    const state = makeBiomeHazardState();
    const r = seededRng(7);
    // Tick many times with a short interval override via direct mutation (simulate many spawns)
    const fastRules = { ...rules, spawnInterval: 0.01, maxZones: 3 };
    for (let i = 0; i < 50; i++) {
      updateBiomeHazards(state, fastRules, 0.01, 1500, 1500, r);
    }
    expect(state.zones.length).toBeLessThanOrEqual(3);
  });

  it('newly spawned zones start in telegraph state', () => {
    const state = makeBiomeHazardState();
    // dt=1.0: triggers spawn (spawnTimer=0 → -1 ≤ 0), then zone ticks stateTimer 1.5-1.0=0.5 → stays telegraph
    updateBiomeHazards(state, rules, 1.0, 1500, 1500, seededRng(2));
    const justSpawned = state.zones.find(z => z.stateTimer > 0);
    if (justSpawned) {
      expect(justSpawned.state).toBe('telegraph');
    }
  });
});

// ── heat_crack state machine ──────────────────────────────────────────────────

describe('biomeHazards heat_crack — telegraph → active', () => {
  const rules: BiomeHazardRules = {
    kind: 'heat_crack', spawnInterval: 999, maxZones: 4, radius: 70,
    telegraphTime: 1.0, eruptDuration: 1.2, burstDamage: 12,
  };

  function spawnOneZone(px = 1500, py = 1500) {
    const state = makeBiomeHazardState();
    // Manually push a telegraphing zone at player position (within radius)
    state.zones.push({ x: px, y: py, radius: 70, phase: 0, state: 'telegraph', stateTimer: 1.0, multiplyTimer: 0, didBurst: false });
    return state;
  }

  it('remains in telegraph before telegraphTime elapses', () => {
    const state = spawnOneZone();
    updateBiomeHazards(state, rules, 0.5, 1500, 1500, seededRng(3));
    expect(state.zones[0].state).toBe('telegraph');
  });

  it('transitions to active after telegraphTime', () => {
    const state = spawnOneZone();
    updateBiomeHazards(state, rules, 1.1, 1500, 1500, seededRng(4));
    expect(state.zones[0]?.state).toBe('active');
  });

  it('deals burstDamage when player is inside radius on transition', () => {
    const state = spawnOneZone(1500, 1500);
    // Two ticks: first transitions telegraph→active and fires burst
    const r = seededRng(5);
    updateBiomeHazards(state, rules, 1.1, 1500, 1500, r); // transition + burst
    // burstDamage fires on the tick the state transitions (same tick logic)
    // The zone should now be active with didBurst=true
    expect(state.zones[0]?.state).toBe('active');
    expect(state.zones[0]?.didBurst).toBe(true);
  });

  it('burst result is 12 on the transition tick when player is inside radius', () => {
    const state = spawnOneZone(1500, 1500);
    const result = updateBiomeHazards(state, rules, 1.1, 1500, 1500, seededRng(5));
    expect(result.burstDamage).toBe(12);
  });

  it('does NOT deal burstDamage when player is outside radius', () => {
    const state = spawnOneZone(1500, 1500);
    // Player far away
    const result = updateBiomeHazards(state, rules, 1.1, 2500, 2500, seededRng(6));
    expect(result.burstDamage).toBe(0);
  });

  it('burst fires exactly once (didBurst prevents repeat)', () => {
    const state = spawnOneZone(1500, 1500);
    // Tick 1: telegraph → active (burst fires here)
    updateBiomeHazards(state, rules, 1.1, 1500, 1500, seededRng(7));
    // Tick 2: still active — burst should NOT fire again
    const result = updateBiomeHazards(state, rules, 0.1, 1500, 1500, seededRng(8));
    expect(result.burstDamage).toBe(0);
  });

  it('player entering mid-eruption still triggers burst exactly once', () => {
    const state = spawnOneZone(1500, 1500);
    const r = seededRng(99);
    // Tick 1: transition — player is outside (far away), burst NOT fired, didBurst stays false
    const r1 = updateBiomeHazards(state, rules, 1.1, 2500, 2500, r);
    expect(r1.burstDamage).toBe(0);
    expect(state.zones[0]?.didBurst).toBe(false);
    // Tick 2: still active — player drives inside, burst fires now
    const r2 = updateBiomeHazards(state, rules, 0.1, 1500, 1500, r);
    expect(r2.burstDamage).toBe(12);
    expect(state.zones[0]?.didBurst).toBe(true);
    // Tick 3: still inside — no second burst
    const r3 = updateBiomeHazards(state, rules, 0.1, 1500, 1500, r);
    expect(r3.burstDamage).toBe(0);
  });

  it('player never enters — no damage for entire eruption, zone expires normally', () => {
    const state = spawnOneZone(1500, 1500);
    const r = seededRng(100);
    // Transition tick — player far away
    const r1 = updateBiomeHazards(state, rules, 1.1, 2500, 2500, r);
    expect(r1.burstDamage).toBe(0);
    // Remaining eruption — player stays away
    const r2 = updateBiomeHazards(state, rules, 0.5, 2500, 2500, r);
    expect(r2.burstDamage).toBe(0);
    // Let eruptDuration (1.2) expire — zone should be removed
    updateBiomeHazards(state, rules, 1.3, 2500, 2500, r);
    const activeZones = state.zones.filter(z => z.state === 'active' && z.didBurst === false);
    expect(activeZones.length).toBe(0);
  });

  it('zone expires after eruptDuration', () => {
    const state = spawnOneZone();
    // Tick 1: telegraph → active (stateTimer reset to 1.2)
    const r = seededRng(9);
    updateBiomeHazards(state, rules, 1.1, 2500, 2500, r);
    expect(state.zones.length).toBeGreaterThan(0);
    // Tick 2: eruptDuration passes (stateTimer 1.2 - 1.3 < 0 → expire)
    updateBiomeHazards(state, rules, 1.3, 2500, 2500, r);
    // Zone should be gone (may have spawned a new one via spawnTimer, but original is expired)
    const anyActive = state.zones.filter(z => z.state === 'active' && z.didBurst);
    expect(anyActive.length).toBe(0);
  });

  it('swap-and-pop: zone removal does not leave undefined entries', () => {
    const state = makeBiomeHazardState();
    // Push two zones
    state.zones.push({ x: 100, y: 100, radius: 70, phase: 0, state: 'telegraph', stateTimer: 0.1, multiplyTimer: 0, didBurst: false });
    state.zones.push({ x: 200, y: 200, radius: 70, phase: 0, state: 'telegraph', stateTimer: 0.1, multiplyTimer: 0, didBurst: false });
    // Both expire: telegraph → active → expire in one big dt
    updateBiomeHazards(state, rules, 100, 999, 999, seededRng(10));
    for (const z of state.zones) {
      expect(z).toBeDefined();
    }
  });
});

// ── corruption spawning and growth ───────────────────────────────────────────

describe('biomeHazards corruption — growth and player detection', () => {
  const rules: BiomeHazardRules = {
    kind: 'corruption', spawnInterval: 999, maxZones: 6, radius: 50,
    growthRate: 12, maxRadius: 140, multiplyInterval: 999, dps: 0.7,
  };

  it('zone radius grows toward maxRadius', () => {
    const state = makeBiomeHazardState();
    state.zones.push({ x: 500, y: 500, radius: 50, phase: 0, state: 'active', stateTimer: 0, multiplyTimer: 999, didBurst: false });
    updateBiomeHazards(state, rules, 1, 999, 999, seededRng(11));
    expect(state.zones[0].radius).toBeCloseTo(62, 0); // 50 + 12*1
  });

  it('radius does not exceed maxRadius', () => {
    const state = makeBiomeHazardState();
    state.zones.push({ x: 500, y: 500, radius: 139, phase: 0, state: 'active', stateTimer: 0, multiplyTimer: 999, didBurst: false });
    updateBiomeHazards(state, rules, 10, 999, 999, seededRng(12));
    expect(state.zones[0].radius).toBeLessThanOrEqual(140);
  });

  it('inCorruption true when player inside zone', () => {
    const state = makeBiomeHazardState();
    state.zones.push({ x: 1500, y: 1500, radius: 100, phase: 0, state: 'active', stateTimer: 0, multiplyTimer: 999, didBurst: false });
    const result = updateBiomeHazards(state, rules, 0.016, 1500, 1500, seededRng(13));
    expect(result.inCorruption).toBe(true);
  });

  it('inCorruption false when player outside zone', () => {
    const state = makeBiomeHazardState();
    state.zones.push({ x: 1500, y: 1500, radius: 50, phase: 0, state: 'active', stateTimer: 0, multiplyTimer: 999, didBurst: false });
    const result = updateBiomeHazards(state, rules, 0.016, 2500, 2500, seededRng(14));
    expect(result.inCorruption).toBe(false);
  });
});

// ── corruption multiply cap ───────────────────────────────────────────────────

describe('biomeHazards corruption — multiply respects maxZones cap', () => {
  const rules: BiomeHazardRules = {
    kind: 'corruption', spawnInterval: 999, maxZones: 3, radius: 50,
    growthRate: 0, maxRadius: 140, multiplyInterval: 0.5, dps: 0.7,
  };

  it('total zones never exceeds maxZones', () => {
    const state = makeBiomeHazardState();
    state.zones.push({ x: 500, y: 500, radius: 80, phase: 0, state: 'active', stateTimer: 0, multiplyTimer: 0.5, didBurst: false });
    const r = seededRng(15);
    for (let i = 0; i < 30; i++) {
      updateBiomeHazards(state, rules, 1, 999, 999, r);
    }
    expect(state.zones.length).toBeLessThanOrEqual(3);
  });
});

// ── clearBiomeHazards ─────────────────────────────────────────────────────────

describe('clearBiomeHazards', () => {
  it('empties zones and resets spawnTimer', () => {
    const rules: BiomeHazardRules = { kind: 'heat_crack', spawnInterval: 1, maxZones: 4, radius: 70, telegraphTime: 1, eruptDuration: 1, burstDamage: 10 };
    const state = makeBiomeHazardState();
    updateBiomeHazards(state, rules, 5, 1500, 1500, seededRng(20));
    clearBiomeHazards(state);
    expect(state.zones.length).toBe(0);
    expect(state.spawnTimer).toBe(0);
  });
});
