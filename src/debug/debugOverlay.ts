/// <reference types="vite/client" />
// debugOverlay.ts — DOM-based debug panel + periodic console state dumps.
//
// In DEV builds the overlay is visible immediately and the console receives
// a full Pixi layer state dump every 3 seconds — no key-press required, so
// you can debug blank-screen and boot-failure cases without any interaction.
//
// In PROD the overlay is hidden by default; press ` or F2 to reveal.
//
// Call initDebugOverlay() once after PixiApp.init().
// Call setCurrentScene(name) from sceneManager on every scene switch.

import type { Container } from 'pixi.js';
import gsap from 'gsap';
import { PixiApp } from '@render/pixiApp';
import { getEntries, log } from './logger';
import { probeCoveringOverlays } from './domOverlayProbe';
import { getWatchdogState } from './watchdog';
import { layerSnapshot, checkAncestorTransforms } from './layerInspect';
import { probeRenderOutput, formatRenderProbe } from './renderProbe';

const IS_DEV = import.meta.env.DEV;

let _el: HTMLDivElement | null = null;
let _visible = false;
let _rafId = 0;
let _dumpIntervalId = 0;
let _blankReadCount = 0;
let _tlPausedConsecutive = 0;
let _pausePredicate: (() => boolean) | null = null;

/**
 * Register a predicate that returns true when the game is intentionally paused.
 * The stuck-GSAP watchdog skips its counter while this returns true so a player
 * pausing for >9s doesn't trigger a false-positive error.
 */
export function registerPausePredicate(pred: () => boolean): void {
  _pausePredicate = pred;
}

export function unregisterPausePredicate(): void {
  _pausePredicate = null;
}

/** Exposed for tests only — returns the currently registered pause predicate. */
export function _getPausePredicateForTest(): (() => boolean) | null {
  return _pausePredicate;
}

/**
 * Pure helper for the stuck-GSAP alarm: returns true when _tlPausedConsecutive
 * should be incremented this dump cycle.
 * Extracted for unit testing — the _dumpState() caller is not easily exercised in isolation.
 */
export function _shouldIncrementStuckPauseCounter(
  tlPaused: boolean,
  sceneName: string,
  predicate: (() => boolean) | null,
): boolean {
  if (!tlPaused) return false;
  const _PAUSE_EXEMPT = new Set(['(none)', 'BootScene']);
  if (_PAUSE_EXEMPT.has(sceneName)) return false;
  return !(predicate?.() ?? false);
}

// DOM probe cache — re-scan at most once per second to keep RAF cheap.
let _lastProbeTime = 0;
let _lastProbeLines: string[] = [];

export let currentSceneName = '(none)';
export function setCurrentScene(name: string): void {
  currentSceneName = name;
  // Reset per-scene counters so alerts don't carry over across transitions
  _blankReadCount = 0;
  _tlPausedConsecutive = 0;
}

