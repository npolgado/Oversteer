// runProgression.test.ts — Tests for RunProgression class (route branching).

import { describe, it, expect } from 'vitest';
import { RunProgression, biomeForWave, isBiomeTransition } from '../runProgression';

describe('RunProgression — default schedule matches pure helper', () => {
  it('biomeForWave is consistent with the pure helper by default', () => {
    const rp = new RunProgression();
    for (let w = 1; w <= 20; w++) {
      expect(rp.biomeForWave(w)).toBe(biomeForWave(w));
    }
  });

  it('isTransition matches isBiomeTransition', () => {
    const rp = new RunProgression();
    [1, 7, 8, 14, 15, 20].forEach(w => {
      expect(rp.isTransition(w)).toBe(isBiomeTransition(w));
    });
  });
});

describe('RunProgression — pendingChoice', () => {
  it('pendingChoice returns [rupture, jungle] at wave 8 (default, unchosen)', () => {
    const rp = new RunProgression();
    expect(rp.pendingChoice(8)).toEqual(['rupture', 'jungle']);
  });

  it('pendingChoice returns null at other waves', () => {
    const rp = new RunProgression();
    [1, 5, 7, 9, 14, 15, 20].forEach(w => {
      expect(rp.pendingChoice(w)).toBeNull();
    });
  });

  it('pendingChoice returns null at wave 8 after a choice is made', () => {
    const rp = new RunProgression();
    rp.choose('rupture');
    expect(rp.pendingChoice(8)).toBeNull();
  });
});

describe('RunProgression — choose rupture', () => {
  it('biomeForWave(8-14) returns rupture after choosing rupture', () => {
    const rp = new RunProgression();
    rp.choose('rupture');
    for (let w = 8; w <= 14; w++) {
      expect(rp.biomeForWave(w)).toBe('rupture');
    }
  });

  it('biomeForWave(15+) returns jungle (the other biome) after choosing rupture', () => {
    const rp = new RunProgression();
    rp.choose('rupture');
    expect(rp.biomeForWave(15)).toBe('jungle');
    expect(rp.biomeForWave(20)).toBe('jungle');
  });

  it('rewardMult is 1 when rupture is chosen (normal path)', () => {
    const rp = new RunProgression();
    rp.choose('rupture');
    expect(rp.rewardMult).toBe(1);
  });
});

describe('RunProgression — choose jungle early (risk-reward)', () => {
  it('biomeForWave(8-14) returns jungle after choosing jungle', () => {
    const rp = new RunProgression();
    rp.choose('jungle');
    for (let w = 8; w <= 14; w++) {
      expect(rp.biomeForWave(w)).toBe('jungle');
    }
  });

  it('biomeForWave(15+) returns rupture after choosing jungle', () => {
    const rp = new RunProgression();
    rp.choose('jungle');
    expect(rp.biomeForWave(15)).toBe('rupture');
  });

  it('rewardMult is 1.5 when jungle is chosen early', () => {
    const rp = new RunProgression();
    rp.choose('jungle');
    expect(rp.rewardMult).toBe(1.5);
  });

  it('rewardMult resets to 1 after resetRewardMult()', () => {
    const rp = new RunProgression();
    rp.choose('jungle');
    rp.resetRewardMult();
    expect(rp.rewardMult).toBe(1);
  });
});

describe('RunProgression — choose is idempotent', () => {
  it('calling choose() twice does not change the first selection', () => {
    const rp = new RunProgression();
    rp.choose('jungle');
    rp.choose('rupture'); // ignored
    expect(rp.biomeForWave(8)).toBe('jungle');
  });
});

describe('RunProgression — reset', () => {
  it('reset clears choice and rewardMult', () => {
    const rp = new RunProgression();
    rp.choose('jungle');
    rp.reset();
    expect(rp.biomeForWave(8)).toBe('rupture'); // back to default
    expect(rp.rewardMult).toBe(1);
    expect(rp.pendingChoice(8)).toEqual(['rupture', 'jungle']); // choice available again
  });
});
