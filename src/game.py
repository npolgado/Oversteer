"""Main game class: state machine, update loop, rendering."""

import sys
import math
import random
import pygame

from .constants import (
    WIDTH, HEIGHT, FPS, TITLE,
    FUEL_MAX, FUEL_DRAIN_BASE, FUEL_PICKUP_AMT, FUEL_SPAWN_TIME,
    UPGRADE_TIME, UPGRADE_CHOICES,
    ENEMY_INITIAL, ENEMY_ADD_EVERY, ENEMY_MAX,
    ENEMY_BASE_SPEED, ENEMY_SPEED_GROWTH,
    PLAYER_MAX_SPEED,
)
from .world   import draw_world
from .player  import Player
from .traffic import TrafficManager
from .pickups import PickupManager
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
        self.player:  Player         = None
        self.traffic: TrafficManager = None
        self.pickups: PickupManager  = None

        # Camera (top-left world coordinate)
        self.cam_x = 0.0
        self.cam_y = 0.0

        # Run state
        self.time_alive    = 0.0
        self.distance      = 0.0
        self.fuel          = FUEL_MAX
        self.fuel_max      = FUEL_MAX
        self.fuel_siphon   = 1.0
        self.enemy_speed   = ENEMY_BASE_SPEED
        self._speed_growth = ENEMY_SPEED_GROWTH   # may be modified by overclock

        self.active_upgrades: list[Upgrade]   = []
        self.active_modifier: Modifier | None = None
        self.death_reason  = ""

        self.next_upgrade_at = UPGRADE_TIME
        self.next_fuel_at    = FUEL_SPAWN_TIME
        self.next_difficulty = float(ENEMY_ADD_EVERY)

        self._fuel_drain_disabled = False

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
            if key == pygame.K_n:
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
        self.active_modifier = modifier
        self.active_upgrades = []
        self.death_reason    = ""

        enemy_count         = ENEMY_INITIAL
        start_fuel          = FUEL_MAX
        fuel_drain_disabled = False
        self.fuel_siphon    = 1.0
        self.enemy_speed    = ENEMY_BASE_SPEED
        self._speed_growth  = ENEMY_SPEED_GROWTH

        mid = modifier.id
        if mid == "rush_hour":
            enemy_count = ENEMY_INITIAL * 2
        elif mid == "gridlock":
            enemy_count = int(ENEMY_INITIAL * 1.5)
        elif mid == "low_fuel":
            start_fuel = FUEL_MAX * 0.50
        elif mid == "no_fuel":
            fuel_drain_disabled = True

        self._fuel_drain_disabled = fuel_drain_disabled
        self.fuel_max  = FUEL_MAX
        self.fuel      = start_fuel
        self.time_alive = 0.0
        self.distance   = 0.0
        self.next_upgrade_at = UPGRADE_TIME
        self.next_fuel_at    = FUEL_SPAWN_TIME
        self.next_difficulty = float(ENEMY_ADD_EVERY)

        self.player  = Player(0.0, 0.0)
        self.traffic = TrafficManager(target_count=enemy_count)
        self.pickups = PickupManager()

        # Spawn 2 fuel canisters near the player at the start of each run
        for _ in range(2):
            self.pickups.spawn(self.player.x, self.player.y)

        # Modifier post-init tweaks
        if mid == "black_ice":
            self.player.grip = max(0.45, self.player.grip * 0.78)
        if mid == "adrenaline":
            self.player.max_speed = PLAYER_MAX_SPEED * 1.25
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
            self.fuel_max = self.fuel_max * 1.30
            self.fuel     = min(self.fuel + 20, self.fuel_max)
        elif uid == "steady_hands":
            self.player.turn_rate = min(self.player.turn_rate + 0.45, 6.0)
        elif uid == "lead_foot":
            self.player.max_speed = min(self.player.max_speed + 1.5, 14.0)
        elif uid == "nitro":
            self.player.nitro_charges += 1
        elif uid == "shield":
            self.player.shield += 1
        elif uid == "magnet":
            self.player.has_magnet = True
        elif uid == "overdrive":
            self.player.max_speed = min(self.player.max_speed + 1.0, 14.0)
            self.player.grip      = min(self.player.grip + 0.04, 0.96)
        elif uid == "ghost":
            self.player.shield += 2
        elif uid == "overclock":
            self._speed_growth *= 0.60   # slow enemy ramp → easier to last longer
        elif uid == "double_fuel":
            self.fuel_siphon *= 2.0

    # ── Offer upgrade ─────────────────────────────────────────────────────

    def _offer_upgrade(self):
        self.player.speed = 0.0
        self.player.vx = 0.0
        self.player.vy = 0.0
        owned_ids = {u.id for u in self.active_upgrades}
        pool = [u for u in ALL_UPGRADES if u.id not in owned_ids]
        if len(pool) < UPGRADE_CHOICES:
            pool = ALL_UPGRADES
        self.upgrade_pool = random.sample(pool, min(UPGRADE_CHOICES, len(pool)))
        self.next_upgrade_at += UPGRADE_TIME
        self.state = UPGRADE_SELECT

    # ── Update ────────────────────────────────────────────────────────────

    def _update(self):
        if self.state != PLAYING:
            return

        keys = pygame.key.get_pressed()
        self.player.update(keys)

        # Camera follows player
        self.cam_x = self.player.x - WIDTH  // 2
        self.cam_y = self.player.y - HEIGHT // 2

        # Time and distance
        self.time_alive += 1.0 / FPS
        self.distance   += math.hypot(self.player.vx, self.player.vy)

        # ── Fuel drain ────────────────────────────────────────────────────
        if not self._fuel_drain_disabled:
            self.fuel = max(0.0, self.fuel - FUEL_DRAIN_BASE)
            if self.fuel <= 0:
                self._die("You ran out of fuel!")
                return

        # ── Enemy speed ramp ──────────────────────────────────────────────
        self.enemy_speed = ENEMY_BASE_SPEED + self.time_alive * self._speed_growth

        # ── Traffic ───────────────────────────────────────────────────────
        self.traffic.update(self.player.x, self.player.y,
                            self.player.vx, self.player.vy,
                            self.enemy_speed)
        if self.traffic.check_collision(self.player):
            if self.player.shield > 0:
                self.player.shield -= 1
                self.traffic.remove_colliding(self.player)
            else:
                self._die("You hit another car!")
                return

        # ── Pickups ───────────────────────────────────────────────────────
        self.pickups.update(self.player.x, self.player.y, self.player.has_magnet)
        collected = self.pickups.check_collection(self.player)
        if collected > 0:
            gain = FUEL_PICKUP_AMT * self.fuel_siphon * collected
            self.fuel = min(self.fuel + gain, self.fuel_max)

        # ── Spawn fuel canister ───────────────────────────────────────────
        if self.time_alive >= self.next_fuel_at and not self._fuel_drain_disabled:
            self.pickups.spawn(self.player.x, self.player.y)
            self.next_fuel_at += FUEL_SPAWN_TIME

        # ── Difficulty ramp: add one more enemy every N seconds ───────────
        if self.time_alive >= self.next_difficulty:
            self.next_difficulty += ENEMY_ADD_EVERY
            if self.traffic.target_count < ENEMY_MAX:
                self.traffic.target_count += 1

        # ── Upgrade offer ─────────────────────────────────────────────────
        if self.time_alive >= self.next_upgrade_at:
            self._offer_upgrade()

    def _die(self, reason: str):
        self.death_reason = reason
        self.state = GAME_OVER

    # ── Draw ──────────────────────────────────────────────────────────────

    def _draw(self):
        if self.state == MENU:
            draw_menu(self.screen)
            return

        if self.state == MODIFIER_SELECT:
            draw_modifier_select(self.screen, self.modifier_pool)
            return

        # ── Game world ────────────────────────────────────────────────────
        draw_world(self.screen, self.cam_x, self.cam_y)
        self.pickups.draw(self.screen, self.cam_x, self.cam_y)
        self.traffic.draw(self.screen, self.cam_x, self.cam_y)
        self.player.draw(self.screen)

        if self.state in (PLAYING, UPGRADE_SELECT):
            speed = math.hypot(self.player.vx, self.player.vy)
            draw_hud(
                self.screen,
                fuel=self.fuel,
                fuel_max=self.fuel_max,
                time_alive=self.time_alive,
                distance=self.distance,
                speed=speed,
                upgrades=self.active_upgrades,
                modifier=self.active_modifier,
                player=self.player,
                max_speed=self.player.max_speed,
            )
            if self.active_modifier and self.active_modifier.id == "fog":
                draw_fog(self.screen)
            if self.state == UPGRADE_SELECT:
                draw_upgrade_select(self.screen, self.upgrade_pool)

        elif self.state == GAME_OVER:
            draw_game_over(
                self.screen,
                death_reason=self.death_reason,
                time_alive=self.time_alive,
                distance=self.distance,
                upgrades=self.active_upgrades,
                modifier=self.active_modifier,
            )
