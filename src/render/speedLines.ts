// speedLines.ts — Speed lines drawn in screen space at high velocity.
// Port of arena-drifter/game.js:1270-1294.

import { Graphics, Container } from 'pixi.js';
import { CFG, S } from '@core/config';

export class SpeedLines {
  private _gfx: Graphics;

  constructor(container: Container) {
    this._gfx = new Graphics();
    container.addChild(this._gfx);
  }

  // Port of arena-drifter/game.js:1270-1294.
  update(speed: number, maxSpeed: number, heading: number, gameClock: number, isAlive: boolean): void {
    this._gfx.clear();
    const speedFrac = speed / (maxSpeed || CFG.MAX_SPEED);
    if (!isAlive || speedFrac <= CFG.SPEED_LINES_THRESHOLD) return;

    const intensity = (speedFrac - CFG.SPEED_LINES_THRESHOLD) / (1 - CFG.SPEED_LINES_THRESHOLD);
    const lineCount = Math.floor(6 + intensity * 8);

    for (let i = 0; i < lineCount; i++) {
      const seed = (gameClock * 3 + i * 7.13) % 1;
      const perpOff = (i / lineCount - 0.5) * CFG.H * 1.2;
      const len = S(40 + intensity * 60);
      const sx = CFG.W / 2 + Math.cos(heading + Math.PI) * seed * CFG.W * 0.6 - Math.sin(heading) * perpOff;
      const sy = CFG.H / 2 + Math.sin(heading + Math.PI) * seed * CFG.H * 0.6 + Math.cos(heading) * perpOff;
      const alpha = intensity * 0.15 * (1 - seed);
      if (alpha < 0.01) continue;

      this._gfx
        .moveTo(sx, sy)
        .lineTo(sx - Math.cos(heading) * len, sy - Math.sin(heading) * len)
        .stroke({ color: 0xffffff, width: 1, alpha });
    }
  }

  destroy(): void {
    this._gfx.destroy();
  }
}
