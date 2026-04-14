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

// ── U.lerp ────────────────────────────────────────────────────

test('U.lerp at t=0 returns a', () => {
  assert.equal(U.lerp(5, 20, 0), 5);
});

test('U.lerp at t=1 returns b', () => {
  assert.equal(U.lerp(5, 20, 1), 20);
});

test('U.lerp at t=0.5 returns midpoint', () => {
  assert.ok(Math.abs(U.lerp(0, 100, 0.5) - 50) < 1e-9);
});

// ── U.clamp ───────────────────────────────────────────────────

test('U.clamp returns lo when value is below range', () => {
  assert.equal(U.clamp(-5, 0, 10), 0);
});

test('U.clamp returns hi when value is above range', () => {
  assert.equal(U.clamp(15, 0, 10), 10);
});

test('U.clamp returns value when within range', () => {
  assert.equal(U.clamp(5, 0, 10), 5);
});

// ── U.angleLerp ───────────────────────────────────────────────

test('U.angleLerp at t=0 returns a', () => {
  assert.ok(Math.abs(U.angleLerp(0, Math.PI / 2, 0)) < 1e-9);
});

test('U.angleLerp at t=1 returns b', () => {
  assert.ok(Math.abs(U.angleLerp(0, Math.PI / 2, 1) - Math.PI / 2) < 1e-9);
});

test('U.angleLerp takes short path across wrap boundary', () => {
  // From -PI+0.1 to PI-0.1: short path wraps through PI, midpoint near +/- PI
  const a = -Math.PI + 0.1;
  const b = Math.PI - 0.1;
  const mid = U.angleLerp(a, b, 0.5);
  // Short path crosses the +/-PI boundary, midpoint should be near PI (either side)
  assert.ok(Math.abs(mid) > Math.PI / 2, `expected mid near PI, got ${mid}`);
});

// ── U.angleDiff ───────────────────────────────────────────────

test('U.angleDiff returns signed shortest angular difference', () => {
  assert.ok(Math.abs(U.angleDiff(0, Math.PI / 2) - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(U.angleDiff(Math.PI / 2, 0) - (-Math.PI / 2)) < 1e-9);
});

test('U.angleDiff wraps across boundary correctly', () => {
  // From 3.1 to -3.1: short path is only ~0.08 rad, not ~6.2 rad
  const diff = U.angleDiff(3.1, -3.1);
  assert.ok(Math.abs(diff) < 0.2, `expected small diff, got ${diff}`);
});

// ── U.dist ────────────────────────────────────────────────────

test('U.dist returns 0 for same point', () => {
  assert.equal(U.dist(5, 5, 5, 5), 0);
});

test('U.dist returns correct Euclidean distance', () => {
  assert.ok(Math.abs(U.dist(0, 0, 3, 4) - 5) < 1e-9);
});

// ── U.vec2FromAngle ───────────────────────────────────────────

test('U.vec2FromAngle(0) points right', () => {
  const v = U.vec2FromAngle(0);
  assert.ok(Math.abs(v.x - 1) < 1e-9);
  assert.ok(Math.abs(v.y) < 1e-9);
});

test('U.vec2FromAngle(PI/2) points down', () => {
  const v = U.vec2FromAngle(Math.PI / 2);
  assert.ok(Math.abs(v.x) < 1e-9);
  assert.ok(Math.abs(v.y - 1) < 1e-9);
});

// ── U.randSample ─────────────────────────────────────────────

test('U.randSample returns n unique items from array', () => {
  const arr = [1, 2, 3, 4, 5];
  const result = U.randSample(arr, 3);
  assert.equal(result.length, 3);
  const unique = new Set(result);
  assert.equal(unique.size, 3);
});

test('U.randSample does not mutate source array', () => {
  const arr = [1, 2, 3];
  U.randSample(arr, 2);
  assert.equal(arr.length, 3);
});

test('U.randSample returns all items when n >= length', () => {
  const arr = [1, 2, 3];
  const result = U.randSample(arr, 5);
  assert.equal(result.length, 3);
});
