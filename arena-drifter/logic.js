// Shared gameplay logic and config for browser + Node tests.
(function() {
const CFG = {
  W: 1920, H: 1080,
  // UI scale factor (reference: 1280x720)
  get S() { return Math.min(this.W / 1280, this.H / 720); },
  // Physics
  ACCEL: 900,
  MAX_SPEED: 520,
  REVERSE_ACCEL: 600,
  REVERSE_MAX: 240,
  TURN_RATE: 240 * Math.PI / 180, // rad/sec
  TURN_REDUCE_AT_MAX: 0.45,
  LATERAL_FRICTION: 8.5,
  FORWARD_DRAG: 1.7,
  DRIFT_LATERAL: 3.2,
  DRIFT_DRAG: 2.1,
  DRIFT_THRESHOLD: 180,
  DRIFT_BOOST: 60,
  ARENA_PAD: 24,
  BOUNCE_RETAIN: 0.35,
  // Player
  PLAYER_W: 34, PLAYER_H: 18, PLAYER_SPRITE_S: 56,
  PLAYER_RADIUS: 10,
  PLAYER_DRIFT_SHRINK: 2,
  // Enemies
  CHASER_SPEED: 420,
  INTERCEPTOR_SPEED: 460,
  DRIFTER_SPEED: 440,
  BLOCKER_SPEED: 380,
  FLANKER_SPEED: 470,
  BOMBER_SPEED: 400,
  ENEMY_RADIUS: 9,
  ENEMY_W: 32, ENEMY_H: 16, ENEMY_SPRITE_S: 50,
  ENEMY_ACCEL: 700,
  ENEMY_TURN_RATE: 200 * Math.PI / 180,
  // Near-miss
  NEAR_MISS_ENEMY: 8,
  NEAR_MISS_HAZARD: 10,
  NEAR_MISS_COOLDOWN: 1.2,
  // Scoring
  SCORE_PER_SEC: 4,
  NEAR_MISS_ENEMY_PTS: 25,
  NEAR_MISS_HAZARD_PTS: 15,
  DRIFT_COMBO_INTERVAL: 1.0,
  DRIFT_COMBO_BASE: 5,
  MAX_COMBO: 8,
  // Waves
  WAVE_COMBAT: 25,
  WAVE_BREAK: 8,
  FIRST_SPAWN: 0.8,
  SPAWN_INTERVAL: 2.2,
  BURST_INTERVAL: 8,
  BURST_COUNT: 2,
  BURST_DELAY: 0.3,
  // Hazards
  // Scrap
  SCRAP_INTERVAL: 6,
  SCRAP_RADIUS: 7,
  SCRAP_NEAR_MISS_CHANCE: 0.35,
  // Upgrades
  UPGRADES_TO_OFFER: 3,
  REROLL_MAX: 3,
  UPGRADE_CONFIRM_TIME: 3,
  // Colors
  C_BG: '#07080B',
  C_BG2: '#0E1118',
  C_PANEL: '#1A2233',
  C_TEXT: '#EAEFF7',
  C_PLAYER: '#EAEFF7',
  C_ACCENT: '#35F2D0',
  C_ENEMY: '#FF3B6B',
  C_ENEMY_DARK: '#7A1B33',
  C_PICKUP: '#FFB000',
  C_RARE: '#7C5CFF',
  C_SHIELD: '#5BFF4A',
  // Death
  FREEZE_TIME: 0.50,
  DEATH_SLOWMO: 0.35,
  DEATH_SLOWMO_DUR: 0.35,
  SHARD_COUNT_MIN: 10,
  SHARD_COUNT_MAX: 14,
  // Shield
  SHIELD_KNOCKBACK: 140,
  SHIELD_INVULN: 1.0,
  // Health
  PLAYER_HP: 100,
  PLAYER_HP_MAX: 100,
  HP_REGEN: 0,
  HIT_INVULN: 0.5,
  HIT_KNOCKBACK: 120,
  HP_REGEN_DELAY: 2.0,
  DMG_CHASER: 15,
  DMG_INTERCEPTOR: 18,
  DMG_DRIFTER: 15,
  DMG_ELITE: 25,
  DMG_BLOCKER: 12,
  DMG_FLANKER: 20,
  DMG_BOMBER: 14,
  DMG_SCALE_PER_WAVE: 0.12,
  DMG_SCALE_MAX: 3.0,
  // Horde
  HORDE_TRIGGER_MIN: 0.60,
  HORDE_TRIGGER_MAX: 0.85,
  HORDE_DELAY: 1.5,
  HORDE_BASE_COUNT: 5,
  HORDE_WAVE_GROWTH: 0.5,
  HORDE_MAX_COUNT: 40,
  HORDE_SPAWN_DIST: 950,
  // Open World
  WORLD_W: 3000, WORLD_H: 3000,
  // Enemy lifespan
  ENEMY_LIFESPAN_MIN: 10, ENEMY_LIFESPAN_MAX: 18,
  ENEMY_OFFSCREEN_BOOST: 1.5,
  ENEMY_OFFSCREEN_DESPAWN: 5,
  ENEMY_FAR_DESPAWN_DIST: 1200,
  // Handbrake
  HANDBRAKE_TURN_MULT: 2.0,
  HANDBRAKE_DURATION: 0.3,
  HANDBRAKE_DECEL: 1800,
  // Speed boost zones
  BOOST_ZONE_RADIUS: 22,
  BOOST_ZONE_DURATION: 1.5,
  BOOST_ZONE_MULT: 1.3,
  BOOST_ZONE_SPAWN_INTERVAL: 12,
  // Bomber hazard zones
  BOMB_ZONE_RADIUS: 55,
  BOMB_ZONE_DURATION: 6.0,
  BOMB_ZONE_INTERVAL: 4.0,
  BOMB_ZONE_DMG: 8,
  BOMB_ZONE_SLOW: 0.6,
  BOMB_ZONE_MAX: 15,
  // Drift chaining
  DRIFT_CHAIN_WINDOW: 0.5,
  DRIFT_CHAIN_MULT_1: 1.5,
  DRIFT_CHAIN_MULT_2: 2.0,
  // Wall riding
  WALL_RIDE_DIST: 30,
  WALL_RIDE_SPEED_BONUS: 0.10,
  // Early-game balancing
  FIRST_SPAWN_INITIAL: 2.5,
  SPAWN_INTERVAL_INITIAL: 4.0,
  FIRST_SPAWN_MIN: 0.6,
  SPAWN_INTERVAL_MIN: 1.5,
  WAVE_COMBAT_WAVE1: 30,
  WAVE_TIME_GROWTH: 10,
  WAVE_COMBAT_MAX: 120,
  // Props
  PROP_CHUNK_SIZE: 500,
  PROP_DENSITY: 0.00001,
  PROP_MIN_DIST: 100,
  PROP_POOL: [
    { image: 'props/tree_1.png', radius: 50, weight: 3, type: 'solid' },
    { image: 'props/rock_1.png', radius: 40, weight: 2, type: 'solid' },
    { image: 'props/mud_1.png',  radius: 62, weight: 2, type: 'slow', duration: 2.0, strength: 0.5 },
    { image: 'props/mud_1.png', radius: 55, weight: 2, type: 'slip', duration: 1.5, strength: 0.6 },
    { image: 'props/bush_1.png', radius: 25, weight: 5, type: 'decoration' },
  ],
  // Sprite paths (for future PNG support)
  PLAYER_SPRITE: 'cars/player.png',
  ENEMY_SPRITES_BY_TYPE: {
    chaser: ['cars/enemy_red.png', 'cars/enemy_orange.png'],
    interceptor: ['cars/police.png', 'cars/ambulance.png'],
    drifter: ['cars/taxi.png', 'cars/mini_van.png'],
    elite: ['cars/truck.png', 'cars/mini_truck.png'],
    blocker: ['cars/truck.png', 'cars/enemy_red.png'],
    flanker: ['cars/police.png', 'cars/enemy_orange.png'],
    bomber: ['cars/mini_truck.png', 'cars/mini_van.png'],
  },
  BACKGROUND_SPRITE: 'backgrounds/background_01.png',
};

// Base config snapshot (used for map overrides)
const CFG_BASE = Object.assign({}, CFG);
delete CFG_BASE.S;

// Map definitions
const MAPS = [
  {
    id: 'arena',
    name: 'City Boys',
    desc: 'Standard props, original arena.',
    cfg: {},
  },
  {
    id: 'arena_02',
    name: 'Loopy',
    desc: 'Rocky ring, no trees or mud.',
    cfg: {
      BACKGROUND_SPRITE: 'backgrounds/background_02.png',
      PROP_POOL: [
        { image: 'props/rock_1.png', radius: 40, weight: 3, type: 'solid' },
        { image: 'props/bush_1.png', radius: 25, weight: 5, type: 'decoration' },
      ],
    },
  },
];
const MAPS_BY_ID = Object.fromEntries(MAPS.map(m => [m.id, m]));

// Scale helper: converts reference-resolution pixels to current resolution
function S(px) { return Math.round(px * CFG.S); }

const U = {
  lerp(a, b, t) { return a + (b - a) * t; },
  clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
  randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; },
  randFloat(a, b) { return Math.random() * (b - a) + a; },
  randChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  randSample(arr, n) {
    const c = arr.slice(), o = [];
    for (let i = 0; i < n && c.length; i++) {
      const idx = Math.floor(Math.random() * c.length);
      o.push(c.splice(idx, 1)[0]);
    }
    return o;
  },
  approach(cur, tgt, step) {
    if (cur < tgt) return Math.min(cur + step, tgt);
    if (cur > tgt) return Math.max(cur - step, tgt);
    return tgt;
  },
  normalizeAngle(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  },
  angleLerp(a, b, t) {
    return a + U.normalizeAngle(b - a) * t;
  },
  angleDiff(a, b) {
    return U.normalizeAngle(b - a);
  },
  vec2FromAngle(a) { return { x: Math.cos(a), y: Math.sin(a) }; },
  dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },
  drawRotatedRect(ctx, cx, cy, w, h, angle, fill, stroke) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(-w/2, -h/2, w, h); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.strokeRect(-w/2, -h/2, w, h); }
    ctx.restore();
  },
  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  },
  text(ctx, str, x, y, opts = {}) {
    const { color = '#fff', size = 18, align = 'left', shadow = false, bold = false } = opts;
    const sz = Math.max(1, Math.round(size * CFG.S));
    ctx.font = `${bold ? 'bold ' : ''}${sz}px 'Courier New', monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (shadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(str, x + S(2), y + S(2));
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  },
  wrapText(ctx, text, x, y, maxW, lineH, opts = {}) {
    const sz = Math.max(1, Math.round((opts.size || 13) * CFG.S));
    ctx.font = `${sz}px 'Courier New', monospace`;
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = opts.color || '#fff';
    const words = text.split(' ');
    let line = '', ly = y;
    for (const w of words) {
      const test = line + (line ? ' ' : '') + w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, ly);
        line = w; ly += lineH;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, ly);
  },
};

// Test helpers (mirrors game logic)
function makeRng(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 0x100000000;
    },
  };
}

function randFloat(rng, min, max) {
  return min + (max - min) * rng.next();
}

function selectPickupType(waveIndex, roll) {
  if (waveIndex >= 5 && roll < 0.04) return 'bomb';
  if (roll < 0.12) return 'trail_boost';
  if (roll < 0.20) return 'speed_pickup';
  return 'scrap';
}

function collectPickupEvents(scraps, boostZones, player, dt) {
  const events = [];
  for (let i = scraps.length - 1; i >= 0; i--) {
    const s = scraps[i];
    if (player.magnetRange > 0) {
      const d = U.dist(s.x, s.y, player.x, player.y);
      if (d < player.magnetRange) {
        const pull = 200 * dt / Math.max(d, 1);
        s.x += (player.x - s.x) * pull;
        s.y += (player.y - s.y) * pull;
      }
    }
    if (U.dist(s.x, s.y, player.x, player.y) < CFG.SCRAP_RADIUS + player.radius + 10) {
      events.push(s.type || 'scrap');
      scraps.splice(i, 1);
    }
  }

  for (let i = boostZones.length - 1; i >= 0; i--) {
    const bz = boostZones[i];
    if (U.dist(bz.x, bz.y, player.x, player.y) < CFG.BOOST_ZONE_RADIUS + player.radius) {
      events.push('boost');
      boostZones.splice(i, 1);
    }
  }

  return events;
}

function updateScraps(scraps, player, dt, trailPoints) {
  const events = [];
  for (let i = scraps.length - 1; i >= 0; i--) {
    const s = scraps[i];
    s.life -= dt;
    if (player.magnetRange > 0) {
      const d = U.dist(s.x, s.y, player.x, player.y);
      if (d < player.magnetRange) {
        const pull = 200 * dt / Math.max(d, 1);
        s.x += (player.x - s.x) * pull;
        s.y += (player.y - s.y) * pull;
      }
    }
    if (player.trailMagnet && trailPoints && trailPoints.length > 0) {
      for (let ti = 0; ti < trailPoints.length; ti += 5) {
        const tp = trailPoints[ti];
        const tdx = tp.x - s.x, tdy = tp.y - s.y;
        const td = Math.hypot(tdx, tdy);
        if (td < 80 && td > 1) {
          s.x += (tdx / td) * 60 * dt;
          s.y += (tdy / td) * 60 * dt;
          break;
        }
      }
    }
    if (U.dist(s.x, s.y, player.x, player.y) < CFG.SCRAP_RADIUS + player.radius + 10) {
      const pType = s.type || 'scrap';
      scraps.splice(i, 1);
      events.push(pType);
      continue;
    }
    if (s.life <= 0) scraps.splice(i, 1);
  }
  return events;
}

function updateBoostZones(boostZones, player, dt) {
  const events = [];
  for (let i = boostZones.length - 1; i >= 0; i--) {
    const bz = boostZones[i];
    bz.life -= dt;
    if (U.dist(bz.x, bz.y, player.x, player.y) < CFG.BOOST_ZONE_RADIUS + player.radius) {
      boostZones.splice(i, 1);
      events.push('boost');
      continue;
    }
    if (bz.life <= 0) boostZones.splice(i, 1);
  }
  return events;
}

function hitTestUpgradeTap(tap, cardBounds, rerollBounds) {
  const within = (p, r) => r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  for (let i = 0; i < cardBounds.length; i++) {
    if (within(tap, cardBounds[i])) return { selectedIndex: i, reroll: false };
  }
  if (within(tap, rerollBounds)) return { selectedIndex: -1, reroll: true };
  return { selectedIndex: -1, reroll: false };
}

function computeWaveTiming(waveIndex) {
  const ramp = Math.min(1, (waveIndex - 1) / 4);
  const firstSpawn = U.lerp(CFG.FIRST_SPAWN_INITIAL, CFG.FIRST_SPAWN_MIN, ramp);
  const spawnInterval = U.lerp(CFG.SPAWN_INTERVAL_INITIAL, CFG.SPAWN_INTERVAL_MIN, ramp);
  const combatDuration = Math.min(CFG.WAVE_COMBAT_MAX, CFG.WAVE_COMBAT_WAVE1 + CFG.WAVE_TIME_GROWTH * (waveIndex - 1));
  const noBursts = waveIndex === 1;
  return { firstSpawn, spawnInterval, combatDuration, noBursts };
}

function computeHordeCount(waveIndex) {
  return Math.min(CFG.HORDE_MAX_COUNT, CFG.HORDE_BASE_COUNT + Math.floor(waveIndex * CFG.HORDE_WAVE_GROWTH));
}

function rollHordeTrigger(rng) {
  return randFloat(rng, CFG.HORDE_TRIGGER_MIN, CFG.HORDE_TRIGGER_MAX);
}

function shouldTriggerHorde(waveTimer, combatDuration, hordeTrigger) {
  return waveTimer >= combatDuration * hordeTrigger;
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function applyNearMiss(score, player, type) {
  const pts = type === 'enemy' ? CFG.NEAR_MISS_ENEMY_PTS : CFG.NEAR_MISS_HAZARD_PTS;
  let nextScore = score + pts * player.scoreMult;
  const nextCombo = Math.min(CFG.MAX_COMBO, (player.comboLevel || 0) + 1);
  let streak = (player.consecutiveNearMisses || 0) + 1;
  if (streak >= 3) {
    const streakBonus = 50 * streak;
    nextScore += streakBonus * player.scoreMult;
  }
  return {
    score: nextScore,
    comboLevel: nextCombo,
    consecutiveNearMisses: streak,
  };
}

function updateNearMissStreak(player, dt) {
  if (player.nearMissStreakTimer > 0) {
    player.nearMissStreakTimer -= dt;
    if (player.nearMissStreakTimer <= 0) player.consecutiveNearMisses = 0;
  }
}

function applyComboDecay(comboLevel, comboMaster, dt) {
  const comboDecay = comboMaster ? 1.0 : 2.0;
  return Math.max(0, comboLevel - dt * comboDecay);
}

function driftComboScoreTick(driftTime, lastDriftComboTick, comboLevel) {
  const ticks = Math.floor(driftTime / CFG.DRIFT_COMBO_INTERVAL);
  if (ticks > lastDriftComboTick) {
    const pts = CFG.DRIFT_COMBO_BASE * Math.floor(comboLevel + 1);
    return { scoreDelta: pts, nextTick: ticks };
  }
  return { scoreDelta: 0, nextTick: lastDriftComboTick };
}

function computeCollisionDamage(baseDmg, waveIndex) {
  const waveScale = waveIndex > 5
    ? Math.min(CFG.DMG_SCALE_MAX, 1 + CFG.DMG_SCALE_PER_WAVE * (waveIndex - 5))
    : 1;
  return Math.round(baseDmg * waveScale);
}

function applyPlayerDamage(player, dmg, drifting) {
  let finalDmg = Math.round(dmg * (1 - (player.damageResist || 0)));
  if (player.driftShield && drifting) finalDmg = Math.round(finalDmg * 0.6);
  finalDmg = Math.max(finalDmg, 1);
  player.hp -= finalDmg;
  player.invulnTimer = CFG.HIT_INVULN;
  player.lastHitTimer = 0;
  return finalDmg;
}

function applyShieldBreak(player) {
  player.shield = false;
  player.invulnTimer = CFG.SHIELD_INVULN;
}

function applyHpRegen(player, dt) {
  player.lastHitTimer += dt;
  if (player.hpRegen > 0 && player.lastHitTimer > CFG.HP_REGEN_DELAY) {
    player.hp = Math.min(player.hp + player.hpRegen * dt, player.maxHp);
  }
}

function applyGhostFrameNearMiss(player, hasGhostFrame) {
  if (hasGhostFrame) player.ghostFrameTimer = 0.3;
}

function computeEncircleOutcome(killCount, comboLevel, scoreMult, encircleScoreBonus) {
  const comboMult = Math.max(1, Math.floor(comboLevel + 1));
  const baseScore = 100 * killCount;
  const bonus = killCount >= 2 ? 50 * killCount : 0;
  const encircleBonus = encircleScoreBonus || 1;
  const total = Math.floor((baseScore + bonus) * comboMult * encircleBonus);
  const newCombo = Math.min(CFG.MAX_COMBO, comboLevel + 2 * killCount);
  return {
    scoreDelta: total * scoreMult,
    comboLevel: newCombo,
  };
}

// Run stat tracking helpers
function updateRunStats(stats, event) {
  switch (event.type) {
    case 'near_miss': {
      stats.nearMissTotal++;
      const newCombo = Math.min(CFG.MAX_COMBO, (event.comboLevel || 0) + 1);
      stats.peakCombo = Math.max(stats.peakCombo, Math.floor(newCombo));
      return { comboLevel: newCombo };
    }
    case 'encircle': {
      const killCount = event.killCount || 0;
      stats.enemiesKilled += killCount;
      const newCombo = Math.min(CFG.MAX_COMBO, (event.comboLevel || 0) + 2 * killCount);
      stats.peakCombo = Math.max(stats.peakCombo, Math.floor(newCombo));
      return { comboLevel: newCombo };
    }
    case 'drift_tick': {
      if (event.drifting) stats.totalDriftTime += event.dt;
      return {};
    }
    case 'bomb': {
      stats.enemiesKilled += event.killCount || 0;
      return {};
    }
  }
  return {};
}

function makeRunStats() {
  return { peakCombo: 0, nearMissTotal: 0, totalDriftTime: 0, enemiesKilled: 0 };
}

// Upgrade effect helpers
function applyDriftShield(dmg, drifting, hasDriftShield) {
  if (hasDriftShield && drifting) return Math.max(1, Math.round(dmg * 0.6));
  return dmg;
}

function applyComboHeal(oldLevel, newLevel, hasComboHeal, hp, maxHp) {
  if (!hasComboHeal) return hp;
  const milestones = [3, 5, 8];
  for (const m of milestones) {
    if (Math.floor(oldLevel) < m && Math.floor(newLevel) >= m) {
      const healAmt = m >= 8 ? 25 : m >= 5 ? 15 : 10;
      return Math.min(maxHp, hp + healAmt);
    }
  }
  return hp;
}

// Enemy pool helpers
function getEnemyPool(score) {
  const pool = ['chaser'];
  if (score >= 1000) pool.push('interceptor');
  if (score >= 1500) pool.push('drifter');
  if (score >= 2000) pool.push('blocker');
  if (score >= 2500) pool.push('flanker');
  if (score >= 3000) pool.push('bomber');
  return pool;
}

function shouldSpawnElite(waveIndex, roll) {
  return waveIndex >= 4 && roll < 0.12;
}

function computeFlankTarget(px, py, pvx, pvy, flankSide) {
  const pSpeed = Math.hypot(pvx, pvy);
  if (pSpeed < 50) return { x: px, y: py };
  const perpX = -pvy / pSpeed * flankSide;
  const perpY = pvx / pSpeed * flankSide;
  return { x: px + perpX * 200, y: py + perpY * 200 };
}

function computeBlockerTarget(trailPoints) {
  if (!trailPoints || trailPoints.length === 0) return null;
  let sx = 0, sy = 0;
  const step = Math.max(1, Math.floor(trailPoints.length / 50));
  let count = 0;
  for (let i = 0; i < trailPoints.length; i += step) {
    sx += trailPoints[i].x;
    sy += trailPoints[i].y;
    count++;
  }
  return { x: sx / count, y: sy / count };
}

function applyBombZoneDamage(dmg, dt, damageResist) {
  const raw = Math.round(dmg * dt);
  if (raw < 1) return 0;
  return Math.max(1, Math.round(raw * (1 - (damageResist || 0))));
}

function computeModifierScoreMult(modifiers) {
  let mult = 1;
  if (modifiers.hardMode) mult *= 1.5;
  if (modifiers.speedRush) mult *= 1.3;
  if (modifiers.fragile) mult *= 1.4;
  if (modifiers.doubleEnemies) mult *= 1.6;
  return mult;
}

const OversteerLogic = {
  CFG,
  CFG_BASE,
  MAPS,
  MAPS_BY_ID,
  S,
  U,
  makeRng,
  randFloat,
  selectPickupType,
  collectPickupEvents,
  updateScraps,
  updateBoostZones,
  hitTestUpgradeTap,
  computeWaveTiming,
  computeHordeCount,
  rollHordeTrigger,
  shouldTriggerHorde,
  pointInPoly,
  applyNearMiss,
  updateNearMissStreak,
  applyComboDecay,
  driftComboScoreTick,
  computeCollisionDamage,
  applyPlayerDamage,
  applyShieldBreak,
  applyHpRegen,
  applyGhostFrameNearMiss,
  computeEncircleOutcome,
  updateRunStats,
  makeRunStats,
  applyDriftShield,
  applyComboHeal,
  getEnemyPool,
  shouldSpawnElite,
  computeFlankTarget,
  computeBlockerTarget,
  applyBombZoneDamage,
  computeModifierScoreMult,
};

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OversteerLogic;
  }
  if (typeof window !== 'undefined') {
    window.OversteerLogic = OversteerLogic;
  }
})();
