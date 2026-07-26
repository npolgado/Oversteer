// trace.ts — Recorded output of a headless sim run: per-frame metric samples + event stream.
// Assertions consume a SimTrace; they never poke at live game state directly.
// NOTE: not in original — Phase 4.9 sim harness.

export interface MetricSample {
  frame: number;
  t: number;        // seconds since run start
  score: number;
  hp: number;
  combo: number;
  enemyCount: number;
  px: number;
  py: number;
  speed: number;
  drifting: boolean;
  driftTime: number;
}

export interface TraceEvent {
  frame: number;
  t: number;
  name: string;
  data: unknown;
}

export interface SimTrace {
  seed: number;
  dt: number;
  frames: number;           // frames actually simulated (may be < requested if run ended early)
  samples: MetricSample[];
  events: TraceEvent[];
  finalScore: number;
  died: boolean;
  brokeToUpgrade: boolean;  // a wave ended and the run entered the upgrade break
  /** Set if stepWorld threw — carries the frame + message for a reproducible repro. */
  error?: { frame: number; message: string };
}

/** Total score gained across samples whose timestamp falls in [tStart, tEnd). */
export function scoreGainedInWindow(trace: SimTrace, tStart: number, tEnd: number): number {
  const inWin = trace.samples.filter(s => s.t >= tStart && s.t < tEnd);
  if (inWin.length < 2) return 0;
  return inWin[inWin.length - 1].score - inWin[0].score;
}

/** All recorded events with the given name. */
export function eventsOfType(trace: SimTrace, name: string): TraceEvent[] {
  return trace.events.filter(e => e.name === name);
}

/** True if any metric sample contains a non-finite number (NaN/Infinity) — a runtime blowup. */
export function hasNonFiniteState(trace: SimTrace): boolean {
  return trace.samples.some(s =>
    !Number.isFinite(s.score) || !Number.isFinite(s.hp) || !Number.isFinite(s.px) ||
    !Number.isFinite(s.py) || !Number.isFinite(s.speed) || !Number.isFinite(s.combo));
}
