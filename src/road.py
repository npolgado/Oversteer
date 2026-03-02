"""Procedural infinite road generator and renderer."""

import collections
import random
import pygame
from .constants import (
    WIDTH, HEIGHT, SEGMENT_H, ROAD_WIDTH, LANE_COUNT, LANE_W, RUMBLE_W,
    ROAD_COLOR, ROAD_ALT_COLOR, GRASS_COLOR, GRASS_ALT_COLOR,
    RUMBLE_A, RUMBLE_B, LANE_MARK_COLOR, CENTER_COLOR, MAX_CURVE,
)


class Road:
    """Manages an infinite scrolling road made of thin horizontal strips.

    strips[0]  → top of screen (farthest ahead of player)
    strips[-1] → bottom of screen (closest to player)

    As the road scrolls DOWN each frame, old strips fall off the bottom and
    new strips are generated at the top.
    """

    def __init__(self, road_width: int = ROAD_WIDTH):
        self.road_width = road_width
        self._num_strips = HEIGHT // SEGMENT_H + 3

        # Each entry: (center_x, stripe_parity)
        self._strips: collections.deque = collections.deque()
        self._sub_pixel = 0.0   # Fractional scroll accumulator

        # Curve generation state
        self._curve_offset   = 0.0
        self._curve_velocity = 0.0
        self._curve_target   = 0.0
        self._curve_timer    = 0      # Frames until next target change
        self._stripe_counter = 0      # Alternating stripe parity
        self._dash_counter   = 0      # For dashed lane lines

        # Pre-fill strips (straight road at start)
        for _ in range(self._num_strips):
            self._strips.append(self._next_strip())

    # ── Internal generation ────────────────────────────────────────────────

    def _next_strip(self) -> tuple:
        """Generate the next strip for the top of the road."""
        if self._curve_timer <= 0:
            self._curve_target = random.uniform(-MAX_CURVE, MAX_CURVE)
            self._curve_timer  = random.randint(80, 220)

        diff = self._curve_target - self._curve_offset
        self._curve_velocity += diff * 0.004
        self._curve_velocity *= 0.93
        self._curve_offset   += self._curve_velocity
        self._curve_timer    -= 1

        center_x     = int(WIDTH // 2 + self._curve_offset)
        stripe       = self._stripe_counter % 2
        dash         = self._dash_counter % 12  # lane dash pattern
        self._stripe_counter += 1
        self._dash_counter   += 1
        return (center_x, stripe, dash)

    # ── Update ────────────────────────────────────────────────────────────

    def update(self, speed: float):
        """Advance the road by `speed` pixels this frame."""
        self._sub_pixel += speed
        while self._sub_pixel >= SEGMENT_H:
            self._sub_pixel -= SEGMENT_H
            self._strips.pop()                          # remove bottom strip
            self._strips.appendleft(self._next_strip()) # add new at top

    # ── Query ─────────────────────────────────────────────────────────────

    def get_center_at_y(self, screen_y: float) -> int:
        """Return the road centre-x at a given screen y."""
        idx = int((screen_y + self._sub_pixel) / SEGMENT_H)
        idx = max(0, min(idx, len(self._strips) - 1))
        return self._strips[idx][0]

    def get_edges_at_y(self, screen_y: float) -> tuple:
        """Return (left_edge_x, right_edge_x) of road at screen_y."""
        cx = self.get_center_at_y(screen_y)
        half = self.road_width // 2
        return cx - half, cx + half

    # ── Draw ──────────────────────────────────────────────────────────────

    def draw(self, surface: pygame.Surface):
        sub = int(self._sub_pixel)

        for i, (cx, stripe, dash) in enumerate(self._strips):
            y = i * SEGMENT_H - sub
            if y > HEIGHT:
                break
            if y + SEGMENT_H < 0:
                continue

            half  = self.road_width // 2
            left  = cx - half
            right = cx + half

            # ── Grass (fills behind the road) ─────────────────────────────
            grass_col = GRASS_COLOR if stripe == 0 else GRASS_ALT_COLOR
            if left > 0:
                pygame.draw.rect(surface, grass_col, (0, y, left, SEGMENT_H))
            if right < WIDTH:
                pygame.draw.rect(surface, grass_col, (right, y, WIDTH - right, SEGMENT_H))

            # ── Road surface ──────────────────────────────────────────────
            road_col = ROAD_COLOR if stripe == 0 else ROAD_ALT_COLOR
            pygame.draw.rect(surface, road_col, (left, y, self.road_width, SEGMENT_H))

            # ── Rumble strips ─────────────────────────────────────────────
            rumble = RUMBLE_A if stripe == 0 else RUMBLE_B
            pygame.draw.rect(surface, rumble, (left - RUMBLE_W, y, RUMBLE_W, SEGMENT_H))
            pygame.draw.rect(surface, rumble, (right,           y, RUMBLE_W, SEGMENT_H))

            # ── Centre line (solid yellow) ────────────────────────────────
            pygame.draw.rect(surface, CENTER_COLOR, (cx - 2, y, 4, SEGMENT_H))

            # ── Lane dividers (dashed white) ──────────────────────────────
            if dash < 6:   # "on" phase of dash
                for lane in range(1, LANE_COUNT):
                    if lane == LANE_COUNT // 2:
                        continue   # skip centre (already drawn yellow)
                    lx = left + lane * LANE_W
                    pygame.draw.rect(surface, LANE_MARK_COLOR, (lx - 1, y, 2, SEGMENT_H))
