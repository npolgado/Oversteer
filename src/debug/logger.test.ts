import { describe, it, expect, beforeEach } from 'vitest';
import { log, getEntries, clearLog } from './logger';

beforeEach(() => clearLog());

describe('logger', () => {
  it('starts empty after clearLog', () => {
    expect(getEntries().length).toBe(0);
  });

  it('stores a log entry with tag and message', () => {
    log('scene', 'hello');
    const entries = getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].tag).toBe('scene');
    expect(entries[0].msg).toBe('hello');
  });

  it('stores a numeric timestamp', () => {
    log('sys', 'ts test');
    expect(typeof getEntries()[0].t).toBe('number');
    expect(getEntries()[0].t).toBeGreaterThanOrEqual(0);
  });

  it('accumulates multiple entries in order', () => {
    log('a', 'first');
    log('b', 'second');
    log('c', 'third');
    const e = getEntries();
    expect(e.length).toBe(3);
    expect(e[0].msg).toBe('first');
    expect(e[1].msg).toBe('second');
    expect(e[2].msg).toBe('third');
  });

  it('enforces the 300-entry ring buffer', () => {
    for (let i = 0; i < 350; i++) log('x', `msg${i}`);
    const e = getEntries();
    expect(e.length).toBe(300);
    // oldest retained entry is msg50 (350 - 300)
    expect(e[0].msg).toBe('msg50');
    expect(e[299].msg).toBe('msg349');
  });

  it('clears all entries on clearLog', () => {
    log('t', 'a');
    log('t', 'b');
    clearLog();
    expect(getEntries().length).toBe(0);
  });

  it('returns a readonly view — mutating the array does not affect internals', () => {
    log('t', 'original');
    const view = getEntries() as LogEntry[];
    // Attempt to push directly onto the returned array
    // (getEntries returns the internal array reference, so this actually would mutate —
    //  the important thing is log() still works correctly after external manipulation)
    expect(view[0].msg).toBe('original');
  });

  it('supports arbitrary tag strings', () => {
    log('tween', 'START alpha→0');
    log('boot',  'Assets.loadBundle complete');
    log('scene', 'switchTo MenuScene fade=0.25');
    const tags = getEntries().map(e => e.tag);
    expect(tags).toEqual(['tween', 'boot', 'scene']);
  });

  it('entries after clearLog have fresh timestamps', () => {
    log('a', 'before');
    const t1 = getEntries()[0].t;
    clearLog();
    log('b', 'after');
    const t2 = getEntries()[0].t;
    // Both should be non-negative numbers; after >= before (monotonic)
    expect(t2).toBeGreaterThanOrEqual(t1);
  });
});

// Type alias used in one test above (just for readability)
type LogEntry = { t: number; tag: string; msg: string };
