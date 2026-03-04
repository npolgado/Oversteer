"""Upgrade definitions for roguelike pick-up offers."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Upgrade:
    id:     str
    name:   str
    desc:   str
    rarity: str   # "common" | "uncommon" | "rare" | "epic"


ALL_UPGRADES: list[Upgrade] = [
    # ── Common ────────────────────────────────────────────────────────────
    Upgrade(
        "wide_tires", "Wide Tires",
        "Improved grip. The car slides less at high speed.",
        "common",
    ),
    Upgrade(
        "fuel_tank", "Extended Tank",
        "Fuel capacity +30 %. Each pickup also refuels more.",
        "common",
    ),
    Upgrade(
        "steady_hands", "Steady Hands",
        "Steering angle +15 %. Turn tighter at speed.",
        "common",
    ),
    Upgrade(
        "lead_foot", "Lead Foot",
        "Top speed +1.5 px/frame. Go even faster.",
        "common",
    ),

    # ── Uncommon ──────────────────────────────────────────────────────────
    Upgrade(
        "nitro", "Nitro Boost",
        "+1 nitro charge. Press N to burn it for a burst of speed.",
        "uncommon",
    ),
    Upgrade(
        "shield", "Crumple Zone",
        "+1 collision shield. Absorbs one hit before you die.",
        "uncommon",
    ),
    Upgrade(
        "magnet", "Magnetic Bumper",
        "Fuel canisters are pulled toward your car automatically.",
        "uncommon",
    ),
    Upgrade(
        "overdrive", "Overdrive",
        "Top speed +1.0 and grip improved. Push the limits.",
        "uncommon",
    ),

    # ── Rare ──────────────────────────────────────────────────────────────
    Upgrade(
        "ghost", "Ghost Mode",
        "+2 ghost charges. Pass through enemies without dying.",
        "rare",
    ),
    Upgrade(
        "overclock", "Overclock",
        "Enemy speed growth slowed 40 %. Buy yourself more time.",
        "rare",
    ),
    Upgrade(
        "double_fuel", "Siphon",
        "Each fuel canister collected fills twice as much.",
        "rare",
    ),
]
