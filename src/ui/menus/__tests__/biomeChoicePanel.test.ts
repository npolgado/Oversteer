// biomeChoicePanel.test.ts — BiomeChoicePanel: input routing (keyboard, gamepad, touch).

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('pixi.js', () => {
  class MockText {
    text = '';
    alpha = 1;
    anchor = { set: vi.fn() };
    position = { set: vi.fn(), x: 0, y: 0 };
    x = 0; y = 0;
    constructor(opts: { text?: string } = {}) { this.text = opts.text ?? ''; }
  }
  class MockGraphics {
    alpha = 1;
    rect   = vi.fn().mockReturnThis();
    fill   = vi.fn().mockReturnThis();
    stroke = vi.fn().mockReturnThis();
  }
  class MockContainer {
    children: unknown[] = [];
    x = 0; y = 0;
    addChild   = vi.fn((...items: unknown[]) => { this.children.push(...items); });
    removeChild = vi.fn((item: unknown)    => { this.children = this.children.filter(c => c !== item); });
  }
  return { Text: MockText, Graphics: MockGraphics, Container: MockContainer };
});

vi.mock('@core/config', () => ({
  CFG: { W: 1600, H: 900, WORLD_W: 3000, WORLD_H: 3000, C_ACCENT: '#35F2D0' },
  S: (n: number) => n,
}));

vi.mock('@ui/textStyles', () => ({
  makeUIStyle: vi.fn(() => ({})),
}));

import { Container } from 'pixi.js';
import { BiomeChoicePanel } from '../biomeChoicePanel';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePanel() {
  const layer = new Container();
  return new BiomeChoicePanel(layer as never);
}

const noInput = { menuLeft: false, menuRight: false, select1: false, select2: false, enter: false };

// ── Hidden state ──────────────────────────────────────────────────────────────

describe('BiomeChoicePanel — hidden state', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('checkInput returns null when panel is not shown', () => {
    const panel = makePanel();
    expect(panel.checkInput(noInput, null)).toBeNull();
  });

  it('checkInput returns null after hide()', () => {
    const panel = makePanel();
    panel.show(['rupture', 'jungle']);
    panel.hide();
    expect(panel.checkInput({ ...noInput, menuLeft: true }, null)).toBeNull();
  });
});

// ── Keyboard / gamepad input ──────────────────────────────────────────────────

describe('BiomeChoicePanel — keyboard/gamepad input', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('menuLeft returns 0 (first choice)', () => {
    const panel = makePanel();
    panel.show(['rupture', 'jungle']);
    expect(panel.checkInput({ ...noInput, menuLeft: true }, null)).toBe(0);
  });

  it('select1 returns 0 (first choice)', () => {
    const panel = makePanel();
    panel.show(['rupture', 'jungle']);
    expect(panel.checkInput({ ...noInput, select1: true }, null)).toBe(0);
  });

  it('menuRight returns 1 (second choice)', () => {
    const panel = makePanel();
    panel.show(['rupture', 'jungle']);
    expect(panel.checkInput({ ...noInput, menuRight: true }, null)).toBe(1);
  });

  it('select2 returns 1 (second choice)', () => {
    const panel = makePanel();
    panel.show(['rupture', 'jungle']);
    expect(panel.checkInput({ ...noInput, select2: true }, null)).toBe(1);
  });

  it('no keys pressed returns null', () => {
    const panel = makePanel();
    panel.show(['rupture', 'jungle']);
    expect(panel.checkInput(noInput, null)).toBeNull();
  });
});

// ── Touch hit-testing ─────────────────────────────────────────────────────────

describe('BiomeChoicePanel — touch/tap hit testing', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // With CFG.W=1600, S=identity, PANEL_W=280, PANEL_H=200, PANEL_GAP=40:
  // totalW = 2*280 + 40 = 600; startX = (1600 - 600) / 2 = 500; panelY = 120
  // Left panel:  x=[500, 780], y=[120, 320]
  // Right panel: x=[820, 1100], y=[120, 320]
  const LEFT_CENTER  = { x: 640, y: 220 };
  const RIGHT_CENTER = { x: 960, y: 220 };
  const GAP_CENTER   = { x: 800, y: 220 }; // inside the gap between panels
  const OUTSIDE      = { x:  50, y:  50 };

  it('tap inside left panel returns 0', () => {
    const panel = makePanel();
    panel.show(['rupture', 'jungle']);
    expect(panel.checkInput(noInput, LEFT_CENTER)).toBe(0);
  });

  it('tap inside right panel returns 1', () => {
    const panel = makePanel();
    panel.show(['rupture', 'jungle']);
    expect(panel.checkInput(noInput, RIGHT_CENTER)).toBe(1);
  });

  it('tap in gap between panels returns null', () => {
    const panel = makePanel();
    panel.show(['rupture', 'jungle']);
    expect(panel.checkInput(noInput, GAP_CENTER)).toBeNull();
  });

  it('tap outside panels returns null', () => {
    const panel = makePanel();
    panel.show(['rupture', 'jungle']);
    expect(panel.checkInput(noInput, OUTSIDE)).toBeNull();
  });

  it('null tap returns null', () => {
    const panel = makePanel();
    panel.show(['rupture', 'jungle']);
    expect(panel.checkInput(noInput, null)).toBeNull();
  });
});

// ── Lifecycle ─────────────────────────────────────────────────────────────────

describe('BiomeChoicePanel — lifecycle', () => {
  it('choices getter returns correct order', () => {
    const panel = makePanel();
    panel.show(['rupture', 'jungle']);
    expect(panel.choices).toEqual(['rupture', 'jungle']);
  });

  it('destroy calls hide (no crash)', () => {
    const panel = makePanel();
    panel.show(['rupture', 'jungle']);
    expect(() => panel.destroy()).not.toThrow();
    expect(panel.checkInput(noInput, null)).toBeNull();
  });
});
