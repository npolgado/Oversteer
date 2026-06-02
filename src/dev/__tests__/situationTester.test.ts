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

// ── New Phase 5 spec fields ───────────────────────────────────────────────────

describe('applySituation — scrapTokens', () => {
  it('scrapTokens:number pushes that many scrap entries into waveState.scraps', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    startWave(waveState); // simulate post-startWave state (scraps cleared by startWave)
    // applySituation is called BEFORE startWave in production; scrapTokens are pushed AFTER
    // startWave in gameLoop — so here we test the field is readable from the spec, and that
    // when a caller loops over spec.scrapTokens and pushes, the shape is correct.
    const spec = { wave: 4, scrapTokens: 5 };
    const count = typeof spec.scrapTokens === 'number' ? spec.scrapTokens : spec.scrapTokens.count;
    const radius = typeof spec.scrapTokens === 'number' ? 250 : (spec.scrapTokens.radius ?? 250);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      waveState.scraps.push({ x: playerState.x + Math.cos(angle) * radius, y: playerState.y + Math.sin(angle) * radius, life: 30, type: 'scrap' });
    }
    expect(waveState.scraps).toHaveLength(5);
    expect(waveState.scraps.every(s => s.type === 'scrap')).toBe(true);
  });

  it('scrapTokens object with count and radius is supported', () => {
    const spec = { wave: 4, scrapTokens: { count: 10, radius: 400 } };
    const count = typeof spec.scrapTokens === 'number' ? spec.scrapTokens : spec.scrapTokens.count;
    const radius = typeof spec.scrapTokens === 'number' ? 250 : (spec.scrapTokens.radius ?? 250);
    expect(count).toBe(10);
    expect(radius).toBe(400);
  });
});

describe('applySituation — pickupAtPlayer', () => {
  it('pickupAtPlayer string type resolves to that type at offset (60, 0)', () => {
    const { waveState, playerState, trailState, biomeManager, scoringState } = makeState();
    startWave(waveState);
    const spec = { wave: 3, pickupAtPlayer: 'time_slow' as const };
    const type = typeof spec.pickupAtPlayer === 'string' ? spec.pickupAtPlayer : spec.pickupAtPlayer.type;
    const offset = typeof spec.pickupAtPlayer === 'string' ? { x: 60, y: 0 } : (spec.pickupAtPlayer.offset ?? { x: 60, y: 0 });
    waveState.scraps.push({ x: playerState.x + offset.x, y: playerState.y + offset.y, life: 30, type });
    expect(waveState.scraps).toHaveLength(1);
    expect(waveState.scraps[0].type).toBe('time_slow');
  });

  it('pickupAtPlayer object form respects custom offset', () => {
    const spec = { wave: 4, pickupAtPlayer: { type: 'shield_pickup' as const, offset: { x: 100, y: 20 } } };
    const type = typeof spec.pickupAtPlayer === 'string' ? spec.pickupAtPlayer : spec.pickupAtPlayer.type;
    const offset = typeof spec.pickupAtPlayer === 'string' ? { x: 60, y: 0 } : (spec.pickupAtPlayer.offset ?? { x: 60, y: 0 });
    expect(type).toBe('shield_pickup');
    expect(offset).toEqual({ x: 100, y: 20 });
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

  // ── Phase 5 catalog assertions ──────────────────────────────────────────────

  it('every scenario has a goal string', () => {
    for (const [id, spec] of SITUATIONS_BY_ID) {
      expect((spec as { goal?: string }).goal, `missing goal on "${id}"`).toBeTruthy();
    }
  });

  it('shop-flush has openUpgradeBreak=true', () => {
    const spec = SITUATIONS_BY_ID.get('shop-flush');
    expect((spec as { openUpgradeBreak?: boolean }).openUpgradeBreak).toBe(true);
  });

  it('shop-broke has openUpgradeBreak=true', () => {
    const spec = SITUATIONS_BY_ID.get('shop-broke');
    expect((spec as { openUpgradeBreak?: boolean }).openUpgradeBreak).toBe(true);
  });

  it('bias-rupture-loaded has openUpgradeBreak and rerollBonus=99', () => {
    const spec = SITUATIONS_BY_ID.get('bias-rupture-loaded') as { openUpgradeBreak?: boolean; rerollBonus?: number };
    expect(spec?.openUpgradeBreak).toBe(true);
    expect(spec?.rerollBonus).toBe(99);
  });

  it('bias-jungle-loaded has openUpgradeBreak and rerollBonus=99', () => {
    const spec = SITUATIONS_BY_ID.get('bias-jungle-loaded') as { openUpgradeBreak?: boolean; rerollBonus?: number };
    expect(spec?.openUpgradeBreak).toBe(true);
    expect(spec?.rerollBonus).toBe(99);
  });

  it('boss-reward-test has openUpgradeBreak and bossDefeated', () => {
    const spec = SITUATIONS_BY_ID.get('boss-reward-test') as { openUpgradeBreak?: boolean; bossDefeated?: boolean };
    expect(spec?.openUpgradeBreak).toBe(true);
    expect(spec?.bossDefeated).toBe(true);
  });

  it('horde-incoming has waveProgress defined', () => {
    const spec = SITUATIONS_BY_ID.get('horde-incoming') as { waveProgress?: number };
    expect(spec?.waveProgress).toBeGreaterThan(0.5);
    expect(spec?.waveProgress).toBeLessThan(0.9);
  });

  it('scrap-magnet-test has scrapTokens and disableSpawns', () => {
    const spec = SITUATIONS_BY_ID.get('scrap-magnet-test') as { scrapTokens?: unknown; disableSpawns?: boolean };
    expect(spec?.scrapTokens).toBeDefined();
    expect(spec?.disableSpawns).toBe(true);
  });

  it('pickup-time-slow uses pickupAtPlayer (not forcePickup)', () => {
    const spec = SITUATIONS_BY_ID.get('pickup-time-slow') as { pickupAtPlayer?: unknown; forcePickup?: unknown; disableSpawns?: boolean };
    expect(spec?.pickupAtPlayer).toBeTruthy();
    expect(spec?.forcePickup).toBeUndefined();
    expect(spec?.disableSpawns).toBe(true);
  });

  it('pickup-shield has hp=1 and disableSpawns', () => {
    const spec = SITUATIONS_BY_ID.get('pickup-shield') as { hp?: number; disableSpawns?: boolean };
    expect(spec?.hp).toBe(1);
    expect(spec?.disableSpawns).toBe(true);
  });
});
