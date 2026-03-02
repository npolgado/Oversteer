// ============================================================
// Road Rogue - Main Game Loop, State Machine & UI
// ============================================================

// ── Game States ─────────────────────────────────────────────
const STATE = { TITLE: 0, MODIFIER_SELECT: 1, DRIVING: 2, UPGRADE_SELECT: 3, GAME_OVER: 4 };

// ── Game Object ─────────────────────────────────────────────
const Game = (() => {

  // Canvas
  const canvas = document.getElementById('gameCanvas');
  const ctx    = canvas.getContext('2d');
  const W      = CONFIG.WIDTH;
  const H      = CONFIG.HEIGHT;

  // Core state
  let state          = STATE.TITLE;
  let lastTime       = 0;
  let score          = 0;
  let distance       = 0;   // metres travelled
  let bestScore      = parseInt(localStorage.getItem('rr_best') || '0');
  let highDist       = parseInt(localStorage.getItem('rr_dist') || '0');
  let runTime        = 0;   // seconds this run

  // Difficulty
  let diffLevel      = 0;   // increases with distance
  let roadWidthMult  = 1.0;
  let nightLevel     = 0.0;
  let weather        = 'clear';

  // Entities
  const player       = new Player();
  const traffic      = new TrafficManager();
  const pickups      = new PickupManager();
  const upgrades     = new UpgradeSystem();

  // Run modifiers
  let activeModifiers = [];
  let modifierWeather = 'clear';

  // UI state
  let titleAnim      = 0;
  let modChoices     = [];  // run modifiers being offered (title screen choice)
  let upgradeCards   = [];
  let gameOverTimer  = 0;
  let nearMissTimer  = 0;
  let nearMissBonus  = 0;
  let particles      = [];  // visual sparks/effects

  // Input
  const keys = {};
  const input = { accel: false, brake: false, left: false, right: false, nitro: false };

  // ── Input Handling ─────────────────────────────────────────
  document.addEventListener('keydown', e => {
    keys[e.code] = true;
    // Handle upgrade card selection during UPGRADE_SELECT
    if (state === STATE.UPGRADE_SELECT) {
      if (e.code === 'Digit1' || e.code === 'Numpad1') selectUpgrade(0);
      if (e.code === 'Digit2' || e.code === 'Numpad2') selectUpgrade(1);
      if (e.code === 'Digit3' || e.code === 'Numpad3') selectUpgrade(2);
    }
    if (state === STATE.TITLE && e.code === 'Space') startRun();
    if (state === STATE.GAME_OVER && gameOverTimer <= 0) {
      if (e.code === 'Space' || e.code === 'Enter') state = STATE.TITLE;
    }
    if (state === STATE.MODIFIER_SELECT) {
      if (e.code === 'Digit1') chooseModifier(0);
      if (e.code === 'Digit2') chooseModifier(1);
      if (e.code === 'Space')  chooseModifier(-1);  // skip modifiers
    }
  });
  document.addEventListener('keyup', e => { keys[e.code] = false; });

  function pollInput() {
    input.accel = !!(keys['ArrowUp']    || keys['KeyW']);
    input.brake = !!(keys['ArrowDown']  || keys['KeyS']);
    input.left  = !!(keys['ArrowLeft']  || keys['KeyA']);
    input.right = !!(keys['ArrowRight'] || keys['KeyD']);
    input.nitro = !!(keys['ShiftLeft']  || keys['ShiftRight']);
  }

  // ── Run Start ───────────────────────────────────────────────
  function startRun() {
    // Reset CONFIG changes from last run
    CONFIG.PLAYER_CENTRIFUGAL = 0.4;

    // Offer 2 run modifiers
    modChoices = UpgradeSystem.pickRunModifiers(2);
    state = STATE.MODIFIER_SELECT;
  }

  function chooseModifier(index) {
    if (index >= 0 && index < modChoices.length) {
      activeModifiers = [modChoices[index]];
    } else {
      activeModifiers = [];
    }

    // Determine weather from modifiers
    modifierWeather = 'clear';
    for (const mod of activeModifiers) {
      if (mod.weather) { modifierWeather = mod.weather; break; }
    }
    weather = modifierWeather;

    initRun();
  }

  function initRun() {
    // Reset game state
    score         = 0;
    distance      = 0;
    runTime       = 0;
    diffLevel     = 0;
    roadWidthMult = 1.0;
    nightLevel    = modifierWeather === 'night' ? 0.9 : 0.0;
    particles     = [];
    nearMissTimer = 0;
    nearMissBonus = 0;

    player.reset();
    traffic.reset();
    pickups.reset();
    upgrades.reset();

    Road.generate(weather);

    // Apply run modifiers
    UpgradeSystem.applyModifiers(activeModifiers, { player, traffic, roadWidthMult: 1.0, nightLevel });

    // Re-read nightLevel and roadWidthMult from modifier effects
    // (modifiers mutate game object — we pass a proxy below)
    const proxy = {
      player, traffic,
      get roadWidthMult() { return roadWidthMult; },
      set roadWidthMult(v) { roadWidthMult = v; },
      get nightLevel() { return nightLevel; },
      set nightLevel(v) { nightLevel = v; },
    };
    UpgradeSystem.applyModifiers(activeModifiers, proxy);

    state = STATE.DRIVING;
  }

  // ── Upgrade selection ──────────────────────────────────────
  function openUpgradeScreen() {
    upgradeCards = upgrades.buildOffer(player);
    state = STATE.UPGRADE_SELECT;
  }

  function selectUpgrade(index) {
    const proxy = { player, traffic };
    upgrades.choose(index, player, proxy);
    // Nitro refill: ensure flag is refreshed
    state = STATE.DRIVING;
  }

  // ── Main Update ────────────────────────────────────────────
  function update(dt) {
    if (state !== STATE.DRIVING) return;

    pollInput();
    runTime += dt;

    // Difficulty
    diffLevel  = distance / 1000;  // difficulty unit = 1 per km
    const speedBonus = diffLevel * CONFIG.SPEED_BONUS_PER_KM;
    traffic.density  = Math.max(10, CONFIG.TRAFFIC_DENSITY - diffLevel * CONFIG.TRAFFIC_BOOST_PER_KM);

    // Road narrowing (subtle)
    roadWidthMult = Math.max(0.55, 1.0 - diffLevel * 0.04);

    // Player effective max speed grows with distance
    if (!player.overclock) {
      player.maxSpeed = CONFIG.PLAYER_MAX_SPEED + speedBonus;
    }

    // Road curvature at player position
    const seg = Road.segmentAt(player.z);
    const roadCurve = seg ? seg.curve : 0;

    // Update player
    player.update(dt, input, roadCurve, roadWidthMult);

    // Distance in metres (1 world-unit ≈ 0.1m feels balanced)
    distance = player.z * 0.1;

    // Score
    const scoreMult = player.scoreMult || 1;
    score += distance * CONFIG.SCORE_PER_METRE * scoreMult * dt * (1 + player.speedFraction);

    // Extend road
    Road.extend(player.z, weather);

    // Traffic update
    traffic.tick(dt);
    traffic.update(player.z, player.maxSpeed, roadWidthMult);

    // Pickup update
    pickups.update(player.z);
    const fuelGained = pickups.checkCollection(player, roadWidthMult);
    if (fuelGained > 0) {
      player.fuel = Math.min(CONFIG.FUEL_MAX, player.fuel + fuelGained);
      spawnParticles(W / 2, H - 100, '#ffdd00', 12);
    }

    // Collision
    const hitCar = traffic.checkCollision(player, roadWidthMult);
    if (hitCar) {
      const ramSedans = player.ramSedans && hitCar.type === 'sedan';
      if (!ramSedans) {
        const fatal = player.collide();
        if (fatal) {
          endRun();
          return;
        }
        spawnParticles(W / 2, H - 100, '#ff4444', 20);
        // Knock back speed
        player.speed *= 0.4;
      }
    }

    // Near-miss detection
    if (!hitCar) {
      const seg2 = Road.segmentAt(player.z + CONFIG.SEGMENT_LENGTH * 2);
      if (seg2 && seg2.cars.length > 0) {
        for (const car of seg2.cars) {
          const dx = Math.abs(player.x - car.x * roadWidthMult);
          if (dx < 0.25 * roadWidthMult) {
            if (nearMissTimer <= 0) {
              nearMissBonus = CONFIG.SCORE_NEAR_MISS;
              score        += nearMissBonus;
              nearMissTimer = 1.5;
              spawnParticles(W / 2, H / 2, '#ffff00', 8);
            }
          }
        }
      }
    }
    if (nearMissTimer > 0) nearMissTimer -= dt;

    // Particle update
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) {
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.vy   += 200 * dt;
      p.life -= dt;
    }

    // Upgrade check
    if (upgrades.shouldOffer(distance)) {
      openUpgradeScreen();
    }

    // Player death (fuel out)
    if (player.dead) endRun();
  }

  function endRun() {
    // Save records
    if (score > bestScore) {
      bestScore = Math.floor(score);
      localStorage.setItem('rr_best', bestScore);
    }
    if (Math.floor(distance) > highDist) {
      highDist = Math.floor(distance);
      localStorage.setItem('rr_dist', highDist);
    }
    // Revert CONFIG changes from modifiers
    CONFIG.PLAYER_CENTRIFUGAL = 0.4;

    gameOverTimer = 2.0;
    state = STATE.GAME_OVER;
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x, y, color,
        vx:   Utils.randomFloat(-120, 120),
        vy:   Utils.randomFloat(-200, -50),
        life: Utils.randomFloat(0.4, 1.0),
        size: Utils.randomFloat(3, 8),
      });
    }
  }

  // ── Render ─────────────────────────────────────────────────
  function render() {
    ctx.clearRect(0, 0, W, H);

    if (state === STATE.TITLE) {
      renderTitle();
    } else if (state === STATE.MODIFIER_SELECT) {
      renderModifierSelect();
    } else if (state === STATE.DRIVING || state === STATE.UPGRADE_SELECT) {
      renderDriving();
      if (state === STATE.UPGRADE_SELECT) renderUpgradeScreen();
    } else if (state === STATE.GAME_OVER) {
      renderDriving();
      renderGameOver();
    }
  }

  // ── Road / Driving render ───────────────────────────────────
  function renderDriving() {
    Road.render(ctx, player.z, player.x, roadWidthMult, weather, nightLevel, []);

    // Night vignette
    if (nightLevel > 0.3) {
      const vigAlpha = nightLevel * 0.85;
      const vig = ctx.createRadialGradient(W/2, H*0.7, H*0.15, W/2, H*0.7, H*0.8);
      vig.addColorStop(0, `rgba(0,0,0,0)`);
      vig.addColorStop(1, `rgba(0,0,0,${vigAlpha})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
    }

    // Draw player car
    player.render(ctx);

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // HUD
    renderHUD();
  }

  // ── HUD ─────────────────────────────────────────────────────
  function renderHUD() {
    // Speed bar (left)
    const barX = 20, barY = H - 120, barW = 16, barH = 100;
    Utils.rect(ctx, barX, barY, barW, barH, 'rgba(0,0,0,0.5)');
    const speedPct = player.speedFraction;
    const speedBarH = barH * speedPct;
    const speedColor = speedPct > 0.85 ? '#ff4444' : speedPct > 0.5 ? '#ffaa00' : '#00cc44';
    Utils.rect(ctx, barX, barY + barH - speedBarH, barW, speedBarH, speedColor);
    Utils.text(ctx, Utils.formatSpeed(player.speed), barX + barW / 2, barY - 6,
      { align: 'center', size: 12, color: '#ffffff', shadow: true });

    // Fuel bar (right side)
    const fbarX = W - 36, fbarY = H - 120;
    Utils.rect(ctx, fbarX, fbarY, barW, barH, 'rgba(0,0,0,0.5)');
    const fuelPct = player.fuel / CONFIG.FUEL_MAX;
    const fuelColor = fuelPct < 0.2 ? '#ff4444' : fuelPct < 0.4 ? '#ffaa00' : '#ffdd00';
    Utils.rect(ctx, fbarX, fbarY + barH * (1 - fuelPct), barW, barH * fuelPct, fuelColor);
    Utils.text(ctx, '⛽', fbarX + barW / 2, fbarY - 6, { align: 'center', size: 12, shadow: true });

    // Pulse warning on low fuel
    if (fuelPct < 0.2 && Math.floor(runTime * 4) % 2 === 0) {
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth   = 3;
      ctx.strokeRect(fbarX - 2, fbarY - 2, barW + 4, barH + 4);
    }

    // Score
    Utils.text(ctx, `SCORE  ${Math.floor(score).toLocaleString()}`, W / 2, 28,
      { align: 'center', size: 20, bold: true, color: CONFIG.COLORS.UI_ACCENT, shadow: true });

    // Distance
    Utils.text(ctx, Utils.formatDist(distance), W / 2, 52,
      { align: 'center', size: 15, color: '#dddddd', shadow: true });

    // Nitro indicator
    if (player.nitroLeft > 0) {
      const nitX = W / 2 - 50, nitY = H - 30, nitW = 100, nitH = 12;
      Utils.rect(ctx, nitX, nitY, nitW, nitH, 'rgba(0,0,0,0.5)');
      const nitPct = player.nitroLeft / 8;
      const nitColor = player.nitroActive ? '#ff8800' : '#00aaff';
      Utils.rect(ctx, nitX, nitY, nitW * nitPct, nitH, nitColor);
      Utils.text(ctx, 'NITRO', W / 2, nitY - 4, { align: 'center', size: 11, color: '#aaaaff' });
    }

    // Shield indicator
    if (player.shield) {
      Utils.text(ctx, '🛡️ SHIELD', W - 80, 28, { size: 14, align: 'center', color: '#00ccff', shadow: true });
    }

    // Near miss popup
    if (nearMissTimer > 0) {
      const alpha = Math.min(1, nearMissTimer);
      ctx.globalAlpha = alpha;
      Utils.text(ctx, `NEAR MISS!  +${nearMissBonus}`, W / 2, H / 2 - 30,
        { align: 'center', size: 24, bold: true, color: '#ffff00', shadow: true });
      ctx.globalAlpha = 1;
    }

    // Active modifier badge
    if (activeModifiers.length > 0) {
      const mod = activeModifiers[0];
      Utils.text(ctx, `${mod.icon} ${mod.name}`, 20, 28, { size: 13, color: '#aaaaff', shadow: true });
    }

    // Weather badge
    if (weather !== 'clear') {
      const wIcons = { rain: '🌧️', night: '🌙', snow: '❄️', storm: '⛈️', fog: '🌫️' };
      Utils.text(ctx, wIcons[weather] || '?', W - 30, 28, { size: 18, align: 'center' });
    }

    // Difficulty badge
    Utils.text(ctx, `LVL ${Math.floor(diffLevel + 1)}`, W - 20, H - 20,
      { size: 12, align: 'right', color: '#888888' });

    // Upgrades taken
    const upgTaken = player.upgrades;
    if (upgTaken.length > 0) {
      for (let i = 0; i < Math.min(upgTaken.length, 6); i++) {
        const upg = UPGRADES.find(u => u.id === upgTaken[i]);
        if (upg) {
          Utils.text(ctx, upg.icon, 52 + i * 28, H - 18, { size: 16, align: 'center' });
        }
      }
    }
  }

  // ── Title Screen ────────────────────────────────────────────
  function renderTitle() {
    titleAnim += 0.016;

    // Animated dark road background
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#000010');
    g.addColorStop(0.5, '#0a0030');
    g.addColorStop(1, '#1a0050');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Perspective road lines (decorative)
    ctx.strokeStyle = 'rgba(255,100,0,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const t  = i / 8;
      const y  = H * (0.4 + 0.6 * t);
      const xW = W * (0.01 + 0.49 * t);
      ctx.beginPath();
      ctx.moveTo(W / 2, H * 0.4);
      ctx.lineTo(W / 2 - xW, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(W / 2, H * 0.4);
      ctx.lineTo(W / 2 + xW, y);
      ctx.stroke();
    }

    // Title
    const pulse = 1 + 0.04 * Math.sin(titleAnim * 3);
    ctx.save();
    ctx.translate(W / 2, H * 0.28);
    ctx.scale(pulse, pulse);
    Utils.text(ctx, 'ROAD', 0, -30, { align: 'center', size: 72, bold: true, color: '#ff8800', shadow: true });
    Utils.text(ctx, 'ROGUE', 0, 40, { align: 'center', size: 72, bold: true, color: '#ff4444', shadow: true });
    ctx.restore();

    Utils.text(ctx, 'ROGUELIKE DRIVING SURVIVAL', W / 2, H * 0.52,
      { align: 'center', size: 16, color: '#aaaaaa', shadow: true });

    // Blink prompt
    if (Math.floor(titleAnim * 2) % 2 === 0) {
      Utils.text(ctx, '[ SPACE ] TO START', W / 2, H * 0.65,
        { align: 'center', size: 20, bold: true, color: CONFIG.COLORS.UI_ACCENT, shadow: true });
    }

    // Records
    if (bestScore > 0) {
      Utils.text(ctx, `BEST: ${bestScore.toLocaleString()}  |  DIST: ${Utils.formatDist(highDist)}`,
        W / 2, H * 0.75, { align: 'center', size: 14, color: '#666688' });
    }

    // Controls
    const ctrlY = H - 60;
    Utils.text(ctx, 'WASD / ARROWS: Drive   SHIFT: Nitro   1/2/3: Select Upgrade',
      W / 2, ctrlY, { align: 'center', size: 12, color: '#555577' });
    Utils.text(ctx, 'Survive as long as possible. Collect fuel. Choose upgrades.',
      W / 2, ctrlY + 18, { align: 'center', size: 12, color: '#555577' });
  }

  // ── Modifier Select ─────────────────────────────────────────
  function renderModifierSelect() {
    // Dark backdrop
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);

    Utils.text(ctx, 'CHOOSE YOUR RUN CONDITION', W / 2, 55,
      { align: 'center', size: 22, bold: true, color: CONFIG.COLORS.UI_ACCENT, shadow: true });
    Utils.text(ctx, 'These modifiers persist for the entire run.', W / 2, 85,
      { align: 'center', size: 14, color: '#888888' });

    const cardW = 220, cardH = 180, gap = 30;
    const totalW = modChoices.length * cardW + (modChoices.length - 1) * gap;
    let cx = (W - totalW) / 2;

    for (let i = 0; i < modChoices.length; i++) {
      const mod = modChoices[i];
      drawCard(cx, H / 2 - cardH / 2, cardW, cardH, `[${i + 1}]`, mod.icon, mod.name, mod.desc, '#aa66ff');
      cx += cardW + gap;
    }

    // Skip option
    Utils.text(ctx, '[ SPACE ] Skip — Start with no modifier', W / 2, H - 60,
      { align: 'center', size: 15, color: '#666688', shadow: true });
  }

  // ── Upgrade Screen ──────────────────────────────────────────
  function renderUpgradeScreen() {
    // Dim road underneath
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, W, H);

    Utils.text(ctx, '⬆  UPGRADE TIME  ⬆', W / 2, 60,
      { align: 'center', size: 26, bold: true, color: CONFIG.COLORS.UI_ACCENT, shadow: true });
    Utils.text(ctx, `Distance: ${Utils.formatDist(distance)}`, W / 2, 90,
      { align: 'center', size: 15, color: '#aaaaaa' });

    const cardW = 200, cardH = 200, gap = 20;
    const cards  = upgradeCards;
    const totalW = cards.length * cardW + (cards.length - 1) * gap;
    let cx = (W - totalW) / 2;

    for (let i = 0; i < cards.length; i++) {
      const upg = cards[i];
      const rarColor = RARITY_COLORS[upg.rarity] || '#aaaaaa';
      drawCard(cx, H / 2 - cardH / 2, cardW, cardH, `[${i + 1}]`, upg.icon, upg.name, upg.desc, rarColor);
      // Rarity label
      Utils.text(ctx, upg.rarity.toUpperCase(), cx + cardW / 2, H / 2 - cardH / 2 + cardH + 18,
        { align: 'center', size: 11, color: rarColor });
      cx += cardW + gap;
    }

    Utils.text(ctx, 'Press 1 / 2 / 3 to choose', W / 2, H - 50,
      { align: 'center', size: 14, color: '#888888' });
  }

  function drawCard(x, y, w, h, keyLabel, icon, title, desc, accentColor) {
    // Background
    ctx.fillStyle = CONFIG.COLORS.UI_CARD_BG;
    Utils.roundRect(ctx, x, y, w, h, 10);
    ctx.fill();

    // Border
    ctx.strokeStyle = accentColor;
    ctx.lineWidth   = 2;
    Utils.roundRect(ctx, x, y, w, h, 10);
    ctx.stroke();

    // Key label
    Utils.text(ctx, keyLabel, x + w / 2, y + 22,
      { align: 'center', size: 14, bold: true, color: accentColor });

    // Icon
    ctx.font      = '36px serif';
    ctx.textAlign = 'center';
    ctx.fillText(icon, x + w / 2, y + 72);

    // Title
    Utils.text(ctx, title, x + w / 2, y + 100,
      { align: 'center', size: 15, bold: true, color: '#ffffff', shadow: true });

    // Description (word-wrapped)
    wrapText(ctx, desc, x + 12, y + 124, w - 24, 16, { size: 12, color: '#bbbbbb', align: 'left' });
  }

  function wrapText(ctx, text, x, y, maxW, lineH, opts) {
    ctx.font      = `${opts.size || 13}px 'Courier New', monospace`;
    ctx.textAlign = opts.align || 'left';
    ctx.fillStyle = opts.color || '#ffffff';
    const words = text.split(' ');
    let line = '';
    let ly   = y;
    for (const word of words) {
      const test = line + (line ? ' ' : '') + word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, ly);
        line = word;
        ly  += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, ly);
  }

  // ── Game Over Screen ────────────────────────────────────────
  function renderGameOver() {
    if (gameOverTimer > 0) return;

    ctx.fillStyle = 'rgba(0,0,0,0.80)';
    ctx.fillRect(0, 0, W, H);

    Utils.text(ctx, 'GAME OVER', W / 2, H * 0.28,
      { align: 'center', size: 52, bold: true, color: '#ff3333', shadow: true });

    // Stats
    const statY = H * 0.45;
    const lineH = 30;
    const stats = [
      ['Distance',    Utils.formatDist(distance)],
      ['Score',       Math.floor(score).toLocaleString()],
      ['Time',        `${Math.floor(runTime)}s`],
      ['Upgrades',    player.upgrades.length.toString()],
    ];
    for (let i = 0; i < stats.length; i++) {
      Utils.text(ctx, stats[i][0], W / 2 - 80, statY + i * lineH,
        { align: 'right', size: 18, color: '#888888' });
      Utils.text(ctx, stats[i][1], W / 2 + 10, statY + i * lineH,
        { align: 'left', size: 18, bold: true, color: '#ffffff' });
    }

    // Records
    if (Math.floor(score) >= bestScore) {
      Utils.text(ctx, '★ NEW BEST SCORE! ★', W / 2, statY + stats.length * lineH + 20,
        { align: 'center', size: 18, bold: true, color: '#ffdd00', shadow: true });
    }

    // Upgrades taken
    if (player.upgrades.length > 0) {
      const upgLine = player.upgrades
        .map(id => UPGRADES.find(u => u.id === id)?.icon || '?')
        .join(' ');
      Utils.text(ctx, 'Run: ' + upgLine, W / 2, H * 0.78,
        { align: 'center', size: 18 });
    }

    if (Math.floor(runTime) % 2 === 0) {
      Utils.text(ctx, '[ SPACE ] RETURN TO TITLE', W / 2, H - 60,
        { align: 'center', size: 18, bold: true, color: CONFIG.COLORS.UI_ACCENT, shadow: true });
    }
  }

  // ── Main Loop ───────────────────────────────────────────────
  function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // cap at 50ms
    lastTime = timestamp;

    if (state === STATE.TITLE) {
      titleAnim += dt;
    }

    if (state === STATE.GAME_OVER) {
      gameOverTimer = Math.max(0, gameOverTimer - dt);
    }

    update(dt);
    render();

    requestAnimationFrame(loop);
  }

  // ── Bootstrap ───────────────────────────────────────────────
  function init() {
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  return { init };

})();

// Kick off the game
Game.init();
