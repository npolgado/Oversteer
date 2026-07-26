// policies.ts — Bot "brains": functions that produce a FrameInput each frame from world state.
// Deterministic (no Math.random of their own). Add richer policies (chaseNearest, evade,
// encircleNearest) here as later phases need them.
// NOTE: not in original — Phase 4.9 sim harness.

import type { FrameInput, WorldState } from '@gameplay/stepWorld';

export interface PolicyCtx {
  world: WorldState;
  frame: number;
  t: number;
}

export type Policy = (ctx: PolicyCtx) => FrameInput;

const NONE: FrameInput = { up: false, down: false, left: false, right: false, drift: false };

/** Do nothing — the pure AFK baseline. */
export const afk: Policy = () => NONE;

/**
 * Hold throttle + a constant turn + drift: the car builds speed and drifts in a wide circle.
 * With no enemies present this is the classic "drift-camp" exploit input — it should score
 * indefinitely on pre-4.9 code and be gated to passive-only score on 4.9.
 */
export const emptyDrift: Policy = () => ({ up: true, down: false, left: true, right: false, drift: true });

/** Drive straight (throttle only) — useful as a movement baseline. */
export const cruise: Policy = () => ({ up: true, down: false, left: false, right: false, drift: false });

export const POLICIES: Record<string, Policy> = { afk, emptyDrift, cruise };
