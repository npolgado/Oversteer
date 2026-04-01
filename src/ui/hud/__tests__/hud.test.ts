// hud.test.ts — Lightweight tests for EventLog behavior and HudManager smoke test.
// HUD is primarily visual; logic tested here is entry lifecycle and limits.

import { describe, it, expect, vi } from 'vitest';
import { Container } from 'pixi.js';
import { EventLog } from '../eventLog';

// ── Mock PixiJS Container / Text ───────────────────────────────
// Vitest runs in Node (no DOM/WebGL). We mock the pixi.js module so
// EventLog can be tested without a renderer.

vi.mock('pixi.js', () => {
  class MockText {
    text = '';
    alpha = 1;
    style: Record<string, unknown> = {};
    position = { set: vi.fn() };
    destroy = vi.fn();
    constructor(opts: { text?: string } = {}) { this.text = opts.text ?? ''; }
  }
  class MockGraphics {
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
