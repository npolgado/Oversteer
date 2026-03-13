// world.js — Props (prop system) and Trail (encirclement)
(function() {
  'use strict';
  const { CFG, U, S } = window.OversteerLogic;

  // ── PROPS SYSTEM ─────────────────────────────────────────────
  const Props = {
    chunks: {},   // key: 'cx,cy' -> array of prop objects
    allProps: [], // flat list for collision checks
    weightedPool: [],

    _seededRandom(seed) {
      // mulberry32
      return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    },

    reset() {
      this.chunks = {};
      this.allProps = [];
      // Build weighted pool
      this.weightedPool = [];
      for (const p of CFG.PROP_POOL) {
        for (let i = 0; i < p.weight; i++) this.weightedPool.push(p);
      }
    },

    generate() {
      const cs = CFG.PROP_CHUNK_SIZE;
      const chunksX = Math.ceil(CFG.WORLD_W / cs);
      const chunksY = Math.ceil(CFG.WORLD_H / cs);
      const centerX = CFG.WORLD_W / 2, centerY = CFG.WORLD_H / 2;

      for (let cx = 0; cx < chunksX; cx++) {
        for (let cy = 0; cy < chunksY; cy++) {
          this._generateChunk(cx, cy, centerX, centerY);
        }
      }
    },

    _generateChunk(cx, cy, centerX, centerY) {
      const cs = CFG.PROP_CHUNK_SIZE;
      const seed = cx * 7919 + cy * 104729;
      const rng = this._seededRandom(seed);
      const area = cs * cs;
      const count = Math.floor(area * CFG.PROP_DENSITY);
      const key = cx + ',' + cy;
      const props = [];

      for (let i = 0; i < count; i++) {
        const x = cx * cs + rng() * cs;
        const y = cy * cs + rng() * cs;

        // Skip props too close to center spawn
        const dx = x - centerX, dy = y - centerY;
        if (dx * dx + dy * dy < CFG.PROP_MIN_DIST * CFG.PROP_MIN_DIST) continue;

        // Skip props outside world bounds (with padding)
        if (x < 40 || x > CFG.WORLD_W - 40 || y < 40 || y > CFG.WORLD_H - 40) continue;

        const template = this.weightedPool[Math.floor(rng() * this.weightedPool.length)];
        const prop = {
          x, y,
          radius: template.radius,
          type: template.type,
          image: template.image,
          duration: template.duration || 0,
          strength: template.strength || 0,
          alive: true,
        };
        props.push(prop);
        this.allProps.push(prop);
      }
      this.chunks[key] = props;
    },

    checkPlayerCollision(player) {
      const hits = [];
      const pr = player.radius;
      const cs = CFG.PROP_CHUNK_SIZE;
      const cx = Math.floor(player.x / cs);
      const cy = Math.floor(player.y / cs);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const key = (cx + ox) + ',' + (cy + oy);
          const chunk = this.chunks[key];
          if (!chunk) continue;
          for (const prop of chunk) {
            if (!prop.alive || prop.type === 'decoration') continue;
            const dx = player.x - prop.x, dy = player.y - prop.y;
            const dist = dx * dx + dy * dy;
            const minDist = pr + prop.radius;
            if (dist < minDist * minDist) {
              hits.push(prop);
            }
          }
        }
      }
      return hits;
    },

    handleCollisions(player, hits) {
      const Particles = window.Particles;
      for (const prop of hits) {
        if (prop.type === 'solid') {
          // Push player out and bounce
          const dx = player.x - prop.x, dy = player.y - prop.y;
          const dist = Math.hypot(dx, dy) || 1;
          const overlap = player.radius + prop.radius - dist;
          const nx = dx / dist, ny = dy / dist;
          player.x += nx * overlap;
          player.y += ny * overlap;
          // Reflect velocity
          const dot = player.vx * nx + player.vy * ny;
          if (dot < 0) {
            player.vx -= dot * nx;
            player.vy -= dot * ny;
            player.vx *= 0.3;
            player.vy *= 0.3;
          }
          // Spark FX
          Particles.spawn(prop.x + nx * prop.radius, prop.y + ny * prop.radius, CFG.C_PICKUP, 4, {
            vxMin: -60, vxMax: 60, vyMin: -60, vyMax: 60,
            lifeMin: 0.15, lifeMax: 0.3, sizeMin: 2, sizeMax: 4, type: 'spark',
          });
        } else if (prop.type === 'slow') {
          player.slowTimer = prop.duration;
          player.slowStrength = prop.strength;
        } else if (prop.type === 'slip') {
          player.slipTimer = prop.duration;
          player.slipStrength = prop.strength;
        }
      }
    },

    checkNearMiss(player, game) {
      if (!player.drifting) return;
      const pr = player.radius;
      for (const prop of this.allProps) {
        if (!prop.alive || prop.type !== 'solid') continue;
        if ((prop.nearMissCooldown || 0) > 0) continue;
        const dx = player.x - prop.x, dy = player.y - prop.y;
        const dist2 = dx * dx + dy * dy;
        const collDist = pr + prop.radius;
        const nearDist = collDist + CFG.NEAR_MISS_HAZARD;
        if (dist2 > collDist * collDist && dist2 < nearDist * nearDist) {
          game.nearMiss(prop, 'hazard');
          prop.nearMissCooldown = CFG.NEAR_MISS_COOLDOWN;
        }
      }
    },

    updatePropCooldowns(dt) {
      for (const prop of this.allProps) {
        if (prop.nearMissCooldown > 0) prop.nearMissCooldown -= dt;
      }
    },

    checkEnemyCollision(enemies) {
      for (const e of enemies) {
        if (!e.alive) continue;
        const er = e.radius || CFG.ENEMY_RADIUS;
        for (const prop of this.allProps) {
          if (!prop.alive || prop.type !== 'solid') continue;
          const dx = e.x - prop.x, dy = e.y - prop.y;
          const dist2 = dx * dx + dy * dy;
          const minDist = er + prop.radius;
          if (dist2 < minDist * minDist) {
            const dist = Math.sqrt(dist2) || 1;
            const overlap = minDist - dist;
            const nx = dx / dist, ny = dy / dist;
            e.x += nx * overlap;
            e.y += ny * overlap;
            const dot = e.vx * nx + e.vy * ny;
            if (dot < 0) {
              e.vx -= dot * nx;
              e.vy -= dot * ny;
              e.vx *= 0.4;
              e.vy *= 0.4;
            }
          }
        }
      }
    },

    render(ctx) {
      const Camera = window.Camera;
      const FXCache = window.FXCache;
      const Assets = window.Assets;
      for (const prop of this.allProps) {
        if (!prop.alive) continue;
        if (!Camera.isVisible(prop.x, prop.y, prop.radius * 2 + 10)) continue;

        // Glow highlight behind prop (pre-rendered)
        const glowKey = prop.radius + '_' + prop.type;
        const glowData = FXCache.propGlow[glowKey];
        if (glowData) {
          const half = glowData.size / 2;
          ctx.drawImage(glowData.canvas, prop.x - half, prop.y - half);
        }

        const drawn = Assets.drawOrFallback(ctx, prop.image, prop.x, prop.y, prop.radius * 2, prop.radius * 2, () => {
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, prop.radius, 0, Math.PI * 2);

          if (prop.type === 'solid') {
            ctx.fillStyle = '#1A3322';
            ctx.fill();
            ctx.strokeStyle = '#0F2218';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          } else if (prop.type === 'slow') {
            ctx.fillStyle = '#3D2810';
            ctx.fill();
            ctx.strokeStyle = '#2A1A08';
            ctx.lineWidth = 1;
            ctx.stroke();
          } else if (prop.type === 'slip') {
            ctx.fillStyle = 'rgba(30,60,100,0.5)';
            ctx.fill();
          } else {
            // decoration
            ctx.fillStyle = 'rgba(26,58,26,0.4)';
            ctx.fill();
          }
        });
      }
    },
  };

  // ── TRAIL (Encirclement) ─────────────────────────────────────
  const Trail = {
    points: [],        // ring buffer of {x, y}
    MAX_POINTS: 400,
    head: 0,
    count: 0,
    recordTimer: 0,
    RECORD_INTERVAL: 0.05,
    checkTimer: 0,
    CHECK_INTERVAL: 0.15,
    CLOSE_DIST: 40,
    SKIP_RECENT: 20,

    clear() {
      this.points = [];
      this.head = 0;
      this.count = 0;
      this.recordTimer = 0;
      this.checkTimer = 0;
      this._flashPoly = null;
      this._flashPolyTimer = 0;
    },

    reset() {
      this.clear();
      this.MAX_POINTS = 400;
      this._baseMaxPoints = 0;
      this.CLOSE_DIST = 40;
    },

    push(x, y, speed) {
      if (this.count < this.MAX_POINTS) {
        this.points.push({ x, y, speed: speed || 0 });
        this.count++;
      } else {
        this.points[this.head] = { x, y, speed: speed || 0 };
      }
      this.head = (this.head + 1) % this.MAX_POINTS;
    },

    getPoint(i) {
      // i=0 is oldest, i=count-1 is newest
      if (this.count < this.MAX_POINTS) return this.points[i];
      return this.points[(this.head + i) % this.MAX_POINTS];
    },

    update(dt, player) {
      this._lastDt = dt;
      this._lastPlayerX = player.x;
      this._lastPlayerY = player.y;
      // Trail color matches drift particle combo colors
      const comboInt = Math.floor(player.comboLevel || 0);
      if (comboInt >= 5) {
        // Purple (CFG.C_RARE #7C5CFF)
        this._trailR = 124; this._trailG = 92; this._trailB = 255;
      } else if (comboInt >= 3) {
        // Cyan (CFG.C_ACCENT #35F2D0)
        this._trailR = 53; this._trailG = 242; this._trailB = 208;
      } else {
        // Default cyan
        this._trailR = 53; this._trailG = 242; this._trailB = 208;
      }
      // Speed trail: dynamically grow trail capacity with speed
      if (player.speedTrail) {
        const baseMax = this._baseMaxPoints || this.MAX_POINTS;
        if (!this._baseMaxPoints) this._baseMaxPoints = this.MAX_POINTS;
        this.MAX_POINTS = baseMax + Math.floor(player.speed / 100);
      }
      this.recordTimer -= dt;
      if (this.recordTimer <= 0) {
        this.push(player.x, player.y, player.speed || 0);
        this.recordTimer = this.RECORD_INTERVAL;
      }
      // Flash polygon timer
      if (this._flashPolyTimer > 0) this._flashPolyTimer -= dt;
    },

    checkLoop(player, enemies, game) {
      const Particles = window.Particles;
      const ScreenFX = window.ScreenFX;
      const Audio = window.Audio;
      const enemyDeathFX = window.enemyDeathFX;

      this.checkTimer -= this._lastDt || 0;
      if (this.checkTimer > 0) return;
      this.checkTimer = this.CHECK_INTERVAL;

      if (this.count < this.SKIP_RECENT + 5) return;

      const px = player.x, py = player.y;
      const searchEnd = this.count - this.SKIP_RECENT;

      for (let i = 0; i < searchEnd; i++) {
        const pt = this.getPoint(i);
        const d = Math.hypot(px - pt.x, py - pt.y);
        if (d < this.CLOSE_DIST) {
          // Found a loop: extract polygon from point i to current position
          const poly = [];
          for (let j = i; j < this.count; j++) {
            const p = this.getPoint(j);
            poly.push(p);
          }
          poly.push({ x: px, y: py });

          if (poly.length < 10) continue; // too small

          // Check which enemies are inside
          // Compute loop centroid for shockwave
          let cxSum = 0, cySum = 0;
          for (const p of poly) { cxSum += p.x; cySum += p.y; }
          const loopCX = cxSum / poly.length, loopCY = cySum / poly.length;

          let killCount = 0;
          for (const e of enemies) {
            if (!e.alive) continue;
            if (this._pointInPoly(e.x, e.y, poly)) {
              // Elite enemies: strip armor first, then kill
              if (e.health > 1) {
                e.health--;
                e.armored = false;
                // Armor strip FX
                Particles.spawn(e.x, e.y, CFG.C_RARE, 10, {
                  vxMin: -150, vxMax: 150, vyMin: -150, vyMax: 150,
                  lifeMin: 0.3, lifeMax: 0.6, sizeMin: 3, sizeMax: 6, type: 'shard',
                });
                Particles.addRing(e.x, e.y, CFG.C_RARE);
                Particles.addFloat(e.x, e.y - 25, 'ARMOR BROKEN!', CFG.C_RARE, 16);
                ScreenFX.shake(4, 0.15);
                continue;
              }
              e.alive = false;
              const isElite = e.type === 'elite';
              killCount += isElite ? 3 : 1; // Elite worth 3x
              // Type-specific death FX
              enemyDeathFX(e.type, e.x, e.y, isElite);
              if (isElite) Particles.addRing(e.x, e.y, CFG.C_RARE); // Extra ring for elite
            }
          }

          if (killCount > 0) {
            Audio.play('encircle');
            const comboMult = Math.max(1, Math.floor(player.comboLevel + 1));
            const baseScore = 100 * killCount;
            const bonus = killCount >= 2 ? 50 * killCount : 0;
            const encircleBonus = player.encircleScoreBonus || 1;
            const total = Math.floor((baseScore + bonus) * comboMult * encircleBonus);
            game.score += total * player.scoreMult;
            // Award combo levels for encirclement
            player.comboLevel = Math.min(CFG.MAX_COMBO, player.comboLevel + 2 * killCount);
            game.peakCombo = Math.max(game.peakCombo, Math.floor(player.comboLevel));
            game.encircleCount += killCount;
            game.enemiesKilled += killCount;
            const label = killCount >= 2 ? `ENCIRCLE x${killCount}! +${total}` : `ENCIRCLE! +${total}`;
            Particles.addFloat(px, py - 40, label, CFG.C_ACCENT, 18);
            // Flash the enclosed polygon briefly
            this._flashPoly = poly.slice();
            this._flashPolyTimer = 0.3;
            // Shockwave ring from loop centroid
            Particles.rings.push({ x: loopCX, y: loopCY, color: CFG.C_ACCENT, radius: 0, maxRadius: 150, life: 0.5 });
            ScreenFX.flash(CFG.C_ACCENT, 0.15, 0.12);
            ScreenFX.shake(5, 0.2);

            // Chain Lightning: damage 1 nearby enemy per kill
            if (player.chainLightning && killCount > 0) {
              const killed = enemies.filter(e => !e.alive);
              for (const dead of killed) {
                let closest = null, closestDist = 200;
                for (const e2 of enemies) {
                  if (!e2.alive) continue;
                  const d2 = U.dist(dead.x, dead.y, e2.x, e2.y);
                  if (d2 < closestDist) { closestDist = d2; closest = e2; }
                }
                if (closest) {
                  closest.health--;
                  if (closest.health <= 0) {
                    closest.alive = false;
                    enemyDeathFX(closest.type, closest.x, closest.y, false);
                    game.enemiesKilled++;
                    game.score += 50 * player.scoreMult;
                  } else {
                    closest.armored = false;
                  }
                  // Lightning particle line
                  Particles.spawn((dead.x + closest.x) / 2, (dead.y + closest.y) / 2, '#88CCFF', 6, {
                    vxMin: -60, vxMax: 60, vyMin: -60, vyMax: 60,
                    lifeMin: 0.1, lifeMax: 0.3, sizeMin: 2, sizeMax: 4, type: 'spark',
                  });
                }
              }
            }

            // Clear trail after successful encirclement
            this.clear();
            return;
          }
          break; // only check first matching loop
        }
      }
    },

    _pointInPoly(x, y, poly) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
          inside = !inside;
        }
      }
      return inside;
    },

    render(ctx) {
      if (this.count < 2) return;

      // Check if loop is about to close (for glow pulse)
      let nearLoop = false;
      if (this.count > this.SKIP_RECENT + 5 && this._lastPlayerX !== undefined) {
        const searchEnd = this.count - this.SKIP_RECENT;
        for (let i = 0; i < searchEnd; i++) {
          const pt = this.getPoint(i);
          if (Math.hypot(this._lastPlayerX - pt.x, this._lastPlayerY - pt.y) < 80) {
            nearLoop = true; break;
          }
        }
      }

      ctx.save();
      ctx.lineCap = 'round';
      const trailW = nearLoop ? 5 : 4;
      const tr = this._trailR || 53, tg = this._trailG || 242, tb = this._trailB || 208;
      const start = this.getPoint(0);
      const end = this.getPoint(this.count - 1);
      const loopMult = nearLoop ? 1.4 : 1;

      // Glow underlay: thicker, semi-transparent pass (no shadowBlur)
      ctx.lineWidth = trailW + (nearLoop ? 10 : 7);
      const glowGrad = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
      const glowStart = Math.min(1, 0.02 * loopMult);
      const glowEnd = Math.min(1, 0.10 * loopMult);
      glowGrad.addColorStop(0, `rgba(${tr},${tg},${tb},${glowStart})`);
      glowGrad.addColorStop(1, `rgba(${tr},${tg},${tb},${glowEnd})`);
      ctx.strokeStyle = glowGrad;
      ctx.beginPath();
      for (let i = 0; i < this.count; i++) {
        const p = this.getPoint(i);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      // Sharp trail on top (width varies with speed)
      const alphaBoost = nearLoop ? 0.15 : 0;
      const mainStartAlpha = Math.min(1, 0.08 + alphaBoost);
      const mainEndAlpha = Math.min(1, 0.38 + alphaBoost);
      const mainStartR = Math.round(tr * 0.4);
      const mainStartG = Math.round(tg * 0.4);
      const mainStartB = Math.round(tb * 0.55);
      const maxSpd = CFG.MAX_SPEED || 500;
      for (let i = 1; i < this.count; i++) {
        const p0 = this.getPoint(i - 1), p1 = this.getPoint(i);
        const frac = i / (this.count - 1);
        const a = mainStartAlpha + (mainEndAlpha - mainStartAlpha) * frac;
        const cr = Math.round(mainStartR + (tr - mainStartR) * frac);
        const cg = Math.round(mainStartG + (tg - mainStartG) * frac);
        const cb = Math.round(mainStartB + (tb - mainStartB) * frac);
        const speedFrac = Math.min(1, (p1.speed || 0) / maxSpd);
        ctx.lineWidth = trailW + 3 * speedFrac;
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${a})`;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      ctx.restore();

      // Flash polygon from encirclement kill
      if (this._flashPoly && this._flashPolyTimer > 0) {
        ctx.save();
        ctx.globalAlpha = (this._flashPolyTimer / 0.3) * 0.25;
        ctx.fillStyle = `rgb(${this._trailR||53},${this._trailG||242},${this._trailB||208})`;
        ctx.beginPath();
        ctx.moveTo(this._flashPoly[0].x, this._flashPoly[0].y);
        for (let i = 1; i < this._flashPoly.length; i++) {
          ctx.lineTo(this._flashPoly[i].x, this._flashPoly[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Loop-closing preview: dashed line when near an older trail point
      if (this.count > this.SKIP_RECENT + 5) {
        const px = this._lastPlayerX, py = this._lastPlayerY;
        if (px !== undefined) {
          const previewDist = 80;
          const searchEnd = this.count - this.SKIP_RECENT;
          for (let i = 0; i < searchEnd; i++) {
            const pt = this.getPoint(i);
            const d = Math.hypot(px - pt.x, py - pt.y);
            if (d < previewDist) {
              const closeness = 1 - d / previewDist; // 1=very close, 0=at edge
              ctx.save();
              ctx.strokeStyle = `rgb(${this._trailR||53},${this._trailG||242},${this._trailB||208})`;
              ctx.globalAlpha = 0.3 + closeness * 0.4;
              ctx.lineWidth = 2;
              ctx.setLineDash([6, 4]);
              ctx.beginPath();
              ctx.moveTo(px, py);
              ctx.lineTo(pt.x, pt.y);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.restore();
              break;
            }
          }
        }
      }
    },
  };

  window.Props = Props;
  window.Trail = Trail;
})();
