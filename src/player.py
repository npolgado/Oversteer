"""Player car with 2D free-driving physics and drift."""

import math
import pygame
from .constants import (
    WIDTH, HEIGHT,
    PLAYER_W, PLAYER_H, PLAYER_COLOR,
    PLAYER_MAX_SPEED, PLAYER_ACCEL, PLAYER_BRAKE, PLAYER_COAST,
    PLAYER_TURN, PLAYER_GRIP,
)

# Screen-centre where the player is always drawn
_SCX = WIDTH  // 2
_SCY = HEIGHT // 2


class Player:
    def __init__(self, x: float, y: float):
        self.x = float(x)
        self.y = float(y)

        # Heading in degrees  (0 = right, 90 = down, 270 = up in screen coords)
        self.angle = 270.0   # start facing up

        # Scalar forward speed (negative = reversing)
        self.speed = 0.0

        # Actual velocity vector — lags behind heading*speed due to drift
        self.vx = 0.0
        self.vy = 0.0

        # Visual angle follows atan2(vy, vx); separate from heading for drift look
        self._visual_angle = 270.0

        # Physics (tweakable by upgrades)
        self.grip      = PLAYER_GRIP
        self.max_speed = PLAYER_MAX_SPEED
        self.turn_rate = PLAYER_TURN   # degrees/frame; raised by steady_hands

        # Status
        self.shield        = 0
        self.nitro_charges = 0
        self.nitro_active  = False
        self.nitro_timer   = 0
        self.has_magnet    = False

        self.width  = PLAYER_W
        self.height = PLAYER_H
        self.color  = PLAYER_COLOR

        self._surf = None
        self._build_surface()

    # ── Surface ───────────────────────────────────────────────────────────

    def _build_surface(self):
        w, h = self.width, self.height
        surf = pygame.Surface((w, h), pygame.SRCALPHA)

        # Body
        pygame.draw.rect(surf, self.color, (0, 0, w, h), border_radius=6)
        # Windshield near top = front
        ww = int(w * 0.7)
        wx = (w - ww) // 2
        pygame.draw.rect(surf, (160, 200, 255, 200),
                         (wx, 4, ww, int(h * 0.28)), border_radius=3)
        # Rear lights
        lh = 6
        pygame.draw.rect(surf, (255, 60, 60), (2,       h - lh - 2, 8, lh), border_radius=2)
        pygame.draw.rect(surf, (255, 60, 60), (w - 10,  h - lh - 2, 8, lh), border_radius=2)

        self._surf = surf

    # ── Update ────────────────────────────────────────────────────────────

    def update(self, keys: pygame.key.ScancodeWrapper):
        # ── Steering ──────────────────────────────────────────────────────
        steer = 0
        if keys[pygame.K_LEFT]  or keys[pygame.K_a]:
            steer -= 1
        if keys[pygame.K_RIGHT] or keys[pygame.K_d]:
            steer += 1
        self.angle = (self.angle + steer * self.turn_rate) % 360

        # ── Throttle / brake ──────────────────────────────────────────────
        nitro_cap = self.max_speed + (3.0 if self.nitro_active else 0.0)
        if keys[pygame.K_UP] or keys[pygame.K_w]:
            self.speed = min(self.speed + PLAYER_ACCEL, nitro_cap)
        elif keys[pygame.K_DOWN] or keys[pygame.K_s]:
            self.speed = max(self.speed - PLAYER_BRAKE, -self.max_speed * 0.3)
        else:
            self.speed *= PLAYER_COAST

        # ── Nitro timer ───────────────────────────────────────────────────
        if self.nitro_active:
            self.nitro_timer -= 1
            if self.nitro_timer <= 0:
                self.nitro_active = False

        # ── Drift physics ─────────────────────────────────────────────────
        # Effective grip drops at higher speed → car slides sideways
        eff_grip = max(0.45, self.grip / (1.0 + abs(self.speed) * 0.06))

        rad = math.radians(self.angle)
        desired_vx = math.cos(rad) * self.speed
        desired_vy = math.sin(rad) * self.speed

        self.vx += (desired_vx - self.vx) * eff_grip
        self.vy += (desired_vy - self.vy) * eff_grip

        # ── Move ──────────────────────────────────────────────────────────
        self.x += self.vx
        self.y += self.vy

        # ── Visual angle (follows velocity, not heading) ───────────────────
        if abs(self.vx) > 0.05 or abs(self.vy) > 0.05:
            target_va = math.degrees(math.atan2(self.vy, self.vx)) % 360
            diff = (target_va - self._visual_angle + 180) % 360 - 180
            self._visual_angle = (self._visual_angle + diff * 0.25) % 360

    def activate_nitro(self):
        if self.nitro_charges > 0 and not self.nitro_active:
            self.nitro_charges -= 1
            self.nitro_active  = True
            self.nitro_timer   = 90   # 1.5 s at 60 fps

    # ── Geometry ──────────────────────────────────────────────────────────

    def get_rect(self) -> pygame.Rect:
        """Screen-space rect; player is always drawn at screen centre."""
        return pygame.Rect(
            _SCX - self.width  // 2,
            _SCY - self.height // 2,
            self.width,
            self.height,
        )

    # ── Draw ──────────────────────────────────────────────────────────────

    def draw(self, surface: pygame.Surface):
        # Base sprite points UP; rotate so it faces visual_angle
        # visual_angle 270° (up) → rot 0 (no rotation)
        # visual_angle   0° (right) → rot 270 (= 90° CW)
        pygame_rot = (270.0 - self._visual_angle) % 360
        rotated = pygame.transform.rotate(self._surf, pygame_rot)
        rect = rotated.get_rect(center=(_SCX, _SCY))
        surface.blit(rotated, rect)

        # Nitro exhaust flame at the rear
        if self.nitro_active:
            rear_rad = math.radians(self._visual_angle + 180)
            base_fx = _SCX + int(math.cos(rear_rad) * (self.height // 2 + 2))
            base_fy = _SCY + int(math.sin(rear_rad) * (self.height // 2 + 2))
            for fi in range(8):
                col = (255, max(0, 180 - fi * 22), 0)
                r   = max(1, 10 - fi)
                ox  = int(math.cos(rear_rad) * fi * 5)
                oy  = int(math.sin(rear_rad) * fi * 5)
                pygame.draw.circle(surface, col, (base_fx + ox, base_fy + oy), r)

        # Shield ring
        if self.shield > 0:
            pygame.draw.circle(
                surface, (100, 180, 255),
                (_SCX, _SCY),
                self.width, 2,
            )
