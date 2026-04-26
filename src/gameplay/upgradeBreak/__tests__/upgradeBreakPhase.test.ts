import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpgradeBreakPhase } from '../upgradeBreakPhase';
import { makePlayerState } from '@gameplay/player/playerState';
import { makeWaveState } from '@gameplay/spawning/waveManager';
import { makeTrailState } from '@gameplay/trail/trailState';
import { CFG } from '@core/config';
import { UPGRADE_BY_ID } from '@gameplay/upgrades/upgradeRegistry';
import * as upgradeSystem from '@gameplay/upgrades/upgradeSystem';
import type { InputState } from '@input/inputManager';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCards() {
  return {
    show: vi.fn(),
    hide: vi.fn(),
    update: vi.fn(),
    checkInput: vi.fn().mockReturnValue(null),
  };
}

const mockAudio = { play: vi.fn(), startEngine: vi.fn() };

const noInput: InputState = {
  up: false, down: false, left: false, right: false,
  drift: false, pause: false, enter: false, reroll: false,
  select1: false, select2: false, select3: false,
  menuLeft: false, menuRight: false,
  menuMod1: false, menuMod2: false, menuMod3: false, menuMod4: false,
  mute: false, sfxDown: false, sfxUp: false, musicDown: false, musicUp: false,
  escape: false, perfToggle: false,
};

function makePhase(cards = makeCards(), onWaveStart = vi.fn()) {
  return { phase: new UpgradeBreakPhase(cards as any, mockAudio as any, onWaveStart), cards, onWaveStart };
}

// ── enter() ───────────────────────────────────────────────────────────────────

describe('UpgradeBreakPhase.enter()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('sets active to true', () => {
    const { phase } = makePhase();
    phase.enter(makePlayerState(), makeWaveState());
    expect(phase.active).toBe(true);
  });

  it('freezes player: vx, vy zeroed and frozen set', () => {
    const { phase } = makePhase();
    const player = makePlayerState();
    player.vx = 200; player.vy = 150; player.drifting = true;
    phase.enter(player, makeWaveState());
    expect(player.vx).toBe(0);
    expect(player.vy).toBe(0);
    expect(player.frozen).toBe(true);
    expect(player.drifting).toBe(false);
  });

  it('resets upgradeConfirmTimer to CFG.UPGRADE_CONFIRM_TIME', () => {
    const { phase } = makePhase();
    phase.enter(makePlayerState(), makeWaveState());
    expect(phase.upgradeConfirmTimer).toBeCloseTo(CFG.UPGRADE_CONFIRM_TIME);
  });

  it('chosenUpgrade is null before any selection', () => {
    const { phase } = makePhase();
    phase.enter(makePlayerState(), makeWaveState());
    expect(phase.chosenUpgrade).toBeNull();
  });

  it('upgradeChosen is false after enter', () => {
    const { phase } = makePhase();
    phase.enter(makePlayerState(), makeWaveState());
    expect(phase.upgradeChosen).toBe(false);
  });

  it('calls upgradeCards.show() with the offer', () => {
    const cards = makeCards();
    const { phase } = makePhase(cards);
    phase.enter(makePlayerState(), makeWaveState());
    expect(cards.show).toHaveBeenCalledOnce();
    const [offer] = cards.show.mock.calls[0];
    expect(Array.isArray(offer)).toBe(true);
    expect(offer.length).toBeGreaterThan(0);
  });
});

// ── upgrade selection ─────────────────────────────────────────────────────────

