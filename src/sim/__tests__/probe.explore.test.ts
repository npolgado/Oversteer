// probe.explore.test.ts — EXPLORATORY: point the sim at live 4.9 combat and look for issues.
// These are diagnostic probes (they log observations) plus hard invariants that should hold on any
// healthy build. A failing invariant here is a found bug. NOTE: not in original — Phase 4.9 sim harness.

import { describe, it, expect } from 'vitest';
import { runSim } from '../simRunner';
import { afk, cruise } from '../policies';
import { eventsOfType, hasNonFiniteState } from '../trace';

const FPS = 60;
const DT = 1 / FPS;

function summarize(label: string, trace: ReturnType<typeof runSim>) {
  const kills = eventsOfType(trace, 'enemyKilled').length;
  const maxEnemies = Math.max(0, ...trace.samples.map(s => s.enemyCount));
  const firstEnemyFrame = trace.samples.findIndex(s => s.enemyCount > 0);
  const dmg = eventsOfType(trace, 'playerDamaged');
  const firstDmgT = dmg.length ? dmg[0].t : null;
  const endT = trace.samples.at(-1)?.t ?? 0;
  // eslint-disable-next-line no-console
  console.log(`[${label}] frames=${trace.frames} endT=${endT.toFixed(1)}s ` +
    `died=${trace.died} broke=${trace.brokeToUpgrade} error=${trace.error?.message ?? '-'} ` +
    `maxEnemies=${maxEnemies} firstEnemyFrame=${firstEnemyFrame} ` +
    `firstDmg=${firstDmgT == null ? '-' : firstDmgT.toFixed(1) + 's'} ` +
    `damagedEvents=${dmg.length} kills=${kills} finalScore=${Math.round(trace.finalScore)}`);
}

describe('probe: normal-wave combat sanity', () => {
  it('wave 1, afk, spawns on — enemies appear and the run does not blow up', () => {
    const trace = runSim({ seed: 11, policy: afk, frames: 40 * FPS, dt: DT });
    summarize('afk-w1', trace);
    expect(trace.error).toBeUndefined();
    expect(hasNonFiniteState(trace)).toBe(false);
    const maxEnemies = Math.max(0, ...trace.samples.map(s => s.enemyCount));
    expect(maxEnemies).toBeGreaterThan(0);          // spawns actually happen (no instant-empty wave)
  });

  it('wave 1 does not end instantly (regression guard for the wave-end race)', () => {
    const trace = runSim({ seed: 5, policy: afk, frames: 5 * FPS, dt: DT });
    summarize('race-w1', trace);
    // Within the first 5s the wave must NOT have ended (combat duration is ~30s).
    expect(trace.brokeToUpgrade).toBe(false);
  });
});

describe('probe: damage scaling across waves (afk time-to-first-damage & death)', () => {
  for (const wave of [1, 5, 10, 20, 30]) {
    it(`wave ${wave}: afk survivability`, () => {
      const trace = runSim({ seed: 99, policy: afk, frames: 60 * FPS, dt: DT, startAtWave: wave });
      summarize(`afk-w${wave}`, trace);
      expect(trace.error).toBeUndefined();
      expect(hasNonFiniteState(trace)).toBe(false);
    });
  }
});

describe('probe: boss wave engagement', () => {
  it('wave 5 (boss), afk — does a boss spawn and does anything threaten an idle player?', () => {
    const trace = runSim({ seed: 5, policy: afk, frames: 90 * FPS, dt: DT, startAtWave: 5 });
    const bossSeen = trace.samples.some(s => s.enemyCount > 0);
    const dmg = eventsOfType(trace, 'playerDamaged');
    summarize('afk-boss-w5', trace);
    // eslint-disable-next-line no-console
    console.log(`[afk-boss-w5] anyEnemyPresent=${bossSeen} damagedEvents=${dmg.length} died=${trace.died}`);
    expect(trace.error).toBeUndefined();
  });
});

describe('probe: cruise across biomes (hazard + movement stress)', () => {
  for (const biome of ['wasteland', 'rupture', 'jungle'] as const) {
    it(`cruise ${biome} 30s — no non-finite state, no crash`, () => {
      const trace = runSim({ seed: 3, policy: cruise, frames: 30 * FPS, dt: DT, biomeId: biome, startAtWave: biome === 'jungle' ? 15 : 1 });
      summarize(`cruise-${biome}`, trace);
      expect(trace.error).toBeUndefined();
      expect(hasNonFiniteState(trace)).toBe(false);
    });
  }
});
