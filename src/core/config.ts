// config.ts — Ported from arena-drifter/logic.js
// Mutable config object; applyMap() mutates it at runtime.

export type PropType = 'solid' | 'slow' | 'slip' | 'decoration' | 'hazard';

export interface PropDef {
  image: string;
  radius: number;
  weight: number;
  type: PropType;
  duration?: number;
  strength?: number;
  damage?: number;
}

export type EnemyType =
  | 'chaser'
  | 'interceptor'
  | 'drifter'
  | 'elite'
  | 'blocker'
  | 'flanker'
  | 'bomber'
  | 'splitter'
  | 'boss';

export type EnemySprites = Record<EnemyType, string[]>;

export interface MapCfgOverrides {
  BACKGROUND_SPRITE?: string;
  PROP_POOL?: PropDef[];
  [key: string]: unknown;
}

// ── Biome framework ───────────────────────────────────────────────────────────

// NOTE: not in original — Phase 4.5 per-biome hazard rules
export interface BiomeHazardRules {
  kind: 'none' | 'heat_crack' | 'corruption';
  spawnInterval: number;
  maxZones: number;
  radius: number;
  // heat_crack only
  telegraphTime?: number;
  eruptDuration?: number;
  burstDamage?: number;
  // corruption only
  growthRate?: number;
  maxRadius?: number;
  multiplyInterval?: number;
  dps?: number;
}

// NOTE: not in original — Phase 4.9 per-biome persistent geometry
export interface BiomeStructureDef {
  x: number;   // absolute world-space position
  y: number;
  radius: number;
  type: 'solid' | 'slow' | 'slip';
}

export interface BiomeDescriptor {
  id: string;
  name: string;
  backgroundSprite: string;
  lightingTint: number;    // 0xRRGGBB tint applied to background layer
  fogColor: number;
  fogDensity: number;      // 0–1 alpha of fog overlay
  propPool: PropDef[];
  structures: BiomeStructureDef[];  // NOTE: not in original — persistent landmark structures per biome
  enemyWeightMult: Partial<Record<EnemyType, number>>;  // >1 = more of this type
  musicPackId: string;     // key into MUSIC_PACKS (future asset set)
  upgradeBias: Record<string, number>;  // upgrade id → weight multiplier
  hazardRules: BiomeHazardRules;
}

// Neon Wasteland — onboarding biome, waves 1-7
// Geometry: open arena with a few large landmark boulders (minimal obstruction for onboarding)
const _WASTELAND: BiomeDescriptor = {
  id: 'wasteland',
  name: 'Neon Wasteland',
  backgroundSprite: 'backgrounds/background_01.png',
  lightingTint: 0xFFE0C0,
  fogColor: 0xFF6600,
  fogDensity: 0.07,
  propPool: [
    { image: 'props/tree_1.png',  radius: 50, weight: 3, type: 'solid' },
    { image: 'props/rock_1.png',  radius: 40, weight: 2, type: 'solid' },
    { image: 'props/mud_1.png',   radius: 62, weight: 2, type: 'slow', duration: 2.0, strength: 0.5 },
    { image: 'props/mud_1.png',   radius: 55, weight: 2, type: 'slip', duration: 1.5, strength: 0.6 },
    { image: 'props/bush_1.png',  radius: 25, weight: 5, type: 'decoration' },
  ],
  structures: [
    // 3 large landmark boulders off-center — visible reference points, not blockades
    { x: 900,  y: 800,  radius: 90, type: 'solid' },
    { x: 2100, y: 900,  radius: 80, type: 'solid' },
    { x: 1500, y: 2300, radius: 85, type: 'solid' },
  ],
  enemyWeightMult: {},
  musicPackId: 'wasteland',
  upgradeBias: { turbo: 2, nitro_drift: 2, speed_demon: 1.5, drift_king: 1.5 },
  hazardRules: { kind: 'heat_crack', spawnInterval: 6, maxZones: 4, radius: 70, telegraphTime: 1.5, eruptDuration: 1.2, burstDamage: 12 },
};

