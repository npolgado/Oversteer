// B5: GameOverScene input routing tests.
// Verifies that reroll, enter (gamepad A), and menuLaunch (Start/Enter) all
// restart the run, and that escape navigates back to the menu.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pixi.js', () => ({
  Graphics: class {
    rect() { return this; }
    fill() { return this; }
  },
  Text: class {
    anchor = { set: () => {} };
    position = { set: () => {} };
    constructor(_opts: unknown) {}
  },
}));

vi.mock('@scenes/sceneManager', () => ({
  sceneManager: { switchTo: vi.fn() },
}));

vi.mock('@scenes/gameplayScene', () => ({
  GameplayScene: class { constructor(_opts: unknown) {} },
}));

vi.mock('@scenes/menuScene', () => ({
  MenuScene: class {},
}));

vi.mock('@ui/textStyles', () => ({
  makeUIStyle: (_opts: unknown) => ({}),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOverlayLayer() {
  const children: unknown[] = [];
  return {
    get children() { return children; },
    addChild(...items: unknown[]) { children.push(...items); return items[0]; },
    removeChildren() { children.length = 0; },
  };
}

const BASE_INPUT = {
  up: false, down: false, left: false, right: false, drift: false,
  pause: false, enter: false, reroll: false,
  select1: false, select2: false, select3: false,
  escape: false,
  menuLeft: false, menuRight: false, menuUp: false, menuDown: false, menuLaunch: false,
  menuMod1: false, menuMod2: false, menuMod3: false, menuMod4: false,
  toggleSandbox: false,
  mute: false, sfxDown: false, sfxUp: false, musicDown: false, musicUp: false,
  perfToggle: false,
};

function makeContext(overlay: ReturnType<typeof makeOverlayLayer>, inputOverrides = {}) {
  return {
    pixiApp: { overlayLayer: overlay },
    getInput: () => ({ ...BASE_INPUT, ...inputOverrides }),
    audioManager: { play: vi.fn() },
  };
}

const MOCK_DATA = {
  score: 1000,
  highScore: 2000,
  newBest: false,
  waveReached: 5,
  runStats: { peakCombo: 3, nearMissTotal: 1, totalDriftTime: 10, enemiesKilled: 20, scrapCollected: 0 },
  modifierMult: 1,
  lastMapId: 'default',
  lastModifierIds: [],
  sandbox: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GameOverScene — input routing', () => {
  let overlayLayer: ReturnType<typeof makeOverlayLayer>;

  beforeEach(async () => {
    overlayLayer = makeOverlayLayer();
    const { sceneManager } = await import('@scenes/sceneManager');
    vi.mocked(sceneManager.switchTo).mockClear();
  });

  async function makeScene() {
    const { GameOverScene } = await import('../gameOverScene');
    const scene = new GameOverScene(MOCK_DATA);
    scene.enter(makeContext(overlayLayer) as never);
    return scene;
  }

  it('reroll restarts the run', async () => {
    const scene = await makeScene();
    scene.update(2, makeContext(overlayLayer, { reroll: true }) as never);
    const { sceneManager } = await import('@scenes/sceneManager');
    expect(sceneManager.switchTo).toHaveBeenCalledOnce();
  });

  it('enter (gamepad A) restarts the run', async () => {
    const scene = await makeScene();
    scene.update(2, makeContext(overlayLayer, { enter: true }) as never);
    const { sceneManager } = await import('@scenes/sceneManager');
    expect(sceneManager.switchTo).toHaveBeenCalledOnce();
  });

  it('menuLaunch (Start / keyboard Enter) restarts the run', async () => {
    const scene = await makeScene();
    scene.update(2, makeContext(overlayLayer, { menuLaunch: true }) as never);
    const { sceneManager } = await import('@scenes/sceneManager');
    expect(sceneManager.switchTo).toHaveBeenCalledOnce();
  });

  it('escape navigates to menu', async () => {
    const scene = await makeScene();
    scene.update(2, makeContext(overlayLayer, { escape: true }) as never);
    const { sceneManager } = await import('@scenes/sceneManager');
    expect(sceneManager.switchTo).toHaveBeenCalledOnce();
  });

  it('input is ignored while lock timer is active', async () => {
    const scene = await makeScene();
    scene.update(0.5, makeContext(overlayLayer, { enter: true }) as never); // lock=1.5, only 0.5s elapsed
    const { sceneManager } = await import('@scenes/sceneManager');
    expect(sceneManager.switchTo).not.toHaveBeenCalled();
  });

  it('exit() clears overlayLayer', async () => {
    const scene = await makeScene();
    expect(overlayLayer.children.length).toBeGreaterThan(0);
    scene.exit(makeContext(overlayLayer) as never);
    expect(overlayLayer.children.length).toBe(0);
  });
});
