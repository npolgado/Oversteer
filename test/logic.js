const CFG = {
  SCRAP_RADIUS: 7,
  BOOST_ZONE_RADIUS: 22,
  NEAR_MISS_ENEMY_PTS: 25,
  NEAR_MISS_HAZARD_PTS: 15,
  MAX_COMBO: 8,
  FIRST_SPAWN_INITIAL: 2.5,
  SPAWN_INTERVAL_INITIAL: 4.0,
  FIRST_SPAWN_MIN: 0.6,
  SPAWN_INTERVAL_MIN: 1.5,
  WAVE_COMBAT_WAVE1: 30,
  WAVE_TIME_GROWTH: 10,
  WAVE_COMBAT_MAX: 120,
  HORDE_BASE_COUNT: 5,
  HORDE_WAVE_GROWTH: 0.5,
  HORDE_MAX_COUNT: 40,
};

const U = {
  clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
  lerp(a, b, t) { return a + (b - a) * t; },
  dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },
};

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

// --- Stat tracking helpers (mirrors Game logic) ---

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

// --- Upgrade effect helpers ---

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

module.exports = {
  CFG,
  U,
  collectPickupEvents,
  hitTestUpgradeTap,
  computeWaveTiming,
  computeHordeCount,
  shouldTriggerHorde,
  pointInPoly,
  applyNearMiss,
  updateRunStats,
  makeRunStats,
  applyDriftShield,
  applyComboHeal,
};
