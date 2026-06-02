# Phase 4 — Content & Balance Design

**Status:** Planning / brainstorm — no implementation yet.

This doc collects the design items deferred from the 2026-05-24 live-test pass. Each section has a one-line problem statement, known constraints, and open questions. Answers belong in a follow-up session before coding begins.

---

## 1. Pickups beyond hex-scrap

**Problem:** Scrap is currently a placeholder — collecting it fires "+SCRAP" text but has no real game effect. By wave 4 the field is littered with identical gray hexagons and none of them feel meaningful.

**Direction to explore:**
- Scrap becomes a currency for a between-wave shop (repair, brief invincibility, combo multiplier boost).
- New pickup types with distinct gameplay roles: a time-slow grenade, a trail-extend token, a one-time shield.
- Near-miss rewards drop on consecutive near-misses (skill-based pickup spawns).

**Open questions:**
- What's the scrap economy curve? How many scraps drop per wave vs. cost of shop items?
- Does the shop open during the upgrade break, or is it a separate screen?
- Should pickups expire or persist until collected?

---

## 2. Enemy variety beyond wave 4

**Problem:** By wave 4 the full enemy roster (drifter/blocker/flanker/bomber/elite) has appeared. Subsequent waves just add more of the same — feel predictable.

**Direction to explore:**
- Wave-specific compositions instead of purely additive spawning (e.g. wave 6 = all flankers, wave 8 = bomber + blocker swarm).
- New enemy archetypes: suicide rusher (charges in a straight line, explodes on contact), shielded enemy (blocks trail damage from one direction), splitter (splits into two chasers on kill).
- Enemy curses applied to player on contact: slow curse, reverse-steering curse, trail-blur.

**Open questions:**
- At what wave number should each new archetype first appear?
- Should enemy curses be debuffs the player has to shake off (timer-based), or permanent-until-killed?
- How do curses interact with Auto Repair and other upgrades?

---

## 3. World variety

**Problem:** The 3000×3000 arena doesn't change between waves. By wave 5 players have memorized the prop layout and the world feels static.

**Direction to explore:**
- Mid-run hazard events: temporary lava pools, lightning strike zones, timed road blocks.
- Prop set variation between maps (map select screen already has a "Loopy" map — expand with more biomes).
- Ambient background variation: time-of-day tinting, edge-glow progression as waves advance.

**Open questions:**
- Do props regenerate / shift between waves, or is the layout fixed per run?
- How do hazard zones interact with the existing bomb-zone and mud-prop systems?
- Which map variants are in scope for Phase 4 vs. later?

---

## 4. Upgrade synergies and late-game scaling

**Problem:** Most upgrades are independent. Drift King + Afterburner + Nitro Drift stack well by coincidence, but there's no designed synergy system. Late-game upgrade selection becomes repetitive.

**Direction to explore:**
- Named synergy pairs: if player holds two specific upgrades, a visual indicator and bonus unlock (e.g. "Drift King + Nitro Drift → Overboost" reduces drift exit cooldown).
- Combo cap raise or removal (currently hard-capped at 8×).
- A "mastery" upgrade tier that only appears if the player has ≥3 of a related set.

**Open questions:**
- Should synergies be explicit (visible on card) or emergent (you discover them in play)?
- How many synergy pairs are realistic to balance and test in one phase?

---

## 5. Boss waves

**Problem:** The game has no milestone encounters — every wave is structurally identical (spawn enemies until timer, then upgrade break). No climax moments.

**Direction to explore:**
- Boss waves every 5 waves (wave 5, 10, 15…): a single named enemy with high HP, unique behavior pattern, and a guaranteed upgrade drop.
- Boss patterns: pursuer that matches player speed, a stationary core that spawns minions in rings, a reflector that bounces the player's own trail back.
- Boss announcement: full-screen flash + audio sting before the boss spawns.

**Open questions:**
- Does the boss replace a normal wave entirely, or does it follow a short normal wave?
- What's the reward structure — guaranteed upgrade, score bonus, or something new (e.g. one-time power-up)?
- How do boss waves interact with difficulty modifiers (Hard Mode, Double Enemies)?

---

## 6. Visual flair

**Problem:** The game lacks visual feedback on high-impact moments — encirclements, horde spawns, and near-misses are audible but visually underwhelming. The overall art style is also inconsistent (see `docs/live_test_2026-05-16.md` HUD & FX section).

**Direction to explore:**
- Particle bursts on large encirclements (>3 enemies) — color-coded by combo level.
- Screen shake calibration pass — horde spawn and bomb zone entry should feel more impactful.
- Full-screen desaturation + slow-motion flash frame on player death.
- Upgrade card icons: replace placeholder letters with proper symbols (Tight Turns = `R` is tracked as bug #5 in live test doc).
- Global UI text size + outline pass (see live test doc "UI Text — global readability issues").

**Open questions:**
- Is a particle/FX artist involved, or are we generating all effects procedurally?
- What's the priority order within visual flair — readability first, then polish?

---

## 7. Drift exploit and balance revisit

**Problem (drift exploit):** Drift combo scores points indefinitely for circular drifting with no enemies nearby. This is a long-standing mechanic gap present in the canvas source-of-truth too — not a port regression. No anti-camp mechanic exists.

**Problem (auto-repair pacing):** Wave 7 health pressure outpaces Auto Repair's 3 HP/s with 2s regen delay, especially with elites (25 → 31 damage at wave 7 scaling) and the burst + horde combo. The TS port also lacks the canvas reference's 3-stack cap on Auto Repair.

**Knobs identified for drift exploit:**
- Decay drift combo while drifting if no enemy is within N px (proximity gate).
- Require a near-miss or kill within the last T seconds to continue scoring drift combo (engagement gate).

**Knobs identified for auto-repair:**
- `HP_REGEN_DELAY`: 2.0s → 1.0s (quicker regen kickin).
- Per-stack heal rate: +3 → +5 HP/s.
- `DMG_SCALE_PER_WAVE`: 0.12 → 0.08 (reduce late-wave scaling).
- `SPAWN_INTERVAL_MIN`: 1.5s → 1.8s (ease wave 7 density).
- Add missing `regenCount ≤ 3` stack cap (parity with canvas reference).

**Recommendation:** Do not tune these in isolation — balance after new content (boss waves, enemy curses, new pickups) is added, since all systems interact.

---

**Phase 4 close-out (2026-06-01)** — Implemented: biome framework (Wasteland/Rupture/Jungle), per-biome music packs + fog overlay + upgrade bias, boss wave patterns (Pursuer/Core/Reflector) + boss reward drop (+1 reroll), Splitter enemy archetype, encirclement particle burst (combo-colored), upgrade card unicode icon symbols, combo cap raised 8→16. Balance pass §7 deferred per recommendation above.
