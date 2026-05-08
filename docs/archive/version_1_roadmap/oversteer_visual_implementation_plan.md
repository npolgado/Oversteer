# OVERSTEER — Option B Implementation Plan

## Stack decision

Use this stack for the Option B version:

- **PixiJS v8** for primary 2D gameplay rendering and HUD
- **Three.js** for depth-heavy backgrounds, menu presentation, atmospheric layers, and selected 2.5D/3D effects
- **Howler.js** for all audio
- **GSAP** for UI transitions, upgrade card animation, and menu motion
- **Matter.js** or lightweight custom collision/movement logic depending on how arcade-like the handling should feel
- **Custom shaders / post-processing** for bloom, glow, fog, distortion, heat haze, and color grading

### Audio note

Yes — **Howler.js should be used in Option B**.

PixiJS and Three.js are rendering-focused. They do not replace a dedicated audio layer for game music, SFX, mixing, fades, engine loops, drift sounds, combo stings, or adaptive transitions. Use **Howler.js** for all of that.

---

## Development philosophy

Do not try to build the whole final game in one pass.

Build it in this order:

1. **core loop first**
2. **feel second**
3. **visual identity third**
4. **progression and content fourth**
5. **story/world expansion fifth**
6. **polish and retention systems last**

Each phase should leave you with a playable build.

---

## High-level game vision

### Core fantasy
A high-speed combat drift game where the player survives by **encircling enemies**, mastering momentum, and adapting builds across multiple hostile worlds.

### Pillars
- **Drift mastery**
- **Stylish encirclement kills**
- **Build-defining upgrades**
- **Distinct biomes/worlds**
- **Atmospheric audiovisual presentation**
- **Fast runs, high replayability**

### Structure
A run-based arcade progression game where:
- each run travels through multiple world environments
- each world introduces a new hazard language, enemy family, and upgrade bias
- between worlds, the player chooses upgrades, route branches, and risk/reward decisions

---

# Phased implementation plan

## Phase 0 — Technical foundation and project structure

### Goal
Set up a clean architecture so the project does not become spaghetti.

### Deliverable
A bootable project with rendering, scene management, audio system, input, and config.

### Tech
- Vite
- TypeScript
- PixiJS v8
- Three.js
- Howler.js
- GSAP

### AI generator brief
> Create a TypeScript browser game project using Vite. Use PixiJS v8 for gameplay rendering, Three.js for background scene rendering and cinematic/menu layers, Howler.js for audio, and GSAP for UI/menu transitions. Build a modular architecture with separate folders for core engine, scenes, entities, combat, rendering, audio, UI, content, and config.

### Required architecture
```text
src/
  core/
    game.ts
    sceneManager.ts
    eventBus.ts
    saveManager.ts
    rng.ts
    config.ts
  render/
    pixiApp.ts
    threeScene.ts
    postfx/
    shaders/
  audio/
    audioManager.ts
    musicManager.ts
    sfxManager.ts
  input/
    inputManager.ts
  gameplay/
    player/
    enemies/
    combat/
    upgrades/
    spawning/
    world/
  scenes/
    bootScene.ts
    menuScene.ts
    gameplayScene.ts
    upgradeScene.ts
    gameOverScene.ts
  ui/
    hud/
    menus/
    widgets/
  content/
    enemies/
    upgrades/
    worlds/
    storyline/
  assets/
```

### Must-have systems
- delta time game loop
- scene switching
- asset preloading
- keyboard + gamepad-ready input abstraction
- fixed update or semi-fixed update for gameplay
- separate render and gameplay layers
- game config JSON or TS config files

---

## Phase 1 — Minimal playable vertical slice

### Goal
Get the game playable and fun in a stripped-down form.

### Deliverable
A minimal game where:
- player drives
- enemies spawn
- enemies die when looped/encircled
- score increments
- one wave system works
- one temporary upgrade selection works
- one environment exists
- basic music and SFX work

### Scope
Keep this phase intentionally narrow.

