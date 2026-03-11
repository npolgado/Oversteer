const test = require('node:test');
const assert = require('node:assert/strict');

const { applyNearMiss } = require('./logic');

test('near-miss increases score and combo', () => {
  const player = { scoreMult: 1, comboLevel: 0, consecutiveNearMisses: 0 };
  const result = applyNearMiss(0, player, 'enemy');
  assert.equal(result.score, 25);
  assert.equal(result.comboLevel, 1);
  assert.equal(result.consecutiveNearMisses, 1);
});

test('near-miss streak bonus applies at 3+', () => {
  const player = { scoreMult: 1, comboLevel: 2, consecutiveNearMisses: 2 };
  const result = applyNearMiss(0, player, 'enemy');
  assert.equal(result.score, 175);
  assert.equal(result.comboLevel, 3);
  assert.equal(result.consecutiveNearMisses, 3);
});

test('hazard near-miss uses hazard points', () => {
  const player = { scoreMult: 1, comboLevel: 0, consecutiveNearMisses: 0 };
  const result = applyNearMiss(0, player, 'hazard');
  assert.equal(result.score, 15);
  assert.equal(result.comboLevel, 1);
});

test('combo level clamps at max', () => {
  const player = { scoreMult: 1, comboLevel: 8, consecutiveNearMisses: 0 };
  const result = applyNearMiss(0, player, 'enemy');
  assert.equal(result.comboLevel, 8);
});
