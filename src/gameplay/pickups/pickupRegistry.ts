// pickupRegistry.ts — Visual rendering definitions for all pickup types.
// Spawn weights and selection logic live in pureLogic.ts::selectPickupType
// to keep this file free of circular dependencies.

import { Graphics } from 'pixi.js';
import { CFG } from '@core/config';
import type { PickupType } from '@gameplay/pureLogic';

export interface PickupDef {
  id: PickupType;
  draw: (g: Graphics, x: number, y: number) => void;
}

export const PICKUP_REGISTRY: PickupDef[] = [
  {
    id: 'scrap',
    draw(g, x, y) {
      const r = CFG.SCRAP_RADIUS;
      g.circle(x, y, r + 6).fill({ color: 0xFFB000, alpha: 0.25 });
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        if (i === 0) g.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
        else         g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
      }
      g.closePath().fill({ color: 0xFFB000, alpha: 0.8 });
    },
  },
  {
    id: 'trail_boost',
    // NOTE: not in original — changed from diamond to upward-arrow so it reads differently from trail_token (Bug 1.9)
    draw(g, x, y) {
      // Outer glow circle
      g.circle(x, y, 11).fill({ color: 0x7C5CFF, alpha: 0.20 });
      // Upward arrow: distinguishes it from trail_token's nested diamonds
      g.moveTo(x, y - 9).lineTo(x + 6, y).lineTo(x + 2, y).lineTo(x + 2, y + 7)
        .lineTo(x - 2, y + 7).lineTo(x - 2, y).lineTo(x - 6, y).closePath()
        .fill({ color: 0x7C5CFF, alpha: 0.25 });
      g.moveTo(x, y - 9).lineTo(x + 6, y).lineTo(x + 2, y).lineTo(x + 2, y + 7)
        .lineTo(x - 2, y + 7).lineTo(x - 2, y).lineTo(x - 6, y).closePath()
        .stroke({ color: 0xAA88FF, width: 1.5, alpha: 0.9 });
    },
  },
  {
    id: 'speed_pickup',
    draw(g, x, y) {
      g.moveTo(x, y - 9).lineTo(x + 7, y + 2).lineTo(x + 2, y + 2).lineTo(x + 2, y + 9)
        .lineTo(x - 2, y + 9).lineTo(x - 2, y + 2).lineTo(x - 7, y + 2).closePath()
        .fill({ color: 0x35F2D0, alpha: 0.25 });
      g.moveTo(x, y - 9).lineTo(x + 7, y + 2).lineTo(x + 2, y + 2).lineTo(x + 2, y + 9)
        .lineTo(x - 2, y + 9).lineTo(x - 2, y + 2).lineTo(x - 7, y + 2).closePath()
        .stroke({ color: 0x35F2D0, width: 1.5, alpha: 0.9 });
    },
  },
  {
    id: 'bomb',
    // NOTE: not in original — bomb pulses alpha and radius to telegraph danger at a glance (Bug 1.6)
    draw(g, x, y) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 220); // 0–1 oscillating
      const outerR = 11 + pulse * 4;  // 11-15 px outer glow radius
      const innerR = 6 + pulse * 2;   // 6-8 px core radius
      g.circle(x, y, outerR + 4).fill({ color: 0xFF2200, alpha: 0.15 + pulse * 0.2 });
      g.circle(x, y, outerR).fill({ color: 0xFF3333, alpha: 0.25 + pulse * 0.15 });
      g.circle(x, y, innerR).fill({ color: 0xFF3333, alpha: 0.75 + pulse * 0.25 });
      // X cross — danger glyph
      const hs = 4 + pulse;
      g.moveTo(x - hs, y - hs).lineTo(x + hs, y + hs).stroke({ color: 0xFFFFFF, width: 1.5 });
      g.moveTo(x + hs, y - hs).lineTo(x - hs, y + hs).stroke({ color: 0xFFFFFF, width: 1.5 });
    },
  },
  {
    id: 'time_slow',
    draw(g, x, y) {
      g.circle(x, y, 10).fill({ color: 0x44AAFF, alpha: 0.25 });
      g.circle(x, y, 10).stroke({ color: 0x44AAFF, width: 1.5, alpha: 0.9 });
      // Clock hands (12 o'clock + 3 o'clock position)
      g.moveTo(x, y).lineTo(x, y - 6).stroke({ color: 0xFFFFFF, width: 1.5 });
      g.moveTo(x, y).lineTo(x + 5, y).stroke({ color: 0xFFFFFF, width: 1 });
    },
  },
  {
    id: 'trail_token',
    draw(g, x, y) {
      // Magenta nested diamonds
      g.moveTo(x, y - 10).lineTo(x + 7, y).lineTo(x, y + 10).lineTo(x - 7, y).closePath()
        .fill({ color: 0xFF44CC, alpha: 0.25 });
      g.moveTo(x, y - 10).lineTo(x + 7, y).lineTo(x, y + 10).lineTo(x - 7, y).closePath()
        .stroke({ color: 0xFF44CC, width: 1.5, alpha: 0.9 });
      g.moveTo(x, y - 5).lineTo(x + 4, y).lineTo(x, y + 5).lineTo(x - 4, y).closePath()
        .fill({ color: 0xFF44CC, alpha: 0.7 });
    },
  },
  {
    id: 'shield_pickup',
    draw(g, x, y) {
      // Green shield pentagon
      const pts: [number, number][] = [];
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 / 5) * i - Math.PI / 2;
        pts.push([x + 9 * Math.cos(a), y + 9 * Math.sin(a)]);
      }
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.closePath().fill({ color: 0x44FF88, alpha: 0.25 });
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.closePath().stroke({ color: 0x44FF88, width: 1.5, alpha: 0.9 });
    },
  },
];

/** O(n) lookup — pickup list is small. */
export function getPickupDef(id: PickupType): PickupDef | undefined {
  return PICKUP_REGISTRY.find(d => d.id === id);
}
