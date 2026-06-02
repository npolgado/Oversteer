import { describe, it, expect, vi } from 'vitest';
import { makeWaveState, startWave, isBossWave, getBossPattern } from '@gameplay/spawning/waveManager';
import { makePlayerState } from '@gameplay/player/playerState';
import { makeTrailState } from '@gameplay/trail/trailState';
import { BiomeManager } from '@gameplay/world/biomeManager';
import { makeScoringState } from '@gameplay/scoring';
import { applySituation, SITUATIONS_BY_ID, consumeDevPickup, consumeDevBossKilled } from '../situationTester';

function makeState() {
  return {
    waveState: makeWaveState(),
    playerState: makePlayerState(),
    trailState: makeTrailState(),
    biomeManager: new BiomeManager('wasteland'),
    scoringState: makeScoringState(0),
  };
}

describe('applySituation', () => {
  it('sets waveIndex so startWave() lands on spec.wave', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, { wave: 10 });
    expect(waveState.waveIndex).toBe(9);
    startWave(waveState);
    expect(waveState.waveIndex).toBe(10);
  });

  it('activates boss on a boss wave after startWave()', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, { wave: 5 });
    startWave(waveState);
    expect(isBossWave(waveState.waveIndex)).toBe(true);
    expect(waveState.bossActive).toBe(true);
    expect(waveState.bossPattern).toBe(getBossPattern(5));
  });

  it('non-boss wave does not activate boss', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, { wave: 8 });
    startWave(waveState);
    expect(waveState.bossActive).toBe(false);
  });

  it('auto-derives biome from wave when not specified', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, { wave: 10 });
    expect(biomeManager.active.id).toBe('rupture');
  });

  it('explicit biome override beats auto-derive', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, { wave: 10, biome: 'jungle' });
    expect(biomeManager.active.id).toBe('jungle');
  });

  it('applies upgrades to player and pushes ids', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    const originalSpeed = playerState.maxSpeed;
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, { wave: 1, upgrades: ['turbo'] });
    expect(playerState.maxSpeed).toBeGreaterThan(originalSpeed);
    expect(playerState.upgrades).toContain('turbo');
  });

  it('wider_trail sets trailState.closeDist to 60', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, { wave: 1, upgrades: ['wider_trail'] });
    expect(trailState.closeDist).toBe(60);
  });

  it('trail_echo sets trailState.maxPoints to 600', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, { wave: 1, upgrades: ['trail_echo'] });
    expect(trailState.maxPoints).toBe(600);
  });

  it('speed_demon adds 40 to waveState.speedBonus', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    const base = waveState.speedBonus;
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, { wave: 1, upgrades: ['speed_demon'] });
    expect(waveState.speedBonus).toBe(base + 40);
  });

  it('skips unknown upgrade ids with a console.warn', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, { wave: 1, upgrades: ['nonexistent'] });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
    expect(playerState.upgrades).not.toContain('nonexistent');
    warnSpy.mockRestore();
  });

  it('hp override is clamped to maxHp', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, { wave: 1, hp: 99999 });
    expect(playerState.hp).toBe(playerState.maxHp);
  });

  it('hp=1 sets player to 1 HP', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, { wave: 1, hp: 1 });
    expect(playerState.hp).toBe(1);
  });

  it('maxHp override also clamps existing hp', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    const originalHp = playerState.hp; // default full HP
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, { wave: 1, maxHp: originalHp - 20 });
    expect(playerState.maxHp).toBe(originalHp - 20);
    expect(playerState.hp).toBeLessThanOrEqual(playerState.maxHp);
  });

  // ── New primitives ──────────────────────────────────────────────────────────

  it('scrap seeds playerState.scrapBank', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, { wave: 1, scrap: 300 });
    expect(playerState.scrapBank).toBe(300);
  });

  it('score sets scoringState.score directly', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, { wave: 1, score: 4000 });
    expect(scoringState.score).toBe(4000);
  });

  it('combo sets comboLevel on both playerState and scoringState', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, { wave: 1, combo: 7 });
    expect(playerState.comboLevel).toBe(7);
    expect(scoringState.comboLevel).toBe(7);
  });

  it('enemySpawnBias is reflected in biomeManager.effectiveWeightMult', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, {
      wave: 1,
      biome: 'wasteland',
      enemySpawnBias: { splitter: 5 },
    });
    expect(biomeManager.effectiveWeightMult.splitter).toBe(5);
  });

  it('enemySpawnBias multiplies on top of active biome weights', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    // Rupture already has flanker: 1.8 — bias should multiply
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, {
      wave: 10,
      biome: 'rupture',
      enemySpawnBias: { flanker: 2 },
    });
    expect(biomeManager.effectiveWeightMult.flanker).toBeCloseTo(1.8 * 2);
  });

  it('effectiveWeightMult returns stable reference when nothing changed', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, { wave: 1, biome: 'wasteland' });
    const ref1 = biomeManager.effectiveWeightMult;
    const ref2 = biomeManager.effectiveWeightMult;
    expect(ref1).toBe(ref2);
  });

  it('forcePickup — consumeDevPickup returns forced type then null', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, { wave: 1, forcePickup: 'time_slow' });
    expect(consumeDevPickup()).toBe('time_slow');
    expect(consumeDevPickup()).toBeNull(); // consumed
  });

  it('bossDefeated — consumeDevBossKilled returns true then false', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, { wave: 6, bossDefeated: true });
    expect(consumeDevBossKilled()).toBe(true);
    expect(consumeDevBossKilled()).toBe(false); // consumed
  });

  it('no forcePickup — consumeDevPickup returns null', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    applySituation(waveState, playerState, biomeManager, trailState, scoringState, { wave: 1 });
    expect(consumeDevPickup()).toBeNull();
  });
});

