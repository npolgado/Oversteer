// runProgression.test.ts — Tests for RunProgression class (route branching).

import { describe, it, expect } from 'vitest';
import { RunProgression, biomeForWave, isBiomeTransition, accrueScrap } from '../runProgression';

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

describe('accrueScrap', () => {
  it('mult 1 always grants exactly 1 with no carry', () => {
    let carry = 0;
    for (let i = 0; i < 4; i++) {
      const r = accrueScrap(carry, 1);
      expect(r.grant).toBe(1);
      expect(r.carry).toBeCloseTo(0);
      carry = r.carry;
    }
  });

  it('mult 1.5 produces alternating grants of 1 and 2 (2 pickups = 3 scrap)', () => {
    let carry = 0;
    const grants: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = accrueScrap(carry, 1.5);
      grants.push(r.grant);
      carry = r.carry;
    }
    expect(grants).toEqual([1, 2, 1, 2]);
    expect(grants.reduce((a, b) => a + b, 0)).toBe(6); // 4 pickups = 6 scrap at ×1.5
  });

  it('mult 2 always grants exactly 2 with no carry', () => {
    let carry = 0;
    for (let i = 0; i < 3; i++) {
      const r = accrueScrap(carry, 2);
      expect(r.grant).toBe(2);
      expect(r.carry).toBeCloseTo(0);
      carry = r.carry;
    }
  });

  it('carry is always less than 1 after each call', () => {
    const mults = [1, 1.25, 1.5, 1.75, 2];
    for (const mult of mults) {
      let carry = 0;
      for (let i = 0; i < 6; i++) {
        const r = accrueScrap(carry, mult);
        expect(r.carry).toBeGreaterThanOrEqual(0);
        expect(r.carry).toBeLessThan(1);
        carry = r.carry;
      }
    }
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
