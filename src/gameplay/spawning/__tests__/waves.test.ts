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
  isSurvivalBoss,
  _buildWeightedPool,
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
    // Tick past telegraph timer (1.5s); boss is spawned into the enemy list (bossAlive=true)
    const events = updateWave(state, 2.0, 0, 0, true);
    const spawnEv = events.find(e => e.type === 'boss_spawn');
    expect(spawnEv).toBeDefined();
    expect((spawnEv as { type: 'boss_spawn'; pattern: string }).pattern).toBe('pursuer');
    expect(state.bossSpawned).toBe(true);
  });

  it('normal spawn events fire alongside the boss during a boss wave (B2 fix)', () => {
    const state = makeBossWave(5);
    // Force spawn timer to fire immediately so we don't have to tick a full interval
    state.spawnTimer = 0;
    // bossSpawned=true so we are in the "waiting for boss kill" branch
    state.bossSpawned = true;
    const events = updateWave(state, 0.016, 0, 1, true /* bossAlive */);
    const spawnEvs = events.filter(e => e.type === 'spawn');
    expect(spawnEvs.length).toBeGreaterThan(0);
  });

  it('wave_end fires when boss dies even if minions remain (bossAlive=false)', () => {
    const state = makeBossWave(5);
    // Tick to spawn boss (boss alive)
    updateWave(state, 2.0, 0, 0, true);
    expect(state.bossSpawned).toBe(true);
    // Simulate boss death — bossAlive=false, but minions keep enemyCount > 0
    const events = updateWave(state, 0.1, 0, 6, false);
    const endEv = events.find(e => e.type === 'wave_end');
    expect(endEv).toBeDefined();
  });

  it('wave does NOT end while boss is still alive', () => {
    const state = makeBossWave(5);
    updateWave(state, 2.0, 0, 0, true); // spawn
    // Boss alive — wave should stay in combat no matter what enemyCount is
    const events = updateWave(state, 0.1, 0, 1, true);
    expect(events.find(e => e.type === 'wave_end')).toBeUndefined();
    expect(state.phase).toBe('combat');
  });

  // ── B1 regression: boss waves must not force-end on the plain combat timer ──

  it('Pursuer (wave 5) does NOT end when the combat timer elapses while alive', () => {
    const state = makeBossWave(5);
    updateWave(state, 2.0, 0, 0, true); // spawn boss
    expect(state.bossPattern).toBe('pursuer');
    const events = updateWave(state, state.currentCombatDuration + 10, 0, 1, true);
    expect(events.find(e => e.type === 'wave_end')).toBeUndefined();
    expect(state.phase).toBe('combat');
  });

  it('Core (wave 10) does NOT end when the combat timer elapses while alive', () => {
    const state = makeBossWave(10);
    updateWave(state, 2.0, 0, 0, true); // spawn boss
    expect(state.bossPattern).toBe('core');
    const events = updateWave(state, state.currentCombatDuration + 10, 0, 1, true);
    expect(events.find(e => e.type === 'wave_end')).toBeUndefined();
    expect(state.phase).toBe('combat');
  });

  it('Reflector (wave 15) DOES end with bossKilled:true when the combat timer elapses while alive', () => {
    const state = makeBossWave(15);
    updateWave(state, 2.0, 0, 0, true); // spawn boss
    expect(state.bossPattern).toBe('reflector');
    const events = updateWave(state, state.currentCombatDuration + 10, 0, 1, true);
    const endEv = events.find(e => e.type === 'wave_end') as { type: 'wave_end'; bossKilled?: boolean } | undefined;
    expect(endEv).toBeDefined();
    expect(endEv!.bossKilled).toBe(true);
    expect(state.phase).toBe('break');
  });

  it('Reflector does not end early — only once the timer has actually elapsed', () => {
    const state = makeBossWave(15);
    updateWave(state, 2.0, 0, 0, true); // spawn boss
    const events = updateWave(state, 0.1, 0, 1, true);
    expect(events.find(e => e.type === 'wave_end')).toBeUndefined();
    expect(state.phase).toBe('combat');
  });
});

describe('isSurvivalBoss', () => {
  it('is true only for reflector', () => {
    expect(isSurvivalBoss('reflector')).toBe(true);
    expect(isSurvivalBoss('pursuer')).toBe(false);
    expect(isSurvivalBoss('core')).toBe(false);
  });
});

// ── bossKilled flag on wave_end ────────────────────────────────────────────────

describe('wave_end bossKilled flag', () => {
  function makeBossWave(waveN: number) {
    const state = makeWaveState();
    state.waveIndex = waveN - 1;
    startWave(state);
    return state;
  }

  it('wave_end from boss kill carries bossKilled: true', () => {
    const state = makeBossWave(5);
    updateWave(state, 2.0, 0, 0, true); // trigger boss_spawn
    const events = updateWave(state, 0.1, 0, 0, false); // boss dies
    const endEv = events.find(e => e.type === 'wave_end') as { type: 'wave_end'; bossKilled?: boolean } | undefined;
    expect(endEv).toBeDefined();
    expect(endEv!.bossKilled).toBe(true);
  });

  it('wave_end from normal timer does not carry bossKilled', () => {
    const state = makeWaveState();
    startWave(state); // wave 1 — not a boss wave
    const events = updateWave(state, state.currentCombatDuration + 1, 0, 0, false);
    const endEv = events.find(e => e.type === 'wave_end') as { type: 'wave_end'; bossKilled?: boolean } | undefined;
    expect(endEv).toBeDefined();
    expect(endEv!.bossKilled).toBeFalsy();
  });
});

