import { Graphics, Container } from 'pixi.js';
import type { ScrapPickup, BoostZone, PickupType } from '@gameplay/pureLogic';
import type { HazardZone } from '@gameplay/spawning/waveManager';
import type { BiomeHazardZone } from '@gameplay/world/biomeHazards';
import { getPickupDef } from '@gameplay/pickups/pickupRegistry';

export class PickupRenderer {
  private _g: Graphics;

  constructor(layer: Container) {
    this._g = new Graphics();
    layer.addChild(this._g);
  }

  update(scraps: ScrapPickup[], hazardZones: HazardZone[], boostZones: BoostZone[], biomeHazardZones: BiomeHazardZone[] = []): void {
    this._g.clear();

    // Draw boost zones (pulsing cyan rings)
    for (const z of boostZones) {
      const pulse = 0.5 + 0.3 * Math.sin(Date.now() / 300);
      this._g.circle(z.x, z.y, 30).fill({ color: 0x35F2D0, alpha: pulse * 0.2 });
      this._g.circle(z.x, z.y, 30).stroke({ color: 0x35F2D0, width: 2, alpha: pulse + 0.3 });
      this._g.circle(z.x, z.y, 18).stroke({ color: 0xFFFFFF, width: 1, alpha: pulse * 0.5 });
    }

    // Draw hazard zones (pulsing red circles — bomber bomb zones)
    for (const z of hazardZones) {
      const pulse = 0.3 + 0.2 * Math.sin(z.phase * 6);
      this._g.circle(z.x, z.y, z.radius).stroke({ color: 0xFF2222, width: 2, alpha: pulse + 0.4 });
      this._g.circle(z.x, z.y, z.radius).fill({ color: 0xFF0000, alpha: pulse * 0.3 });
    }

    // Draw biome hazard zones (heat cracks + corruption)
    for (const z of biomeHazardZones) {
      const pulse = 0.4 + 0.3 * Math.sin(z.phase * 5);
      if (z.state === 'telegraph') {
        // Dim orange outline — warning phase
        this._g.circle(z.x, z.y, z.radius).stroke({ color: 0xFF8800, width: 2, alpha: 0.4 + pulse * 0.3 });
        this._g.circle(z.x, z.y, z.radius * 0.5).stroke({ color: 0xFF8800, width: 1, alpha: 0.25 });
      } else {
        // Active eruption (heat crack) or corruption zone
        const isCorruption = z.radius > 80; // corruption zones grow; heat cracks stay small
        if (isCorruption) {
          this._g.circle(z.x, z.y, z.radius).fill({ color: 0x551177, alpha: 0.20 + pulse * 0.08 });
          this._g.circle(z.x, z.y, z.radius).stroke({ color: 0x66FF44, width: 2, alpha: 0.4 + pulse * 0.4 });
        } else {
          this._g.circle(z.x, z.y, z.radius).fill({ color: 0xFF4400, alpha: 0.35 + pulse * 0.2 });
          this._g.circle(z.x, z.y, z.radius).stroke({ color: 0xFF8800, width: 3, alpha: 0.7 + pulse * 0.3 });
        }
      }
    }

    // Draw pickups via registry (each type defines its own draw function).
    // Shared sine pulse (same cadence as boost zones above) drives contrast on icon glow/outline
    // so pickups stay readable against busy biome backgrounds. NOTE: not in original (OVR-4).
    const pickupPulse = 0.5 + 0.5 * Math.sin(Date.now() / 300);
    for (const s of scraps) {
      const def = getPickupDef((s.type ?? 'scrap') as PickupType);
      if (def) {
        def.draw(this._g, s.x, s.y, pickupPulse);
      } else {
        // Unknown pickup type — draw magenta marker so the missing registry entry is visible during playtest
        // Mirror any new PickupType added to pureLogic.ts in pickupRegistry.ts
        console.warn(`[PickupRenderer] Unknown pickup type: ${s.type}`);
        this._g.circle(s.x, s.y, 8).fill({ color: 0xFF00FF, alpha: 0.8 });
      }
    }
  }

  destroy(): void {
    this._g.destroy();
  }
}
