import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerPausePredicate,
  unregisterPausePredicate,
  _getPausePredicateForTest,
} from '../debugOverlay';

// Mock all heavy deps so the module loads without WebGL / DOM / gsap
vi.mock('gsap', () => ({
  default: {
    globalTimeline: { paused: vi.fn(() => false), getChildren: vi.fn(() => []) },
    isTweening: vi.fn(() => false),
  },
}));
vi.mock('@render/pixiApp', () => ({ PixiApp: {} }));
vi.mock('../logger', () => ({ log: vi.fn(), logError: vi.fn(), getEntries: vi.fn(() => []) }));
vi.mock('../domOverlayProbe', () => ({ probeCoveringOverlays: vi.fn(() => []) }));
vi.mock('../watchdog', () => ({
  getWatchdogState: vi.fn(() => ({ firstPaintAt: 0, sceneSwitchInFlight: null, framesSinceLastUpdate: 0 })),
}));
vi.mock('../layerInspect', () => ({
  layerSnapshot: vi.fn(() => []),
  checkAncestorTransforms: vi.fn(() => []),
}));
vi.mock('../renderProbe', () => ({
  probeRenderOutput: vi.fn(() => ({ uniqueColors: 2, samples: [] })),
  formatRenderProbe: vi.fn(() => ''),
}));

describe('registerPausePredicate / unregisterPausePredicate', () => {
  beforeEach(() => {
    unregisterPausePredicate(); // start each test clean
  });

  it('predicate is null before any registration', () => {
    expect(_getPausePredicateForTest()).toBeNull();
  });

  it('register stores the predicate and it is callable', () => {
    const pred = vi.fn(() => true);
    registerPausePredicate(pred);
    const stored = _getPausePredicateForTest();
    expect(stored).toBe(pred);
    expect(stored!()).toBe(true);
  });

  it('unregister clears the predicate to null', () => {
    registerPausePredicate(() => true);
    unregisterPausePredicate();
    expect(_getPausePredicateForTest()).toBeNull();
  });

  it('re-registration replaces the previous predicate', () => {
    const first = vi.fn(() => false);
    const second = vi.fn(() => true);
    registerPausePredicate(first);
    registerPausePredicate(second);
    expect(_getPausePredicateForTest()).toBe(second);
  });

  it('unregister is idempotent — calling it twice does not throw', () => {
    registerPausePredicate(() => true);
    unregisterPausePredicate();
    expect(() => unregisterPausePredicate()).not.toThrow();
    expect(_getPausePredicateForTest()).toBeNull();
  });
});
