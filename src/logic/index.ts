// Re-exports pure functions from the typed TS modules.
// Use these in tests and gameplay systems instead of the legacy logic.js.
export { CFG, MAPS, MAPS_BY_ID, S, applyMap } from '@core/config';
export * from '@core/utils';
export { makeRng, randFloat } from '@core/rng';
