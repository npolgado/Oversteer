"""Fuel pickup canisters that appear on the road."""

import random
import math
import pygame
from .constants import (
    HEIGHT, LANE_COUNT, LANE_W, ROAD_WIDTH, FUEL_R,
    YELLOW, WHITE, PLAYER_Y,
)

_MAGNET_RADIUS = 160


class FuelPickup:
    def __init__(self, lane: int, road_center_at_spawn: int):
        self.lane = lane
        self.y    = float(-FUEL_R - 10)
        self.r    = FUEL_R

    def get_x(self, road) -> int:
        cx   = road.get_center_at_y(self.y)
        half = road.road_width // 2
        return cx - half + self.lane * LANE_W + LANE_W // 2

    def get_pos(self, road) -> tuple:
        return (self.get_x(road), int(self.y))

    def update(self, scroll_speed: float, player_x: float, has_magnet: bool, road):
        self.y += scroll_speed
        if has_magnet:
            px, py = player_x, PLAYER_Y
            mx, my = self.get_x(road), self.y
            dx, dy = px - mx, py - my
            dist   = math.hypot(dx, dy)
            if dist < _MAGNET_RADIUS and dist > 1:
                pull = 4.0 * (1 - dist / _MAGNET_RADIUS)
                self.y += dy / dist * pull

    def is_off_screen(self) -> bool:
        return self.y > HEIGHT + self.r + 10

    def draw(self, surface: pygame.Surface, road):
        x, y = self.get_x(road), int(self.y)
        # Outer glow
        pygame.draw.circle(surface, (200, 180, 0), (x, y), self.r + 4)
        # Body
        pygame.draw.circle(surface, YELLOW, (x, y), self.r)
        # Inner highlight
        pygame.draw.circle(surface, (255, 255, 160), (x - 3, y - 3), self.r // 2)
        # "F" label
        font = pygame.font.SysFont("consolas", 14, bold=True)
        txt  = font.render("F", True, (80, 60, 0))
        surface.blit(txt, txt.get_rect(center=(x, y)))


class PickupManager:
    def __init__(self):
        self.pickups: list[FuelPickup] = []

    def spawn(self, road):
        # Pick a same-direction lane (2 or 3) so it's not in oncoming traffic
        lane = random.randint(LANE_COUNT // 2, LANE_COUNT - 1)
        cx   = road.get_center_at_y(0)
        self.pickups.append(FuelPickup(lane, cx))

    def update(self, scroll_speed: float, road, player):
        for p in self.pickups:
            p.update(scroll_speed, player.x, player.has_magnet, road)
        self.pickups = [p for p in self.pickups if not p.is_off_screen()]

    def check_collection(self, player, road) -> bool:
        """Return True if any pickup was collected (and remove it)."""
        pr      = player.get_rect()
        to_keep = []
        collected = False
        for p in self.pickups:
            pos  = p.get_pos(road)
            dist = math.hypot(pr.centerx - pos[0], pr.centery - pos[1])
            if dist < p.r + player.width // 2:
                collected = True
            else:
                to_keep.append(p)
        self.pickups = to_keep
        return collected

    def draw(self, surface: pygame.Surface, road):
        for p in self.pickups:
            p.draw(surface, road)