describe('SITUATIONS_BY_ID preset catalog', () => {
  it('contains all expected Phase 4 presets', () => {
    const expected = [
      'boss-pursuer-w5',
      'boss-core-w10',
      'boss-reflector-w15',
      'boss-core-w10-loaded',
      'biome-jungle-fresh',
      'splitter-stress-w8',
      'boss-pursuer-w5-fragile',
    ];
    for (const id of expected) {
      expect(SITUATIONS_BY_ID.has(id), `missing preset: ${id}`).toBe(true);
    }
  });

  it('contains all Phase 1–3 presets', () => {
    const expected = [
      'fresh-start',
      'trail-loop-practice',
      'combo-master-decay',
      'combo-heal-milestones',
      'scoring-multiplier-stack',
      'wallride-drift',
      'interceptor-predict',
      'drifter-feel',
      'blocker-trail-contest',
      'flanker-fight',
      'bomber-hazard-test',
      'elite-stress',
      'near-miss-streak',
      'defense-full-stack',
      'dash-burst-test',
      'trail-burn-test',
      'chain-lightning-test',
      'horde-incoming',
      'speed-demon-tradeoff',
      'scrap-magnet-test',
      'endgame-chaos',
    ];
    for (const id of expected) {
      expect(SITUATIONS_BY_ID.has(id), `missing preset: ${id}`).toBe(true);
    }
  });

  it('contains all Phase 4 presets', () => {
    const expected = [
      'pickup-time-slow',
      'pickup-trail-token',
      'pickup-shield',
      'shop-flush',
      'shop-broke',
      'biome-wasteland',
      'biome-rupture',
      'bias-rupture-loaded',
      'bias-jungle-loaded',
      'splitter-unlock',
      'boss-reward-test',
      'combo-cyan',
      'combo-magenta',
    ];
    for (const id of expected) {
      expect(SITUATIONS_BY_ID.has(id), `missing preset: ${id}`).toBe(true);
    }
  });

  it('boss-core-w10-loaded has 4 upgrades', () => {
    const spec = SITUATIONS_BY_ID.get('boss-core-w10-loaded');
    expect(spec?.upgrades?.length).toBe(4);
  });

  it('shop-flush has enough scrap to afford any shop item', () => {
    const spec = SITUATIONS_BY_ID.get('shop-flush');
    expect((spec as { scrap?: number }).scrap).toBeGreaterThanOrEqual(12); // Score Surge costs most at 12
  });

  it('splitter-unlock has score at or above splitter threshold', () => {
    const spec = SITUATIONS_BY_ID.get('splitter-unlock');
    expect((spec as { score?: number }).score).toBeGreaterThanOrEqual(3500);
  });

  it('combo-cyan has combo=4', () => {
    const spec = SITUATIONS_BY_ID.get('combo-cyan');
    expect((spec as { combo?: number }).combo).toBe(4);
  });

  it('combo-magenta has combo=7', () => {
    const spec = SITUATIONS_BY_ID.get('combo-magenta');
    expect((spec as { combo?: number }).combo).toBe(7);
  });
});
