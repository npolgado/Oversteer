// fx.js — FXCache, PerfMon, Particles, ScreenFX, Camera
(function() {
  'use strict';
  const { CFG, S, U } = window.OversteerLogic;

  // ── PRE-RENDERED FX CACHES ──────────────────────────────────
  const FXCache = {
    vignetteCanvas: null,
    propGlow: {},  // keyed by "radius_type"
    pickupGlow: {}, // keyed by pickup type
    boostGlow: null,

    _hexToRgb(hex) {
      const raw = hex.replace('#', '').trim();
      if (raw.length === 3) {
        return {
          r: parseInt(raw[0] + raw[0], 16),
          g: parseInt(raw[1] + raw[1], 16),
          b: parseInt(raw[2] + raw[2], 16),
        };
      }
      return {
        r: parseInt(raw.slice(0, 2), 16),
        g: parseInt(raw.slice(2, 4), 16),
        b: parseInt(raw.slice(4, 6), 16),
      };
    },

    _rgba(hex, a) {
      const { r, g, b } = this._hexToRgb(hex);
      return `rgba(${r},${g},${b},${a})`;
    },

    _makeGlow(radius, color, a0, a1, a2) {
      const size = Math.ceil(radius * 2) + 2;
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const cx = c.getContext('2d');
      const center = size / 2;
      const g = cx.createRadialGradient(center, center, radius * 0.2, center, center, radius);
      g.addColorStop(0, this._rgba(color, a0));
      g.addColorStop(0.5, this._rgba(color, a1));
      g.addColorStop(1, this._rgba(color, a2));
      cx.fillStyle = g;
      cx.beginPath();
      cx.arc(center, center, radius, 0, Math.PI * 2);
      cx.fill();
      return { canvas: c, size };
    },

    initVignette() {
      const c = document.createElement('canvas');
      c.width = CFG.W; c.height = CFG.H;
      const cx = c.getContext('2d');
      const vig = cx.createRadialGradient(CFG.W/2, CFG.H/2, CFG.H * 0.3, CFG.W/2, CFG.H/2, CFG.W * 0.7);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.5)');
      cx.fillStyle = vig;
      cx.fillRect(0, 0, CFG.W, CFG.H);
      this.vignetteCanvas = c;
    },

    initPropGlow() {
      const glowColors = {
        solid:      { c0: 'rgba(255,50,30,0.6)',  c1: 'rgba(255,30,10,0.25)', c2: 'rgba(255,0,0,0)' },
        slow:       { c0: 'rgba(180,120,40,0.5)', c1: 'rgba(140,80,20,0.2)',  c2: 'rgba(100,50,0,0)' },
        slip:       { c0: 'rgba(60,120,220,0.5)', c1: 'rgba(40,80,180,0.2)',  c2: 'rgba(20,40,140,0)' },
        decoration: { c0: 'rgba(40,140,40,0.3)',  c1: 'rgba(30,100,30,0.1)',  c2: 'rgba(20,60,20,0)' },
      };
      for (const def of CFG.PROP_POOL) {
        const key = def.radius + '_' + def.type;
        if (this.propGlow[key]) continue;
        const glowR = def.radius * 2;
        const size = Math.ceil(glowR * 2) + 2;
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const cx = c.getContext('2d');
        const center = size / 2;
        const colors = glowColors[def.type] || glowColors.solid;
        const g = cx.createRadialGradient(center, center, def.radius * 0.2, center, center, glowR);
        g.addColorStop(0, colors.c0);
        g.addColorStop(0.5, colors.c1);
        g.addColorStop(1, colors.c2);
        cx.fillStyle = g;
        cx.beginPath();
        cx.arc(center, center, glowR, 0, Math.PI * 2);
        cx.fill();
        this.propGlow[key] = { canvas: c, size };
      }
    },

    initPickupGlow() {
      const baseR = CFG.SCRAP_RADIUS;
      const defs = {
        scrap: { color: CFG.C_PICKUP, radius: baseR * 2.4, a0: 0.65, a1: 0.3, a2: 0 },
        speed_pickup: { color: CFG.C_ACCENT, radius: baseR * 2.6, a0: 0.6, a1: 0.28, a2: 0 },
        trail_boost: { color: CFG.C_RARE, radius: baseR * 2.6, a0: 0.6, a1: 0.28, a2: 0 },
        bomb: { color: '#FF4444', radius: baseR * 3.1, a0: 0.75, a1: 0.35, a2: 0 },
      };
      for (const [key, def] of Object.entries(defs)) {
        this.pickupGlow[key] = this._makeGlow(def.radius, def.color, def.a0, def.a1, def.a2);
      }
    },

    initBoostGlow() {
      const radius = CFG.BOOST_ZONE_RADIUS * 2.1;
      this.boostGlow = this._makeGlow(radius, CFG.C_ACCENT, 0.55, 0.25, 0);
    },

    init() {
      this.initVignette();
      this.initPropGlow();
      this.initPickupGlow();
      this.initBoostGlow();
    },
  };

  // ── PERF MONITOR ────────────────────────────────────────────
  const PerfMon = {
    _buf: new Float32Array(60),
    _idx: 0,
    _count: 0,
    record(rawDtMs) {
      this._buf[this._idx] = rawDtMs;
      this._idx = (this._idx + 1) % 60;
      if (this._count < 60) this._count++;
    },
    avgFps() {
      if (!this._count) return 0;
      let sum = 0;
      for (let i = 0; i < this._count; i++) sum += this._buf[i];
      return 1000 / (sum / this._count);
    },
    worstMs() {
      let worst = 0;
      for (let i = 0; i < this._count; i++) {
        if (this._buf[i] > worst) worst = this._buf[i];
      }
      return worst;
    }
  };

  // ── PARTICLES / FX ──────────────────────────────────────────
  const Particles = {
    list: [],
    skidMarks: [],
    _skidHead: 0,  // ring buffer write index
    MAX_SKIDS: 600,
    floatingTexts: [],
    rings: [],

    clear() {
      this.list = [];
      this.skidMarks = [];
      this._skidHead = 0;
      this.floatingTexts = [];
      this.rings = [];
    },

    spawn(x, y, color, count, opts = {}) {
      for (let i = 0; i < count; i++) {
        this.list.push({
          x, y, color,
          vx: U.randFloat(opts.vxMin || -100, opts.vxMax || 100),
          vy: U.randFloat(opts.vyMin || -100, opts.vyMax || 100),
          life: U.randFloat(opts.lifeMin || 0.3, opts.lifeMax || 0.8),
          maxLife: U.randFloat(opts.lifeMin || 0.3, opts.lifeMax || 0.8),
          size: U.randFloat(opts.sizeMin || 2, opts.sizeMax || 5),
          type: opts.type || 'spark',
        });
      }
    },

    addSkid(x, y, color, alpha) {
      const entry = { x, y, color, alpha, age: 0 };
      if (this.skidMarks.length < this.MAX_SKIDS) {
        this.skidMarks.push(entry);
      } else {
        this.skidMarks[this._skidHead] = entry;
        this._skidHead = (this._skidHead + 1) % this.MAX_SKIDS;
      }
    },

    addFloat(x, y, text, color, size) {
      this.floatingTexts.push({ x, y, text, color, size: size || 16, life: 0.6, vy: -45 });
    },

    addRing(x, y, color) {
      this.rings.push({ x, y, color, radius: 0, maxRadius: 80, life: 0.3 });
    },

    update(dt) {
      // Particles (swap-and-pop)
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.type === 'smoke') {
          p.vx *= 0.95; p.vy *= 0.95;
          p.size += dt * 8;
        }
        p.life -= dt;
        if (p.life <= 0) { this.list[i] = this.list[this.list.length - 1]; this.list.pop(); }
      }

      // Skid marks fade (ring buffer — old marks overwritten automatically)
      for (let i = this.skidMarks.length - 1; i >= 0; i--) {
        this.skidMarks[i].age += dt;
      }

      // Floating texts (swap-and-pop)
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.y += ft.vy * dt;
        ft.life -= dt;
        if (ft.life <= 0) { this.floatingTexts[i] = this.floatingTexts[this.floatingTexts.length - 1]; this.floatingTexts.pop(); }
      }

      // Rings (swap-and-pop)
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.radius += (r.maxRadius / 0.3) * dt;
        r.life -= dt;
        if (r.life <= 0) { this.rings[i] = this.rings[this.rings.length - 1]; this.rings.pop(); }
      }
    },

    renderSkids(ctx) {
      const Camera = window.Camera;
      for (const s of this.skidMarks) {
        if (s.age > 6) continue;
        if (!Camera.isVisible(s.x, s.y, 3)) continue;
        const alpha = Math.max(0, s.alpha * (1 - s.age / 6));
        if (alpha < 0.01) continue;
        ctx.fillStyle = s.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
      }
      ctx.globalAlpha = 1;
    },

    renderParticles(ctx) {
      for (const p of this.list) {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        if (p.type === 'smoke') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'shard') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.life * 10);
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size * 0.7, p.size * 0.5);
          ctx.lineTo(-p.size * 0.7, p.size * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
        }
      }
      ctx.globalAlpha = 1;
    },

    renderFloats(ctx) {
      for (const ft of this.floatingTexts) {
        ctx.globalAlpha = U.clamp(ft.life / 0.3, 0, 1);
        U.text(ctx, ft.text, ft.x, ft.y, { color: ft.color, size: ft.size, align: 'center', bold: true, shadow: true });
      }
      ctx.globalAlpha = 1;
    },

    renderRings(ctx) {
      for (const r of this.rings) {
        ctx.globalAlpha = r.life / 0.3;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
  };

  // ── SCREEN FX ────────────────────────────────────────────────
  const ScreenFX = {
    shakeIntensity: 0,
    shakeDuration: 0,
    shakeTimer: 0,
    flashColor: null,
    flashAlpha: 0,
    flashTimer: 0,
    zoomPulse: 1,
    zoomTarget: 1,
    zoomTimer: 0,
    timeDilation: 1,
    timeTarget: 1,
    timeTimer: 0,
    desatAmount: 0,
    desatTarget: 0,
    freezeTimer: 0,

    shake(intensity, dur, dirX, dirY) {
      this.shakeIntensity = intensity;
      this.shakeDuration = dur;
      this.shakeTimer = dur;
      this._shakeDirX = dirX || 0;
      this._shakeDirY = dirY || 0;
    },

    flash(color, alpha, dur) {
      this.flashColor = color;
      this.flashAlpha = alpha;
      this.flashTimer = dur;
    },

    zoom(target, dur) {
      this.zoomTarget = target;
      this.zoomTimer = dur;
    },

    slowmo(factor, dur) {
      this.timeDilation = factor;
      this.timeTimer = dur;
    },

    freeze(dur) {
      this.freezeTimer = dur;
    },

    desaturate(target) {
      this.desatTarget = target;
    },

    reset() {
      this.shakeTimer = 0; this.flashTimer = 0; this.zoomPulse = 1;
      this.zoomTarget = 1; this.zoomTimer = 0;
      this.timeDilation = 1; this.timeTarget = 1; this.timeTimer = 0;
      this.desatAmount = 0; this.desatTarget = 0;
      this.freezeTimer = 0;
    },

    update(rawDt) {
      if (this.freezeTimer > 0) { this.freezeTimer -= rawDt; return 0; }

      if (this.shakeTimer > 0) this.shakeTimer -= rawDt;

      if (this.flashTimer > 0) this.flashTimer -= rawDt;

      if (this.zoomTimer > 0) {
        this.zoomPulse = U.lerp(this.zoomPulse, this.zoomTarget, 0.15);
        this.zoomTimer -= rawDt;
      } else {
        this.zoomPulse = U.lerp(this.zoomPulse, 1, 0.15);
      }

      if (this.timeTimer > 0) {
        this.timeTimer -= rawDt;
      } else {
        this.timeDilation = U.lerp(this.timeDilation, 1, 0.1);
      }

      this.desatAmount = U.lerp(this.desatAmount, this.desatTarget, 0.05);

      return rawDt * this.timeDilation;
    },

    applyPre(ctx) {
      // Shake (with optional directional bias)
      let ox = 0, oy = 0;
      if (this.shakeTimer > 0) {
        const frac = this.shakeTimer / this.shakeDuration;
        const mag = this.shakeIntensity * frac;
        ox = U.randFloat(-mag, mag);
        oy = U.randFloat(-mag, mag);
        if (this._shakeDirX || this._shakeDirY) {
          ox = ox * 0.3 + this._shakeDirX * mag * 0.7;
          oy = oy * 0.3 + this._shakeDirY * mag * 0.7;
        }
      }

      ctx.save();
      ctx.translate(CFG.W/2, CFG.H/2);
      ctx.scale(this.zoomPulse, this.zoomPulse);
      ctx.translate(-CFG.W/2 + ox, -CFG.H/2 + oy);
    },

    applyPost(ctx) {
      ctx.restore();

      // Flash overlay
      if (this.flashTimer > 0 && this.flashColor) {
        ctx.fillStyle = this.flashColor;
        ctx.globalAlpha = this.flashAlpha * (this.flashTimer > 0 ? 1 : 0);
        ctx.fillRect(0, 0, CFG.W, CFG.H);
        ctx.globalAlpha = 1;
      }

      // Desaturation overlay
      if (this.desatAmount > 0.01) {
        ctx.fillStyle = CFG.C_PANEL;
        ctx.globalAlpha = this.desatAmount;
        ctx.fillRect(0, 0, CFG.W, CFG.H);
        ctx.globalAlpha = 1;
      }
    },
  };

  // ── CAMERA ──────────────────────────────────────────────────
  const Camera = {
    x: 0, y: 0,
    targetX: 0, targetY: 0,
    zoom: 1,

    update(dt, px, py, pvx, pvy, pSpeed) {
      // Camera lead: offset target in direction of travel
      const leadAmount = 40;
      const spd = pSpeed || 0;
      const leadFrac = U.clamp(spd / (CFG.MAX_SPEED * 0.8), 0, 1);
      const lvx = pvx || 0, lvy = pvy || 0;
      const lspd = Math.hypot(lvx, lvy) || 1;
      this.targetX = px + (lvx / lspd) * leadAmount * leadFrac;
      this.targetY = py + (lvy / lspd) * leadAmount * leadFrac;

      const speed = 6;
      const t = 1 - Math.exp(-speed * dt);
      this.x = U.lerp(this.x, this.targetX, t);
      this.y = U.lerp(this.y, this.targetY, t);
      // Clamp so viewport stays inside world
      this.x = U.clamp(this.x, CFG.W / 2, CFG.WORLD_W - CFG.W / 2);
      this.y = U.clamp(this.y, CFG.H / 2, CFG.WORLD_H - CFG.H / 2);

      // Dynamic zoom: slight zoom-out at high speed
      const targetZoom = 1 - leadFrac * 0.04; // up to 4% zoom-out
      this.zoom = U.lerp(this.zoom, targetZoom, t);
    },

    isVisible(wx, wy, margin) {
      margin = margin || 0;
      const sx = wx - this.x + CFG.W / 2;
      const sy = wy - this.y + CFG.H / 2;
      return sx >= -margin && sx <= CFG.W + margin && sy >= -margin && sy <= CFG.H + margin;
    },

    reset(px, py) {
      this.x = U.clamp(px, CFG.W / 2, CFG.WORLD_W - CFG.W / 2);
      this.y = U.clamp(py, CFG.H / 2, CFG.WORLD_H - CFG.H / 2);
      this.targetX = this.x;
      this.targetY = this.y;
      this.zoom = 1;
    },
  };

  window.FXCache = FXCache;
  window.PerfMon = PerfMon;
  window.Particles = Particles;
  window.ScreenFX = ScreenFX;
  window.Camera = Camera;
})();
