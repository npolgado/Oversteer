const test = require('node:test');
const assert = require('node:assert/strict');

const { computeWaveTiming, computeHordeCount, shouldTriggerHorde } = require('./logic');

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

test('horde count scales with wave index', () => {
  assert.equal(computeHordeCount(1), 5);
  assert.equal(computeHordeCount(5), 7);
});

test('horde trigger threshold fires at expected time', () => {
  const combatDuration = 30;
  const hordeTrigger = 0.75;
  assert.equal(shouldTriggerHorde(22.5, combatDuration, hordeTrigger), true);
  assert.equal(shouldTriggerHorde(22.4, combatDuration, hordeTrigger), false);
});
