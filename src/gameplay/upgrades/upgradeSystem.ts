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
 */
export function buildUpgradeOffer(
  player: PlayerState,
  rng: () => number = Math.random,
): UpgradeDef[] {
  const extraRerollCount = player.upgrades.filter(u => u === 'extra_rerolls').length;

  const pool = UPGRADE_REGISTRY.filter(u => {
    if (!STACKABLE_IDS.has(u.id) && player.upgrades.includes(u.id)) return false;
    if (u.id === 'extra_rerolls' && extraRerollCount >= 2) return false;
    return true;
  });

  return randSample(pool, CFG.UPGRADES_TO_OFFER, rng);
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

function randSample<T>(arr: T[], n: number, rng: () => number): T[] {
  const copy = arr.slice();
  const result: T[] = [];
  const count = Math.min(n, copy.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * (copy.length - i));
    result.push(copy[idx]);
    copy[idx] = copy[copy.length - 1 - i];
  }
  return result;
}
