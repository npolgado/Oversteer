"""Enemy cars: world-space waypoint AI."""

import math
import random
from collections import deque
import pygame

from .constants import (
    WIDTH, HEIGHT,
    TRAFFIC_W, TRAFFIC_H, TRAFFIC_COLORS,
    ENEMY_BASE_SPEED, ENEMY_SPEED_CAP,
    ENEMY_SPAWN_RADIUS, ENEMY_DESPAWN_DIST,
    ENEMY_CHASE_RADIUS, ENEMY_CHASE_BIAS,
)

_WAYPOINT_DIST_MIN = 300
_WAYPOINT_DIST_MAX = 800
_WAYPOINT_ARRIVE   = 40    # px — switch to next waypoint within this distance
_ENEMY_GRIP        = 0.88
_MAX_TURN          = 3.0   # degrees/frame


class EnemyCar:
    def __init__(self, x: float, y: float, speed: float):
        self.x     = float(x)
        self.y     = float(y)
        self.angle = random.uniform(0.0, 360.0)
        self.speed = speed
        self.vx    = 0.0
        self.vy    = 0.0
        self.color  = random.choice(TRAFFIC_COLORS)
        self.width  = TRAFFIC_W
        self.height = TRAFFIC_H

        self.waypoints: deque = deque()
        for _ in range(3):
            self._add_waypoint()

        self._surf = self._build_surface()

    def _build_surface(self) -> pygame.Surface:
        w, h = self.width, self.height
        surf = pygame.Surface((w, h), pygame.SRCALPHA)
        pygame.draw.rect(surf, self.color, (0, 0, w, h), border_radius=6)

        ww = int(w * 0.7)
        wx = (w - ww) // 2
        # Windshield at top (front)
        pygame.draw.rect(surf, (180, 220, 255, 180),
                         (wx, 4, ww, int(h * 0.26)), border_radius=3)
        # Headlights
        pygame.draw.rect(surf, (255, 255, 200), (2,       4, 8, 6), border_radius=2)
        pygame.draw.rect(surf, (255, 255, 200), (w - 10,  4, 8, 6), border_radius=2)
        return surf

    def _add_waypoint(self):
        dist  = random.uniform(_WAYPOINT_DIST_MIN, _WAYPOINT_DIST_MAX)
        angle = random.uniform(0.0, 360.0)
        rad   = math.radians(angle)
        if self.waypoints:
            bx, by = self.waypoints[-1]
        else:
            bx, by = self.x, self.y
        self.waypoints.append((bx + math.cos(rad) * dist,
                               by + math.sin(rad) * dist))

    def _decide_next_waypoint(self, px: float, py: float,
                               pvx: float, pvy: float):
        """Add a pursuit or random waypoint depending on proximity."""
        dist = math.hypot(self.x - px, self.y - py)
        if dist < ENEMY_CHASE_RADIUS and random.random() < ENEMY_CHASE_BIAS:
            # Lead-shot: aim at predicted player position
            t  = dist / max(self.speed, 1.0) * 0.4
            tx = px + pvx * t + random.uniform(-80, 80)
            ty = py + pvy * t + random.uniform(-80, 80)
            self.waypoints.append((tx, ty))
        else:
            self._add_waypoint()

    # ── Update ────────────────────────────────────────────────────────────

    def update(self, player_x: float, player_y: float,
               player_vx: float, player_vy: float):
        if not self.waypoints:
            self._decide_next_waypoint(player_x, player_y, player_vx, player_vy)

        wpt_x, wpt_y = self.waypoints[0]
        dx = wpt_x - self.x
        dy = wpt_y - self.y
        dist = math.hypot(dx, dy)

        if dist < _WAYPOINT_ARRIVE:
            self.waypoints.popleft()
            self._decide_next_waypoint(player_x, player_y, player_vx, player_vy)
            return

        # Steer toward waypoint
        desired_angle = math.degrees(math.atan2(dy, dx)) % 360
        diff = (desired_angle - self.angle + 180) % 360 - 180
        self.angle = (self.angle + max(-_MAX_TURN, min(_MAX_TURN, diff))) % 360

        rad = math.radians(self.angle)
        desired_vx = math.cos(rad) * self.speed
        desired_vy = math.sin(rad) * self.speed

        self.vx += (desired_vx - self.vx) * _ENEMY_GRIP
        self.vy += (desired_vy - self.vy) * _ENEMY_GRIP

        self.x += self.vx
        self.y += self.vy

    # ── Geometry ──────────────────────────────────────────────────────────

    def get_screen_pos(self, cam_x: float, cam_y: float) -> tuple:
        return (self.x - cam_x, self.y - cam_y)

    def get_rect(self, cam_x: float, cam_y: float) -> pygame.Rect:
        sx, sy = self.get_screen_pos(cam_x, cam_y)
        return pygame.Rect(
            int(sx) - self.width  // 2,
            int(sy) - self.height // 2,
            self.width,
            self.height,
        )

    # ── Draw ──────────────────────────────────────────────────────────────

    def draw(self, surface: pygame.Surface, cam_x: float, cam_y: float):
        sx, sy = self.get_screen_pos(cam_x, cam_y)
        if not (-100 <= sx <= WIDTH + 100 and -100 <= sy <= HEIGHT + 100):
            return
        pygame_rot = (270.0 - self.angle) % 360
        rotated = pygame.transform.rotate(self._surf, pygame_rot)
        rect = rotated.get_rect(center=(int(sx), int(sy)))
        surface.blit(rotated, rect)


# ── Manager ───────────────────────────────────────────────────────────────────

class TrafficManager:
    def __init__(self, target_count: int = 5):
        self.cars: list[EnemyCar] = []
        self.target_count = target_count

    def update(self, player_x: float, player_y: float,
               player_vx: float, player_vy: float, enemy_speed: float):
        spd = min(enemy_speed, ENEMY_SPEED_CAP)
        for car in self.cars:
            car.speed = spd
            car.update(player_x, player_y, player_vx, player_vy)

        # Despawn cars that wandered too far
        self.cars = [
            c for c in self.cars
            if math.hypot(c.x - player_x, c.y - player_y) <= ENEMY_DESPAWN_DIST
        ]

        # Maintain target count
        while len(self.cars) < self.target_count:
            self._spawn(player_x, player_y, spd)

    def _spawn(self, player_x: float, player_y: float, speed: float):
        angle = random.uniform(0.0, 360.0)
        rad   = math.radians(angle)
        dist  = ENEMY_SPAWN_RADIUS + random.uniform(0.0, 200.0)
        sx    = player_x + math.cos(rad) * dist
        sy    = player_y + math.sin(rad) * dist
        self.cars.append(EnemyCar(sx, sy, speed))

    def check_collision(self, player) -> bool:
        cam_x = player.x - WIDTH  // 2
        cam_y = player.y - HEIGHT // 2
        pr = player.get_rect().inflate(-8, -10)
        for car in self.cars:
            cr = car.get_rect(cam_x, cam_y).inflate(-8, -10)
            if pr.colliderect(cr):
                return True
        return False

    def remove_colliding(self, player):
        cam_x = player.x - WIDTH  // 2
        cam_y = player.y - HEIGHT // 2
        pr = player.get_rect().inflate(-8, -10)
        self.cars = [
            c for c in self.cars
            if not pr.colliderect(c.get_rect(cam_x, cam_y).inflate(-8, -10))
        ]

    def draw(self, surface: pygame.Surface, cam_x: float, cam_y: float):
        for car in self.cars:
            car.draw(surface, cam_x, cam_y)
