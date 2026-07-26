// driftGate.differential.test.ts — The autonomous-loop payoff: same scenario, gate on vs. gate off.
//
// This drives the REAL updateScoring() over a drift-camp scenario (drifting, no enemies) two ways:
//   - GATE ON  (Phase 4.9): enemyEngaged=false once the grace period lapses  → drift score stops.
//   - GATE OFF (main/pre-gate): enemyEngaged defaults to true                 → drift scores forever.
//
// 4.9's updateScoring() defaults `enemyEngaged=true`, which is byte-for-byte main's behavior — so the
// "gate off" column here is a faithful reproduction of the bug on main, not a mock. The harness's
// flagship assertion (see exploit.test.ts) passes against the gated path and fails against this one.
// NOTE: not in original — Phase 4.9 sim harness.

import { describe, it, expect } from 'vitest';
import { CFG } from '@core/config';
import { makeScoringState, updateScoring } from '@gameplay/scoring';

const DT = 1 / 60;

/**
 * Replays a continuous drift (driftTime climbs, no kills so combo stays 0) for `seconds`.
 * `gated` picks the engagement value the live tick would compute for a lone drifter with no enemies:
 *   gate on  → engaged only while lastEngagementTimer < DRIFT_COMBO_ENGAGE_T, then false.
 *   gate off → always true (pre-4.9).
 * Returns the score gained strictly after the grace period.
 */
function driftCampLateScore(gated: boolean, seconds: number): number {
  const s = makeScoringState(0);
  let driftTime = 0;
  let scoreAtGrace = 0;
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i++) {
    driftTime += DT;
    const t = i * DT;
    const engaged = gated ? s.lastEngagementTimer < CFG.DRIFT_COMBO_ENGAGE_T : true;
    updateScoring(s, /*drifting*/ true, driftTime, /*scoreMult*/ 1, /*comboMaster*/ false, DT, engaged);
    // Snapshot the score the instant the grace period closes.
    if (scoreAtGrace === 0 && t >= CFG.DRIFT_COMBO_ENGAGE_T) scoreAtGrace = s.score;
  }
  return s.score - scoreAtGrace;
}

describe('drift-exploit gate — differential (gate on vs. off)', () => {
  it('GATE OFF (main behavior) keeps earning drift-combo score after the grace period', () => {
    const late = driftCampLateScore(/*gated*/ false, 8);
    // Passive (4/s) + drift ticks (5/s at combo 0) over ~5s ≈ 45. Well above passive-only.
    const passiveOnly = CFG.SCORE_PER_SEC * (8 - CFG.DRIFT_COMBO_ENGAGE_T);
    expect(late).toBeGreaterThan(passiveOnly + CFG.DRIFT_COMBO_BASE); // the exploit: drift keeps paying
  });

  it('GATE ON (Phase 4.9) earns only passive score after the grace period', () => {
    const late = driftCampLateScore(/*gated*/ true, 8);
    const passiveOnly = CFG.SCORE_PER_SEC * (8 - CFG.DRIFT_COMBO_ENGAGE_T);
    expect(late).toBeLessThan(passiveOnly + CFG.DRIFT_COMBO_BASE); // drift bonus is gated off
    expect(late).toBeGreaterThan(0); // passive still accrues
  });
});
