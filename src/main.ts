import { PixiApp } from '@render/pixiApp';
import { audioManager } from '@audio/audioManager';
import { inputManager } from '@input/inputManager';
import { camera } from '@render/camera';
import { sceneManager, type GameContext } from '@scenes/sceneManager';
import { BootScene } from '@scenes/bootScene';
import { MenuScene } from '@scenes/menuScene';
import { GameplayScene } from '@scenes/gameplayScene';

// Register error reporters before any async work so failures are visible in benchmark.html
window.addEventListener('error', (e) => {
  window.parent.postMessage({ type: 'bench_error', error: e.message }, '*');
});
window.addEventListener('unhandledrejection', (e) => {
  window.parent.postMessage({ type: 'bench_error', error: String(e.reason) }, '*');
});

const isInIframe = window.parent !== window;
const dbg = (step: string) => isInIframe && window.parent.postMessage({ type: 'bench_debug', step }, '*');

dbg('before_pixi_init');
if (isInIframe) {
  // Pre-check: can we even create a WebGL context?
  const testCanvas = document.createElement('canvas');
  const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
  dbg(gl ? 'webgl_ok' : 'webgl_FAIL');
  testCanvas.remove();
}
try {
  const initPromise = PixiApp.init({ forceWebGL: isInIframe });
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('PixiApp.init timed out after 10s')), 10000)
  );
  await Promise.race([initPromise, timeoutPromise]);
  dbg('after_pixi_init');
} catch (e) {
  window.parent.postMessage({ type: 'bench_error', error: `PixiApp.init failed: ${e}` }, '*');
  throw e;
}

// Init audio (deferred — AudioContext resumes on first keypress via _resumeCtx)
audioManager.init();
dbg('after_audio_init');

// Init input after canvas is in DOM
const canvas = PixiApp.app.canvas as HTMLCanvasElement;
inputManager.init(canvas);

// Wire first-interaction callback for AudioContext autoplay policy
inputManager.onFirstInteraction = () => audioManager._resumeCtx();

// Build GameContext shared across all scenes
const context: GameContext = {
  pixiApp: PixiApp,
  audioManager,
  camera,
  getInput: () => inputManager.poll(),
};

sceneManager.init(context);
dbg('after_scene_manager_init');

if (isInIframe) {
  // In benchmark iframe: boot first to load assets, then signal ready
  sceneManager.switchTo(new BootScene(() => {
    dbg('boot_done');
    window.parent.postMessage({ type: 'bench_ready' }, '*');
    window.addEventListener('message', function handler(e: MessageEvent) {
      if (!e.data || e.data.type !== 'bench_start') return;
      window.removeEventListener('message', handler);
      sceneManager.switchTo(new GameplayScene({ benchmark: e.data.scenario as string }));
    });
  }));
  dbg('boot_scene_switched');
} else {
  sceneManager.switchTo(new BootScene(() => {
    sceneManager.switchTo(new MenuScene());
  }));
}

// Main loop
PixiApp.app.ticker.add((ticker) => {
  const dt = Math.min(ticker.deltaMS / 1000, 0.05);
  sceneManager.update(dt);
});
dbg('ticker_started');
