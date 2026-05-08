// trailRenderer.ts — PixiJS trail renderer.

import { Graphics, type Container } from 'pixi.js';
import { CFG } from '@core/config';
import { getTrailPoint, type TrailState } from './trailState';

export class TrailRenderer {
  private _gfx: Graphics;
  // NOTE: not in original — bloom glow pass into a BlurFilter+additive container.
  private _bloomGfx: Graphics | null = null;

  constructor(layers: { trailLayer: Container; trailBloomLayer?: Container }) {
    this._gfx = new Graphics();
    layers.trailLayer.addChild(this._gfx);
    if (layers.trailBloomLayer) {
      this._bloomGfx = new Graphics();
      layers.trailBloomLayer.addChild(this._bloomGfx);
    }
  }

  update(state: TrailState): void {
    this._gfx.clear();
    this._bloomGfx?.clear();

    if (state.count < 2) return;

    const r = state.colorR;
    const g = state.colorG;
    const b = state.colorB;
    const color = (r << 16) | (g << 8) | b;

    // Draw trail as a series of segments; width scales with speed at emission (arena-drifter/world.js:500-501).
    for (let i = 1; i < state.count; i++) {
      const p0 = getTrailPoint(state, i - 1);
      const p1 = getTrailPoint(state, i);
      const frac = i / (state.count - 1);
      const speedFrac = Math.min(1, (p1.speed ?? 0) / (CFG.MAX_SPEED || 500));
      const width = 2 + 3 * speedFrac;
      const alpha = 0.08 + 0.30 * frac;

      this._gfx
        .moveTo(p0.x, p0.y)
        .lineTo(p1.x, p1.y)
        .stroke({ color, alpha, width, cap: 'round' });

      // NOTE: not in original — bloom pass: wider + dimmer, blurred by container filter.
      if (this._bloomGfx) {
        this._bloomGfx
          .moveTo(p0.x, p0.y)
          .lineTo(p1.x, p1.y)
          .stroke({ color, alpha: alpha * CFG.BLOOM_TRAIL_ALPHA_MULT, width: width * CFG.BLOOM_TRAIL_WIDTH_MULT, cap: 'round' });
      }
    }

    // Flash polygon after encirclement
    if (state.flashPoly !== null && state.flashPolyTimer > 0) {
      const flashAlpha = (state.flashPolyTimer / 0.3) * 0.25;
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
    this._bloomGfx?.destroy();
  }
}
