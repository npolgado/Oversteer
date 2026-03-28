// sceneManager.ts — Scene lifecycle management.
// Scenes implement the Scene interface and are swapped by calling switchTo().
import type { PixiApp as PixiAppType } from '@render/pixiApp';
import type { audioManager as AudioManagerType } from '@audio/audioManager';
import type { InputState } from '@input/inputManager';
import type { camera as CameraType } from '@render/camera';

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

function init(context: GameContext): void {
  _context = context;
}

function switchTo(next: Scene): void {
  if (!_context) throw new Error('SceneManager not initialized — call init() first');
  _current?.exit(_context);
  _current = next;
  _current.enter(_context);
}

function update(dt: number): void {
  if (!_current || !_context) return;
  _current.update(dt, _context);
}

export const sceneManager = { init, switchTo, update };
