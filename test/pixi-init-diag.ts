/**
 * Minimal Pixi init diagnostic — loaded in an iframe to isolate the hang.
 * Serve via Vite: the iframe src should be "/test/pixi-init-diag.html".
 */
import 'pixi.js/browser';
import { Application } from 'pixi.js';

const post = (obj: Record<string, unknown>) =>
  window.parent.postMessage({ _pixiTest: true, ...obj }, '*');

const params = new URLSearchParams(location.search);
const preference = params.get('preference') || undefined; // 'webgl' | 'webgpu' | undefined

post({ type: 'step', msg: `module loaded, preference=${preference ?? 'auto'}` });

// Pre-check WebGL availability
const testCanvas = document.createElement('canvas');
const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
post({ type: 'step', msg: gl ? 'webgl_context_ok' : 'webgl_context_FAIL' });
testCanvas.remove();

const t0 = performance.now();

try {
  const app = new Application();
  const opts: Record<string, unknown> = {
    width: 320,
    height: 180,
    backgroundColor: 0x000000,
    antialias: false,
    resolution: 1,
  };
  if (preference) opts.preference = preference;

  post({ type: 'step', msg: `calling app.init(${JSON.stringify(opts)})` });
  await app.init(opts);
  const ms = Math.round(performance.now() - t0);
  post({ type: 'step', msg: `app.init resolved, renderer: ${app.renderer.type}` });

  // Try mounting canvas
  const gameDiv = document.getElementById('game');
  if (gameDiv) {
    gameDiv.appendChild(app.canvas as HTMLCanvasElement);
    post({ type: 'step', msg: 'canvas mounted to #game' });
  }

  post({ type: 'done', ms });
} catch (e) {
  post({ type: 'error', msg: String(e) });
}
