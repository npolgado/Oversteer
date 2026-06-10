import { describe, it, expect } from 'vitest';
import { buildUpgradeOffer, applyUpgrade, getRerollCount } from '../upgradeSystem';
import { UPGRADE_REGISTRY, UPGRADE_BY_ID } from '../upgradeRegistry';
import { makePlayerState } from '@gameplay/player/playerState';
import { CFG } from '@core/config';

function makePlayer() {
  return makePlayerState();
}

describe('buildUpgradeOffer', () => {
  it('returns up to UPGRADES_TO_OFFER cards', () => {
    const player = makePlayer();
    const offer = buildUpgradeOffer(player);
    expect(offer.length).toBe(CFG.UPGRADES_TO_OFFER);
  });

  it('excludes non-stackable upgrades already owned', () => {
    const player = makePlayer();
    player.upgrades = ['turbo'];
    const offer = buildUpgradeOffer(player);
    expect(offer.every(u => u.id !== 'turbo')).toBe(true);
  });

  it('includes stackable upgrades already owned', () => {
    const player = makePlayer();
    // Give player hp_regen once — it should still appear in offers
    player.upgrades = ['hp_regen'];
    const seededRng = (() => {
      let i = 0;
      return () => (i++ % 2) * 0.5;
    })();
    // Run many times to confirm hp_regen can still be offered
    let found = false;
    for (let t = 0; t < 50 && !found; t++) {
      const offer = buildUpgradeOffer(player);
      if (offer.some(u => u.id === 'hp_regen')) found = true;
    }
    expect(found).toBe(true);
  });

  it('caps extra_rerolls at 2 stacks', () => {
    const player = makePlayer();
    player.upgrades = ['extra_rerolls', 'extra_rerolls'];
    // Run many times to confirm extra_rerolls never appears
    for (let t = 0; t < 50; t++) {
      const offer = buildUpgradeOffer(player);
      expect(offer.every(u => u.id !== 'extra_rerolls')).toBe(true);
    }
  });

  it('allows extra_rerolls when stacks < 2', () => {
    const player = makePlayer();
    player.upgrades = ['extra_rerolls'];
    let found = false;
    for (let t = 0; t < 100 && !found; t++) {
      const offer = buildUpgradeOffer(player);
      if (offer.some(u => u.id === 'extra_rerolls')) found = true;
    }
    expect(found).toBe(true);
  });
});

describe('upgradeBias weighting', () => {
  it('heavily biased upgrade appears more often than unbiased peers', () => {
    const player = makePlayer();
    const TRIALS = 300;
    const counts: Record<string, number> = {};
    for (let t = 0; t < TRIALS; t++) {
      for (const u of buildUpgradeOffer(player, { turbo: 10 })) {
        counts[u.id] = (counts[u.id] ?? 0) + 1;
      }
    }
    // turbo (weight 10) should appear far more than an unbiased peer (weight 1)
    const turboRate = (counts['turbo'] ?? 0) / TRIALS;
    const magRate = (counts['magnet'] ?? 0) / TRIALS;
    expect(turboRate).toBeGreaterThan(magRate * 1.5);
  });

  it('Wasteland upgradeBias (turbo:2, nitro_drift:2, speed_demon:1.5, drift_king:1.5) favors speed upgrades', () => {
    const player = makePlayer();
    const TRIALS = 300;
    const speedIds = new Set(['turbo', 'nitro_drift', 'speed_demon', 'drift_king']);
    const counts: Record<string, number> = {};
    const bias = { turbo: 2, nitro_drift: 2, speed_demon: 1.5, drift_king: 1.5 };
    for (let t = 0; t < TRIALS; t++) {
      for (const u of buildUpgradeOffer(player, bias)) {
        counts[u.id] = (counts[u.id] ?? 0) + 1;
      }
    }
    const totalSlots = TRIALS * CFG.UPGRADES_TO_OFFER;
    const speedCount = Object.entries(counts)
      .filter(([id]) => speedIds.has(id))
      .reduce((sum, [, n]) => sum + n, 0);
    // Unbiased: 4 speed upgrades out of 26 total = ~15.4%.
    // With bias (turbo/nitro_drift ×2, speed_demon/drift_king ×1.5), expect ≥ 1.3× the unbiased rate.
    const unbiasedRate = 4 / 26;
    const actualRate = speedCount / totalSlots;
    expect(actualRate).toBeGreaterThan(unbiasedRate * 1.3);
  });

  it('empty bias produces uniform-like selection (no bias key has weight)', () => {
    const player = makePlayer();
    const offer = buildUpgradeOffer(player, {});
    expect(offer.length).toBe(CFG.UPGRADES_TO_OFFER);
  });

  it('bias does not bypass the non-stackable exclusion filter', () => {
    const player = makePlayer();
    player.upgrades = ['turbo'];
    for (let t = 0; t < 50; t++) {
      const offer = buildUpgradeOffer(player, { turbo: 999 });
      expect(offer.every(u => u.id !== 'turbo')).toBe(true);
    }
  });
});

