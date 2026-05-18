// @vitest-environment jsdom
//
// Tests for renderProbe — the pixel-sampling diagnostic. jsdom doesn't
// implement canvas 2D context, so we can't exercise probeRenderOutput's
// drawImage/getImageData path here. Instead we cover:
//
//   1. probeRenderOutput's null/zero-size guards (no canvas API needed)
//   2. formatRenderProbe's output for each report variant (pure function)
//
// Full pixel-reading is verified in the live `npm run dev` log, where the
// probe is what surfaced the "uniqueColors=1 [#000000]" signal that pointed
// at the NaN-text bug.

import { describe, it, expect } from 'vitest';
import {
  probeRenderOutput,
  formatRenderProbe,
  type RenderProbeReport,
} from '../renderProbe';

function reportFromSamples(samples: Array<{ r: number; g: number; b: number }>): RenderProbeReport {
  return {
    ok: true,
    reason: 'ok',
    canvasW: 100,
    canvasH: 100,
    samples: samples.map((s, i) => ({ x: i, y: i, a: 255, ...s })),
    clearColorHex: '#07080b',
    uniqueColors: new Set(samples.map(s => `${s.r},${s.g},${s.b}`)).size,
  };
}

describe('probeRenderOutput — guards', () => {
  it('reports no-canvas when given null', () => {
    const r = probeRenderOutput(null);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no-canvas');
    expect(r.samples).toEqual([]);
  });

  it('reports zero-size when canvas has 0 dimensions', () => {
    const c = document.createElement('canvas');
    c.width = 0;
    c.height = 0;
    const r = probeRenderOutput(c);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('zero-size');
  });
});

describe('formatRenderProbe', () => {
  it('renders OK summary with unique color count for single-color canvas', () => {
    const r = reportFromSamples([
      { r: 255, g: 0, b: 0 },
      { r: 255, g: 0, b: 0 },
      { r: 255, g: 0, b: 0 },
      { r: 255, g: 0, b: 0 },
      { r: 255, g: 0, b: 0 },
    ]);
    const line = formatRenderProbe(r);
    expect(line).toContain('OK');
    expect(line).toContain('uniqueColors=1');
    expect(line).toContain('#ff0000');
  });

  it('renders OK summary with multiple unique colors', () => {
    const r = reportFromSamples([
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 0 },
      { r: 0, g: 0, b: 255 },
      { r: 255, g: 255, b: 0 },
      { r: 128, g: 128, b: 128 },
    ]);
    const line = formatRenderProbe(r);
    expect(line).toContain('uniqueColors=5');
  });

  it('renders BLANK warning when all samples match clear color', () => {
    const r: RenderProbeReport = {
      ok: false, reason: 'all-clear',
      canvasW: 1600, canvasH: 900,
      samples: [
        { x: 800, y: 450, r: 0x07, g: 0x08, b: 0x0b, a: 255 },
      ],
      clearColorHex: '#07080b',
      uniqueColors: 1,
    };
    const line = formatRenderProbe(r);
    expect(line).toContain('BLANK');
    expect(line).toContain('#07080b');
  });

  it('renders NO CANVAS when probe failed at the guard', () => {
    const r: RenderProbeReport = {
      ok: false, reason: 'no-canvas',
      canvasW: 0, canvasH: 0, samples: [], clearColorHex: '#07080b', uniqueColors: 0,
    };
    expect(formatRenderProbe(r)).toBe('render: NO CANVAS');
  });

  it('renders ZERO SIZE with dimensions', () => {
    const r: RenderProbeReport = {
      ok: false, reason: 'zero-size',
      canvasW: 0, canvasH: 0, samples: [], clearColorHex: '#07080b', uniqueColors: 0,
    };
    expect(formatRenderProbe(r)).toContain('ZERO SIZE');
  });

  it('renders READ FAILED with dimensions', () => {
    const r: RenderProbeReport = {
      ok: false, reason: 'read-failed',
      canvasW: 1600, canvasH: 900, samples: [], clearColorHex: '#07080b', uniqueColors: 0,
    };
    expect(formatRenderProbe(r)).toContain('READ FAILED');
    expect(formatRenderProbe(r)).toContain('1600x900');
  });
});
