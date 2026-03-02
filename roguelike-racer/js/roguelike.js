// ============================================================
// Road Rogue - Roguelike Systems
// Upgrades, Run Modifiers, and Meta Progression
// ============================================================

// ── Upgrade Definitions ─────────────────────────────────────
const UPGRADES = [
  {
    id:   'turbo',
    name: 'Turbo Engine',
    icon: '🚀',
    desc: '+25% top speed. Feel the raw power.',
    rarity: 'common',
    apply(player) { player.maxSpeed *= 1.25; },
  },
  {
    id:   'shield',
    name: 'Crash Shield',
    icon: '🛡️',
    desc: 'Absorbs one collision completely. One-time use.',
    rarity: 'rare',
    apply(player) { player.shield = true; },
  },
  {
    id:   'nitro',
    name: 'Nitro Tanks',
    icon: '💨',
    desc: 'Press SHIFT for a 5-second speed burst. Refills each upgrade.',
    rarity: 'uncommon',
    apply(player) { player.nitroLeft = 5; },
  },
  {
    id:   'fuel_efficient',
    name: 'Lean Injectors',
    icon: '⛽',
    desc: 'Fuel consumption reduced by 35%.',
    rarity: 'common',
    apply(player) { player.fuelEfficiency *= 0.65; },
  },
  {
    id:   'magnet',
    name: 'Fuel Magnet',
    icon: '🧲',
    desc: 'Auto-collect fuel pickups within a wide radius.',
    rarity: 'uncommon',
    apply(player) { player.magnetRange = 300; },
  },
  {
    id:   'slick_tires',
    name: 'Slick Tires',
    icon: '🏎️',
    desc: 'Cuts curve drift in half. Much easier to corner.',
    rarity: 'common',
    apply(player) {
      // Patch the global config for this run (restored on reset)
      player._origCentrifugal = player._origCentrifugal || CONFIG.PLAYER_CENTRIFUGAL;
      CONFIG.PLAYER_CENTRIFUGAL *= 0.5;
    },
  },
  {
    id:   'ram_plating',
    name: 'Ram Plating',
    icon: '⚔️',
    desc: 'Can push through small sedans without crashing.',
    rarity: 'rare',
    apply(player) { player.ghostTruck = false; player.ramSedans = true; },
  },
  {
    id:   'wide_body',
    name: 'Wide Body Kit',
    icon: '🏗️',
    desc: 'Wider car adds presence; harder to dodge but +15% score.',
    rarity: 'uncommon',
    apply(player) { player.wideBody = true; player.scoreMult = (player.scoreMult || 1) * 1.15; },
  },
  {
    id:   'second_wind',
    name: 'Reserve Tank',
    icon: '🛢️',
    desc: 'Immediately refills fuel to 100%.',
    rarity: 'common',
    apply(player) { player.fuel = CONFIG.FUEL_MAX; },
  },
  {
    id:   'score_freak',
    name: 'Speed Scorer',
    icon: '⭐',
    desc: 'Score multiplier ×2 but traffic density +30%.',
    rarity: 'uncommon',
    apply(player) { player.scoreMult = (player.scoreMult || 1) * 2; },
    sideEffect(game) { game.traffic.density *= 1.3; },
  },
  {
    id:   'overclock',
    name: 'Overclock',
    icon: '⚡',
    desc: 'Speed scaling slows down — longer before things get brutal.',
    rarity: 'rare',
    apply(player) { /* handled in main via flag */ player.overclock = true; },
  },
  {
    id:   'nitro_refill',
    name: 'Nitro Refill',
    icon: '💥',
    desc: 'Top up nitro tanks with +8 seconds.',
    rarity: 'common',
    apply(player) { player.nitroLeft += 8; },
  },
];

