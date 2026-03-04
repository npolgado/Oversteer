"""All UI rendering: HUD, menus, overlays."""

import math
import pygame
from .constants import (
    WIDTH, HEIGHT,
    BLACK, WHITE, GRAY, YELLOW, RED, GREEN, ORANGE,
    UI_BG, UI_CARD_BG, UI_CARD_BORDER, UI_ACCENT, RARITY_COLORS,
    FUEL_MAX, PLAYER_MAX_SPEED,
)

_FONT_CACHE: dict = {}


def _font(size: int, bold: bool = False) -> pygame.font.Font:
    key = (size, bold)
    if key not in _FONT_CACHE:
        try:
            _FONT_CACHE[key] = pygame.font.SysFont("consolas", size, bold=bold)
        except Exception:
            _FONT_CACHE[key] = pygame.font.Font(None, size)
    return _FONT_CACHE[key]


def _text(surface, msg, size, color, pos, anchor="topleft", bold=False):
    f   = _font(size, bold)
    img = f.render(str(msg), True, color)
    r   = img.get_rect(**{anchor: pos})
    surface.blit(img, r)
    return r


def _panel(surface, rect, bg=UI_CARD_BG, border=UI_CARD_BORDER, radius=10):
    s = pygame.Surface((rect.width, rect.height), pygame.SRCALPHA)
    pygame.draw.rect(s, (*bg, 230), (0, 0, rect.width, rect.height), border_radius=radius)
    pygame.draw.rect(s, (*border, 255), (0, 0, rect.width, rect.height), 2, border_radius=radius)
    surface.blit(s, rect.topleft)


# ── Main menu ─────────────────────────────────────────────────────────────────

