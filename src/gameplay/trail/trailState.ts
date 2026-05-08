// trailState.ts — Trail ring buffer state and accessors.

import type { TrailPoint } from '@gameplay/pureLogic';
export type { TrailPoint };

const MAX_POINTS_CAP = 600;

export interface TrailState {
  // Ring buffer (pre-allocated, fixed length MAX_POINTS_CAP)
  points: TrailPoint[];
  head: number;    // next write index
  count: number;   // filled count, capped at maxPoints
  // Config (upgradeable at runtime)
  maxPoints: number;   // default 400, trail_echo → 600
  closeDist: number;   // default 40, wider_trail → 60
  // Timers
  recordTimer: number; // position recorded every 0.05s
  checkTimer: number;  // loop checked every 0.15s
  // Visual
  colorR: number;
  colorG: number;
  colorB: number;
  // Encirclement flash polygon (temporary visual after a kill)
  flashPoly: TrailPoint[] | null;
  flashPolyTimer: number;
}

export function makeTrailState(): TrailState {
  const points: TrailPoint[] = Array.from({ length: MAX_POINTS_CAP }, () => ({ x: 0, y: 0 }));
  return {
    points,
    head: 0,
    count: 0,
    maxPoints: 400,
    closeDist: 40,
    recordTimer: 0,
    checkTimer: 0,
    colorR: 53,
    colorG: 242,
    colorB: 208,
    flashPoly: null,
    flashPolyTimer: 0,
  };
}

/** Indexed access into the ring buffer. i=0 is oldest, i=count-1 is newest. */
export function getTrailPoint(state: TrailState, i: number): TrailPoint {
  return state.points[(state.head - state.count + i + state.points.length) % state.points.length];
}

/** Push a new position into the ring buffer. Overwrites oldest when full. */
export function pushTrailPoint(state: TrailState, x: number, y: number, speed = 0): void {
  state.points[state.head] = { x, y, speed };
  state.head = (state.head + 1) % state.points.length;
  if (state.count < state.maxPoints) state.count++;
}
