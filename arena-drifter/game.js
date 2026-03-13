// game.js — renderHUD, renderUpgradeBreak, STATE, Game
(function() {
  'use strict';
  const { CFG, CFG_BASE, MAPS, MAPS_BY_ID, S, U } = window.OversteerLogic;

  // ── HUD / UI ─────────────────────────────────────────────────
  function renderHUD(ctx, game) {
    const { score, player, waveTimer, waveIndex, driftCombo, phase, highScore, newBest } = game;
    const Waves = window.Waves;
    const ARENA_UPGRADES = window.ARENA_UPGRADES;
    const PerfMon = window.PerfMon;

    // Helper: draw dark backdrop panel
    function panel(x, y, w, h, r) {
      r = r || S(4);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
    }

    // Sandbox label
    if (game.sandbox) {
      panel(CFG.W/2 - S(160), S(8), S(320), S(46), S(6));
      U.text(ctx, 'SANDBOX', CFG.W/2, S(24), { align: 'center', color: CFG.C_ACCENT, size: 18, bold: true, shadow: true });
      U.text(ctx, 'Just drive. No enemies. Press P to pause, ESC to menu.', CFG.W/2, S(44), { align: 'center', color: '#999', size: 11, shadow: true });
      return;
    }

    // Score (top-left) — backdrop
    const scoreH = newBest ? S(56) : S(42);
    panel(S(12), S(8), S(110), scoreH, S(4));
    const scoreStr = Math.floor(score).toLocaleString();
    U.text(ctx, 'SCORE', S(20), S(22), { color: '#BBB', size: 12, bold: true, shadow: true });
    U.text(ctx, scoreStr, S(20), S(42), { color: newBest ? CFG.C_PICKUP : CFG.C_TEXT, size: 22, bold: true, shadow: true });
    if (newBest) {
      U.text(ctx, 'NEW BEST!', S(20), S(60), { color: CFG.C_PICKUP, size: 10, bold: true, shadow: true });
    }

    // HP bar (below score panel)
    {
      const hpX = S(12), hpY = scoreH + S(12);
      panel(hpX, hpY, S(110), S(20), S(4));
      U.text(ctx, 'HP', hpX + S(6), hpY + S(12), { color: '#BBB', size: 10, shadow: true });
      const barX = hpX + S(24), barY = hpY + S(6), barW = S(54), barH = S(8);
      ctx.fillStyle = CFG.C_PANEL;
      ctx.fillRect(barX, barY, barW, barH);
      const hpFrac = U.clamp(player.hp / player.maxHp, 0, 1);
      const hpColor = hpFrac > 0.6 ? CFG.C_SHIELD : hpFrac > 0.3 ? '#FFD93D' : CFG.C_ENEMY;
      ctx.fillStyle = player.lastHitTimer < 0.2 ? '#FF0000' : hpColor;
      ctx.fillRect(barX, barY, barW * hpFrac, barH);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
      U.text(ctx, `${Math.ceil(player.hp)}/${player.maxHp}`, barX + barW + S(4), hpY + S(12), { color: CFG.C_TEXT, size: 9, shadow: true });
    }

    // Wave timer (top-center)
    if (phase === 'combat') {
      const frac = U.clamp(waveTimer / (Waves.currentCombatDuration || CFG.WAVE_COMBAT), 0, 1);
      const barW = S(200), barH = S(10);
      const bx = CFG.W/2 - barW/2, by = S(14);
      panel(bx - S(6), by - S(4), barW + S(12), barH + S(24), S(4));
      ctx.fillStyle = CFG.C_PANEL;
      ctx.fillRect(bx, by, barW, barH);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, barW, barH);
      ctx.fillStyle = CFG.C_ACCENT;
      ctx.fillRect(bx, by, barW * frac, barH);
      U.text(ctx, `WAVE ${waveIndex}`, CFG.W/2, by + barH + S(14), { align: 'center', color: '#AAA', size: 11, shadow: true });
    }

    // Drift combo (bottom-left)
    if (player.drifting || player.comboLevel > 0.5) {
      const comboInt = Math.floor(player.comboLevel);
      const barW = S(120), barH = S(8);
      const bx = S(20), by = CFG.H - S(30);
      panel(bx - S(6), by - S(20), barW + S(12), S(34), S(4));
      ctx.fillStyle = CFG.C_PANEL;
      ctx.fillRect(bx, by, barW, barH);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, barW, barH);
      const comboPct = U.clamp(player.driftTime % CFG.DRIFT_COMBO_INTERVAL / CFG.DRIFT_COMBO_INTERVAL, 0, 1);
      ctx.fillStyle = CFG.C_ACCENT;
      ctx.fillRect(bx, by, barW * comboPct, barH);
      U.text(ctx, `DRIFT x${comboInt}`, bx, by - S(8), { color: CFG.C_ACCENT, size: 13, bold: true, shadow: true });
    }

    // Drift available pulse
    if (player.speed >= CFG.DRIFT_THRESHOLD && !player.drifting) {
      const pulse = 0.4 + 0.3 * Math.sin(game.time * 6);
      ctx.globalAlpha = pulse;
      U.text(ctx, 'SPACE TO DRIFT', CFG.W/2, CFG.H - S(20), { align: 'center', color: CFG.C_ACCENT, size: 11, shadow: true });
      ctx.globalAlpha = 1;
    }

    // Enemy count (top-right area, below upgrades)
    if (phase === 'combat') {
      let aliveCount = 0;
      for (let i = 0; i < Waves.enemies.length; i++) if (Waves.enemies[i].alive) aliveCount++;
      U.text(ctx, `ENEMIES: ${aliveCount}`, CFG.W - S(20), S(46), { align: 'right', color: '#AAA', size: 11, shadow: true });
    }

    // Speed indicator bar (bottom-right)
    {
      const barW = S(60), barH = S(6);
      const bx = CFG.W - S(20) - barW, by = CFG.H - S(34);
      panel(bx - S(30), by - S(6), barW + S(38), barH + S(12), S(4));
      const speedFrac = U.clamp(player.speed / (player.maxSpeed || CFG.MAX_SPEED), 0, 1);
      const driftFrac = CFG.DRIFT_THRESHOLD / (player.maxSpeed || CFG.MAX_SPEED);
      ctx.fillStyle = CFG.C_PANEL;
      ctx.fillRect(bx, by, barW, barH);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, barW, barH);
      ctx.fillStyle = speedFrac >= driftFrac ? CFG.C_ACCENT : '#999';
      ctx.fillRect(bx, by, barW * speedFrac, barH);
      // Drift threshold marker
      ctx.fillStyle = '#AAA';
      ctx.fillRect(bx + barW * driftFrac - S(1), by - S(1), S(2), barH + S(2));
      U.text(ctx, 'SPD', bx - S(6), by + S(2), { align: 'right', color: '#999', size: 9, shadow: true });
    }

    // Controls hint (bottom-right)
    U.text(ctx, 'WASD + SPACE', CFG.W - S(20), CFG.H - S(20), { align: 'right', color: '#888', size: 10, shadow: true });

    // Upgrades taken
    const ups = player.upgrades;
    if (ups.length > 0) {
      for (let i = 0; i < ups.length; i++) {
        const upg = ARENA_UPGRADES.find(u => u.id === ups[i]);
        if (upg) {
          ctx.fillStyle = CFG.C_PANEL;
          ctx.fillRect(CFG.W - S(26) - i * S(22), S(14), S(20), S(20));
          U.text(ctx, upg.icon, CFG.W - S(16) - i * S(22), S(24), { align: 'center', color: CFG.C_ACCENT, size: 12, bold: true, shadow: true });
        }
      }
    }

    // FPS / frame-time diagnostic (bottom-left)
    {
      const fps = PerfMon.avgFps();
      const worst = PerfMon.worstMs();
      const col = worst > 33 ? '#FF3B6B' : worst > 20 ? '#FFB000' : '#5BFF4A';
      panel(S(12), CFG.H - S(30), S(170), S(22), S(3));
      U.text(ctx, `FPS: ${fps|0}  worst: ${worst.toFixed(1)}ms`, S(18), CFG.H - S(16), { color: col, size: 10, shadow: true });
    }
  }

  function renderUpgradeBreak(ctx, cards, cardAnimTimer, selectedIndex, rerollsLeft, upgradeChosen, upgradeConfirmTimer, waveIndex) {
    const bounds = { cardBounds: [], rerollBounds: null };
    // Dim
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CFG.W, CFG.H);

    if (upgradeChosen) {
      // Post-selection: show chosen upgrade + countdown
      const chosen = cards[selectedIndex];
      if (chosen) {
        U.text(ctx, chosen.icon, CFG.W/2, CFG.H/2 - S(60), { align: 'center', color: CFG.C_ACCENT, size: 48, bold: true, shadow: true });
        U.text(ctx, chosen.name, CFG.W/2, CFG.H/2 - S(15), { align: 'center', color: CFG.C_TEXT, size: 22, bold: true, shadow: true });
      }
      const secs = Math.ceil(Math.max(0, upgradeConfirmTimer));
      U.text(ctx, `${secs}`, CFG.W/2, CFG.H/2 + S(40), { align: 'center', color: CFG.C_ACCENT, size: 48, bold: true, shadow: true });
      U.text(ctx, `Wave ${waveIndex + 1} incoming...`, CFG.W/2, CFG.H/2 + S(80), { align: 'center', color: '#888', size: 16, shadow: true });
      return bounds;
    }

    // No upgrades available edge case
    if (cards.length === 0) {
      U.text(ctx, 'No upgrades available', CFG.W/2, CFG.H/2, { align: 'center', color: '#888', size: 20, shadow: true });
      return bounds;
    }

    U.text(ctx, 'CHOOSE UPGRADE', CFG.W/2, S(60), { align: 'center', color: CFG.C_ACCENT, size: 28, bold: true, shadow: true });

    // Cards
    const cardW = S(180), cardH = S(200), gap = S(20);
    const total = cards.length * cardW + (cards.length - 1) * gap;
    let cx = (CFG.W - total) / 2;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const y = S(120);

      // Slide-up animation (staggered)
      const slideOffset = Math.max(0, S(24) - cardAnimTimer * S(120) + i * S(7));
      const drawY = y + slideOffset;
      bounds.cardBounds.push({ x: cx, y: drawY, w: cardW, h: cardH });

      ctx.save();
      ctx.translate(0, slideOffset);
      ctx.globalAlpha = Math.min(1, cardAnimTimer * 5 - i * 0.3);

      // Card bg
      ctx.fillStyle = selectedIndex === i ? '#2A3344' : CFG.C_PANEL;
      U.roundRect(ctx, cx, y, cardW, cardH, S(8));
      ctx.fill();

      // Border
      ctx.strokeStyle = selectedIndex === i ? CFG.C_ACCENT : '#444';
      ctx.lineWidth = selectedIndex === i ? S(3) : S(1.5);
      U.roundRect(ctx, cx, y, cardW, cardH, S(8));
      ctx.stroke();

      // Key hint
      U.text(ctx, `[${i + 1}]`, cx + cardW/2, y + S(20), { align: 'center', color: CFG.C_ACCENT, size: 14, bold: true });

      // Icon
      U.text(ctx, card.icon, cx + cardW/2, y + S(55), { align: 'center', color: CFG.C_TEXT, size: 36, bold: true });

      // Name
      U.text(ctx, card.name, cx + cardW/2, y + S(90), { align: 'center', color: CFG.C_TEXT, size: 14, bold: true });

      // Desc
      ctx.textBaseline = 'top';
      U.wrapText(ctx, card.desc, cx + S(12), y + S(110), cardW - S(24), S(16), { size: 12, color: '#aaa' });

      ctx.globalAlpha = 1;
      ctx.restore();

      cx += cardW + gap;
    }

    U.text(ctx, 'Press 1 / 2 / 3 or tap a card', CFG.W/2, CFG.H - S(60), { align: 'center', color: '#666', size: 13 });
    const rerollColor = rerollsLeft > 0 ? '#888' : '#444';
    U.text(ctx, `Press [R] to reroll (${rerollsLeft} left)`, CFG.W/2, CFG.H - S(35), { align: 'center', color: rerollColor, size: 13 });
    bounds.rerollBounds = { x: CFG.W/2 - S(170), y: CFG.H - S(50), w: S(340), h: S(28) };
    return bounds;
  }

  // ── GAME STATE MACHINE ───────────────────────────────────────
  const STATE = { MENU: 0, MAP_SELECT: 1, PLAYING: 2, PAUSED: 3, UPGRADE: 4, DYING: 5, GAME_OVER: 6 };

  const Game = {
    state: STATE.MENU,
    player: new (window.Player)(),
    selectedMapId: localStorage.getItem('oversteer_map_v1') || 'arena',
    score: 0,
    highScore: parseInt(localStorage.getItem('oversteer_highscore_v1') || '0'),
    newBest: false,
    time: 0,
    waveTimer: 0,
    waveIndex: 0,
    phase: 'combat',
    breakTimer: 0,
    speedBonus: 0,
    speedBonusFromScore: 0,
    speedBonusFromUpgrades: 0,
    menuAnim: 0,
    gameOverTimer: 0,
    deathTimer: 0,
    deathPhase: 0,
    milestoneScore: 250,
    milestoneTimer: 0,
    milestoneText: '',
    lastDriftComboTick: 0,
    upgradeSelectedIndex: -1,
    upgradeCardBounds: [],
    upgradeRerollBounds: null,
    // Tutorial
    tutorialShown: false,
    tutorialDismissed: false,
    tutorialTimer: 0,
    encircleCount: 0,
    // Wave announce
    waveAnnounceTimer: 0,
    waveAnnounceNum: 0,
    _resetTiming: false,
    hordeAnnounceTimer: 0,
    // Death cause
    deathCause: '',
    // Extended stats
    peakCombo: 0,
    nearMissTotal: 0,
    totalDriftTime: 0,
    enemiesKilled: 0,
    // Touch UI
    sandbox: false,
    modifiers: { hardMode: false, speedRush: false, fragile: false, doubleEnemies: false },
    touchDriftBtn: { x: CFG.W - S(70), y: CFG.H - S(80), r: S(40) },

    applyMap(id) {
      const map = MAPS_BY_ID[id] || MAPS[0];
      this.selectedMapId = map.id;
      localStorage.setItem('oversteer_map_v1', map.id);

      // Reset to base CFG, then apply map overrides
      for (const k in CFG_BASE) CFG[k] = CFG_BASE[k];
      if (map.cfg) {
        for (const k in map.cfg) CFG[k] = map.cfg[k];
      }

      // Rebuild prop glow cache for current PROP_POOL
      const FXCache = window.FXCache;
      FXCache.propGlow = {};
      FXCache.initPropGlow();
    },

    cycleMap(dir) {
      const idx = Math.max(0, MAPS.findIndex(m => m.id === this.selectedMapId));
      const next = (idx + dir + MAPS.length) % MAPS.length;
      this.applyMap(MAPS[next].id);
    },

    init() {
      const Input = window.Input;
      Input.init();
      this.state = STATE.MENU;
    },

    reset() {
      const Particles = window.Particles;
      const ScreenFX = window.ScreenFX;
      const Trail = window.Trail;
      const Waves = window.Waves;
      const Props = window.Props;
      const Camera = window.Camera;

      this.applyMap(this.selectedMapId);
      this.player.reset();
      this.score = 0;
      this.newBest = false;
      this.time = 0;
      this.waveTimer = 0;
      this.waveIndex = 0;
      this.phase = 'combat';
      this.breakTimer = 0;
      this.speedBonus = 0;
      this.speedBonusFromScore = 0;
      this.speedBonusFromUpgrades = 0;
      this.gameOverTimer = 0;
      this.deathTimer = 0;
      this.deathPhase = 0;
      this.milestoneScore = 250;
      this.milestoneTimer = 0;
      this.lastDriftComboTick = 0;
      this.upgradeSelectedIndex = -1;
      this.upgradeCardBounds = [];
      this.upgradeRerollBounds = null;
      this.rerollsLeft = CFG.REROLL_MAX;
      this.upgradeConfirmTimer = 0;
      this.cardAnimTimer = 0;
      this.tutorialShown = false;
      this.tutorialDismissed = false;
      this.tutorialTimer = 0;
      this.encircleCount = 0;
      this.waveAnnounceTimer = 0;
      this.waveAnnounceNum = 0;
      this.hordeAnnounceTimer = 0;
      this.deathCause = '';
      this.peakCombo = 0;
      this.nearMissTotal = 0;
      this.totalDriftTime = 0;
      this.enemiesKilled = 0;
      Particles.clear();
      ScreenFX.reset();
      Trail.reset();
      Waves.reset();
      Props.reset();
      Props.generate();
      Camera.reset(this.player.x, this.player.y);
      // Apply difficulty modifiers
      if (this.modifiers.hardMode) {
        this.speedBonus += 100;
        this.player.scoreMult *= 1.5;
      }
      if (this.modifiers.speedRush) {
        CFG.SPAWN_INTERVAL_INITIAL *= 0.5;
        CFG.SPAWN_INTERVAL_MIN *= 0.5;
        this.player.scoreMult *= 1.3;
      }
      if (this.modifiers.fragile) {
        this.player.maxHp = 50;
        this.player.hp = 50;
        this.player.scoreMult *= 1.4;
      }
      if (this.modifiers.doubleEnemies) {
        CFG.SPAWN_INTERVAL_INITIAL *= 0.5;
        CFG.SPAWN_INTERVAL_MIN *= 0.5;
        CFG.BURST_COUNT = 4;
        this.player.scoreMult *= 1.6;
      }
      if (!this.sandbox) {
        Waves.startWave(this.player);
        this.waveAnnounceTimer = 2.0;
        this.waveAnnounceNum = 1;
      }
    },

    buildUpgradeOffer() {
      const ARENA_UPGRADES = window.ARENA_UPGRADES;
      const stackable = ['shield', 'hp_regen', 'max_hp', 'damage_resist', 'extra_rerolls'];
      const regenCount = this.player.upgrades.filter(u => u === 'hp_regen').length;
      const extraRerollCount = this.player.upgrades.filter(u => u === 'extra_rerolls').length;
      const pool = ARENA_UPGRADES.filter(u =>
        (!this.player.upgrades.includes(u.id) || stackable.includes(u.id))
        && !(u.id === 'hp_regen' && regenCount >= 3)
        && !(u.id === 'extra_rerolls' && extraRerollCount >= 2)
      );
      return U.randSample(pool, CFG.UPGRADES_TO_OFFER);
    },

    applyUpgrade(upg) {
      if (!upg) return;
      upg.apply(this.player);
      this.player.upgrades.push(upg.id);
      if (upg.id === 'speed_demon') {
        // Enemies get +10% speed bonus
        this.speedBonusFromUpgrades += 40;
        this.speedBonus = this.speedBonusFromScore + this.speedBonusFromUpgrades;
      }
    },

    update(rawDt) {
      const Input = window.Input;
      const Audio = window.Audio;
      const Particles = window.Particles;
      const ScreenFX = window.ScreenFX;
      const Camera = window.Camera;
      const Trail = window.Trail;
      const Waves = window.Waves;
      const Props = window.Props;
      const enemyDeathFX = window.enemyDeathFX;
      const ARENA_UPGRADES = window.ARENA_UPGRADES;

      Input.poll();
      this.menuAnim += rawDt;

      if (this.state === STATE.MENU) {
        const tap = Input.consumeTap();
        if (Input.enter || Input.keys['Space'] || tap) {
          Audio.play('ui_click');
          this.state = STATE.MAP_SELECT;
          Input.keys['Space'] = false;
        }
        if (Input.keys['KeyS']) {
          Audio.play('ui_click');
          this.sandbox = true;
          localStorage.setItem('oversteer_sandbox', '1');
          this.state = STATE.MAP_SELECT;
          Input.keys['KeyS'] = false;
        }
        return;
      }

      if (this.state === STATE.MAP_SELECT) {
        const tap = Input.consumeTap();
        if (Input.keys['ArrowLeft'] || Input.keys['KeyA']) {
          this.cycleMap(-1);
          Input.keys['ArrowLeft'] = false;
          Input.keys['KeyA'] = false;
        }
        if (Input.keys['ArrowRight'] || Input.keys['KeyD']) {
          this.cycleMap(1);
          Input.keys['ArrowRight'] = false;
          Input.keys['KeyD'] = false;
        }
        if (Input.keys['Digit1']) { this.modifiers.hardMode = !this.modifiers.hardMode; Input.keys['Digit1'] = false; }
        if (Input.keys['Digit2']) { this.modifiers.speedRush = !this.modifiers.speedRush; Input.keys['Digit2'] = false; }
        if (Input.keys['Digit3']) { this.modifiers.fragile = !this.modifiers.fragile; Input.keys['Digit3'] = false; }
        if (Input.keys['Digit4']) { this.modifiers.doubleEnemies = !this.modifiers.doubleEnemies; Input.keys['Digit4'] = false; }
        if (Input.enter || Input.keys['Space'] || tap) {
          Audio.play('ui_click');
          if (!this.sandbox) localStorage.setItem('oversteer_sandbox', '0');
          this.reset();
          this.state = STATE.PLAYING;
          Audio.startEngine(); Audio.startMusic();
          Input.keys['Space'] = false;
        }
        if (Input.keys['Escape']) {
          Audio.play('ui_click');
          this.state = STATE.MENU;
          Input.keys['Escape'] = false;
        }
        return;
      }

      if (this.state === STATE.PAUSED) {
        // Audio controls in pause
        if (Input.keys['KeyM']) { Audio.setMuted(!Audio.muted); Input.keys['KeyM'] = false; }
        if (Input.keys['BracketLeft']) { Audio.setVolume('sfx', Audio.sfxVolume - 0.1); Input.keys['BracketLeft'] = false; }
        if (Input.keys['BracketRight']) { Audio.setVolume('sfx', Audio.sfxVolume + 0.1); Input.keys['BracketRight'] = false; }
        if (Input.keys['Minus']) { Audio.setVolume('music', Audio.musicVolume - 0.1); Input.keys['Minus'] = false; }
        if (Input.keys['Equal']) { Audio.setVolume('music', Audio.musicVolume + 0.1); Input.keys['Equal'] = false; }
        if (Input.pause) {
          this.state = STATE.PLAYING;
          Audio.startEngine();
          if (Audio._musicPlaying && Audio.musicNodes) {
            Audio.musicNodes.gain.gain.value = Audio.muted ? 0 : Audio.musicVolume * 0.3;
          }
        }
        return;
      }

      if (this.state === STATE.GAME_OVER) {
        this.gameOverTimer -= rawDt;
        if (this.gameOverTimer <= 0 && (Input.enter || Input.keys['Space'])) {
          this.state = STATE.MENU;
          this.modifiers = { hardMode: false, speedRush: false, fragile: false, doubleEnemies: false };
          Audio.stopAll();
          Input.keys['Space'] = false;
        }
        // R to quick restart
        if (this.gameOverTimer <= 0 && Input.keys['KeyR']) {
          Input.keys['KeyR'] = false;
          this.sandbox = false;
          this.reset();
          this.state = STATE.PLAYING;
          Audio.startEngine(); Audio.startMusic();
        }
        return;
      }

      if (this.state === STATE.DYING) {
        this.deathTimer -= rawDt;
        const dt = ScreenFX.update(rawDt);
        Particles.update(dt || rawDt);

        if (this.deathPhase === 0 && this.deathTimer <= 0) {
          // Freeze done → slow-mo + shatter
          this.deathPhase = 1;
          this.deathTimer = CFG.DEATH_SLOWMO_DUR;
          ScreenFX.slowmo(CFG.DEATH_SLOWMO, CFG.DEATH_SLOWMO_DUR);
          ScreenFX.shake(10, 0.35);
          // Shatter
          const shardCount = U.randInt(CFG.SHARD_COUNT_MIN, CFG.SHARD_COUNT_MAX);
          Particles.spawn(this.player.x, this.player.y, CFG.C_TEXT, shardCount, {
            vxMin: -300, vxMax: 300, vyMin: -300, vyMax: 300,
            lifeMin: 0.4, lifeMax: 0.8, sizeMin: 4, sizeMax: 10, type: 'shard',
          });
          // Red ring
          Particles.addRing(this.player.x, this.player.y, CFG.C_ENEMY);
          ScreenFX.flash('#FF3B6B', 0.15, 0.1);
        }
        if (this.deathPhase === 1 && this.deathTimer <= 0) {
          // Slow-mo done → desaturate + game over
          this.deathPhase = 2;
          this.deathTimer = 0.5;
          ScreenFX.desaturate(0.7);
        }
        if (this.deathPhase === 2 && this.deathTimer <= 0) {
          // Save high score
          if (this.score > this.highScore) {
            this.highScore = Math.floor(this.score);
            localStorage.setItem('oversteer_highscore_v1', this.highScore);
            this.newBest = true;
          }
          this.state = STATE.GAME_OVER;
          this.gameOverTimer = 1.5;
        }
        return;
      }

      // UPGRADE break
      if (this.state === STATE.UPGRADE) {
        this.cardAnimTimer += rawDt;
        const tap = Input.consumeTap();

        // Card selection
        if (Input.keys['Digit1'] || Input.keys['Numpad1']) {
          this.selectUpgradeCard(0); Input.keys['Digit1'] = false; Input.keys['Numpad1'] = false;
        }
        if (Input.keys['Digit2'] || Input.keys['Numpad2']) {
          this.selectUpgradeCard(1); Input.keys['Digit2'] = false; Input.keys['Numpad2'] = false;
        }
        if (Input.keys['Digit3'] || Input.keys['Numpad3']) {
          this.selectUpgradeCard(2); Input.keys['Digit3'] = false; Input.keys['Numpad3'] = false;
        }

        // Reroll
        if (Input.keys['KeyR'] && !Waves.upgradeChosen && this.rerollsLeft > 0) {
          const newCards = this.buildUpgradeOffer();
          if (newCards.length > 0) {
            Audio.play('ui_click');
            this.rerollsLeft--;
            Waves.upgradeCards = newCards;
            this.cardAnimTimer = 0;
            this.upgradeSelectedIndex = -1;
          }
          Input.keys['KeyR'] = false;
        }
        if (tap && !Waves.upgradeChosen) {
          const within = (p, r) => r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
          let picked = -1;
          for (let i = 0; i < this.upgradeCardBounds.length; i++) {
            if (within(tap, this.upgradeCardBounds[i])) { picked = i; break; }
          }
          if (picked >= 0) {
            this.selectUpgradeCard(picked);
          } else if (within(tap, this.upgradeRerollBounds) && this.rerollsLeft > 0) {
            const newCards = this.buildUpgradeOffer();
            if (newCards.length > 0) {
              Audio.play('ui_click');
              this.rerollsLeft--;
              Waves.upgradeCards = newCards;
              this.cardAnimTimer = 0;
              this.upgradeSelectedIndex = -1;
            }
          }
        }

        // Post-selection countdown
        if (Waves.upgradeChosen) {
          this.upgradeConfirmTimer -= rawDt;
          if (this.upgradeConfirmTimer <= 0) {
            Waves.startWave(this.player);
            this.player.frozen = false;
            this.waveAnnounceTimer = 2.0;
            this.waveAnnounceNum = Waves.waveIndex;
            this._resetTiming = true;
            this.state = STATE.PLAYING;
            Audio.startEngine();
          }
        }

        // Empty pool auto-start
        if (!Waves.upgradeChosen && Waves.upgradeCards.length === 0) {
          this.upgradeConfirmTimer -= rawDt;
          if (this.upgradeConfirmTimer <= 0) {
            Waves.startWave(this.player);
            this.player.frozen = false;
            this.waveAnnounceTimer = 2.0;
            this.waveAnnounceNum = Waves.waveIndex;
            this._resetTiming = true;
            this.state = STATE.PLAYING;
            Audio.startEngine();
          }
        }

        const dt = ScreenFX.update(rawDt);
        Particles.update(dt);
        Camera.update(dt, this.player.x, this.player.y, this.player.vx, this.player.vy, this.player.speed);
        return;
      }

      // PLAYING
      if (Input.pause) {
        this.state = STATE.PAUSED;
        Audio.stopEngine(); Audio.stopDrift();
        if (Audio._musicPlaying && Audio.musicNodes) {
          Audio.musicNodes.gain.gain.value = Audio.muted ? 0 : Audio.musicVolume * 0.3 * 0.3;
        }
        return;
      }

      const dt = ScreenFX.update(rawDt);
      this.time += dt;

      // Player
      this.player.update(dt);
      if (this.player.drifting) this.totalDriftTime += dt;

      // Props collision
      const propHits = Props.checkPlayerCollision(this.player);
      if (propHits.length > 0) Props.handleCollisions(this.player, propHits);
      Props.updatePropCooldowns(dt);
      Props.checkNearMiss(this.player, this);
      Props.checkEnemyCollision(Waves.enemies);

      // Bomb zone damage (from Bomber enemies)
      for (const bz of Waves.bombZones) {
        if (U.dist(this.player.x, this.player.y, bz.x, bz.y) < bz.radius + this.player.radius) {
          this.player.slowTimer = 0.2;
          this.player.slowStrength = CFG.BOMB_ZONE_SLOW;
          if (this.player.invulnTimer <= 0 && this.player.ghostFrameTimer <= 0) {
            const zoneDmg = Math.round(CFG.BOMB_ZONE_DMG * dt);
            if (zoneDmg >= 1) {
              const finalDmg = Math.max(1, Math.round(zoneDmg * (1 - this.player.damageResist)));
              this.player.hp -= finalDmg;
              this.player.lastHitTimer = 0;
            }
          }
        }
      }

      // Camera
      Camera.update(dt, this.player.x, this.player.y, this.player.vx, this.player.vy, this.player.speed);

      // Compute trail midpoint for blocker AI
      if (Trail.count > 10) {
        let sx = 0, sy = 0, cnt = 0;
        const step = Math.max(1, Math.floor(Trail.count / 50));
        for (let i = 0; i < Trail.count; i += step) {
          const pt = Trail.getPoint(i);
          sx += pt.x; sy += pt.y; cnt++;
        }
        this.player._trailMidpoint = { x: sx / cnt, y: sy / cnt };
      } else {
        this.player._trailMidpoint = null;
      }

      // Trail (encirclement)
      Trail.update(dt, this.player);
      if (!this.sandbox) {
        Trail.checkLoop(this.player, Waves.enemies, this);
      }

      // Trail Burn: trail damages enemies that touch it
      if (this.player.trailBurn && Trail.count > 0) {
        for (const e of Waves.enemies) {
          if (!e.alive) continue;
          if ((e._trailBurnCooldown || 0) > 0) { e._trailBurnCooldown -= dt; continue; }
          const step = Math.max(1, Math.floor(Trail.count / 40));
          for (let ti = 0; ti < Trail.count; ti += step) {
            const pt = Trail.getPoint(ti);
            if (U.dist(e.x, e.y, pt.x, pt.y) < 15 + e.radius) {
              e.health--;
              e._trailBurnCooldown = 1.0;
              if (e.health <= 0) {
                e.alive = false;
                enemyDeathFX(e.type, e.x, e.y, false);
                this.enemiesKilled++;
                this.score += 50 * this.player.scoreMult;
                Particles.addFloat(e.x, e.y - 20, 'BURN!', '#FF6600', 14);
              } else {
                e.armored = false;
                Particles.spawn(e.x, e.y, '#FF6600', 4, {
                  vxMin: -80, vxMax: 80, vyMin: -80, vyMax: 80,
                  lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4, type: 'spark',
                });
              }
              break;
            }
          }
        }
      }

      // Tutorial hint: show during wave 1 when enemies exist and no encirclement yet
      if (!this.sandbox && !this.tutorialDismissed && this.waveIndex === 1 && Waves.enemies.length > 0 && this.encircleCount === 0) {
        if (!this.tutorialShown) { this.tutorialShown = true; this.tutorialTimer = 6; }
        if (this.tutorialTimer > 0) this.tutorialTimer -= dt;
        if (this.tutorialTimer <= 0) this.tutorialDismissed = true;
      }
      if (this.encircleCount > 0 && !this.tutorialDismissed) this.tutorialDismissed = true;

      // Handbrake smoke FX
      if (this.player.handbrakeTimer > 0 && Math.random() < 0.6) {
        const cos = Math.cos(this.player.heading), sin = Math.sin(this.player.heading);
        const rearX = this.player.x - cos * CFG.PLAYER_W/2;
        const rearY = this.player.y - sin * CFG.PLAYER_W/2;
        Particles.spawn(rearX, rearY, '#ccc', 3, {
          vxMin: -80, vxMax: 80, vyMin: -80, vyMax: 80,
          lifeMin: 0.3, lifeMax: 0.7, sizeMin: 4, sizeMax: 9, type: 'smoke',
        });
      }

      // Wall riding FX
      if (this.player.wallRiding && Math.random() < 0.5) {
        Particles.spawn(this.player.x, this.player.y, CFG.C_ACCENT, 1, {
          vxMin: -20, vxMax: 20, vyMin: -20, vyMax: 20,
          lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4, type: 'spark',
        });
      }

      // Speed boost streak FX
      if (this.player.speedBoostTimer > 0 && Math.random() < 0.4) {
        const cos = Math.cos(this.player.heading), sin = Math.sin(this.player.heading);
        Particles.spawn(this.player.x - cos * 10, this.player.y - sin * 10, CFG.C_ACCENT, 1, {
          vxMin: -cos * 100, vxMax: -cos * 150, vyMin: -sin * 100, vyMax: -sin * 150,
          lifeMin: 0.15, lifeMax: 0.3, sizeMin: 1, sizeMax: 3, type: 'spark',
        });
      }

      // Drift FX
      if (this.player.drifting) {
        // Skid marks at rear wheels
        const cos = Math.cos(this.player.heading), sin = Math.sin(this.player.heading);
        const rearX = this.player.x - cos * CFG.PLAYER_W/2;
        const rearY = this.player.y - sin * CFG.PLAYER_W/2;
        const perpX = -sin, perpY = cos;
        const color = this.player.slipTimer > 0 ? CFG.C_RARE : '#555';
        Particles.addSkid(rearX + perpX * 6, rearY + perpY * 6, color, 0.6);
        Particles.addSkid(rearX - perpX * 6, rearY - perpY * 6, color, 0.6);

        // Smoke — thicker during drift, color shifts with combo
        const smokeChance = 0.6;
        if (Math.random() < smokeChance) {
          const comboInt = Math.floor(this.player.comboLevel);
          const smokeColor = comboInt >= 5 ? CFG.C_RARE : comboInt >= 3 ? CFG.C_ACCENT : '#bbb';
          Particles.spawn(rearX, rearY, smokeColor, 2, {
            vxMin: -40, vxMax: 40, vyMin: -40, vyMax: 40,
            lifeMin: 0.4, lifeMax: 0.8, sizeMin: 4, sizeMax: 8, type: 'smoke',
          });
        }

        // Drift just started FX
        if (this.player.driftJustStarted) {
          // Drift chain color escalation: cyan -> purple -> gold
          const chainColors = ['#fff', CFG.C_ACCENT, CFG.C_RARE, '#FFD700'];
          const chainColor = chainColors[Math.min(this.player.driftChain, 3)] || '#fff';
          Particles.spawn(rearX, rearY, chainColor, 6 + this.player.driftChain * 3, {
            vxMin: -80, vxMax: 80, vyMin: -80, vyMax: 80,
            lifeMin: 0.15, lifeMax: 0.3, sizeMin: 2, sizeMax: 4 + this.player.driftChain, type: 'smoke',
          });
          ScreenFX.zoom(1.03 + this.player.driftChain * 0.01, 0.1);
          // Tire chirp visual
          Particles.spawn(rearX + perpX * 6, rearY + perpY * 6, chainColor, 2, {
            vxMin: -20, vxMax: 20, vyMin: -20, vyMax: 20,
            lifeMin: 0.1, lifeMax: 0.15, sizeMin: 2, sizeMax: 3, type: 'spark',
          });
          if (this.player.driftChain >= 1) {
            const chainLabel = this.player.driftChain >= 2 ? 'CHAIN x2!' : 'CHAIN!';
            Particles.addFloat(this.player.x, this.player.y - 35, chainLabel, chainColor, 14);
          }
        }
      }

      // Drift denied text
      if (this.player.driftDeniedTimer > 0 && this.player.driftDeniedTimer > 0.1) {
        Particles.addFloat(this.player.x, this.player.y - 30, 'NEED SPEED', CFG.C_PICKUP, 12);
        this.player.driftDeniedTimer = 0; // only once
      }

      // Wall hit sparks
      if (this.player.wallHit) {
        Particles.spawn(this.player.x, this.player.y, CFG.C_PICKUP, 5, {
          vxMin: -100, vxMax: 100, vyMin: -100, vyMax: 100,
          lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4, type: 'spark',
        });
      }

      // Brake rear lights streak
      if (this.player.braking && this.player.speed > 50) {
        const cos = Math.cos(this.player.heading), sin = Math.sin(this.player.heading);
        const rearX = this.player.x - cos * CFG.PLAYER_W/2;
        const rearY = this.player.y - sin * CFG.PLAYER_W/2;
        Particles.spawn(rearX, rearY, '#F44', 1, {
          vxMin: -cos * 20, vxMax: -cos * 40, vyMin: -sin * 20, vyMax: -sin * 40,
          lifeMin: 0.08, lifeMax: 0.12, sizeMin: 2, sizeMax: 3, type: 'spark',
        });
      }

      // Sandbox mode: skip waves, scoring, collisions
      if (!this.sandbox) {

      // Waves
      this.waveTimer = Waves.waveTimer;
      this.waveIndex = Waves.waveIndex;
      this.phase = Waves.phase;

      const scrapResult = Waves.update(dt, this.player, this.score, this);
      const pickupEvents = scrapResult ? (Array.isArray(scrapResult) ? scrapResult : [scrapResult]) : [];
      for (const event of pickupEvents) {
        if (event === 'scrap') {
        Particles.spawn(this.player.x, this.player.y, CFG.C_PICKUP, 8, {
          vxMin: -60, vxMax: 60, vyMin: -60, vyMax: 60,
          lifeMin: 0.2, lifeMax: 0.5, sizeMin: 2, sizeMax: 4, type: 'spark',
        });
        Particles.addFloat(this.player.x, this.player.y - 20, '+SCRAP', CFG.C_PICKUP, 14);
        } else if (event === 'speed_pickup') {
        this.player.speedBoostTimer = CFG.BOOST_ZONE_DURATION;
        Particles.spawn(this.player.x, this.player.y, CFG.C_ACCENT, 10, {
          vxMin: -70, vxMax: 70, vyMin: -70, vyMax: 70,
          lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 4, type: 'spark',
        });
        Particles.addFloat(this.player.x, this.player.y - 20, 'SPEED!', CFG.C_ACCENT, 16);
        } else if (event === 'trail_boost') {
        // Temporarily increase trail length
        Trail.MAX_POINTS = Math.min(800, Trail.MAX_POINTS + 200);
        Particles.spawn(this.player.x, this.player.y, CFG.C_RARE, 10, {
          vxMin: -60, vxMax: 60, vyMin: -60, vyMax: 60,
          lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 5, type: 'spark',
        });
        Particles.addFloat(this.player.x, this.player.y - 20, 'TRAIL+', CFG.C_RARE, 16);
        } else if (event === 'bomb') {
        // Kill all on-screen enemies
        let bombKills = 0;
        for (const e of Waves.enemies) {
          if (!e.alive) continue;
          if (Camera.isVisible(e.x, e.y, 50)) {
            e.alive = false;
            bombKills++;
            enemyDeathFX(e.type, e.x, e.y, false);
          }
        }
        ScreenFX.flash('#fff', 0.3, 0.2);
        ScreenFX.shake(12, 0.4);
        Particles.addFloat(this.player.x, this.player.y - 30, `BOMB! x${bombKills}`, '#FF4444', 22);
        this.score += bombKills * 50 * this.player.scoreMult;
        this.enemiesKilled += bombKills;
        } else if (event === 'boost') {
        this.player.speedBoostTimer = CFG.BOOST_ZONE_DURATION;
        Particles.spawn(this.player.x, this.player.y, CFG.C_ACCENT, 12, {
          vxMin: -80, vxMax: 80, vyMin: -80, vyMax: 80,
          lifeMin: 0.3, lifeMax: 0.6, sizeMin: 2, sizeMax: 5, type: 'spark',
        });
        Particles.addFloat(this.player.x, this.player.y - 20, 'SPEED BOOST!', CFG.C_ACCENT, 16);
        ScreenFX.zoom(1.04, 0.15);
      }
      }

      // Check for upgrade break transition
      if (Waves.phase === 'break' && this.state === STATE.PLAYING) {
        this.state = STATE.UPGRADE;
        this.rerollsLeft = CFG.REROLL_MAX + this.player.upgrades.filter(u => u === 'extra_rerolls').length * 2;
        this.upgradeConfirmTimer = CFG.UPGRADE_CONFIRM_TIME;
        this.cardAnimTimer = 0;
        this.upgradeSelectedIndex = -1;
        this.player.frozen = true;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.drifting = false;
        this.player.handbrakeTimer = 0;
        this.player.driftTime = 0;
        this.player.leanTimer = 0;
        this.player.exhaustTimer = 0;
        this.player.wallRiding = false;
        this.player.driftChain = 0;
      }

      // Scoring
      this.score += CFG.SCORE_PER_SEC * dt * this.player.scoreMult;

      // Drift combo scoring
      if (this.player.drifting) {
        const ticks = Math.floor(this.player.driftTime / CFG.DRIFT_COMBO_INTERVAL);
        if (ticks > this.lastDriftComboTick) {
          const pts = CFG.DRIFT_COMBO_BASE * Math.floor(this.player.comboLevel + 1);
          this.score += pts;
          this.lastDriftComboTick = ticks;
          Particles.addFloat(this.player.x, this.player.y - 25, `+${pts}`, CFG.C_ACCENT, 14);
        }
      } else {
        this.lastDriftComboTick = 0;
      }

      // Collision: enemies
      const pRadius = this.player.radius - (this.player.upgrades.includes('thick_plating') ? 3 : 0);
      for (const e of Waves.enemies) {
        if (!e.alive) continue;
        const d = U.dist(this.player.x, this.player.y, e.x, e.y);
        const eRadius = e.radius || CFG.ENEMY_RADIUS;
        const collDist = pRadius + eRadius;
        const nearDist = pRadius + eRadius + CFG.NEAR_MISS_ENEMY;

        if (d < collDist) {
          if (this.player.invulnTimer > 0 || this.player.ghostFrameTimer > 0) continue;

          // Determine damage (scales after wave 5)
          const dmgMap = { chaser: CFG.DMG_CHASER, interceptor: CFG.DMG_INTERCEPTOR,
                           drifter: CFG.DMG_DRIFTER, elite: CFG.DMG_ELITE,
                           blocker: CFG.DMG_BLOCKER, flanker: CFG.DMG_FLANKER, bomber: CFG.DMG_BOMBER };
          let baseDmg = dmgMap[e.type] || CFG.DMG_CHASER;
          const waveScale = Waves.waveIndex > 5
            ? Math.min(CFG.DMG_SCALE_MAX, 1 + CFG.DMG_SCALE_PER_WAVE * (Waves.waveIndex - 5))
            : 1;
          let dmg = Math.round(baseDmg * waveScale);

          // Shield absorbs hit completely
          if (this.player.shield) {
            this.shieldBreak(e);
            continue;
          }

          // Apply damage
          this.playerHit(e, dmg);
          if (this.state === STATE.DYING) return;
        } else if (d < nearDist && this.player.drifting && e.nearMissCooldown <= 0) {
          // Near miss!
          this.nearMiss(e, 'enemy');
          e.nearMissCooldown = CFG.NEAR_MISS_COOLDOWN;
        }
      }

      // Enemy wall hit sparks
      for (const e of Waves.enemies) {
        if (e.wallHit) {
          Particles.spawn(e.x, e.y, CFG.C_ENEMY, 3, {
            vxMin: -60, vxMax: 60, vyMin: -60, vyMax: 60,
            lifeMin: 0.15, lifeMax: 0.3, sizeMin: 2, sizeMax: 3, type: 'spark',
          });
        }
        // Enemy drift FX
        if (e.drifting) {
          const cos = Math.cos(e.heading), sin = Math.sin(e.heading);
          const rearX = e.x - cos * CFG.ENEMY_W/2;
          const rearY = e.y - sin * CFG.ENEMY_W/2;
          Particles.addSkid(rearX, rearY, '#522', 0.4);
        }
      }

      // Progressive intensity
      if (this.score >= 500 && Waves.cadenceMult === 1) Waves.cadenceMult = 0.9;
      this.speedBonusFromScore = Math.min(120, Math.max(0, Math.floor((this.score - 2000) / 500) * 12));
      this.speedBonus = this.speedBonusFromScore + this.speedBonusFromUpgrades;
      // Enemy glow increase
      const glowBonus = Math.min(20, Math.floor(this.score / 500) * 3);
      for (const e of Waves.enemies) e.glowExtra = glowBonus;

      // Milestone
      if (this.score >= this.milestoneScore) {
        this.milestoneTimer = 0.57;
        this.milestoneText = `MILESTONE ${this.milestoneScore}`;
        ScreenFX.flash(CFG.C_RARE, 0.18, 0.18);
        ScreenFX.zoom(1.04, 0.12);
        this.milestoneScore += 250;
      }
      if (this.milestoneTimer > 0) this.milestoneTimer -= dt;

      // Wave announce timer
      if (this.waveAnnounceTimer > 0) this.waveAnnounceTimer -= dt;
      if (this.hordeAnnounceTimer > 0) this.hordeAnnounceTimer -= dt;

      // New best detection
      if (this.score > this.highScore) this.newBest = true;

      } // end sandbox skip

      // Particles
      Particles.update(dt);
    },

    checkComboMilestone(oldLevel, newLevel) {
      const Audio = window.Audio;
      const Particles = window.Particles;
      const ScreenFX = window.ScreenFX;
      const milestones = [3, 5, 8];
      for (const m of milestones) {
        if (Math.floor(oldLevel) < m && Math.floor(newLevel) >= m) {
          Audio.play('combo_sting');
          Particles.addRing(this.player.x, this.player.y, m >= 8 ? '#FFD700' : m >= 5 ? CFG.C_RARE : CFG.C_ACCENT);
          ScreenFX.flash(CFG.C_ACCENT, 0.12, 0.1);
          Particles.addFloat(this.player.x, this.player.y - 50, `x${m} COMBO!`,
            m >= 8 ? '#FFD700' : m >= 5 ? CFG.C_RARE : CFG.C_ACCENT, 22);
          ScreenFX.zoom(1.05, 0.15);
          if (this.player.comboHeal) {
            const healAmt = m >= 8 ? 25 : m >= 5 ? 15 : 10;
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmt);
            Particles.addFloat(this.player.x, this.player.y - 60, `+${healAmt} HP`, '#44FF44', 16);
          }
          break;
        }
      }
    },

    nearMiss(target, type) {
      const Audio = window.Audio;
      const Particles = window.Particles;
      const ScreenFX = window.ScreenFX;
      const Waves = window.Waves;

      Audio.play('near_miss');
      this.nearMissTotal++;
      const pts = type === 'enemy' ? CFG.NEAR_MISS_ENEMY_PTS : CFG.NEAR_MISS_HAZARD_PTS;
      this.score += pts * this.player.scoreMult;
      const oldCombo = this.player.comboLevel;
      this.player.comboLevel = Math.min(CFG.MAX_COMBO, this.player.comboLevel + 1);
      this.peakCombo = Math.max(this.peakCombo, Math.floor(this.player.comboLevel));
      this.checkComboMilestone(oldCombo, this.player.comboLevel);

      // Near-miss streak
      this.player.consecutiveNearMisses++;
      this.player.nearMissStreakTimer = 2.0;
      if (this.player.consecutiveNearMisses >= 3) {
        const streakBonus = 50 * this.player.consecutiveNearMisses;
        this.score += streakBonus * this.player.scoreMult;
        this.player.invulnTimer = Math.max(this.player.invulnTimer, 0.3);
        Particles.addFloat(this.player.x, this.player.y - 50, `STREAK x${this.player.consecutiveNearMisses}! +${streakBonus}`, '#FFD700', 18);
        ScreenFX.flash('#FFD700', 0.15, 0.1);
      }

      // FX
      ScreenFX.slowmo(0.85, 0.15);
      const ringColor = type === 'enemy' ? CFG.C_ENEMY : CFG.C_PICKUP;
      Particles.addRing(this.player.x, this.player.y, ringColor);
      ScreenFX.flash('#fff', 0.1, 0.08);
      Particles.addFloat(this.player.x, this.player.y - 30,
        `+${pts} CLOSE!`, ringColor, 16);

      // Ghost frame upgrade
      if (this.player.upgrades.includes('ghost_frame')) {
        this.player.ghostFrameTimer = 0.3;
      }

      // Scrap bonus chance
      if (Math.random() < CFG.SCRAP_NEAR_MISS_CHANCE) {
        Waves.scraps.push({
          x: this.player.x + U.randFloat(-40, 40),
          y: this.player.y + U.randFloat(-40, 40),
          life: 10, bobPhase: 0,
        });
      }
    },

    shieldBreak(source) {
      const Audio = window.Audio;
      const Particles = window.Particles;
      const ScreenFX = window.ScreenFX;

      this.player.shield = false;
      this.player.invulnTimer = CFG.SHIELD_INVULN;

      // Knockback
      const dx = this.player.x - source.x;
      const dy = this.player.y - source.y;
      const d = Math.hypot(dx, dy) || 1;
      this.player.vx += (dx / d) * CFG.SHIELD_KNOCKBACK;
      this.player.vy += (dy / d) * CFG.SHIELD_KNOCKBACK;

      // FX
      ScreenFX.flash(CFG.C_SHIELD, 0.2, 0.15);
      ScreenFX.shake(6, 0.22, dx / d, dy / d);
      Particles.spawn(this.player.x, this.player.y, CFG.C_SHIELD, 12, {
        vxMin: -150, vxMax: 150, vyMin: -150, vyMax: 150,
        lifeMin: 0.3, lifeMax: 0.6, sizeMin: 3, sizeMax: 6, type: 'spark',
      });
      Particles.addFloat(this.player.x, this.player.y - 30, 'SHIELD BREAK!', CFG.C_SHIELD, 18);
      Audio.play('collision');
    },

    playerHit(source, dmg) {
      const Audio = window.Audio;
      const Particles = window.Particles;
      const ScreenFX = window.ScreenFX;

      // Apply damage resistance
      dmg = Math.round(dmg * (1 - (this.player.damageResist || 0)));
      if (this.player.driftShield && this.player.drifting) dmg = Math.round(dmg * 0.6);
      dmg = Math.max(dmg, 1);

      this.player.hp -= dmg;
      Audio.play('collision');
      this.player.invulnTimer = CFG.HIT_INVULN;
      this.player.lastHitTimer = 0;

      // Knockback
      const dx = this.player.x - source.x;
      const dy = this.player.y - source.y;
      const d = Math.hypot(dx, dy) || 1;
      this.player.vx += (dx / d) * CFG.HIT_KNOCKBACK;
      this.player.vy += (dy / d) * CFG.HIT_KNOCKBACK;

      // FX
      ScreenFX.flash(CFG.C_ENEMY, 0.15, 0.12);
      ScreenFX.shake(7, 0.18, dx / d, dy / d);
      ScreenFX.slowmo(0.9, 0.1);
      Particles.spawn(this.player.x, this.player.y, CFG.C_ENEMY, 6, {
        vxMin: -100, vxMax: 100, vyMin: -100, vyMax: 100,
        lifeMin: 0.2, lifeMax: 0.5, sizeMin: 2, sizeMax: 5, type: 'spark',
      });
      Particles.addFloat(this.player.x, this.player.y - 30, `-${dmg}`, CFG.C_ENEMY, 16);

      // Check death
      if (this.player.hp <= 0) {
        this.player.hp = 0;
        this.deathCause = `HIT BY ${source.type.toUpperCase()}`;
        this.die();
      }
    },

    die() {
      const Audio = window.Audio;
      const ScreenFX = window.ScreenFX;
      const Particles = window.Particles;

      this.state = STATE.DYING;
      Audio.stopEngine(); Audio.stopDrift(); Audio.fadeOutMusic(0.5);
      this.deathPhase = 0;
      this.deathTimer = CFG.FREEZE_TIME;
      ScreenFX.freeze(CFG.FREEZE_TIME);
      if (this.deathCause) {
        Particles.addFloat(this.player.x, this.player.y - 40, this.deathCause, CFG.C_ENEMY, 16);
      }
    },

    selectUpgradeCard(index) {
      const Audio = window.Audio;
      const Waves = window.Waves;
      if (index < 0 || index >= Waves.upgradeCards.length) return;
      if (Waves.upgradeChosen) return;
      Audio.play('ui_click');
      this.applyUpgrade(Waves.upgradeCards[index]);
      Waves.upgradeChosen = true;
      this.upgradeSelectedIndex = index;
      this.upgradeConfirmTimer = CFG.UPGRADE_CONFIRM_TIME;
    },

    render(ctx) {
      const ScreenFX = window.ScreenFX;
      const Camera = window.Camera;
      const FXCache = window.FXCache;
      const Waves = window.Waves;
      const Props = window.Props;
      const Particles = window.Particles;
      const Trail = window.Trail;
      const Audio = window.Audio;
      const Input = window.Input;
      const ARENA_UPGRADES = window.ARENA_UPGRADES;

      if (this.state === STATE.MENU) {
        this.renderMenu(ctx);
        return;
      }
      if (this.state === STATE.MAP_SELECT) {
        this.renderMapSelect(ctx);
        return;
      }

      ScreenFX.applyPre(ctx);

      // Camera transform - world space rendering
      ctx.save();
      ctx.translate(CFG.W / 2, CFG.H / 2);
      ctx.scale(Camera.zoom, Camera.zoom);
      ctx.translate(-Camera.x, -Camera.y);

      // Arena
      Waves.renderArena(ctx, this.time);

      // Props (under skid marks and entities)
      Props.render(ctx);

      // Skid marks (layer under entities)
      Particles.renderSkids(ctx);

      // Trail (encirclement line)
      Trail.render(ctx);

      // Scraps
      Waves.renderScraps(ctx);

      // Boost zones
      Waves.renderBoostZones(ctx);

      // Bomb zones (hazard areas from Bomber enemies)
      Waves.renderBombZones(ctx);

      // Enemies
      Waves.renderEnemies(ctx, this.time);

      // Player (unless dying phase 1+)
      if (this.state !== STATE.DYING || this.deathPhase === 0) {
        this.player.render(ctx);
      }

      // Particles
      Particles.renderParticles(ctx);
      Particles.renderRings(ctx);
      Particles.renderFloats(ctx);

      ctx.restore(); // end camera transform

      ScreenFX.applyPost(ctx);

      // Vignette (screen space, pre-rendered)
      if (FXCache.vignetteCanvas) {
        ctx.drawImage(FXCache.vignetteCanvas, 0, 0);
      }

      // Speed lines (screen space, at >70% max speed)
      {
        const speedFrac = this.player.speed / (this.player.maxSpeed || CFG.MAX_SPEED);
        if (speedFrac > 0.7 && this.state !== STATE.DYING) {
          const intensity = (speedFrac - 0.7) / 0.3; // 0..1
          const lineCount = Math.floor(6 + intensity * 8);
          ctx.save();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          const heading = this.player.heading;
          for (let i = 0; i < lineCount; i++) {
            const seed = (this.time * 3 + i * 7.13) % 1;
            const perpOff = (i / lineCount - 0.5) * CFG.H * 1.2;
            const len = S(40 + intensity * 60);
            const sx = CFG.W / 2 + Math.cos(heading + Math.PI) * seed * CFG.W * 0.6 - Math.sin(heading) * perpOff;
            const sy = CFG.H / 2 + Math.sin(heading + Math.PI) * seed * CFG.H * 0.6 + Math.cos(heading) * perpOff;
            ctx.globalAlpha = intensity * 0.15 * (1 - seed);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx - Math.cos(heading) * len, sy - Math.sin(heading) * len);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          ctx.restore();
        }
      }

      // Chromatic aberration at edges (high speed or dying)
      {
        const speedFrac = this.player.speed / (this.player.maxSpeed || CFG.MAX_SPEED);
        const abIntensity = this.state === STATE.DYING ? 0.4 : (speedFrac > 0.8 ? (speedFrac - 0.8) * 2 : 0);
        if (abIntensity > 0.01) {
          const off = S(2 + abIntensity * 4);
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          // Red tint left edge
          ctx.fillStyle = `rgba(255,50,50,${abIntensity * 0.08})`;
          ctx.fillRect(0, 0, S(60), CFG.H);
          // Blue tint right edge
          ctx.fillStyle = `rgba(50,50,255,${abIntensity * 0.08})`;
          ctx.fillRect(CFG.W - S(60), 0, S(60), CFG.H);
          ctx.globalCompositeOperation = 'source-over';
          ctx.restore();
        }
      }

      // HUD
      if (this.state !== STATE.DYING) {
        renderHUD(ctx, this);
      }

      // Off-screen enemy indicators (screen space)
      if (this.state === STATE.PLAYING || this.state === STATE.UPGRADE) {
        this.renderOffscreenIndicators(ctx);
      }

      // Minimap (top-right corner, screen space)
      if ((this.state === STATE.PLAYING || this.state === STATE.UPGRADE) && !this.sandbox) {
        this.renderMinimap(ctx);
      }

      // Wave announce banner
      if (this.waveAnnounceTimer > 0) {
        const fadeIn = Math.min(1, (2.0 - this.waveAnnounceTimer) / 0.3);
        const fadeOut = Math.min(1, this.waveAnnounceTimer / 0.3);
        const alpha = Math.min(fadeIn, fadeOut);
        // Slide-in from top
        const slideY = S(70) - (1 - fadeIn) * S(40);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        U.roundRect(ctx, CFG.W/2 - S(100), slideY - S(18), S(200), S(36), S(6));
        ctx.fill();
        U.text(ctx, `WAVE ${this.waveAnnounceNum}`, CFG.W/2, slideY, {
          align: 'center', color: CFG.C_ACCENT, size: 26, bold: true, shadow: true
        });
        ctx.globalAlpha = 1;
      }

      // Milestone banner
      if (this.milestoneTimer > 0) {
        ctx.globalAlpha = U.clamp(this.milestoneTimer / 0.35, 0, 1);
        U.text(ctx, this.milestoneText, CFG.W/2, S(100), {
          align: 'center', color: CFG.C_RARE, size: 28, bold: true, shadow: true
        });
        ctx.globalAlpha = 1;
      }

      // Horde announce banner
      if (this.hordeAnnounceTimer > 0) {
        const dur = CFG.HORDE_DELAY + 0.5;
        const fadeIn = Math.min(1, (dur - this.hordeAnnounceTimer) / 0.2);
        const fadeOut = Math.min(1, this.hordeAnnounceTimer / 0.3);
        const alpha = Math.min(fadeIn, fadeOut);
        const pulse = 1 + 0.05 * Math.sin(this.hordeAnnounceTimer * 12);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(60,0,0,0.7)';
        U.roundRect(ctx, CFG.W/2 - S(140), S(160) - S(22), S(280), S(44), S(8));
        ctx.fill();
        ctx.save();
        ctx.translate(CFG.W/2, S(160));
        ctx.scale(pulse, pulse);
        U.text(ctx, 'HORDE INCOMING!', 0, 0, {
          align: 'center', color: CFG.C_ENEMY, size: 32, bold: true, shadow: true
        });
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // Tutorial hint
      if (this.tutorialShown && !this.tutorialDismissed && this.tutorialTimer > 0) {
        const alpha = Math.min(1, this.tutorialTimer / 0.5, (6 - this.tutorialTimer) / 0.5);
        ctx.globalAlpha = alpha * 0.9;
        const ty = CFG.H * 0.18;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        U.roundRect(ctx, CFG.W/2 - S(220), ty - S(16), S(440), S(32), S(6));
        ctx.fill();
        U.text(ctx, 'DRIVE A CIRCLE AROUND ENEMIES TO KILL THEM', CFG.W/2, ty, {
          align: 'center', color: CFG.C_ACCENT, size: 15, bold: true, shadow: true
        });
        ctx.globalAlpha = 1;
      }

      // Upgrade break overlay
      if (this.state === STATE.UPGRADE) {
        const upgradeBounds = renderUpgradeBreak(ctx, Waves.upgradeCards, this.cardAnimTimer, this.upgradeSelectedIndex,
          this.rerollsLeft, Waves.upgradeChosen, this.upgradeConfirmTimer, Waves.waveIndex);
        if (upgradeBounds) {
          this.upgradeCardBounds = upgradeBounds.cardBounds || [];
          this.upgradeRerollBounds = upgradeBounds.rerollBounds || null;
        } else {
          this.upgradeCardBounds = [];
          this.upgradeRerollBounds = null;
        }
      }

      // Paused overlay
      if (this.state === STATE.PAUSED) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, CFG.W, CFG.H);
        U.text(ctx, 'PAUSED', CFG.W/2, CFG.H/2 - S(60), { align: 'center', color: CFG.C_TEXT, size: 40, bold: true, shadow: true });
        U.text(ctx, 'P / Esc to resume', CFG.W/2, CFG.H/2 - S(20), { align: 'center', color: '#888', size: 16 });
        // Controls reminder
        U.text(ctx, 'WASD: Drive  |  SPACE: Drift  |  S+brake: Handbrake  |  Loop around enemies to kill', CFG.W/2, CFG.H/2 + S(10), {
          align: 'center', color: '#555', size: 11
        });

        // Collected upgrades with names
        const ups = this.player.upgrades;
        if (ups.length > 0) {
          U.text(ctx, 'UPGRADES', CFG.W/2, CFG.H/2 + S(40), { align: 'center', color: '#888', size: 13, bold: true });
          const upNames = ups.map(id => {
            const u = ARENA_UPGRADES.find(a => a.id === id);
            return u ? u.name : id;
          });
          // Display in rows of up to 3
          for (let i = 0; i < upNames.length; i += 3) {
            const row = upNames.slice(i, i + 3).join('  |  ');
            U.text(ctx, row, CFG.W/2, CFG.H/2 + S(58) + Math.floor(i / 3) * S(18), {
              align: 'center', color: CFG.C_ACCENT, size: 12
            });
          }
        }

        // Difficulty indicator
        if (!this.sandbox) {
          const diffY = CFG.H/2 + S(ups.length > 0 ? 100 + Math.ceil(ups.length / 3) * 18 : 50);
          U.text(ctx, `Wave ${this.waveIndex}  |  Enemy speed bonus: +${this.speedBonus}`, CFG.W/2, diffY, {
            align: 'center', color: '#555', size: 11
          });
        }

        // Audio controls
        const audioY = CFG.H - S(90);
        U.text(ctx, `[M] MUTE: ${Audio.muted ? 'ON' : 'OFF'}`, CFG.W/2, audioY, {
          align: 'center', color: Audio.muted ? CFG.C_ENEMY : '#888', size: 12
        });
        // SFX volume bar
        const barW = S(100), barH = S(10), barX = CFG.W/2 - barW/2;
        U.text(ctx, 'SFX  [ ] ]', CFG.W/2 - S(80), audioY + S(20), { align: 'left', color: '#666', size: 11 });
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, audioY + S(16), barW, barH);
        ctx.fillStyle = CFG.C_ACCENT;
        ctx.fillRect(barX, audioY + S(16), barW * Audio.sfxVolume, barH);
        U.text(ctx, `${Math.round(Audio.sfxVolume * 100)}%`, CFG.W/2 + barW/2 + S(10), audioY + S(20), { align: 'left', color: '#888', size: 10 });
        // Music volume bar
        U.text(ctx, 'MUSIC  - =', CFG.W/2 - S(80), audioY + S(38), { align: 'left', color: '#666', size: 11 });
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, audioY + S(34), barW, barH);
        ctx.fillStyle = CFG.C_ACCENT;
        ctx.fillRect(barX, audioY + S(34), barW * Audio.musicVolume, barH);
        U.text(ctx, `${Math.round(Audio.musicVolume * 100)}%`, CFG.W/2 + barW/2 + S(10), audioY + S(38), { align: 'left', color: '#888', size: 10 });
      }

      // Game over
      if (this.state === STATE.GAME_OVER && this.gameOverTimer <= 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(0, 0, CFG.W, CFG.H);

        U.text(ctx, 'GAME OVER', CFG.W/2, CFG.H * 0.25, { align: 'center', color: CFG.C_ENEMY, size: 48, bold: true, shadow: true });

        const sy = CFG.H * 0.4;
        const col = S(60);
        U.text(ctx, 'SCORE', CFG.W/2 - col, sy, { align: 'right', color: '#888', size: 16 });
        U.text(ctx, Math.floor(this.score).toLocaleString(), CFG.W/2, sy, { align: 'left', color: CFG.C_TEXT, size: 20, bold: true });

        U.text(ctx, 'BEST', CFG.W/2 - col, sy + S(30), { align: 'right', color: '#888', size: 16 });
        U.text(ctx, this.highScore.toLocaleString(), CFG.W/2, sy + S(30), { align: 'left', color: this.newBest ? CFG.C_PICKUP : CFG.C_TEXT, size: 20, bold: true });

        U.text(ctx, 'WAVE', CFG.W/2 - col, sy + S(60), { align: 'right', color: '#888', size: 16 });
        U.text(ctx, `${this.waveIndex}`, CFG.W/2, sy + S(60), { align: 'left', color: CFG.C_TEXT, size: 20, bold: true });

        U.text(ctx, 'ENCIRCLED', CFG.W/2 - col, sy + S(90), { align: 'right', color: '#888', size: 16 });
        U.text(ctx, `${this.encircleCount}`, CFG.W/2, sy + S(90), { align: 'left', color: CFG.C_ACCENT, size: 20, bold: true });

        U.text(ctx, 'TIME', CFG.W/2 - col, sy + S(120), { align: 'right', color: '#888', size: 16 });
        U.text(ctx, `${Math.floor(this.time)}s`, CFG.W/2, sy + S(120), { align: 'left', color: CFG.C_TEXT, size: 20, bold: true });

        U.text(ctx, 'PEAK COMBO', CFG.W/2 - col, sy + S(150), { align: 'right', color: '#888', size: 16 });
        U.text(ctx, `x${this.peakCombo}`, CFG.W/2, sy + S(150), { align: 'left', color: CFG.C_ACCENT, size: 20, bold: true });

        U.text(ctx, 'NEAR MISSES', CFG.W/2 - col, sy + S(180), { align: 'right', color: '#888', size: 16 });
        U.text(ctx, `${this.nearMissTotal}`, CFG.W/2, sy + S(180), { align: 'left', color: CFG.C_TEXT, size: 20, bold: true });

        U.text(ctx, 'DRIFT TIME', CFG.W/2 - col, sy + S(210), { align: 'right', color: '#888', size: 16 });
        U.text(ctx, `${Math.floor(this.totalDriftTime)}s`, CFG.W/2, sy + S(210), { align: 'left', color: CFG.C_TEXT, size: 20, bold: true });

        U.text(ctx, 'ENEMIES KILLED', CFG.W/2 - col, sy + S(240), { align: 'right', color: '#888', size: 16 });
        U.text(ctx, `${this.enemiesKilled}`, CFG.W/2, sy + S(240), { align: 'left', color: CFG.C_ENEMY, size: 20, bold: true });

        // Active modifiers and score multiplier
        const activeModNames = [];
        let totalMult = 1;
        if (this.modifiers.hardMode) { activeModNames.push('HARD'); totalMult *= 1.5; }
        if (this.modifiers.speedRush) { activeModNames.push('RUSH'); totalMult *= 1.3; }
        if (this.modifiers.fragile) { activeModNames.push('FRAGILE'); totalMult *= 1.4; }
        if (this.modifiers.doubleEnemies) { activeModNames.push('DOUBLE'); totalMult *= 1.6; }
        if (activeModNames.length > 0) {
          U.text(ctx, 'MODIFIERS', CFG.W/2 - col, sy + S(270), { align: 'right', color: '#888', size: 16 });
          U.text(ctx, activeModNames.join(' + ') + ` (${totalMult.toFixed(1)}x)`, CFG.W/2, sy + S(270), { align: 'left', color: CFG.C_ACCENT, size: 16, bold: true });
        }

        const modOffset = activeModNames.length > 0 ? S(30) : 0;

        if (this.newBest) {
          U.text(ctx, 'NEW BEST!', CFG.W/2, sy + S(275) + modOffset, { align: 'center', color: CFG.C_PICKUP, size: 22, bold: true, shadow: true });
        }

        // Upgrades taken
        const ups = this.player.upgrades;
        if (ups.length > 0) {
          U.text(ctx, 'UPGRADES:', CFG.W/2, sy + S(305) + modOffset, { align: 'center', color: '#666', size: 12 });
          const upStr = ups.map(id => {
            const u = ARENA_UPGRADES.find(a => a.id === id);
            return u ? u.icon : '?';
          }).join('  ');
          U.text(ctx, upStr, CFG.W/2, sy + S(325) + modOffset, { align: 'center', color: CFG.C_ACCENT, size: 20, bold: true });
        }

        // Death cause
        if (this.deathCause) {
          U.text(ctx, this.deathCause, CFG.W/2, sy + S(345) + modOffset, { align: 'center', color: '#666', size: 13 });
        }

        if (Math.floor(this.menuAnim * 2) % 2 === 0) {
          U.text(ctx, 'ENTER to menu  |  R to restart', CFG.W/2, CFG.H - S(50), { align: 'center', color: CFG.C_ACCENT, size: 18, bold: true, shadow: true });
        }
      }

      // Touch controls overlay
      this.renderTouchUI(ctx);
    },

    renderOffscreenIndicators(ctx) {
      const Camera = window.Camera;
      const Waves = window.Waves;
      // Collect which screen edges have offscreen enemies
      const sides = { left: false, right: false, top: false, bottom: false };
      for (const e of Waves.enemies) {
        if (!e.alive) continue;
        if (Camera.isVisible(e.x, e.y, 0)) continue;
        const sx = e.x - Camera.x + CFG.W / 2;
        const sy = e.y - Camera.y + CFG.H / 2;
        if (sx < 0) sides.left = true;
        if (sx > CFG.W) sides.right = true;
        if (sy < 0) sides.top = true;
        if (sy > CFG.H) sides.bottom = true;
      }
      // Flash red bar on each active edge (dark border + red fill for contrast)
      const flash = 0.55 + 0.15 * Math.sin(performance.now() * 0.008);
      const barW = S(32);
      const borderW = barW + S(4);
      // Dark border behind bars
      ctx.fillStyle = '#000';
      ctx.globalAlpha = flash * 0.6;
      if (sides.left)   ctx.fillRect(0, 0, borderW, CFG.H);
      if (sides.right)  ctx.fillRect(CFG.W - borderW, 0, borderW, CFG.H);
      if (sides.top)    ctx.fillRect(0, 0, CFG.W, borderW);
      if (sides.bottom) ctx.fillRect(0, CFG.H - borderW, CFG.W, borderW);
      // Red bars
      ctx.fillStyle = CFG.C_ENEMY;
      ctx.globalAlpha = flash;
      if (sides.left)   ctx.fillRect(0, 0, barW, CFG.H);
      if (sides.right)  ctx.fillRect(CFG.W - barW, 0, barW, CFG.H);
      if (sides.top)    ctx.fillRect(0, 0, CFG.W, barW);
      if (sides.bottom) ctx.fillRect(0, CFG.H - barW, CFG.W, barW);
      ctx.globalAlpha = 1;
    },

    renderMinimap(ctx) {
      const Camera = window.Camera;
      const Waves = window.Waves;
      const mmW = S(80), mmH = S(80);
      const mx = CFG.W - mmW - S(10), my = CFG.H - mmH - S(30);
      const sx = mmW / CFG.WORLD_W, sy = mmH / CFG.WORLD_H;

      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#000';
      ctx.fillRect(mx, my, mmW, mmH);
      ctx.strokeStyle = CFG.C_PANEL;
      ctx.lineWidth = 1;
      ctx.strokeRect(mx, my, mmW, mmH);
      ctx.globalAlpha = 0.8;

      // Enemies as red dots
      for (const e of Waves.enemies) {
        if (!e.alive) continue;
        ctx.fillStyle = CFG.C_ENEMY;
        ctx.fillRect(mx + e.x * sx - S(1), my + e.y * sy - S(1), S(2), S(2));
      }

      // Player as cyan dot
      ctx.fillStyle = CFG.C_ACCENT;
      ctx.fillRect(mx + this.player.x * sx - S(2), my + this.player.y * sy - S(2), S(4), S(4));

      // Viewport rect
      ctx.strokeStyle = CFG.C_ACCENT;
      ctx.globalAlpha = 0.3;
      const vx = (Camera.x - CFG.W / 2) * sx;
      const vy = (Camera.y - CFG.H / 2) * sy;
      const vw = CFG.W * sx;
      const vh = CFG.H * sy;
      ctx.strokeRect(mx + vx, my + vy, vw, vh);

      ctx.restore();
    },

    renderMenu(ctx) {
      // BG
      const g = ctx.createLinearGradient(0, 0, 0, CFG.H);
      g.addColorStop(0, '#020308');
      g.addColorStop(0.5, '#07080B');
      g.addColorStop(1, '#0E1118');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CFG.W, CFG.H);

      // Decorative drift trails
      ctx.strokeStyle = CFG.C_ACCENT;
      ctx.globalAlpha = 0.08;
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        const sx = S(100) + i * S(200);
        const sy = CFG.H * 0.8;
        for (let t = 0; t < 60; t++) {
          const x = sx + t * 3 + Math.sin(t * 0.3 + this.menuAnim + i) * 40;
          const y = sy - t * 3;
          if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Title
      const pulse = 1 + 0.03 * Math.sin(this.menuAnim * 3);
      ctx.save();
      ctx.translate(CFG.W/2, CFG.H * 0.25);
      ctx.scale(pulse, pulse);
      U.text(ctx, 'OVERSTEER', 0, 0, { align: 'center', size: 56, bold: true, color: CFG.C_ACCENT, shadow: true });
      ctx.restore();

      U.text(ctx, 'Drift to survive. Circle enemies to destroy them.', CFG.W/2, CFG.H * 0.38, {
        align: 'center', size: 14, color: '#888',
      });

      // Controls
      const cy = CFG.H * 0.50;
      U.text(ctx, 'CONTROLS', CFG.W/2, cy, { align: 'center', size: 16, bold: true, color: CFG.C_TEXT });
      const controls = [
        ['W/A/S/D or Arrows', 'Drive & Steer'],
        ['SPACE (hold)', 'Drift (speed >= 180)'],
        ['S / Down', 'Reverse / Handbrake'],
        ['Drive a loop', 'Encircle enemies to kill'],
        ['P / Escape', 'Pause'],
        ['1 / 2 / 3', 'Select upgrade'],
        ['R', 'Reroll upgrades'],
      ];
      for (let i = 0; i < controls.length; i++) {
        U.text(ctx, controls[i][0], CFG.W/2 - S(10), cy + S(22) + i * S(20), { align: 'right', size: 12, color: CFG.C_ACCENT });
        U.text(ctx, controls[i][1], CFG.W/2 + S(10), cy + S(22) + i * S(20), { align: 'left', size: 12, color: '#aaa' });
      }

      // Mobile
      U.text(ctx, 'TOUCH: Tap to start, left stick + right DRIFT + 2-finger pause', CFG.W/2, cy + S(152), {
        align: 'center', size: 11, color: '#555',
      });

      // Best score
      if (this.highScore > 0) {
        U.text(ctx, `BEST: ${this.highScore.toLocaleString()}`, CFG.W/2, CFG.H * 0.88, {
          align: 'center', size: 16, color: '#666',
        });
      }

      // Start prompt
      if (Math.floor(this.menuAnim * 2) % 2 === 0) {
        U.text(ctx, '[ ENTER / TAP ] SELECT MAP', CFG.W/2, CFG.H * 0.92, {
          align: 'center', size: 20, bold: true, color: CFG.C_ACCENT, shadow: true,
        });
      }
      U.text(ctx, '[ S ] SANDBOX — free drive, no enemies', CFG.W/2, CFG.H * 0.97, {
        align: 'center', size: 13, color: '#555',
      });
    },

    renderMapSelect(ctx) {
      // BG
      const g = ctx.createLinearGradient(0, 0, 0, CFG.H);
      g.addColorStop(0, '#020308');
      g.addColorStop(0.5, '#07080B');
      g.addColorStop(1, '#0E1118');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CFG.W, CFG.H);

      const pulse = 1 + 0.03 * Math.sin(this.menuAnim * 3);
      ctx.save();
      ctx.translate(CFG.W/2, CFG.H * 0.2);
      ctx.scale(pulse, pulse);
      U.text(ctx, 'SELECT MAP', 0, 0, { align: 'center', size: 44, bold: true, color: CFG.C_ACCENT, shadow: true });
      ctx.restore();

      const map = MAPS_BY_ID[this.selectedMapId] || MAPS[0];
      const cy = CFG.H * 0.45;
      U.text(ctx, map.name.toUpperCase(), CFG.W/2, cy, {
        align: 'center', size: 26, color: CFG.C_TEXT, bold: true,
      });
      U.text(ctx, map.desc, CFG.W/2, cy + S(26), {
        align: 'center', size: 14, color: '#777',
      });
      U.text(ctx, '[ A / D ] change map', CFG.W/2, cy + S(60), {
        align: 'center', size: 12, color: '#555',
      });
      U.text(ctx, '[ ENTER / TAP ] start', CFG.W/2, CFG.H * 0.8, {
        align: 'center', size: 18, bold: true, color: CFG.C_ACCENT, shadow: true,
      });
      U.text(ctx, '[ ESC ] back', CFG.W/2, CFG.H * 0.85, {
        align: 'center', size: 12, color: '#555',
      });
      // Difficulty modifiers
      const modY = CFG.H * 0.65;
      U.text(ctx, 'MODIFIERS', CFG.W/2, modY, { align: 'center', color: '#888', size: 14, bold: true });
      const mods = [
        { key: '1', label: 'HARD MODE', desc: 'Enemies +25% speed, 1.5x score', active: this.modifiers.hardMode },
        { key: '2', label: 'SPEED RUSH', desc: 'Spawns 2x faster, 1.3x score', active: this.modifiers.speedRush },
        { key: '3', label: 'FRAGILE', desc: '50 HP only, 1.4x score', active: this.modifiers.fragile },
        { key: '4', label: 'DOUBLE ENEMIES', desc: 'Spawns 2x, bursts 2x, 1.6x score', active: this.modifiers.doubleEnemies },
      ];
      for (let i = 0; i < mods.length; i++) {
        const m = mods[i];
        const my = modY + S(22) + i * S(22);
        const color = m.active ? CFG.C_ACCENT : '#555';
        U.text(ctx, `[${m.key}] ${m.label}`, CFG.W/2 - S(80), my, { color, size: 13, bold: m.active });
        U.text(ctx, m.desc, CFG.W/2 + S(80), my, { color: m.active ? '#aaa' : '#444', size: 11 });
      }
    },

    renderTouchUI(ctx) {
      const Input = window.Input;
      // Only render if touch has been used
      if (!Input.touch.active && Input.touch.driftId === null) return;

      // Drift button
      const btn = this.touchDriftBtn;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = Input.touch.driftId !== null ? CFG.C_ACCENT : '#444';
      ctx.beginPath();
      ctx.arc(btn.x, btn.y, btn.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.7;
      U.text(ctx, 'DRIFT', btn.x, btn.y, { align: 'center', color: '#fff', size: 14, bold: true });
      ctx.globalAlpha = 1;

      // Virtual stick
      if (Input.touch.stickOrigin) {
        const o = Input.touch.stickOrigin;
        const p = Input.touch.stickPos;
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(o.x, o.y, S(50), 0, Math.PI * 2);
        ctx.stroke();
        if (p) {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          const dx = U.clamp(p.x - o.x, -S(40), S(40));
          const dy = U.clamp(p.y - o.y, -S(40), S(40));
          ctx.arc(o.x + dx, o.y + dy, S(18), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    },
  };

  window.STATE = STATE;
  window.Game = Game;
})();
