\# Oversteer - Game Design Document



\## 1. Summary

Oversteer is a top-down 2D car roguelike survival game where you \*\*drift to avoid obstacles and enemy cars\*\*, earn score via \*\*near-miss drifting\*\*, and \*\*collect upgrades between escalating waves\*\* until you crash (game over).



\- Assumptions:

&nbsp; - Shapes-only visuals (no external sprites); cars/objects are stylized rectangles and simple FX.

&nbsp; - Infinite survival structure with wave breaks for upgrade choices.

&nbsp; - One-hit crash (V1) with optional “shield” upgrade as the only extra life.

&nbsp; - Enemies and player share the same movement rules (top-down free movement + drift).

&nbsp; - No audio in V1; all feedback is visual.

&nbsp; - Mobile support via on-screen controls (virtual stick + drift button).



\## 2. Technical Requirements

\- Rendering: \*\*Canvas 2D\*\* (built-in, no external libraries)

\- Single HTML file with inline CSS and JS

\- Unit system: \*\*pixels\*\*

\- Determinism: Use delta time (`dt`) for motion so gameplay is consistent across frame rates



\## 3. Canvas \& Viewport

\- Dimensions: \*\*960×540\*\* internal resolution

\- Aspect ratio behavior: \*\*Letterboxed\*\* to fit window (scale-to-fit, preserve aspect, black bars)

\- Background visual treatment:

&nbsp; - Dark asphalt base with subtle diagonal noise/scanline pattern

&nbsp; - Faint vignette (darkening edges) to match the moody, high-contrast reference

&nbsp; - Sparse “street light” gradients that drift slowly (ambient motion)



\## 4. Visual Style \& Art Direction

\- Art style: \*\*Minimal, high-contrast neon-on-black\*\* (inspired by the dark reference), crisp shapes, soft glow FX for important gameplay feedback

\- Mood/atmosphere: \*\*Night driving / synth noir\*\*, tension-forward, readable silhouettes

\- Color palette (purposeful, 8+):

&nbsp; - `#07080B` Background asphalt (near-black)

&nbsp; - `#0E1118` Secondary asphalt tone (lanes / patches)

&nbsp; - `#1A2233` UI panels / subtle borders

&nbsp; - `#EAEFF7` Primary text/outline (high readability)

&nbsp; - `#35F2D0` Player accent / “good” feedback / drift meter highlights

&nbsp; - `#FF3B6B` Enemy accent / danger / damage flash

&nbsp; - `#FFB000` Pickups / upgrade tokens / “reward” moments

&nbsp; - `#7C5CFF` Rare upgrade highlight / milestone glow

&nbsp; - `#5BFF4A` Shield/repair feedback

&nbsp; - `#6B7280` Neutral obstacles (barriers/cones)

\- Readability rules:

&nbsp; - Player car always has a bright outline + subtle underglow

&nbsp; - Enemy cars have bright front “headlight wedge” indicating heading

&nbsp; - Obstacles are matte and less saturated than enemies/pickups



\## 5. Player Specifications

\- Appearance:

&nbsp; - Top-down compact car silhouette: rounded rectangle body + small windshield rectangle + 2 tiny rear light dots

&nbsp; - Heading indicator: triangular “nose” highlight at front

&nbsp; - Drift FX: tire smoke streaks and skid marks that arc behind the car while drifting

\- Size: \*\*34×18 px\*\* (length × width), rotated by heading

\- Colors:

&nbsp; - Primary body: `#EAEFF7`

&nbsp; - Accent glow: `#35F2D0`

\- Starting position: Center of arena (\*\*480, 270\*\*)

\- Movement constraints:

&nbsp; - \*\*Free movement (360°)\*\* within arena bounds

&nbsp; - Car has velocity + heading; turning affects heading, but momentum can continue (drift)



Animation states (shape-driven, not sprite-based):

\- Idle/roll: subtle engine vibration (0.7 px jitter) + slow glow pulse

\- Drive: slightly stronger glow + faint trailing dust

\- Drift: body “leans” (scale skew illusion) + strong skid marks + smoke

\- Crash (death): shatter lines + expanding ring + fade to dark



\## 6. Physics \& Movement

\*\*Coordinate convention:\*\* +X right, +Y down. “Up” is \*\*negative Y\*\*.



| Property | Value | Unit |

|----------|-------|------|

| Base acceleration (throttle) | 900 | px/sec² |

| Base max speed | 520 | px/sec |

