// Tests for layerInspect — the diagnostic that surfaced the NaN-width bug.
//
// We do not depend on Pixi here — a tiny duck-typed Container stand-in is
// enough to verify the formatter's output shape. The whole point is that the
// inspector reports the underlying numeric values verbatim, so a downstream
// reader of logs/game.log can spot `NaNx86` and identify a broken layout.

import { describe, it, expect } from 'vitest';
import { describeChild, layerSnapshot } from '../layerInspect';

interface FakeChild {
  alpha?: number;
  visible?: boolean;
  width?: number;
  height?: number;
  position?: { x: number; y: number };
  text?: unknown;
  texture?: { label?: string };
  label?: string;
  children?: FakeChild[];
  constructor: { name: string };
}

function makeText(text: string, x: number, y: number, w: number, h: number, alpha = 1): FakeChild {
  // Mimic a Pixi v8 Text: has `text` + `width`/`height` from bounds.
  return {
    alpha, visible: true, width: w, height: h,
    position: { x, y }, text,
    constructor: { name: 'Text' },
  };
}

function makeContainer(name: string, children: FakeChild[] = []): FakeChild {
  return {
    alpha: 1, visible: true, width: 0, height: 0,
    position: { x: 0, y: 0 }, children,
    constructor: { name },
  };
}

describe('describeChild — surfaces NaN dimensions visibly', () => {
  it('renders NaN width as "NaN" so the bug is obvious in logs', () => {
    const t = makeText('OVERSTEER', 800, 315, NaN, 86, 0.75);
    const line = describeChild(t as never, 1);
    // The regression: title text with NaN width that previously printed as `0`
    // or got silently coerced. The inspector MUST surface "NaN" so it stands out.
    expect(line).toContain('NaN');
    expect(line).toContain('OVERSTEER');
  });

  it('renders finite dimensions as numbers without NaN', () => {
    const t = makeText('OVERSTEER', 800, 315, 435, 86);
    const line = describeChild(t as never, 1);
    expect(line).not.toContain('NaN');
    expect(line).toContain('435x86');
  });
});

describe('describeChild — Text node does not report TEX=NULL (Fix 5 regression)', () => {
  it('Text node with no .texture property does not produce TEX=NULL!', () => {
    // Pixi v8 Text extends Container, not Sprite — .texture is undefined.
    // layerInspect must skip the texture check for nodes that have a .text property.
    const t = makeText('GAME OVER', 800, 100, 328, 66);
    // Explicitly confirm no .texture on the fixture (mirrors real Pixi Text behaviour)
    expect((t as any).texture).toBeUndefined();
    const line = describeChild(t as never, 0);
    expect(line).not.toContain('TEX=NULL!');
  });

  it('non-Text node with undefined .texture still reports TEX=NULL!', () => {
    const sprite = {
      alpha: 1, visible: true, width: 64, height: 64,
      position: { x: 0, y: 0 },
      texture: undefined,               // Sprite with missing texture — real problem
      constructor: { name: 'Sprite' },
    };
    const line = describeChild(sprite as never, 0);
    expect(line).toContain('TEX=NULL!');
  });
});

describe('describeChild — text preview', () => {
  it('quotes text content and includes type', () => {
    const t = makeText('BEST: 12345', 800, 432, 170, 26);
    const line = describeChild(t as never, 2);
    expect(line).toMatch(/Text/);
    expect(line).toContain('"BEST: 12345"');
  });

  it('truncates long text', () => {
    const long = 'a'.repeat(120);
    const t = makeText(long, 0, 0, 800, 30);
    const line = describeChild(t as never, 0);
    expect(line.length).toBeLessThan(220);
    expect(line).toMatch(/…/);
  });
});

describe('layerSnapshot — full container summary', () => {
  it('emits one line per child plus a header', () => {
    const overlay = makeContainer('Container', [
      makeText('OVERSTEER', 800, 315, 435, 86),
      makeText('BEST: 0',    800, 432, 170, 26),
    ]);
    const lines = layerSnapshot('overlayLayer', overlay as never);
    expect(lines.length).toBe(3); // header + 2 children
    expect(lines[0]).toMatch(/overlayLayer:/);
    expect(lines[0]).toMatch(/ch=2/);
    expect(lines[1]).toContain('OVERSTEER');
    expect(lines[2]).toContain('BEST: 0');
  });

  it('lists an empty container with ch=0 and no child rows', () => {
    const lines = layerSnapshot('emptyLayer', makeContainer('Container', []) as never);
    expect(lines.length).toBe(1);
    expect(lines[0]).toMatch(/ch=0/);
  });
});