### Features
- top-down drift car movement
- 1 enemy type
- 1 kill mechanic: circle enemy to destroy
- 1 world/arena
- 1 wave progression
- health
- score
- boost meter placeholder
- basic HUD
- pause menu
- death/game over screen

### Audio
Add Howler here for:
- engine loop
- drift/boost sound
- kill burst SFX
- UI click sounds
- one background music track

### AI generator brief
> Implement a minimal playable top-down arcade drift combat game using PixiJS v8 for gameplay rendering and Howler.js for audio. The player controls a vehicle with arcade drift movement. Enemies are destroyed when the player completes a circular encirclement around them. Add one enemy archetype, one world arena, a score system, wave progression, HUD, pause, and game over.

### Success criteria
- game is playable for 5–10 minutes
- loop kill is readable and satisfying
- no major frame hitches
- controls feel stable

---

## Phase 2 — Make the core loop feel amazing

### Goal
Turn the prototype into something satisfying.

### Deliverable
A fun-to-drive version with much better game feel.

### Features
- improved drift physics tuning
- tire grip/slip model
- camera follow smoothing
- dynamic FOV/zoom pulse at high speed
- drift trail rendering
- sparks, smoke, debris
- enemy hit flashes
- small camera shake
- slow-mo on major kills
- combo meter
- near-miss reward
- kill confirmation ring effect
- better enemy telegraphing

### Visual features
- bloom
- emissive trails
- additive particles
- fog layer
- soft shadow blobs
- heat distortion on boosts/explosions

### Audio improvements
- layered engine audio by speed
- drift squeal at slip threshold
- impact layering
- low-health music layer
- combo sting
- upgrade pick chime

### AI generator brief
> Focus only on game feel. Improve player movement, drift control, visual feedback, camera motion, particle effects, combo feedback, and layered audio. Do not add content breadth yet. Prioritize responsiveness, readability, impact, and satisfying feedback.

### Success criteria
- the first 30 seconds feel exciting
- kills feel rewarding
- player movement feels intentional, not floaty
- visuals support clarity, not clutter

---

## Phase 3 — World/biome system

### Goal
Create distinct level environments with unique identity.

### Deliverable
A reusable world framework plus 3 initial biomes.

### Recommended initial worlds

#### 1. Neon Wasteland
- synthwave sci-fi desert
- glowing cracks
- abandoned tech pylons
- heat haze
- balanced difficulty

#### 2. Frozen Rupture
- ice plains, blue fissures, snow fog
- lower traction zones
- crystal hazards
- cleaner visibility, slippery handling

#### 3. Corruption Jungle
- bioluminescent overgrowth
- spores, roots, pulsating enemy nests
- denser terrain, ambush behavior
- environmental hazards that spread

### World system requirements
Each world should define:
- background art layers
- lighting palette
- fog/post-processing settings
- tile/decal set
- obstacle set
- hazard rules
- enemy weighting
- music pack
- upgrade weighting bias
- boss style
- lore text snippets

### AI generator brief
> Create a modular biome/world system where each world can define visuals, hazards, enemy weights, lighting, fog, audio palette, and progression metadata. Implement three worlds: Neon Wasteland, Frozen Rupture, and Corruption Jungle.

### Success criteria
- worlds feel meaningfully different
- gameplay changes per world, not just visuals
- loading and switching worlds is clean

---

## Phase 4 — Upgrade system and buildcraft

### Goal
Make runs strategically interesting.

### Deliverable
A real upgrade ecosystem.

### Upgrade categories

#### Mobility
- tighter drift recovery
- wider encirclement radius
- boost recharge
- dash burst
- ghost phase through minor hazards

#### Offense
- shockwave on loop completion
- chain lightning to nearby enemies
- trail burn damage
- orbiting drone
- critical detonation on elite kill

#### Defense
- shield pulse
- heal on combo threshold
- damage reduction at high speed
- emergency evade
- hazard resistance

