// particles.ts — Particle system: shard/smoke/spark particles, rings, skid marks.
// Ported from arena-drifter/fx.js:143-265 (source of truth).

import { Graphics, Container, Particle as PIXIParticle, ParticleContainer, type Texture } from 'pixi.js';

export type ParticleType = 'shard' | 'smoke' | 'ring' | 'spark';

interface SysParticle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  maxLife: number;
  size: number;
  type: ParticleType;
  color: number; // PixiJS hex int 0xRRGGBB
  gravity: number;  // px/s², applied as vy += gravity * dt. NOTE: not in original
  drag: number;     // 0–1 velocity multiplier per frame. NOTE: not in original
  sprite: PIXIParticle | null; // Spark/shard types use GPU-batched PIXIParticle; smoke uses Graphics.
}

export type Particle = SysParticle;

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

// NOTE: not in original — jagged lightning-bolt line FX (e.g. Chain Lightning upgrade arc).
interface Bolt {
  x1: number; y1: number;
  x2: number; y2: number;
  /** Perpendicular jitter offsets for each interior joint, precomputed at spawn for a stable zigzag. */
  jitter: number[];
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
  private _bolts: Bolt[] = []; // NOTE: not in original
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
  private _boltGfx: Graphics; // NOTE: not in original

  constructor(
    particlesLayer: Container,
    private _sparkTexture?: Texture,
    private _isVisible?: (x: number, y: number, r: number) => boolean,
  ) {
    this._particlesLayer = particlesLayer;

    // Sparks/shards change scale and alpha every frame, so vertex/color must be dynamic.
    this._spriteContainer = new ParticleContainer({
      texture: this._sparkTexture,
      dynamicProperties: {
        position: true,
        vertex: true,
        color: true,
      },
      roundPixels: true,
    });
    this._spriteContainer.blendMode = 'add';
    this._particlesLayer.addChild(this._spriteContainer);

    this._skidGfx = new Graphics();
    this._particlesLayer.addChildAt(this._skidGfx, 0);
    this._smokeGfx = new Graphics();
    this._particlesLayer.addChild(this._smokeGfx);
    this._ringGfx = new Graphics();
    this._particlesLayer.addChild(this._ringGfx);
    this._boltGfx = new Graphics(); // NOTE: not in original
    this._particlesLayer.addChild(this._boltGfx);
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

    // Sparks and shards route through the GPU-batched ParticleContainer; smoke uses Graphics.
    const useSprite = (type === 'spark' || type === 'shard') && !!this._sparkTexture;

    for (let i = 0; i < count; i++) {
      const life = lifeMin + Math.random() * (lifeMax - lifeMin);
      const size = typeDefaults.sizeMin + Math.random() * (typeDefaults.sizeMax - typeDefaults.sizeMin);

      let sprite: PIXIParticle | null = null;
      if (useSprite) {
        sprite = new PIXIParticle({
          texture: this._sparkTexture!,
          x, y,
          tint: color,
          alpha: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          scaleX: size / 4,
          scaleY: size / 4,
        });
        this._spriteContainer.addParticle(sprite);
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

  // NOTE: not in original — jagged bolt line between two points (e.g. Chain Lightning arc).
  addBolt(x1: number, y1: number, x2: number, y2: number, color: number): void {
    const JOINTS = 4;
    const JITTER_PX = 14;
    const jitter: number[] = [];
    for (let i = 0; i < JOINTS; i++) jitter.push((Math.random() * 2 - 1) * JITTER_PX);
    this._bolts.push({ x1, y1, x2, y2, jitter, life: 0.22, maxLife: 0.22, color });
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
        if (p.sprite) this._spriteContainer.removeParticle(p.sprite);
        this._particles[i] = this._particles[this._particles.length - 1];
        this._particles.pop();
        continue;
      }
      // Sync GPU-batched sprite particles each frame.
      if (p.sprite) {
        p.sprite.x = p.x;
        p.sprite.y = p.y;
        const alpha = p.life / p.maxLife;
        p.sprite.alpha = alpha;
        const s = p.size / 4;
        p.sprite.scaleX = s;
        p.sprite.scaleY = s;
        // Restore shard rotation from arena-drifter/fx.js:263 (ctx.rotate(p.life * 10)).
        if (p.type === 'shard') p.sprite.rotation += 10 * dt;
      }
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

    // Bolts (swap-and-pop) — NOTE: not in original
    for (let i = this._bolts.length - 1; i >= 0; i--) {
      const b = this._bolts[i];
      b.life -= dt;
      if (b.life <= 0) {
        this._bolts[i] = this._bolts[this._bolts.length - 1];
        this._bolts.pop();
      }
    }

    // Render layers — each clears and redraws its persistent Graphics.
    this._renderSmoke();
    this._renderRings();
    this._renderSkids();
    this._renderBolts();
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

  // NOTE: not in original — renders jagged bolt lines with a glow pass + bright core pass.
  private _renderBolts(): void {
    this._boltGfx.clear();
    for (const b of this._bolts) {
      const alpha = b.life / b.maxLife;
      const dx = b.x2 - b.x1;
      const dy = b.y2 - b.y1;
      const len = Math.hypot(dx, dy) || 1;
      // Perpendicular unit vector for jitter offsets.
      const nx = -dy / len;
      const ny = dx / len;
      const joints = b.jitter.length;
      const points: number[] = [b.x1, b.y1];
      for (let i = 1; i <= joints; i++) {
        const t = i / (joints + 1);
        const px = b.x1 + dx * t + nx * b.jitter[i - 1] * alpha;
        const py = b.y1 + dy * t + ny * b.jitter[i - 1] * alpha;
        points.push(px, py);
      }
      points.push(b.x2, b.y2);

      // Glow pass: wide, low-alpha.
      this._boltGfx.poly(points, false).stroke({ color: b.color, width: 6, alpha: alpha * 0.35 });
      // Core pass: thin, bright.
      this._boltGfx.poly(points, false).stroke({ color: b.color, width: 2, alpha });
    }
  }

  clear(): void {
    // Remove all GPU-batched sprites before clearing the array.
    for (const p of this._particles) {
      if (p.sprite) this._spriteContainer.removeParticle(p.sprite);
    }
    this._particles = [];
    this._rings = [];
    this._bolts = [];
    this._smokeGfx.clear();
    this._ringGfx.clear();
    this._skidGfx.clear();
    this._boltGfx.clear();
    this._skidHead = 0;
    this._skidCount = 0;
  }

  destroy(): void {
    this.clear();
    this._smokeGfx.destroy();
    this._ringGfx.destroy();
    this._skidGfx.destroy();
    this._boltGfx.destroy();
    this._spriteContainer.destroy();
  }
}
