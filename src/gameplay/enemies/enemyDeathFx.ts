// enemyDeathFx.ts — Per-enemy-type death particle requests.
// No side effects — callers dispatch the returned requests.
// Colors sourced from arena-drifter/entities.js enemyDeathFX().

import type { EnemyType } from './enemyState';

export interface EnemyDeathEvent {
  type: EnemyType;
  x: number;
  y: number;
  isElite: boolean;
}

export interface ParticleSpawnRequest {
  x: number;
  y: number;
  type: 'shard' | 'smoke' | 'ring' | 'spark';
  count: number;
  color: number;   // 0xRRGGBB — matches ParticleSystem.spawn() signature
  vMin?: number;   // symmetric velocity range — spawner applies ±vMin..vMax
  vMax?: number;
  gravity?: number;
  pulse?: boolean; // true → addPulseRing (40px) instead of addRing (150px)
}

export function getDeathParticles(event: EnemyDeathEvent): ParticleSpawnRequest[] {
  const { x, y, type } = event;

  switch (type) {
    case 'chaser':
      return [
        { x, y, type: 'spark', count: 12, color: 0xFF4444, vMin: -250, vMax: 250, gravity: 300 },
      ];

    case 'interceptor':
      return [
        { x, y, type: 'spark', count: 10, color: 0x4488FF, vMin: -220, vMax: 220 },
        { x, y, type: 'ring',  count: 1,  color: 0x4488FF, pulse: true },
      ];

    case 'drifter':
      return [
        { x, y, type: 'smoke', count: 8,  color: 0x888888 },
        { x, y, type: 'shard', count: 4,  color: 0x333333, vMin: -150, vMax: 150 },
      ];

    case 'flanker':
      return [
        { x, y, type: 'spark', count: 14, color: 0xFF8800, vMin: -250, vMax: 250 },
      ];

    case 'blocker':
      return [
        { x, y, type: 'shard', count: 10, color: 0x88FF88, vMin: -180, vMax: 180, gravity: 80 },
      ];

    case 'bomber':
      return [
        { x, y, type: 'shard', count: 12, color: 0xFF2222, vMin: -200, vMax: 200 },
        { x, y, type: 'smoke', count: 6,  color: 0xFF6600 },
      ];

    case 'elite':
      return [
        { x, y, type: 'shard', count: 16, color: 0xFFD700, vMin: -300, vMax: 300 },
        { x, y, type: 'spark', count: 10, color: 0xFFFFFF, vMin: -250, vMax: 250 },
        { x, y, type: 'ring',  count: 1,  color: 0xFFD700 },
      ];
  }
}