#### Utility
- pickup magnet
- minimap enhancement
- bonus score multiplier
- reroll upgrade choices
- enemy reveal pulse

### Meta design rules
- offer 3 choices between waves
- upgrades should stack visibly
- builds should change playstyle
- each upgrade needs clear rarity and synergy tags

### AI generator brief
> Implement a data-driven upgrade system with upgrade definitions in content files. Add categories, rarity, stack behavior, prerequisites, and synergy tags. Present three upgrade choices between rounds with animated cards and tooltips. Upgrades must alter gameplay in meaningful ways.

### Success criteria
- player can create distinct builds
- upgrades are understandable quickly
- visual/audio changes reinforce upgrades

---

## Phase 5 — Enemy roster and bosses

### Goal
Increase tactical depth and pacing variety.

### Deliverable
A diverse enemy ecosystem.

### Enemy archetypes
- **Chaser**: basic pursuit
- **Dasher**: bursts forward unpredictably
- **Mine-layer**: creates zone denial
- **Turret crawler**: fires from medium range
- **Leech**: drains boost or health
- **Shielded elite**: must be looped twice or stripped first
- **Swarm drones**: weak but create pressure

### Boss concepts
One per world:
- **Wasteland Colossus**: massive armored rig that drops mines
- **Cryo Serpent**: ice arcs, slippery trails, constriction attacks
- **Bloom Core**: stationary/transforming corruption heart spawning tendrils and swarms

### AI generator brief
> Expand enemy content with modular AI behaviors and boss encounters. Enemies should use composable behavior components like chase, evade, strafe, mine-drop, and summon. Bosses should have phase transitions, arena hazards, and cinematic intros.

### Success criteria
- enemy pressure escalates without chaos overload
- bosses feel memorable and readable
- world identity is reinforced by enemy families

---

## Phase 6 — Narrative and progression structure

### Goal
Add storyline without killing replayability.

### Deliverable
A lightweight run-based narrative system.

### Story structure recommendation
Do not make the game text-heavy.

Use:
- short mission intros
- between-world transmissions
- unlockable lore fragments
- boss dialogue stingers
- AI co-pilot commentary
- faction/world codex entries

### Core premise idea
You are a test pilot navigating unstable worlds created by a spreading phenomenon called **The Spiral** or **The Corruption**, where velocity and containment loops are the only known combat method against hostile emergent entities.

### Narrative devices
- command briefings before runs
- cryptic signals from worlds
- rival pilot echoes
- recovered telemetry logs
- world bosses tied to the corruption source
- endings based on chosen route/world order/upgrades

### AI generator brief
> Implement a lightweight narrative framework using short transmissions, lore unlocks, world intros, boss stingers, and end-of-run summaries. Keep gameplay primary. Narrative content should be data-driven and optional to revisit.

### Success criteria
- the player feels a larger world exists
- story supports atmosphere and motivation
- text never slows the pace too much

---

## Phase 7 — Meta progression and retention

### Goal
Make long-term replay rewarding.

### Deliverable
A meta loop outside individual runs.

### Systems
- persistent currency
- vehicle unlocks
- world unlocks
- permanent perk tree
- cosmetic skins
- difficulty modifiers
- challenge runs
- daily/seeded runs
- leaderboard-ready scoring model

### AI generator brief
> Add persistent progression, unlocks, cosmetic rewards, difficulty modifiers, and run history. Keep the run-based structure intact while supporting long-term progression.

---

## Phase 8 — Full audiovisual polish

### Goal
Push it toward premium presentation.

### Deliverable
A polished beta-quality presentation layer.

### Focus areas
- cinematic menu scenes with Three.js depth
- animated world previews
- weather FX
- stronger post-processing
- refined UI motion system
- accessibility settings
- controller vibration support if available
- performance optimization
- asset consistency pass
- sound mix pass
- music transitions by tension level

### AI generator brief
> Polish presentation, optimize rendering, improve shaders, refine menu scenes, add animated transitions, weather, accessibility, and quality settings. Focus on premium feel and consistency.

