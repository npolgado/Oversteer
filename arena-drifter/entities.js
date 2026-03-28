// entities.js — Player, Enemy, enemyDeathFX
(function() {
  'use strict';
  const { CFG, U, S } = window.OversteerLogic;

  // ── PLAYER ───────────────────────────────────────────────────
  class Player {
    constructor() { this.reset(); }

    reset() {
      this.x = CFG.WORLD_W / 2;
      this.y = CFG.WORLD_H / 2;
      this.vx = 0; this.vy = 0;
      this.heading = -Math.PI / 2; // facing up
      this.drifting = false;
      this.driftJustStarted = false;
      this.maxSpeed = CFG.MAX_SPEED;
      this.turnRate = CFG.TURN_RATE;
      this.hp = CFG.PLAYER_HP;
      this.maxHp = CFG.PLAYER_HP_MAX;
      this.hpRegen = CFG.HP_REGEN;
      this.lastHitTimer = 99;
      this.shield = false;
      this.invulnTimer = 0;
      this.slipTimer = 0;
      this.slowTimer = 0;
      this.slowStrength = 1;
      this.wallHit = false;
      this.upgrades = [];
      this.comboLevel = 0;
      this.driftTime = 0;
      this.leanTimer = 0;
      this.leanDir = 0;
      this.exhaustTimer = 0;
      this.braking = false;
      this.glowPhase = 0;
      this.driftDeniedTimer = 0;
      // Upgrade flags
      this.tightTurns = false;
      this.driftKing = false;
      this.magnetRange = 0;
      this.scoreMult = 1;
      this.ghostFrameTimer = 0;
      this.thickPlating = false;
      this.afterburner = false;
      this.comboMaster = false;
      this.speedDemon = false;
      this.encircleScoreBonus = 1;
      this.damageResist = 0;
      this.driftShield = false;
      this.comboHeal = false;
      this.trailMagnet = false;
      this.speedTrail = false;
      // v1.1 upgrade flags
      this.dashBurst = false;
      this.dashCooldown = 0;
      this.trailBurn = false;
      this.chainLightning = false;
      this.nitroDrift = false;
      // Handbrake
      this.handbrakeTimer = 0;
      // Speed boost
      this.speedBoostTimer = 0;
      // Drift chaining
      this.lastDriftEndTime = 0;
      this.driftChain = 0;
      // Wall riding
      this.wallRiding = false;
      // Near-miss streak
      this.consecutiveNearMisses = 0;
      this.nearMissStreakTimer = 0;
      this.frozen = false;
    }

    get speed() { return Math.hypot(this.vx, this.vy); }
    get radius() { return CFG.PLAYER_RADIUS - (this.drifting ? CFG.PLAYER_DRIFT_SHRINK : 0); }

    update(dt) {
      const Particles = window.Particles;
      const Audio = window.Audio;
      const Input = window.Input;
      const updatePhysics = window.updatePhysics;

      this.glowPhase += dt;
      if (this.frozen) return;
      // Turn input
      let turnInput = 0;
      if (Input.left) turnInput -= 1;
      if (Input.right) turnInput += 1;

      // Lean FX
      if (turnInput !== 0) { this.leanTimer = 0.08; this.leanDir = turnInput; }
      if (this.leanTimer > 0) this.leanTimer -= dt;

      // Exhaust FX
      if (Input.up) this.exhaustTimer = 0.06;
      if (this.exhaustTimer > 0) this.exhaustTimer -= dt;

      this.braking = Input.down;

      // Handbrake turn: reverse while moving forward fast
      if (Input.down && this.speed > CFG.DRIFT_THRESHOLD && !this.drifting) {
        const fwd = U.vec2FromAngle(this.heading);
        const dot = this.vx * fwd.x + this.vy * fwd.y;
        if (dot > 30 && this.handbrakeTimer <= 0) {
          this.handbrakeTimer = CFG.HANDBRAKE_DURATION;
        }
      }
      if (this.handbrakeTimer > 0) this.handbrakeTimer -= dt;

      // Speed boost timer
      if (this.speedBoostTimer > 0) this.speedBoostTimer -= dt;

      // Near-miss streak timer
      if (this.nearMissStreakTimer > 0) {
        this.nearMissStreakTimer -= dt;
        if (this.nearMissStreakTimer <= 0) this.consecutiveNearMisses = 0;
      }

      // HP regen (only if has regen, and after delay since last hit)
      this.lastHitTimer += dt;
      if (this.hpRegen > 0 && this.lastHitTimer > CFG.HP_REGEN_DELAY) {
        this.hp = Math.min(this.hp + this.hpRegen * dt, this.maxHp);
      }

      // Drift denied FX
      if (Input.drift && this.speed < CFG.DRIFT_THRESHOLD && !this.drifting) {
        this.driftDeniedTimer = 0.12;
      }
      if (this.driftDeniedTimer > 0) this.driftDeniedTimer -= dt;

      // Tight turns upgrade
      const origTurn = this.turnRate;
      const origMaxSpeed = this.maxSpeed;
      if (this.tightTurns) this.turnRate = CFG.TURN_RATE * 1.25;
      // Handbrake: boosted turn rate
      if (this.handbrakeTimer > 0) this.turnRate *= CFG.HANDBRAKE_TURN_MULT;
      // Speed boost zone: temporary max speed increase
      if (this.speedBoostTimer > 0) this.maxSpeed *= CFG.BOOST_ZONE_MULT;
      // Nitro Drift: +30% speed while drifting
      if (this.nitroDrift && this.drifting) this.maxSpeed *= 1.3;
      // Dash Burst cooldown
      if (this.dashCooldown > 0) this.dashCooldown -= dt;
      // Dash Burst activation: tap brake at high speed
      if (this.dashBurst && Input.down && this.speed > 300 && this.dashCooldown <= 0 && !this.drifting) {
        this.dashCooldown = 3.0;
        this.invulnTimer = 0.2;
        this.maxSpeed *= 1.3;
        Particles.spawn(this.x, this.y, CFG.C_ACCENT, 8, {
          vxMin: -150, vxMax: 150, vyMin: -150, vyMax: 150,
          lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 5, type: 'spark',
        });
      }

      this.wallHit = false;
      this.driftJustStarted = false;
      updatePhysics(this, dt, turnInput, Input.up, Input.down, Input.drift, true);

      // Audio: engine pitch follows speed
      Audio.setEngineSpeed(this.speed / this.maxSpeed);

      this.turnRate = origTurn;
      this.maxSpeed = origMaxSpeed;

      // Handbrake deceleration
      if (this.handbrakeTimer > 0) {
        const spd = Math.hypot(this.vx, this.vy);
        if (spd > 10) {
          const decel = Math.min(CFG.HANDBRAKE_DECEL * dt, spd * 0.5);
          const s = (spd - decel) / spd;
          this.vx *= s;
          this.vy *= s;
        }
      }

      // Wall riding detection
      const pad = CFG.ARENA_PAD;
      const wd = CFG.WALL_RIDE_DIST;
      this.wallRiding = this.drifting && (
        this.x < pad + wd || this.x > CFG.WORLD_W - pad - wd ||
        this.y < pad + wd || this.y > CFG.WORLD_H - pad - wd
      );
      if (this.wallRiding) {
        // Speed bonus while wall riding
        const fwd = U.vec2FromAngle(this.heading);
        const boost = CFG.WALL_RIDE_SPEED_BONUS * (this.maxSpeed || CFG.MAX_SPEED) * dt;
        this.vx += fwd.x * boost;
        this.vy += fwd.y * boost;
        // Wall-riding sparks along nearest wall
        if (Math.random() < 0.5) {
          const sx = this.x < pad + wd ? pad : this.x > CFG.WORLD_W - pad - wd ? CFG.WORLD_W - pad : this.x;
          const sy = this.y < pad + wd ? pad : this.y > CFG.WORLD_H - pad - wd ? CFG.WORLD_H - pad : this.y;
          Particles.spawn(sx, sy, CFG.C_ACCENT, U.randInt(1, 2), {
            vxMin: -80, vxMax: 80, vyMin: -80, vyMax: 80,
            lifeMin: 0.1, lifeMax: 0.25, sizeMin: 2, sizeMax: 4, type: 'spark',
          });
        }
      }

      // Drift time tracking + drift chaining
      const wasDrifting = this.driftTime > 0;
      if (this.drifting) {
        this.driftTime += dt;
      } else {
        if (wasDrifting && this.driftTime > 0) {
          // Just stopped drifting — record end time for chain detection
          this.lastDriftEndTime = this.driftTime > 0.1 ? performance.now() / 1000 : 0;
        }
        this.driftTime = 0;
        const comboDecay = this.comboMaster ? 1.0 : 2.0;
        this.comboLevel = Math.max(0, this.comboLevel - dt * comboDecay);
      }

      // Audio: drift squeal intensity
      Audio.setDriftIntensity(this.drifting ? Math.min(1, this.speed / this.maxSpeed) : 0);

      // Invulnerability
      if (this.invulnTimer > 0) this.invulnTimer -= dt;
      if (this.ghostFrameTimer > 0) this.ghostFrameTimer -= dt;
      if (this.slowTimer > 0) this.slowTimer -= dt;
    }

    render(ctx) {
      const Assets = window.Assets;
      const speed = this.speed;
      const drifting = this.drifting;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.heading);

      // Invulnerability blink
      if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 10) % 2 === 0) {
        ctx.globalAlpha = 0.4;
      }

      // Lean effect
      let sx = 1, sy = 1;
      if (this.leanTimer > 0) {
        sx = 1.03; sy = 0.97;
      }
      ctx.scale(sx, sy);

      // Try sprite first (PNGs point UP, so rotate -90° to face RIGHT)
      const _sprImg = Assets._cache[CFG.PLAYER_SPRITE];
      if (_sprImg && _sprImg._loaded) {
        // Underglow glow ring (no shadowBlur)
        const glowPulse = 0.3 + 0.15 * Math.sin(this.glowPhase * 2 * Math.PI / 1.2);
        ctx.fillStyle = CFG.C_ACCENT;
        ctx.globalAlpha *= (0.12 + glowPulse * 0.08) * (drifting ? 1.6 : 1);
        ctx.beginPath();
        ctx.arc(0, 0, (drifting ? 28 : 22), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = this.invulnTimer > 0 && Math.floor(this.invulnTimer * 10) % 2 === 0 ? 0.4 : 1;
        ctx.globalAlpha *= (0.6 + glowPulse);
        ctx.rotate(Math.PI / 2); // PNG points UP → rotate to face RIGHT
        const sprS = CFG.PLAYER_SPRITE_S;
        ctx.drawImage(_sprImg, -sprS/2, -sprS/2, sprS, sprS);
        ctx.rotate(-Math.PI / 2); // restore rotation
        ctx.globalAlpha = 1;
      } else {
      // Underglow glow ring (no shadowBlur)
      const glowPulse = 0.3 + 0.15 * Math.sin(this.glowPhase * 2 * Math.PI / 1.2);
      ctx.fillStyle = CFG.C_ACCENT;
      ctx.globalAlpha *= (0.12 + glowPulse * 0.08) * (drifting ? 1.6 : 1);
      ctx.beginPath();
      ctx.arc(0, 0, (drifting ? 28 : 22), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = this.invulnTimer > 0 && Math.floor(this.invulnTimer * 10) % 2 === 0 ? 0.4 : 1;
      ctx.globalAlpha *= (0.6 + glowPulse);

      // Body
      ctx.fillStyle = CFG.C_PLAYER;
      ctx.fillRect(-CFG.PLAYER_W/2, -CFG.PLAYER_H/2, CFG.PLAYER_W, CFG.PLAYER_H);

      ctx.globalAlpha = 1;

      // Outline
      ctx.strokeStyle = drifting ? CFG.C_ACCENT : '#888';
      ctx.lineWidth = drifting ? 2 : 1;
      ctx.strokeRect(-CFG.PLAYER_W/2, -CFG.PLAYER_H/2, CFG.PLAYER_W, CFG.PLAYER_H);

      // Windshield
      ctx.fillStyle = '#8AF';
      ctx.fillRect(CFG.PLAYER_W/2 - 8, -CFG.PLAYER_H/2 + 3, 5, CFG.PLAYER_H - 6);

      // Nose highlight
      ctx.fillStyle = CFG.C_ACCENT;
      ctx.beginPath();
      ctx.moveTo(CFG.PLAYER_W/2, 0);
      ctx.lineTo(CFG.PLAYER_W/2 - 6, -5);
      ctx.lineTo(CFG.PLAYER_W/2 - 6, 5);
      ctx.closePath();
      ctx.fill();

      // Rear lights
      ctx.fillStyle = this.braking ? '#FF4444' : '#AA2222';
      ctx.fillRect(-CFG.PLAYER_W/2, -CFG.PLAYER_H/2 + 2, 3, 3);
      ctx.fillRect(-CFG.PLAYER_W/2, CFG.PLAYER_H/2 - 5, 3, 3);

      // Exhaust flare
      if (this.exhaustTimer > 0) {
        ctx.fillStyle = CFG.C_PICKUP;
        ctx.globalAlpha = this.exhaustTimer / 0.06;
        ctx.beginPath();
        ctx.moveTo(-CFG.PLAYER_W/2, 0);
        ctx.lineTo(-CFG.PLAYER_W/2 - 12, -4);
        ctx.lineTo(-CFG.PLAYER_W/2 - 12, 4);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      } // end procedural fallback

      // Drift denied flash
      if (this.driftDeniedTimer > 0) {
        ctx.strokeStyle = CFG.C_PICKUP;
        ctx.lineWidth = 3;
        ctx.globalAlpha = this.driftDeniedTimer / 0.12;
        ctx.strokeRect(-CFG.PLAYER_W/2 - 2, -CFG.PLAYER_H/2 - 2, CFG.PLAYER_W + 4, CFG.PLAYER_H + 4);
        ctx.globalAlpha = 1;
      }

      // Shield indicator
      if (this.shield) {
        ctx.strokeStyle = CFG.C_SHIELD;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(this.glowPhase * 4);
        ctx.beginPath();
        ctx.arc(0, 0, CFG.PLAYER_RADIUS + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.restore();

      // Engine jitter (idle life)
      if (speed < 30) {
        // tiny jitter handled by glow pulse already
      }
    }
  }

  // ── ENEMIES ──────────────────────────────────────────────────
  class Enemy {
    constructor(type, x, y) {
      this.type = type; // 'chaser', 'interceptor', 'drifter', 'elite', 'blocker', 'flanker', 'bomber'
      this.x = x; this.y = y;
      this.vx = 0; this.vy = 0;
      this.heading = 0;
      this.drifting = false;
      this.driftJustStarted = false;
      this.slipTimer = 0;
      this.wallHit = false;
      this.alive = true;
      this.nearMissCooldown = 0;
      this.offscreenTimer = 0;
      this.driftToggleTimer = U.randFloat(2, 5);
      this.driftDuration = 0;
      this.glowExtra = 0;
      this.age = 0;
      this.lifespan = U.randFloat(CFG.ENEMY_LIFESPAN_MIN, CFG.ENEMY_LIFESPAN_MAX);
      this.fadeAlpha = 1;
      this.baseMaxSpeed = 0; // set after maxSpeed is assigned
      this.health = 1;
      this.armored = false;
      const spritePool = CFG.ENEMY_SPRITES_BY_TYPE[type] || [];
      this.sprite = spritePool.length > 0 ? U.randChoice(spritePool) : null;

      this.radius = CFG.ENEMY_RADIUS;
      if (type === 'elite') {
        this.maxSpeed = CFG.CHASER_SPEED * 0.9;
        this.turnRate = CFG.ENEMY_TURN_RATE * 0.8;
        this.health = 2;
        this.armored = true;
        this.radius = 14; // larger collision
        this.lifespan *= 1.5; // elites live longer
      } else if (type === 'chaser') { this.maxSpeed = CFG.CHASER_SPEED; this.turnRate = CFG.ENEMY_TURN_RATE; }
      else if (type === 'interceptor') { this.maxSpeed = CFG.INTERCEPTOR_SPEED; this.turnRate = CFG.ENEMY_TURN_RATE * 0.85; }
      else if (type === 'blocker') {
        this.maxSpeed = CFG.BLOCKER_SPEED; this.turnRate = CFG.ENEMY_TURN_RATE * 0.7;
        this.holdingTrail = false;
      }
      else if (type === 'flanker') {
        this.maxSpeed = CFG.FLANKER_SPEED; this.turnRate = CFG.ENEMY_TURN_RATE * 0.9;
        this.flankSide = Math.random() < 0.5 ? 1 : -1;
        this.flankSwitchTimer = U.randFloat(3, 5);
        this.striking = false;
        this.strikeTimer = 0;
      }
      else if (type === 'bomber') {
        this.maxSpeed = CFG.BOMBER_SPEED; this.turnRate = CFG.ENEMY_TURN_RATE * 0.75;
        this.bombTimer = CFG.BOMB_ZONE_INTERVAL;
        this._dropBomb = false;
      }
      else { this.maxSpeed = CFG.DRIFTER_SPEED; this.turnRate = CFG.ENEMY_TURN_RATE * 1.1; }
      this.baseMaxSpeed = this.maxSpeed;
    }

    update(dt, player) {
      const Camera = window.Camera;
      const Particles = window.Particles;
      const updatePhysics = window.updatePhysics;

      if (!this.alive) return;

      // Target
      let tx = player.x, ty = player.y;
      let throttle = true;

      if (this.type === 'interceptor') {
        // Lead the player
        const lookAhead = 0.5;
        tx += player.vx * lookAhead;
        ty += player.vy * lookAhead;
      } else if (this.type === 'blocker') {
        // Target trail midpoint to block encirclement routes
        if (player._trailMidpoint) {
          tx = player._trailMidpoint.x;
          ty = player._trailMidpoint.y;
        }
        const distToTarget = U.dist(this.x, this.y, tx, ty);
        if (distToTarget < 80) {
          this.holdingTrail = true;
          // Face the player while holding position
          tx = player.x; ty = player.y;
          throttle = false; // stop accelerating, park near trail
        } else {
          this.holdingTrail = false;
        }
      } else if (this.type === 'flanker') {
        // Flank side switching
        this.flankSwitchTimer -= dt;
        if (this.flankSwitchTimer <= 0) {
          this.flankSide *= -1;
          this.flankSwitchTimer = U.randFloat(3, 5);
        }
        const distToPlayer = U.dist(this.x, this.y, player.x, player.y);
        if (this.striking) {
          // Direct charge at player
          this.strikeTimer -= dt;
          if (this.strikeTimer <= 0) this.striking = false;
          tx = player.x; ty = player.y;
        } else if (distToPlayer < 120) {
          // Close enough — strike!
          this.striking = true;
          this.strikeTimer = 1.0;
          tx = player.x; ty = player.y;
        } else {
          // Flank: target perpendicular to player velocity
          const pSpeed = Math.hypot(player.vx, player.vy);
          if (pSpeed > 50) {
            const perpX = -player.vy / pSpeed * this.flankSide;
            const perpY = player.vx / pSpeed * this.flankSide;
            tx = player.x + perpX * 200;
            ty = player.y + perpY * 200;
          }
        }
      } else if (this.type === 'bomber') {
        // Orbit ahead of player, drop hazard zones
        const pSpeed = Math.hypot(player.vx, player.vy);
        if (pSpeed > 30) {
          tx = player.x + (player.vx / pSpeed) * 300;
          ty = player.y + (player.vy / pSpeed) * 300;
        }
        this.bombTimer -= dt;
        if (this.bombTimer <= 0) {
          this.bombTimer = CFG.BOMB_ZONE_INTERVAL;
          this._dropBomb = true;
        }
      }

      // Desired heading
      const desired = Math.atan2(ty - this.y, tx - this.x);
      const diff = U.angleDiff(this.heading, desired);
      let turnInput = U.clamp(diff * 3, -1, 1);

      // Drifter type: periodic drift toggles
      let wantDrift = false;
      if (this.type === 'drifter') {
        if (this.drifting) {
          // Currently drifting — count down duration
          this.driftDuration -= dt;
          if (this.driftDuration > 0) {
            wantDrift = true;
          } else {
            // Drift ended, set cooldown before next drift
            wantDrift = false;
            this.driftToggleTimer = U.randFloat(1.5, 3);
          }
        } else {
          // Not drifting — count down until next drift
          this.driftToggleTimer -= dt;
          if (this.driftToggleTimer <= 0) {
            wantDrift = true;
            this.driftDuration = U.randFloat(1, 2.5);
          }
        }
      }

      this.wallHit = false;
      this.driftJustStarted = false;
      updatePhysics(this, dt, turnInput, throttle, false, wantDrift, false);

      // Near miss cooldown
      if (this.nearMissCooldown > 0) this.nearMissCooldown -= dt;

      // Age / lifespan
      this.age += dt;
      if (this.age >= this.lifespan) {
        this.alive = false;
        // Fade-out poof particles
        Particles.spawn(this.x, this.y, '#666', 6, {
          vxMin: -60, vxMax: 60, vyMin: -60, vyMax: 60,
          lifeMin: 0.3, lifeMax: 0.5, sizeMin: 3, sizeMax: 6, type: 'smoke',
        });
        return;
      }
      // Fade alpha when nearing end of lifespan (last 2 seconds)
      this.fadeAlpha = this.lifespan - this.age < 2 ? (this.lifespan - this.age) / 2 : 1;

      // Off-screen behavior: boost speed for catch-up, despawn if too far/too long
      const onScreen = Camera.isVisible(this.x, this.y, 40);
      if (!onScreen) {
        this.offscreenTimer += dt;
        this.maxSpeed = this.baseMaxSpeed * CFG.ENEMY_OFFSCREEN_BOOST;
        if (this.offscreenTimer > CFG.ENEMY_OFFSCREEN_DESPAWN) { this.alive = false; return; }
        if (U.dist(this.x, this.y, player.x, player.y) > CFG.ENEMY_FAR_DESPAWN_DIST) { this.alive = false; return; }
      } else {
        this.offscreenTimer = 0;
        this.maxSpeed = this.baseMaxSpeed;
      }
    }

    render(ctx, time) {
      const Assets = window.Assets;
      if (!this.alive) return;

      const isElite = this.type === 'elite';
      const ew = isElite ? 40 : CFG.ENEMY_W;
      const eh = isElite ? 20 : CFG.ENEMY_H;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.heading);

      // Fade when nearing lifespan end
      if (this.fadeAlpha !== undefined && this.fadeAlpha < 1) {
        ctx.globalAlpha = Math.max(0.15, this.fadeAlpha);
      }

      // Elite: pulsing aura (no shadowBlur)
      if (isElite) {
        const auraPulse = 0.3 + 0.2 * Math.sin((time || 0) * 4);
        const auraColor = this.armored ? CFG.C_RARE : CFG.C_ENEMY;
        // Outer aura circle
        ctx.globalAlpha *= (0.15 + auraPulse * 0.1);
        ctx.fillStyle = auraColor;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.fill();
        // Softer glow ring
        ctx.globalAlpha = (0.08 + auraPulse * 0.06);
        ctx.beginPath();
        ctx.arc(0, 0, 34 + this.glowExtra * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = this.fadeAlpha !== undefined ? Math.max(0.15, this.fadeAlpha) : 1;
      }

      // Type-specific colors for aura and fallback rendering
      const typeColorMap = {
        chaser: CFG.C_ENEMY, interceptor: '#4488FF', drifter: '#FFD700',
        elite: this.armored ? CFG.C_RARE : CFG.C_ENEMY,
        blocker: '#88FF88', flanker: '#FF8800', bomber: '#CC2200',
      };
      const typeDarkMap = {
        chaser: CFG.C_ENEMY_DARK, interceptor: '#1A2244', drifter: '#3A3000',
        elite: this.armored ? '#2A1A4A' : CFG.C_ENEMY_DARK,
        blocker: '#1A3A1A', flanker: '#3A2200', bomber: '#3A0800',
      };
      const auraColor = typeColorMap[this.type] || CFG.C_ENEMY;
      const bodyDark = typeDarkMap[this.type] || CFG.C_ENEMY_DARK;

      // Try sprite first (PNGs point UP → rotate +90° to face RIGHT)
      const _eImg = this.sprite ? Assets._cache[this.sprite] : null;
      if (_eImg && _eImg._loaded) {
        ctx.rotate(Math.PI / 2);
        const eSprS = isElite ? CFG.ENEMY_SPRITE_S * 1.25 : CFG.ENEMY_SPRITE_S;
        ctx.drawImage(_eImg, -eSprS/2, -eSprS/2, eSprS, eSprS);
        ctx.rotate(-Math.PI / 2);
        // Colored outline glow (replaces shadowBlur)
        ctx.strokeStyle = auraColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha *= 0.4;
        ctx.strokeRect(-ew/2 - 2, -eh/2 - 2, ew + 4, eh + 4);
        ctx.globalAlpha = this.fadeAlpha !== undefined ? Math.max(0.15, this.fadeAlpha) : 1;
      } else {
      // Body
      ctx.fillStyle = bodyDark;
      ctx.fillRect(-ew/2, -eh/2, ew, eh);
      ctx.strokeStyle = auraColor;
      ctx.lineWidth = isElite ? 2.5 : 1.5;
      ctx.strokeRect(-ew/2, -eh/2, ew, eh);

      // Armor indicator on elite
      if (isElite && this.armored) {
        ctx.strokeStyle = CFG.C_RARE;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        ctx.strokeRect(-ew/2 + 3, -eh/2 + 3, ew - 6, eh - 6);
        ctx.globalAlpha = 1;
      }

      // Headlight wedge
      ctx.fillStyle = CFG.C_TEXT;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(ew/2, -2);
      ctx.lineTo(ew/2 + 10, -8);
      ctx.lineTo(ew/2 + 10, 8);
      ctx.lineTo(ew/2, 2);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      } // end procedural fallback

      ctx.restore();
    }
  }

  // ── ENEMY DEATH FX (type-specific) ──────────────────────────
  function enemyDeathFX(type, x, y, isElite) {
    const Particles = window.Particles;
    const ScreenFX = window.ScreenFX;
    switch (type) {
      case 'chaser':
        Particles.spawn(x, y, '#FF4444', isElite ? 14 : 8, {
          vxMin: -300, vxMax: 300, vyMin: -300, vyMax: 300,
          lifeMin: 0.2, lifeMax: 0.5, sizeMin: 2, sizeMax: 6, type: 'spark',
        });
        break;
      case 'interceptor':
        Particles.spawn(x, y, '#4488FF', isElite ? 14 : 8, {
          vxMin: -250, vxMax: 250, vyMin: -250, vyMax: 250,
          lifeMin: 0.3, lifeMax: 0.6, sizeMin: 3, sizeMax: 7, type: 'spark',
        });
        break;
      case 'drifter':
        Particles.spawn(x, y, '#888888', 10, {
          vxMin: -100, vxMax: 100, vyMin: -100, vyMax: 100,
          lifeMin: 0.4, lifeMax: 0.8, sizeMin: 5, sizeMax: 12, type: 'smoke',
        });
        Particles.spawn(x, y, '#333', 4, {
          vxMin: -30, vxMax: 30, vyMin: -30, vyMax: 30,
          lifeMin: 0.8, lifeMax: 1.5, sizeMin: 2, sizeMax: 4, type: 'shard',
        });
        break;
      case 'elite':
        Particles.spawn(x, y, '#FFD700', 16, {
          vxMin: -350, vxMax: 350, vyMin: -350, vyMax: 350,
          lifeMin: 0.4, lifeMax: 0.9, sizeMin: 5, sizeMax: 14, type: 'shard',
        });
        Particles.spawn(x, y, '#fff', 8, {
          vxMin: -200, vxMax: 200, vyMin: -200, vyMax: 200,
          lifeMin: 0.2, lifeMax: 0.5, sizeMin: 3, sizeMax: 7, type: 'spark',
        });
        ScreenFX.shake(6, 0.25);
        break;
      case 'blocker':
        Particles.spawn(x, y, '#88FF88', 10, {
          vxMin: -200, vxMax: 200, vyMin: -200, vyMax: 200,
          lifeMin: 0.3, lifeMax: 0.7, sizeMin: 4, sizeMax: 8, type: 'shard',
        });
        break;
      case 'flanker':
        Particles.spawn(x, y, '#FF8800', 12, {
          vxMin: -350, vxMax: 350, vyMin: -350, vyMax: 350,
          lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 5, type: 'spark',
        });
        break;
      case 'bomber':
        Particles.spawn(x, y, '#CC2200', 14, {
          vxMin: -250, vxMax: 250, vyMin: -250, vyMax: 250,
          lifeMin: 0.4, lifeMax: 0.8, sizeMin: 5, sizeMax: 12, type: 'shard',
        });
        Particles.spawn(x, y, '#FF6600', 6, {
          vxMin: -100, vxMax: 100, vyMin: -100, vyMax: 100,
          lifeMin: 0.3, lifeMax: 0.5, sizeMin: 3, sizeMax: 6, type: 'smoke',
        });
        ScreenFX.shake(4, 0.2);
        break;
      default:
        Particles.spawn(x, y, '#FF6688', 6, {
          vxMin: -200, vxMax: 200, vyMin: -200, vyMax: 200,
          lifeMin: 0.3, lifeMax: 0.7, sizeMin: 4, sizeMax: 10, type: 'shard',
        });
    }
    Particles.addRing(x, y, type === 'elite' ? '#FFD700' : CFG.C_ACCENT);
  }

  window.Player = Player;
  window.Enemy = Enemy;
  window.enemyDeathFX = enemyDeathFX;
})();
