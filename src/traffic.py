"""Traffic cars: oncoming (lanes 0-1) and same-direction (lanes 2-3)."""

import random
import pygame
from .constants import (
    LANE_COUNT, LANE_W, ROAD_WIDTH, TRAFFIC_W, TRAFFIC_H,
    TRAFFIC_COLORS, SPAWN_MIN, SPAWN_MAX, ONCOMING_EXTRA, SAME_DIR_DELTA,
    HEIGHT, PLAYER_Y,
)


class TrafficCar:
    def __init__(self, lane: int, road_center_at_spawn: int, scroll_speed: float):
        self.lane        = lane
        self.is_oncoming = lane < LANE_COUNT // 2  # lanes 0-1
        self.y           = float(-TRAFFIC_H - 10)
        self.color       = random.choice(TRAFFIC_COLORS)
        self.width       = TRAFFIC_W
        self.height      = TRAFFIC_H

        # How fast this car moves DOWN the screen each frame
        if self.is_oncoming:
            self.speed = scroll_speed + ONCOMING_EXTRA
        else:
            # Same-direction: approaches player more slowly
            self.speed = max(SAME_DIR_DELTA, scroll_speed * 0.45 + 0.8)

        self._surf = self._build_surface()

    def _build_surface(self) -> pygame.Surface:
        w, h = self.width, self.height
        surf = pygame.Surface((w, h), pygame.SRCALPHA)
        pygame.draw.rect(surf, self.color, (0, 0, w, h), border_radius=6)

        # Windshield
        ww = int(w * 0.7)
        wx = (w - ww) // 2
        if self.is_oncoming:
            # Windshield at top (they face us)
            pygame.draw.rect(surf, (180, 220, 255, 180), (wx, 4, ww, int(h * 0.26)), border_radius=3)
            # Headlights
            pygame.draw.rect(surf, (255, 255, 200), (2,      4, 8, 6), border_radius=2)
            pygame.draw.rect(surf, (255, 255, 200), (w - 10, 4, 8, 6), border_radius=2)
        else:
            # Windshield at top (back of car faces us)
            pygame.draw.rect(surf, (160, 200, 255, 160), (wx, 4, ww, int(h * 0.26)), border_radius=3)
            # Brake lights
            pygame.draw.rect(surf, (255, 60, 60), (2,      h - 8, 8, 6), border_radius=2)
            pygame.draw.rect(surf, (255, 60, 60), (w - 10, h - 8, 8, 6), border_radius=2)
        return surf

    # ── Geometry ──────────────────────────────────────────────────────────

    def get_x(self, road) -> int:
        """Compute screen-x from lane + current road centre at this car's y."""
        cx   = road.get_center_at_y(self.y)
        half = road.road_width // 2
        lx   = cx - half + self.lane * LANE_W + LANE_W // 2
        return lx

    def get_rect(self, road) -> pygame.Rect:
        x = self.get_x(road)
        return pygame.Rect(
            x - self.width  // 2,
            int(self.y) - self.height // 2,
            self.width,
            self.height,
        )

    # ── Update ────────────────────────────────────────────────────────────

    def update(self, scroll_speed: float):
        self.speed = (scroll_speed + ONCOMING_EXTRA
                      if self.is_oncoming
                      else max(SAME_DIR_DELTA, scroll_speed * 0.45 + 0.8))
        self.y += self.speed

    def is_off_screen(self) -> bool:
        return self.y > HEIGHT + TRAFFIC_H + 10

    # ── Draw ──────────────────────────────────────────────────────────────

    def draw(self, surface: pygame.Surface, road):
        x = self.get_x(road)
        rect = self._surf.get_rect(center=(x, int(self.y)))
        surface.blit(self._surf, rect)


# ── Manager ───────────────────────────────────────────────────────────────────

class TrafficManager:
    def __init__(self, interval_factor: float = 1.0):
        self.cars: list[TrafficCar] = []
        self._interval_factor = interval_factor
        self._spawn_timer = self._next_interval()

    def _next_interval(self) -> int:
        base = random.randint(SPAWN_MIN, SPAWN_MAX)
        return max(20, int(base * self._interval_factor))

    def update(self, scroll_speed: float, road):
        self._spawn_timer -= 1
        if self._spawn_timer <= 0:
            self._spawn_timer = self._next_interval()
            self._spawn(road, scroll_speed)

        for car in self.cars:
            car.update(scroll_speed)

        self.cars = [c for c in self.cars if not c.is_off_screen()]

    def _spawn(self, road, scroll_speed: float):
        lane          = random.randint(0, LANE_COUNT - 1)
        cx            = road.get_center_at_y(0)
        self.cars.append(TrafficCar(lane, cx, scroll_speed))

    def check_collision(self, player, road) -> bool:
        pr = player.get_rect()
        # Shrink hitbox slightly for fairness
        pr = pr.inflate(-8, -10)
        for car in self.cars:
            cr = car.get_rect(road).inflate(-8, -10)
            if pr.colliderect(cr):
                return True
        return False

    def remove_colliding(self, player, road):
        pr = player.get_rect().inflate(-8, -10)
        self.cars = [c for c in self.cars if not pr.colliderect(c.get_rect(road).inflate(-8, -10))]

    def draw(self, surface: pygame.Surface, road):
        for car in self.cars:
            car.draw(surface, road)
