/// <reference types="vite/client" />
// logger.ts — global ring-buffer event log.
//
// Every log() call:
//   1. Pushes to the in-memory ring buffer (read by debugOverlay).
//   2. Writes to the browser console immediately (console.log, always visible).
//   3. In DEV: queues for flush to the Vite dev server (POST /api/log),
//      which appends to logs/game.log so the file can be read from disk.
//
// Usage: import { log } from '@debug/logger'; log('scene', 'switchTo MenuScene');

export interface LogEntry {
  t: number;   // seconds since page load
  tag: string;
  msg: string;
}

const _entries: LogEntry[] = [];
const _pending: string[] = [];  // lines queued for server flush
const MAX = 300;

// Flush-failure tracking: warn once to console after 5 consecutive POST failures.
let _consecutiveFlushFails = 0;
let _flushFailAlertFired = false;
const FLUSH_FAIL_THRESHOLD = 5;

// Cached dynamic import of errorBanner — loaded lazily on first logError call.
// Using dynamic import (not static) prevents circular dep: logger ← banner ← nothing,
// but if banner ever used logger, static import would create a cycle.
let _bannerModulePromise: Promise<{ pushError: (t: string, m: string) => void }> | null = null;
function _getBannerModule(): Promise<{ pushError: (t: string, m: string) => void }> | null {
  if (typeof document === 'undefined') return null;
  if (!_bannerModulePromise) {
    _bannerModulePromise = import('./errorBanner') as Promise<{ pushError: (t: string, m: string) => void }>;
  }
  return _bannerModulePromise;
}

// Intercept console.error so Pixi's internal ticker error handler (which calls
// console.error instead of re-throwing) gets captured by our logger too.
// Pixi v8 swallows exceptions thrown in ticker callbacks — they never reach
// window.addEventListener('error'), so this is the only way to catch them.
const _origError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  _origError(...args);
  const msg = args.map(a => (a instanceof Error ? `${a.message}\n${a.stack}` : String(a))).join(' ');
  log('console', `ERROR: ${msg}`);
  _flushToDisk(); // flush immediately on errors
};

// Same for console.warn — Pixi and Howler both use it for non-fatal issues.
const _origWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  _origWarn(...args);
  const msg = args.map(a => String(a)).join(' ');
  log('console', `WARN: ${msg}`);
};

// Start the periodic flush to disk as soon as the module loads (DEV only).
if (import.meta.env.DEV) {
  setInterval(_flushToDisk, 500);
  // Stamp each session in the ring buffer so the debug overlay shows session boundaries.
  // (The disk log gets a session header from the Vite plugin on server restart.)
  setTimeout(() => log('sys', '--- session start ---'), 0);
}

export function log(tag: string, msg: string): void {
  const t = performance.now() / 1000;
  _entries.push({ t, tag, msg });
  if (_entries.length > MAX) _entries.shift();

  const line = `[${t.toFixed(3)}] [${tag}] ${msg}`;
  _pending.push(line);

  // console.log (not debug) so it shows at the default Chrome filter level
  // eslint-disable-next-line no-console
  console.log(line);
}

export function logError(tag: string, msg: string, err?: unknown): void {
  const detail = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err ?? '');
  log(tag, `ERROR: ${msg}${detail ? ` — ${detail}` : ''}`);
  // eslint-disable-next-line no-console
  console.error(`[${tag}] ${msg}`, err);
  // Flush immediately on errors so we don't lose them
  _flushToDisk();
  // Surface in the DOM error banner (async — won't block; no-op in non-browser envs)
  _getBannerModule()?.then(m => m.pushError(tag, msg)).catch(() => {});
}

export function getEntries(): readonly LogEntry[] {
  return _entries;
}

export function clearLog(): void {
  _entries.length = 0;
}

function _bumpFlushFail(): void {
  _consecutiveFlushFails++;
  if (_consecutiveFlushFails >= FLUSH_FAIL_THRESHOLD && !_flushFailAlertFired) {
    _flushFailAlertFired = true;
    // Use _origWarn so this doesn't re-enter our console.warn intercept.
    _origWarn(`[logger] Disk log offline — ${_consecutiveFlushFails} consecutive flush failures; check Vite dev server`);
  }
}

function _flushToDisk(): void {
  if (_pending.length === 0) return;
  const lines = _pending.splice(0);
  fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lines }),
  })
    .then(r => {
      if (r.ok) {
        _consecutiveFlushFails = 0;
        _flushFailAlertFired = false;
      } else {
        _bumpFlushFail();
      }
    })
    .catch(() => _bumpFlushFail());
}
