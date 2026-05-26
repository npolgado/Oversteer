// B6: MapSelectScene input routing and state tests.
// Covers the Phase 3 rewrite: focus cursor, gamepad A toggle, menuLaunch launch,
// toggleSandbox, keyboard 1-4 fallback, escape navigation, and _refreshDisplay arrow prefix.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pixi.js', () => {
  class MockText {
    text = '';
    anchor = { set: vi.fn() };
    position = { set: vi.fn() };
    style: Record<string, unknown> = {};
    constructor(opts: { text?: string; style?: Record<string, unknown> } = {}) {
      this.text = opts.text ?? '';
      this.style = opts.style ? { ...opts.style } : {};
    }
  }
  class MockGraphics {
    rect = vi.fn().mockReturnThis();
    fill = vi.fn().mockReturnThis();
  }
  return { Text: MockText, Graphics: MockGraphics };
});

vi.mock('@scenes/sceneManager', () => ({
  sceneManager: { switchTo: vi.fn() },
}));

vi.mock('@scenes/menuScene', () => ({ MenuScene: class {} }));
vi.mock('@scenes/gameplayScene', () => ({ GameplayScene: class { constructor(public opts: unknown) {} } }));
vi.mock('@ui/textStyles', () => ({ makeUIStyle: (_opts: unknown) => ({}) }));

vi.mock('@core/config', () => ({
  CFG: { W: 1600, H: 900, C_TEXT: '#cccccc', C_ACCENT: '#35F2D0' },
  S: (n: number) => n,
  applyMap: vi.fn(),
}));

vi.mock('@core/saveManager', () => ({
  saveManager: {
    getSelectedMap: vi.fn(() => 'map1'),
    setSelectedMap: vi.fn(),
  },
}));

