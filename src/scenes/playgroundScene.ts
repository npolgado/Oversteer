// playgroundScene.ts — Phase 0 verification scene.
// Shows: background, cyan rectangle (player placeholder), WASD movement, camera follow.
import { Graphics, Sprite, Assets } from 'pixi.js';
import type { Scene, GameContext } from './sceneManager';
import { CFG } from '@core/config';
import { clamp } from '@core/utils';

export class PlaygroundScene implements Scene {
  private _player: Graphics | null = null;
  private _background: Sprite | null = null;

  // Player state
  private _x = CFG.WORLD_W / 2;
  private _y = CFG.WORLD_H / 2;
  private _vx = 0;
  private _vy = 0;
  private _heading = 0; // radians, 0 = right

  enter(context: GameContext): void {
    const { worldContainer, backgroundLayer, playerLayer } = context.pixiApp;

    // Attach camera to world container
    context.camera.attachContainer(worldContainer);
    context.camera.reset(this._x, this._y);

    // Background
    const bgTexture = Assets.get('background_01');
    if (bgTexture) {
      this._background = new Sprite(bgTexture);
      this._background.width = CFG.WORLD_W;
      this._background.height = CFG.WORLD_H;
      backgroundLayer.addChild(this._background);
    } else {
      // Fallback: plain dark rect
      const bg = new Graphics();
      bg.rect(0, 0, CFG.WORLD_W, CFG.WORLD_H).fill({ color: 0x07080b });
      backgroundLayer.addChild(bg);
    }

    // Player placeholder — cyan rectangle
    this._player = new Graphics();
    this._player.rect(-17, -9, 34, 18).fill({ color: 0x00ffff });
    this._player.pivot.set(0, 0);
    playerLayer.addChild(this._player);
  }

  update(dt: number, context: GameContext): void {
    const input = context.getInput();

    // Resume audio on any input
    if (input.up || input.down || input.left || input.right || input.drift) {
      context.audioManager._resumeCtx();
    }

    // Steer
    if (input.left)  this._heading -= 3.0 * dt;
    if (input.right) this._heading += 3.0 * dt;

    // Accelerate / brake
    const accel = CFG.ACCEL;
    if (input.up) {
      this._vx += Math.cos(this._heading) * accel * dt;
      this._vy += Math.sin(this._heading) * accel * dt;
    }
    if (input.down) {
      this._vx -= Math.cos(this._heading) * accel * 0.6 * dt;
      this._vy -= Math.sin(this._heading) * accel * 0.6 * dt;
    }

    // Friction
    const friction = input.drift ? CFG.DRIFT_LATERAL : CFG.LATERAL_FRICTION;
    this._vx *= Math.pow(1 - friction * dt, 1);
    this._vy *= Math.pow(1 - friction * dt, 1);

    // Cap speed
    const spd = Math.hypot(this._vx, this._vy);
    if (spd > CFG.MAX_SPEED) {
      this._vx = (this._vx / spd) * CFG.MAX_SPEED;
      this._vy = (this._vy / spd) * CFG.MAX_SPEED;
    }

    // Move
    this._x += this._vx * dt;
    this._y += this._vy * dt;

    // Clamp to world
    const pad = CFG.ARENA_PAD;
    this._x = clamp(this._x, pad, CFG.WORLD_W - pad);
    this._y = clamp(this._y, pad, CFG.WORLD_H - pad);

    // Update sprite
    if (this._player) {
      this._player.position.set(this._x, this._y);
      // Visual heading follows velocity for drift feel; +PI/2 for sprite convention
      const visualAngle = spd > 20 ? Math.atan2(this._vy, this._vx) : this._heading;
      this._player.rotation = visualAngle + Math.PI / 2;
    }

    // Camera
    context.camera.update(dt, this._x, this._y, this._vx, this._vy, spd);
  }

  exit(context: GameContext): void {
    const { backgroundLayer, playerLayer } = context.pixiApp;
    backgroundLayer.removeChildren();
    playerLayer.removeChildren();
    this._background = null;
    this._player = null;
  }
}
