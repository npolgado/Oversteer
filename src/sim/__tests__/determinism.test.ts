// determinism.test.ts — REGRESSION GUARD for seed-replay determinism (multiplayer prerequisite).
//
// Before the Phase 4.9 rng-threading fix, startWave() seeded the horde trigger from Date.now() and the
// wave/enemy tick used bare Math.random(), so two runs of the same seed diverged the moment a horde (or
// any spawn) fired. The report's flagship determinism check only passed inside the pre-horde grace
// window. This guard runs long enough to CROSS a horde and asserts the two traces are identical.
// NOTE: not in original — Phase 4.9 sim harness (regression guard).

import { describe, it, expect } from 'vitest';
import { runSim, type SimOptions } from '../simRunner';
import { afk } from '../policies';
import type { SimTrace } from '../trace';

const FPS = 60;

// A compact, comparable projection of a trace: final outcome + per-frame state + event stream.
// Any divergent rng draw (spawn angle, enemy type, horde trigger, flank side, lifespan) perturbs enemy
// positions → player damage → score, so this signature catches nondeterminism anywhere in the tick.
function signature(trace: SimTrace): string {
  const samples = trace.samples.map(s =>
    `${s.frame}:${s.score}:${s.hp.toFixed(3)}:${s.px.toFixed(3)}:${s.py.toFixed(3)}:${s.enemyCount}`,
  ).join('|');
  const events = trace.events.map(e => {
    const d = e.data as Record<string, unknown>;
    const num = Object.keys(d).sort().map(k =>
      typeof d[k] === 'number' ? `${k}=${(d[k] as number).toFixed(3)}` : `${k}=${String(d[k])}`,
    ).join(',');
    return `${e.frame}:${e.name}:${num}`;
  }).join('|');
  return `score=${trace.finalScore};frames=${trace.frames};died=${trace.died}\n${samples}\n${events}`;
}

describe('GUARD: same seed → identical trace across a horde', () => {
  it('two runs of seed 7 (45s, wave 1) produce byte-identical signatures', () => {
    // Wave-1 combat duration is 30s; horde trigger fires at 60–85% of it (~18–25.5s), well inside 45s.
    const opts: SimOptions = { seed: 7, policy: afk, frames: 45 * FPS, dt: 1 / FPS };
    const a = signature(runSim(opts));
    const b = signature(runSim(opts));

    // Sanity: the runs actually reached steady combat (not a degenerate empty run).
    expect(runSim(opts).frames).toBeGreaterThan(20 * FPS);
    expect(a).toBe(b);
  });

  it('different seeds diverge (guard is not vacuously passing)', () => {
    const base: Omit<SimOptions, 'seed'> = { policy: afk, frames: 45 * FPS, dt: 1 / FPS };
    const a = signature(runSim({ ...base, seed: 7 }));
    const c = signature(runSim({ ...base, seed: 99 }));
    expect(a).not.toBe(c);
  });
});
