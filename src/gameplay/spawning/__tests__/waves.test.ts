import { describe, it, expect } from 'vitest';
import { CFG } from '@core/config';
import { computeWaveTiming } from '@gameplay/pureLogic';
import {
  makeWaveState,
  startWave,
  updateWave,
  computeSpeedBonus,
} from '../waveManager';

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

