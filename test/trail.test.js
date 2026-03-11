const test = require('node:test');
const assert = require('node:assert/strict');

const { pointInPoly } = require('./logic');

test('pointInPoly returns true for inside point', () => {
  const tri = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
  assert.equal(pointInPoly(5, 5, tri), true);
});

test('pointInPoly returns false for outside point', () => {
  const tri = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
  assert.equal(pointInPoly(20, 20, tri), false);
});