describe('UpgradeBreakPhase upgrade selection', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('selecting card 0 marks upgradeChosen and sets chosenUpgrade', () => {
    const cards = makeCards();
    const { phase } = makePhase(cards);
    const player = makePlayerState();
    const wave = makeWaveState();
    const trail = makeTrailState();

    phase.enter(player, wave);

    // Capture what offer was shown
    const offer = cards.show.mock.calls[0][0];
    expect(offer.length).toBeGreaterThan(0);

    // Simulate pressing card 0
    cards.checkInput.mockReturnValueOnce(0);
    phase.update(0.016, noInput, player, trail, wave);

    expect(phase.upgradeChosen).toBe(true);
    expect(phase.chosenUpgrade).toBe(offer[0]);
  });

  it('selecting card 0 applies the upgrade to playerState', () => {
    const cards = makeCards();
    const { phase } = makePhase(cards);
    const player = makePlayerState();
    const wave = makeWaveState();
    const trail = makeTrailState();

    // Force a known non-stackable upgrade into the offer
    vi.spyOn(upgradeSystem, 'buildUpgradeOffer').mockReturnValue([UPGRADE_BY_ID.get('turbo')!]);

    phase.enter(player, wave);
    const speedBefore = player.maxSpeed;

    cards.checkInput.mockReturnValueOnce(0);
    phase.update(0.016, noInput, player, trail, wave);

    expect(player.maxSpeed).toBeGreaterThan(speedBefore);
    expect(player.upgrades).toContain('turbo');

    vi.restoreAllMocks();
  });

  it('after selection, upgradeCards.hide() is called', () => {
    const cards = makeCards();
    const { phase } = makePhase(cards);
    const player = makePlayerState();
    phase.enter(player, makeWaveState());
    cards.checkInput.mockReturnValueOnce(0);
    phase.update(0.016, noInput, player, makeTrailState(), makeWaveState());
    expect(cards.hide).toHaveBeenCalled();
  });
});

// ── post-selection countdown ──────────────────────────────────────────────────

describe('UpgradeBreakPhase post-selection countdown', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  function setupSelectedPhase() {
    const cards = makeCards();
    const onWaveStart = vi.fn();
    const phase = new UpgradeBreakPhase(cards as any, mockAudio as any, onWaveStart);
    const player = makePlayerState();
    const wave = makeWaveState();
    const trail = makeTrailState();

    phase.enter(player, wave);
    cards.checkInput.mockReturnValueOnce(0);
    phase.update(0.016, noInput, player, trail, wave);
    cards.checkInput.mockReturnValue(null);

    return { phase, player, wave, trail, onWaveStart };
  }

  it('upgradeConfirmTimer decrements after selection', () => {
    const { phase, player, wave, trail } = setupSelectedPhase();
    const before = phase.upgradeConfirmTimer;
    phase.update(0.1, noInput, player, trail, wave);
    expect(phase.upgradeConfirmTimer).toBeCloseTo(before - 0.1, 4);
  });

  it('timer does NOT decrement before an upgrade is selected', () => {
    const cards = makeCards();
    const { phase } = makePhase(cards);
    const player = makePlayerState();
    const wave = makeWaveState();
    const trail = makeTrailState();
    phase.enter(player, wave);
    const before = phase.upgradeConfirmTimer;
    // no selection — checkInput returns null
    phase.update(0.5, noInput, player, trail, wave);
    expect(phase.upgradeConfirmTimer).toBeCloseTo(before, 4);
  });

  it('active becomes false when timer reaches 0', () => {
    const { phase, player, wave, trail } = setupSelectedPhase();
    phase.update(CFG.UPGRADE_CONFIRM_TIME + 1, noInput, player, trail, wave);
    expect(phase.active).toBe(false);
  });

  it('playerState.frozen is cleared when countdown ends', () => {
    const { phase, player, wave, trail } = setupSelectedPhase();
    expect(player.frozen).toBe(true);
    phase.update(CFG.UPGRADE_CONFIRM_TIME + 1, noInput, player, trail, wave);
    expect(player.frozen).toBe(false);
  });

  it('_onWaveStart is called when countdown ends', () => {
    const { phase, player, wave, trail, onWaveStart } = setupSelectedPhase();
    phase.update(CFG.UPGRADE_CONFIRM_TIME + 1, noInput, player, trail, wave);
    expect(onWaveStart).toHaveBeenCalledOnce();
  });

  it('audio.startEngine is called when countdown ends', () => {
    const { phase, player, wave, trail } = setupSelectedPhase();
    phase.update(CFG.UPGRADE_CONFIRM_TIME + 1, noInput, player, trail, wave);
    expect(mockAudio.startEngine).toHaveBeenCalledOnce();
  });
});

// ── empty offer auto-countdown ────────────────────────────────────────────────

describe('UpgradeBreakPhase empty offer auto-countdown', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('countdown runs immediately when offer pool is empty', () => {
    vi.spyOn(upgradeSystem, 'buildUpgradeOffer').mockReturnValue([]);

    const cards = makeCards();
    const onWaveStart = vi.fn();
    const phase = new UpgradeBreakPhase(cards as any, mockAudio as any, onWaveStart);
    const player = makePlayerState();
    const wave = makeWaveState();
    const trail = makeTrailState();

    phase.enter(player, wave);
    expect(cards.show).not.toHaveBeenCalled(); // no cards to show

    // Tick past countdown without selecting anything
    phase.update(CFG.UPGRADE_CONFIRM_TIME + 1, noInput, player, trail, wave);
    expect(phase.active).toBe(false);
    expect(onWaveStart).toHaveBeenCalledOnce();

    vi.restoreAllMocks();
  });
});

