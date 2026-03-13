const test = require('node:test');
const assert = require('node:assert/strict');

const { applyNearMiss, updateRunStats, makeRunStats, applyDriftShield, applyComboHeal } = require('./logic');

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

// --- Run stat tracking ---

test('nearMissTotal increments on each near miss', () => {
  const stats = makeRunStats();
  updateRunStats(stats, { type: 'near_miss', comboLevel: 0 });
  updateRunStats(stats, { type: 'near_miss', comboLevel: 1 });
  assert.equal(stats.nearMissTotal, 2);
});

test('peakCombo tracks highest combo from near misses', () => {
  const stats = makeRunStats();
  let combo = 0;
  for (let i = 0; i < 5; i++) {
    const r = updateRunStats(stats, { type: 'near_miss', comboLevel: combo });
    combo = r.comboLevel;
  }
  assert.equal(stats.peakCombo, 5);
});

test('peakCombo tracks highest combo from encirclement', () => {
  const stats = makeRunStats();
  updateRunStats(stats, { type: 'encircle', killCount: 3, comboLevel: 0 });
  assert.equal(stats.peakCombo, 6);
  assert.equal(stats.enemiesKilled, 3);
});

test('enemiesKilled accumulates from encircle and bomb', () => {
  const stats = makeRunStats();
  updateRunStats(stats, { type: 'encircle', killCount: 2, comboLevel: 0 });
  updateRunStats(stats, { type: 'bomb', killCount: 4 });
  assert.equal(stats.enemiesKilled, 6);
});

test('totalDriftTime only accumulates while drifting', () => {
  const stats = makeRunStats();
  updateRunStats(stats, { type: 'drift_tick', drifting: true, dt: 0.5 });
  updateRunStats(stats, { type: 'drift_tick', drifting: false, dt: 0.5 });
  updateRunStats(stats, { type: 'drift_tick', drifting: true, dt: 0.3 });
  assert.ok(Math.abs(stats.totalDriftTime - 0.8) < 1e-6);
});

// --- Upgrade effects ---

test('drift_shield reduces damage by 40% while drifting', () => {
  assert.equal(applyDriftShield(20, true, true), 12);
  assert.equal(applyDriftShield(20, false, true), 20);
  assert.equal(applyDriftShield(20, true, false), 20);
});

test('drift_shield enforces minimum 1 damage', () => {
  assert.equal(applyDriftShield(1, true, true), 1);
});

test('combo_heal heals at milestones 3, 5, 8', () => {
  assert.equal(applyComboHeal(2.5, 3.0, true, 50, 100), 60);
  assert.equal(applyComboHeal(4.5, 5.0, true, 50, 100), 65);
  assert.equal(applyComboHeal(7.5, 8.0, true, 50, 100), 75);
});

test('combo_heal does not overheal past maxHp', () => {
  assert.equal(applyComboHeal(2.5, 3.0, true, 95, 100), 100);
});

test('combo_heal does nothing without upgrade', () => {
  assert.equal(applyComboHeal(2.5, 3.0, false, 50, 100), 50);
});
