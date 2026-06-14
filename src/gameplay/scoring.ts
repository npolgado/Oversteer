// scoring.ts — Centralized scoring state: base score, drift combo, combo decay, run stats.

import { CFG } from '@core/config';
import {
  applyComboDecay,
  driftComboScoreTick,
  makeRunStats,
  updateRunStats,
  type RunStats,
} from '@gameplay/pureLogic';

export interface ScoringState {
  score: number;
  highScore: number;
  newBest: boolean;
  comboLevel: number;          // canonical combo — synced to/from PlayerState
  lastDriftComboTick: number;
  lastEngagementTimer: number; // NOTE: not in original — seconds since last kill or near-miss (drift gate)
  runStats: RunStats;
}

export function makeScoringState(highScore: number): ScoringState {
  return {
    score: 0,
    highScore,
    newBest: false,
    comboLevel: 0,
    lastDriftComboTick: 0,
    lastEngagementTimer: 0,
    runStats: makeRunStats(),
  };
}

/**
 * Per-frame scoring update: passive score tick, drift combo, combo decay, stat tracking.
 * Must be called once per frame with current player state.
 */
export function updateScoring(
  state: ScoringState,
  drifting: boolean,
  driftTime: number,
  scoreMult: number,
  comboMaster: boolean,
  dt: number,
  enemyEngaged: boolean = true,  // NOTE: not in original — drift exploit gate; defaults true for backwards compat
): void {
  // Base passive score — matches game.js:931 (score += SCORE_PER_SEC * dt * scoreMult)
  state.score += CFG.SCORE_PER_SEC * dt * scoreMult;
  state.lastEngagementTimer += dt;

  if (drifting) {
    // Drift combo tick — intentionally multiplied by scoreMult for consistency
    const driftResult = driftComboScoreTick(driftTime, state.lastDriftComboTick, state.comboLevel, enemyEngaged);
    if (driftResult.scoreDelta > 0) state.score += driftResult.scoreDelta * scoreMult;
    state.lastDriftComboTick = driftResult.nextTick;
  } else {
    // Reset tick counter when not drifting — matches game.js:942
    state.lastDriftComboTick = 0;
    // Combo decays only when NOT drifting — matches entities.js:210-211
    state.comboLevel = applyComboDecay(state.comboLevel, comboMaster, dt);
  }

  // Run stats: drift time tracking
  updateRunStats(state.runStats, { type: 'drift_tick', drifting, dt });

  // High score UI flag — set per-frame for immediate feedback; saving happens on death (Step 11)
  if (state.score > state.highScore) state.newBest = true;
}

/** Apply an explicit score award (near-miss, encirclement, scrap, etc.) */
export function addScore(state: ScoringState, delta: number): void {
  state.score += delta;
  if (state.score > state.highScore) state.newBest = true;
}