// ── Boss wave — regular spawning not suppressed (B2 fix) ──────────────────────

describe('updateWave — boss waves allow regular spawning', () => {
  it('emits a spawn event during a boss wave once the spawn timer elapses', () => {
    const state = makeWaveState();
    // Advance to a boss wave (wave 5 = first boss wave at BOSS_WAVE_INTERVAL=5)
    for (let i = 0; i < 5; i++) startWave(state);
    expect(state.bossActive).toBe(true);
    // Boss is not spawned yet (telegraph timer still running); force bossSpawned=true
    // so the "waiting for kill" branch is active and boss is alive (bossAlive=true)
    state.bossSpawned = true;
    // Force spawn timer to fire
    state.spawnTimer = 0;
    const events = updateWave(state, 0.016, 9999, 1, true /* bossAlive */);
    expect(events.some(e => e.type === 'spawn')).toBe(true);
  });
});

// ── Horde arc (B5 fix) — spawns within CFG.HORDE_ARC_RAD ─────────────────────

describe('updateWave — horde arc direction', () => {
  it('horde spawn angles span no more than HORDE_ARC_RAD for count >= 3', () => {
    const s = makeWaveState();
    startWave(s);
    s.hordeTrigger = 0;
    s.hordeTriggered = false;
    const events = updateWave(s, CFG.HORDE_DELAY + 0.1, 0, 0);
    const horde = events.find(e => e.type === 'horde') as
      { type: 'horde'; spawnRequests: { angle: number }[]; count: number } | undefined;
    expect(horde).toBeDefined();
    const angles = horde!.spawnRequests.map(r => r.angle);
    if (angles.length >= 3) {
      // Compute angular range (all angles should fit within HORDE_ARC_RAD)
      const min = Math.min(...angles);
      const max = Math.max(...angles);
      const spread = max - min;
      expect(spread).toBeLessThanOrEqual(CFG.HORDE_ARC_RAD + 1e-9);
    }
  });

  it('horde spawn angles do NOT span full 360° (old bug)', () => {
    const s = makeWaveState();
    startWave(s);
    s.hordeTrigger = 0;
    s.hordeTriggered = false;
    const events = updateWave(s, CFG.HORDE_DELAY + 0.1, 0, 0);
    const horde = events.find(e => e.type === 'horde') as
      { type: 'horde'; spawnRequests: { angle: number }[]; count: number } | undefined;
    expect(horde).toBeDefined();
    const angles = horde!.spawnRequests.map(r => r.angle);
    if (angles.length >= 3) {
      const min = Math.min(...angles);
      const max = Math.max(...angles);
      expect(max - min).toBeLessThan(Math.PI); // must stay within half the circle
    }
  });
});

// ── B2: biome weightMult can introduce a score-gated type early (Jungle splitter) ──

describe('_buildWeightedPool — biome bias overrides score gate', () => {
  it('does not add a type absent from base when its mult is <= 1', () => {
    const pool = _buildWeightedPool(['chaser'], { splitter: 1 });
    expect(pool).not.toContain('splitter');
  });

  it('adds a score-gated type when the biome mult is > 1 (Jungle splitter at low score)', () => {
    // base mirrors getEnemyPool(score) below the splitter gate (score < 3500)
    const base: ('chaser' | 'bomber' | 'blocker')[] = ['chaser', 'bomber', 'blocker'];
    const pool = _buildWeightedPool(base, { bomber: 1.6, blocker: 1.4, splitter: 1.5 });
    expect(pool).toContain('splitter');
  });

  it('does not duplicate a type that is already in base', () => {
    const pool = _buildWeightedPool(['chaser', 'splitter'], { splitter: 1.5 });
    const splitterCopies = pool.filter(t => t === 'splitter').length;
    // Only the base-path weighting applies (round(1.5*4)=6), not an additional bias-path batch
    expect(splitterCopies).toBe(6);
  });

  it('gives more weight to a higher-mult biome-introduced type', () => {
    const low = _buildWeightedPool(['chaser'], { splitter: 1.25 }); // round(1.25*4)=5
    const high = _buildWeightedPool(['chaser'], { splitter: 2 });   // round(2*4)=8
    const lowCount = low.filter(t => t === 'splitter').length;
    const highCount = high.filter(t => t === 'splitter').length;
    expect(highCount).toBeGreaterThan(lowCount);
  });
});

describe('updateWave — pickEnemyType cache reacts to score-bucket and biome changes', () => {
  it('spawns the biome-boosted, score-gated type even below its normal score gate', () => {
    const s = makeWaveState();
    startWave(s);
    s.spawnTimer = 0;
    // score is 0 — well below splitter's normal 3500 gate — but Jungle-style bias should
    // still be able to produce it via the weighted pool.
    let sawSplitter = false;
    for (let i = 0; i < 200; i++) {
      s.spawnTimer = 0;
      const events = updateWave(s, 0.001, 0, 0, false, { splitter: 3 });
      for (const ev of events) {
        if (ev.type === 'spawn' && ev.requests.some(r => r.type === 'splitter')) sawSplitter = true;
      }
      if (sawSplitter) break;
    }
    expect(sawSplitter).toBe(true);
  });
});