| Reverse acceleration | 600 | px/sec² |

| Reverse max speed | 240 | px/sec |

| Base turn rate (at low speed) | 240 | deg/sec |

| Turn rate reduction at max speed | 45% | multiplier |

| Normal lateral friction (grip) | 8.5 | 1/sec |

| Normal forward drag | 1.7 | 1/sec |

| Drift lateral friction (reduced grip) | 3.2 | 1/sec |

| Drift forward drag (slightly higher) | 2.1 | 1/sec |

| Drift activation threshold | speed ≥ 180 | px/sec |

| Drift boost impulse on enter | +60 | px/sec |

| Arena bounds padding | 24 | px |

| Bounce on wall hit (no crash) | 35% | velocity retained |



Design intent (feel):

\- Without drift: car “sticks” reasonably and corrects quickly.

\- With drift held: car slides wide; heading changes faster than velocity direction, enabling oversteer arcs.



\## 7. Obstacles/Enemies



\### 7.1 Static Obstacles (Arena Hazards)

\- Types (all shapes-only):

&nbsp; 1. \*\*Barrier block\*\*: 60×20 px, rotated randomly in 0/90/180/270

&nbsp; 2. \*\*Cone cluster\*\*: 3 cones in a triangle area ~40×40 px (treated as one hazard hitbox)

&nbsp; 3. \*\*Oil slick\*\*: 70×50 px puddle; entering forces temporary low-grip

\- Colors:

&nbsp; - Barriers/cones: `#6B7280` with subtle edge highlight `#1A2233`

&nbsp; - Oil: `#0B0F19` with glossy spec highlight `#1A2233`

\- Spawn pattern:

&nbsp; - At wave start, spawn \*\*N hazards\*\* in a ring 180–320 px from center, avoiding player start zone radius 140 px

\- Behavior:

&nbsp; - Barriers/cones: static collision = crash (unless shield)

&nbsp; - Oil slick: not a crash; applies “slip” modifier (see below)

\- Slip modifier (oil):

&nbsp; - Duration: \*\*1.2 sec\*\*

&nbsp; - Lateral friction is clamped to \*\*min(2.2 1/sec)\*\* during slip

&nbsp; - Visual: purple-tinted skid marks `#7C5CFF` and wobble vignette



\### 7.2 Enemy Cars

\- Appearance:

&nbsp; - 32×16 px rectangles with aggressive wedge headlights

&nbsp; - “Danger aura” faint red glow

\- Colors:

&nbsp; - Body: `#FF3B6B` (with darker fill `#7A1B33`)

&nbsp; - Headlights: `#EAEFF7`

\- Spawn position \& pattern:

&nbsp; - Spawn just outside arena bounds (offscreen by 40 px) at a random edge

&nbsp; - Spawn in \*\*bursts\*\* per wave (see timing)

\- Movement behavior:

&nbsp; - Enemies drive with the \*\*same movement model constraints as the player\*\* (velocity + heading + drift-capable), but AI steers toward player with limited turn rate

&nbsp; - Types (introduced by progression):

&nbsp;   1. \*\*Chaser\*\* (default): aims at player’s current position

&nbsp;   2. \*\*Interceptor\*\*: aims at player’s predicted position (lead based on player velocity)

&nbsp;   3. \*\*Drifter\*\*: periodically toggles drift for wide sweeping arcs

\- Movement constraints (symmetry):

&nbsp; - \*\*Free 360° motion\*\* and \*\*bounded by arena\*\*, same wall bounce behavior

\- Speeds:

&nbsp; - Chaser max speed: \*\*420 px/sec\*\*

&nbsp; - Interceptor max speed: \*\*460 px/sec\*\*

&nbsp; - Drifter max speed: \*\*440 px/sec\*\*

\- Despawn condition:

&nbsp; - If enemy is offscreen beyond 120 px for > 2 sec (failsafe)

&nbsp; - If enemy “crashes” into barrier (optional: they also die) — V1 default: enemies bounce like player (no free kills)



\### 7.3 Wave Timing (Escalation)

\- Wave length: \*\*25 sec active combat\*\* + \*\*8 sec upgrade break\*\*

\- Enemy spawn cadence within a wave:

&nbsp; - Start: 1 enemy at t=0.8s

&nbsp; - Then every \*\*2.2 sec\*\*, spawn 1 enemy

&nbsp; - Every \*\*8 sec\*\*, spawn an additional “burst” of +2 enemies (spawned 0.3 sec apart)

