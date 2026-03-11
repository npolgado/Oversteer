const test = require('node:test');
const assert = require('node:assert/strict');

const { collectPickupEvents } = require('./logic');

test('collects multiple pickups and boost zones in one frame', () => {
  const scraps = [
    { x: 5, y: 0, type: 'scrap' },
    { x: 8, y: 0, type: 'trail_boost' },
  ];
  const boostZones = [{ x: 6, y: 0 }];
  const player = { x: 0, y: 0, radius: 10, magnetRange: 0 };

  const events = collectPickupEvents(scraps, boostZones, player, 0.016);
  const sorted = [...events].sort();

  assert.deepEqual(sorted, ['boost', 'scrap', 'trail_boost'].sort());
  assert.equal(scraps.length, 0);
  assert.equal(boostZones.length, 0);
});

test('magnet pulls scraps into collection range', () => {
  const scraps = [{ x: 80, y: 0, type: 'scrap' }];
  const boostZones = [];
  const player = { x: 0, y: 0, radius: 10, magnetRange: 150 };

  const events = collectPickupEvents(scraps, boostZones, player, 0.5);
  assert.deepEqual(events, ['scrap']);
  assert.equal(scraps.length, 0);
});

test('no pickups collected when out of range', () => {
  const scraps = [{ x: 200, y: 0, type: 'scrap' }];
  const boostZones = [{ x: 200, y: 0 }];
  const player = { x: 0, y: 0, radius: 10, magnetRange: 0 };

  const events = collectPickupEvents(scraps, boostZones, player, 0.016);
  assert.deepEqual(events, []);
  assert.equal(scraps.length, 1);
  assert.equal(boostZones.length, 1);
});
