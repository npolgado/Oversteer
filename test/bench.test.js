// test/bench.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// computeStats inline — mirrors arena-drifter/bench.js implementation
function computeStats(frames) {
  const sorted = [...frames].sort((a, b) => a - b);
  const n = sorted.length;
  const avg = frames.reduce((s, t) => s + t, 0) / n;
  return {
    avgFps: 1000 / avg,
    p50: sorted[Math.floor(n * 0.50)],
    p95: sorted[Math.floor(n * 0.95)],
    p99: sorted[Math.floor(n * 0.99)],
    worstMs: sorted[n - 1],
  };
}

describe('computeStats', () => {
  it('avgFps from uniform 16.67ms frames ≈ 60fps', () => {
    const frames = Array(60).fill(1000 / 60);
    const { avgFps } = computeStats(frames);
    assert.ok(Math.abs(avgFps - 60) < 0.1, `expected ~60 got ${avgFps}`);
  });

  it('worstMs is the max frame time', () => {
    const frames = [10, 16, 20, 50, 14];
    assert.strictEqual(computeStats(frames).worstMs, 50);
  });

  it('p50 indexes into sorted array at floor(n*0.5)', () => {
    // sorted [1..100], floor(100*0.5)=50 → sorted[50]=51 (0-indexed)
    const frames = Array.from({ length: 100 }, (_, i) => i + 1);
    assert.strictEqual(computeStats(frames).p50, 51);
  });

  it('p95 indexes into sorted array at floor(n*0.95)', () => {
    // sorted [1..100], floor(100*0.95)=95 → sorted[95]=96
    const frames = Array.from({ length: 100 }, (_, i) => i + 1);
    assert.strictEqual(computeStats(frames).p95, 96);
  });

  it('p99 indexes into sorted array at floor(n*0.99)', () => {
    // sorted [1..100], floor(100*0.99)=99 → sorted[99]=100
    const frames = Array.from({ length: 100 }, (_, i) => i + 1);
    assert.strictEqual(computeStats(frames).p99, 100);
  });

  it('single frame: avgFps and worstMs match that frame', () => {
    const s = computeStats([33.3]);
    assert.ok(Math.abs(s.avgFps - 1000 / 33.3) < 0.01);
    assert.strictEqual(s.worstMs, 33.3);
  });
});
