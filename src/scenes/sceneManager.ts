// sceneManager.ts — Scene lifecycle management.
// Scenes implement the Scene interface and are swapped by calling switchTo().
import type { PixiApp as PixiAppType } from '@render/pixiApp';
import type { audioManager as AudioManagerType } from '@audio/audioManager';
import type { InputState } from '@input/inputManager';
import type { camera as CameraType } from '@render/camera';
import { uiTween, killUITweens } from '@render/tween';

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
}

async function switchTo(next: Scene, opts?: { fade?: number }): Promise<void> {
  if (!_context) throw new Error('SceneManager not initialized — call init() first');
  if (_transitioning) return;
  _transitioning = true;

  const fadeDur = opts?.fade ?? 0;
  const overlay = _context.pixiApp.overlayLayer;

  if (_current && fadeDur > 0) {
    await uiTween(overlay, { alpha: 0, duration: fadeDur, ease: 'power2.in' });
  }
  killUITweens(overlay);
  _current?.exit(_context);
  _current = next;
  overlay.alpha = 0;
  _current.enter(_context);
  if (fadeDur > 0) {
    await uiTween(overlay, { alpha: 1, duration: fadeDur, ease: 'power2.out' });
  } else {
    overlay.alpha = 1;
  }
  _transitioning = false;
}

function update(dt: number): void {
  if (!_current || !_context) return;
  _current.update(dt, _context);
}

export const sceneManager = { init, switchTo, update };
