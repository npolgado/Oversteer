// endgameAfk.probe.test.ts — Does a *realistically geared* idle player survive endgame by AFK?
//
// The plain afk survival curve is measured on a zero-upgrade player, which understates a real wave-N
// player (~1 card upgrade per wave, regen + speed prioritized, entering at full HP). This probe seeds
// that loadout and asks the real question behind 4.9's DMG_SCALE raise: can you just AFK at endgame?
// The guard asserts NO — a geared idle player still dies — so AFK is not a viable endgame strategy.
// NOTE: not in original — Phase 4.9 sim harness.

import { describe, it, expect } from 'vitest';
import { runSim, buildRealisticLoadout } from '../simRunner';
import { afk } from '../policies';
import { eventsOfType } from '../trace';
import { makePlayerState } from '@gameplay/player/playerState';
import { makeRng } from '@core/rng';

const FPS = 60;
const DT = 1 / FPS;
const WINDOW_S = 120;

function measure(wave: number, geared: boolean): { died: boolean; timeToDeath: number | null; hits: number; endHp: number } {
  const trace = runSim({
    seed: 99, policy: afk, frames: WINDOW_S * FPS, dt: DT,
    startAtWave: wave, ...(geared ? { upgradesForWave: wave } : {}),
  });
  const died = trace.died;
  const timeToDeath = died ? (trace.samples.at(-1)?.t ?? null) : null;
  const hits = eventsOfType(trace, 'playerDamaged').length;
  const endHp = trace.samples.at(-1)?.hp ?? 0;
  return { died, timeToDeath, hits, endHp };
}

describe('probe: geared-player endgame AFK survivability', () => {
  // Only the GEARED loadout is measured — a zero-upgrade player can't reach wave 20+, so a 0-upgrade
  // endgame number would be fiction, not a baseline. The "loadout is regen + speed heavy" test below
  // confirms the loadout wiring actually changes the player (maxHp 100→460, 3× regen).
  for (const wave of [20, 25, 30]) {
    it(`wave ${wave}: geared AFK survivability`, () => {
      const geared = measure(wave, true);
      // eslint-disable-next-line no-console
      console.log(`[endgame-afk w${wave}] geared: died=${geared.died} ` +
        `ttd=${geared.timeToDeath?.toFixed(1) ?? '-'}s hits=${geared.hits} endHp=${geared.endHp.toFixed(0)}`);
    });
  }

  it('GUARD: a fully geared idle player still dies at endgame (wave 30, AFK is not viable)', () => {
    const geared = measure(30, true);
    // eslint-disable-next-line no-console
    console.log(`[endgame-afk-guard w30] died=${geared.died} ttd=${geared.timeToDeath?.toFixed(1) ?? '-'}s ` +
      `hits=${geared.hits} endHp=${geared.endHp.toFixed(0)}`);
    // If this ever fails (geared AFK survives 120s), endgame is AFK-trivializable even geared —
    // that is the real balance finding and the cue to raise DMG_SCALE / cap regen effectiveness.
    expect(geared.died).toBe(true);
  });

  it('the modeled wave-30 loadout is regen + speed heavy (assumption check)', () => {
    const p = makePlayerState();
    const ids = buildRealisticLoadout(p, 30, makeRng((99 ^ 0x9e3779b9) >>> 0).next);
    const hpRegen = ids.filter(i => i === 'hp_regen').length;
    const hasSpeed = ids.includes('turbo') || ids.includes('speed_demon');
    // eslint-disable-next-line no-console
    console.log(`[loadout w30] n=${ids.length} hp_regen×${hpRegen} speed=${hasSpeed} maxHp=${p.maxHp} regen=${p.hpRegen}/s`);
    expect(hpRegen).toBe(3);          // hp_regen caps at 3 stacks (15 HP/s)
    expect(hasSpeed).toBe(true);       // a speed pick was taken
    expect(p.maxHp).toBeGreaterThan(100);
  });
});
