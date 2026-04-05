// playerRenderer.ts — PixiJS player sprite renderer.
// No Canvas 2D — PixiJS only.

import { Sprite, Container, Graphics, Assets } from 'pixi.js';
import { CFG } from '@core/config';
import { type PlayerState } from './playerState';
import { computePlayerRotation } from './playerRendererUtils';

export class PlayerRenderer {
  readonly container: Container;
  private _sprite: Container;

  constructor(layers: { playerLayer: Container }) {
    this.container = layers.playerLayer;

    const texture = Assets.get(CFG.PLAYER_SPRITE);
    if (texture) {
      const spr = new Sprite(texture);
      spr.anchor.set(0.5);
      spr.width = CFG.PLAYER_SPRITE_S;
      spr.height = CFG.PLAYER_SPRITE_S;
      this._sprite = spr;
    } else {
      const g = new Graphics();
      g.rect(-CFG.PLAYER_W / 2, -CFG.PLAYER_H / 2, CFG.PLAYER_W, CFG.PLAYER_H).fill({ color: 0x00ffff });
      this._sprite = g;
    }

    // Car PNG points UP — rotate +90° to face RIGHT
    this._sprite.rotation = Math.PI / 2;
    this.container.addChild(this._sprite);
  }

  update(state: PlayerState): void {
    this._sprite.x = state.x;
    this._sprite.y = state.y;

    // Always rotate to heading — never velocity direction. See entities.js:230.
    this._sprite.rotation = computePlayerRotation(state.heading);

    // Invuln blink: hard 10 Hz flash matching original (entities.js:233-235)
    this._sprite.alpha = state.invulnTimer > 0
      ? (Math.floor(state.invulnTimer * 10) % 2 === 0 ? 0.4 : 1.0)
      : 1.0;
  }

  destroy(): void {
    this._sprite.destroy();
  }
}
