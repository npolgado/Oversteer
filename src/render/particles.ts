// particles.ts — Particle system: shard/smoke/spark particles, rings, skid marks.
// Ported from arena-drifter/fx.js:143-265 (source of truth).

import { Graphics, Container, Sprite, ParticleContainer } from 'pixi.js';

export type ParticleType = 'shard' | 'smoke' | 'ring' | 'spark';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  maxLife: number;
  size: number;
  type: ParticleType;
  color: number; // PixiJS hex int 0xRRGGBB
  gravity: number;  // px/s², applied as vy += gravity * dt. NOTE: not in original
  drag: number;     // 0–1 velocity multiplier per frame. NOTE: not in original
  sprite: Sprite | null; // null for graphics-based particles
}

interface SkidMark {
  x: number; y: number;
  color: number;
  alpha: number;
  age: number;
  angle: number;  // radians — car heading at spawn time. NOTE: not in original
  width: number;  // px — tire-width of the mark. NOTE: not in original
}

interface Ring {
  x: number; y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: number;
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
    x: 0, y: 0, color: 0, alpha: 0, age: 999, angle: 0, width: 14,
  }));
  private _skidHead = 0;
  private _skidCount = 0;

  // NOTE: not in original — ParticleContainer batches sparks/shards into one GPU draw call.
  private _spriteContainer: ParticleContainer;
  // NOTE: not in original — persistent Graphics; redrawn via clear() each frame to avoid per-frame GPU alloc.
  private _smokeGfx: Graphics;
  private _ringGfx: Graphics;
  private _skidGfx: Graphics;

  constructor(
    particlesLayer: Container,
    private _sparkTexture?: Sprite['texture'],
    private _isVisible?: (x: number, y: number, r: number) => boolean,
  ) {
    this._particlesLayer = particlesLayer;

    this._spriteContainer = new ParticleContainer();
    this._spriteContainer.blendMode = 'add';
    this._particlesLayer.addChild(this._spriteContainer);

    this._skidGfx = new Graphics();
    this._particlesLayer.addChildAt(this._skidGfx, 0);
    this._smokeGfx = new Graphics();
    this._particlesLayer.addChild(this._smokeGfx);
    this._ringGfx = new Graphics();
    this._particlesLayer.addChild(this._ringGfx);
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
      type = 'spark',
    } = opts;

    // Per-type physics and size defaults — NOTE: not in original (no gravity/drag in original).
    const typeDefaults = (() => {
      switch (type) {
        case 'spark': return { gravity: 300, drag: 0.98, sizeMin: opts.sizeMin ?? 6,  sizeMax: opts.sizeMax ?? 14 };
        case 'shard': return { gravity: 180, drag: 1.0,  sizeMin: opts.sizeMin ?? 8,  sizeMax: opts.sizeMax ?? 18 };
        case 'smoke': return { gravity: -60, drag: 0.94, sizeMin: opts.sizeMin ?? 20, sizeMax: opts.sizeMax ?? 50 };
        default:      return { gravity: 0,   drag: 1.0,  sizeMin: opts.sizeMin ?? 2,  sizeMax: opts.sizeMax ?? 5  };
      }
    })();

    const isSpriteType = (type === 'spark' || type === 'shard') && !!this._sparkTexture;

    for (let i = 0; i < count; i++) {
      const life = lifeMin + Math.random() * (lifeMax - lifeMin);
      const size = typeDefaults.sizeMin + Math.random() * (typeDefaults.sizeMax - typeDefaults.sizeMin);

      let sprite: Sprite | null = null;
      if (isSpriteType) {
        sprite = new Sprite(this._sparkTexture!);
        sprite.anchor.set(0.5);
        sprite.tint = color;
        // ParticleContainer API differs between Pixi versions. Prefer addParticle/removeParticle when available.
        if ('addParticle' in this._spriteContainer && (this._spriteContainer as any).addParticle) {
          (this._spriteContainer as any).addParticle(sprite);
        } else {
          this._spriteContainer.addChild(sprite);
        }
      }

      this._particles.push({
        x, y,
        vx: vxMin + Math.random() * (vxMax - vxMin),
        vy: vyMin + Math.random() * (vyMax - vyMin),
        life, maxLife: life,
        size, type, color,
        gravity: typeDefaults.gravity,
        drag: typeDefaults.drag,
        sprite,
      });
    }
  }

  addRing(x: number, y: number, color: number): void {
    const maxLife = 0.5;
    const maxRadius = 150;
    this._rings.push({ x, y, radius: 0, maxRadius, life: maxLife, maxLife, color });
  }

  // NOTE: not in original — quick 40px ring for hit confirmation FX.
  addPulseRing(x: number, y: number, color: number): void {
    this._rings.push({ x, y, radius: 0, maxRadius: 40, life: 0.2, maxLife: 0.2, color });
  }

  addSkid(x: number, y: number, color: number, alpha: number, angle = 0, width = 14): void {
    this._skidMarks[this._skidHead] = { x, y, color, alpha, age: 0, angle, width };
    this._skidHead = (this._skidHead + 1) % MAX_SKIDS;
    if (this._skidCount < MAX_SKIDS) this._skidCount++;
  }

  update(dt: number): void {
    // Particles (swap-and-pop)
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.vy += p.gravity * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'smoke') p.size += dt * 8;
      p.life -= dt;
      if (p.life <= 0) {
        if (p.sprite) {
          if ('removeParticle' in this._spriteContainer && (this._spriteContainer as any).removeParticle) {
            (this._spriteContainer as any).removeParticle(p.sprite);
          } else {
            this._spriteContainer.removeChild(p.sprite);
          }
          p.sprite.destroy();
        }
        this._particles[i] = this._particles[this._particles.length - 1];
        this._particles.pop();
        continue;
      }
      if (p.sprite) this._drawSprite(p);
    }

    // Rings (swap-and-pop)
    for (let i = this._rings.length - 1; i >= 0; i--) {
      const r = this._rings[i];
      r.radius += (r.maxRadius / r.maxLife) * dt;
      r.life -= dt;
      if (r.life <= 0) {
        this._rings[i] = this._rings[this._rings.length - 1];
        this._rings.pop();
      }
    }

    // Skid marks age
    for (let i = 0; i < this._skidCount; i++) this._skidMarks[i].age += dt;

    // Render layers — each clears and redraws its persistent Graphics.
    this._renderSmoke();
    this._renderRings();
    this._renderSkids();
  }

  private _drawSprite(p: Particle): void {
    const alpha = p.life / p.maxLife;
    p.sprite!.position.set(p.x, p.y);
    p.sprite!.alpha = alpha;
    p.sprite!.scale.set(p.size / 4);
  }

  // NOTE: not in original — renders all smoke/fallback particles into one persistent Graphics per frame.
  private _renderSmoke(): void {
    this._smokeGfx.clear();
    for (const p of this._particles) {
      if (p.sprite) continue;
      const alpha = p.life / p.maxLife;
      if (p.type === 'smoke') {
        // Ease-out alpha: stays opaque longer, fades fast at end. NOTE: not in original.
        const easeAlpha = Math.pow(alpha, 0.4);
        this._smokeGfx.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: easeAlpha });
      } else if (p.type === 'shard') {
        const s = p.size;
        this._smokeGfx.poly([p.x, p.y - s, p.x + s * 0.7, p.y + s * 0.5, p.x - s * 0.7, p.y + s * 0.5])
           .fill({ color: p.color, alpha });
      } else {
        this._smokeGfx.rect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size).fill({ color: p.color, alpha });
      }
    }
  }

  // NOTE: not in original — renders all rings into one persistent Graphics per frame.
  private _renderRings(): void {
    this._ringGfx.clear();
    for (const r of this._rings) {
      const alpha = r.life / r.maxLife;
      this._ringGfx.circle(r.x, r.y, r.radius).stroke({ color: r.color, width: 2, alpha });
    }
  }

  // NOTE: not in original — renders visible skid marks as oriented quads into persistent Graphics each frame.
  private _renderSkids(): void {
    this._skidGfx.clear();
    const markLen = 8;
    for (let i = 0; i < this._skidCount; i++) {
      const s = this._skidMarks[i];
      if (s.age >= 8) continue;
      const fadeAlpha = s.alpha * (1 - s.age / 8);
      if (fadeAlpha <= 0.01) continue;
      // Mirror original canvas renderSkids() camera cull (fx.js:218)
      if (this._isVisible && !this._isVisible(s.x, s.y, 8)) continue;

      const hw = s.width / 2;
      const hl = markLen / 2;
      const cos = Math.cos(s.angle);
      const sin = Math.sin(s.angle);
      this._skidGfx
        .poly([
          s.x + cos * hl - sin * hw, s.y + sin * hl + cos * hw,
          s.x - cos * hl - sin * hw, s.y - sin * hl + cos * hw,
          s.x - cos * hl + sin * hw, s.y - sin * hl - cos * hw,
          s.x + cos * hl + sin * hw, s.y + sin * hl - cos * hw,
        ])
        .fill({ color: s.color, alpha: fadeAlpha });
    }
  }

  clear(): void {
    for (const p of this._particles) {
      if (p.sprite) {
        if ('removeParticle' in this._spriteContainer && (this._spriteContainer as any).removeParticle) {
          (this._spriteContainer as any).removeParticle(p.sprite);
        } else {
          this._spriteContainer.removeChild(p.sprite);
        }
        p.sprite.destroy();
      }
    }
    this._particles = [];
    this._rings = [];
    this._smokeGfx.clear();
    this._ringGfx.clear();
    this._skidGfx.clear();
    this._skidHead = 0;
    this._skidCount = 0;
  }

  destroy(): void {
    this.clear();
    this._smokeGfx.destroy();
    this._ringGfx.destroy();
    this._skidGfx.destroy();
    this._spriteContainer.destroy();
  }
}
