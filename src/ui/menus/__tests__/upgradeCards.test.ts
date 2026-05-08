// upgradeCards.test.ts — UpgradeCardsUI: show/hide lifecycle, animation state
// machine, input routing, and destroy.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UpgradeDef } from '@gameplay/upgrades/upgradeRegistry';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@gameplay/upgrades/upgradeRegistry', () => ({
  UPGRADE_REGISTRY: [],
}));

vi.mock('gsap', () => {
  const g = { to: vi.fn(), ticker: { lagSmoothing: vi.fn() }, registerPlugin: vi.fn() };
  return { default: g, gsap: g };
});

vi.mock('pixi.js', () => {
  class MockText {
    text = '';
    alpha = 1;
    scale = { set: vi.fn(), x: 1, y: 1 };
    anchor = { set: vi.fn() };
    position = { set: vi.fn(), x: 0, y: 0 };
    x = 0;
    y = 0;
    constructor(opts: { text?: string } = {}) { this.text = opts.text ?? ''; }
  }
  class MockGraphics {
    alpha = 1;
    clear = vi.fn().mockReturnThis();
    roundRect = vi.fn().mockReturnThis();
    rect = vi.fn().mockReturnThis();
    fill = vi.fn().mockReturnThis();
    stroke = vi.fn().mockReturnThis();
  }
  class MockContainer {
    children: unknown[] = [];
    x = 0;
    y = 0;
    addChild = vi.fn((...items: unknown[]) => { this.children.push(...items); });
    removeChildren = vi.fn(() => { this.children = []; });
  }
  class MockTextStyle {}
  return { Text: MockText, Graphics: MockGraphics, Container: MockContainer, TextStyle: MockTextStyle };
});

import { Container } from 'pixi.js';
import { UpgradeCardsUI } from '../upgradeCards';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fakeCard(id: string): UpgradeDef {
  return { id, name: id, desc: `${id} desc`, icon: id[0], stackable: false, apply: vi.fn() };
}

function threeCards(): UpgradeDef[] {
  return [fakeCard('a'), fakeCard('b'), fakeCard('c')];
}

function makeUI() {
  const layer = new Container();
  return new UpgradeCardsUI(layer as never);
}

const noInput = { select1: false, select2: false, select3: false, reroll: false };

// ── show / hide lifecycle ─────────────────────────────────────────────────────

describe('UpgradeCardsUI.show()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('sets _visible to true', () => {
    const ui = makeUI();
    ui.show(threeCards(), 0);
    expect((ui as any)._visible).toBe(true);
  });

  it('creates one card entry per card def', () => {
    const ui = makeUI();
    ui.show(threeCards(), 0);
    expect((ui as any)._cards).toHaveLength(3);
  });

  it('all cards start at offscreenY', () => {
    const ui = makeUI();
    ui.show(threeCards(), 0);
    const cards = (ui as any)._cards;
    const offY = (ui as any)._offscreenY;
    for (const c of cards) {
      expect(c.container.y).toBe(offY);
    }
  });

  it('starts _animState in "in"', () => {
    const ui = makeUI();
    ui.show(threeCards(), 0);
    expect((ui as any)._animState).toBe('in');
  });

  it('replacing an existing show resets the animation', () => {
    const ui = makeUI();
    ui.show(threeCards(), 0);
    ui.show([fakeCard('x')], 0);
    expect((ui as any)._animState).toBe('in');
    expect((ui as any)._animTimer).toBe(0);
  });
});

describe('UpgradeCardsUI.hide()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('is a no-op when not visible', () => {
    const ui = makeUI();
    expect(() => ui.hide()).not.toThrow();
    expect((ui as any)._animState).toBe('idle');
  });

  it('sets _visible to false', () => {
    const ui = makeUI();
    ui.show(threeCards(), 0);
    ui.hide();
    expect((ui as any)._visible).toBe(false);
  });

  it('transitions _animState to "out"', () => {
    const ui = makeUI();
    ui.show(threeCards(), 0);
    ui.hide();
    expect((ui as any)._animState).toBe('out');
  });
});

// ── update() animation state machine ─────────────────────────────────────────

