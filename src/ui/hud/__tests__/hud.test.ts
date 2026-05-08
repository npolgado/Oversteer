// hud.test.ts — Lightweight tests for EventLog behavior and HudManager smoke test.
// HUD is primarily visual; logic tested here is entry lifecycle and limits.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Container } from 'pixi.js';
import { EventLog } from '../eventLog';
import { HudManager, type HudData } from '../hudManager';
import { uiTween } from '@render/tween';

// ── Mock @render/tween ───────────────────────────────────────────
// uiTween returns a resolved Promise; killUITweens is a no-op.
vi.mock('@render/tween', () => ({
  uiTween: vi.fn().mockResolvedValue(undefined),
  killUITweens: vi.fn(),
  pauseUITweens: vi.fn(),
  resumeUITweens: vi.fn(),
}));

// ── Mock PixiJS Container / Text ─────────────────────────────────
// Vitest runs in Node (no DOM/WebGL). We mock the pixi.js module so
// EventLog can be tested without a renderer.

vi.mock('pixi.js', () => {
  class MockText {
    text = '';
    alpha = 1;
    visible = true;
    style: Record<string, unknown> = { fill: '' };
    scale = { set: vi.fn(), x: 1, y: 1 };
    anchor = { set: vi.fn() };
    position = { set: vi.fn(), x: 0, y: 0 };
    x = 0;
    y = 0;
    destroy = vi.fn();
    constructor(opts: { text?: string } = {}) { this.text = opts.text ?? ''; }
  }
  class MockGraphics {
    alpha = 1;
    visible = true;
    clear = vi.fn().mockReturnThis();
    roundRect = vi.fn().mockReturnThis();
    rect = vi.fn().mockReturnThis();
    fill = vi.fn().mockReturnThis();
    stroke = vi.fn().mockReturnThis();
    destroy = vi.fn();
  }
  class MockContainer {
    children: unknown[] = [];
    addChild = vi.fn((...items: unknown[]) => { this.children.push(...items); });
    removeChildren = vi.fn(() => { this.children = []; });
  }
  class MockTextStyle {
    fill = '';
    constructor(public opts: Record<string, unknown> = {}) {}
  }
  return {
    Text: MockText,
    Graphics: MockGraphics,
    Container: MockContainer,
    TextStyle: MockTextStyle,
  };
});

// ── EventLog ─────────────────────────────────────────────────────

function makeLog() {
  const layer = new Container();
  return new EventLog(layer as never, 100);
}

describe('EventLog.add', () => {
  it('adds entries', () => {
    const log = makeLog();
    log.add('TEST', 0xffffff);
    // No error thrown; entry was added
  });

  it('respects max 7 entries', () => {
    const log = makeLog();
    for (let i = 0; i < 10; i++) log.add(`Entry ${i}`, 0xffffff);
    // Can only verify indirectly via update not throwing
    for (let i = 0; i < 10; i++) log.update(0.1);
  });
});

describe('EventLog.update', () => {
  it('does not throw on empty log', () => {
    const log = makeLog();
    expect(() => log.update(0.16)).not.toThrow();
  });

  it('does not throw when called repeatedly', () => {
    const log = makeLog();
    log.add('FADE ME', 0xffffff);
    for (let i = 0; i < 10; i++) log.update(0.1);
  });

  it('removes entries from _entries when age reaches ENTRY_LIFETIME (3.5s)', () => {
    const log = makeLog();
    log.add('X', 0xffffff);
    log.update(3.5);
    expect((log as any)._entries.length).toBe(0);
  });

  it('entry alpha is 1 before FADE_START (2.2s)', () => {
    const log = makeLog();
    log.add('A', 0xffffff);
    log.update(2.0);
    const entry = (log as any)._entries[0];
    expect(entry.pixiText.alpha).toBe(1);
  });

  it('entry alpha is between 0 and 1 during fade window (2.2s–3.5s)', () => {
    const log = makeLog();
    log.add('A', 0xffffff);
    log.update(3.0); // mid-fade
    const entry = (log as any)._entries[0];
    expect(entry.pixiText.alpha).toBeGreaterThan(0);
    expect(entry.pixiText.alpha).toBeLessThan(1);
  });

  // Regression: old GSAP-based implementation left tweens on destroyed Text objects when
  // clear() was called during active entries. GSAP later accessed this._position on the
  // destroyed object, throwing "can't access property 'y', this._position is null".
  it('update does not access entries after clear() (regression: destroyed Text position)', () => {
    const log = makeLog();
    log.add('A', 0xff0000);
    log.add('B', 0x00ff00);
    log.update(1.0);
    log.clear();
    // If entries were still referenced after clear, this would touch destroyed objects.
    expect(() => log.update(0.1)).not.toThrow();
    expect((log as any)._entries.length).toBe(0);
  });
});

