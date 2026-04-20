import { describe, it, expect } from 'vitest';
import { getDeathParticles } from '../enemyDeathFx';
import type { EnemyDeathEvent } from '../enemyDeathFx';

function makeEvent(type: EnemyDeathEvent['type'], isElite = false): EnemyDeathEvent {
  return { type, x: 100, y: 200, isElite };
}

describe('getDeathParticles', () => {
  it('chaser returns red sparks', () => {
    const reqs = getDeathParticles(makeEvent('chaser'));
    expect(reqs.length).toBeGreaterThan(0);
    const spark = reqs.find(r => r.type === 'spark');
    expect(spark).toBeDefined();
    expect(spark!.color).toBe(0xFF4444);
    expect(spark!.count).toBe(12);
  });

  it('interceptor returns blue sparks and a pulse ring', () => {
    const reqs = getDeathParticles(makeEvent('interceptor'));
    expect(reqs.some(r => r.type === 'spark' && r.color === 0x4488FF)).toBe(true);
    expect(reqs.some(r => r.type === 'ring' && r.pulse === true)).toBe(true);
  });

  it('drifter returns smoke and shards', () => {
    const reqs = getDeathParticles(makeEvent('drifter'));
    expect(reqs.some(r => r.type === 'smoke')).toBe(true);
    expect(reqs.some(r => r.type === 'shard')).toBe(true);
  });

  it('elite returns gold shards and white sparks', () => {
    const reqs = getDeathParticles(makeEvent('elite'));
    expect(reqs.some(r => r.type === 'shard' && r.color === 0xFFD700)).toBe(true);
    expect(reqs.some(r => r.type === 'spark' && r.color === 0xFFFFFF)).toBe(true);
  });

  it('bomber returns red shards and orange smoke', () => {
    const reqs = getDeathParticles(makeEvent('bomber'));
    expect(reqs.some(r => r.type === 'shard' && r.color === 0xFF2222)).toBe(true);
    expect(reqs.some(r => r.type === 'smoke' && r.color === 0xFF6600)).toBe(true);
  });

  it('all 7 enemy types return at least one request without throwing', () => {
    const types: EnemyDeathEvent['type'][] = [
      'chaser', 'interceptor', 'drifter', 'elite', 'blocker', 'flanker', 'bomber',
    ];
    for (const type of types) {
      const reqs = getDeathParticles(makeEvent(type));
      expect(reqs.length).toBeGreaterThan(0);
    }
  });
});