describe('applyUpgrade', () => {
  it('turbo increases maxSpeed by 15%', () => {
    const player = makePlayer();
    const before = player.maxSpeed;
    applyUpgrade(player, UPGRADE_BY_ID.get('turbo')!);
    expect(player.maxSpeed).toBeCloseTo(before * 1.15);
    expect(player.upgrades).toContain('turbo');
  });

  it('max_hp increases both maxHp and hp by 30', () => {
    const player = makePlayer();
    const hpBefore = player.hp;
    const maxBefore = player.maxHp;
    applyUpgrade(player, UPGRADE_BY_ID.get('max_hp')!);
    expect(player.maxHp).toBe(maxBefore + 30);
    expect(player.hp).toBe(hpBefore + 30);
  });

  it('damage_resist applies diminishing returns on second stack', () => {
    const player = makePlayer();
    applyUpgrade(player, UPGRADE_BY_ID.get('damage_resist')!);
    const after1 = player.damageResist;
    expect(after1).toBeCloseTo(0.25); // 1 - (1-0)*0.75 = 0.25
    applyUpgrade(player, UPGRADE_BY_ID.get('damage_resist')!);
    const after2 = player.damageResist;
    expect(after2).toBeCloseTo(1 - (1 - after1) * 0.75); // diminishing
    expect(after2).toBeGreaterThan(after1);
    expect(after2).toBeLessThan(1);
  });

  it('score_freak multiplies scoreMult by 1.5', () => {
    const player = makePlayer();
    applyUpgrade(player, UPGRADE_BY_ID.get('score_freak')!);
    expect(player.scoreMult).toBeCloseTo(1.5);
  });

  it('speed_demon sets flag and increases maxSpeed', () => {
    const player = makePlayer();
    const before = player.maxSpeed;
    applyUpgrade(player, UPGRADE_BY_ID.get('speed_demon')!);
    expect(player.speedDemon).toBe(true);
    expect(player.maxSpeed).toBeCloseTo(before * 1.20);
  });

  it('ghost_frame sets ghostFrame flag', () => {
    const player = makePlayer();
    applyUpgrade(player, UPGRADE_BY_ID.get('ghost_frame')!);
    expect(player.ghostFrame).toBe(true);
  });
});

describe('getRerollCount', () => {
  it('returns REROLL_MAX when no extra_rerolls', () => {
    const player = makePlayer();
    expect(getRerollCount(player)).toBe(CFG.REROLL_MAX);
  });

  it('adds 2 per extra_rerolls stack', () => {
    const player = makePlayer();
    player.upgrades = ['extra_rerolls'];
    expect(getRerollCount(player)).toBe(CFG.REROLL_MAX + 2);

    player.upgrades = ['extra_rerolls', 'extra_rerolls'];
    expect(getRerollCount(player)).toBe(CFG.REROLL_MAX + 4);
  });
});

describe('UPGRADE_REGISTRY', () => {
  it('has exactly 26 upgrades', () => {
    expect(UPGRADE_REGISTRY.length).toBe(26);
  });

  it('all entries have required fields', () => {
    for (const u of UPGRADE_REGISTRY) {
      expect(u.id).toBeTruthy();
      expect(u.name).toBeTruthy();
      expect(u.icon).toBeTruthy();
      expect(typeof u.apply).toBe('function');
    }
  });

  it('UPGRADE_BY_ID contains all registry entries', () => {
    for (const u of UPGRADE_REGISTRY) {
      expect(UPGRADE_BY_ID.get(u.id)).toBe(u);
    }
  });
});
