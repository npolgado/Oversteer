const test = require('node:test');
const assert = require('node:assert/strict');

const { pointInPoly } = require('../arena-drifter/logic');

test('pointInPoly returns true for inside point', () => {
  const tri = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
  assert.equal(pointInPoly(5, 5, tri), true);
});

test('pointInPoly returns false for outside point', () => {
  const tri = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
  assert.equal(pointInPoly(20, 20, tri), false);
});

test('pointInPoly returns true for point on edge', () => {
  const rect = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  assert.equal(pointInPoly(5, 0, rect), true);
});

test('pointInPoly handles self-intersecting polygon', () => {
  const bow = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }];
  assert.equal(pointInPoly(5, 5, bow), false);
});

test('pointInPoly returns false for degenerate polygons', () => {
  const line = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
  assert.equal(pointInPoly(5, 0, line), false);
});

test('pointInPoly handles repeated points', () => {
  const poly = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
  assert.equal(pointInPoly(2, 2, poly), true);
});
