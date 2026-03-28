// trailRenderer.ts — PixiJS trail renderer.

import { Graphics, type Container } from 'pixi.js';
import { getTrailPoint, type TrailState } from './trailState';

export class TrailRenderer {
  private _gfx: Graphics;

  constructor(layers: { trailLayer: Container }) {
    this._gfx = new Graphics();
    layers.trailLayer.addChild(this._gfx);
  }

  update(state: TrailState): void {
    this._gfx.clear();

    if (state.count < 2) return;

    const r = state.colorR;
    const g = state.colorG;
    const b = state.colorB;
    const color = (r << 16) | (g << 8) | b;

    // Draw trail as a series of segments with linearly increasing width
    for (let i = 1; i < state.count; i++) {
      const p0 = getTrailPoint(state, i - 1);
      const p1 = getTrailPoint(state, i);
      const frac = i / (state.count - 1);
      const width = 2 + 3 * frac;
      const alpha = 0.08 + 0.30 * frac;

      this._gfx
        .moveTo(p0.x, p0.y)
        .lineTo(p1.x, p1.y)
        .stroke({ color, alpha, width, cap: 'round' });
    }

    // Flash polygon after encirclement
    if (state.flashPoly !== null && state.flashPolyTimer > 0) {
      const flashAlpha = (state.flashPolyTimer / 0.4) * 0.25;
      const pts = state.flashPoly;
      this._gfx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        this._gfx.lineTo(pts[i].x, pts[i].y);
      }
      this._gfx.closePath().fill({ color, alpha: flashAlpha });
    }
  }

  destroy(): void {
    this._gfx.destroy();
  }
}
