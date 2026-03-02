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
        "Fuel capacity +30 %. Collected pickup also refuels more.",
        "common",
    ),
    Upgrade(
        "steady_hands", "Steady Hands",
        "Steering force +15 %. Quicker lane changes.",
        "common",
    ),
    Upgrade(
        "lead_foot", "Lead Foot",
        "Speed cap raised. The road gets faster sooner.",
        "common",
    ),

    # ── Uncommon ──────────────────────────────────────────────────────────
    Upgrade(
        "nitro", "Nitro Boost",
        "+1 nitro charge. Hold SPACE to burn it for a burst of speed.",
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
        "road_feel", "Rally Suspension",
        "Effective road width +50 px. More room to breathe.",
        "uncommon",
    ),

    # ── Rare ──────────────────────────────────────────────────────────────
    Upgrade(
        "ghost", "Ghost Mode",
        "+2 ghost charges. Pass through traffic without dying.",
        "rare",
    ),
    Upgrade(
        "overclock", "Overclock",
        "Speed ramp doubled. Risky — but more upgrades come faster.",
        "rare",
    ),
    Upgrade(
        "double_fuel", "Siphon",
        "Each fuel canister collected fills twice as much.",
        "rare",
    ),
]
