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

# ── Road appearance ───────────────────────────────────────────────────────────
ROAD_COLOR      = ( 58,  58,  63)
ROAD_ALT_COLOR  = ( 50,  50,  55)
GRASS_COLOR     = ( 48, 140,  48)
GRASS_ALT_COLOR = ( 42, 122,  42)
RUMBLE_A        = (200,  50,  50)
RUMBLE_B        = (230, 230, 230)
LANE_MARK_COLOR = (180, 180, 180)
CENTER_COLOR    = (255, 210,   0)

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
PLAYER_Y  = 545      # Fixed screen-y for the player car

# ── Road geometry ─────────────────────────────────────────────────────────────
ROAD_WIDTH      = 480   # Total road width in pixels
LANE_COUNT      = 4     # 0-1 oncoming | 2-3 same-direction
LANE_W          = ROAD_WIDTH // LANE_COUNT   # 120 px each
SEGMENT_H       = 6     # Pixel height of one road strip
RUMBLE_W        = 22    # Width of roadside rumble strip
MAX_CURVE       = 130   # Max road-centre x-offset from screen centre

# ── Speed ─────────────────────────────────────────────────────────────────────
BASE_SPEED  = 3.5
MAX_SPEED   = 14.0
SPEED_RAMP  = 0.0006   # Speed added per frame

# ── Traffic ───────────────────────────────────────────────────────────────────
SPAWN_MIN      = 50    # Min frames between spawns
SPAWN_MAX      = 150   # Max frames between spawns
ONCOMING_EXTRA = 5.0   # Extra px/frame for oncoming cars (on top of scroll)
SAME_DIR_DELTA = 1.8   # Base px/frame approach speed for same-direction cars

# ── Fuel ──────────────────────────────────────────────────────────────────────
FUEL_MAX        = 100.0
FUEL_DRAIN_BASE = 0.038   # Drain per frame at BASE_SPEED
FUEL_PICKUP_AMT = 36.0
FUEL_SPAWN_DIST = 1800    # Distance (scroll-px) between fuel spawns
FUEL_R          = 13      # Pickup circle radius

# ── Upgrades ──────────────────────────────────────────────────────────────────
UPGRADE_DIST    = 4500   # Distance between upgrade offers
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
