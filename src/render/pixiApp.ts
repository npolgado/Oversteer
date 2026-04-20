import 'pixi.js/browser';
import { Application, Container, WebGLRenderer, Graphics, Texture } from 'pixi.js';

const app = new Application();

// World-space containers (moved by camera each frame)
const worldContainer = new Container();
const backgroundLayer = new Container();
const propsLayer = new Container();
const trailLayer = new Container();
const pickupsLayer = new Container();
const enemiesLayer = new Container();
const playerLayer = new Container();
const particlesLayer = new Container();

// Screen-fixed UI containers
const uiContainer = new Container();
const hudLayer = new Container();
const eventLogLayer = new Container();
const overlayLayer = new Container();

// Post-process / screen-fx layer (vignette, flash, speed lines)
const screenFxContainer = new Container();

// NOTE: not in original — 4×4 white texture for ParticleContainer sprite-based particles.
// Set after init() completes when the renderer is available.
let _sparkTexture: Texture | null = null;

function resize(): void {
  const canvas = app.canvas as HTMLCanvasElement;
  const scaleX = window.innerWidth / 1600;
  const scaleY = window.innerHeight / 900;
  const scale = Math.min(scaleX, scaleY);
  canvas.style.width = 1600 * scale + 'px';
  canvas.style.height = 900 * scale + 'px';
}

async function init(opts?: { forceWebGL?: boolean }): Promise<void> {
  const isInIframe = window.parent !== window;
  const dbg = (step: string) => isInIframe && window.parent.postMessage({ type: 'bench_debug', step }, '*');

  const baseOpts = {
    width: 1600,
    height: 900,
    backgroundColor: 0x07080b,
    antialias: false,
    resolution: 1,
  };

  if (opts?.forceWebGL) {
    // Bypass autoDetectRenderer — its dynamic import() hangs in iframes.
    // Replicate Application.init manually: stage + renderer + plugins.
    dbg('pixi_init_manual_webgl_renderer');
    const renderer = new WebGLRenderer();
    await renderer.init(baseOpts);
    dbg('pixi_init_renderer_ready');
    app.stage ||= new Container();
    (app as any).renderer = renderer;
    (Application as any)._plugins.forEach((plugin: any) => {
      plugin.init.call(app, baseOpts);
    });
  } else {
    dbg('pixi_init_auto_detect');
    await app.init(baseOpts);
  }
  dbg('pixi_init_app.init_resolved');

  // Pixel-crisp rendering
  const canvas = app.canvas as HTMLCanvasElement;
  canvas.style.imageRendering = 'pixelated';

  // Build layer hierarchy — back to front
  worldContainer.addChild(
    backgroundLayer,
    propsLayer,
    trailLayer,
    pickupsLayer,
    enemiesLayer,
    playerLayer,
    particlesLayer,
  );

  uiContainer.addChild(hudLayer, eventLogLayer, overlayLayer);

  app.stage.addChild(worldContainer, uiContainer, screenFxContainer);

  // Mount canvas
  const gameDiv = document.getElementById('game');
  if (!gameDiv) {
    throw new Error('Missing #game div in index.html');
  }
  dbg('pixi_init_mounting_canvas');
  gameDiv.appendChild(canvas);

  // Initial size + listen for future resizes
  resize();
  window.addEventListener('resize', resize);

  // Create spark texture after renderer is ready. NOTE: not in original.
  const sparkGfx = new Graphics();
  sparkGfx.rect(0, 0, 4, 4).fill(0xffffff);
  _sparkTexture = app.renderer.generateTexture(sparkGfx);
  sparkGfx.destroy();
  dbg('pixi_init_complete');
}

export const PixiApp = {
  app,
  worldContainer,
  backgroundLayer,
  propsLayer,
  trailLayer,
  pickupsLayer,
  enemiesLayer,
  playerLayer,
  particlesLayer,
  uiContainer,
  hudLayer,
  eventLogLayer,
  overlayLayer,
  screenFxContainer,
  // NOTE: not in original — set by init(), used by ParticleSystem for batched sparks/shards.
  get sparkTexture(): Texture { return _sparkTexture!; },
  init,
  resize,
};