---

# Best order for content creation

Create in this order:
1. one perfect world
2. one perfect core loop
3. one solid upgrade system
4. a few excellent enemies
5. one great boss
6. then expand to more worlds

That is much better than building five shallow worlds immediately.

---

# Recommended first three worlds in more detail

## World 1 — Neon Wasteland
**Purpose:** onboarding world

**Visuals:**
- dark volcanic ground
- neon cracks and abandoned highway fragments
- drifting dust + heat haze
- magenta/cyan lighting accents

**Mechanics:**
- simple hazards
- basic enemy formations
- generous visibility

**Music:**
- synth pulse, moderate tempo

**Story:**
- first contact zone
- pilot training turned live crisis

## World 2 — Frozen Rupture
**Purpose:** handling variation

**Visuals:**
- ice flats
- blue fog
- refracted crystal formations
- reflected lighting

**Mechanics:**
- low-traction areas
- freezing zones
- delayed slide behavior

**Music:**
- cold, sparse, tense electronic ambience

**Story:**
- lost expedition zone
- telemetry ghosts from earlier pilots

## World 3 — Corruption Jungle
**Purpose:** stress test and escalation

**Visuals:**
- organic glow
- pulsing growth
- toxic mist
- denser occlusion and movement

**Mechanics:**
- spreading corruption zones
- nest spawners
- enemies that emerge from terrain

**Music:**
- percussive organic-electronic hybrid

**Story:**
- source-like infection region
- increasingly intelligent adversary

---

# Upgrade design recommendation

Make upgrades visually and mechanically tied to worlds.

For example:
- Neon Wasteland upgrades favor speed and chain reactions
- Frozen Rupture upgrades favor control and precision
- Corruption Jungle upgrades favor sustain, area denial, and infection mechanics

This makes world choice and upgrade choice feel connected.

---

# Strong suggestion for the first MVP roadmap

## MVP milestone 1
- Phase 0
- Phase 1
- Phase 2

This gives you:
- playable game
- strong feel
- enough polish to evaluate whether the loop is truly fun

## MVP milestone 2
- add one world from Phase 3
- add Phase 4 upgrades
- add 3–4 enemy archetypes

## MVP milestone 3
- add second and third worlds
- add boss fights
- add narrative wrapper

---

# Practical note on AI code generation

Give the coding AI **small, strict prompts**.

Bad:
> Build me a world-class game.

Good:
> Implement a reusable AudioManager using Howler.js with support for music layers, looped engine sound tied to speed, positional SFX categories, mute/music/SFX sliders, and fade transitions between scene states.

That will work much better.

---

# Starter brief to paste into an AI code generator

```text
Build a browser-based top-down arcade drift combat game in TypeScript using Vite.

Tech stack:
- PixiJS v8 for gameplay rendering and HUD
- Three.js for atmospheric background scenes, menu cinematics, and selected 2.5D visual depth
- Howler.js for music and sound effects
- GSAP for UI transitions and menu animations

Architecture goals:
- modular, scalable folder structure
- scene management
- fixed or semi-fixed gameplay update loop
- separate gameplay, rendering, UI, and content layers
- data-driven definitions for enemies, upgrades, and worlds

Phase 1 requirements:
- one playable arena/world
- top-down arcade car movement with drift
- enemy encirclement kill mechanic
- score, health, wave system, pause, game over
- basic HUD
- particle effects, trails, camera feedback
- audio: engine loop, drift, kill SFX, one music track

Design goals:
- highly polished sci-fi neon look
- readable gameplay first
- strong drift feel
- impactful visual and audio feedback
- maintainable codebase for future worlds, upgrades, bosses, and story
```

---

# Direct answer to the audio question

Yes:
- **use Howler.js in Option B**
- **Option B does not replace the need for an audio library**
- PixiJS/Three.js are rendering-focused, not a full audio gameplay stack
- Howler is a strong fit and should absolutely stay in the plan