// ── Run Modifier Definitions ────────────────────────────────
// Applied once at the start of a run; can be positive, negative, or mixed.
const RUN_MODIFIERS = [
  {
    id:    'wet_roads',
    name:  'Wet Roads',
    icon:  '🌧️',
    desc:  'Rain-soaked tarmac. Slipperier handling, more curve drift.',
    weather: 'rain',
    apply(game) {
      CONFIG.PLAYER_CENTRIFUGAL += 0.2;
    },
    revert(game) {
      CONFIG.PLAYER_CENTRIFUGAL -= 0.2;
    },
  },
  {
    id:    'night_drive',
    name:  'Night Drive',
    icon:  '🌙',
    desc:  'Headlights only. Heavy fog reduces visibility.',
    weather: 'night',
    apply(game) { game.nightLevel = 0.9; },
    revert(game) { game.nightLevel = 0; },
  },
  {
    id:    'rush_hour',
    name:  'Rush Hour',
    icon:  '🚗',
    desc:  'Traffic density doubled. Everyone wants on the same road.',
    apply(game) { game.traffic.density = Math.ceil(game.traffic.density / 2); },
    revert(game) {},
  },
  {
    id:    'narrow_pass',
    name:  'Narrow Pass',
    icon:  '🏔️',
    desc:  'Mountain roads. Road is 25% narrower.',
    apply(game) { game.roadWidthMult = 0.75; },
    revert(game) { game.roadWidthMult = 1.0; },
  },
  {
    id:    'hyperdrive',
    name:  'Hyperdrive',
    icon:  '🛸',
    desc:  'Start at 80% speed immediately. High risk, high reward.',
    apply(game) { game.player.speed = game.player.maxSpeed * 0.8; },
    revert(game) {},
  },
  {
    id:    'blizzard',
    name:  'Blizzard',
    icon:  '❄️',
    desc:  'Snowstorm. Low visibility and icy roads.',
    weather: 'snow',
    apply(game) {
      game.nightLevel   = 0.3;
      CONFIG.PLAYER_CENTRIFUGAL += 0.25;
    },
    revert(game) {
      game.nightLevel   = 0;
      CONFIG.PLAYER_CENTRIFUGAL -= 0.25;
    },
  },
  {
    id:    'fuel_leak',
    name:  'Fuel Leak',
    icon:  '💧',
    desc:  'Fuel burns 40% faster. Find those pickups.',
    apply(game) { game.player.fuelEfficiency *= 1.4; },
    revert(game) {},
  },
  {
    id:    'clean_run',
    name:  'Clean Roads',
    icon:  '🌤️',
    desc:  'Clear skies, light traffic. A good day to drive.',
    apply(game) { game.traffic.density = Math.floor(game.traffic.density * 1.4); },
    revert(game) {},
  },
];

// ── Upgrade System ──────────────────────────────────────────
class UpgradeSystem {
  constructor() {
    this.offered  = [];  // currently shown upgrade choices
    this.history  = [];  // upgrades taken this run
    this.nextAt   = CONFIG.UPGRADE_INTERVAL;
  }

  reset() {
    this.offered = [];
    this.history = [];
    this.nextAt  = CONFIG.UPGRADE_INTERVAL;
  }

  shouldOffer(distanceM) {
    return distanceM >= this.nextAt;
  }

  // Pick N upgrades, avoiding repeats (except stackable ones)
  buildOffer(player) {
    const stackable = ['nitro_refill', 'second_wind'];
    const pool = UPGRADES.filter(u =>
      !player.upgrades.includes(u.id) || stackable.includes(u.id)
    );
    this.offered = Utils.randomSample(pool, CONFIG.UPGRADES_TO_OFFER);
    if (this.offered.length === 0) {
      // Fallback: offer refills
      this.offered = [UPGRADES.find(u => u.id === 'second_wind'), UPGRADES.find(u => u.id === 'nitro_refill')];
    }
    return this.offered;
  }

  choose(index, player, game) {
    const upgrade = this.offered[index];
    if (!upgrade) return;
    player.applyUpgrade(upgrade);
    if (upgrade.sideEffect) upgrade.sideEffect(game);
    this.history.push(upgrade.id);
    this.nextAt += CONFIG.UPGRADE_INTERVAL;
    this.offered = [];
  }

  // ── Run modifier selection ──────────────────────────────
  static pickRunModifiers(count) {
    return Utils.randomSample(RUN_MODIFIERS, count);
  }

  static applyModifiers(modifiers, game) {
    for (const mod of modifiers) {
      if (mod.apply) mod.apply(game);
    }
  }

  static revertModifiers(modifiers, game) {
    for (const mod of modifiers) {
      if (mod.revert) mod.revert(game);
    }
  }
}

// ── Rarity colours for UI ───────────────────────────────────
const RARITY_COLORS = {
  common:   '#aaaaaa',
  uncommon: '#55cc55',
  rare:     '#5588ff',
  epic:     '#cc44cc',
};
