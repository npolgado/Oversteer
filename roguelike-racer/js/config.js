// ============================================================
// Road Rogue - Game Configuration
// ============================================================
const CONFIG = {
  // Canvas
  WIDTH:  800,
  HEIGHT: 600,

  // Pseudo-3D road rendering
  CAMERA_HEIGHT:    1000,   // camera height above road (world units)
  CAMERA_DEPTH:     0.84,   // 1/tan(fov/2), controls field-of-view
  DRAW_DISTANCE:    200,    // number of segments rendered ahead
  SEGMENT_LENGTH:   200,    // world-unit length of each road segment
  ROAD_WIDTH:       1800,   // road width in world units
  RUMBLE_LENGTH:    3,      // segments per colour alternation
  LANES:            3,

  // Player
  PLAYER_MAX_SPEED:     500,   // world units / second
  PLAYER_ACCEL:         200,
  PLAYER_BRAKE:         400,
  PLAYER_DECEL:         100,   // passive deceleration
  PLAYER_OFFROAD_DECEL: 300,   // extra decel when off road
  PLAYER_CENTRIFUGAL:   0.4,   // sideways drift on curves
  PLAYER_WIDTH:         0.12,  // fraction of road width (0-1)
  PLAYER_STEER:         2.5,   // horizontal steering speed

  // Fuel
  FUEL_MAX:       100,
  FUEL_BURN_RATE: 0.007,  // fuel per world-unit at max speed (scales with speed)

  // Traffic
  TRAFFIC_DENSITY:   50,   // spawn 1 car per N segments initially
  TRAFFIC_SPEED_MIN: 0.30, // fraction of player max speed
  TRAFFIC_SPEED_MAX: 0.75,
  TRAFFIC_TYPES: ['sedan', 'sedan', 'sedan', 'truck', 'sports'],

  // Fuel pickups
  FUEL_PICKUP_INTERVAL: 80,  // segments between fuel pickups
  FUEL_PICKUP_AMOUNT:   35,

  // Roguelike
  UPGRADE_INTERVAL:   3000,   // metres between upgrade screens
  UPGRADES_TO_OFFER:  3,

  // Difficulty scaling (per 1000m)
  SPEED_BONUS_PER_KM:    20,   // world units added to max speed
  TRAFFIC_BOOST_PER_KM:  3,    // more cars per km

  // Scoring
  SCORE_PER_METRE:  1,
  SCORE_NEAR_MISS:  50,   // bonus for close pass

  // Visual
  HORIZON_Y: 0.42,  // horizon as fraction of screen height

  COLORS: {
    // Sky gradient stops
    SKY_TOP:    '#0a0a1a',
    SKY_MID:    '#1a1a4e',
    SKY_HORIZON:'#3a3a8e',

    // Road
    ROAD_LIGHT:   '#6b6b6b',
    ROAD_DARK:    '#595959',
    GRASS_LIGHT:  '#0d8a0d',
    GRASS_DARK:   '#0a7a0a',
    RUMBLE_LIGHT: '#cc2222',
    RUMBLE_DARK:  '#dddddd',
    LANE_MARKER:  '#dddddd',

    // Weather overrides applied dynamically
    RAIN_ROAD:    '#555577',
    RAIN_GRASS:   '#0a6a0a',
    SNOW_ROAD:    '#cccccc',
    SNOW_GRASS:   '#dddddd',
    NIGHT_SKY:    '#000010',

    // UI
    UI_BG:      'rgba(0,0,0,0.82)',
    UI_BORDER:  '#ff8800',
    UI_TEXT:    '#ffffff',
    UI_ACCENT:  '#ff8800',
    UI_DIM:     '#888888',
    UI_GOOD:    '#00ff88',
    UI_BAD:     '#ff4444',
    UI_CARD_BG: 'rgba(20,20,40,0.95)',
  },
};
