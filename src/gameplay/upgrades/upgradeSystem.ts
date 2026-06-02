// upgradeSystem.ts — Upgrade offer building and application logic.

import { CFG } from '@core/config';
import type { PlayerState } from '@gameplay/player/playerState';
import {
  UPGRADE_REGISTRY,
  UPGRADE_BY_ID,
  STACKABLE_IDS,
  type UpgradeDef,
} from './upgradeRegistry';

/**
 * Build a random offer of up to CFG.UPGRADES_TO_OFFER upgrades.
 * Filters out non-stackable upgrades already owned, and caps extra_rerolls at 2.
 * Optional bias map multiplies selection weight per upgrade id (>1 = more likely).
 */
export function buildUpgradeOffer(
  player: PlayerState,
  bias: Record<string, number> = {},
  rng: () => number = Math.random,
): UpgradeDef[] {
  const extraRerollCount = player.upgrades.filter(u => u === 'extra_rerolls').length;

  const pool = UPGRADE_REGISTRY.filter(u => {
    if (!STACKABLE_IDS.has(u.id) && player.upgrades.includes(u.id)) return false;
    if (u.id === 'extra_rerolls' && extraRerollCount >= 2) return false;
    return true;
  });

  return weightedSample(pool, CFG.UPGRADES_TO_OFFER, bias, rng);
}

/**
 * Apply an upgrade to the player and record it in player.upgrades.
 * For wider_trail and trail_echo, the trail state must be updated by the caller.
 */
export function applyUpgrade(player: PlayerState, upgrade: UpgradeDef): void {
  upgrade.apply(player);
  player.upgrades.push(upgrade.id);
}

/**
 * Get total rerolls available for this break phase.
 * Base: CFG.REROLL_MAX (3). Each extra_rerolls stack adds 2.
 */
export function getRerollCount(player: PlayerState): number {
  const stacks = player.upgrades.filter(u => u === 'extra_rerolls').length;
  return CFG.REROLL_MAX + stacks * 2;
}

/** Look up an upgrade by ID (returns undefined if not found). */
export function getUpgradeById(id: string): UpgradeDef | undefined {
  return UPGRADE_BY_ID.get(id);
}

function weightedSample(
  arr: UpgradeDef[],
  n: number,
  bias: Record<string, number>,
  rng: () => number,
): UpgradeDef[] {
  const entries = arr.map(item => ({ item, w: Math.max(0, bias[item.id] ?? 1) }));
  const result: UpgradeDef[] = [];
  const count = Math.min(n, entries.length);
  for (let i = 0; i < count; i++) {
    let total = 0;
    for (let j = 0; j < entries.length; j++) total += entries[j].w;
    let r = rng() * total;
    let idx = 0;
    for (; idx < entries.length - 1; idx++) {
      r -= entries[idx].w;
      if (r <= 0) break;
    }
    result.push(entries[idx].item);
    entries.splice(idx, 1);
  }
  return result;
}
