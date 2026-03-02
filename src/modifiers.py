"""Run-modifier definitions chosen at the start of each run."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Modifier:
    id:   str
    name: str
    desc: str


ALL_MODIFIERS: list[Modifier] = [
    Modifier(
        "rush_hour", "Rush Hour",
        "Traffic density doubled. The roads are packed.",
    ),
    Modifier(
        "black_ice", "Black Ice",
        "Slippery surface. Grip is significantly reduced.",
    ),
    Modifier(
        "narrow", "Narrow Roads",
        "Road width -30 %. Every swerve counts.",
    ),
    Modifier(
        "low_fuel", "Empty Tank",
        "Start with only 50 % fuel. Find canisters fast.",
    ),
    Modifier(
        "fog", "Thick Fog",
        "Visibility ahead is severely limited.",
    ),
    Modifier(
        "lucky_start", "Lucky Start",
        "Begin with a free random upgrade.",
    ),
    Modifier(
        "tailwind", "Tailwind",
        "Speed starts 20 % higher and ramps faster. High risk.",
    ),
    Modifier(
        "no_fuel", "No Fuel System",
        "Fuel drains disabled. Pure obstacle avoidance.",
    ),
]