// ---------------------------------------------------------------------------
// Periodic console state dump — runs every 3 s in DEV, completely independent
// of the overlay toggle. Lets you see what Pixi is doing even on a blank screen.
// ---------------------------------------------------------------------------
function _dumpState(): void {
  if (!IS_DEV) return;
  try {
    const pa = PixiApp;
    const ol = pa.overlayLayer as unknown as Container;
    const wc = pa.worldContainer as unknown as Container;
    const ui = pa.uiContainer as unknown as Container;
    const sf = pa.screenFxContainer as unknown as Container;

    let tweens = '?';
    try { tweens = String(gsap.globalTimeline.getChildren(true, true, false).length); } catch (_) {}

    const tlPaused = gsap.globalTimeline.paused();
    log('state',
      `scene=${currentSceneName}  ` +
      `overlay α=${ol.alpha.toFixed(2)} ch=${ol.children.length}  ` +
      `world α=${wc.alpha.toFixed(2)}  ` +
      `ui α=${ui.alpha.toFixed(2)}  ` +
      `screenFx α=${sf.alpha.toFixed(2)} ch=${sf.children.length}  ` +
      `gsap=${tweens}  tlPaused=${tlPaused}`
    );

    // GSAP stuck-paused alarm: if globalTimeline stays paused for 3+ consecutive dumps
    // outside BootScene or scene-none, it's a bug (game paused the timeline and never resumed).
    // Skip the counter when the game is intentionally paused (registered predicate returns true).
    if (_shouldIncrementStuckPauseCounter(tlPaused, currentSceneName, _pausePredicate)) {
      _tlPausedConsecutive++;
      if (_tlPausedConsecutive === 3) {
        import('./logger').then(m => m.logError('state',
          `GSAP globalTimeline stuck PAUSED for 3 consecutive state dumps (scene=${currentSceneName}) — check pauseUITweens() / resumeUITweens() balance`
        )).catch(() => {});
      }
    } else {
      _tlPausedConsecutive = 0;
    }

    // Per-child snapshot of overlayLayer — the most common location for "I see nothing"
    // bugs. Knowing the child types/positions/text catches: invisible text, off-screen
    // placement, alpha=0, wrong type, etc. We log the full snapshot since the overlay
    // typically has < 10 children.
    try {
      for (const line of layerSnapshot('overlayLayer', ol)) log('state', line);
    } catch (_) {}

    // Ancestor transform check — catches scale=0/NaN/Infinity or unexpected rotation
    // on parent containers that would make all children invisible regardless of their own α.
    try {
      for (const warn of checkAncestorTransforms(ol as Container)) log('state', `XFORM ${warn}`);
      for (const warn of checkAncestorTransforms(pa.hudLayer as unknown as Container)) log('state', `XFORM ${warn}`);
    } catch (_) {}

    // Pixel sample from the rendered canvas — detects "engine thinks it's drawing
    // but GPU output is the clear color". Reports ok / BLANK / NO CANVAS / etc.
    try {
      const canvas = (pa.app?.canvas ?? null) as HTMLCanvasElement | null;
      const r = probeRenderOutput(canvas);
      log('state', formatRenderProbe(r));

      // Two consecutive single-color reads while a real scene is active = blank screen.
      // uniqueColors===1 catches both the clear color (#07080b) and pure black (#000000),
      // which the previous all-clear check missed entirely.
      // If all samples are fully transparent (a===0), the WebGL canvas was read between
      // frames with preserveDrawingBuffer=false — scratch-canvas pixels are stale zeros.
      // That's not a real blank screen; skip the error to avoid false positives.
      const allTransparent = r.samples.length > 0 && r.samples.every(p => p.a === 0);
      if (r.uniqueColors === 1 && !allTransparent && currentSceneName !== '(none)' && currentSceneName !== 'BootScene') {
        _blankReadCount++;
        if (_blankReadCount === 2) {
          // logError is dynamic-imported here to avoid a circular dep on this file.
          import('./logger').then(m => m.logError(
            'state',
            `BLANK SCREEN — renderer output is single-color (${r.samples[0] ? `#${r.samples[0].r.toString(16).padStart(2,'0')}${r.samples[0].g.toString(16).padStart(2,'0')}${r.samples[0].b.toString(16).padStart(2,'0')}` : '?'}) for 2 consecutive dumps while scene=${currentSceneName}. ` +
            `Check the most recent snapshot lines for child types/positions.`,
          )).catch(() => {});
        }
      } else if (r.uniqueColors > 1) {
        _blankReadCount = 0;
      }
    } catch (_) {}

    // Canvas DOM state — confirms the canvas is mounted with non-zero CSS size and
    // is not hidden behind opacity:0 or display:none from somewhere upstream.
    try {
      const canvas = (pa.app?.canvas ?? null) as HTMLCanvasElement | null;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const cs = getComputedStyle(canvas);
        log('state', `canvas: parent=${canvas.parentElement?.id ?? '(none)'}  rect=${Math.round(rect.width)}x${Math.round(rect.height)}@${Math.round(rect.x)},${Math.round(rect.y)}  cssDisplay=${cs.display}  cssVis=${cs.visibility}  cssOpacity=${cs.opacity}`);
      } else {
        log('state', 'canvas: MISSING (PixiApp.app.canvas is null)');
      }
    } catch (_) {}

    // Report any DOM elements covering the canvas — the most common cause of "black screen
    // but engine thinks it's fine". The _domFadeIn overlay in sceneManager shows here if stuck.
    try {
      const canvas = (pa.app?.canvas ?? null) as HTMLCanvasElement | null;
      const suspects = probeCoveringOverlays(canvas);
      for (const s of suspects) {
        const age = Number.isFinite(s.ageMs) ? `${s.ageMs.toFixed(0)}ms` : '?ms';
        log('domprobe', `COVERING ${s.selector}  z=${s.zIndex}  α=${s.opacity}  bg=${s.bgColor}  age=${age}  rect=${s.rect.w}x${s.rect.h}@${s.rect.x},${s.rect.y}  style="${s.styleSummary}"`);
      }
    } catch (_) {}

    // Report watchdog state if first paint hasn't happened yet (> 1s uptime = not a race).
    try {
      const wd = getWatchdogState();
      if (wd.firstPaintAt == null && performance.now() > 1000) {
        log('state', `NO FIRST PAINT YET (uptime=${(performance.now() / 1000).toFixed(1)}s)`);
      }
    } catch (_) {}

  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[STATE] dump failed:', err);
  }
}

// ---------------------------------------------------------------------------
// DOM overlay — updated via its own RAF loop
// ---------------------------------------------------------------------------
export function initDebugOverlay(): void {
  _el = document.createElement('div');
  _el.id = 'oversteer-debug';
  _el.style.cssText = [
    'position:fixed',
    'top:8px',
    'left:8px',
    'z-index:99999',
    'background:rgba(0,0,0,0.9)',
    'color:#00ff88',
    'font:11px/1.5 "Courier New",monospace',
    'padding:10px 14px',
    'border:1px solid #00aa55',
    'max-height:92vh',
    'overflow-y:auto',
    'min-width:420px',
    'pointer-events:none',
    'display:none',
    'white-space:pre',
    'border-radius:4px',
  ].join(';');
  document.body.appendChild(_el);

  // Toggle via key
  window.addEventListener('keydown', (e) => {
    if (e.key === '`' || e.key === 'F2') {
      _visible = !_visible;
      _el!.style.display = _visible ? 'block' : 'none';
      if (_visible && !_rafId) _rafId = requestAnimationFrame(_tick);
    }
  });

  // In dev: state dumps run in the background (writes to logs/game.log via Vite plugin).
  // Overlay starts hidden — press ` or F2 to reveal.
  if (IS_DEV) {
    _dumpIntervalId = window.setInterval(_dumpState, 3000);
  }
  // eslint-disable-next-line no-console
  console.log('%c[Oversteer Debug] press ` or F2 to open debug overlay', 'color:#00ff88;font-weight:bold');
}

