// upgradeRegistry.ts — All 26 upgrade definitions.
// Values ported from arena-drifter/waves.js:563-617 (source of truth).

import type { PlayerState } from '@gameplay/player/playerState';

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  iconSprite?: string;
  stackable: boolean;
  apply(player: PlayerState): void;
}

// Stackable upgrade IDs (from game.js:407)
export const STACKABLE_IDS = new Set(['shield', 'hp_regen', 'max_hp', 'damage_resist', 'extra_rerolls']);

export const UPGRADE_REGISTRY: UpgradeDef[] = [
  {
    id: 'turbo', name: 'Turbo Engine', desc: '+15% top speed', icon: '▶▶', stackable: false,
    apply(p) { p.maxSpeed *= 1.15; },
  },
  {
    id: 'tight_turns', name: 'Tight Turns', desc: '+25% turn rate', icon: '↺', stackable: false,
    // NOTE: original sets tightTurns=true; turnRate multiplier handled in playerUpdate
    apply(p) { p.tightTurns = true; },
  },
  {
    id: 'drift_king', name: 'Drift King', desc: 'Drift boost +50%, drift friction reduced', icon: '∞', stackable: false,
    apply(p) { p.driftKing = true; },
  },
  {
    id: 'shield', name: 'Crash Shield', desc: 'Absorbs one collision', icon: '◉', stackable: true,
    apply(p) { p.shield = true; },
  },
  {
    id: 'magnet', name: 'Magnetic Field', desc: 'Auto-collect scraps at range', icon: '⊙', stackable: false,
    apply(p) { p.magnetRange = 150; },
  },
  {
    id: 'score_freak', name: 'Score Freak', desc: 'Score multiplier x1.5', icon: '★', stackable: false,
    apply(p) { p.scoreMult *= 1.5; },
  },
  {
    id: 'ghost_frame', name: 'Ghost Frame', desc: '0.3s invuln after near-miss', icon: '◈', stackable: false,
    // NOTE: actual timer set in processNearMiss via applyGhostFrameNearMiss
    apply(p) { p.ghostFrame = true; },
  },
  {
    id: 'thick_plating', name: 'Thick Plating', desc: 'Collision radius -3px', icon: '▣', stackable: false,
    // NOTE: radius reduction applied in getPlayerRadius() via thickPlating flag
    apply(p) { p.thickPlating = true; },
  },
  {
    id: 'afterburner', name: 'Afterburner', desc: 'Drift boost doubled', icon: '🔥', stackable: false,
    apply(p) { p.afterburner = true; },
  },
  {
    id: 'combo_master', name: 'Combo Master', desc: 'Combo decays 50% slower', icon: '◆', stackable: false,
    apply(p) { p.comboMaster = true; },
  },
  {
    id: 'speed_demon', name: 'Speed Demon', desc: '+20% speed, enemies +10% speed', icon: '⚡', stackable: false,
    apply(p) { p.speedDemon = true; p.maxSpeed *= 1.20; },
  },
  {
    id: 'wider_trail', name: 'Wider Trail', desc: 'Loop detection radius +50%', icon: '⬟', stackable: false,
    // NOTE: mutates TrailState.closeDist=60; handled in gameplayScene after apply
    apply(_p) { /* handled in gameplayScene */ },
  },
  {
    id: 'trail_echo', name: 'Trail Echo', desc: 'Trail lasts 50% longer', icon: '≋', stackable: false,
    // NOTE: mutates TrailState.maxPoints=600; handled in gameplayScene after apply
    apply(_p) { /* handled in gameplayScene */ },
  },
  {
    id: 'encircle_bonus', name: 'Encircle Bonus', desc: '+50% score from encirclement', icon: '◯', stackable: false,
    apply(p) { p.encircleScoreBonus = (p.encircleScoreBonus || 1) * 1.5; },
  },
  {
    id: 'hp_regen', name: 'Auto Repair', desc: 'Regenerate 3 HP/sec after 2s', icon: '✚', stackable: true,
    apply(p) { p.hpRegen += 3; },
  },
  {
    id: 'max_hp', name: 'Reinforced Frame', desc: '+30 max HP (heals +30)', icon: '♥', stackable: true,
    apply(p) { p.maxHp += 30; p.hp += 30; },
  },
  {
    id: 'damage_resist', name: 'Armor Plating', desc: 'Take 25% less damage', icon: '⬡', stackable: true,
    apply(p) { p.damageResist = 1 - (1 - p.damageResist) * 0.75; },
  },
  {
    id: 'drift_shield', name: 'Drift Shield', desc: '-40% damage while drifting', icon: '◷', stackable: false,
    apply(p) { p.driftShield = true; },
  },
  {
    id: 'combo_heal', name: 'Combo Medic', desc: 'Heal 10/15/25 HP at combo milestones 3, 5, 8', icon: '✦', stackable: false,
    apply(p) { p.comboHeal = true; },
  },
  {
    id: 'trail_magnet', name: 'Trail Magnet', desc: 'Trail points attract scraps', icon: '⬤', stackable: false,
    apply(p) { p.trailMagnet = true; },
  },
  {
    id: 'speed_trail', name: 'Speed Trail', desc: 'Trail grows with speed', icon: '≈', stackable: false,
    apply(p) { p.speedTrail = true; },
  },
  {
    id: 'dash_burst', name: 'Dash Burst', desc: 'Tap brake at speed for invuln dash (3s cd)', icon: '»', stackable: false,
    apply(p) { p.dashBurst = true; },
  },
  {
    id: 'trail_burn', name: 'Trail Burn', desc: 'Trail damages enemies that touch it', icon: '〜', stackable: false,
    apply(p) { p.trailBurn = true; },
  },
  {
    id: 'chain_lightning', name: 'Chain Lightning', desc: 'Loop kills chain to 1 nearby enemy', icon: '⚡⚡', stackable: false,
    apply(p) { p.chainLightning = true; },
  },
  {
    id: 'extra_rerolls', name: 'Lucky Dice', desc: '+2 rerolls per break', icon: '↻', stackable: true,
    // NOTE: reroll count calculated from player.upgrades count; no player mutation needed
    apply(_p) { /* handled in getRerollCount */ },
  },
  {
    id: 'nitro_drift', name: 'Nitro Drift', desc: '+30% speed while drifting', icon: '◀◀', stackable: false,
    apply(p) { p.nitroDrift = true; },
  },
];

export const UPGRADE_BY_ID = new Map<string, UpgradeDef>(
  UPGRADE_REGISTRY.map(u => [u.id, u]),
);