\- Hazard count per wave: \*\*2 + floor(waveIndex / 2)\*\* (cap at 8)



\## 8. World \& Environment

\- World type: \*\*Single-screen arena\*\* (no scrolling)

\- Arena boundary:

&nbsp; - Soft wall: hitting boundary causes a \*\*bounce + spark FX\*\*, not instant death

&nbsp; - Visual boundary: faint glowing perimeter line `#1A2233` that brightens during near-miss or crash

\- Layers (back to front):

&nbsp; 1. Asphalt base + subtle noise

&nbsp; 2. Faint lane fragments/paint chips moving slowly (ambient parallax illusion)

&nbsp; 3. Skid marks (persistent for 6 sec, fade out)

&nbsp; 4. Entities (player, enemies, hazards, pickups)

&nbsp; 5. UI and screen-space effects (flash, vignette pulse)



Pickups (upgrades currency):

\- \*\*Scrap\*\*: small hex token 14 px diameter, color `#FFB000`

\- Drops:

&nbsp; - Every \*\*6 sec\*\*, spawn 1 scrap near a random point 220–340 px from center

&nbsp; - Additional scrap: 35% chance on near-miss “combo milestone” (see scoring)



\## 9. Collision \& Scoring

\- Collision detection approach:

&nbsp; - Cars use \*\*oriented rectangle visuals\*\* but collision uses \*\*forgiving circles\*\* for fairness

&nbsp; - Player collision radius: \*\*10 px\*\*

&nbsp; - Enemy collision radius: \*\*9 px\*\*

&nbsp; - Barrier/cone collision radius: approximated by \*\*circle radius 14 px\*\* per hazard cluster; barrier uses capsule-like approximation but V1: two circles at ends (each radius 10 px)

\- Hitbox fairness adjustments:

&nbsp; - Player radius is effectively shrunk by \*\*2 px\*\* during drift (representing “slip through” grace)

\- Game over triggers:

&nbsp; - Player collides with enemy car OR barrier/cone hazard \*\*without shield\*\*

&nbsp; - If shield is active: shield breaks, player survives, triggers heavy knockback + invulnerability

\- Score rules:

&nbsp; - Base survival: \*\*+1 point per 0.25 sec\*\* alive (4 pts/sec)

&nbsp; - Near-miss bonus: \*\*+25\*\* (enemy) / \*\*+15\*\* (hazard) per event

&nbsp; - Drift combo: while drifting continuously, every \*\*1.0 sec\*\* adds \*\*+5 × comboLevel\*\*

\- Near-miss definition:

&nbsp; - When player is drifting AND passes within:

&nbsp;   - Enemy near-miss threshold: \*\*(playerRadius + enemyRadius + 8 px)\*\* but no collision

&nbsp;   - Hazard near-miss threshold: \*\*(playerRadius + hazardRadius + 10 px)\*\*

&nbsp; - Cooldown per object: 1.2 sec to prevent farming the same enemy repeatedly

\- High score storage:

&nbsp; - localStorage key: \*\*`oversteer\_highscore\_v1`\*\*



\## 10. Controls

\### Desktop (Keyboard)

| Input | Action | Condition |

|-------|--------|-----------|

| W / Up Arrow | Throttle forward | Playing |

| S / Down Arrow | Brake / reverse | Playing |

| A / Left Arrow | Steer left | Playing |

| D / Right Arrow | Steer right | Playing |

| Space | Hold to Drift | speed ≥ 180 px/sec (otherwise denied feedback) |

| P or Escape | Pause/Resume | Playing/Paused |

| Enter | Start / Confirm | Menu, Game Over, Upgrade select |



\### Mobile (Touch)

| Input | Action | Condition |

|-------|--------|-----------|

| Left virtual stick | Steer + throttle (angle + magnitude) | Playing |

| Right button (DRIFT) | Hold to Drift | speed ≥ 180 px/sec |

| Two-finger tap | Pause/Resume | Playing/Paused |

| Tap upgrade card | Select upgrade | Upgrade break |



Controls must be visible:

\- Menu: show full keyboard + touch mapping

\- Playing: show compact hint (“WASD/Arrows + Space Drift • P Pause” + small mobile overlay)



\## 11. Game States



\### Menu

\- Display:

&nbsp; - Title: \*\*OVERSTEER\*\*

&nbsp; - Subtext: “Drift to survive. Chain near-misses. Build a broken car.”

