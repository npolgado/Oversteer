const test = require('node:test');
const assert = require('node:assert/strict');

const { makeRng, randFloat, S, U, CFG } = require('../arena-drifter/logic');

// ── Seeded RNG ────────────────────────────────────────────────

test('makeRng produces deterministic sequence', () => {
  const rng1 = makeRng(42);
  const rng2 = makeRng(42);
  for (let i = 0; i < 10; i++) {
    assert.equal(rng1.next(), rng2.next());
  }
});

test('makeRng produces different sequences for different seeds', () => {
  const rng1 = makeRng(1);
  const rng2 = makeRng(2);
  assert.notEqual(rng1.next(), rng2.next());
});

test('makeRng output stays in [0, 1)', () => {
  const rng = makeRng(99999);
  for (let i = 0; i < 100; i++) {
    const v = rng.next();
    assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
  }
});

test('randFloat output stays within [min, max]', () => {
  const rng = makeRng(7777);
  for (let i = 0; i < 50; i++) {
    const v = randFloat(rng, 10, 20);
    assert.ok(v >= 10 && v <= 20, `value ${v} out of range`);
  }
});

test('randFloat with equal min/max returns that value', () => {
  const rng = makeRng(0);
  assert.equal(randFloat(rng, 5, 5), 5);
});

// ── S() scale function ────────────────────────────────────────

test('S() scale factor matches CFG.W/H of 1600x900', () => {
  // CFG.W=1600, CFG.H=900 → scale = min(1600/1280, 900/720) = min(1.25, 1.25) = 1.25
  assert.ok(Math.abs(CFG.S - 1.25) < 1e-6, `expected scale 1.25, got ${CFG.S}`);
});

test('S() rounds to nearest integer', () => {
  // 10 * 1.25 = 12.5 → rounds to 13
  assert.equal(S(10), 13);
  // 100 * 1.25 = 125 → rounds to 125
  assert.equal(S(100), 125);
});

test('S(0) returns 0', () => {
  assert.equal(S(0), 0);
});

// ── U.approach ────────────────────────────────────────────────

test('U.approach moves toward target', () => {
  assert.equal(U.approach(0, 10, 3), 3);
  assert.equal(U.approach(10, 0, 3), 7);
});

test('U.approach does not overshoot target', () => {
  assert.equal(U.approach(8, 10, 5), 10);
  assert.equal(U.approach(2, 0, 5), 0);
});

test('U.approach returns target when already there', () => {
  assert.equal(U.approach(5, 5, 3), 5);
});

// ── U.normalizeAngle ─────────────────────────────────────────

test('normalizeAngle wraps angle >PI into [-PI, PI]', () => {
  const a = U.normalizeAngle(Math.PI + 0.1);
  assert.ok(a >= -Math.PI && a <= Math.PI, `angle ${a} out of range`);
});

test('normalizeAngle wraps angle <-PI into [-PI, PI]', () => {
  const a = U.normalizeAngle(-Math.PI - 0.1);
  assert.ok(a >= -Math.PI && a <= Math.PI, `angle ${a} out of range`);
});

test('normalizeAngle leaves angle already in range unchanged', () => {
  assert.ok(Math.abs(U.normalizeAngle(1.0) - 1.0) < 1e-9);
  assert.ok(Math.abs(U.normalizeAngle(-1.0) - (-1.0)) < 1e-9);
});

test('normalizeAngle treats 2*PI as 0', () => {
  assert.ok(Math.abs(U.normalizeAngle(2 * Math.PI)) < 1e-9);
});
