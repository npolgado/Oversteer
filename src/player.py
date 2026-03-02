"""Player car with oversteer physics."""

import pygame
from .constants import (
    WIDTH, PLAYER_W, PLAYER_H, PLAYER_Y, PLAYER_COLOR,
    BASE_SPEED,
)


class Player:
    def __init__(self, start_x: float):
        self.x = float(start_x)
        self.y = float(PLAYER_Y)

        # Physics
        self.drift_vel   = 0.0   # Lateral velocity (px/frame)
        self.grip        = 0.80  # Friction factor (higher = more grip)
        self.steer_force = 1.6   # Input strength
        self.max_drift   = 10.0  # Speed cap

        # Upgrades / status
        self.shield        = 0
        self.nitro_charges = 0
        self.nitro_active  = False
        self.nitro_timer   = 0
        self.has_magnet    = False

        # Visual
        self.width  = PLAYER_W
        self.height = PLAYER_H
        self.color  = PLAYER_COLOR
        self._angle = 0.0        # degrees, for drift lean
        self._surf  = None
        self._build_surface()

    # ── Surface ───────────────────────────────────────────────────────────

    def _build_surface(self):
        """Pre-render the car body onto a surface."""
        w, h = self.width, self.height
        surf = pygame.Surface((w, h), pygame.SRCALPHA)

        # Body
        pygame.draw.rect(surf, self.color, (0, 0, w, h), border_radius=6)
        # Windshield (lighter strip near the top)
        ww = int(w * 0.7)
        wx = (w - ww) // 2
        pygame.draw.rect(surf, (160, 200, 255, 200), (wx, 4, ww, int(h * 0.28)), border_radius=3)
        # Rear lights
        light_h = 6
        pygame.draw.rect(surf, (255, 60, 60), (2,      h - light_h - 2, 8, light_h), border_radius=2)
        pygame.draw.rect(surf, (255, 60, 60), (w - 10, h - light_h - 2, 8, light_h), border_radius=2)
        # Nitro glow (rendered on top when active — handled in draw())
        self._surf = surf

    # ── Update ────────────────────────────────────────────────────────────

    def update(self, keys: pygame.key.ScancodeWrapper, scroll_speed: float):
        # Oversteer: grip reduces at higher speed
        speed_factor    = scroll_speed / BASE_SPEED
        effective_grip  = max(0.60, self.grip / speed_factor ** 0.4)

        steer = 0
        if keys[pygame.K_LEFT]  or keys[pygame.K_a]:
            steer -= 1
        if keys[pygame.K_RIGHT] or keys[pygame.K_d]:
            steer += 1

        self.drift_vel += steer * self.steer_force
        self.drift_vel  = max(-self.max_drift, min(self.max_drift, self.drift_vel))
        self.drift_vel *= effective_grip

        # Nitro
        if self.nitro_active:
            self.nitro_timer -= 1
            if self.nitro_timer <= 0:
                self.nitro_active = False

        self.x += self.drift_vel

        # Visual lean angle (tilts toward drift direction)
        target_angle = -self.drift_vel * 1.8
        self._angle += (target_angle - self._angle) * 0.20

    def activate_nitro(self):
        if self.nitro_charges > 0 and not self.nitro_active:
            self.nitro_charges -= 1
            self.nitro_active   = True
            self.nitro_timer    = 90   # 1.5 seconds at 60 fps

    # ── Geometry ──────────────────────────────────────────────────────────

    def get_rect(self) -> pygame.Rect:
        return pygame.Rect(
            self.x - self.width  // 2,
            self.y - self.height // 2,
            self.width,
            self.height,
        )

    # ── Draw ──────────────────────────────────────────────────────────────

    def draw(self, surface: pygame.Surface):
        rotated = pygame.transform.rotate(self._surf, self._angle)
        rect    = rotated.get_rect(center=(int(self.x), int(self.y)))
        surface.blit(rotated, rect)

        # Nitro flame
        if self.nitro_active:
            fx = int(self.x)
            fy = int(self.y) + self.height // 2 + 4
            flame_w = 10
            for fi in range(8):
                alpha = 220 - fi * 24
                col   = (255, max(0, 180 - fi * 20), 0)
                pygame.draw.circle(surface, col, (fx, fy + fi * 5), flame_w - fi)

        # Shield indicator
        if self.shield > 0:
            pygame.draw.circle(
                surface, (100, 180, 255),
                (int(self.x), int(self.y)),
                self.width, 2,
            )