&nbsp; - Controls panel (keyboard + touch)

&nbsp; - Best score (from localStorage)

\- Start:

&nbsp; - Press \*\*Enter\*\* / Tap \*\*Start\*\*



\### Playing

\- Active systems:

&nbsp; - Player driving + drift

&nbsp; - Enemies spawning per wave

&nbsp; - Hazards present

&nbsp; - Scrap spawning

&nbsp; - Scoring + combo tracking

\- UI shown:

&nbsp; - Score (top-left)

&nbsp; - Wave timer bar (top-center)

&nbsp; - Drift combo meter (bottom-left)

&nbsp; - Controls hint (bottom-right)

&nbsp; - Current upgrades icons (small row)



\### Paused

\- Trigger: \*\*P / Escape\*\* (or two-finger tap)

\- Display:

&nbsp; - “Paused”

&nbsp; - Controls reminder

&nbsp; - “Press P/Esc to resume”

\- Behavior:

&nbsp; - Everything frozen including timers, particles, and animations (except subtle UI pulse)



\### Upgrade Break (between waves)

\- Trigger: Wave timer ends

\- Display:

&nbsp; - Three upgrade “cards” (random from pool, no duplicates in the same selection)

&nbsp; - Countdown: 8 sec (auto-pick random if time expires)

\- Behavior:

&nbsp; - Arena remains visible, enemies despawned, player can roll slowly but score paused



\### Game Over

\- Trigger: crash without shield

\- Display:

&nbsp; - Final score, best score, wave reached

&nbsp; - “Press Enter / Tap to Retry”

\- Behavior:

&nbsp; - Show last 2 seconds replay ghost trail (visual only) fading behind wreck (no interaction)



\## 12. Game Feel \& Juice (REQUIRED)



\### 12.1 Input Response

\- Throttle:

&nbsp; - Same-frame exhaust flare: tiny triangle flash behind car (12 px) for 0.06 sec

\- Steering:

&nbsp; - Same-frame body lean: scale to \*\*1.03×0.97\*\* perpendicular to turn for 0.08 sec

\- Drift (Space / DRIFT button):

&nbsp; - On press (valid): instant tire chirp \*visual\* (white tick marks) + smoke burst (6 particles)

&nbsp; - On press (denied: speed too low): player outline flashes `#FFB000` for 0.12 sec + small “NEED SPEED” text (rises 18 px, fades 0.4 sec)

\- Brake:

&nbsp; - Rear lights brighten and leave a short red streak for 0.1 sec



\### 12.2 Animation Timing

\- Player glow pulse (idle life): 1.2 sec loop, ease-in-out

\- Drift enter “snap”:

&nbsp; - 0.10 sec ease-out: widen skid mark and increase smoke rate

\- Drift exit settle:

&nbsp; - 0.18 sec ease-out: reduce smoke, restore grip feel

\- UI transitions:

&nbsp; - Menu → Playing: fade out 0.25 sec, arena vignette fades in 0.25 sec

&nbsp; - Upgrade cards: slide up 24 px + fade in over 0.20 sec, stagger 0.06 sec each

&nbsp; - Score pop on bonus: scale 1.0→1.2→1.0 over 0.18 sec (ease-out then ease-in)



\### 12.3 Near-Miss Rewards

\- Detection: as defined in Scoring (distance threshold while drifting, no collision)

\- Visual feedback:

&nbsp; - 0.15 sec time dilation (see below)

&nbsp; - Thin neon ring expands from player (radius +80 px) tinted by source:

&nbsp;   - Enemy near-miss: `#FF3B6B`

&nbsp;   - Hazard near-miss: `#FFB000`

&nbsp; - Floating text: “CLOSE!” (+bonus) rises 26 px, fades 0.6 sec

\- Score:

&nbsp; - Immediate +15/+25 plus adds \*\*+1 comboLevel\*\* (max comboLevel 8)



\### 12.4 Screen Effects

| Effect | Trigger | Feel |

|--------|---------|------|

| Shake | Crash, shield break | Crash: 10 px intensity 0.35 sec; Shield: 6 px 0.22 sec |

| Flash | Near-miss, milestone | Near-miss: white 10% opacity 0.08 sec; Milestone: purple `#7C5CFF` 18% 0.18 sec |

| Zoom pulse | Drift enter, milestone | Drift enter: 1.00→1.03 over 0.10 sec then back 0.12 sec |

