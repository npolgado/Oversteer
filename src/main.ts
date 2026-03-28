import { PixiApp } from '@render/pixiApp';
import { audioManager } from '@audio/audioManager';
import { inputManager } from '@input/inputManager';
import { camera } from '@render/camera';
import { sceneManager, type GameContext } from '@scenes/sceneManager';
import { BootScene } from '@scenes/bootScene';
import { GameplayScene } from '@scenes/gameplayScene';

await PixiApp.init();

// Init audio (deferred — AudioContext resumes on first keypress via _resumeCtx)
audioManager.init();

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

// Boot → GameplayScene
sceneManager.switchTo(new BootScene(() => {
  sceneManager.switchTo(new GameplayScene());
}));

// Main loop
PixiApp.app.ticker.add((ticker) => {
  const dt = Math.min(ticker.deltaMS / 1000, 0.05);
  sceneManager.update(dt);
});
