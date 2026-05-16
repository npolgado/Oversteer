import { describe, it, expect } from 'vitest';
import { CFG } from '@core/config';
import { makeScoringState, updateScoring, addScore } from '../scoring';
import { makeRunStats, updateRunStats } from '../pureLogic';

function makeState(highScore = 0) {
  return makeScoringState(highScore);
}

// ── Base passive score ─────────────────────────────────────────

describe('base passive score', () => {
  it('increases by SCORE_PER_SEC * dt when not drifting', () => {
    const s = makeState();
    updateScoring(s, false, 0, 1, false, 1.0);
    expect(s.score).toBeCloseTo(CFG.SCORE_PER_SEC * 1.0);
  });

  it('multiplied by scoreMult', () => {
    const s = makeState();
    updateScoring(s, false, 0, 2, false, 1.0);
    expect(s.score).toBeCloseTo(CFG.SCORE_PER_SEC * 2.0);
  });

  it('increases while drifting too', () => {
    const s = makeState();
    updateScoring(s, true, 0, 1, false, 1.0);
    expect(s.score).toBeGreaterThanOrEqual(CFG.SCORE_PER_SEC * 1.0);
  });
});

// ── Drift combo tick ───────────────────────────────────────────

describe('drift combo tick', () => {
  it('awards score when driftTime crosses DRIFT_COMBO_INTERVAL', () => {
    const s = makeState();
    s.comboLevel = 3;
    // First tick: just under interval — no bonus yet
    updateScoring(s, true, CFG.DRIFT_COMBO_INTERVAL - 0.01, 1, false, 0);
    const scoreBefore = s.score;

    // Cross the interval threshold
    updateScoring(s, true, CFG.DRIFT_COMBO_INTERVAL + 0.01, 1, false, 0);
    expect(s.score).toBeGreaterThan(scoreBefore);
  });

  it('drift combo score is multiplied by scoreMult', () => {
    const s1 = makeState();
    const s2 = makeState();
    s1.comboLevel = 4;
    s2.comboLevel = 4;
    // Force a tick by having driftTime at exactly 1 interval
    updateScoring(s1, true, CFG.DRIFT_COMBO_INTERVAL, 1, false, 0);
    updateScoring(s2, true, CFG.DRIFT_COMBO_INTERVAL, 2, false, 0);
    // With scoreMult=2, drift combo pts should be 2× the scoreMult=1 case
    expect(s2.score).toBeGreaterThan(s1.score);
  });

  it('lastDriftComboTick resets to 0 when not drifting', () => {
    const s = makeState();
    s.lastDriftComboTick = 5;
    updateScoring(s, false, 0, 1, false, 0.1);
    expect(s.lastDriftComboTick).toBe(0);
  });

  it('lastDriftComboTick does NOT reset while drifting', () => {
    const s = makeState();
    s.lastDriftComboTick = 3;
    updateScoring(s, true, CFG.DRIFT_COMBO_INTERVAL * 2, 1, false, 0.1);
    expect(s.lastDriftComboTick).toBeGreaterThan(0);
  });
});

// ── Combo decay ────────────────────────────────────────────────

describe('combo decay', () => {
  it('decays to 0 when not drifting long enough', () => {
    const s = makeState();
    s.comboLevel = 5;
    // At 2.0/sec decay rate, 5 / 2 = 2.5s to reach 0
    updateScoring(s, false, 0, 1, false, 3.0);
    expect(s.comboLevel).toBe(0);
  });

  it('does NOT decay while drifting', () => {
    const s = makeState();
    s.comboLevel = 5;
    updateScoring(s, true, 0.5, 1, false, 1.0);
    expect(s.comboLevel).toBe(5);
  });

  it('comboMaster slows decay rate (2× longer to reach 0)', () => {
    const s1 = makeState();
    const s2 = makeState();
    s1.comboLevel = 4;
    s2.comboLevel = 4;
    // 1s decay: normal (2.0/s) drops by 2; comboMaster (1.0/s) drops by 1
    updateScoring(s1, false, 0, 1, false, 1.0);
    updateScoring(s2, false, 0, 1, true, 1.0);
    expect(s2.comboLevel).toBeGreaterThan(s1.comboLevel);
  });
});

// ── High score tracking ────────────────────────────────────────

describe('high score tracking', () => {
  it('newBest is false when score is below highScore', () => {
    const s = makeState(1000);
    updateScoring(s, false, 0, 1, false, 0.01); // tiny increment
    expect(s.newBest).toBe(false);
  });

  it('newBest is set when score exceeds highScore', () => {
    const s = makeState(0);
    updateScoring(s, false, 0, 1, false, 1.0); // SCORE_PER_SEC * 1 > 0
    expect(s.newBest).toBe(true);
  });

  it('addScore sets newBest when score exceeds highScore', () => {
    const s = makeState(100);
    addScore(s, 101);
    expect(s.newBest).toBe(true);
  });

  it('addScore does not set newBest when still below highScore', () => {
    const s = makeState(100);
    addScore(s, 50);
    expect(s.newBest).toBe(false);
  });
});

// ── addScore ───────────────────────────────────────────────────

describe('addScore', () => {
  it('increments score by delta', () => {
    const s = makeState();
    addScore(s, 25);
    expect(s.score).toBe(25);
  });

  it('accumulates multiple awards', () => {
    const s = makeState();
    addScore(s, 10);
    addScore(s, 25);
    addScore(s, 50);
    expect(s.score).toBe(85);
  });
});

// ── Run stats: drift time accumulation (via updateScoring) ────────────────────

// Block 1: runStats -- drift time accumulation via updateScoring
describe('runStats -- drift time accumulation via updateScoring', () => {
  it('totalDriftTime increases when drifting each frame', () => {
    const state = makeScoringState(0);
    updateScoring(state, true, 1.0, 1, false, 0.5);
    updateScoring(state, true, 1.5, 1, false, 0.5);
    expect(state.runStats.totalDriftTime).toBeCloseTo(1.0);
  });

  it('totalDriftTime does not increase when not drifting', () => {
    const state = makeScoringState(0);
    updateScoring(state, false, 0, 1, false, 0.5);
    expect(state.runStats.totalDriftTime).toBe(0);
  });
});

// ── Run stats: near_miss and encircle events (gameLoop contract) ─────────────

// Block 2: runStats -- near_miss and encircle events
describe('runStats -- near_miss and encircle events (gameLoop contract)', () => {
  it('nearMissTotal increments and peakCombo updates on near_miss event', () => {
    const stats = makeRunStats();
    updateRunStats(stats, { type: 'near_miss', comboLevel: 4 });
    expect(stats.nearMissTotal).toBe(1);
    expect(stats.peakCombo).toBeGreaterThanOrEqual(4);
  });

  it('enemiesKilled accumulates on encircle event', () => {
    const stats = makeRunStats();
    updateRunStats(stats, { type: 'encircle', killCount: 3, comboLevel: 0 });
    expect(stats.enemiesKilled).toBe(3);
  });

  it('peakCombo tracks highest seen across multiple events', () => {
    const stats = makeRunStats();
    updateRunStats(stats, { type: 'near_miss', comboLevel: 2 });
    updateRunStats(stats, { type: 'encircle', killCount: 1, comboLevel: 5 });
    updateRunStats(stats, { type: 'near_miss', comboLevel: 3 });
    expect(stats.peakCombo).toBeGreaterThanOrEqual(5);
  });
});
