const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getEnemyPool,
  shouldSpawnElite,
  computeFlankTarget,
  computeBlockerTarget,
  applyBombZoneDamage,
  computeModifierScoreMult,
  CFG,
} = require('../arena-drifter/logic');

// ── Enemy pool tests ─────────────────────────────────────────

test('enemy pool starts with chaser only', () => {
  assert.deepEqual(getEnemyPool(0), ['chaser']);
});

test('interceptor unlocks at 1000 score', () => {
  assert.deepEqual(getEnemyPool(999), ['chaser']);
  assert.deepEqual(getEnemyPool(1000), ['chaser', 'interceptor']);
});

test('drifter unlocks at 1500 score', () => {
  const pool = getEnemyPool(1500);
  assert.ok(pool.includes('drifter'));
  assert.equal(pool.length, 3);
});

test('blocker unlocks at 2000 score', () => {
  const pool = getEnemyPool(2000);
  assert.ok(pool.includes('blocker'));
  assert.equal(pool.length, 4);
});

test('flanker unlocks at 2500 score', () => {
  const pool = getEnemyPool(2500);
  assert.ok(pool.includes('flanker'));
  assert.equal(pool.length, 5);
});

test('bomber unlocks at 3000 score', () => {
  const pool = getEnemyPool(3000);
  assert.ok(pool.includes('bomber'));
  assert.equal(pool.length, 6);
});

test('full pool at high score contains all 6 types', () => {
  assert.deepEqual(getEnemyPool(5000), ['chaser', 'interceptor', 'drifter', 'blocker', 'flanker', 'bomber']);
});

// ── Elite spawn tests ────────────────────────────────────────

test('elite spawns from wave 4+ with low roll', () => {
  assert.equal(shouldSpawnElite(4, 0.05), true);
  assert.equal(shouldSpawnElite(10, 0.11), true);
});

test('elite does not spawn with high roll', () => {
  assert.equal(shouldSpawnElite(4, 0.15), false);
  assert.equal(shouldSpawnElite(10, 0.50), false);
});

test('elite does not spawn before wave 4', () => {
  assert.equal(shouldSpawnElite(3, 0.01), false);
  assert.equal(shouldSpawnElite(1, 0.05), false);
});

// ── Flanker targeting tests ──────────────────────────────────

test('flanker targets perpendicular to player velocity', () => {
  // Player moving right (vx=200, vy=0), flank side 1
  // perpX = -vy/speed * side = 0, perpY = vx/speed * side = 1
  // target = (100 + 0*200, 100 + 1*200) = (100, 300)
  const t = computeFlankTarget(100, 100, 200, 0, 1);
  assert.equal(t.x, 100);
  assert.ok(Math.abs(t.y - 300) < 1);
});

test('flanker targets other side with flankSide -1', () => {
  // perpY = vx/speed * (-1) = -1, target = (100, 100 + (-1)*200) = (100, -100)
  const t = computeFlankTarget(100, 100, 200, 0, -1);
  assert.equal(t.x, 100);
  assert.ok(Math.abs(t.y - (-100)) < 1);
});

test('flanker falls back to player position when speed is low', () => {
  const t = computeFlankTarget(100, 100, 10, 10, 1);
  assert.equal(t.x, 100);
  assert.equal(t.y, 100);
});

// ── Blocker targeting tests ──────────────────────────────────

test('blocker targets trail midpoint', () => {
  const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
  const mid = computeBlockerTarget(points);
  assert.ok(Math.abs(mid.x - 200 / 3) < 1);
  assert.ok(Math.abs(mid.y - 100 / 3) < 1);
});

test('blocker returns null for empty trail', () => {
  assert.equal(computeBlockerTarget([]), null);
  assert.equal(computeBlockerTarget(null), null);
});

// ── Bomb zone damage tests ───────────────────────────────────

test('bomb zone applies DPS correctly', () => {
  // 8 DPS * 0.5s = 4 raw, no resist
  assert.equal(applyBombZoneDamage(8, 0.5, 0), 4);
});

test('bomb zone respects damage resistance', () => {
  // 8 DPS * 1.0s = 8 raw, 25% resist => 6
  assert.equal(applyBombZoneDamage(8, 1.0, 0.25), 6);
});

test('bomb zone returns 0 for very small dt', () => {
  assert.equal(applyBombZoneDamage(8, 0.01, 0), 0);
});

// ── Difficulty modifier score mult tests ─────────────────────

test('no modifiers gives 1x multiplier', () => {
  const m = { hardMode: false, speedRush: false, fragile: false, doubleEnemies: false };
  assert.equal(computeModifierScoreMult(m), 1);
});

test('hardMode gives 1.5x multiplier', () => {
  const m = { hardMode: true, speedRush: false, fragile: false, doubleEnemies: false };
  assert.ok(Math.abs(computeModifierScoreMult(m) - 1.5) < 0.001);
});

test('doubleEnemies gives 1.6x multiplier', () => {
  const m = { hardMode: false, speedRush: false, fragile: false, doubleEnemies: true };
  assert.ok(Math.abs(computeModifierScoreMult(m) - 1.6) < 0.001);
});

test('all modifiers stack multiplicatively', () => {
  const m = { hardMode: true, speedRush: true, fragile: true, doubleEnemies: true };
  const expected = 1.5 * 1.3 * 1.4 * 1.6;
  assert.ok(Math.abs(computeModifierScoreMult(m) - expected) < 0.01);
});

// ── CFG constants for new enemies exist ──────────────────────

test('CFG has new enemy speed constants', () => {
  assert.equal(CFG.BLOCKER_SPEED, 380);
  assert.equal(CFG.FLANKER_SPEED, 470);
  assert.equal(CFG.BOMBER_SPEED, 400);
});

test('CFG has new enemy damage constants', () => {
  assert.equal(CFG.DMG_BLOCKER, 12);
  assert.equal(CFG.DMG_FLANKER, 20);
  assert.equal(CFG.DMG_BOMBER, 14);
});

test('CFG has bomb zone constants', () => {
  assert.equal(CFG.BOMB_ZONE_RADIUS, 55);
  assert.equal(CFG.BOMB_ZONE_DURATION, 6.0);
  assert.equal(CFG.BOMB_ZONE_INTERVAL, 4.0);
  assert.equal(CFG.BOMB_ZONE_DMG, 8);
  assert.equal(CFG.BOMB_ZONE_SLOW, 0.6);
  assert.equal(CFG.BOMB_ZONE_MAX, 15);
});

test('ENEMY_SPRITES_BY_TYPE has new enemy types', () => {
  assert.ok(CFG.ENEMY_SPRITES_BY_TYPE.blocker.length > 0);
  assert.ok(CFG.ENEMY_SPRITES_BY_TYPE.flanker.length > 0);
  assert.ok(CFG.ENEMY_SPRITES_BY_TYPE.bomber.length > 0);
});
