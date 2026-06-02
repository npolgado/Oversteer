import 'pixi.js/browser';
import { Application, Container, WebGLRenderer, Graphics, Texture, BlurFilter } from 'pixi.js';
import { CFG } from '@core/config';

const app = new Application();

// World-space containers (moved by camera each frame)
const worldContainer = new Container();
const backgroundLayer = new Container();
const propsLayer = new Container();
const trailLayer = new Container();
// NOTE: not in original — blurred bright-pass duplicate of trail for bloom effect.
const trailBloomLayer = new Container();
const pickupsLayer = new Container();
const enemiesLayer = new Container();
const playerLayer = new Container();
// NOTE: not in original — blurred bright-pass of player position for engine glow effect.
const playerBloomLayer = new Container();
const particlesLayer = new Container();

// Screen-fixed atmospheric fog overlay — sits between world and HUD, not camera-transformed
const fogLayer = new Container();

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

  const canvas = app.canvas as HTMLCanvasElement;

  // Bloom layers: BlurFilter on an additive-blend container creates the cheap-bloom halo.
  // NOTE: not in original.
  trailBloomLayer.filters = [new BlurFilter({ strength: CFG.BLOOM_BLUR_STRENGTH, quality: CFG.BLOOM_BLUR_QUALITY })];
  trailBloomLayer.blendMode = 'add';
  playerBloomLayer.filters = [new BlurFilter({ strength: CFG.BLOOM_BLUR_STRENGTH, quality: CFG.BLOOM_BLUR_QUALITY })];
  playerBloomLayer.blendMode = 'add';

  // Build layer hierarchy — back to front
  worldContainer.addChild(
    backgroundLayer,
    propsLayer,
    trailLayer,
    trailBloomLayer,
    pickupsLayer,
    enemiesLayer,
    playerBloomLayer,
    playerLayer,
    particlesLayer,
  );

  uiContainer.addChild(hudLayer, eventLogLayer, overlayLayer);

  app.stage.addChild(worldContainer, fogLayer, uiContainer, screenFxContainer);

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

  // WebGL context-lost / restored — Pixi v8 does not surface these as events upstream,
  // so we wire directly to the canvas. preventDefault() on lost allows the browser to
  // attempt automatic context restoration.
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    (import('@debug/logger') as Promise<{ logError: (t: string, m: string) => void }>)
      .then(m => m.logError('pixi', 'WebGL context LOST — GPU reset or driver crash; rendering halted'))
      .catch(() => {});
  }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    (import('@debug/logger') as Promise<{ log: (t: string, m: string) => void }>)
      .then(m => m.log('pixi', 'WebGL context RESTORED — GPU recovered'))
      .catch(() => {});
  }, false);

  // Create spark texture after renderer is ready. NOTE: not in original.
  const sparkGfx = new Graphics();
  sparkGfx.rect(0, 0, 4, 4).fill(0xffffff);
  _sparkTexture = app.renderer.generateTexture(sparkGfx);
  sparkGfx.destroy();
  dbg('pixi_init_complete');

  // One-shot first-paint log: emits exactly once when the ticker runs for the first time,
  // confirming that Pixi's RAF loop is alive. Imported dynamically to keep render/ free of
  // a static dep on the debug module.
  //
  // Schedules a one-shot deep snapshot of every layer + a pixel-sample of the canvas
  // ~250ms after first paint — by then any synchronous scene.enter() has run and the
  // first frame should contain the real title screen. If it doesn't, the snapshot
  // captures exactly which child is missing or transparent.
  let _firstPaintLogged = false;
  app.ticker.add(() => {
    if (_firstPaintLogged) return;
    _firstPaintLogged = true;
    const c = app.canvas as HTMLCanvasElement;
    (import('@debug/logger') as Promise<{ log: (t: string, m: string) => void }>)
      .then(m => m.log('pixi', `first-paint  stage.ch=${app.stage.children.length}  canvas=${c.width}x${c.height}`))
      .catch(() => {});

    setTimeout(() => {
      Promise.all([
        import('@debug/logger'),
        import('@debug/layerInspect'),
        import('@debug/renderProbe'),
      ]).then(([{ log }, { layerSnapshot }, { probeRenderOutput, formatRenderProbe }]) => {
        log('snapshot', '--- post-first-paint deep snapshot ---');
        for (const line of layerSnapshot('worldContainer', worldContainer)) log('snapshot', line);
        for (const line of layerSnapshot('uiContainer',    uiContainer))    log('snapshot', line);
        for (const line of layerSnapshot('overlayLayer',   overlayLayer))   log('snapshot', line);
        for (const line of layerSnapshot('hudLayer',       hudLayer))       log('snapshot', line);
        for (const line of layerSnapshot('screenFxContainer', screenFxContainer)) log('snapshot', line);
        log('snapshot', formatRenderProbe(probeRenderOutput(c)));
        log('snapshot', '--- end snapshot ---');
      }).catch(() => {});
    }, 250);
  });
}

export const PixiApp = {
  app,
  worldContainer,
  backgroundLayer,
  fogLayer,
  propsLayer,
  trailLayer,
  trailBloomLayer,
  pickupsLayer,
  enemiesLayer,
  playerLayer,
  playerBloomLayer,
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
