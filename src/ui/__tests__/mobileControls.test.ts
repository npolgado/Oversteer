import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MobileControls } from '../mobileControls';
import { InputManager } from '@input/inputManager';

// Minimal mock Pixi Container
class MockContainer {
  addChild(child: any) {}
  _children: any[] = [];
}

// Mock Vec2 type
interface Vec2 { x: number; y: number; }

// Minimal mock Pixi Graphics that tracks method calls
class MockGraphics {
  clear = vi.fn();
  circle = vi.fn((...args: any[]) => this);
  fill = vi.fn((...args: any[]) => this);
  stroke = vi.fn((...args: any[]) => this);
  visible = false;
  destroy = vi.fn();
}

// Mock InputManager
class MockInputManager {
  hasTouched = false;
  stickOrigin: Vec2 | null = null;
  stickPos: Vec2 | null = null;
  driftActive = false;
}

describe('MobileControls', () => {
  let mockContainer: MockContainer;
  let mockGraphics: MockGraphics;
  let mockInputManager: MockInputManager;
  let controls: MobileControls;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContainer = new MockContainer();
    mockGraphics = new MockGraphics();
    mockInputManager = new MockInputManager();
    controls = new MobileControls(mockContainer as any);
    // Replace internal graphics with mock for testing
    (controls as any)._g = mockGraphics;
    mockGraphics.visible = true;
  });

  it('does not draw when hasTouched is false', () => {
    mockInputManager.hasTouched = false;
    controls.update(mockInputManager as any, 1);

    expect(mockGraphics.clear).not.toHaveBeenCalled();
    expect(mockGraphics.circle).not.toHaveBeenCalledTimes(4);
  });

  it('draws joystick ring when stickOrigin is set', () => {
    mockInputManager.hasTouched = true;
    mockInputManager.stickOrigin = { x: 200, y: 400 };

    controls.update(mockInputManager as any, 1);

    expect(mockGraphics.clear).toHaveBeenCalled();
    expect(mockGraphics.circle).toHaveBeenCalled();
    expect(mockGraphics.stroke).toHaveBeenCalled();
  });

  it('draws drift button in pressed state when driftActive is true', () => {
    mockInputManager.hasTouched = true;
    mockInputManager.driftActive = true;

    controls.update(mockInputManager as any, 1);

    expect(mockGraphics.clear).toHaveBeenCalled();
    expect(mockGraphics.fill).toHaveBeenCalled();
    expect(mockGraphics.stroke).toHaveBeenCalled();
  });

  it('destroy() removes Graphics from container', () => {
    expect(mockGraphics.destroy).not.toHaveBeenCalled();

    controls.destroy();

    expect(mockGraphics.destroy).toHaveBeenCalled();
  });

  it('update(realInputManager, dt) does not throw — Fix 1 regression (was crashing when inputManager was undefined)', () => {
    // The crash was gameLoop passing `this._ctx.inputManager` (undefined) instead of
    // the singleton. Verify that a real InputManager instance (not undefined) is safe.
    // We skip init() to avoid document access in non-jsdom environment — the
    // regression is about undefined vs instance, not about event listener setup.
    const im = new InputManager();
    expect(() => controls.update(im, 1 / 60)).not.toThrow();
  });

  it('update(undefined) hides controls and does not throw', () => {
    expect(() => controls.update(undefined, 1 / 60)).not.toThrow();
    expect(mockGraphics.visible).toBe(false);
    expect(mockGraphics.clear).not.toHaveBeenCalled();
  });
});
