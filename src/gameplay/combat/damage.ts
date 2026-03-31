// damage.ts — Player hit processing: shield absorb, damage pipeline, knockback.

import { CFG } from '@core/config';
import type { PlayerState } from '@gameplay/player/playerState';
import type { EnemyState } from '@gameplay/enemies/enemyState';
import { computeCollisionDamage, applyPlayerDamage, applyShieldBreak } from '@gameplay/pureLogic';
import { applyKnockback } from './collision';

export interface DamageResult {
  type: 'hit' | 'shield_break' | 'blocked';
  finalDamage: number;
  knockbackDir: { x: number; y: number };
}

function getDmgForType(type: string): number {
  switch (type) {
    case 'chaser':      return CFG.DMG_CHASER;
    case 'interceptor': return CFG.DMG_INTERCEPTOR;
    case 'drifter':     return CFG.DMG_DRIFTER;
    case 'elite':       return CFG.DMG_ELITE;
    case 'blocker':     return CFG.DMG_BLOCKER;
    case 'flanker':     return CFG.DMG_FLANKER;
    case 'bomber':      return CFG.DMG_BOMBER;
    default:            return CFG.DMG_CHASER;
  }
}

export function processPlayerHit(
  player: PlayerState,
  enemy: EnemyState,
  waveIndex: number,
): DamageResult {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const d = Math.hypot(dx, dy) || 1;
  const knockbackDir = { x: dx / d, y: dy / d };

  // Blocked by invuln — shouldn't reach here given collision check, but safety net
  if (player.invulnTimer > 0) {
    return { type: 'blocked', finalDamage: 0, knockbackDir };
  }

  const baseDmg = getDmgForType(enemy.type);
  const scaledDmg = computeCollisionDamage(baseDmg, waveIndex);

  // Shield absorb: no HP damage, longer invuln, harder knockback
  if (player.shield) {
    applyShieldBreak(player); // sets shield=false, invulnTimer=CFG.SHIELD_INVULN (1.0)
    applyKnockback(player, enemy, CFG.SHIELD_KNOCKBACK); // 140
    return { type: 'shield_break', finalDamage: 0, knockbackDir };
  }

  // Normal hit — applyPlayerDamage handles damageResist, driftShield, invulnTimer, lastHitTimer
  const finalDmg = applyPlayerDamage(player, scaledDmg, player.drifting);
  applyKnockback(player, enemy, CFG.HIT_KNOCKBACK); // 120
  return { type: 'hit', finalDamage: finalDmg, knockbackDir };
}
