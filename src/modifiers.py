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
        "Traffic doubled. The field is swarming with enemies.",
    ),
    Modifier(
        "black_ice", "Black Ice",
        "Slippery surface. Grip is significantly reduced.",
    ),
    Modifier(
        "gridlock", "Gridlock",
        "50 % more enemy cars from the start. Good luck.",
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
        "adrenaline", "Adrenaline",
        "Car starts with 25 % higher top speed. High risk.",
    ),
    Modifier(
        "no_fuel", "No Fuel System",
        "Fuel drain disabled. Pure enemy avoidance.",
    ),
]
