import { describe, it, expect } from 'vitest';
import { CFG } from '@core/config';
import { computeWaveTiming, updateBoostZones } from '@gameplay/pureLogic';
import {
  makeWaveState,
  startWave,
  updateWave,
  computeSpeedBonus,
  tickBoostZoneSpawn,
  isBossWave,
  getBossPattern,
  type WaveEvent,
} from '../waveManager';
import { HazardZone } from '../waveManager';

// ── computeWaveTiming (already covered in pureLogic tests, but verify key values) ──

describe('computeWaveTiming', () => {
  it('wave 1 uses initial timings and no bursts', () => {
    const t = computeWaveTiming(1);
    expect(t.firstSpawn).toBeCloseTo(CFG.FIRST_SPAWN_INITIAL);
    expect(t.spawnInterval).toBeCloseTo(CFG.SPAWN_INTERVAL_INITIAL);
    expect(t.combatDuration).toBe(CFG.WAVE_COMBAT_WAVE1);
    expect(t.noBursts).toBe(true);
  });

  it('wave 5 reaches minimum spawn values', () => {
    const t = computeWaveTiming(5);
    expect(t.firstSpawn).toBeCloseTo(CFG.FIRST_SPAWN_MIN);
    expect(t.spawnInterval).toBeCloseTo(CFG.SPAWN_INTERVAL_MIN);
    expect(t.noBursts).toBe(false);
  });

  it('combat duration caps at max for high waves', () => {
    const t = computeWaveTiming(100);
    expect(t.combatDuration).toBe(CFG.WAVE_COMBAT_MAX);
  });
});

// ── computeSpeedBonus ──────────────────────────────────────────

describe('computeSpeedBonus', () => {
  it('returns 0 below 2000 score', () => {
    expect(computeSpeedBonus(0)).toBe(0);
    expect(computeSpeedBonus(1999)).toBe(0);
  });

  it('returns 0 at exactly 2000', () => {
    expect(computeSpeedBonus(2000)).toBe(0);
  });

  it('grows by 12 per 500 score above 2000', () => {
    expect(computeSpeedBonus(2500)).toBe(12);
    expect(computeSpeedBonus(3000)).toBe(24);
    expect(computeSpeedBonus(3499)).toBe(24); // floor keeps it at 24 until 3500
    expect(computeSpeedBonus(3500)).toBe(36);
  });

  it('caps at 120', () => {
    expect(computeSpeedBonus(999999)).toBe(120);
    expect(computeSpeedBonus(7000)).toBe(120);
  });
});

// ── startWave ──────────────────────────────────────────────────

describe('startWave', () => {
  it('increments waveIndex from 0 to 1', () => {
    const s = makeWaveState();
    startWave(s);
    expect(s.waveIndex).toBe(1);
  });

  it('sets phase to combat', () => {
    const s = makeWaveState();
    startWave(s);
    expect(s.phase).toBe('combat');
  });

  it('disables bursts on wave 1', () => {
    const s = makeWaveState();
    startWave(s);
    expect(s.noBursts).toBe(true);
  });

  it('enables bursts on wave 2+', () => {
    const s = makeWaveState();
    startWave(s); // wave 1
    startWave(s); // wave 2
    expect(s.noBursts).toBe(false);
  });

  it('resets waveTimer to 0', () => {
    const s = makeWaveState();
    s.waveTimer = 999;
    startWave(s);
    expect(s.waveTimer).toBe(0);
  });

  it('clears scraps array', () => {
    const s = makeWaveState();
    s.scraps.push({ x: 100, y: 100, life: 10 });
    startWave(s);
    expect(s.scraps.length).toBe(0);
  });

  it('sets spawnTimer to firstSpawn value', () => {
    const s = makeWaveState();
    startWave(s);
    expect(s.spawnTimer).toBeCloseTo(s.currentFirstSpawn);
  });
});

