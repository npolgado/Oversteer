// rng.ts — Seeded LCG RNG ported from arena-drifter/logic.js.
// Used for deterministic procedural generation (prop scatter, horde triggers, etc.).

export interface Rng {
  next(): number;
}

/**
 * Creates a seeded LCG (linear congruential generator) RNG.
 * Produces values in [0, 1).
 *
 * Algorithm: state = (1664525 * state + 1013904223) >>> 0  (Numerical Recipes)
 */
export function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next(): number {
      state = ((1664525 * state + 1013904223) >>> 0);
      return state / 0x100000000;
    },
  };
}

/**
 * Returns a random float in [min, max) using the provided Rng instance.
 */
export function randFloat(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng.next();
}
