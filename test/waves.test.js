const test = require('node:test');
const assert = require('node:assert/strict');

const { computeWaveTiming, computeHordeCount, shouldTriggerHorde, rollHordeTrigger, makeRng } = require('../arena-drifter/logic');

test('wave 1 uses initial timings and no bursts', () => {
  const timing = computeWaveTiming(1);
  assert.equal(timing.firstSpawn, 2.5);
  assert.equal(timing.spawnInterval, 4.0);
  assert.equal(timing.combatDuration, 30);
  assert.equal(timing.noBursts, true);
});

test('wave 5 reaches minimum spawn values', () => {
  const timing = computeWaveTiming(5);
  assert.ok(Math.abs(timing.firstSpawn - 0.6) < 1e-6);
  assert.equal(timing.spawnInterval, 1.5);
  assert.equal(timing.combatDuration, 70);
});

test('mid-wave ramp values fall between initial and min', () => {
  const timing = computeWaveTiming(3);
  assert.ok(timing.firstSpawn < 2.5 && timing.firstSpawn > 0.6);
  assert.ok(timing.spawnInterval < 4.0 && timing.spawnInterval > 1.5);
  assert.equal(timing.noBursts, false);
});

test('combat duration caps at max for high waves', () => {
  const timing = computeWaveTiming(20);
  assert.equal(timing.combatDuration, 120);
});

test('horde count scales with wave index', () => {
  assert.equal(computeHordeCount(1), 5);
  assert.equal(computeHordeCount(5), 7);
});

test('horde count caps at maximum', () => {
  assert.equal(computeHordeCount(200), 40);
});

test('horde trigger threshold fires at expected time', () => {
  const combatDuration = 30;
  const hordeTrigger = 0.75;
  assert.equal(shouldTriggerHorde(22.5, combatDuration, hordeTrigger), true);
  assert.equal(shouldTriggerHorde(22.4, combatDuration, hordeTrigger), false);
});

test('seeded horde trigger roll stays within range', () => {
  const rng = makeRng(1234);
  const roll = rollHordeTrigger(rng);
  assert.ok(roll >= 0.60 && roll <= 0.85);
});
