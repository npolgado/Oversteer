// utils.ts — Math/utility helpers ported from arena-drifter/logic.js (U object).
// Canvas2D drawing helpers (drawRotatedRect, roundRect, text, wrapText) are
// intentionally omitted — they are Canvas2D-only and not needed in the PixiJS stack.

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function randInt(a: number, b: number): number {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

export function randFloat(a: number, b: number): number {
  return Math.random() * (b - a) + a;
}

export function randChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randSample<T>(arr: T[], n: number): T[] {
  const copy = arr.slice();
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

export function approach(cur: number, tgt: number, step: number): number {
  if (cur < tgt) return Math.min(cur + step, tgt);
  if (cur > tgt) return Math.max(cur - step, tgt);
  return tgt;
}

export function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

export function angleLerp(a: number, b: number, t: number): number {
  return a + normalizeAngle(b - a) * t;
}

export function angleDiff(a: number, b: number): number {
  return normalizeAngle(b - a);
}

export function vec2FromAngle(a: number): { x: number; y: number } {
  return { x: Math.cos(a), y: Math.sin(a) };
}

export function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

/**
 * Namespace object for backward compatibility with Phase 1 code that references
 * `U.lerp`, `U.clamp`, etc.
 */
export const U = {
  lerp,
  clamp,
  randInt,
  randFloat,
  randChoice,
  randSample,
  approach,
  normalizeAngle,
  angleLerp,
  angleDiff,
  vec2FromAngle,
  dist,
} as const;