def draw_menu(surface: pygame.Surface):
    surface.fill(UI_BG)

    title_r = _text(surface, "OVERSTEER", 88, UI_ACCENT,
                    (WIDTH // 2, HEIGHT // 2 - 120), "center", bold=True)

    _text(surface, "A roguelike free-driving survival", 26, (160, 160, 180),
          (WIDTH // 2, title_r.bottom + 16), "center")

    _text(surface, "PRESS  ENTER  TO  START", 32, WHITE,
          (WIDTH // 2, HEIGHT // 2 + 60), "center", bold=True)

    controls = [
        ("W / ↑   S / ↓",  "Accelerate / Reverse"),
        ("A / ←   D / →",  "Turn left / right"),
        ("SPACE (hold)",    "Handbrake / drift"),
        ("N",               "Nitro boost"),
        ("ESC",             "Quit to menu"),
    ]
    cy = HEIGHT - 150
    for key, action in controls:
        _text(surface, f"{key:<18} {action}", 20, GRAY,
              (WIDTH // 2, cy), "center")
        cy += 26


# ── Modifier selection ────────────────────────────────────────────────────────

def draw_modifier_select(surface: pygame.Surface, modifiers: list):
    surface.fill(UI_BG)
    _text(surface, "CHOOSE YOUR RUN MODIFIER", 38, UI_ACCENT,
          (WIDTH // 2, 60), "center", bold=True)
    _text(surface, "Affects the entire run", 22, GRAY,
          (WIDTH // 2, 108), "center")

    _draw_cards(surface, modifiers, y_top=160, key_labels=("1", "2", "3"),
                name_attr="name", desc_attr="desc")


# ── Upgrade selection ─────────────────────────────────────────────────────────

def draw_upgrade_select(surface: pygame.Surface, upgrades: list):
    overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
    overlay.fill((0, 0, 0, 175))
    surface.blit(overlay, (0, 0))

    _text(surface, "UPGRADE UNLOCKED", 42, UI_ACCENT,
          (WIDTH // 2, 80), "center", bold=True)
    _text(surface, "Press 1 / 2 / 3 to choose", 24, GRAY,
          (WIDTH // 2, 132), "center")

    _draw_cards(surface, upgrades, y_top=185, key_labels=("1", "2", "3"),
                name_attr="name", desc_attr="desc",
                rarity_attr="rarity")


def _draw_cards(surface, items, y_top, key_labels, name_attr, desc_attr,
                rarity_attr=None):
    card_w = 230
    card_h = 220
    gap    = 26
    total  = len(items) * card_w + (len(items) - 1) * gap
    x0     = (WIDTH - total) // 2

    for i, item in enumerate(items):
        cx = x0 + i * (card_w + gap)
        r  = pygame.Rect(cx, y_top, card_w, card_h)
        _panel(surface, r)

        badge_r = pygame.Rect(cx + 8, y_top + 8, 32, 32)
        pygame.draw.rect(surface, UI_ACCENT, badge_r, border_radius=6)
        _text(surface, key_labels[i], 22, BLACK,
              badge_r.center, "center", bold=True)

        if rarity_attr:
            rar  = getattr(item, rarity_attr, "common")
            rcol = RARITY_COLORS.get(rar, GRAY)
            _text(surface, rar.upper(), 16, rcol,
                  (cx + card_w // 2, y_top + 16), "center", bold=True)

        _text(surface, getattr(item, name_attr), 22, WHITE,
              (cx + card_w // 2, y_top + 64), "center", bold=True)

        desc    = getattr(item, desc_attr)
        wrapped = _wrap(desc, card_w - 20, 18)
        dy      = y_top + 102
        for line in wrapped:
            _text(surface, line, 18, (200, 200, 210), (cx + card_w // 2, dy), "center")
            dy += 24


def _wrap(text: str, max_width: int, font_size: int) -> list[str]:
    f     = _font(font_size)
    words = text.split()
    lines = []
    line  = ""
    for w in words:
        test = (line + " " + w).strip()
        if f.size(test)[0] <= max_width:
            line = test
        else:
            if line:
                lines.append(line)
            line = w
    if line:
        lines.append(line)
    return lines


# ── HUD ───────────────────────────────────────────────────────────────────────

def draw_hud(surface: pygame.Surface, fuel: float, fuel_max: float,
             time_alive: float, distance: float, speed: float,
             upgrades: list, modifier, player,
             max_speed: float = PLAYER_MAX_SPEED):
    _draw_fuel_bar(surface, fuel, fuel_max)
    _draw_speed_bar(surface, speed, max_speed)
    _draw_time(surface, time_alive)
    _draw_upgrade_icons(surface, upgrades)
    if modifier:
        _text(surface, modifier.name, 18, ORANGE,
              (WIDTH // 2, 10), "center")
    if player.nitro_charges > 0 or player.nitro_active:
        label = f"NITRO  {'▮' * player.nitro_charges}"
        col   = (80, 220, 255) if player.nitro_active else (100, 180, 220)
        _text(surface, label, 20, col, (WIDTH // 2, 36), "center", bold=True)
    if player.shield > 0:
        _text(surface, f"SHIELD  {'◆' * player.shield}", 20, (100, 180, 255),
              (WIDTH // 2, 60), "center")


def _draw_fuel_bar(surface, fuel, fuel_max):
    bx, by, bw, bh = 14, 14, 160, 18
    pct = max(0.0, fuel / fuel_max)
    col = GREEN if pct > 0.4 else ORANGE if pct > 0.2 else RED
    pygame.draw.rect(surface, (40, 40, 50), (bx, by, bw, bh), border_radius=4)
    pygame.draw.rect(surface, col, (bx, by, int(bw * pct), bh), border_radius=4)
    pygame.draw.rect(surface, WHITE, (bx, by, bw, bh), 1, border_radius=4)
    _text(surface, f"FUEL  {int(fuel)}", 17, WHITE, (bx + bw + 8, by + 1))


def _draw_speed_bar(surface, speed: float, max_speed: float = PLAYER_MAX_SPEED):
    bx, by, bw, bh = 14, 40, 160, 12
    pct = max(0.0, min(1.0, speed / max_speed))
    pygame.draw.rect(surface, (40, 40, 50), (bx, by, bw, bh), border_radius=3)
    pygame.draw.rect(surface, UI_ACCENT, (bx, by, int(bw * pct), bh), border_radius=3)
    pygame.draw.rect(surface, WHITE, (bx, by, bw, bh), 1, border_radius=3)
    kmh = int(speed * 28)
    _text(surface, f"SPEED  {kmh} km/h", 17, WHITE, (bx + bw + 8, by))


def _draw_time(surface, time_alive: float):
    mins = int(time_alive // 60)
    secs = int(time_alive % 60)
    _text(surface, f"{mins:02d}:{secs:02d}", 26, WHITE,
          (WIDTH - 14, 14), "topright", bold=True)


def _draw_upgrade_icons(surface, upgrades):
    if not upgrades:
        return
    y = HEIGHT - 14
    for u in reversed(upgrades):
        _text(surface, f"• {u.name}", 17, (160, 160, 200), (WIDTH - 14, y), "bottomright")
        y -= 22


# ── Fog overlay ───────────────────────────────────────────────────────────────

_FOG_SURF = None

def draw_fog(surface: pygame.Surface):
    global _FOG_SURF
    if _FOG_SURF is None:
        fog_h = int(HEIGHT * 0.55)
        _FOG_SURF = pygame.Surface((WIDTH, fog_h), pygame.SRCALPHA)
        for row in range(fog_h):
            alpha = int(200 * (1 - row / fog_h) ** 1.5)
            _FOG_SURF.fill((20, 20, 30, alpha), (0, row, WIDTH, 1))
    surface.blit(_FOG_SURF, (0, 0))


# ── Game over ─────────────────────────────────────────────────────────────────

def draw_game_over(surface: pygame.Surface, death_reason: str,
                   time_alive: float, distance: float,
                   upgrades: list, modifier):
    overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
    overlay.fill((0, 0, 0, 190))
    surface.blit(overlay, (0, 0))

    panel_r = pygame.Rect(WIDTH // 2 - 240, HEIGHT // 2 - 230, 480, 420)
    _panel(surface, panel_r, radius=14)

    cx = WIDTH // 2
    y  = panel_r.top + 28
    _text(surface, "RUN  OVER", 54, RED, (cx, y), "center", bold=True)
    y += 68
    _text(surface, death_reason, 24, (220, 140, 80), (cx, y), "center")
    y += 46

    mins  = int(time_alive // 60)
    secs  = int(time_alive % 60)
    km    = distance / 1000.0
    stats = [
        ("Survived",   f"{mins:02d}:{secs:02d}"),
        ("Distance",   f"{km:.2f} km"),
        ("Upgrades",   str(len(upgrades))),
        ("Modifier",   modifier.name if modifier else "None"),
    ]
    for label, val in stats:
        _text(surface, label, 20, GRAY,  (cx - 90, y), "topleft")
        _text(surface, val,   20, WHITE, (cx + 90, y), "topright", bold=True)
        y += 34

    y += 20
    _text(surface, "ENTER — play again      ESC — menu", 22, UI_ACCENT,
          (cx, y), "center")
