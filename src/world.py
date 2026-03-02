"""Tiled background renderer for the infinite free-driving world."""

import pygame
from .constants import TILE_SIZE, GRASS_COLOR, GRASS_ALT_COLOR, WIDTH, HEIGHT


def draw_world(surface: pygame.Surface, cam_x: float, cam_y: float):
    """Draw a checkerboard of grass tiles covering the visible screen area."""
    start_col = int(cam_x // TILE_SIZE)
    start_row = int(cam_y // TILE_SIZE)
    cols = WIDTH  // TILE_SIZE + 3
    rows = HEIGHT // TILE_SIZE + 3

    for row in range(start_row, start_row + rows):
        for col in range(start_col, start_col + cols):
            color = GRASS_COLOR if (col + row) % 2 == 0 else GRASS_ALT_COLOR
            sx = int(col * TILE_SIZE - cam_x)
            sy = int(row * TILE_SIZE - cam_y)
            pygame.draw.rect(surface, color, (sx, sy, TILE_SIZE, TILE_SIZE))