// Frozen Rupture — handling variation, waves 8-14
// Geometry: central pillar + 4 flanking columns — drift around the pillar; pairs with flanker bias + heavy slip
const _RUPTURE: BiomeDescriptor = {
  id: 'rupture',
  name: 'Frozen Rupture',
  backgroundSprite: 'backgrounds/background_02.png',
  lightingTint: 0x99BBFF,
  fogColor: 0x88CCFF,
  fogDensity: 0.13,
  propPool: [
    { image: 'props/rock_1.png',  radius: 40, weight: 4, type: 'solid' },
    { image: 'props/rock_1.png',  radius: 35, weight: 3, type: 'hazard', damage: 8 },
    { image: 'props/mud_1.png',   radius: 55, weight: 6, type: 'slip', duration: 2.5, strength: 0.7 },
    { image: 'props/bush_1.png',  radius: 25, weight: 2, type: 'decoration' },
  ],
  structures: [
    // Central ice spire — primary loop anchor
    { x: 1500, y: 1500, radius: 110, type: 'solid' },
    // 4 flanking columns at diagonals — narrows the arena into corridors
    { x: 900,  y: 900,  radius: 55, type: 'solid' },
    { x: 2100, y: 900,  radius: 55, type: 'solid' },
    { x: 900,  y: 2100, radius: 55, type: 'solid' },
    { x: 2100, y: 2100, radius: 55, type: 'solid' },
    // Slip patches around the central spire — falling off a drift arc stings
    { x: 1300, y: 1500, radius: 80, type: 'slip' },
    { x: 1700, y: 1500, radius: 80, type: 'slip' },
  ],
  enemyWeightMult: { flanker: 1.8 },
  musicPackId: 'rupture',
  upgradeBias: { tight_turns: 2, drift_king: 2, drift_shield: 1.5 },
  hazardRules: { kind: 'none', spawnInterval: 0, maxZones: 0, radius: 0 },
};

// Corruption Jungle — density stress test, waves 15+
// Geometry: dense chokepoint clusters in 4 quadrants — claustrophobic lanes; pairs with bomber/blocker/splitter
const _JUNGLE: BiomeDescriptor = {
  id: 'jungle',
  name: 'Corruption Jungle',
  backgroundSprite: 'backgrounds/background_03.png',
  lightingTint: 0x88FF88,
  fogColor: 0x336622,
  fogDensity: 0.20,
  propPool: [
    { image: 'props/tree_1.png',  radius: 50, weight: 6, type: 'solid' },
    { image: 'props/bush_1.png',  radius: 25, weight: 6, type: 'decoration' },
    { image: 'props/mud_1.png',   radius: 62, weight: 3, type: 'slow', duration: 2.0, strength: 0.5 },
  ],
  structures: [
    // NW cluster
    { x: 700,  y: 700,  radius: 70, type: 'solid' },
    { x: 900,  y: 600,  radius: 50, type: 'solid' },
    { x: 650,  y: 950,  radius: 45, type: 'solid' },
    // NE cluster
    { x: 2300, y: 700,  radius: 70, type: 'solid' },
    { x: 2100, y: 600,  radius: 50, type: 'solid' },
    { x: 2350, y: 950,  radius: 45, type: 'solid' },
    // SW cluster
    { x: 700,  y: 2300, radius: 70, type: 'solid' },
    { x: 900,  y: 2400, radius: 50, type: 'solid' },
    { x: 650,  y: 2050, radius: 45, type: 'solid' },
    // SE cluster
    { x: 2300, y: 2300, radius: 70, type: 'solid' },
    { x: 2100, y: 2400, radius: 50, type: 'solid' },
    { x: 2350, y: 2050, radius: 45, type: 'solid' },
    // Central slow patch — the eye of the storm
    { x: 1500, y: 1500, radius: 120, type: 'slow' },
  ],
  enemyWeightMult: { bomber: 1.6, blocker: 1.4, splitter: 1.5 },
  musicPackId: 'jungle',
  upgradeBias: { max_hp: 2, hp_regen: 2, damage_resist: 1.5 },
  hazardRules: { kind: 'corruption', spawnInterval: 8, maxZones: 6, radius: 50, growthRate: 12, maxRadius: 140, multiplyInterval: 10, dps: 0.7 },
};

export const BIOMES: BiomeDescriptor[] = [_WASTELAND, _RUPTURE, _JUNGLE];
export const BIOMES_BY_ID: Record<string, BiomeDescriptor> = Object.fromEntries(
  BIOMES.map(b => [b.id, b]),
);
export type BiomeId = 'wasteland' | 'rupture' | 'jungle';