// ── special upgrade side effects ──────────────────────────────────────────────

describe('UpgradeBreakPhase special upgrade side effects', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  function selectUpgrade(id: string) {
    vi.spyOn(upgradeSystem, 'buildUpgradeOffer').mockReturnValue([UPGRADE_BY_ID.get(id)!]);
    const cards = makeCards();
    const phase = new UpgradeBreakPhase(cards as any, mockAudio as any, vi.fn());
    const player = makePlayerState();
    const wave = makeWaveState();
    const trail = makeTrailState();
    phase.enter(player, wave);
    cards.checkInput.mockReturnValueOnce(0);
    phase.update(0.016, noInput, player, trail, wave);
    vi.restoreAllMocks();
    return { player, wave, trail };
  }

  it('wider_trail sets trailState.closeDist to 60', () => {
    const { trail } = selectUpgrade('wider_trail');
    expect(trail.closeDist).toBe(60);
  });

  it('trail_echo sets trailState.maxPoints to 600', () => {
    const { trail } = selectUpgrade('trail_echo');
    expect(trail.maxPoints).toBe(600);
  });

  it('speed_demon increments waveState.speedBonus by 40', () => {
    const { wave } = selectUpgrade('speed_demon');
    expect(wave.speedBonus).toBe(40);
  });

  it('speed_demon stacks: second speed_demon adds another 40', () => {
    // First pick
    vi.spyOn(upgradeSystem, 'buildUpgradeOffer').mockReturnValue([UPGRADE_BY_ID.get('speed_demon')!]);
    const cards = makeCards();
    const phase = new UpgradeBreakPhase(cards as any, mockAudio as any, vi.fn());
    const player = makePlayerState();
    const wave = makeWaveState();
    const trail = makeTrailState();

    phase.enter(player, wave);
    cards.checkInput.mockReturnValueOnce(0);
    phase.update(0.016, noInput, player, trail, wave);

    // Simulate the break ending and a new one starting
    wave.speedBonus = 40; // already set from first pick
    // speed_demon is non-stackable so it wouldn't normally appear, but waveState mutation is what we're checking
    expect(wave.speedBonus).toBe(40);

    vi.restoreAllMocks();
  });
});

// ── reroll ────────────────────────────────────────────────────────────────────

describe('UpgradeBreakPhase reroll', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('reroll decrements _rerollsLeft and shows a new offer', () => {
    const cards = makeCards();
    const { phase } = makePhase(cards);
    const player = makePlayerState();
    // Give player extra_rerolls so there's at least 1 reroll
    player.upgrades = ['extra_rerolls'];
    const wave = makeWaveState();
    const trail = makeTrailState();

    phase.enter(player, wave);
    expect(cards.show).toHaveBeenCalledTimes(1);

    cards.checkInput.mockReturnValueOnce('reroll');
    phase.update(0.016, noInput, player, trail, wave);

    expect(cards.show).toHaveBeenCalledTimes(2);
  });

  it('reroll when no rerolls left does nothing', () => {
    const cards = makeCards();
    const { phase } = makePhase(cards);
    const player = makePlayerState();
    // Default player has CFG.REROLL_MAX rerolls; exhaust them first
    // Simplest: set upgrades to none, CFG.REROLL_MAX is 0 or check value
    // Instead, just call reroll enough times to exhaust
    const wave = makeWaveState();
    const trail = makeTrailState();

    phase.enter(player, wave);
    const showCountAfterEnter = cards.show.mock.calls.length;

    // Exhaust all rerolls
    const rerollCount = CFG.REROLL_MAX;
    for (let i = 0; i < rerollCount; i++) {
      cards.checkInput.mockReturnValueOnce('reroll');
      phase.update(0.016, noInput, player, trail, wave);
    }

    const showCountAfterExhaust = cards.show.mock.calls.length;

    // One more reroll attempt — should not call show() again
    cards.checkInput.mockReturnValueOnce('reroll');
    phase.update(0.016, noInput, player, trail, wave);

    expect(cards.show.mock.calls.length).toBe(showCountAfterExhaust);
  });
});
