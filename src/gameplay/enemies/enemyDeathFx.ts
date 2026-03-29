// enemyDeathFx.ts — Death event type and particle request stubs.
// No side effects — callers dispatch events from the returned requests.

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
  color: string;
}

export function getDeathParticles(event: EnemyDeathEvent): ParticleSpawnRequest[] {
  const color = event.type === 'interceptor' ? '#4444ff' : '#ff4444';
  return [{ x: event.x, y: event.y, type: 'shard', count: 6, color }];
}