export interface MapDef {
  id: string;
  name: string;
  desc: string;
  cfg: MapCfgOverrides;
}

export interface CfgShape {
  // Viewport
  W: number;
  H: number;
  // Physics
  ACCEL: number;
  MAX_SPEED: number;
  REVERSE_ACCEL: number;
  REVERSE_MAX: number;
  TURN_RATE: number;
  TURN_REDUCE_AT_MAX: number;
  LATERAL_FRICTION: number;
  FORWARD_DRAG: number;
  DRIFT_LATERAL: number;
  DRIFT_DRAG: number;
  DRIFT_THRESHOLD: number;
  DRIFT_BOOST: number;
  ARENA_PAD: number;
  BOUNCE_RETAIN: number;
  PROP_PLAYER_BOUNCE: number;
  PROP_ENEMY_BOUNCE: number;
  // Player
  PLAYER_W: number;
  PLAYER_H: number;
  PLAYER_SPRITE_S: number;
  PLAYER_RADIUS: number;
  PLAYER_DRIFT_SHRINK: number;
  // Enemy speeds
  CHASER_SPEED: number;
  INTERCEPTOR_SPEED: number;
  DRIFTER_SPEED: number;
  BLOCKER_SPEED: number;
  FLANKER_SPEED: number;
  BOMBER_SPEED: number;
  SPLITTER_SPEED: number;
  ENEMY_RADIUS: number;
  ENEMY_W: number;
  ENEMY_H: number;
  ENEMY_SPRITE_S: number;
  ENEMY_ACCEL: number;
  ENEMY_TURN_RATE: number;
  // Near-miss
  NEAR_MISS_ENEMY: number;
  NEAR_MISS_HAZARD: number;
  NEAR_MISS_COOLDOWN: number;
  // Scoring
  SCORE_PER_SEC: number;
  NEAR_MISS_ENEMY_PTS: number;
  NEAR_MISS_HAZARD_PTS: number;
  DRIFT_COMBO_INTERVAL: number;
  DRIFT_COMBO_BASE: number;
  MAX_COMBO: number;
  DRIFT_COMBO_ENGAGE_R: number;    // NOTE: not in original — proximity gate radius
  DRIFT_COMBO_ENGAGE_T: number;    // NOTE: not in original — engagement grace period (s)
  // Waves
  WAVE_COMBAT: number;
  WAVE_BREAK: number;
  FIRST_SPAWN: number;
  SPAWN_INTERVAL: number;
  BURST_INTERVAL: number;
  BURST_COUNT: number;
  BURST_DELAY: number;
  // Scrap
  SCRAP_INTERVAL: number;
  SCRAP_RADIUS: number;
  SCRAP_NEAR_MISS_CHANCE: number;
  // Upgrades
  UPGRADES_TO_OFFER: number;
  REROLL_MAX: number;
  UPGRADE_CONFIRM_TIME: number;
  // Colors
  C_BG: string;
  C_BG2: string;
  C_PANEL: string;
  C_TEXT: string;
  C_PLAYER: string;
  C_ACCENT: string;
  C_ENEMY: string;
  C_ENEMY_DARK: string;
  C_PICKUP: string;
  C_RARE: string;
  C_SHIELD: string;
  // Death
  FREEZE_TIME: number;
  DEATH_SLOWMO: number;
  DEATH_SLOWMO_DUR: number;
  SHARD_COUNT_MIN: number;
  SHARD_COUNT_MAX: number;
  // Shield
  SHIELD_KNOCKBACK: number;
  SHIELD_INVULN: number;
  // Health
  PLAYER_HP: number;
  PLAYER_HP_MAX: number;
  HP_REGEN: number;
  HIT_INVULN: number;
  HIT_KNOCKBACK: number;
  HP_REGEN_DELAY: number;
  DMG_CHASER: number;
  DMG_INTERCEPTOR: number;
  DMG_DRIFTER: number;
  DMG_ELITE: number;
  DMG_BLOCKER: number;
  DMG_FLANKER: number;
  DMG_BOMBER: number;
  DMG_BOSS: number;
  DMG_SCALE_PER_WAVE: number;
  DMG_SCALE_MAX: number;
  // Boss
  BOSS_SPEED: number;
  BOSS_HP: number;
  BOSS_HP_GROWTH: number;  // NOTE: not in original — HP added per 5 waves above wave 5
  BOSS_RADIUS: number;
  BOSS_SPRITE_S: number;
  BOSS_TELEGRAPH_DUR: number;
  BOSS_TELEGRAPH_ORBIT_R: number;  // orbit radius during pursuer telegraph phase
  BOSS_HIT_FLASH_S: number;        // seconds boss flashes white after encirclement hit
  BOSS_CHARGE_DUR: number;
  BOSS_CHARGE_SPEED: number;
  BOSS_MINION_INTERVAL: number;
  BOSS_MINION_RADIUS: number;      // spawn distance of minion ring from boss center
  BOSS_MINION_MAX: number;         // max total minions per boss fight
  BOSS_VULNERABLE_DUR: number;
  BOSS_INVULN_DUR: number;
  BOSS_INVULN_WARN_T: number;      // NOTE: not in original — Core pre-vulnerable gold-flicker window
  BOSS_RECOVER_DUR: number;        // NOTE: not in original — Pursuer stagger/punish window after charge
  BOSS_REFLECTOR_PAUSE_DUR: number; // NOTE: not in original — Reflector center-pause vulnerable window
  BOSS_REFLECTOR_VULN_R: number;   // NOTE: not in original — proximity to center that triggers pause
  BOSS_CHIP_KNOCKBACK: number;     // NOTE: not in original — impulse applied on successful encirclement chip
  BOSS_SPAWN_DIST_MIN: number;     // min distance from player on boss spawn
  BOSS_SPAWN_DIST_RANGE: number;   // additional random range above min
  BOSS_WAVE_INTERVAL: number;      // every N waves is a boss wave
  // Horde
  HORDE_TRIGGER_MIN: number;
  HORDE_TRIGGER_MAX: number;
  HORDE_DELAY: number;
  HORDE_BASE_COUNT: number;
  HORDE_WAVE_GROWTH: number;
  HORDE_MAX_COUNT: number;
  HORDE_SPAWN_DIST: number;
  HORDE_ARC_RAD: number;    // angular spread of horde spawn arc (radians)
  HORDE_BATCH_WAVE_2: number;  // NOTE: not in original — wave threshold for 2 horde batches
  HORDE_BATCH_WAVE_3: number;  // NOTE: not in original — wave threshold for 3 horde batches
  // World
  WORLD_W: number;
  WORLD_H: number;
  // Camera
  CAMERA_ROTATION_LERP_SPEED: number;
  // Scoring
  ELITE_ENCIRCLE_KILLS: number;
  // Enemy lifespan
  ENEMY_LIFESPAN_MIN: number;
  ENEMY_LIFESPAN_MAX: number;
  ENEMY_OFFSCREEN_BOOST: number;
  ENEMY_OFFSCREEN_DESPAWN: number;
  ENEMY_FAR_DESPAWN_DIST: number;
  // Handbrake
  HANDBRAKE_TURN_MULT: number;
  HANDBRAKE_DURATION: number;
  HANDBRAKE_DECEL: number;
  // Speed boost zones
  BOOST_ZONE_RADIUS: number;
  BOOST_ZONE_DURATION: number;
  BOOST_ZONE_MULT: number;
  BOOST_ZONE_SPAWN_INTERVAL: number;
  // Bomber hazard zones
  BOMB_ZONE_RADIUS: number;
  BOMB_ZONE_DURATION: number;
  BOMB_ZONE_INTERVAL: number;
  BOMB_ZONE_DMG: number;
  BOMB_ZONE_SLOW: number;
  BOMB_ZONE_MAX: number;
  // Drift chaining
  DRIFT_CHAIN_WINDOW: number;
  DRIFT_CHAIN_MULT_1: number;
  DRIFT_CHAIN_MULT_2: number;
  // Wall riding
  WALL_RIDE_DIST_FRAC: number;
  WALL_RIDE_SPEED_BONUS: number;
  // Early-game balancing
  FIRST_SPAWN_INITIAL: number;
  SPAWN_INTERVAL_INITIAL: number;
  FIRST_SPAWN_MIN: number;
  SPAWN_INTERVAL_MIN: number;
  SPAWN_INTERVAL_FLOOR: number;  // NOTE: not in original — second ramp floor for waves 5→15
  WAVE_COMBAT_WAVE1: number;
  WAVE_TIME_GROWTH: number;
  WAVE_COMBAT_MAX: number;
  // Trail anti-AFK
  TRAIL_MAX_AGE: number;              // NOTE: not in original — trail point expires after this many ms
  TRAIL_IDLE_SPEED_THRESHOLD: number; // NOTE: not in original — min px/s to record trail points
  // Props
  PROP_CHUNK_SIZE: number;
  PROP_DENSITY: number;
  PROP_MIN_DIST: number;
  PROP_POOL: PropDef[];
  // Sprites
  PLAYER_SPRITE: string;
  ENEMY_SPRITES_BY_TYPE: EnemySprites;
  BACKGROUND_SPRITE: string;
  // Bloom — NOTE: not in original
  BLOOM_BLUR_STRENGTH: number;
  BLOOM_BLUR_QUALITY: number;
  BLOOM_TRAIL_WIDTH_MULT: number;
  BLOOM_TRAIL_ALPHA_MULT: number;
  BLOOM_PLAYER_GLOW_RADIUS_MULT: number;
  // Vignette — port of arena-drifter/fx.js:51-61
  VIGNETTE_INNER: number;
  VIGNETTE_OUTER: number;
  VIGNETTE_ALPHA: number;
  // Speed lines — port of arena-drifter/game.js:1270-1294
  SPEED_LINES_THRESHOLD: number;
  // Chromatic aberration — port of arena-drifter/game.js:1297-1314
  ABERRATION_SPEED_THRESHOLD: number;  // speed fraction above which aberration kicks in
  ABERRATION_DYING_INTENSITY: number;  // fixed intensity while dying
}

