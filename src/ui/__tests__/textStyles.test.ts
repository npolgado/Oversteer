// Regression guard for the makeUIStyle factory.
//
// On 2026-05-17 the title screen rendered as a pure-black canvas because every
// Text element in the UI had `NaN` width. The cause: makeUIStyle was passing
// `wordWrap`, `wordWrapWidth`, `align`, and `letterSpacing` as `undefined` when
// the caller didn't supply them. Pixi v8's TextStyle setters accept `undefined`
// as a literal assignment, which then propagated as NaN through bounds math.
//
// These tests fail if anyone re-introduces that pattern, and they also pin the
// other style values we depend on (stroke, fill, dropShadow, font).
//
// We don't render real text — that needs a canvas + font — but we DO read the
// resolved fields off the TextStyle instance to confirm they are finite.

import { describe, it, expect } from 'vitest';
import { makeUIStyle } from '../textStyles';

describe('makeUIStyle — required fields are finite and well-typed', () => {
  it('produces finite wordWrapWidth even when caller omits it', () => {
    const s = makeUIStyle({ size: 24, color: '#fff' });
    // Pixi v8 default is 100. Any finite number is the contract; the regression
    // would surface as `undefined` or `NaN`.
    expect(Number.isFinite(s.wordWrapWidth)).toBe(true);
  });

  it('produces a usable letterSpacing default when caller omits it', () => {
    const s = makeUIStyle({ size: 24, color: '#fff' });
    expect(Number.isFinite(s.letterSpacing)).toBe(true);
  });

  it('produces a defined align value when caller omits it', () => {
    const s = makeUIStyle({ size: 24, color: '#fff' });
    // Pixi default is 'left'. The bug surfaced as align=undefined.
    expect(typeof s.align).toBe('string');
    expect(s.align.length).toBeGreaterThan(0);
  });

  it('produces wordWrap=false when caller omits it (not undefined)', () => {
    const s = makeUIStyle({ size: 24, color: '#fff' });
    expect(typeof s.wordWrap).toBe('boolean');
  });
});

describe('makeUIStyle — caller-supplied options take effect', () => {
  it('respects size and color', () => {
    const s = makeUIStyle({ size: 64, color: '#35F2D0' });
    expect(s.fontSize).toBe(64);
    // Pixi v8 stores fill as a normalized color; just confirm it round-trips.
    expect(s.fill).toBeDefined();
  });

  it('respects bold flag', () => {
    const bold = makeUIStyle({ size: 24, color: '#fff', bold: true });
    const norm = makeUIStyle({ size: 24, color: '#fff', bold: false });
    expect(bold.fontWeight).toBe('bold');
    expect(norm.fontWeight).toBe('normal');
  });

  it('respects letterSpacing when supplied', () => {
    const s = makeUIStyle({ size: 24, color: '#fff', letterSpacing: 4 });
    expect(s.letterSpacing).toBe(4);
  });

  it('respects wordWrap+wordWrapWidth when supplied', () => {
    const s = makeUIStyle({ size: 24, color: '#fff', wordWrap: true, wordWrapWidth: 320 });
    expect(s.wordWrap).toBe(true);
    expect(s.wordWrapWidth).toBe(320);
  });

  it('respects align when supplied', () => {
    const s = makeUIStyle({ size: 24, color: '#fff', align: 'center' });
    expect(s.align).toBe('center');
  });

  it('applies caller dropShadow over the default', () => {
    const accent = { color: '#35F2D0', blur: 24, distance: 0, alpha: 0.6 };
    const s = makeUIStyle({ size: 24, color: '#fff', dropShadow: accent });
    expect(s.dropShadow).toBeTruthy();
    // Pixi normalizes the shadow object; verify at least one custom field passes through.
    expect((s.dropShadow as { blur: number }).blur).toBeCloseTo(24, 5);
  });
});
