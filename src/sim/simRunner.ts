// simRunner.ts — Headless driver: assembles a WorldState + no-op WorldEffects and steps the
// real stepWorld() pipeline for N frames under a scripted input policy, recording a SimTrace.
// Because it drives the same stepWorld() the live game uses, sim behavior can't drift from shipped.
// NOTE: not in original — Phase 4.9 sim harness.

import { CFG, applyMap } from '@core/config';
import { makeRng } from '@core/rng';
import { eventBus, type GameEvents } from '@core/eventBus';
import { makePlayerState } from '@gameplay/player/playerState';
import { makeTrailState } from '@gameplay/trail/trailState';
import { makePropsState } from '@gameplay/world/propsSystem';
import { makeWaveState, startWave } from '@gameplay/spawning/waveManager';
import { makeScoringState } from '@gameplay/scoring';
import { buildUpgradeOffer, applyUpgrade } from '@gameplay/upgrades/upgradeSystem';
import type { PlayerState } from '@gameplay/player/playerState';
import { makeBiomeHazardState, updateBiomeHazards } from '@gameplay/world/biomeHazards';
import { BiomeManager } from '@gameplay/world/biomeManager';
import { RunProgression } from '@gameplay/world/runProgression';
import { stepWorld, type WorldState, type WorldEffects } from '@gameplay/stepWorld';
import type { Policy } from './policies';
import type { MetricSample, SimTrace, TraceEvent } from './trace';

export interface SimOptions {
  seed: number;
  policy: Policy;
  frames: number;
  /** Fixed timestep in seconds (default 1/60). Constant → deterministic, no time dilation. */
  dt?: number;
  mapId?: string;
  /** Start the run already in this wave's combat phase (default 1). */
  startAtWave?: number;
  /** Suppress enemy spawns entirely (spawnTimer → Infinity). Default false. */
  disableSpawns?: boolean;
  biomeId?: 'wasteland' | 'rupture' | 'jungle';
  /**
   * Seed the player with a realistic accumulated loadout of ~1 card upgrade per wave, regen + speed
   * prioritized (then defense), and enter at full HP — modeling a geared endgame player rather than a
   * base-stat one. Uses the real buildUpgradeOffer/applyUpgrade path. Deterministic per seed.
   */
  upgradesForWave?: number;
}

/**
 * Bias map encoding the stated player behavior: pick regen + speed first, then defense.
 * wider_trail / trail_echo are excluded (weight 0) — they require a TrailState mutation the caller
 * normally performs and are not survival-relevant, so they must not be auto-picked here.
 */
const LOADOUT_BIAS: Record<string, number> = {
  hp_regen: 5, turbo: 4, speed_demon: 4, nitro_drift: 3,
  max_hp: 3, damage_resist: 3, drift_shield: 2, shield: 2, combo_heal: 2, ghost_frame: 2,
  wider_trail: 0, trail_echo: 0,
};

/**
 * Build and apply a realistic loadout: for each of `waves` breaks, offer 3 cards (real weighted offer,
 * respecting stack caps and non-stackable exclusion) and apply the highest-bias card on offer — the
 * choice a survival-minded player makes. Returns the applied upgrade ids. Mutates `player`.
 */
export function buildRealisticLoadout(player: PlayerState, waves: number, rng: () => number): string[] {
  for (let w = 0; w < waves; w++) {
    const offer = buildUpgradeOffer(player, LOADOUT_BIAS, rng);
    if (offer.length === 0) break;
    let best = offer[0];
    let bestW = LOADOUT_BIAS[best.id] ?? 1;
    for (const u of offer) {
      const uw = LOADOUT_BIAS[u.id] ?? 1;
      if (uw > bestW) { best = u; bestW = uw; }
    }
    applyUpgrade(player, best);
  }
  return [...player.upgrades];
}

// Events recorded into the trace (headless-safe gameplay signals; FX-only events are skipped).
const RECORDED_EVENTS: (keyof GameEvents)[] = [
  'enemyKilled', 'nearMiss', 'scoreChanged', 'playerDamaged', 'playerDied',
  'waveStarted', 'waveEnded', 'encirclement', 'biomeChanged', 'eventLog',
];