// Mutable at runtime — applyMap() writes into this object.
export const CFG: CfgShape = {
  // Viewport
  W: 1600,
  H: 900,
  // Physics
  ACCEL: 900,
  MAX_SPEED: 520,
  REVERSE_ACCEL: 600,
  REVERSE_MAX: 240,
  TURN_RATE: 240 * Math.PI / 180,
  TURN_REDUCE_AT_MAX: 0.45,
  LATERAL_FRICTION: 8.5,
  FORWARD_DRAG: 1.7,
  DRIFT_LATERAL: 3.2,
  DRIFT_DRAG: 2.1,
  DRIFT_THRESHOLD: 180,
  DRIFT_BOOST: 60,
  ARENA_PAD: 24,
  BOUNCE_RETAIN: 0.35,
  PROP_PLAYER_BOUNCE: 0.3,
  PROP_ENEMY_BOUNCE: 0.4,
  // Player
  PLAYER_W: 34,
  PLAYER_H: 18,
  PLAYER_SPRITE_S: 56,
  PLAYER_RADIUS: 10,
  PLAYER_DRIFT_SHRINK: 2,
  // Enemy speeds
  CHASER_SPEED: 420,
  INTERCEPTOR_SPEED: 460,
  DRIFTER_SPEED: 440,
  BLOCKER_SPEED: 380,
  FLANKER_SPEED: 470,
  BOMBER_SPEED: 400,
  SPLITTER_SPEED: 420,
  ENEMY_RADIUS: 9,
  ENEMY_W: 32,
  ENEMY_H: 16,
  ENEMY_SPRITE_S: 50,
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
  MAX_COMBO: 16,
  DRIFT_COMBO_ENGAGE_R: 500,  // NOTE: not in original — must have enemy within 500px OR recent engagement
  DRIFT_COMBO_ENGAGE_T: 3.0,  // NOTE: not in original — grace period after kill/near-miss (s)
  // Waves
  WAVE_COMBAT: 25,
  WAVE_BREAK: 8,
  FIRST_SPAWN: 0.8,
  SPAWN_INTERVAL: 2.2,
  BURST_INTERVAL: 8,
  BURST_COUNT: 2,
  BURST_DELAY: 0.3,
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
  HP_REGEN_DELAY: 1.0,    // §7 balance: 2.0→1.0 — regen kicks in faster after a hit
  DMG_CHASER: 15,
  DMG_INTERCEPTOR: 18,
  DMG_DRIFTER: 15,
  DMG_ELITE: 25,
  DMG_BLOCKER: 12,
  DMG_FLANKER: 20,
  DMG_BOMBER: 14,
  DMG_BOSS: 25,
  DMG_SCALE_PER_WAVE: 0.12,   // §4.9 balance: raised 0.08→0.12 — late waves hurt more
  DMG_SCALE_MAX: 4.0,         // §4.9 balance: raised 3.0→4.0 — allow higher late-wave damage
  // Boss
  BOSS_SPEED: 320,
  BOSS_HP: 8,
  BOSS_HP_GROWTH: 4,  // NOTE: not in original — +4 HP per 5 waves above wave 5
  BOSS_RADIUS: 20,
  BOSS_SPRITE_S: 80,
  BOSS_TELEGRAPH_DUR: 2.0,
  BOSS_TELEGRAPH_ORBIT_R: 200,
  BOSS_HIT_FLASH_S: 0.15,
  BOSS_CHARGE_DUR: 1.0,
  BOSS_CHARGE_SPEED: 700,
  BOSS_MINION_INTERVAL: 3.5,  // §4.9 balance: raised from 4.0 — minions spawn faster
  BOSS_MINION_RADIUS: 120,
  BOSS_MINION_MAX: 16,        // §4.9 balance: raised from 12 — more total minions per fight
  BOSS_VULNERABLE_DUR: 3.0,
  BOSS_INVULN_DUR: 3.5,           // shortened from 5.0 — Core armored phase is shorter now
  BOSS_INVULN_WARN_T: 1.0,        // NOTE: not in original — Core pre-vulnerable gold-flicker window
  BOSS_RECOVER_DUR: 1.2,          // NOTE: not in original — Pursuer stagger/punish window after charge
  BOSS_REFLECTOR_PAUSE_DUR: 2.5,  // NOTE: not in original — Reflector center-pause vulnerable window
  BOSS_REFLECTOR_VULN_R: 180,     // NOTE: not in original — proximity to center that triggers pause
  BOSS_CHIP_KNOCKBACK: 80,        // NOTE: not in original — impulse applied on successful encirclement chip
  BOSS_SPAWN_DIST_MIN: 600,    // NOTE: not in original
  BOSS_SPAWN_DIST_RANGE: 200,  // NOTE: not in original
  BOSS_WAVE_INTERVAL: 5,
  // Horde
  HORDE_TRIGGER_MIN: 0.60,
  HORDE_TRIGGER_MAX: 0.85,
  HORDE_DELAY: 1.5,
  HORDE_BASE_COUNT: 8,        // §4.9 balance: raised from 5 — late hordes feel overwhelming
  HORDE_WAVE_GROWTH: 1.0,     // §4.9 balance: raised from 0.5 — faster scaling per wave
  HORDE_MAX_COUNT: 60,        // §4.9 balance: raised from 40 — more enemies in late hordes
  HORDE_SPAWN_DIST: 950,
  HORDE_ARC_RAD: Math.PI / 3,
  HORDE_BATCH_WAVE_2: 11,     // NOTE: not in original — waves 11+ fire 2 horde batches
  HORDE_BATCH_WAVE_3: 21,     // NOTE: not in original — waves 21+ fire 3 horde batches
  // World
  WORLD_W: 3000,
  WORLD_H: 3000,
  // Camera — separate from pan/zoom lerp so heading-up rotation is gentler
  CAMERA_ROTATION_LERP_SPEED: 1.5,
  // Scoring
  ELITE_ENCIRCLE_KILLS: 3,
  // Enemy lifespan
  ENEMY_LIFESPAN_MIN: 10,
  ENEMY_LIFESPAN_MAX: 18,
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
  WALL_RIDE_DIST_FRAC: 0.033,
  WALL_RIDE_SPEED_BONUS: 0.10,
  // Early-game balancing
  FIRST_SPAWN_INITIAL: 2.5,
  SPAWN_INTERVAL_INITIAL: 4.0,
  FIRST_SPAWN_MIN: 0.6,
  SPAWN_INTERVAL_MIN: 1.8,   // §7 balance: 1.5→1.8 — ease wave 7+ enemy density (first ramp floor)
  SPAWN_INTERVAL_FLOOR: 1.2, // NOTE: not in original — second ramp floor for waves 5→15
  WAVE_COMBAT_WAVE1: 30,
  WAVE_TIME_GROWTH: 10,
  WAVE_COMBAT_MAX: 120,
  // Trail anti-AFK
  TRAIL_MAX_AGE: 8000,              // NOTE: not in original — trail point expires after 8s (ms)
  TRAIL_IDLE_SPEED_THRESHOLD: 60,   // NOTE: not in original — min px/s to record trail points
  // Props
  PROP_CHUNK_SIZE: 500,
  PROP_DENSITY: 0.00001,
  PROP_MIN_DIST: 100,
  PROP_POOL: [
    { image: 'props/tree_1.png', radius: 50, weight: 3, type: 'solid' },
    { image: 'props/rock_1.png', radius: 40, weight: 2, type: 'solid' },
    { image: 'props/mud_1.png',  radius: 62, weight: 2, type: 'slow', duration: 2.0, strength: 0.5 },
    { image: 'props/mud_1.png',  radius: 55, weight: 2, type: 'slip', duration: 1.5, strength: 0.6 },
    { image: 'props/bush_1.png', radius: 25, weight: 5, type: 'decoration' },
  ],
  // Sprites
  PLAYER_SPRITE: 'cars/player.png',
  // Bloom — NOTE: not in original
  BLOOM_BLUR_STRENGTH: 8,
  BLOOM_BLUR_QUALITY: 2,
  BLOOM_TRAIL_WIDTH_MULT: 2.5,
  BLOOM_TRAIL_ALPHA_MULT: 0.5,
  BLOOM_PLAYER_GLOW_RADIUS_MULT: 2.5,
  // Vignette — port of arena-drifter/fx.js:51-61
  VIGNETTE_INNER: 0.3,
  VIGNETTE_OUTER: 0.7,
  VIGNETTE_ALPHA: 0.5,
  // Speed lines — port of arena-drifter/game.js:1270-1294
  // NOTE: not in original — lowered from 0.7 so wind appears at moderate speed
  SPEED_LINES_THRESHOLD: 0.45,
  // Chromatic aberration — port of arena-drifter/game.js:1297-1314
  ABERRATION_SPEED_THRESHOLD: 0.8,
  ABERRATION_DYING_INTENSITY: 0.4,
  ENEMY_SPRITES_BY_TYPE: {
    chaser:      ['cars/enemy_red.png', 'cars/enemy_orange.png'],
    interceptor: ['cars/police.png', 'cars/ambulance.png'],
    drifter:     ['cars/taxi.png', 'cars/mini_van.png'],
    elite:       ['cars/truck.png', 'cars/mini_truck.png'],
    blocker:     ['cars/truck.png', 'cars/enemy_red.png'],
    flanker:     ['cars/police.png', 'cars/enemy_orange.png'],
    bomber:      ['cars/mini_truck.png', 'cars/mini_van.png'],
    splitter:    ['cars/enemy_orange.png', 'cars/enemy_red.png'],
    boss:        ['cars/truck.png', 'cars/mini_truck.png'],
  },
  BACKGROUND_SPRITE: 'backgrounds/background_01.png',
};

// Base config snapshot — taken after initial definition, excluding the S getter.
// applyMap() resets CFG to this baseline before applying map overrides.
export const CFG_BASE: Readonly<CfgShape> = { ...CFG };

// Map definitions
export const MAPS: MapDef[] = [
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

export const MAPS_BY_ID: Record<string, MapDef> = Object.fromEntries(
  MAPS.map((m) => [m.id, m]),
);

/**
 * Resets CFG to the base snapshot, then applies map-specific overrides.
 * Mirrors the JS applyMap() in logic.js / game.js.
 */
export function applyMap(mapId: string): void {
  // Reset to base
  Object.assign(CFG, CFG_BASE);

  const map = MAPS_BY_ID[mapId];
  if (!map) return;

  // Apply map overrides — cast needed because cfg values are a subset of CfgShape
  Object.assign(CFG, map.cfg);
}

/**
 * UI scale helper — converts reference-resolution (1280x720) pixels to
 * the current viewport resolution. Mirrors `S(px)` in logic.js.
 */
export function S(px: number): number {
  const scale = Math.min(CFG.W / 1280, CFG.H / 720);
  return Math.round(px * scale);
}
