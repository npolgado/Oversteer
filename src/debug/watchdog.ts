// watchdog.ts — three timers that surface silent-failure boot patterns.
//
// 1. First-paint watchdog: fires if the Pixi ticker never ticks within 5s.
// 2. Scene-switch watchdog: fires if switchTo() does not COMPLETE within 3s.
// 3. Update-stall watchdog: fires if scene.update() goes silent for 120 frames.
//
// Wire up: call initWatchdog(PixiApp.app) right after PixiApp.init() in main.ts.
// Call watchdogSceneSwitchStart/Complete from sceneManager.switchTo().
// Call watchdogSceneUpdated() from sceneManager.update() on the success path.

import { log, logError } from './logger';

interface PixiAppLike {
  ticker: { add: (fn: (ticker: unknown) => void) => void };
}

export interface WatchdogState {
  firstPaintAt: number | null;
  sceneSwitchInFlight: { name: string; startedAt: number } | null;
  framesSinceLastUpdate: number;
  sceneStallAlertFired: boolean;
  sceneSwitchAlertFired: boolean;
  firstPaintAlertFired: boolean;
}

const FIRST_PAINT_MS = 5000;
const SWITCH_TIMEOUT_MS = 5000;
const UPDATE_STALL_FRAMES = 120;
const UPDATE_STALL_REARM_FRAMES = 600;

const _state: WatchdogState = {
  firstPaintAt: null,
  sceneSwitchInFlight: null,
  framesSinceLastUpdate: 0,
  sceneStallAlertFired: false,
  sceneSwitchAlertFired: false,
  firstPaintAlertFired: false,
};

let _firstPaintTimer: ReturnType<typeof setTimeout> | null = null;
let _switchTimer: ReturnType<typeof setTimeout> | null = null;

export function initWatchdog(app: PixiAppLike): void {
  // Reset state so initWatchdog can be called multiple times (useful in tests).
  _state.firstPaintAt = null;
  _state.firstPaintAlertFired = false;
  _state.sceneSwitchInFlight = null;
  _state.sceneSwitchAlertFired = false;
  _state.framesSinceLastUpdate = 0;
  _state.sceneStallAlertFired = false;

  if (_firstPaintTimer != null) { clearTimeout(_firstPaintTimer); _firstPaintTimer = null; }
  if (_switchTimer != null) { clearTimeout(_switchTimer); _switchTimer = null; }

  // First-paint deadline: if the ticker never runs, Pixi init silently hung.
  _firstPaintTimer = setTimeout(() => {
    if (_state.firstPaintAt == null && !_state.firstPaintAlertFired) {
      _state.firstPaintAlertFired = true;
      logError('watchdog', `NO FIRST PAINT after ${FIRST_PAINT_MS / 1000}s — Pixi ticker never ran; check PixiApp.init()`);
    }
  }, FIRST_PAINT_MS);

  // Hook the Pixi ticker for first-paint detection and update-stall tracking.
  app.ticker.add(() => {
    if (_state.firstPaintAt == null) {
      _state.firstPaintAt = performance.now();
      if (_firstPaintTimer != null) {
        clearTimeout(_firstPaintTimer);
        _firstPaintTimer = null;
      }
      log('watchdog', `first-paint at ${_state.firstPaintAt.toFixed(0)}ms — Pixi ticker running`);
    }

    _state.framesSinceLastUpdate++;

    if (_state.framesSinceLastUpdate > UPDATE_STALL_FRAMES && !_state.sceneStallAlertFired) {
      _state.sceneStallAlertFired = true;
      logError('watchdog', `scene.update() has not fired in ${UPDATE_STALL_FRAMES} frames (~${(UPDATE_STALL_FRAMES / 60).toFixed(1)}s) — sceneManager.update() may have thrown or current scene is null`);
    }
    if (_state.framesSinceLastUpdate > UPDATE_STALL_REARM_FRAMES) {
      _state.sceneStallAlertFired = false;
    }
  });
}

export function watchdogSceneSwitchStart(name: string): void {
  if (_switchTimer != null) { clearTimeout(_switchTimer); _switchTimer = null; }
  _state.sceneSwitchInFlight = { name, startedAt: performance.now() };
  _state.sceneSwitchAlertFired = false;

  _switchTimer = setTimeout(() => {
    if (_state.sceneSwitchInFlight?.name === name && !_state.sceneSwitchAlertFired) {
      _state.sceneSwitchAlertFired = true;
      const elapsed = _state.sceneSwitchInFlight
        ? (performance.now() - _state.sceneSwitchInFlight.startedAt).toFixed(0)
        : '?';
      logError('watchdog', `switchTo(${name}) did not COMPLETE in ${SWITCH_TIMEOUT_MS / 1000}s — check enter() and fadePromise (${elapsed}ms elapsed)`);
    }
  }, SWITCH_TIMEOUT_MS);
}

export function watchdogSceneSwitchComplete(name: string): void {
  if (_switchTimer != null) { clearTimeout(_switchTimer); _switchTimer = null; }
  if (_state.sceneSwitchInFlight?.name === name) {
    const elapsed = (performance.now() - _state.sceneSwitchInFlight.startedAt).toFixed(0);
    log('watchdog', `switchTo(${name}) COMPLETE in ${elapsed}ms`);
    _state.sceneSwitchInFlight = null;
  }
}

export function watchdogSceneUpdated(): void {
  _state.framesSinceLastUpdate = 0;
  _state.sceneStallAlertFired = false;
}

export function getWatchdogState(): Readonly<WatchdogState> {
  return { ..._state };
}

// ---------------------------------------------------------------------------
// No-input watchdog — fires if MenuScene is active for >10s with no keyboard
// or touch input. Common causes: focus stolen by devtools, layout covering the
// canvas, or input system not initialized.
// ---------------------------------------------------------------------------
const INPUT_IDLE_MS = 30_000;
let _menuInputTimer: ReturnType<typeof setTimeout> | null = null;
let _menuInputAlertFired = false;

export function watchdogMenuEntered(): void {
  if (_menuInputTimer != null) clearTimeout(_menuInputTimer);
  _menuInputAlertFired = false;
  _menuInputTimer = setTimeout(() => {
    if (!_menuInputAlertFired) {
      _menuInputAlertFired = true;
      log('watchdog',
        `MenuScene active for ${INPUT_IDLE_MS / 1000}s with no keyboard/touch input — ` +
        `player may be AFK; if input is genuinely broken check browser focus, covering DOM element, or inputManager initialization`
      );
    }
  }, INPUT_IDLE_MS);
}

export function watchdogMenuInputReceived(): void {
  if (_menuInputTimer != null) { clearTimeout(_menuInputTimer); _menuInputTimer = null; }
  _menuInputAlertFired = false;
}
