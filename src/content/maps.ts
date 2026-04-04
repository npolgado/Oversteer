// maps.ts — Map re-exports and difficulty modifier definitions.
// Values from arena-drifter/game.js:378-397 (source of truth).

import { MAPS, CFG } from '@core/config';
export { MAPS };

export interface DifficultyModifier {
  id: string;
  key: string;         // keyboard key label
  label: string;
  desc: string;
  scoreMult: number;
  /** Mutates CFG and/or returns player stat overrides to apply at game start. */
  apply(opts: { speedBonusRef: { value: number }; playerMults: { scoreMult: number; maxHp?: number; hp?: number } }): void;
}

export const DIFFICULTY_MODIFIERS: DifficultyModifier[] = [
  {
    id: 'hard_mode', key: '1', label: 'HARD MODE',
    desc: 'Enemies +100 speed bonus, 1.5× score',
    scoreMult: 1.5,
    apply({ speedBonusRef, playerMults }) {
      speedBonusRef.value += 100;
      playerMults.scoreMult *= 1.5;
    },
  },
  {
    id: 'speed_rush', key: '2', label: 'SPEED RUSH',
    desc: 'Spawns 2× faster, 1.3× score',
    scoreMult: 1.3,
    apply({ playerMults }) {
      CFG.SPAWN_INTERVAL_INITIAL *= 0.5;
      CFG.SPAWN_INTERVAL_MIN *= 0.5;
      playerMults.scoreMult *= 1.3;
    },
  },
  {
    id: 'fragile', key: '3', label: 'FRAGILE',
    desc: '50 HP only, 1.4× score',
    scoreMult: 1.4,
    apply({ playerMults }) {
      playerMults.maxHp = 50;
      playerMults.hp = 50;
      playerMults.scoreMult *= 1.4;
    },
  },
  {
    id: 'double_enemies', key: '4', label: 'DOUBLE ENEMIES',
    desc: 'Spawns 2×, bursts 2×, 1.6× score',
    scoreMult: 1.6,
    apply({ playerMults }) {
      CFG.SPAWN_INTERVAL_INITIAL *= 0.5;
      CFG.SPAWN_INTERVAL_MIN *= 0.5;
      CFG.BURST_COUNT = 4;
      playerMults.scoreMult *= 1.6;
    },
  },
];

export const MODIFIER_BY_ID = new Map<string, DifficultyModifier>(
  DIFFICULTY_MODIFIERS.map(m => [m.id, m]),
);

export function computeModifierScoreMult(activeIds: string[]): number {
  return activeIds.reduce((acc, id) => {
    const mod = MODIFIER_BY_ID.get(id);
    return mod ? acc * mod.scoreMult : acc;
  }, 1);
}