| Time dilation | Near-miss, crash | Near-miss: 0.85× for 0.15 sec; Crash: 0.35× for 0.35 sec + 0.10 sec freeze frame |



\### 12.5 Progressive Intensity

Score thresholds (or every 500 points, whichever comes first):

\- 500: spawn cadence improves by 10% (interval ×0.90); vignette slightly stronger

\- 1000: introduce Interceptors; enemy glow brighter; skid marks persist +1 sec

\- 1500: introduce Drifters; hazard count +1; UI gains subtle “heat shimmer”

\- 2000+: every +500:

&nbsp; - enemy max speed +12 px/sec (cap +120 total)

&nbsp; - background “street light” gradients move faster

&nbsp; - milestone flash intensity +2%



\### 12.6 Idle Life

\- Player: subtle engine jitter + glow breathing; wheels implied by tiny oscillating dots

\- Environment: drifting dust motes (2–4 per second) moving diagonally; faint lane fragments scroll slowly

\- UI: drift meter gently pulses when drift is available (speed above threshold)



\### 12.7 Milestone Celebrations

\- Interval: every \*\*250 points\*\*

\- Celebration:

&nbsp; - Banner text “MILESTONE +250” slides in top-center (0.22 sec) and fades out (0.35 sec)

&nbsp; - Purple flash + zoom pulse

\- New high score:

&nbsp; - Gold (`#FFB000`) outline around score + “NEW BEST!” tag that persists until death screen



\### 12.8 Death Sequence

\- On crash:

&nbsp; 1. \*\*Freeze frame\*\* 0.10 sec at impact

&nbsp; 2. \*\*Time dilation\*\* 0.35× for 0.35 sec

&nbsp; 3. Player shatters into 10–14 shards (triangles) that fly outward (fast) and fade 0.6 sec

&nbsp; 4. Expanding red ring + heavy screen shake

&nbsp; 5. Scene desaturates toward `#1A2233` over 0.5 sec

&nbsp; 6. Game Over UI fades in 0.25 sec



Shield break (if shield active):

\- Instead of death: bright green flash `#5BFF4A`, knockback 140 px/sec impulse away from collision, invulnerability 1.0 sec with blinking outline.



\## 13. UX Requirements

\- Controls visible on \*\*menu screen\*\* (required)

\- Controls hint during \*\*gameplay\*\* (required)

\- Forgiving collision:

&nbsp; - Circle hitboxes with \*\*2 px shrink\*\* while drifting

\- Mobile/touch support:

&nbsp; - Virtual stick left, drift button right, pause gesture

&nbsp; - Touch UI must not cover score/wave timer

\- Readability:

&nbsp; - Enemies must be distinguishable from hazards by saturation/glow (enemies brighter + moving)

&nbsp; - Near-miss feedback must be unmistakable (ring + slow-mo + text)



\## 14. Out of Scope (V1)

\- Sound effects or music

\- Weapon systems (shooting, projectiles)

\- Complex meta-progression between runs (garage, unlock trees)

\- Procedural tilemap tracks or scrolling worlds (arena only)

\- Online leaderboards / accounts

\- Rebinding controls / settings menu

\- Advanced physics (wheel-level simulation), suspension, damage modeling



\## 15. Success Criteria

\- \[ ] Runs from single HTML file without errors

\- \[ ] Canvas is 960×540 with letterboxing on resize

\- \[ ] Controls visible on menu AND during gameplay

\- \[ ] Player car supports free 360° driving with a distinct drift mode (reduced lateral friction)

\- \[ ] Input feels instant (same-frame acknowledgment for throttle/steer/drift/denied drift)

\- \[ ] Near-misses trigger slow-mo + ring + floating bonus text and add score

\- \[ ] Waves run 25s with an 8s upgrade break showing 3 upgrade choices

\- \[ ] Score increases over time and via near-miss/drift combo; score feedback “pops”

\- \[ ] High score persists across sessions via localStorage key `oversteer\_highscore\_v1`

\- \[ ] Pause/resume works (P/Esc and mobile gesture) and freezes gameplay

\- \[ ] Death feels impactful (freeze + slow-mo + shatter + shake + desaturate)

\- \[ ] Collision feels fair (forgiving circles + drift shrink) and is readable

\- \[ ] Something moves during idle (player glow, dust motes, subtle background motion)

\- \[ ] Enemies obey the same movement constraints as the player (free movement + turning limits), avoiding asymmetry