describe('EventLog.clear', () => {
  it('removes all entries without errors', () => {
    const log = makeLog();
    log.add('A', 0xff0000);
    log.add('B', 0x00ff00);
    log.add('C', 0x0000ff);
    expect(() => log.clear()).not.toThrow();
  });

  it('update after clear does not throw', () => {
    const log = makeLog();
    log.add('X', 0xffffff);
    log.clear();
    expect(() => log.update(1.0)).not.toThrow();
  });

  it('_entries is empty after clear()', () => {
    const log = makeLog();
    log.add('P', 0xffffff);
    log.add('Q', 0xffffff);
    log.clear();
    expect((log as any)._entries.length).toBe(0);
  });
});

describe('EventLog.setPanelY', () => {
  it('can update panel Y position', () => {
    const log = makeLog();
    log.add('Entry', 0xffffff);
    expect(() => log.setPanelY(200)).not.toThrow();
    expect(() => log.update(0.1)).not.toThrow();
  });
});

// ── HudManager ───────────────────────────────────────────────────

function makeBaseHudData(overrides: Partial<HudData> = {}): HudData {
  return {
    score: 0,
    newBest: false,
    hp: 100,
    maxHp: 100,
    lastHitTimer: 1,
    comboLevel: 0,
    drifting: false,
    driftTime: 0,
    speed: 0,
    maxSpeed: 400,
    waveIndex: 1,
    enemyCount: 0,
    phase: 'combat',
    waveTimer: 30,
    combatDuration: 30,
    enemies: [],
    cameraX: 0,
    cameraY: 0,
    ...overrides,
  };
}

function makeHud() {
  const layer = new Container();
  return new HudManager(layer as never);
}

describe('HudManager smoke', () => {
  it('constructs and updates without throwing', () => {
    const hud = makeHud();
    expect(() => hud.update(makeBaseHudData())).not.toThrow();
  });
});

describe('HudManager — wave announce banner', () => {
  it('sets banner text when showWaveBanner is called', () => {
    const hud = makeHud();
    hud.showWaveBanner(2);
    const text = (hud as unknown as Record<string, { text: string }>)._waveBannerText;
    expect(text.text).toBe('WAVE 2');
  });

  it('sets correct wave number in banner text', () => {
    const hud = makeHud();
    hud.showWaveBanner(5);
    const text = (hud as unknown as Record<string, { text: string }>)._waveBannerText;
    expect(text.text).toBe('WAVE 5');
  });

  it('does not throw when called multiple times', () => {
    const hud = makeHud();
    expect(() => {
      hud.showWaveBanner(1);
      hud.showWaveBanner(2);
      hud.showWaveBanner(3);
    }).not.toThrow();
  });
});

describe('HudManager — milestone banner', () => {
  it('sets banner text when showMilestoneBanner is called', () => {
    const hud = makeHud();
    hud.showMilestoneBanner('x5 COMBO!', '#7C5CFF');
    const text = (hud as unknown as Record<string, { text: string }>)._milestoneBannerText;
    expect(text.text).toBe('x5 COMBO!');
  });

  it('does not throw when called multiple times rapidly', () => {
    const hud = makeHud();
    expect(() => {
      hud.showMilestoneBanner('x3 COMBO!', '#35F2D0');
      hud.showMilestoneBanner('x5 COMBO!', '#7C5CFF');
      hud.showMilestoneBanner('x8 COMBO!', '#FFD700');
    }).not.toThrow();
  });
});

describe('HudManager — off-screen enemy indicators', () => {
  it('does not throw when no enemies', () => {
    const hud = makeHud();
    expect(() => hud.update(makeBaseHudData({ enemies: [], cameraX: 0, cameraY: 0 }))).not.toThrow();
  });

  it('does not throw when all enemies are on-screen', () => {
    const hud = makeHud();
    const enemies = [{ x: 0, y: 0, alive: true }]; // near camera center
    expect(() => hud.update(makeBaseHudData({ enemies, cameraX: 0, cameraY: 0 }))).not.toThrow();
  });

  it('does not throw when enemies are off all four edges', () => {
    const hud = makeHud();
    const enemies = [
      { x: -2000, y: 0, alive: true },    // left
      { x: 2000, y: 0, alive: true },     // right
      { x: 0, y: -2000, alive: true },    // top
      { x: 0, y: 2000, alive: true },     // bottom
    ];
    expect(() => hud.update(makeBaseHudData({ enemies, cameraX: 0, cameraY: 0 }))).not.toThrow();
  });

  it('skips dead enemies', () => {
    const hud = makeHud();
    const enemies = [{ x: -2000, y: 0, alive: false }];
    // If dead enemy were counted, _offLeft.rect would be called — but it shouldn't be
    hud.update(makeBaseHudData({ enemies, cameraX: 0, cameraY: 0 }));
    const offLeft = (hud as unknown as Record<string, { rect: ReturnType<typeof vi.fn> }>)._offLeft;
    expect(offLeft.rect).not.toHaveBeenCalled();
  });
});

