"""Oversteer — Roguelike Driving Game
Entry point: python main.py
"""

import pygame
from src.game import Game


def main():
    pygame.init()
    pygame.display.set_caption("OVERSTEER")
    game = Game()
    game.run()
    pygame.quit()


if __name__ == "__main__":
    main()
