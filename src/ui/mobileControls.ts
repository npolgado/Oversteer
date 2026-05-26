import { Graphics, Container } from 'pixi.js';
import { CFG, S } from '@core/config';
import { InputManager } from '@input/inputManager';

// NOTE: not in original — virtual joystick + drift button overlay is a TS-port addition for mobile play.
export class MobileControls {
  private _g: Graphics;

  constructor(layer: Container) {
    this._g = new Graphics();
    layer.addChild(this._g);
  }

  update(inputManager: InputManager | undefined, _dt: number): void {
    if (!inputManager || !inputManager.hasTouched) {
      this._g.visible = false;
      return;
    }
    this._g.visible = true;
    this._g.clear();

    // JOYSTICK
    const origin = inputManager.stickOrigin;
    if (origin !== null) {
      // Outer ring
      this._g
        .circle(origin.x, origin.y, S(60))
        .stroke({ color: 0xFFFFFF, alpha: 0.3, width: 2 });
      // Deadzone ring
      this._g
        .circle(origin.x, origin.y, S(15))
        .stroke({ color: 0xFFFFFF, alpha: 0.15, width: 1 });

      // Knob: clamp delta then add back to world-space origin
      const pos = inputManager.stickPos;
      let kx = origin.x;
      let ky = origin.y;
      if (pos !== null) {
        const dx = pos.x - origin.x;
        const dy = pos.y - origin.y;
        const mag = Math.hypot(dx, dy);
        const max = S(56);
        if (mag > max) {
          kx = origin.x + (dx / mag) * max;
          ky = origin.y + (dy / mag) * max;
        } else {
          kx = origin.x + dx;
          ky = origin.y + dy;
        }
      }
      this._g
        .circle(kx, ky, S(24))
        .fill({ color: 0x35F2D0, alpha: 0.7 });
    }

    // DRIFT BUTTON
    const driftBtnX = CFG.W - S(80);
    const driftBtnY = CFG.H - S(80);
    const driftColor = inputManager.driftActive
      ? { color: 0x35F2D0, alpha: 0.55 }
      : { color: 0xFFFFFF, alpha: 0.18 };
    this._g
      .circle(driftBtnX, driftBtnY, S(48))
      .fill(driftColor)
      .stroke({ color: 0xFFFFFF, alpha: 0.35, width: 2 });
  }

  destroy(): void {
    this._g.destroy();
  }
}
