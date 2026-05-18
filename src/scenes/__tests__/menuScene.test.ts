// B1: MenuScene enter/exit state transition test.
// Verifies that overlayLayer is clean after exit() — the primary state-leak risk
// across Menu → Game → Menu transitions.
//
// Pixi.js and all transitive Pixi-importing modules are mocked so this runs in
// the standard node test environment without a WebGL context.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks must be hoisted before any module that imports pixi.js ---

vi.mock('pixi.js', () => ({
  Graphics: class {
    rect() { return this; }
    fill() { return this; }
    clear() { return this; }
  },
  Text: class {
    anchor = { set: () => {} };
    position = { set: () => {} };
    alpha = 1;
    private _text = '';
    get text() { return this._text; }
    set text(v: string) { this._text = v; }
    constructor(_opts: unknown) {}
  },
}));

vi.mock('@scenes/sceneManager', () => ({
  sceneManager: { switchTo: vi.fn() },
}));

vi.mock('@scenes/mapSelectScene', () => ({
  MapSelectScene: class { constructor(_opts: unknown) {} },
}));

vi.mock('@core/saveManager', () => ({
  saveManager: { getHighScore: () => 1234 },
}));

vi.mock('@ui/textStyles', () => ({
  makeUIStyle: (_opts: unknown) => ({}),
}));

vi.mock('@debug/watchdog', () => ({
  watchdogMenuEntered: vi.fn(),
  watchdogMenuInputReceived: vi.fn(),
}));

// --- Helpers ---

function makeOverlayLayer() {
  const children: unknown[] = [];
  return {
    get children() { return children; },
    addChild(...items: unknown[]) { children.push(...items); return items[0]; },
    removeChildren() { children.length = 0; },
  };
}

function makeContext(overlay: ReturnType<typeof makeOverlayLayer>) {
  return {
    pixiApp: { overlayLayer: overlay },
    getInput: () => ({
      up: false, down: false, left: false, right: false, drift: false,
      enter: false, reroll: false, pause: false,
      select1: false, select2: false, select3: false,
      menuLeft: false, menuRight: false,
      menuMod1: false, menuMod2: false, menuMod3: false, menuMod4: false,
      mute: false, sfxDown: false, sfxUp: false, musicDown: false, musicUp: false,
      escape: false, perfToggle: false,
    }),
    audioManager: { play: vi.fn(), startBgMusic: vi.fn(), fadeBgMusic: vi.fn() },
  };
}

// --- Tests ---

describe('MenuScene state transition', () => {
  let overlayLayer: ReturnType<typeof makeOverlayLayer>;

  beforeEach(() => {
    overlayLayer = makeOverlayLayer();
    vi.clearAllMocks();
  });

  it('enter() adds children to overlayLayer', async () => {
    const { MenuScene } = await import('../menuScene');
    const scene = new MenuScene();
    scene.enter(makeContext(overlayLayer) as never);
    expect(overlayLayer.children.length).toBeGreaterThan(0);
  });

  it('exit() leaves overlayLayer empty (no state leak)', async () => {
    const { MenuScene } = await import('../menuScene');
    const scene = new MenuScene();
    const ctx = makeContext(overlayLayer) as never;
    scene.enter(ctx);
    expect(overlayLayer.children.length).toBeGreaterThan(0);
    scene.exit(ctx);
    expect(overlayLayer.children.length).toBe(0);
  });

  it('double-exit is safe (idempotent)', async () => {
    const { MenuScene } = await import('../menuScene');
    const scene = new MenuScene();
    const ctx = makeContext(overlayLayer) as never;
    scene.enter(ctx);
    scene.exit(ctx);
    scene.exit(ctx); // second exit must not throw
    expect(overlayLayer.children.length).toBe(0);
  });

  it('update() without enter does not throw', async () => {
    const { MenuScene } = await import('../menuScene');
    const scene = new MenuScene();
    expect(() => scene.update(0.016, makeContext(overlayLayer) as never)).not.toThrow();
  });
});