export function runSim(opts: SimOptions): SimTrace {
  const dt = opts.dt ?? 1 / 60;
  applyMap(opts.mapId ?? 'arena');

  const rng = makeRng(opts.seed);

  // --- Build state ---
  const playerState = makePlayerState();
  playerState.x = CFG.WORLD_W / 2;
  playerState.y = CFG.WORLD_H / 2;
  const trailState = makeTrailState();
  const propsState = makePropsState(); // intentionally empty — deterministic isolation (no prop-gen rng)
  const waveState = makeWaveState();
  const scoringState = makeScoringState(0);
  const biomeHazardState = makeBiomeHazardState();
  const biomeManager = new BiomeManager(opts.biomeId ?? 'wasteland');
  const runProgression = new RunProgression();

  // Seed a realistic accumulated loadout (regen + speed first, then defense) and enter at full HP,
  // modeling a geared endgame player. Uses a separate rng stream so it doesn't perturb the tick rng.
  if (opts.upgradesForWave && opts.upgradesForWave > 0) {
    buildRealisticLoadout(playerState, opts.upgradesForWave, makeRng(opts.seed ^ 0x9e3779b9).next);
    playerState.hp = playerState.maxHp;
  }

  // Enter combat at the requested wave.
  const targetWave = opts.startAtWave ?? 1;
  for (let i = 0; i < targetWave; i++) startWave(waveState, rng.next);
  if (opts.disableSpawns) {
    // Clean-room: no enemies, and freeze pickup emitters so nothing but the mechanic under test moves score.
    waveState.spawnTimer = Number.POSITIVE_INFINITY;
    waveState.scrapTimer = Number.POSITIVE_INFINITY;
    waveState.boostZoneTimer = Number.POSITIVE_INFINITY;
  }

  const world: WorldState = {
    playerState, enemies: [], trailState, propsState, waveState, scoringState,
    biomeHazardState, biomeManager, runProgression,
    gameClock: 0,
    scrapCarry: 0,
    wasHandbraking: false,
    wasInBoostZone: false,
    trailScratch: [],
    pickupPlayerScratch: { x: 0, y: 0, radius: 0, magnetRange: 0, trailMagnet: false },
  };

  // --- Death tracker ---
  let died = false;

  // --- Headless biome-hazard application (mirrors biomeSystem.tick; uses the seeded rng) ---
  function tickBiomeHazards(hdt: number, p: typeof playerState): void {
    const rules = biomeManager.active.hazardRules;
    if (!rules || rules.kind === 'none') return;
    const result = updateBiomeHazards(biomeHazardState, rules, hdt, p.x, p.y, rng.next);
    if (result.burstDamage > 0 && p.invulnTimer <= 0 && p.ghostFrameTimer <= 0) {
      const dmg = Math.ceil(result.burstDamage * (1 - (p.damageResist ?? 0)));
      if (dmg > 0) {
        const prev = p.hp;
        p.hp = Math.max(0, p.hp - dmg);
        if (p.hp !== prev) { p.invulnTimer = CFG.HIT_INVULN; p.lastHitTimer = 0; }
        if (p.hp <= 0 && !died) died = true;
      }
    }
    if (result.inCorruption && p.invulnTimer <= 0 && p.ghostFrameTimer <= 0) {
      const dps = rules.dps ?? 0;
      if (dps > 0) {
        p.hp = Math.max(0, p.hp - dps * hdt * (1 - (p.damageResist ?? 0)));
        p.slowTimer = Math.max(p.slowTimer ?? 0, 0.1);
        p.slowStrength = 0.35;
        p.lastHitTimer = 0;
        if (p.hp <= 0 && !died) died = true;
      }
    }
  }

  let brokeToUpgrade = false;

  // --- No-op effects adapter (seeded rng + viewport AABB stub; every FX is a no-op) ---
  const noop = (): void => {};
  const fx: WorldEffects = {
    rng: rng.next,
    // Camera shows ~CFG.W×CFG.H centered on the player; approximate that as an AABB.
    isVisible: (x, y, pad = 0) =>
      Math.abs(x - playerState.x) <= CFG.W / 2 + pad && Math.abs(y - playerState.y) <= CFG.H / 2 + pad,
    spawn: noop, addSkid: noop, addRing: noop,
    flash: noop, shake: noop, slowmo: noop, zoom: noop,
    play: noop, stopEngine: noop, stopDrift: noop, setEngineSpeed: noop, setDriftIntensity: noop,
    showMilestoneBanner: noop, showWaveBanner: noop, eventLogAdd: noop, setHeadingMode: noop, setProps: noop,
    isDeathActive: () => died,
    triggerDeath: () => { died = true; },
    enterUpgradeBreak: () => { brokeToUpgrade = true; },
    applyBiomeTransition: noop,
    tickBiomeHazards,
    comboMilestone: noop,
    forcedPickupType: () => null,
    consumeBossKilled: () => false,
  };

  // --- Subscribe to the event bus (observation channel) ---
  const events: TraceEvent[] = [];
  let curFrame = 0;
  let curT = 0;
  const listeners: Array<() => void> = [];
  for (const name of RECORDED_EVENTS) {
    const handler = (data: GameEvents[typeof name]): void => {
      events.push({ frame: curFrame, t: curT, name, data });
    };
    eventBus.on(name, handler);
    listeners.push(() => eventBus.off(name, handler));
  }

  // --- Run loop ---
  const samples: MetricSample[] = [];
  const trace: SimTrace = {
    seed: opts.seed, dt, frames: 0, samples, events,
    finalScore: 0, died: false, brokeToUpgrade: false,
  };

  try {
    for (let frame = 0; frame < opts.frames; frame++) {
      curFrame = frame;
      curT = world.gameClock;
      const input = opts.policy({ world, frame, t: world.gameClock });

      world.gameClock += dt;
      stepWorld(world, fx, input, dt, dt);

      const p = playerState;
      samples.push({
        frame,
        t: world.gameClock,
        score: scoringState.score,
        hp: p.hp,
        combo: scoringState.comboLevel,
        enemyCount: world.enemies.length,
        px: p.x, py: p.y,
        speed: Math.hypot(p.vx, p.vy),
        drifting: p.drifting,
        driftTime: p.driftTime,
      });

      trace.frames = frame + 1;
      if (died) { trace.died = true; break; }
      if (brokeToUpgrade) { trace.brokeToUpgrade = true; break; }
    }
  } catch (e) {
    trace.error = { frame: curFrame, message: e instanceof Error ? e.message : String(e) };
  } finally {
    for (const off of listeners) off();
  }

  trace.finalScore = scoringState.score;
  return trace;
}
