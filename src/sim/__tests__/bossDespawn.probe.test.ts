// bossDespawn.probe.test.ts — REGRESSION GUARD (was a bug reproduction on 4.9).
//
// Bug (now fixed): enemyUpdate() applied the generic despawn checks (age >= lifespan, offscreen
// timeout, dist(player) > ENEMY_FAR_DESPAWN_DIST) to the BOSS. updateWave() then read ANY
// boss-absence after spawn as `bossKilled: true`. Net effect: driving away from a boss (or waiting
// out its lifespan) despawned it and ended the wave as a *victory* — "BOSS DEFEATED! +REROLL" — with
// no fight. Fixed in enemyUpdate.ts by exempting `type === 'boss'` from the generic despawn checks:
// a boss now leaves the field only via death (HP depletion / encirclement).
//
// This guard drives straight away from a wave-5 boss and asserts the wave does NOT self-complete as a
// boss victory. NOTE: not in original — Phase 4.9 sim harness (regression guard).

import { describe, it, expect } from 'vitest';
import { runSim } from '../simRunner';
import { cruise } from '../policies';
import { eventsOfType } from '../trace';

const FPS = 60;

describe('GUARD: a boss cannot be "defeated" by abandonment', () => {
  it('driving away from a wave-5 boss does NOT end the wave as a boss victory', () => {
    // Window (40s) is below wave-5 combat duration (70s), so a normal-timer wave-end cannot fire here;
    // the only way the wave could end as a victory is the (now-fixed) boss-despawn path.
    const trace = runSim({ seed: 5, policy: cruise, frames: 40 * FPS, dt: 1 / FPS, startAtWave: 5 });

    const bossDefeated = eventsOfType(trace, 'eventLog')
      .some(e => typeof (e.data as { text?: string }).text === 'string' &&
        (e.data as { text: string }).text.includes('BOSS DEFEATED'));
    const kills = eventsOfType(trace, 'enemyKilled').length;
    const encircles = eventsOfType(trace, 'encirclement').length;
    const maxEnemies = Math.max(0, ...trace.samples.map(s => s.enemyCount));
    const endT = trace.samples.at(-1)?.t ?? 0;

    // eslint-disable-next-line no-console
    console.log(`[boss-abandon-guard] endT=${endT.toFixed(1)}s broke=${trace.brokeToUpgrade} ` +
      `bossDefeatedBanner=${bossDefeated} kills=${kills} encircles=${encircles} maxEnemies=${maxEnemies}`);

    // The scenario is real: a boss wave actually spawned enemies to abandon.
    expect(maxEnemies).toBeGreaterThan(0);
    // The player did nothing offensive.
    expect(kills).toBe(0);
    expect(encircles).toBe(0);
    // The fix: abandonment must NOT produce a boss victory.
    expect(bossDefeated).toBe(false);
    expect(trace.brokeToUpgrade).toBe(false);
  });
});
