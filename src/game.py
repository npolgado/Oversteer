"""Main game class: state machine, update loop, rendering."""

import sys
import random
import pygame

from .constants import (
    WIDTH, HEIGHT, FPS, TITLE, GRASS_COLOR,
    BASE_SPEED, MAX_SPEED, SPEED_RAMP,
    FUEL_MAX, FUEL_DRAIN_BASE, FUEL_PICKUP_AMT,
    UPGRADE_DIST, UPGRADE_CHOICES,
    FUEL_SPAWN_DIST, LANE_COUNT, LANE_W, ROAD_WIDTH,
    PLAYER_Y,
)
from .road      import Road
from .player    import Player
from .traffic   import TrafficManager
from .pickups   import PickupManager
from .upgrades  import ALL_UPGRADES, Upgrade
from .modifiers import ALL_MODIFIERS, Modifier
from .ui import (
    draw_menu, draw_modifier_select, draw_upgrade_select,
    draw_hud, draw_fog, draw_game_over,
)

# States
MENU            = "MENU"
MODIFIER_SELECT = "MODIFIER_SELECT"
PLAYING         = "PLAYING"
UPGRADE_SELECT  = "UPGRADE_SELECT"
GAME_OVER       = "GAME_OVER"


class Game:
    def __init__(self):
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption(TITLE)
        self.clock = pygame.time.Clock()
        self.state = MENU

        # Run-time objects (created fresh each run)
        self.road:    Road           = None
        self.player:  Player         = None
        self.traffic: TrafficManager = None
        self.pickups: PickupManager  = None

        # Run state
        self.scroll_speed    = BASE_SPEED
        self.distance        = 0.0
        self.fuel            = FUEL_MAX
        self.fuel_max        = FUEL_MAX
        self.fuel_siphon     = 1.0   # multiplier for fuel pickup (double_fuel upgrade)
        self.speed_ramp      = SPEED_RAMP
        self.active_upgrades: list[Upgrade]  = []
        self.active_modifier: Modifier | None = None
        self.death_reason    = ""
        self.max_speed_reached = BASE_SPEED
        self.next_upgrade_at = UPGRADE_DIST
        self.next_fuel_at    = FUEL_SPAWN_DIST

        # Selection pools
        self.modifier_pool: list[Modifier] = []
        self.upgrade_pool:  list[Upgrade]  = []

    # ── Main loop ─────────────────────────────────────────────────────────

    def run(self):
        while True:
            self.clock.tick(FPS)
            self._handle_events()
            self._update()
            self._draw()
            pygame.display.flip()

    # ── Events ────────────────────────────────────────────────────────────

    def _handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            if event.type == pygame.KEYDOWN:
                self._on_key(event.key)

    def _on_key(self, key: int):
        if self.state == MENU:
            if key == pygame.K_RETURN:
                self._prepare_modifier_select()

        elif self.state == MODIFIER_SELECT:
            if key in (pygame.K_1, pygame.K_2, pygame.K_3):
                idx = key - pygame.K_1
                if idx < len(self.modifier_pool):
                    self._start_run(self.modifier_pool[idx])

        elif self.state == PLAYING:
            if key == pygame.K_ESCAPE:
                self.state = MENU
            if key == pygame.K_SPACE:
                self.player.activate_nitro()

        elif self.state == UPGRADE_SELECT:
            if key in (pygame.K_1, pygame.K_2, pygame.K_3):
                idx = key - pygame.K_1
                if idx < len(self.upgrade_pool):
                    self._apply_upgrade(self.upgrade_pool[idx])
                    self.state = PLAYING

        elif self.state == GAME_OVER:
            if key == pygame.K_RETURN:
                self._prepare_modifier_select()
            if key == pygame.K_ESCAPE:
                self.state = MENU

    # ── Run setup ─────────────────────────────────────────────────────────

    def _prepare_modifier_select(self):
        self.modifier_pool = random.sample(ALL_MODIFIERS, 3)
        self.state = MODIFIER_SELECT

    def _start_run(self, modifier: Modifier):
        self.active_modifier  = modifier
        self.active_upgrades  = []
        self.death_reason     = ""

        # Modifier-adjusted settings
        road_width            = ROAD_WIDTH
        spawn_interval_factor = 1.0
        start_fuel            = FUEL_MAX
        start_speed           = BASE_SPEED
        self.speed_ramp       = SPEED_RAMP
        self.fuel_siphon      = 1.0
        fuel_drain_disabled   = False

        mid = modifier.id
        if mid == "narrow":
            road_width = int(ROAD_WIDTH * 0.70)
        elif mid == "rush_hour":
            spawn_interval_factor = 0.50
        elif mid == "low_fuel":
            start_fuel = FUEL_MAX * 0.50
        elif mid == "tailwind":
            start_speed   = BASE_SPEED * 1.20
            self.speed_ramp = SPEED_RAMP * 1.60
        elif mid == "no_fuel":
            fuel_drain_disabled = True

        self._fuel_drain_disabled = fuel_drain_disabled
        self.fuel_max    = FUEL_MAX
        self.fuel        = start_fuel
        self.scroll_speed = start_speed
        self.distance    = 0.0
        self.max_speed_reached = start_speed
        self.next_upgrade_at = UPGRADE_DIST
        self.next_fuel_at    = FUEL_SPAWN_DIST

        # Create game objects
        self.road    = Road(road_width)
        # Player starts in lane 3 (rightmost same-direction lane)
        player_start_x = WIDTH // 2 + ROAD_WIDTH // 2 - LANE_W // 2
        self.player  = Player(player_start_x)
        self.traffic = TrafficManager(spawn_interval_factor)
        self.pickups = PickupManager()

        # Modifier post-init tweaks
        if mid == "black_ice":
            self.player.grip = max(0.55, self.player.grip * 0.78)
        if mid == "lucky_start":
            self._apply_upgrade(random.choice(ALL_UPGRADES))

        self.state = PLAYING

    # ── Upgrade application ───────────────────────────────────────────────

    def _apply_upgrade(self, upgrade: Upgrade):
        self.active_upgrades.append(upgrade)
        uid = upgrade.id

        if uid == "wide_tires":
            self.player.grip = min(self.player.grip + 0.07, 0.96)
        elif uid == "fuel_tank":
            self.fuel_max  = self.fuel_max * 1.30
            self.fuel      = min(self.fuel + 20, self.fuel_max)
        elif uid == "steady_hands":
            self.player.steer_force = min(self.player.steer_force + 0.25, 2.8)
        elif uid == "lead_foot":
            # Raise effective max speed by extending constant
            pass   # handled in _update via active_upgrades count check
        elif uid == "nitro":
            self.player.nitro_charges += 1
        elif uid == "shield":
            self.player.shield += 1
        elif uid == "magnet":
            self.player.has_magnet = True
        elif uid == "road_feel":
            self.road.road_width = min(self.road.road_width + 50, ROAD_WIDTH + 100)
        elif uid == "ghost":
            self.player.shield += 2   # re-use shield counter for ghost
        elif uid == "overclock":
            self.speed_ramp *= 2.0
        elif uid == "double_fuel":
            self.fuel_siphon *= 2.0

    # ── Offer upgrade ─────────────────────────────────────────────────────

    def _offer_upgrade(self):
        # Avoid duplicating already-owned upgrades where possible
        owned_ids = {u.id for u in self.active_upgrades}
        pool = [u for u in ALL_UPGRADES if u.id not in owned_ids]
        if len(pool) < UPGRADE_CHOICES:
            pool = ALL_UPGRADES
        self.upgrade_pool = random.sample(pool, min(UPGRADE_CHOICES, len(pool)))
        self.next_upgrade_at += UPGRADE_DIST
        self.state = UPGRADE_SELECT

    # ── Update ────────────────────────────────────────────────────────────

    def _update(self):
        if self.state != PLAYING:
            return

        # Effective max speed (lead_foot upgrade raises cap)
        lead_foot_count = sum(1 for u in self.active_upgrades if u.id == "lead_foot")
        eff_max_speed = MAX_SPEED + lead_foot_count * 1.5

        # Nitro speed boost
        nitro_bonus = 3.5 if self.player.nitro_active else 0.0

        # Speed ramp
        self.scroll_speed = min(self.scroll_speed + self.speed_ramp, eff_max_speed)
        if self.scroll_speed > self.max_speed_reached:
            self.max_speed_reached = self.scroll_speed

        effective_speed = self.scroll_speed + nitro_bonus

        # Distance
        self.distance += effective_speed

        # Player input & physics
        keys = pygame.key.get_pressed()
        self.player.update(keys, effective_speed)

        # Road scroll
        self.road.update(effective_speed)

        # ── Off-road check ────────────────────────────────────────────────
        left_edge, right_edge = self.road.get_edges_at_y(PLAYER_Y)
        pr = self.player.get_rect()
        if pr.left < left_edge - 4 or pr.right > right_edge + 4:
            self._die("You went off-road!")
            return

        # ── Traffic ───────────────────────────────────────────────────────
        self.traffic.update(effective_speed, self.road)
        if self.traffic.check_collision(self.player, self.road):
            if self.player.shield > 0:
                self.player.shield -= 1
                self.traffic.remove_colliding(self.player, self.road)
            else:
                self._die("You hit another car!")
                return

        # ── Fuel ──────────────────────────────────────────────────────────
        if not self._fuel_drain_disabled:
            drain = FUEL_DRAIN_BASE * (effective_speed / BASE_SPEED)
            self.fuel = max(0.0, self.fuel - drain)
            if self.fuel <= 0:
                self._die("You ran out of fuel!")
                return

        # ── Pickups ───────────────────────────────────────────────────────
        self.pickups.update(effective_speed, self.road, self.player)
        if self.pickups.check_collection(self.player, self.road):
            gain = FUEL_PICKUP_AMT * self.fuel_siphon
            self.fuel = min(self.fuel + gain, self.fuel_max)

        # ── Spawn new fuel canister ───────────────────────────────────────
        if self.distance >= self.next_fuel_at and not self._fuel_drain_disabled:
            self.pickups.spawn(self.road)
            self.next_fuel_at += FUEL_SPAWN_DIST

        # ── Upgrade offer ─────────────────────────────────────────────────
        if self.distance >= self.next_upgrade_at:
            self._offer_upgrade()

    def _die(self, reason: str):
        self.death_reason = reason
        self.state = GAME_OVER

    # ── Draw ──────────────────────────────────────────────────────────────

    def _draw(self):
        if self.state == MENU:
            draw_menu(self.screen)
            pygame.display.flip()
            return

        if self.state == MODIFIER_SELECT:
            draw_modifier_select(self.screen, self.modifier_pool)
            pygame.display.flip()
            return

        # ── Game world (drawn for PLAYING, UPGRADE_SELECT, GAME_OVER) ────
        self.screen.fill(GRASS_COLOR)
        self.road.draw(self.screen)
        self.pickups.draw(self.screen, self.road)
        self.traffic.draw(self.screen, self.road)
        self.player.draw(self.screen)

        if self.state in (PLAYING, UPGRADE_SELECT):
            draw_hud(
                self.screen,
                fuel=self.fuel,
                fuel_max=self.fuel_max,
                distance=self.distance,
                scroll_speed=self.scroll_speed,
                upgrades=self.active_upgrades,
                modifier=self.active_modifier,
                player=self.player,
            )
            if self.active_modifier and self.active_modifier.id == "fog":
                draw_fog(self.screen)
            if self.state == UPGRADE_SELECT:
                draw_upgrade_select(self.screen, self.upgrade_pool)

        elif self.state == GAME_OVER:
            draw_game_over(
                self.screen,
                death_reason=self.death_reason,
                distance=self.distance,
                max_speed=self.max_speed_reached,
                upgrades=self.active_upgrades,
                modifier=self.active_modifier,
            )
