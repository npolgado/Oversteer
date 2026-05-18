// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { probeCoveringOverlays } from '../domOverlayProbe';

// Helper: append an element with the given cssText, then mock its bounding rect.
function makeDiv(
  cssText: string,
  rect = { x: 0, y: 0, width: 1920, height: 1080 },
  extra?: (el: HTMLDivElement) => void,
): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = cssText;
  if (extra) extra(el);
  Object.defineProperty(el, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: rect.x, y: rect.y,
      width: rect.width, height: rect.height,
      top: rect.y, left: rect.x,
      bottom: rect.y + rect.height, right: rect.x + rect.width,
      toJSON: () => ({}),
    }),
  });
  document.body.appendChild(el);
  return el;
}

// Use a fake canvas at 1920×900 so coverage checks are predictable.
function makeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  Object.defineProperty(c, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ x: 0, y: 0, width: 1920, height: 1080, top: 0, left: 0, bottom: 1080, right: 1920, toJSON: () => ({}) }),
  });
  return c;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('probeCoveringOverlays', () => {
  it('returns [] when body is empty', () => {
    expect(probeCoveringOverlays(null)).toEqual([]);
  });

  it('flags the exact _domFadeIn overlay pattern', () => {
    const mountedAt = String(performance.now() - 3000);
    makeDiv(
      'position:fixed;inset:0;background-color:rgb(0,0,0);opacity:1;z-index:99990;pointer-events:none',
      { x: 0, y: 0, width: 1920, height: 1080 },
      el => { el.dataset.mountedAt = mountedAt; el.dataset.role = 'scene-fade'; },
    );

    const results = probeCoveringOverlays(makeCanvas());
    expect(results.length).toBe(1);
    expect(results[0].zIndex).toBe(99990);
    expect(results[0].opacity).toBe(1);
    expect(results[0].ageMs).toBeGreaterThan(2900);
  });

  it('does NOT flag a display:none element', () => {
    makeDiv('position:fixed;inset:0;background-color:rgb(0,0,0);opacity:1;z-index:99990;display:none');
    expect(probeCoveringOverlays(null)).toEqual([]);
  });

  it('does NOT flag a low-opacity element (opacity 0.3)', () => {
    makeDiv('position:fixed;inset:0;background-color:rgb(0,0,0);opacity:0.3;z-index:99990');
    expect(probeCoveringOverlays(null)).toEqual([]);
  });

  it('does NOT flag an element with z-index < 1000', () => {
    makeDiv('position:fixed;inset:0;background-color:rgb(0,0,0);opacity:1;z-index:500');
    expect(probeCoveringOverlays(null)).toEqual([]);
  });

  it('does NOT flag #oversteer-debug even if it has all suspect attributes', () => {
    const el = makeDiv('position:fixed;inset:0;background-color:rgb(0,0,0);opacity:1;z-index:99999');
    el.id = 'oversteer-debug';
    expect(probeCoveringOverlays(null)).toEqual([]);
  });

  it('does NOT flag #oversteer-error-banner', () => {
    const el = makeDiv('position:fixed;inset:0;background-color:rgb(160,16,16);opacity:1;z-index:2147483647');
    el.id = 'oversteer-error-banner';
    expect(probeCoveringOverlays(null)).toEqual([]);
  });

  it('does NOT flag a transparent background element', () => {
    makeDiv('position:fixed;inset:0;background-color:rgba(0,0,0,0);opacity:1;z-index:99990');
    expect(probeCoveringOverlays(null)).toEqual([]);
  });

  it('does NOT flag a static-positioned element', () => {
    makeDiv('position:static;background-color:rgb(0,0,0);opacity:1;z-index:99990');
    expect(probeCoveringOverlays(null)).toEqual([]);
  });

  it('does NOT flag an element covering less than 80% of canvas area', () => {
    // Only covers a small portion (50×50) of the 1920×1080 canvas
    makeDiv(
      'position:fixed;background-color:rgb(0,0,0);opacity:1;z-index:99990',
      { x: 0, y: 0, width: 50, height: 50 },
    );
    expect(probeCoveringOverlays(makeCanvas())).toEqual([]);
  });

  it('reports ageMs as NaN when data-mounted-at is absent', () => {
    makeDiv('position:fixed;inset:0;background-color:rgb(0,0,0);opacity:1;z-index:99990');
    const results = probeCoveringOverlays(null);
    expect(results.length).toBe(1);
    expect(isNaN(results[0].ageMs)).toBe(true);
  });

  it('returns suspects sorted by ageMs descending (oldest first)', () => {
    const now = performance.now();
    makeDiv(
      'position:fixed;inset:0;background-color:rgb(0,0,0);opacity:1;z-index:1000',
      { x: 0, y: 0, width: 1920, height: 1080 },
      el => { el.dataset.mountedAt = String(now - 1000); },
    );
    makeDiv(
      'position:fixed;inset:0;background-color:rgb(0,0,0);opacity:1;z-index:2000',
      { x: 0, y: 0, width: 1920, height: 1080 },
      el => { el.dataset.mountedAt = String(now - 5000); },
    );
    const results = probeCoveringOverlays(null);
    expect(results.length).toBe(2);
    expect(results[0].ageMs).toBeGreaterThan(results[1].ageMs);
  });
});