function _layerLine(label: string, c: Container, pad = 22): string {
  return `  ${label.padEnd(pad)} α=${c.alpha.toFixed(3)}  vis=${c.visible ? 'T' : 'F'}  ch=${String(c.children.length).padStart(3)}`;
}

function _watchdogLines(): string[] {
  try {
    const wd = getWatchdogState();
    const paintStr = wd.firstPaintAt != null
      ? `at ${wd.firstPaintAt.toFixed(0)}ms`
      : `NONE (uptime ${(performance.now() / 1000).toFixed(1)}s)`;
    const switchStr = wd.sceneSwitchInFlight
      ? `${wd.sceneSwitchInFlight.name} (${(performance.now() - wd.sceneSwitchInFlight.startedAt).toFixed(0)}ms)`
      : 'none';
    return [
      `  Watchdog:`,
      `    first-paint:    ${paintStr}`,
      `    switch active:  ${switchStr}`,
      `    frames/update:  ${wd.framesSinceLastUpdate}`,
    ];
  } catch (_) {
    return [`  Watchdog: (unavailable)`];
  }
}

function _probeLinesThrottled(pa: typeof PixiApp): string[] {
  const now = performance.now();
  if (now - _lastProbeTime > 1000) {
    _lastProbeTime = now;
    try {
      const canvas = (pa.app?.canvas ?? null) as HTMLCanvasElement | null;
      const suspects = probeCoveringOverlays(canvas);
      if (suspects.length === 0) {
        _lastProbeLines = [`  DOM cover suspects: none`];
      } else {
        _lastProbeLines = [
          `  DOM cover suspects: ${suspects.length}`,
          ...suspects.map(s => {
            const age = Number.isFinite(s.ageMs) ? `${s.ageMs.toFixed(0)}ms` : '?';
            return `    ${s.selector}  z=${s.zIndex}  α=${s.opacity}  age=${age}`;
          }),
        ];
      }
    } catch (_) {
      _lastProbeLines = [`  DOM cover suspects: (probe error)`];
    }
  }
  return _lastProbeLines;
}

function _tick(): void {
  _rafId = 0;
  if (!_visible || !_el) return;

  try {
    const pa = PixiApp;

    let activeTweens = '?';
    try { activeTweens = String(gsap.globalTimeline.getChildren(true, true, false).length); } catch (_) {}

    const olTweening = typeof gsap.isTweening === 'function' ? gsap.isTweening(pa.overlayLayer) : '?';
    const sfTweening = typeof gsap.isTweening === 'function' ? gsap.isTweening(pa.screenFxContainer) : '?';
    const tlPaused   = gsap.globalTimeline.paused();

    const lines: string[] = [
      `╔══ OVERSTEER DEBUG (press \` or F2 to hide) ══╗`,
      `  Scene:   ${currentSceneName}`,
      `  Uptime:  ${(performance.now() / 1000).toFixed(2)}s`,
      ``,
      `  Pixi Layers:`,
      _layerLine('worldContainer',    pa.worldContainer    as unknown as Container),
      _layerLine('  backgroundLayer', pa.backgroundLayer   as unknown as Container),
      _layerLine('  playerLayer',     pa.playerLayer       as unknown as Container),
      _layerLine('uiContainer',       pa.uiContainer       as unknown as Container),
      _layerLine('  hudLayer',        pa.hudLayer          as unknown as Container),
      _layerLine('  eventLogLayer',   pa.eventLogLayer     as unknown as Container),
      _layerLine('  overlayLayer',    pa.overlayLayer      as unknown as Container),
      _layerLine('screenFxContainer', pa.screenFxContainer as unknown as Container),
      ``,
      `  GSAP:`,
      `    active tweens:           ${activeTweens}`,
      `    isTweening(overlayLayer):${olTweening}`,
      `    isTweening(screenFxCtx): ${sfTweening}`,
      `    globalTimeline.paused(): ${tlPaused}`,
      ``,
      ..._watchdogLines(),
      ..._probeLinesThrottled(pa),
      ``,
      `  Log (last 40):`,
      ...getEntries().slice(-40).map(
        e => `    [${e.t.toFixed(3)}] ${e.tag.padEnd(8)} ${e.msg}`
      ),
    ];

    _el.textContent = lines.join('\n');
  } catch (err) {
    if (_el) _el.textContent = `DEBUG OVERLAY ERROR:\n${err}`;
  }

  _rafId = requestAnimationFrame(_tick);
}
