const test = require('node:test');
const assert = require('node:assert/strict');

const { hitTestUpgradeTap } = require('./logic');

test('tap selects the correct upgrade card', () => {
  const cards = [
    { x: 100, y: 100, w: 180, h: 200 },
    { x: 300, y: 100, w: 180, h: 200 },
    { x: 500, y: 100, w: 180, h: 200 },
  ];
  const tap = { x: 390, y: 200 };
  const result = hitTestUpgradeTap(tap, cards, null);
  assert.equal(result.selectedIndex, 1);
  assert.equal(result.reroll, false);
});

test('tap on reroll bounds triggers reroll', () => {
  const cards = [];
  const reroll = { x: 300, y: 650, w: 200, h: 30 };
  const tap = { x: 350, y: 660 };
  const result = hitTestUpgradeTap(tap, cards, reroll);
  assert.equal(result.selectedIndex, -1);
  assert.equal(result.reroll, true);
});

test('tap outside cards and reroll does nothing', () => {
  const cards = [{ x: 100, y: 100, w: 180, h: 200 }];
  const reroll = { x: 300, y: 650, w: 200, h: 30 };
  const tap = { x: 20, y: 20 };
  const result = hitTestUpgradeTap(tap, cards, reroll);
  assert.equal(result.selectedIndex, -1);
  assert.equal(result.reroll, false);
});

test('card selection wins if tap overlaps card and reroll bounds', () => {
  const cards = [{ x: 300, y: 620, w: 200, h: 40 }];
  const reroll = { x: 300, y: 620, w: 200, h: 40 };
  const tap = { x: 350, y: 635 };
  const result = hitTestUpgradeTap(tap, cards, reroll);
  assert.equal(result.selectedIndex, 0);
  assert.equal(result.reroll, false);
});