// ── updateWave — combat phase ──────────────────────────────────

describe('updateWave in combat phase', () => {
  it('generates a spawn event after firstSpawn delay', () => {
    const s = makeWaveState();
    startWave(s); // wave 1
    const spawnDelay = s.currentFirstSpawn;

    // Advance just under the delay — no spawn yet
    const events1 = updateWave(s, spawnDelay - 0.01, 0, 0);
    expect(events1.filter(e => e.type === 'spawn').length).toBe(0);

    // Advance past the delay — spawn fires
    const events2 = updateWave(s, 0.02, 0, 0);
    expect(events2.filter(e => e.type === 'spawn').length).toBe(1);
  });

  it('transitions to break after combatDuration', () => {
    const s = makeWaveState();
    startWave(s);

    // Advance past the combat duration
    const events = updateWave(s, s.currentCombatDuration + 1, 0, 0);
    expect(events.some(e => e.type === 'wave_end')).toBe(true);
    expect(s.phase).toBe('break');
  });

  it('emits break_end after WAVE_BREAK seconds in break', () => {
    const s = makeWaveState();
    startWave(s);
    // Get to break
    updateWave(s, s.currentCombatDuration + 1, 0, 0);
    expect(s.phase).toBe('break');

    // Advance past break duration
    const events = updateWave(s, CFG.WAVE_BREAK + 0.1, 0, 0);
    expect(events.some(e => e.type === 'break_end')).toBe(true);
    expect(s.phase).toBe('idle');
  });
});

// ── Burst spawning ─────────────────────────────────────────────

describe('burst spawning', () => {
  it('no burst on wave 1 even after interval', () => {
    const s = makeWaveState();
    startWave(s); // wave 1 — noBursts = true
    expect(s.noBursts).toBe(true);

    // Feed in burst interval worth of time
    const events = updateWave(s, CFG.BURST_INTERVAL + 1, 0, 0);
    // Only regular spawn(s), no burst triggered
    expect(s.burstQueue).toBe(0);
  });

  it('burst activates on wave 2 after BURST_INTERVAL', () => {
    const s = makeWaveState();
    startWave(s); // wave 1
    startWave(s); // wave 2 — bursts enabled
    expect(s.noBursts).toBe(false);

    // Advance in small steps to avoid triggering wave_end
    // Tick small increments until burstTimer expires
    let burstFired = false;
    for (let t = 0; t < CFG.BURST_INTERVAL + 1 && t < s.currentCombatDuration - 1; t += 0.5) {
      const events = updateWave(s, 0.5, 0, 0);
      if (s.burstQueue > 0 || events.some(e => e.type === 'spawn' && e.requests.length > 0)) {
        burstFired = true;
      }
    }
    expect(burstFired).toBe(true);
  });
});

// ── startWave — hazardZones ─────────────────────────────────────────

// Test 1 — hazardZones cleared on startWave
describe('startWave — hazardZones', () => {
  it('clears hazardZones array on wave start', () => {
    const s = makeWaveState();
    s.hazardZones.push({ x: 100, y: 100, life: 5, radius: 55, phase: 0 });
    startWave(s);
    expect(s.hazardZones.length).toBe(0);
  });
});

// ── updateWave — horde event —────────────────────────────────────────