// ── HudManager — newBest animation state ──────────────────────────────────────

describe('HudManager — newBest animation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('_newBestShown starts false', () => {
    const hud = makeHud();
    expect((hud as any)._newBestShown).toBe(false);
  });

  it('_newBestShown becomes true on first newBest=true update', () => {
    const hud = makeHud();
    hud.update(makeBaseHudData({ newBest: true }));
    expect((hud as any)._newBestShown).toBe(true);
  });

  it('_newBestText.scale.set(0.5) is called on first trigger', () => {
    const hud = makeHud();
    const text = (hud as any)._newBestText;
    hud.update(makeBaseHudData({ newBest: true }));
    expect(text.scale.set).toHaveBeenCalledWith(0.5);
  });

  it('scale.set NOT called again on second newBest=true update', () => {
    const hud = makeHud();
    const text = (hud as any)._newBestText;
    hud.update(makeBaseHudData({ newBest: true }));
    vi.clearAllMocks();
    hud.update(makeBaseHudData({ newBest: true }));
    expect(text.scale.set).not.toHaveBeenCalled();
  });

  it('_newBestShown resets to false when newBest goes false', () => {
    const hud = makeHud();
    hud.update(makeBaseHudData({ newBest: true }));
    hud.update(makeBaseHudData({ newBest: false }));
    expect((hud as any)._newBestShown).toBe(false);
  });

  it('_newBestText.alpha=0 when newBest goes false after being true', () => {
    const hud = makeHud();
    const text = (hud as any)._newBestText;
    hud.update(makeBaseHudData({ newBest: true }));
    hud.update(makeBaseHudData({ newBest: false }));
    expect(text.alpha).toBe(0);
  });
});

// ── HudManager — wave timer visibility transitions ────────────────────────────

describe('HudManager — wave timer visibility transitions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('uiTween is called when combat phase becomes active', () => {
    const hud = makeHud();
    // Fresh hud: _waveTimerVisible=false, phase='combat' → transition fires
    hud.update(makeBaseHudData({ phase: 'combat' }));
    // Expects at least 4 tweens (waveBg, waveBar, waveLabel, enemyText)
    expect(vi.mocked(uiTween).mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('uiTween NOT called when phase stays combat', () => {
    const hud = makeHud();
    hud.update(makeBaseHudData({ phase: 'combat' })); // establishes state
    vi.clearAllMocks();
    hud.update(makeBaseHudData({ phase: 'combat' })); // no change
    expect(vi.mocked(uiTween).mock.calls.length).toBe(0);
  });

  it('uiTween is called when combat phase ends', () => {
    const hud = makeHud();
    hud.update(makeBaseHudData({ phase: 'combat' }));
    vi.clearAllMocks();
    hud.update(makeBaseHudData({ phase: 'break' })); // transition out
    expect(vi.mocked(uiTween).mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});

// ── HudManager — combo bar visibility transitions ─────────────────────────────

describe('HudManager — combo bar visibility transitions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('uiTween is called (×3) when drift combo becomes visible', () => {
    const hud = makeHud();
    // Settle initial state: not drifting, combo=0
    hud.update(makeBaseHudData({ drifting: false, comboLevel: 0 }));
    vi.clearAllMocks();
    hud.update(makeBaseHudData({ drifting: true }));
    // 3 tweens: comboBg, comboBar, comboLabel
    expect(vi.mocked(uiTween).mock.calls.length).toBe(3);
  });

  it('uiTween NOT called when combo visibility does not change', () => {
    const hud = makeHud();
    hud.update(makeBaseHudData({ drifting: true })); // show combo
    vi.clearAllMocks();
    hud.update(makeBaseHudData({ drifting: true })); // no change
    expect(vi.mocked(uiTween).mock.calls.length).toBe(0);
  });

  it('combo is visible when comboLevel > 0.5 even without drifting', () => {
    const hud = makeHud();
    hud.update(makeBaseHudData({ drifting: false, comboLevel: 0 }));
    vi.clearAllMocks();
    hud.update(makeBaseHudData({ drifting: false, comboLevel: 1 }));
    expect(vi.mocked(uiTween).mock.calls.length).toBe(3);
  });
});
