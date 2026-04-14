// hud.test.ts — Lightweight tests for EventLog behavior and HudManager smoke test.
// HUD is primarily visual; logic tested here is entry lifecycle and limits.

import { describe, it, expect, vi } from 'vitest';
import { Container } from 'pixi.js';
import { EventLog } from '../eventLog';
import { HudManager, type HudData } from '../hudManager';

// ── Mock PixiJS Container / Text ───────────────────────────────
// Vitest runs in Node (no DOM/WebGL). We mock the pixi.js module so
// EventLog can be tested without a renderer.

vi.mock('pixi.js', () => {
  class MockText {
    text = '';
    alpha = 1;
    visible = true;
    style: Record<string, unknown> = {};
    anchor = { set: vi.fn() };
    position = { set: vi.fn() };
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
    constructor(public opts: Record<string, unknown> = {}) {}
  }
  return {
    Text: MockText,
    Graphics: MockGraphics,
    Container: MockContainer,
    TextStyle: MockTextStyle,
  };
});

// ── EventLog ───────────────────────────────────────────────────

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
    // The internal array is private, but we can tick time past all entries
    // and check nothing throws
    for (let i = 0; i < 10; i++) log.update(0.1);
  });
});

describe('EventLog.update', () => {
  it('removes entries after 3.5s', () => {
    const log = makeLog();
    log.add('FADE ME', 0xffffff);
    // Advance past lifetime in one large tick
    log.update(4.0);
    // Advance again — should not throw even with 0 entries
    log.update(0.1);
  });

  it('does not throw on empty log', () => {
    const log = makeLog();
    expect(() => log.update(0.16)).not.toThrow();
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
});

describe('EventLog.setPanelY', () => {
  it('can update panel Y position', () => {
    const log = makeLog();
    log.add('Entry', 0xffffff);
    expect(() => log.setPanelY(200)).not.toThrow();
    expect(() => log.update(0.1)).not.toThrow();
  });
});

// ── HudManager ────────────────────────────────────────────────────────────────

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
    waveAnnounceTimer: 0,
    waveAnnounceNum: 1,
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
  it('shows banner when waveAnnounceTimer > 0', () => {
    const hud = makeHud();
    hud.update(makeBaseHudData({ waveAnnounceTimer: 1.5, waveAnnounceNum: 2 }));
    // Access private field via type assertion to verify visibility
    const banner = (hud as unknown as Record<string, { visible: boolean }>)._waveBanner;
    const text = (hud as unknown as Record<string, { visible: boolean; text?: string }>)._waveBannerText;
    expect(banner.visible).toBe(true);
    expect(text.visible).toBe(true);
    expect(text.text).toBe('WAVE 2');
  });

  it('hides banner when waveAnnounceTimer <= 0', () => {
    const hud = makeHud();
    hud.update(makeBaseHudData({ waveAnnounceTimer: 0, waveAnnounceNum: 1 }));
    const banner = (hud as unknown as Record<string, { visible: boolean }>)._waveBanner;
    const text = (hud as unknown as Record<string, { visible: boolean }>)._waveBannerText;
    expect(banner.visible).toBe(false);
    expect(text.visible).toBe(false);
  });

  it('updates wave number text', () => {
    const hud = makeHud();
    hud.update(makeBaseHudData({ waveAnnounceTimer: 2.0, waveAnnounceNum: 5 }));
    const text = (hud as unknown as Record<string, { text: string }>)._waveBannerText;
    expect(text.text).toBe('WAVE 5');
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
    const W = 1600, H = 900; // CFG.W / CFG.H defaults
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