// Test 2 — horde event emitted by updateWave
describe('updateWave — horde event', () => {
  it('emits horde event on wave 1 after hordeTrigger fraction of combat elapses', () => {
    const s = makeWaveState();
    startWave(s); // wave 1 — horde eligible
    // Force hordeTrigger to 0 so horde fires immediately
    s.hordeTrigger = 0;
    s.hordeTriggered = false;
    // Advance past HORDE_DELAY so the spawn fires
    const events = updateWave(s, CFG.HORDE_DELAY + 0.1, 0, 0);
    expect(events.some(e => e.type === 'horde')).toBe(true);
  });

  it('horde fires exactly once per wave even if combat continues past trigger', () => {
    const s = makeWaveState();
    startWave(s); // wave 1
    startWave(s); // wave 2 — horde eligible, waveIndex = 2
    // Set hordeTrigger to fire early in combat
    s.hordeTrigger = 0.1;
    s.hordeTriggered = false;
    // Set spawn timer to 0 so spawn fires immediately when hordeTrigger fires
    s.hordeSpawnTimer = 0;
    const waveDuration = s.currentCombatDuration;
    const events: WaveEvent[] = [];
    // Tick through the full combat duration in 0.1 steps, collecting events
    for (let t = 0.1; t <= waveDuration; t += 0.1) {
      const e = updateWave(s, 0.1, 0, 0);
      events.push(...e);
    }
    // Filter for horde events
    const hordeEvents = events.filter(e => e.type === 'horde');
    expect(hordeEvents.length).toBe(1);
  });
});

// ── tickBoostZoneSpawn ─────────────────────────────────────────────

describe('tickBoostZoneSpawn', () => {
  it('does not spawn outside combat phase', () => {
    const s = makeWaveState(); // phase = 'idle'
    s.boostZoneTimer = 0;
    tickBoostZoneSpawn(s, 1.0, 500, 500);
    expect(s.boostZones.length).toBe(0);
  });

  it('does not spawn before timer elapses', () => {
    const s = makeWaveState();
    startWave(s);
    s.boostZoneTimer = 5;
    tickBoostZoneSpawn(s, 0.016, 500, 500);
    expect(s.boostZones.length).toBe(0);
  });

  it('spawns a boost zone when combat phase and timer fires', () => {
    const s = makeWaveState();
    startWave(s);
    s.boostZoneTimer = 0;
    tickBoostZoneSpawn(s, 0.016, 500, 500);
    expect(s.boostZones.length).toBe(1);
    expect(s.boostZones[0].life).toBe(12);
  });

  it('resets boostZoneTimer after spawn', () => {
    const s = makeWaveState();
    startWave(s);
    s.boostZoneTimer = 0;
    tickBoostZoneSpawn(s, 0.016, 500, 500);
    expect(s.boostZoneTimer).toBe(CFG.BOOST_ZONE_SPAWN_INTERVAL);
  });

  it('spawns zone within world bounds', () => {
    const s = makeWaveState();
    startWave(s);
    s.boostZoneTimer = 0;
    for (let i = 0; i < 20; i++) {
      s.boostZones.length = 0;
      s.boostZoneTimer = 0;
      tickBoostZoneSpawn(s, 0.016, 500, 500);
      const z = s.boostZones[0];
      expect(z.x).toBeGreaterThanOrEqual(60);
      expect(z.x).toBeLessThanOrEqual(CFG.WORLD_W - 60);
      expect(z.y).toBeGreaterThanOrEqual(60);
      expect(z.y).toBeLessThanOrEqual(CFG.WORLD_H - 60);
    }
  });

  it('startWave clears boost zones and resets timer', () => {
    const s = makeWaveState();
    startWave(s);
    s.boostZoneTimer = 0;
    tickBoostZoneSpawn(s, 0.016, 500, 500);
    expect(s.boostZones.length).toBe(1);
    startWave(s);
    expect(s.boostZones.length).toBe(0);
    expect(s.boostZoneTimer).toBe(CFG.BOOST_ZONE_SPAWN_INTERVAL);
  });
});

// ── updateBoostZones (collection) ─────────────────────────────────

