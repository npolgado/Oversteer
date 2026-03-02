# ── Display ──────────────────────────────────────────────────────────────────
WIDTH  = 900
HEIGHT = 700
FPS    = 60
TITLE  = "OVERSTEER"

# ── Palette ───────────────────────────────────────────────────────────────────
BLACK       = (  0,   0,   0)
WHITE       = (255, 255, 255)
GRAY        = (100, 100, 100)
DARK_GRAY   = ( 40,  40,  45)
RED         = (220,  50,  50)
YELLOW      = (255, 220,   0)
GREEN       = ( 34, 139,  34)
BLUE        = ( 30, 120, 255)
ORANGE      = (255, 140,   0)
PURPLE      = (160,  50, 220)
CYAN        = (  0, 200, 220)

# ── Background ────────────────────────────────────────────────────────────────
TILE_SIZE       = 100
GRASS_COLOR     = ( 48, 140,  48)
GRASS_ALT_COLOR = ( 42, 122,  42)

# ── Car colours ───────────────────────────────────────────────────────────────
PLAYER_COLOR   = ( 30, 120, 255)
TRAFFIC_COLORS = [
    (200,  50,  50),
    (255, 130,   0),
    (160,  50, 220),
    ( 50, 200, 100),
    (240, 240,  60),
    (200, 100,  50),
]

# ── Car dimensions ────────────────────────────────────────────────────────────
PLAYER_W  = 34
PLAYER_H  = 56
TRAFFIC_W = 34
TRAFFIC_H = 56

# ── Player physics ────────────────────────────────────────────────────────────
PLAYER_MAX_SPEED = 7.5    # Forward speed cap (px/frame)
PLAYER_ACCEL     = 0.22   # Throttle acceleration
PLAYER_BRAKE     = 0.35   # Braking deceleration
PLAYER_COAST     = 0.975  # Speed retention when coasting
PLAYER_TURN      = 3.0    # Degrees/frame steering
PLAYER_GRIP      = 0.82   # Velocity→heading blend per frame

# ── Drift ─────────────────────────────────────────────────────────────────────
DRIFT_TRIGGER    = 0.5    # Minimum speed for drift to activate
DRIFT_STEER_MULT = 1.4    # Extra slip multiplier

# ── Enemies ───────────────────────────────────────────────────────────────────
ENEMY_INITIAL      = 5
ENEMY_ADD_EVERY    = 25   # Seconds between +1 enemy
ENEMY_MAX          = 22
ENEMY_BASE_SPEED   = 3.0
ENEMY_SPEED_GROWTH = 0.025   # px/frame added per second of play
ENEMY_SPEED_CAP    = 7.0
ENEMY_SPAWN_RADIUS = 700  # World-distance from player to spawn
ENEMY_DESPAWN_DIST = 1300 # Despawn if farther than this

# ── Fuel ──────────────────────────────────────────────────────────────────────
FUEL_MAX        = 100.0
FUEL_DRAIN_BASE = 0.038   # Per frame, constant
FUEL_PICKUP_AMT = 38.0
FUEL_SPAWN_TIME = 18      # Seconds between spawns
FUEL_R          = 13      # Pickup circle radius

# ── Upgrades ──────────────────────────────────────────────────────────────────
UPGRADE_TIME    = 40      # Seconds between upgrade offers
UPGRADE_CHOICES = 3

# ── UI colours ────────────────────────────────────────────────────────────────
UI_BG          = ( 12,  12,  18)
UI_CARD_BG     = ( 28,  28,  40)
UI_CARD_BORDER = ( 70,  70,  95)
UI_ACCENT      = (255, 210,   0)
RARITY_COLORS  = {
    "common":   (150, 150, 165),
    "uncommon": ( 80, 180,  80),
    "rare":     (120,  90, 230),
    "epic":     (220,  80, 220),
}
