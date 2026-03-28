import { Application, Container } from 'pixi.js';

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

function resize(): void {
  const canvas = app.canvas as HTMLCanvasElement;
  const scaleX = window.innerWidth / 1600;
  const scaleY = window.innerHeight / 900;
  const scale = Math.min(scaleX, scaleY);
  canvas.style.width = 1600 * scale + 'px';
  canvas.style.height = 900 * scale + 'px';
}

async function init(): Promise<void> {
  await app.init({
    width: 1600,
    height: 900,
    backgroundColor: 0x07080b,
    antialias: false,
    resolution: 1,
  });

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
  gameDiv.appendChild(canvas);

  // Initial size + listen for future resizes
  resize();
  window.addEventListener('resize', resize);
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
  init,
  resize,
};
