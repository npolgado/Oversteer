const test = require('node:test');
const assert = require('node:assert/strict');

const { collectPickupEvents, updateScraps, updateBoostZones, selectPickupType } = require('../arena-drifter/logic');

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

test('trail magnet nudges scraps toward trail points', () => {
  const scraps = [{ x: 0, y: 0, life: 10, type: 'scrap' }];
  const player = { x: 200, y: 0, radius: 10, magnetRange: 0, trailMagnet: true };
  const trailPoints = [{ x: 60, y: 0 }, { x: 80, y: 0 }];

  updateScraps(scraps, player, 0.5, trailPoints);
  assert.ok(scraps[0].x > 0);
});

test('scraps expire when life runs out', () => {
  const scraps = [{ x: 0, y: 0, life: 0.1, type: 'scrap' }];
  const player = { x: 200, y: 0, radius: 10, magnetRange: 0, trailMagnet: false };

  updateScraps(scraps, player, 0.2, []);
  assert.equal(scraps.length, 0);
});

test('boost zones expire when life runs out', () => {
  const boostZones = [{ x: 0, y: 0, life: 0.1 }];
  const player = { x: 200, y: 0, radius: 10 };

  updateBoostZones(boostZones, player, 0.2);
  assert.equal(boostZones.length, 0);
});

test('pickup type roll respects thresholds', () => {
  assert.equal(selectPickupType(4, 0.03), 'trail_boost');
  assert.equal(selectPickupType(5, 0.03), 'bomb');
  assert.equal(selectPickupType(6, 0.10), 'trail_boost');
  assert.equal(selectPickupType(6, 0.18), 'speed_pickup');
  assert.equal(selectPickupType(6, 0.5), 'scrap');
});

test('bomb threshold boundary: roll=0.04 on wave 5 is trail_boost not bomb', () => {
  // bomb requires roll < 0.04; at exactly 0.04 it falls through to trail_boost check
  assert.equal(selectPickupType(5, 0.04), 'trail_boost');
});

test('bomb does not spawn before wave 5', () => {
  // Even with low roll, wave 4 can't produce a bomb
  assert.equal(selectPickupType(4, 0.01), 'trail_boost');
  assert.equal(selectPickupType(0, 0.0), 'trail_boost');
});

test('selectPickupType at exact trail_boost/speed_pickup boundary', () => {
  // roll < 0.12 → trail_boost; roll >= 0.12 → speed_pickup (if < 0.20)
  assert.equal(selectPickupType(1, 0.12), 'speed_pickup');
});

test('selectPickupType at exact speed_pickup/scrap boundary', () => {
  // roll < 0.20 → speed_pickup; roll >= 0.20 → scrap
  assert.equal(selectPickupType(1, 0.20), 'scrap');
});

test('updateScraps collects scrap by proximity and returns event type', () => {
  const scraps = [{ x: 5, y: 0, life: 10, type: 'scrap' }];
  const player = { x: 0, y: 0, radius: 10, magnetRange: 0, trailMagnet: false };
  // dist=5 < SCRAP_RADIUS(7) + radius(10) + 10 = 27 → collected
  const events = updateScraps(scraps, player, 0.016, []);
  assert.deepEqual(events, ['scrap']);
  assert.equal(scraps.length, 0);
});

test('updateScraps returns non-scrap pickup type from event', () => {
  const scraps = [{ x: 5, y: 0, life: 10, type: 'trail_boost' }];
  const player = { x: 0, y: 0, radius: 10, magnetRange: 0, trailMagnet: false };
  const events = updateScraps(scraps, player, 0.016, []);
  assert.deepEqual(events, ['trail_boost']);
});