describe('updateBoostZones — collection and expiry', () => {
  const player = { x: 500, y: 500, radius: 10, magnetRange: 0 };

  it('emits boost event when player overlaps zone', () => {
    const zones = [{ x: 500, y: 500, life: 10 }];
    const events = updateBoostZones(zones, player, 0.016);
    expect(events).toContain('boost');
    expect(zones.length).toBe(0);
  });

  it('does not emit event when player is out of range', () => {
    const zones = [{ x: 1000, y: 1000, life: 10 }];
    const events = updateBoostZones(zones, player, 0.016);
    expect(events.length).toBe(0);
    expect(zones.length).toBe(1);
  });

  it('removes zone when life expires without collection', () => {
    const zones = [{ x: 1000, y: 1000, life: 0.01 }];
    updateBoostZones(zones, player, 0.02); // life goes negative
    expect(zones.length).toBe(0);
  });

  it('decrements zone life each tick', () => {
    const zones = [{ x: 1000, y: 1000, life: 5 }];
    updateBoostZones(zones, player, 1.0);
    expect(zones[0].life).toBeCloseTo(4);
  });
});


// ── Boss wave system ─────────────────────────────────────────────────────────

describe('isBossWave', () => {
  it('returns false for wave 0', () => {
    expect(isBossWave(0)).toBe(false);
  });

  it('returns true for multiples of 5 (5, 10, 15)', () => {
    expect(isBossWave(5)).toBe(true);
    expect(isBossWave(10)).toBe(true);
    expect(isBossWave(15)).toBe(true);
    expect(isBossWave(20)).toBe(true);
  });

  it('returns false for non-multiples', () => {
    expect(isBossWave(1)).toBe(false);
    expect(isBossWave(4)).toBe(false);
    expect(isBossWave(6)).toBe(false);
    expect(isBossWave(9)).toBe(false);
  });
});

describe('getBossPattern', () => {
  it('wave 5 → pursuer', () => expect(getBossPattern(5)).toBe('pursuer'));
  it('wave 10 → core', () => expect(getBossPattern(10)).toBe('core'));
  it('wave 15 → reflector', () => expect(getBossPattern(15)).toBe('reflector'));
  it('wave 20 → pursuer again', () => expect(getBossPattern(20)).toBe('pursuer'));
  it('wave 25 → core again', () => expect(getBossPattern(25)).toBe('core'));
});

describe('boss wave combat phase', () => {
  function makeBossWave(waveN: number) {
    const state = makeWaveState();
    // Advance waveIndex to waveN - 1 so startWave pushes to waveN
    state.waveIndex = waveN - 1;
    startWave(state);
    return state;
  }

  it('bossActive is true for wave 5', () => {
    const state = makeBossWave(5);
    expect(state.bossActive).toBe(true);
    expect(state.bossPattern).toBe('pursuer');
    expect(state.bossSpawned).toBe(false);
  });

  it('bossActive is false for wave 3', () => {
    const state = makeBossWave(3);
    expect(state.bossActive).toBe(false);
  });

  it('boss_spawn event fires after telegraph delay', () => {
    const state = makeBossWave(5);
    // Tick past telegraph timer (1.5s)
    const events = updateWave(state, 2.0, 0, 0);
    const spawnEv = events.find(e => e.type === 'boss_spawn');
    expect(spawnEv).toBeDefined();
    expect((spawnEv as { type: 'boss_spawn'; pattern: string }).pattern).toBe('pursuer');
    expect(state.bossSpawned).toBe(true);
  });

  it('no normal spawn events fire during boss wave', () => {
    const state = makeBossWave(5);
    // Tick past all timers (very long tick)
    const events = updateWave(state, 30.0, 0, 0);
    const spawnEvs = events.filter(e => e.type === 'spawn');
    expect(spawnEvs.length).toBe(0);
  });

  it('wave_end fires when boss is dead (enemyCount drops to 0 after spawn)', () => {
    const state = makeBossWave(5);
    // Tick to spawn boss
    updateWave(state, 2.0, 0, 0);
    expect(state.bossSpawned).toBe(true);
    // Simulate boss death — tick again with enemyCount = 0
    const events = updateWave(state, 0.1, 0, 0);
    const endEv = events.find(e => e.type === 'wave_end');
    expect(endEv).toBeDefined();
  });
});
