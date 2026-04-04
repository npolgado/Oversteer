// particles.ts — Particle system: shard/smoke/spark particles, rings, skid marks.
// Ported from arena-drifter/fx.js:143-265 (source of truth).

import { Graphics, Container } from 'pixi.js';

export type ParticleType = 'shard' | 'smoke' | 'ring' | 'spark';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  maxLife: number;
  size: number;
  type: ParticleType;
  color: number; // PixiJS hex int 0xRRGGBB
  gfx: Graphics;
}

interface SkidMark {
  x: number; y: number;
  color: number;
  alpha: number;
  age: number;
}

interface Ring {
  x: number; y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: number;
  gfx: Graphics;
}

const MAX_SKIDS = 600;

export interface SpawnOpts {
  type?: ParticleType;
  vxMin?: number; vxMax?: number;
  vyMin?: number; vyMax?: number;
  lifeMin?: number; lifeMax?: number;
  sizeMin?: number; sizeMax?: number;
}

export class ParticleSystem {
  private _particlesLayer: Container;
  private _particles: Particle[] = [];
  private _rings: Ring[] = [];
  private _skidMarks: SkidMark[] = new Array(MAX_SKIDS).fill(null).map(() => ({
    x: 0, y: 0, color: 0, alpha: 0, age: 999,
  }));
  private _skidHead = 0;
  private _skidCount = 0;

  constructor(particlesLayer: Container) {
    this._particlesLayer = particlesLayer;
  }

  spawn(
    x: number, y: number,
    color: number,
    count: number,
    opts: SpawnOpts = {},
  ): void {
    const {
      vxMin = -100, vxMax = 100,
      vyMin = -100, vyMax = 100,
      lifeMin = 0.3, lifeMax = 0.8,
      sizeMin = 2, sizeMax = 5,
      type = 'spark',
    } = opts;

    for (let i = 0; i < count; i++) {
      const life = lifeMin + Math.random() * (lifeMax - lifeMin);
      const gfx = new Graphics();
      this._particlesLayer.addChild(gfx);
      this._particles.push({
        x, y,
        vx: vxMin + Math.random() * (vxMax - vxMin),
        vy: vyMin + Math.random() * (vyMax - vyMin),
        life, maxLife: life,
        size: sizeMin + Math.random() * (sizeMax - sizeMin),
        type, color, gfx,
      });
    }
  }

  addRing(x: number, y: number, color: number): void {
    const maxLife = 0.3; // fx.js:183
    const gfx = new Graphics();
    this._particlesLayer.addChild(gfx);
    this._rings.push({ x, y, radius: 0, maxRadius: 80, life: maxLife, maxLife, color, gfx });
  }

  addSkid(x: number, y: number, color: number, alpha: number): void {
    this._skidMarks[this._skidHead] = { x, y, color, alpha, age: 0 };
    this._skidHead = (this._skidHead + 1) % MAX_SKIDS;
    if (this._skidCount < MAX_SKIDS) this._skidCount++;
  }

  update(dt: number): void {
    // Particles (swap-and-pop)
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'smoke') {
        p.vx *= 0.95; p.vy *= 0.95;
        p.size += dt * 8;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.gfx.destroy();
        this._particles[i] = this._particles[this._particles.length - 1];
        this._particles.pop();
        continue;
      }
      this._drawParticle(p);
    }

    // Rings (swap-and-pop)
    for (let i = this._rings.length - 1; i >= 0; i--) {
      const r = this._rings[i];
      r.radius += (r.maxRadius / 0.3) * dt;
      r.life -= dt;
      if (r.life <= 0) {
        r.gfx.destroy();
        this._rings[i] = this._rings[this._rings.length - 1];
        this._rings.pop();
        continue;
      }
      this._drawRing(r);
    }

    // Skid marks age (ring buffer, old ones age out naturally)
    for (let i = 0; i < this._skidCount; i++) {
      this._skidMarks[i].age += dt;
    }
  }

  private _drawParticle(p: Particle): void {
    const alpha = p.life / p.maxLife;
    p.gfx.clear();
    if (p.type === 'smoke') {
      p.gfx.circle(p.x, p.y, p.size).fill({ color: p.color, alpha });
    } else if (p.type === 'shard') {
      const s = p.size;
      p.gfx
        .poly([
          p.x, p.y - s,
          p.x + s * 0.7, p.y + s * 0.5,
          p.x - s * 0.7, p.y + s * 0.5,
        ])
        .fill({ color: p.color, alpha });
    } else {
      // spark / default: square
      p.gfx.rect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size).fill({ color: p.color, alpha });
    }
  }

  private _drawRing(r: Ring): void {
    const alpha = r.life / r.maxLife;
    r.gfx.clear();
    r.gfx.circle(r.x, r.y, r.radius).stroke({ color: r.color, width: 2, alpha });
  }

  clear(): void {
    for (const p of this._particles) p.gfx.destroy();
    this._particles = [];
    for (const r of this._rings) r.gfx.destroy();
    this._rings = [];
    this._skidHead = 0;
    this._skidCount = 0;
  }

  destroy(): void {
    this.clear();
  }
}
