import { Graphics, Container } from 'pixi.js';
import { CFG } from '@core/config';
import type { ScrapPickup } from '@gameplay/pureLogic';
import type { HazardZone } from '@gameplay/spawning/waveManager';

export class PickupRenderer {
  private _g: Graphics;

  constructor(layer: Container) {
    this._g = new Graphics();
    layer.addChild(this._g);
  }

  update(scraps: ScrapPickup[], hazardZones: HazardZone[]): void {
    this._g.clear();

    // Draw hazard zones (pulsing red circles — bomber bomb zones)
    for (const z of hazardZones) {
      const pulse = 0.3 + 0.2 * Math.sin(z.phase * 6);
      this._g.circle(z.x, z.y, z.radius).stroke({ color: 0xFF2222, width: 2, alpha: pulse + 0.4 });
      this._g.circle(z.x, z.y, z.radius).fill({ color: 0xFF0000, alpha: pulse * 0.3 });
    }

    // Draw pickups
    for (const s of scraps) {
      const x = s.x; const y = s.y;
      if (s.type === 'trail_boost') {
        // Cyan diamond
        this._g.moveTo(x, y - 8).lineTo(x + 6, y).lineTo(x, y + 8).lineTo(x - 6, y).closePath()
          .fill({ color: 0x7C5CFF, alpha: 0.25 });
      } else if (s.type === 'speed_pickup') {
        // Yellow triangle (simplified lightning)
        this._g.moveTo(x, y - 9).lineTo(x + 7, y + 2).lineTo(x + 2, y + 2).lineTo(x + 2, y + 9)
          .lineTo(x - 2, y + 9).lineTo(x - 2, y + 2).lineTo(x - 7, y + 2).closePath()
          .fill({ color: 0x35F2D0, alpha: 0.25 });
      } else if (s.type === 'bomb') {
        // Red circle with X
        this._g.circle(x, y, 13).fill({ color: 0xFF3333, alpha: 0.25 });
        this._g.circle(x, y, 7).fill({ color: 0xFF3333, alpha: 0.85 });
        this._g.moveTo(x - 4, y - 4).lineTo(x + 4, y + 4).stroke({ color: 0xFFFFFF, width: 1.5 });
        this._g.moveTo(x + 4, y - 4).lineTo(x - 4, y + 4).stroke({ color: 0xFFFFFF, width: 1.5 });
      } else {
        // scrap: gold hexagon (6 sides, radius CFG.SCRAP_RADIUS)
        const r = CFG.SCRAP_RADIUS;
        this._g.circle(x, y, r + 6).fill({ color: 0xFFB000, alpha: 0.25 });
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 6;
          if (i === 0) this._g.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
          else this._g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
        }
        this._g.closePath().fill({ color: 0xFFB000, alpha: 0.8 });
      }
    }
  }

  destroy(): void {
    this._g.destroy();
  }
}
