// @vitest-environment jsdom
// B4: Touch input logic tests for InputManager.
// Tests the poll() coordinate→direction mapping by directly setting the
// internal touch state — avoids Touch/TouchEvent availability issues in jsdom
// while still exercising the core logic (stick delta → up/down/left/right).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputManager } from '../inputManager';

// jsdom's navigator doesn't have getGamepads — stub it out
vi.stubGlobal('navigator', {
  ...window.navigator,
  getGamepads: () => [],
  hardwareConcurrency: undefined,
  getVrDisplays: () => [],
});

// Helper to access private _touch state directly (test-only pattern)
function setTouchState(im: InputManager, patch: Partial<{
  active: boolean;
  stickId: number | null;
  stickOrigin: { x: number; y: number } | null;
  stickPos: { x: number; y: number } | null;
  driftId: number | null;
}>): void {
  const t = (im as any)._touch;
  Object.assign(t, patch);
}

describe('InputManager — touch input', () => {
  let im: InputManager;

  beforeEach(() => {
    im = new InputManager();
    // init() without a canvas — touch events won't fire, but poll() still reads _touch
    im.init(undefined as unknown as HTMLCanvasElement);
  });

  it('poll() returns all-false before any touch', () => {
    const s = im.poll();
    expect(s.up).toBe(false);
    expect(s.down).toBe(false);
    expect(s.left).toBe(false);
    expect(s.right).toBe(false);
    expect(s.drift).toBe(false);
  });

  it('stick at origin: no directional input (delta = 0, within dead zone)', () => {
    setTouchState(im, {
      active: true,
      stickId: 1,
      stickOrigin: { x: 400, y: 450 },
      stickPos:    { x: 400, y: 450 }, // no movement
    });
    const s = im.poll();
    expect(s.up).toBe(false);
    expect(s.down).toBe(false);
    expect(s.left).toBe(false);
    expect(s.right).toBe(false);
  });

  it('stick moved up 50px triggers up=true', () => {
    setTouchState(im, {
      active: true,
      stickId: 1,
      stickOrigin: { x: 400, y: 450 },
      stickPos:    { x: 400, y: 400 }, // dy = -50, past 15px dead zone
    });
    const s = im.poll();
    expect(s.up).toBe(true);
    expect(s.down).toBe(false);
  });

  it('stick moved down 50px triggers down=true', () => {
    setTouchState(im, {
      active: true,
      stickId: 1,
      stickOrigin: { x: 400, y: 450 },
      stickPos:    { x: 400, y: 500 }, // dy = +50
    });
    const s = im.poll();
    expect(s.down).toBe(true);
    expect(s.up).toBe(false);
  });

  it('stick moved left 50px triggers left=true', () => {
    setTouchState(im, {
      active: true,
      stickId: 1,
      stickOrigin: { x: 400, y: 450 },
      stickPos:    { x: 350, y: 450 }, // dx = -50
    });
    const s = im.poll();
    expect(s.left).toBe(true);
    expect(s.right).toBe(false);
  });

  it('stick moved right 50px triggers right=true', () => {
    setTouchState(im, {
      active: true,
      stickId: 1,
      stickOrigin: { x: 400, y: 450 },
      stickPos:    { x: 450, y: 450 }, // dx = +50
    });
    const s = im.poll();
    expect(s.right).toBe(true);
    expect(s.left).toBe(false);
  });

  it('clearing stick state returns direction to false', () => {
    setTouchState(im, {
      active: true,
      stickId: 1,
      stickOrigin: { x: 400, y: 450 },
      stickPos:    { x: 400, y: 400 },
    });
    expect(im.poll().up).toBe(true);

    setTouchState(im, {
      active: false,
      stickId: null,
      stickOrigin: null,
      stickPos: null,
    });
    expect(im.poll().up).toBe(false);
  });

  it('driftId set → drift=true', () => {
    setTouchState(im, { driftId: 2 });
    expect(im.poll().drift).toBe(true);
  });

  it('driftId cleared → drift=false', () => {
    setTouchState(im, { driftId: 2 });
    expect(im.poll().drift).toBe(true);
    setTouchState(im, { driftId: null });
    expect(im.poll().drift).toBe(false);
  });

  it('small stick movement within dead zone does not trigger input', () => {
    setTouchState(im, {
      active: true,
      stickId: 1,
      stickOrigin: { x: 400, y: 450 },
      stickPos:    { x: 410, y: 455 }, // dx=10, dy=5 — both < 15px dead zone
    });
    const s = im.poll();
    expect(s.up).toBe(false);
    expect(s.down).toBe(false);
    expect(s.left).toBe(false);
    expect(s.right).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Gamepad input tests using vi.stubGlobal
// ---------------------------------------------------------------------------

describe('gamepad input', () => {
  let im: InputManager;

  beforeEach(() => {
    im = new InputManager();
    im.init(undefined as unknown as HTMLCanvasElement);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('left stick X axis steers left when axis < -0.15', () => {
    const gp = {
      axes: [-0.8, 0],
      buttons: [
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 1 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
      ],
      connected: true,
    } as Gamepad;

    vi.stubGlobal('navigator', {
      ...window.navigator,
      getGamepads: () => [gp],
    });

    im.poll(); // First poll to initialize _gpPrev
    im.poll(); // Second poll to get fresh edge state

    const s = im.poll();
    expect(s.left).toBe(true);
    expect(s.right).toBe(false);
  });

  it('left stick X axis inside deadzone produces no steer', () => {
    const gp = {
      axes: [0.1, 0],
      buttons: [
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 1 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
      ],
      connected: true,
    } as Gamepad;

    vi.stubGlobal('navigator', {
      ...window.navigator,
      getGamepads: () => [gp],
    });

    im.poll();
    im.poll();

    const s = im.poll();
    expect(s.left).toBe(false);
    expect(s.right).toBe(false);
  });

  it('Start button (index 9) triggers pause edge-triggered once then not again', () => {
    const gp = {
      axes: [0, 0],
      buttons: [
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 1 },
        { pressed: false, value: 0 },
        { pressed: true,  value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
      ],
      connected: true,
    } as Gamepad;

    vi.stubGlobal('navigator', {
      ...window.navigator,
      getGamepads: () => [gp],
    });

    const s1 = im.poll();
    expect(s1.pause).toBe(true);

    const s2 = im.poll();
    expect(s2.pause).toBe(false);
  });

  it('RT (button 7) sets up (throttle) continuously', () => {
    vi.stubGlobal('navigator', { ...window.navigator, getGamepads: () => [makeGp(7)] });
    const s1 = im.poll();
    expect(s1.up).toBe(true);
    expect(s1.drift).toBe(false);
    const s2 = im.poll();
    expect(s2.up).toBe(true);
  });

  it('LT (button 6) sets down (brake/reverse) continuously', () => {
    vi.stubGlobal('navigator', { ...window.navigator, getGamepads: () => [makeGp(6)] });
    const s1 = im.poll();
    expect(s1.down).toBe(true);
    expect(s1.up).toBe(false);
    const s2 = im.poll();
    expect(s2.down).toBe(true);
  });

  it('LB (button 4) sets drift continuously', () => {
    vi.stubGlobal('navigator', { ...window.navigator, getGamepads: () => [makeGp(4)] });
    const s1 = im.poll();
    expect(s1.drift).toBe(true);
    const s2 = im.poll();
    expect(s2.drift).toBe(true);
  });

  it('left stick Y axis has no effect on up or down', () => {
    const gp = {
      axes: [0, -0.9],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
      connected: true,
    } as unknown as Gamepad;
    vi.stubGlobal('navigator', { ...window.navigator, getGamepads: () => [gp] });
    const s = im.poll();
    expect(s.up).toBe(false);
    expect(s.down).toBe(false);
  });

  // helper — builds a 16-button gamepad with one button pressed
  function makeGp(pressedIndex: number): Gamepad {
    return {
      axes: [0, 0],
      buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === pressedIndex, value: i === pressedIndex ? 1 : 0 })),
      connected: true,
    } as unknown as Gamepad;
  }

  it('B (button 1) sets escape only — reroll stays false', () => {
    vi.stubGlobal('navigator', { ...window.navigator, getGamepads: () => [makeGp(1)] });
    const s = im.poll();
    expect(s.escape).toBe(true);
    expect(s.reroll).toBe(false);
  });

  it('X (button 2) sets select2 only — reroll stays false', () => {
    vi.stubGlobal('navigator', { ...window.navigator, getGamepads: () => [makeGp(2)] });
    const s = im.poll();
    expect(s.select2).toBe(true);
    expect(s.reroll).toBe(false);
  });

  it('DPAD Left (button 14) sets menuLeft — LB no longer does', () => {
    vi.stubGlobal('navigator', { ...window.navigator, getGamepads: () => [makeGp(14)] });
    const s = im.poll();
    expect(s.menuLeft).toBe(true);
  });

  it('LB (button 4) sets drift — menuLeft stays false', () => {
    vi.stubGlobal('navigator', { ...window.navigator, getGamepads: () => [makeGp(4)] });
    const s = im.poll();
    expect(s.drift).toBe(true);
    expect(s.menuLeft).toBe(false);
  });

  it('A (button 0) sets enter AND select1 but NOT menuLaunch (shared A binding)', () => {
    vi.stubGlobal('navigator', { ...window.navigator, getGamepads: () => [makeGp(0)] });
    const s = im.poll();
    expect(s.enter).toBe(true);
    expect(s.select1).toBe(true);
    expect(s.menuLaunch).toBe(false);
  });

  it('Y (button 3) sets select3 only — reroll stays false', () => {
    vi.stubGlobal('navigator', { ...window.navigator, getGamepads: () => [makeGp(3)] });
    const s = im.poll();
    expect(s.select3).toBe(true);
    expect(s.reroll).toBe(false);
  });

  it('RB (button 5) sets reroll — menuRight stays false', () => {
    vi.stubGlobal('navigator', { ...window.navigator, getGamepads: () => [makeGp(5)] });
    const s = im.poll();
    expect(s.reroll).toBe(true);
    expect(s.menuRight).toBe(false);
  });

  it('DPAD Right (button 15) sets menuRight', () => {
    vi.stubGlobal('navigator', { ...window.navigator, getGamepads: () => [makeGp(15)] });
    const s = im.poll();
    expect(s.menuRight).toBe(true);
    expect(s.menuMod4).toBe(false);
  });

  it('DPAD Up (button 12) sets menuUp', () => {
    vi.stubGlobal('navigator', { ...window.navigator, getGamepads: () => [makeGp(12)] });
    const s = im.poll();
    expect(s.menuUp).toBe(true);
    expect(s.menuMod1).toBe(false);
  });

  it('DPAD Down (button 13) sets menuDown', () => {
    vi.stubGlobal('navigator', { ...window.navigator, getGamepads: () => [makeGp(13)] });
    const s = im.poll();
    expect(s.menuDown).toBe(true);
    expect(s.menuMod2).toBe(false);
  });

  it('Start (button 9) sets pause AND menuLaunch', () => {
    vi.stubGlobal('navigator', { ...window.navigator, getGamepads: () => [makeGp(9)] });
    const s = im.poll();
    expect(s.pause).toBe(true);
    expect(s.menuLaunch).toBe(true);
  });

  it('gamepad disconnect clears stale state — right does not latch', () => {
    // First poll with right trigger held and stick right
    const gpRight = {
      axes: [0.9, 0],
      buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 7, value: i === 7 ? 1 : 0 })),
      connected: true,
    } as unknown as Gamepad;
    vi.stubGlobal('navigator', { ...window.navigator, getGamepads: () => [gpRight] });
    const s1 = im.poll();
    expect(s1.right).toBe(true);
    expect(s1.up).toBe(true);

    // Simulate disconnect — getGamepads returns array with nothing at [0]
    vi.stubGlobal('navigator', { ...window.navigator, getGamepads: () => [] });
    const s2 = im.poll();
    expect(s2.right).toBe(false);
    expect(s2.up).toBe(false);
    expect(s2.drift).toBe(false);
  });

  it('keyboard ArrowUp sets up; gamepad RT also sets up independently', () => {
    // Keyboard ArrowUp → up=true
    const noGp = {
      axes: [0, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
      connected: true,
    } as unknown as Gamepad;
    vi.stubGlobal('navigator', { ...window.navigator, getGamepads: () => [noGp] });
    const keyEvent = new KeyboardEvent('keydown', { code: 'ArrowUp', keyCode: 38 });
    document.dispatchEvent(keyEvent);
    const s = im.poll();
    expect(s.up).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Keyboard Enter decoupling tests
// ---------------------------------------------------------------------------

describe('keyboard Enter → menuLaunch only, not enter', () => {
  let im: InputManager;

  beforeEach(() => {
    vi.stubGlobal('navigator', { ...window.navigator, getGamepads: () => [] });
    im = new InputManager();
    im.init(undefined as unknown as HTMLCanvasElement);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Release Enter key between tests
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Enter' }));
  });

  it('keyboard Enter sets menuLaunch=true and enter=false', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
    const s = im.poll();
    expect(s.menuLaunch).toBe(true);
    expect(s.enter).toBe(false);
  });

  it('keyboard Enter does NOT double-fire menuLaunch on hold (edge-triggered)', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
    im.poll(); // first frame — fires
    const s2 = im.poll(); // second frame — held, should not re-fire
    expect(s2.menuLaunch).toBe(false);
  });
});
