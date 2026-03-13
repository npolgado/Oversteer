// waves.js — Waves (wave manager, rendering) and ARENA_UPGRADES
(function() {
  'use strict';
  const { CFG, U, S } = window.OversteerLogic;

  // ── WAVE MANAGER ─────────────────────────────────────────────
  const Waves = {
    waveIndex: 0,
    waveTimer: 0,
    phase: 'combat', // 'combat' | 'break'
    spawnTimer: 0,
    burstTimer: 0,
    breakTimer: 0,
    enemies: [],
    scraps: [],
    scrapTimer: 0,
    boostZones: [],
    boostZoneTimer: 0,
    bombZones: [],
    upgradeCards: [],
    upgradeChosen: false,
    cadenceMult: 1,
    hordeTriggered: false,
    hordeSpawnTimer: -1,
    hordeTrigger: 0.85,

    reset() {
      this.waveIndex = 0;
      this.waveTimer = 0;
      this.phase = 'combat';
      this.spawnTimer = CFG.FIRST_SPAWN_INITIAL;
      this.burstTimer = CFG.BURST_INTERVAL;
      this.breakTimer = 0;
      this.enemies = [];
      this.scraps = [];
      this.scrapTimer = CFG.SCRAP_INTERVAL;
      this.boostZones = [];
      this.boostZoneTimer = CFG.BOOST_ZONE_SPAWN_INTERVAL;
      this.bombZones = [];
      this.upgradeCards = [];
      this.upgradeChosen = false;
      this.cadenceMult = 1;
      this._burstQueue = [];
      this.currentFirstSpawn = CFG.FIRST_SPAWN_INITIAL;
      this.currentSpawnInterval = CFG.SPAWN_INTERVAL_INITIAL;
      this.currentCombatDuration = CFG.WAVE_COMBAT;
      this.noBursts = false;
      this.hordeTriggered = false;
      this.hordeSpawnTimer = -1;
      this.hordeTrigger = CFG.HORDE_TRIGGER_MAX;
    },

    startWave(player) {
      this.waveIndex++;
      this.waveTimer = 0;
      this.phase = 'combat';
      this.enemies = [];
      this.upgradeChosen = false;
      this.scraps = [];
      this.scrapTimer = CFG.SCRAP_INTERVAL;
      this.boostZones = [];
      this.boostZoneTimer = CFG.BOOST_ZONE_SPAWN_INTERVAL;
      this.bombZones = [];
      this._burstQueue = [];

      // Wave-specific timing ramp: wave 1 is easiest, fully ramped by wave 5
      const ramp = Math.min(1, (this.waveIndex - 1) / 4);
      this.currentFirstSpawn = U.lerp(CFG.FIRST_SPAWN_INITIAL, CFG.FIRST_SPAWN_MIN, ramp);
      this.currentSpawnInterval = U.lerp(CFG.SPAWN_INTERVAL_INITIAL, CFG.SPAWN_INTERVAL_MIN, ramp);
      this.currentCombatDuration = Math.min(CFG.WAVE_COMBAT_MAX,
        CFG.WAVE_COMBAT_WAVE1 + CFG.WAVE_TIME_GROWTH * (this.waveIndex - 1));
      this.noBursts = this.waveIndex === 1;

      this.spawnTimer = this.currentFirstSpawn;
      this.burstTimer = CFG.BURST_INTERVAL;
      this.hordeTriggered = false;
      this.hordeSpawnTimer = -1;
      this.hordeTrigger = U.randFloat(CFG.HORDE_TRIGGER_MIN, CFG.HORDE_TRIGGER_MAX);
    },

    getEnemyType(score) {
      const pool = ['chaser'];
      if (score >= 1000) pool.push('interceptor');
      if (score >= 1500) pool.push('drifter');
      if (score >= 2000) pool.push('blocker');
      if (score >= 2500) pool.push('flanker');
      if (score >= 3000) pool.push('bomber');
      // Elite: rare spawn from wave 4+
      if (this.waveIndex >= 4 && Math.random() < 0.12) return 'elite';
      return U.randChoice(pool);
    },

    spawnEnemy(score, speedBonus, player) {
      const Enemy = window.Enemy;
      // Spawn at random angle around player, ~550px away (just off-screen)
      const angle = U.randFloat(0, Math.PI * 2);
      const dist = 550;
      let x = player.x + Math.cos(angle) * dist;
      let y = player.y + Math.sin(angle) * dist;
      // Clamp to world
      x = U.clamp(x, 10, CFG.WORLD_W - 10);
      y = U.clamp(y, 10, CFG.WORLD_H - 10);

      const type = this.getEnemyType(score);
      const e = new Enemy(type, x, y);
      e.heading = Math.atan2(player.y - y, player.x - x);
      // Speed scaling at 2000+
      e.maxSpeed += speedBonus;
      e.baseMaxSpeed = e.maxSpeed;
      this.enemies.push(e);
    },

    spawnHorde(score, speedBonus, player) {
      const Enemy = window.Enemy;
      const count = Math.min(CFG.HORDE_MAX_COUNT,
        CFG.HORDE_BASE_COUNT + Math.floor(this.waveIndex * CFG.HORDE_WAVE_GROWTH));
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        let x = player.x + Math.cos(angle) * CFG.HORDE_SPAWN_DIST;
        let y = player.y + Math.sin(angle) * CFG.HORDE_SPAWN_DIST;
        x = U.clamp(x, 50, CFG.WORLD_W - 50);
        y = U.clamp(y, 50, CFG.WORLD_H - 50);

        const type = this.getEnemyType(score);
        const e = new Enemy(type, x, y);
        e.heading = Math.atan2(player.y - y, player.x - x);
        e.maxSpeed += speedBonus;
        e.baseMaxSpeed = e.maxSpeed;
        this.enemies.push(e);
      }
    },

    update(dt, player, score, game) {
      const Audio = window.Audio;
      const ScreenFX = window.ScreenFX;
      const Trail = window.Trail;

      if (this.phase === 'combat') {
        this.waveTimer += dt;

        // Enemy spawning
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnEnemy(score, game.speedBonus, player);
          this.spawnTimer = this.currentSpawnInterval * this.cadenceMult;
        }

        // Burst spawning (disabled wave 1)
        if (!this.noBursts) {
          this.burstTimer -= dt;
          if (this.burstTimer <= 0) {
            // Queue burst spawns using internal timers instead of setTimeout
            for (let i = 0; i < CFG.BURST_COUNT; i++) {
              this._burstQueue.push({ delay: i * CFG.BURST_DELAY, score, speedBonus: game.speedBonus, player });
            }
            this.burstTimer = CFG.BURST_INTERVAL;
          }
        }
        // Process burst queue
        for (let i = this._burstQueue.length - 1; i >= 0; i--) {
          this._burstQueue[i].delay -= dt;
          if (this._burstQueue[i].delay <= 0) {
            const b = this._burstQueue.splice(i, 1)[0];
            if (this.phase === 'combat') this.spawnEnemy(b.score, b.speedBonus, b.player);
          }
        }

        // Horde event at 75% of combat phase (skip wave 1)
        if (!this.hordeTriggered && this.waveIndex >= 1 &&
            this.waveTimer >= this.currentCombatDuration * this.hordeTrigger) {
          this.hordeTriggered = true;
          this.hordeSpawnTimer = CFG.HORDE_DELAY;
          game.hordeAnnounceTimer = CFG.HORDE_DELAY + 0.5;
          Audio.play('horde_warn');
        }
        // Horde spawn countdown
        if (this.hordeSpawnTimer > 0) {
          this.hordeSpawnTimer -= dt;
          if (this.hordeSpawnTimer <= 0) {
            this.spawnHorde(score, game.speedBonus, player);
            ScreenFX.shake(5, 0.3);
          }
        }

        // Wave end
        if (this.waveTimer >= this.currentCombatDuration) {
          this.phase = 'break';
          this.breakTimer = CFG.WAVE_BREAK;
          this.enemies = [];
          this.bombZones = [];
          Trail.clear();
          // Build upgrade offer
          this.upgradeCards = game.buildUpgradeOffer();
          this.upgradeChosen = false;
        }
      } else if (this.phase === 'break') {
        // Selection handled in UPGRADE state
      }

      // Update enemies
      for (const e of this.enemies) {
        e.update(dt, player);
      }
      // Process bomber bomb drops
      for (const e of this.enemies) {
        if (e.type === 'bomber' && e._dropBomb && e.alive) {
          if (this.bombZones.length < CFG.BOMB_ZONE_MAX) {
            this.bombZones.push({ x: e.x, y: e.y, life: CFG.BOMB_ZONE_DURATION, radius: CFG.BOMB_ZONE_RADIUS, phase: 0 });
          }
          e._dropBomb = false;
        }
      }
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        if (!this.enemies[i].alive) {
          this.enemies[i] = this.enemies[this.enemies.length - 1];
          this.enemies.pop();
        }
      }
      // Update bomb zones
      for (let i = this.bombZones.length - 1; i >= 0; i--) {
        const bz = this.bombZones[i];
        bz.life -= dt;
        bz.phase += dt * 3;
        if (bz.life <= 0) {
          this.bombZones[i] = this.bombZones[this.bombZones.length - 1];
          this.bombZones.pop();
        }
      }

      // Scrap spawning
      this.scrapTimer -= dt;
      if (this.scrapTimer <= 0 && this.phase === 'combat') {
        const angle = U.randFloat(0, Math.PI * 2);
        const dist = U.randFloat(220, 340);
        // Pickup type selection
        let pickupType = 'scrap';
        const roll = Math.random();
        if (this.waveIndex >= 5 && roll < 0.04) pickupType = 'bomb'; // very rare, wave 5+
        else if (roll < 0.12) pickupType = 'trail_boost';
        else if (roll < 0.20) pickupType = 'speed_pickup';
        this.scraps.push({
          x: U.clamp(player.x + Math.cos(angle) * dist, 40, CFG.WORLD_W - 40),
          y: U.clamp(player.y + Math.sin(angle) * dist, 40, CFG.WORLD_H - 40),
          life: 15, bobPhase: U.randFloat(0, Math.PI * 2),
          type: pickupType,
        });
        this.scrapTimer = CFG.SCRAP_INTERVAL;
      }

      const events = [];

      // Update scraps
      for (let i = this.scraps.length - 1; i >= 0; i--) {
        const s = this.scraps[i];
        s.life -= dt;
        s.bobPhase += dt * 3;
        // Magnet
        if (player.magnetRange > 0) {
          const d = U.dist(s.x, s.y, player.x, player.y);
          if (d < player.magnetRange) {
            const pull = 200 * dt / Math.max(d, 1);
            s.x += (player.x - s.x) * pull;
            s.y += (player.y - s.y) * pull;
          }
        }
        // Trail magnet: trail points attract scraps
        const Trail = window.Trail;
        if (player.trailMagnet && Trail.count > 0) {
          for (let ti = 0; ti < Trail.count; ti += 5) {
            const tp = Trail.getPoint(ti);
            const tdx = tp.x - s.x, tdy = tp.y - s.y;
            const td = Math.hypot(tdx, tdy);
            if (td < 80 && td > 1) {
              s.x += (tdx / td) * 60 * dt;
              s.y += (tdy / td) * 60 * dt;
              break;
            }
          }
        }
        // Collection
        if (U.dist(s.x, s.y, player.x, player.y) < CFG.SCRAP_RADIUS + player.radius + 10) {
          const pType = s.type || 'scrap';
          this.scraps.splice(i, 1);
          events.push(pType);
          continue;
        }
        if (s.life <= 0) this.scraps.splice(i, 1);
      }

      // Boost zone spawning
      this.boostZoneTimer -= dt;
      if (this.boostZoneTimer <= 0 && this.phase === 'combat') {
        const angle = U.randFloat(0, Math.PI * 2);
        const dist = U.randFloat(200, 400);
        this.boostZones.push({
          x: U.clamp(player.x + Math.cos(angle) * dist, 60, CFG.WORLD_W - 60),
          y: U.clamp(player.y + Math.sin(angle) * dist, 60, CFG.WORLD_H - 60),
          life: 12, phase: 0,
        });
        this.boostZoneTimer = CFG.BOOST_ZONE_SPAWN_INTERVAL;
      }
      // Update boost zones
      for (let i = this.boostZones.length - 1; i >= 0; i--) {
        const bz = this.boostZones[i];
        bz.life -= dt;
        bz.phase += dt * 3;
        if (U.dist(bz.x, bz.y, player.x, player.y) < CFG.BOOST_ZONE_RADIUS + player.radius) {
          this.boostZones.splice(i, 1);
          events.push('boost');
          continue;
        }
        if (bz.life <= 0) this.boostZones.splice(i, 1);
      }

      return events.length ? events : null;
    },

    renderArena(ctx, time) {
      const Camera = window.Camera;
      const Assets = window.Assets;
      const bgImg = Assets._cache[CFG.BACKGROUND_SPRITE];
      const hasBg = bgImg && bgImg._loaded;

      if (hasBg) {
        // Draw only the visible slice of the background (viewport-clipped)
        const invZoom = 1 / Camera.zoom;
        const vx = Math.max(0, Math.floor(Camera.x - (CFG.W / 2) * invZoom));
        const vy = Math.max(0, Math.floor(Camera.y - (CFG.H / 2) * invZoom));
        const vw = Math.min(Math.ceil(CFG.W * invZoom), CFG.WORLD_W - vx);
        const vh = Math.min(Math.ceil(CFG.H * invZoom), CFG.WORLD_H - vy);
        // Map world coords to image coords (scale image to fill world)
        const sx = vx / CFG.WORLD_W * bgImg.naturalWidth;
        const sy = vy / CFG.WORLD_H * bgImg.naturalHeight;
        const sw = vw / CFG.WORLD_W * bgImg.naturalWidth;
        const sh = vh / CFG.WORLD_H * bgImg.naturalHeight;
        ctx.drawImage(bgImg, sx, sy, sw, sh, vx, vy, vw, vh);
      } else {
        // Fallback: dark fill while image loads or if missing
        ctx.fillStyle = CFG.C_BG;
        ctx.fillRect(Camera.x - CFG.W / 2, Camera.y - CFG.H / 2, CFG.W, CFG.H);
      }

      // Abstract effects only when no background image (designed for dark bg)
      if (!hasBg) {
        const vx = Camera.x - CFG.W / 2;
        const vy = Camera.y - CFG.H / 2;

        // Diagonal scanlines tiled relative to camera
        ctx.strokeStyle = CFG.C_BG2;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        const startI = Math.floor((vx - CFG.H) / 20) * 20;
        const endI = vx + CFG.W + CFG.H;
        for (let i = startI; i < endI; i += 20) {
          ctx.beginPath();
          ctx.moveTo(i, vy);
          ctx.lineTo(i + CFG.H, vy + CFG.H);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Faint lane fragments
        ctx.fillStyle = CFG.C_BG2;
        ctx.globalAlpha = 0.15;
        const fragOffset = (time * 15) % 80;
        for (let i = 0; i < 8; i++) {
          const fx = vx + 100 + i * 120;
          const fy = vy + ((fragOffset + i * 60) % (CFG.H + 40)) - 20;
          ctx.fillRect(fx, fy, 30, 3);
        }
        ctx.globalAlpha = 1;

        // Dynamic background: slow-moving geometric shapes
        const waveProgress = Math.min(1, (Waves.waveIndex || 1) / 8);
        const bgR = Math.round(20 + waveProgress * 30);
        const bgG = Math.round(30 + (1 - waveProgress) * 20);
        const bgB = Math.round(50 + (1 - waveProgress) * 30);
        ctx.strokeStyle = `rgb(${bgR},${bgG},${bgB})`;
        ctx.globalAlpha = 0.06;
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
          const gx = vx + ((time * 8 + i * 371) % (CFG.W + 200)) - 100;
          const gy = vy + ((time * 5 + i * 523) % (CFG.H + 200)) - 100;
          const rot = time * 0.1 + i * 1.3;
          ctx.save();
          ctx.translate(gx, gy);
          ctx.rotate(rot);
          if (i % 3 === 0) {
            ctx.beginPath();
            ctx.moveTo(0, -20); ctx.lineTo(17, 10); ctx.lineTo(-17, 10);
            ctx.closePath(); ctx.stroke();
          } else if (i % 3 === 1) {
            ctx.beginPath();
            ctx.moveTo(0, -15); ctx.lineTo(12, 0); ctx.lineTo(0, 15); ctx.lineTo(-12, 0);
            ctx.closePath(); ctx.stroke();
          } else {
            ctx.beginPath();
            for (let j = 0; j < 6; j++) {
              const a = Math.PI / 3 * j;
              const hx = Math.cos(a) * 14, hy = Math.sin(a) * 14;
              if (j === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
            }
            ctx.closePath(); ctx.stroke();
          }
          ctx.restore();
        }
        ctx.globalAlpha = 1;

        // Dust motes (camera-relative)
        ctx.fillStyle = CFG.C_PANEL;
        ctx.globalAlpha = 0.2;
        for (let i = 0; i < 6; i++) {
          const mx = vx + ((time * 20 + i * 173) % CFG.W);
          const my = vy + ((time * 12 + i * 247) % CFG.H);
          ctx.beginPath();
          ctx.arc(mx, my, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // World boundary line — multi-pass glow
      {
        const bx = CFG.ARENA_PAD, by = CFG.ARENA_PAD;
        const bw = CFG.WORLD_W - CFG.ARENA_PAD * 2, bh = CFG.WORLD_H - CFG.ARENA_PAD * 2;
        const pulse = 0.6 + 0.4 * Math.sin(time * 2);
        const passes = [
          { width: 14, alpha: 0.08 * pulse },
          { width: 8,  alpha: 0.15 * pulse },
          { width: 2,  alpha: 0.6 + 0.4 * pulse },
        ];
        for (const p of passes) {
          ctx.strokeStyle = CFG.C_ACCENT;
          ctx.globalAlpha = p.alpha;
          ctx.lineWidth = p.width;
          ctx.strokeRect(bx, by, bw, bh);
        }
        ctx.globalAlpha = 1;
      }

      // Vignette is rendered in screen space (after applyPost)
    },

    renderEnemies(ctx, time) {
      for (const e of this.enemies) e.render(ctx, time);
    },

    renderScraps(ctx) {
      const FXCache = window.FXCache;
      for (const s of this.scraps) {
        const bob = Math.sin(s.bobPhase) * 3;
        const pType = s.type || 'scrap';
        ctx.save();
        ctx.translate(s.x, s.y + bob);

        const colors = {
          scrap: CFG.C_PICKUP,
          speed_pickup: CFG.C_ACCENT,
          trail_boost: CFG.C_RARE,
          bomb: '#FF4444',
        };
        const color = colors[pType] || CFG.C_PICKUP;
        const glow = FXCache.pickupGlow[pType] || FXCache.pickupGlow.scrap;
        if (glow) {
          ctx.globalAlpha = 0.9;
          ctx.drawImage(glow.canvas, -glow.size / 2, -glow.size / 2);
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = color;

        if (pType === 'bomb') {
          // Circle with X
          ctx.beginPath();
          ctx.arc(0, 0, CFG.SCRAP_RADIUS + 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-3, -3); ctx.lineTo(3, 3);
          ctx.moveTo(3, -3); ctx.lineTo(-3, 3);
          ctx.stroke();
        } else if (pType === 'speed_pickup') {
          // Lightning bolt shape
          ctx.beginPath();
          ctx.moveTo(-3, -8); ctx.lineTo(2, -2); ctx.lineTo(-1, -2);
          ctx.lineTo(3, 8); ctx.lineTo(-2, 2); ctx.lineTo(1, 2);
          ctx.closePath();
          ctx.fill();
        } else if (pType === 'trail_boost') {
          // Diamond
          ctx.beginPath();
          ctx.moveTo(0, -8); ctx.lineTo(6, 0); ctx.lineTo(0, 8); ctx.lineTo(-6, 0);
          ctx.closePath();
          ctx.fill();
        } else {
          // Default hex shape
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = Math.PI / 3 * i - Math.PI / 6;
            const px = Math.cos(a) * CFG.SCRAP_RADIUS;
            const py = Math.sin(a) * CFG.SCRAP_RADIUS;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
    },

    renderBoostZones(ctx) {
      const FXCache = window.FXCache;
      for (const bz of this.boostZones) {
        ctx.save();
        ctx.translate(bz.x, bz.y);
        const pulse = 0.6 + 0.3 * Math.sin(bz.phase);
        ctx.globalAlpha = pulse * Math.min(1, bz.life / 2);
        const glow = FXCache.boostGlow;
        if (glow) {
          ctx.drawImage(glow.canvas, -glow.size / 2, -glow.size / 2);
        }
        ctx.fillStyle = CFG.C_ACCENT;
        ctx.beginPath();
        ctx.arc(0, 0, CFG.BOOST_ZONE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        // Inner chevron
        ctx.fillStyle = '#fff';
        ctx.globalAlpha *= 0.7;
        ctx.beginPath();
        ctx.moveTo(-6, 5); ctx.lineTo(0, -7); ctx.lineTo(6, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    },

    renderBombZones(ctx) {
      for (const bz of this.bombZones) {
        ctx.save();
        ctx.translate(bz.x, bz.y);
        const pulse = 0.3 + 0.15 * Math.sin(bz.phase);
        const fadeAlpha = Math.min(1, bz.life / 1.5);
        ctx.globalAlpha = pulse * fadeAlpha;
        ctx.fillStyle = '#CC2200';
        ctx.beginPath();
        ctx.arc(0, 0, bz.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FF4400';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Inner hazard core
        ctx.globalAlpha *= 0.5;
        ctx.fillStyle = '#FF6600';
        ctx.beginPath();
        ctx.arc(0, 0, bz.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },
  };

  // ── UPGRADES ─────────────────────────────────────────────────
  const ARENA_UPGRADES = [
    { id: 'turbo', name: 'Turbo Engine', desc: '+15% top speed', icon: 'T',
      apply(p) { p.maxSpeed *= 1.15; } },
    { id: 'tight_turns', name: 'Tight Turns', desc: '+25% turn rate', icon: 'R',
      apply(p) { p.tightTurns = true; } },
    { id: 'drift_king', name: 'Drift King', desc: 'Drift boost +50%, drift friction reduced', icon: 'D',
      apply(p) { p.driftKing = true; } },
    { id: 'shield', name: 'Crash Shield', desc: 'Absorbs one collision', icon: 'S',
      apply(p) { p.shield = true; } },
    { id: 'magnet', name: 'Magnetic Field', desc: 'Auto-collect scraps at range', icon: 'M',
      apply(p) { p.magnetRange = 150; } },
    { id: 'score_freak', name: 'Score Freak', desc: 'Score multiplier x1.5', icon: 'X',
      apply(p) { p.scoreMult *= 1.5; } },
    { id: 'ghost_frame', name: 'Ghost Frame', desc: '0.3s invuln after near-miss', icon: 'G',
      apply(p) { /* handled in game logic */ } },
    { id: 'thick_plating', name: 'Thick Plating', desc: 'Collision radius -3px', icon: 'P',
      apply(p) { /* applied via radius check */ } },
    { id: 'afterburner', name: 'Afterburner', desc: 'Drift boost doubled', icon: 'A',
      apply(p) { p.afterburner = true; } },
    { id: 'combo_master', name: 'Combo Master', desc: 'Combo decays 50% slower', icon: 'C',
      apply(p) { p.comboMaster = true; } },
    { id: 'speed_demon', name: 'Speed Demon', desc: '+20% speed, enemies +10% speed', icon: '!',
      apply(p) { p.speedDemon = true; p.maxSpeed *= 1.20; } },
    { id: 'wider_trail', name: 'Wider Trail', desc: 'Loop detection radius +50%', icon: 'W',
      apply(p) { window.Trail.CLOSE_DIST = 60; } },
    { id: 'trail_echo', name: 'Trail Echo', desc: 'Trail lasts 50% longer', icon: 'E',
      apply(p) { window.Trail.MAX_POINTS = 600; } },
    { id: 'encircle_bonus', name: 'Encircle Bonus', desc: '+50% score from encirclement', icon: 'B',
      apply(p) { p.encircleScoreBonus = (p.encircleScoreBonus || 1) * 1.5; } },
    { id: 'hp_regen', name: 'Auto Repair', desc: 'Regenerate 3 HP/sec after 2s', icon: '+',
      apply(p) { p.hpRegen += 3; } },
    { id: 'max_hp', name: 'Reinforced Frame', desc: '+30 max HP (heals +30)', icon: 'H',
      apply(p) { p.maxHp += 30; p.hp += 30; } },
    { id: 'damage_resist', name: 'Armor Plating', desc: 'Take 25% less damage', icon: 'V',
      apply(p) { p.damageResist = 1 - (1 - p.damageResist) * 0.75; } },
    { id: 'drift_shield', name: 'Drift Shield', desc: '-40% damage while drifting', icon: 'DS',
      apply(p) { p.driftShield = true; } },
    { id: 'combo_heal', name: 'Combo Medic', desc: 'Heal at combo milestones 3/5/8', icon: 'CH',
      apply(p) { p.comboHeal = true; } },
    { id: 'trail_magnet', name: 'Trail Magnet', desc: 'Trail points attract scraps', icon: 'TM',
      apply(p) { p.trailMagnet = true; } },
    { id: 'speed_trail', name: 'Speed Trail', desc: 'Trail grows with speed', icon: 'ST',
      apply(p) { p.speedTrail = true; } },
    // v1.1 upgrades
    { id: 'dash_burst', name: 'Dash Burst', desc: 'Tap brake at speed for invuln dash (3s cd)', icon: 'DB',
      apply(p) { p.dashBurst = true; } },
    { id: 'trail_burn', name: 'Trail Burn', desc: 'Trail damages enemies that touch it', icon: 'TB',
      apply(p) { p.trailBurn = true; } },
    { id: 'chain_lightning', name: 'Chain Lightning', desc: 'Loop kills chain to 1 nearby enemy', icon: 'CL',
      apply(p) { p.chainLightning = true; } },
    { id: 'extra_rerolls', name: 'Lucky Dice', desc: '+2 rerolls per break', icon: 'LR',
      apply(p) { /* handled in reroll logic */ } },
    { id: 'nitro_drift', name: 'Nitro Drift', desc: '+30% speed while drifting', icon: 'ND',
      apply(p) { p.nitroDrift = true; } },
  ];

  window.Waves = Waves;
  window.ARENA_UPGRADES = ARENA_UPGRADES;
})();
