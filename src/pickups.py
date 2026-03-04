"""Fuel pickup canisters in world space."""

import random
import math
import pygame
from .constants import WIDTH, HEIGHT, FUEL_R, YELLOW

_MAGNET_RADIUS  = 160
_DESPAWN_DIST   = 1400
_FUEL_FONT      = None


def _get_fuel_font():
    global _FUEL_FONT
    if _FUEL_FONT is None:
        _FUEL_FONT = pygame.font.SysFont("consolas", 14, bold=True)
    return _FUEL_FONT


class FuelPickup:
    def __init__(self, x: float, y: float):
        self.x = float(x)
        self.y = float(y)
        self.r = FUEL_R

    def update(self, player_x: float, player_y: float, has_magnet: bool):
        if has_magnet:
            dx   = player_x - self.x
            dy   = player_y - self.y
            dist = math.hypot(dx, dy)
            if 1.0 < dist < _MAGNET_RADIUS:
                pull    = 4.0 * (1.0 - dist / _MAGNET_RADIUS)
                self.x += dx / dist * pull
                self.y += dy / dist * pull

    def is_far_from_player(self, px: float, py: float) -> bool:
        return math.hypot(self.x - px, self.y - py) > _DESPAWN_DIST

    def draw(self, surface: pygame.Surface, cam_x: float, cam_y: float):
        sx = int(self.x - cam_x)
        sy = int(self.y - cam_y)
        if not (-20 <= sx <= WIDTH + 20 and -20 <= sy <= HEIGHT + 20):
            return
        pygame.draw.circle(surface, (200, 180, 0),   (sx, sy), self.r + 4)
        pygame.draw.circle(surface, YELLOW,           (sx, sy), self.r)
        pygame.draw.circle(surface, (255, 255, 160),  (sx - 3, sy - 3), self.r // 2)
        font = _get_fuel_font()
        txt  = font.render("F", True, (80, 60, 0))
        surface.blit(txt, txt.get_rect(center=(sx, sy)))


class PickupManager:
    def __init__(self):
        self.pickups: list[FuelPickup] = []

    def spawn(self, player_x: float, player_y: float):
        angle = random.uniform(0.0, 360.0)
        dist  = random.uniform(250.0, 550.0)
        rad   = math.radians(angle)
        x     = player_x + math.cos(rad) * dist
        y     = player_y + math.sin(rad) * dist
        self.pickups.append(FuelPickup(x, y))

    def update(self, player_x: float, player_y: float, has_magnet: bool):
        for p in self.pickups:
            p.update(player_x, player_y, has_magnet)
        self.pickups = [p for p in self.pickups
                        if not p.is_far_from_player(player_x, player_y)]

    def check_collection(self, player) -> int:
        """Return count of collected pickups; removes collected pickups."""
        to_keep = []
        count   = 0
        for p in self.pickups:
            if math.hypot(player.x - p.x, player.y - p.y) < p.r + player.width // 2:
                count += 1
            else:
                to_keep.append(p)
        self.pickups = to_keep
        return count

    def draw(self, surface: pygame.Surface, cam_x: float, cam_y: float):
        for p in self.pickups:
            p.draw(surface, cam_x, cam_y)