describe('UpgradeCardsUI.update() — slide-in animation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('completes "in" animation and snaps cards to targetY', () => {
    const ui = makeUI();
    ui.show(threeCards(), 0);
    ui.update(1.0);
    const cards = (ui as any)._cards;
    for (const c of cards) {
      expect(c.container.y).toBe(c.targetY);
    }
    expect((ui as any)._animState).toBe('idle');
  });

  it('stagger: second card lags behind first on early tick', () => {
    const ui = makeUI();
    ui.show(threeCards(), 0);
    const offY = (ui as any)._offscreenY;
    ui.update(0.05); // card 1 delay (0.1s) not yet elapsed
    const cards = (ui as any)._cards;
    expect(cards[0].container.y).not.toBe(offY); // card 0 moved
    expect(cards[1].container.y).toBe(offY);      // card 1 still off-screen
  });

  it('update during idle does nothing', () => {
    const ui = makeUI();
    ui.show(threeCards(), 0);
    ui.update(1.0); // complete slide-in → idle
    const cards = (ui as any)._cards;
    const yBefore = cards[0].container.y;
    ui.update(0.5);
    expect(cards[0].container.y).toBe(yBefore);
  });
});

describe('UpgradeCardsUI.update() — slide-out animation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('clears layer after "out" animation completes', () => {
    const ui = makeUI();
    ui.show(threeCards(), 0);
    ui.update(1.0); // complete slide-in
    ui.hide();
    ui.update(0.25); // 0.25 > 0.2s duration → completes
    expect((ui as any)._cards).toHaveLength(0);
    expect((ui as any)._animState).toBe('idle');
  });
});

// ── checkInput() ──────────────────────────────────────────────────────────────

describe('UpgradeCardsUI.checkInput()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns null when not visible', () => {
    const ui = makeUI();
    expect(ui.checkInput({ select1: true, select2: false, select3: false, reroll: false }, null)).toBeNull();
  });

  it('returns 0 for select1', () => {
    const ui = makeUI();
    ui.show(threeCards(), 0);
    expect(ui.checkInput({ ...noInput, select1: true }, null)).toBe(0);
  });

  it('returns 1 for select2', () => {
    const ui = makeUI();
    ui.show(threeCards(), 0);
    expect(ui.checkInput({ ...noInput, select2: true }, null)).toBe(1);
  });

  it('returns 2 for select3', () => {
    const ui = makeUI();
    ui.show(threeCards(), 0);
    expect(ui.checkInput({ ...noInput, select3: true }, null)).toBe(2);
  });

  it('returns "reroll" for reroll key', () => {
    const ui = makeUI();
    ui.show(threeCards(), 0);
    expect(ui.checkInput({ ...noInput, reroll: true }, null)).toBe('reroll');
  });

  it('returns null for no input, no tap', () => {
    const ui = makeUI();
    ui.show(threeCards(), 0);
    expect(ui.checkInput(noInput, null)).toBeNull();
  });

  it('tap within first card bounds returns 0', () => {
    const ui = makeUI();
    ui.show(threeCards(), 0);
    const b = (ui as any)._cardBounds[0];
    expect(ui.checkInput(noInput, { x: b.x + b.w / 2, y: b.y + b.h / 2 })).toBe(0);
  });

  it('tap within second card bounds returns 1', () => {
    const ui = makeUI();
    ui.show(threeCards(), 0);
    const b = (ui as any)._cardBounds[1];
    expect(ui.checkInput(noInput, { x: b.x + b.w / 2, y: b.y + b.h / 2 })).toBe(1);
  });

  it('tap within reroll bounds returns "reroll"', () => {
    const ui = makeUI();
    ui.show(threeCards(), 0);
    const rb = (ui as any)._rerollBounds;
    expect(ui.checkInput(noInput, { x: rb.x + rb.w / 2, y: rb.y + rb.h / 2 })).toBe('reroll');
  });

  it('tap outside all bounds returns null', () => {
    const ui = makeUI();
    ui.show(threeCards(), 0);
    expect(ui.checkInput(noInput, { x: -9999, y: -9999 })).toBeNull();
  });
});

// ── pulseRerollBtn / destroy ──────────────────────────────────────────────────

describe('UpgradeCardsUI.pulseRerollBtn()', () => {
  it('does not throw when reroll text is present', () => {
    const ui = makeUI();
    ui.show(threeCards(), 1);
    expect(() => ui.pulseRerollBtn()).not.toThrow();
  });

  it('does not throw when called before show (no reroll text)', () => {
    const ui = makeUI();
    expect(() => ui.pulseRerollBtn()).not.toThrow();
  });
});

describe('UpgradeCardsUI.destroy()', () => {
  it('resets animState and clears cards', () => {
    const ui = makeUI();
    ui.show(threeCards(), 0);
    ui.destroy();
    expect((ui as any)._animState).toBe('idle');
    expect((ui as any)._cards).toHaveLength(0);
  });
});
