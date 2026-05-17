// @vitest-environment jsdom
// B4: Touch input logic tests for InputManager.
// Tests the poll() coordinate→direction mapping by directly setting the
// internal touch state — avoids Touch/TouchEvent availability issues in jsdom
// while still exercising the core logic (stick delta → up/down/left/right).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InputManager } from '../inputManager';

// jsdom's navigator doesn't have getGamepads — stub it out
vi.stubGlobal('navigator', {
  ...window.navigator,
  getGamepads: () => [],
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