// 4 modifiers to match production; IDs/labels are tested by _refreshDisplay cases.
vi.mock('@content/maps', () => ({
  MAPS: [
    { id: 'map1', name: 'MAP ONE', desc: 'First map' },
    { id: 'map2', name: 'MAP TWO', desc: 'Second map' },
  ],
  DIFFICULTY_MODIFIERS: [
    { id: 'hard_mode',      key: '1', label: 'HARD MODE',      desc: '1.5× score' },
    { id: 'speed_rush',     key: '2', label: 'SPEED RUSH',     desc: '1.3× score' },
    { id: 'fragile',        key: '3', label: 'FRAGILE',        desc: '1.4× score' },
    { id: 'double_enemies', key: '4', label: 'DOUBLE ENEMIES', desc: '1.6× score' },
  ],
  computeModifierScoreMult: (ids: string[]) => ids.reduce((acc: number) => acc * 1.5, 1),
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MapSelectScene — focus cursor (menuUp / menuDown)', () => {
  let overlay: ReturnType<typeof makeOverlayLayer>;

  beforeEach(async () => {
    overlay = makeOverlayLayer();
    const { sceneManager } = await import('@scenes/sceneManager');
    vi.mocked(sceneManager.switchTo).mockClear();
  });

  async function makeScene(sandbox = false) {
    const { MapSelectScene } = await import('../mapSelectScene');
    const scene = new MapSelectScene({ sandbox });
    scene.enter(makeContext(overlay) as never);
    return scene;
  }

  it('initial focusIndex is 0 (map row)', async () => {
    const scene = await makeScene();
    expect((scene as any)._focusIndex).toBe(0);
  });

  it('menuDown advances focusIndex', async () => {
    const scene = await makeScene();
    scene.update(0, makeContext(overlay, { menuDown: true }) as never);
    expect((scene as any)._focusIndex).toBe(1);
  });

  it('menuDown wraps from last to 0', async () => {
    const scene = await makeScene();
    // 4 mods + 1 map = 5 slots (0..4). From 0, press down 5 times → wraps to 0.
    for (let i = 0; i < 5; i++) {
      scene.update(0, makeContext(overlay, { menuDown: true }) as never);
    }
    expect((scene as any)._focusIndex).toBe(0);
  });

  it('menuUp from 0 wraps to last slot', async () => {
    const scene = await makeScene();
    scene.update(0, makeContext(overlay, { menuUp: true }) as never);
    // 4 mods → last index is 4
    expect((scene as any)._focusIndex).toBe(4);
  });

  it('menuUp decrements focusIndex', async () => {
    const scene = await makeScene();
    scene.update(0, makeContext(overlay, { menuDown: true }) as never); // focusIndex=1
    scene.update(0, makeContext(overlay, { menuDown: true }) as never); // focusIndex=2
    scene.update(0, makeContext(overlay, { menuUp: true }) as never);   // focusIndex=1
    expect((scene as any)._focusIndex).toBe(1);
  });
});

describe('MapSelectScene — enter key (gamepad A) modifier toggle', () => {
  let overlay: ReturnType<typeof makeOverlayLayer>;

  beforeEach(() => { overlay = makeOverlayLayer(); });

  async function makeScene() {
    const { MapSelectScene } = await import('../mapSelectScene');
    const scene = new MapSelectScene({ sandbox: false });
    scene.enter(makeContext(overlay) as never);
    return scene;
  }

  it('enter at focusIndex=0 (map row) does NOT add any modifier', async () => {
    const scene = await makeScene();
    scene.update(0, makeContext(overlay, { enter: true }) as never);
    expect((scene as any)._activeModIds).toHaveLength(0);
  });

  it('enter at focusIndex=1 toggles the first modifier ON', async () => {
    const scene = await makeScene();
    scene.update(0, makeContext(overlay, { menuDown: true }) as never); // focusIndex=1
    scene.update(0, makeContext(overlay, { enter: true }) as never);
    expect((scene as any)._activeModIds).toContain('hard_mode');
  });

  it('enter at focusIndex=1 a second time toggles the first modifier OFF', async () => {
    const scene = await makeScene();
    scene.update(0, makeContext(overlay, { menuDown: true }) as never); // focusIndex=1
    scene.update(0, makeContext(overlay, { enter: true }) as never);    // on
    scene.update(0, makeContext(overlay, { enter: true }) as never);    // off
    expect((scene as any)._activeModIds).toHaveLength(0);
  });

  it('enter at focusIndex=2 toggles the second modifier', async () => {
    const scene = await makeScene();
    scene.update(0, makeContext(overlay, { menuDown: true }) as never); // focusIndex=1
    scene.update(0, makeContext(overlay, { menuDown: true }) as never); // focusIndex=2
    scene.update(0, makeContext(overlay, { enter: true }) as never);
    expect((scene as any)._activeModIds).toContain('speed_rush');
  });
});

describe('MapSelectScene — menuLaunch (Start / keyboard Enter)', () => {
  let overlay: ReturnType<typeof makeOverlayLayer>;

  beforeEach(async () => {
    overlay = makeOverlayLayer();
    const { sceneManager } = await import('@scenes/sceneManager');
    vi.mocked(sceneManager.switchTo).mockClear();
  });

  it('menuLaunch switches to GameplayScene with current mapId', async () => {
    const { MapSelectScene } = await import('../mapSelectScene');
    const scene = new MapSelectScene({ sandbox: false });
    scene.enter(makeContext(overlay) as never);
    scene.update(0, makeContext(overlay, { menuLaunch: true }) as never);

    const { sceneManager } = await import('@scenes/sceneManager');
    expect(sceneManager.switchTo).toHaveBeenCalledOnce();
    const [passedScene] = vi.mocked(sceneManager.switchTo).mock.calls[0];
    expect((passedScene as any).opts.mapId).toBe('map1');
  });

  it('menuLaunch passes active modifier ids to GameplayScene', async () => {
    const { MapSelectScene } = await import('../mapSelectScene');
    const scene = new MapSelectScene({ sandbox: false });
    scene.enter(makeContext(overlay) as never);
    // Activate mod via keyboard 1
    scene.update(0, makeContext(overlay, { menuMod1: true }) as never);
    scene.update(0, makeContext(overlay, { menuLaunch: true }) as never);

    const { sceneManager } = await import('@scenes/sceneManager');
    const [passedScene] = vi.mocked(sceneManager.switchTo).mock.calls[0];
    expect((passedScene as any).opts.modifierIds).toContain('hard_mode');
  });

  it('menuLaunch in sandbox passes sandbox=true', async () => {
    const { MapSelectScene } = await import('../mapSelectScene');
    const scene = new MapSelectScene({ sandbox: true });
    scene.enter(makeContext(overlay) as never);
    scene.update(0, makeContext(overlay, { menuLaunch: true }) as never);

    const { sceneManager } = await import('@scenes/sceneManager');
    const [passedScene] = vi.mocked(sceneManager.switchTo).mock.calls[0];
    expect((passedScene as any).opts.sandbox).toBe(true);
  });
});

describe('MapSelectScene — toggleSandbox (S key)', () => {
  let overlay: ReturnType<typeof makeOverlayLayer>;

  beforeEach(() => { overlay = makeOverlayLayer(); });

  it('toggleSandbox flips _sandbox from false to true', async () => {
    const { MapSelectScene } = await import('../mapSelectScene');
    const scene = new MapSelectScene({ sandbox: false });
    scene.enter(makeContext(overlay) as never);
    scene.update(0, makeContext(overlay, { toggleSandbox: true }) as never);
    expect((scene as any)._sandbox).toBe(true);
  });

  it('toggleSandbox flips _sandbox from true to false', async () => {
    const { MapSelectScene } = await import('../mapSelectScene');
    const scene = new MapSelectScene({ sandbox: true });
    scene.enter(makeContext(overlay) as never);
    scene.update(0, makeContext(overlay, { toggleSandbox: true }) as never);
    expect((scene as any)._sandbox).toBe(false);
  });

  it('_sandboxText reflects ON state', async () => {
    const { MapSelectScene } = await import('../mapSelectScene');
    const scene = new MapSelectScene({ sandbox: false });
    scene.enter(makeContext(overlay) as never);
    scene.update(0, makeContext(overlay, { toggleSandbox: true }) as never);
    const text = (scene as any)._sandboxText;
    expect(text.text).toContain('ON');
  });
});

describe('MapSelectScene — escape navigation', () => {
  let overlay: ReturnType<typeof makeOverlayLayer>;

  beforeEach(async () => {
    overlay = makeOverlayLayer();
    const { sceneManager } = await import('@scenes/sceneManager');
    vi.mocked(sceneManager.switchTo).mockClear();
  });

  it('escape switches to MenuScene', async () => {
    const { MapSelectScene, MenuScene } = await (async () => {
      const m = await import('../mapSelectScene');
      const menu = await import('@scenes/menuScene');
      return { ...m, ...menu };
    })();
    const scene = new MapSelectScene({ sandbox: false });
    scene.enter(makeContext(overlay) as never);
    scene.update(0, makeContext(overlay, { escape: true }) as never);

    const { sceneManager } = await import('@scenes/sceneManager');
    expect(sceneManager.switchTo).toHaveBeenCalledOnce();
  });
});

describe('MapSelectScene — keyboard 1-4 modifier toggle', () => {
  let overlay: ReturnType<typeof makeOverlayLayer>;

  beforeEach(() => { overlay = makeOverlayLayer(); });

  it.each([
    ['menuMod1', 'hard_mode'],
    ['menuMod2', 'speed_rush'],
    ['menuMod3', 'fragile'],
    ['menuMod4', 'double_enemies'],
  ])('%s toggles %s', async (key, modId) => {
    const { MapSelectScene } = await import('../mapSelectScene');
    const scene = new MapSelectScene({ sandbox: false });
    scene.enter(makeContext(overlay) as never);
    scene.update(0, makeContext(overlay, { [key]: true }) as never);
    expect((scene as any)._activeModIds).toContain(modId);
  });

  it('menuMod2 toggles independently of focusIndex', async () => {
    const { MapSelectScene } = await import('../mapSelectScene');
    const scene = new MapSelectScene({ sandbox: false });
    scene.enter(makeContext(overlay) as never);
    // Focus is on modifier 1 (hard_mode), but keyboard Digit2 should still toggle speed_rush
    scene.update(0, makeContext(overlay, { menuDown: true }) as never); // focusIndex=1
    scene.update(0, makeContext(overlay, { menuMod2: true }) as never);
    expect((scene as any)._activeModIds).toContain('speed_rush');
    expect((scene as any)._activeModIds).not.toContain('hard_mode');
  });
});

describe('MapSelectScene — _refreshDisplay arrow prefix', () => {
  let overlay: ReturnType<typeof makeOverlayLayer>;

  beforeEach(() => { overlay = makeOverlayLayer(); });

  it('map name has ▶ prefix when focusIndex=0', async () => {
    const { MapSelectScene } = await import('../mapSelectScene');
    const scene = new MapSelectScene({ sandbox: false });
    scene.enter(makeContext(overlay) as never);
    const mapNameText = (scene as any)._mapNameText;
    expect(mapNameText.text).toMatch(/^▶/);
  });

  it('map name has no ▶ when focus moves away from map row', async () => {
    const { MapSelectScene } = await import('../mapSelectScene');
    const scene = new MapSelectScene({ sandbox: false });
    scene.enter(makeContext(overlay) as never);
    scene.update(0, makeContext(overlay, { menuDown: true }) as never); // focusIndex=1
    const mapNameText = (scene as any)._mapNameText;
    expect(mapNameText.text).not.toMatch(/^▶/);
  });

  it('focused modifier row gets ▶ prefix', async () => {
    const { MapSelectScene } = await import('../mapSelectScene');
    const scene = new MapSelectScene({ sandbox: false });
    scene.enter(makeContext(overlay) as never);
    scene.update(0, makeContext(overlay, { menuDown: true }) as never); // focusIndex=1 → mod 0
    const modTexts = (scene as any)._modTexts;
    expect(modTexts[0].text).toMatch(/^▶/);
    expect(modTexts[1].text).toMatch(/^\s/); // not focused
  });

  it('exit clears all display refs', async () => {
    const { MapSelectScene } = await import('../mapSelectScene');
    const scene = new MapSelectScene({ sandbox: false });
    scene.enter(makeContext(overlay) as never);
    scene.exit(makeContext(overlay) as never);
    expect((scene as any)._mapNameText).toBeNull();
    expect((scene as any)._sandboxText).toBeNull();
    expect((scene as any)._modTexts).toHaveLength(0);
  });
});
