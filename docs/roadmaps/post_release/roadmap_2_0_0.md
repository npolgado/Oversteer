# Post-Release Roadmap — dev_2.0.0 and Beyond

## Overview

After `prod_1.0.0` ships on Steam, this roadmap covers the major update tracks that could constitute a `prod_2.0.0` release. These were explicitly out of scope for the initial release but represent the most natural expansions of the game.

---

## Track A — Multiplayer - dev_2.0.0

### Goal

Add competitive and co-op multiplayer modes. This is the highest-impact post-launch feature and the most technically demanding.

### Scope

- **Local co-op**: Two players share the same arena. Shared trail system — either player can complete encirclement loops. Split or shared HP model TBD.
- **Online competitive**: Race to highest score per session, shared arena, players can disrupt each other's encirclement attempts.
- **Online co-op**: Two players vs. escalating waves. Shared or individual HP/upgrades TBD.
- **Netcode approach**: Evaluate rollback (GGPO-style) vs. authoritative server. Given physics-heavy gameplay, deterministic simulation is a prerequisite.
- **Lobby system**: Steam matchmaking or peer-to-peer via Steamworks.
- **Leaderboards**: Per-mode, per-map competitive leaderboards.

### Prerequisites

- `prod_1.0.0` shipped and stable
- Deterministic physics (game clock already planned in Phase 1 — verify this is seed-deterministic)
- Save system handles per-player state

---

## Track B — Mobile App Store Release - dev_2.1.0

### Goal

Ship native mobile builds on iOS and Android app stores.

### Scope

- Investigate Capacitor or similar web-to-native wrapper (Tauri does not target mobile)
- Fix issue #7 mobile controls if not fully resolved in Phase 1 (touch UX polish, virtual stick feel, layout on small screens)
- Performance pass for mobile GPUs — PixiJS rendering budget tighter on mobile
- App store submission pipeline (Apple App Store, Google Play)
- Touch-specific UI adjustments (tap targets, pause button placement)
- IAP or one-time purchase model decision

### Notes

The web version already runs on mobile browsers. This track is about native distribution and mobile-first UX polish, not a from-scratch port.

---

## Track C — Level Editor + Modding - dev_2.2.0

### Goal

Let players build and share custom arenas, prop layouts, and wave configs.

### Scope

- **Arena editor**: Paint props, define arena boundaries, set spawn points
- **Wave editor**: Define enemy type sequences, spawn rates, horde triggers
- **Upgrade pool editor**: Restrict or weight upgrade offerings for challenge runs
- **Steam Workshop integration**: Upload, browse, and subscribe to community maps
- **Modding API**: Expose map/config schema so external tools can generate valid content

---

## Track D — Expanded Content - dev_2.3.0

### Goal

New worlds, enemies, and upgrade content beyond the Phase 4 additions.

### Scope

- **New worlds** (beyond Phase 4's three): additional biomes with unique mechanics
- **New enemy archetypes**: beyond the 7 from Phase 1-3, introduce enemy types with new behaviors (e.g., enemies that repair each other, swarm types)
- **New upgrade categories**: active abilities (triggered skills vs. passive stat bonuses), synergy upgrades that combine existing upgrades
- **Boss encounters**: Named boss enemies with multi-phase attack patterns, appear at wave milestones
- **Seasonal events**: Time-limited arenas or modifiers tied to real-world dates

---

## Version Summary

| Version | Track | Description |
|---------|-------|-------------|
| `prod_1.0.0` | — | Steam Early Access / Full Release |
| `dev_2.0.0` | A | Multiplayer (co-op + competitive) |
| `dev_2.1.0` | B | Mobile app store release |
| `dev_2.2.0` | C | Level editor + Steam Workshop |
| `dev_2.3.0` | D | Expanded worlds, enemies, bosses |
| `prod_2.0.0` | — | Major release bundling 2.x content |

Tracks A–D are independent and can be prioritized based on community feedback after launch. Track A (multiplayer) is highest leverage for replayability and community building. Track C (modding) is highest leverage for longevity.
