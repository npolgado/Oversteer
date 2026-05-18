// sceneManager.ts — Scene lifecycle management.
// Scenes implement the Scene interface and are swapped by calling switchTo().
import type { PixiApp as PixiAppType } from '@render/pixiApp';
import type { audioManager as AudioManagerType } from '@audio/audioManager';
import type { InputState } from '@input/inputManager';
import type { camera as CameraType } from '@render/camera';
import { killUITweens } from '@render/tween';
import { log, logError } from '@debug/logger';
import { setCurrentScene } from '@debug/debugOverlay';
import {
  watchdogSceneSwitchStart,
  watchdogSceneSwitchComplete,
  watchdogSceneUpdated,
} from '@debug/watchdog';

export interface GameContext {
  pixiApp: typeof PixiAppType;
  audioManager: typeof AudioManagerType;
  camera: typeof CameraType;
  getInput: () => InputState;
}

export interface Scene {
  enter(context: GameContext): void;
  update(dt: number, context: GameContext): void;
  exit(context: GameContext): void;
}

let _current: Scene | null = null;
let _context: GameContext | null = null;
let _transitioning = false;

function init(context: GameContext): void {
  _context = context;
  log('scene', 'sceneManager.init()');
}

// DOM-based fade overlay — completely independent of Pixi and GSAP so it
// cannot be broken by PixiPlugin alpha-tween bugs or renderer state.
function _domFadeIn(dur: number): Promise<void> {
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed', 'inset:0', 'background:#000',
      'opacity:1', 'z-index:99990', 'pointer-events:none',
    ].join(';');
    // Tag with creation time so domOverlayProbe can report age of stuck overlays.
    el.dataset.mountedAt = String(performance.now());
    el.dataset.role = 'scene-fade';
    document.body.appendChild(el);

    // Two rAF frames to ensure the initial opacity:1 is painted before
    // we start the CSS transition, avoiding a missed first frame.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = `opacity ${dur}s ease`;
      el.style.opacity = '0';
      setTimeout(() => {
        el.remove();
        log('scene', 'DOM fade-in overlay removed');
        resolve();
      }, (dur + 0.1) * 1000);
    }));
  });
}

async function switchTo(next: Scene, opts?: { fade?: number }): Promise<void> {
  if (!_context) throw new Error('SceneManager not initialized — call init() first');

  const nextName = next.constructor.name;
  if (_transitioning) {
    log('scene', `switchTo(${nextName}) BLOCKED — already transitioning`);
    return;
  }
  _transitioning = true;
  watchdogSceneSwitchStart(nextName);

  const fadeDur = opts?.fade ?? 0;
  const prevName = _current?.constructor.name ?? '(none)';
  log('scene', `switchTo  ${prevName} → ${nextName}  fade=${fadeDur}`);

  // Kick off the DOM overlay immediately so the scene switch is hidden from the user.
  // The overlay starts opaque and fades away after enter() completes.
  const fadePromise = fadeDur > 0 ? _domFadeIn(fadeDur) : null;

  log('scene', `exit ${prevName}`);
  killUITweens(_context.pixiApp.overlayLayer);
  try {
    _current?.exit(_context);
  } catch (err) {
    logError('scene', `${prevName}.exit() threw`, err);
  }

  _current = next;
  setCurrentScene(nextName);

  log('scene', `enter ${nextName}`);
  try {
    _current.enter(_context);
  } catch (err) {
    logError('scene', `${nextName}.enter() threw`, err);
  }

  const ol = _context.pixiApp.overlayLayer;
  log('scene', `enter done  overlayLayer α=${ol.alpha.toFixed(3)}  ch=${ol.children.length}`);

  if (fadePromise) await fadePromise;

  watchdogSceneSwitchComplete(nextName);
  log('scene', `switchTo ${nextName} COMPLETE`);
  _transitioning = false;
}

function update(dt: number): void {
  if (!_current || !_context) return;
  try {
    _current.update(dt, _context);
    watchdogSceneUpdated();
  } catch (err) {
    logError('scene', `${_current.constructor.name}.update() threw`, err);
  }
}

export const sceneManager = { init, switchTo, update };
