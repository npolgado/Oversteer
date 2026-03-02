// ============================================================
// Road Rogue - Pseudo-3D Road System
// Generates infinite procedural road and renders it with
// perspective projection (OutRun-style).
// ============================================================
const Road = (() => {

  // ── Internal state ─────────────────────────────────────────
  let segments = [];       // segment array (grows forever)
  let totalZ   = 0;        // current road end in world-Z

  // ── Colour helpers ─────────────────────────────────────────
  function segColor(index, weather) {
    const alt = (Math.floor(index / CONFIG.RUMBLE_LENGTH) % 2) === 0;

    if (weather === 'snow') {
      return {
        road:   alt ? '#c8c8c8' : '#b8b8b8',
        grass:  alt ? '#dde8ee' : '#ccd8e4',
        rumble: alt ? '#cc2222' : '#eeeeee',
        lane:   alt ? '#eeeeee' : null,
      };
    }
    if (weather === 'rain' || weather === 'storm') {
      return {
        road:   alt ? '#555577' : '#44446a',
        grass:  alt ? '#0a6a0a' : '#096009',
        rumble: alt ? '#cc2222' : '#dddddd',
        lane:   alt ? '#aaaacc' : null,
      };
    }
    // Default (clear / night)
    return {
      road:   alt ? CONFIG.COLORS.ROAD_LIGHT   : CONFIG.COLORS.ROAD_DARK,
      grass:  alt ? CONFIG.COLORS.GRASS_LIGHT  : CONFIG.COLORS.GRASS_DARK,
      rumble: alt ? CONFIG.COLORS.RUMBLE_LIGHT : CONFIG.COLORS.RUMBLE_DARK,
      lane:   alt ? CONFIG.COLORS.LANE_MARKER  : null,
    };
  }

  // ── Segment factory ────────────────────────────────────────
  function makeSegment(index, curve, y1, y2, weather) {
    return {
      index,
      p1: { worldY: y1, worldZ: index       * CONFIG.SEGMENT_LENGTH },
      p2: { worldY: y2, worldZ: (index + 1) * CONFIG.SEGMENT_LENGTH },
      curve,
      color: segColor(index, weather),
      cars: [],
      pickup: null,
    };
  }

  // ── Road-building helpers ──────────────────────────────────
  function addSegment(curve, y1, y2, weather) {
    const idx = segments.length;
    segments.push(makeSegment(idx, curve, y1, y2, weather));
    totalZ = (idx + 1) * CONFIG.SEGMENT_LENGTH;
  }

  function lastY() {
    return segments.length ? segments[segments.length - 1].p2.worldY : 0;
  }

  function addStraight(n, weather) {
    n = n || 10;
    const y = lastY();
    for (let i = 0; i < n; i++) addSegment(0, y, y, weather);
  }

  function addCurve(n, curve, hill, weather) {
    n     = n    || 20;
    curve = curve || 2;
    hill  = hill  || 0;
    const startY = lastY();
    for (let i = 0; i < n; i++) {
      const t   = i / n;
      const y1  = Utils.lerp(startY, startY + hill, t);
      const y2  = Utils.lerp(startY, startY + hill, (i + 1) / n);
      addSegment(curve, y1, y2, weather);
    }
  }

  function addHill(n, height, weather) {
    n      = n      || 20;
    height = height || 60;
    const half   = Math.ceil(n / 2);
    const startY = lastY();
    const peak   = startY + height;
    for (let i = 0; i < half; i++) {
      const t = i / half;
      addSegment(0, Utils.lerp(startY, peak, t), Utils.lerp(startY, peak, (i + 1) / half), weather);
    }
    for (let i = 0; i < half; i++) {
      const t = i / half;
      addSegment(0, Utils.lerp(peak, startY, t), Utils.lerp(peak, startY, (i + 1) / half), weather);
    }
  }

  function addSCurve(weather) {
    addStraight(4, weather);
    addCurve(18, -3, 0, weather);
    addStraight(4, weather);
    addCurve(18,  3, 0, weather);
    addStraight(4, weather);
  }

  // ── Procedural chunk generator ─────────────────────────────
  const CHUNKS = [
    (w) => addStraight(Utils.randomInt(12, 28), w),
    (w) => addCurve(Utils.randomInt(16, 36), Utils.randomFloat(-4.5, 4.5), 0, w),
    (w) => addHill(Utils.randomInt(16, 32), Utils.randomInt(30, 90), w),
    (w) => addSCurve(w),
    (w) => {
      addCurve(18, Utils.randomFloat(2, 5), Utils.randomInt(20, 60), w);
      addCurve(18, Utils.randomFloat(-5, -2), 0, w);
    },
    (w) => {
      addHill(20, Utils.randomInt(40, 80), w);
      addCurve(20, Utils.randomFloat(-3, 3), 0, w);
    },
  ];

  function addChunk(weather) {
    // 3-5 random section types per chunk
    const count = Utils.randomInt(3, 5);
    for (let i = 0; i < count; i++) {
      Utils.randomChoice(CHUNKS)(weather);
    }
    // Occasionally flatten back to y=0 to prevent endless drift
    if (Math.abs(lastY()) > 200) {
      const y = lastY();
      const steps = 10;
      for (let i = 0; i < steps; i++) {
        addSegment(0, Utils.lerp(y, 0, i / steps), Utils.lerp(y, 0, (i + 1) / steps), weather);
      }
    }
  }

  // ── Public: generate fresh road ────────────────────────────
  function generate(weather) {
    segments = [];
    totalZ   = 0;
    // Opening straight so player doesn't immediately hit a curve
    addStraight(20, weather);
    // Pre-generate enough road to fill the draw distance several times
    for (let i = 0; i < 12; i++) addChunk(weather);
  }

  // Extend road when needed (called each frame)
  function extend(playerZ, weather) {
    const needed = playerZ + CONFIG.DRAW_DISTANCE * CONFIG.SEGMENT_LENGTH * 2;
    while (totalZ < needed) addChunk(weather);
  }

  // ── Accessors ──────────────────────────────────────────────
  function getSegment(index) {
    if (index < 0 || index >= segments.length) return null;
    return segments[index];
  }

  function segmentAt(z) {
    const idx = Math.floor(z / CONFIG.SEGMENT_LENGTH);
    return getSegment(Utils.clamp(idx, 0, segments.length - 1));
  }

  function getLength() { return totalZ; }
  function getSegments() { return segments; }

  // ── Background renderer ─────────────────────────────────────
  function renderBackground(ctx, W, H, weather, nightLevel) {
    const horizonY = Math.floor(H * CONFIG.HORIZON_Y);

    if (weather === 'night' || nightLevel > 0.5) {
      // Dark night sky
      const g = ctx.createLinearGradient(0, 0, 0, horizonY);
      g.addColorStop(0, '#000008');
      g.addColorStop(1, '#0a0a22');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, horizonY);

      // Stars
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      // Use deterministic pseudo-stars based on screen coords
      for (let i = 0; i < 60; i++) {
        const sx = ((i * 137 + 11) % W);
        const sy = ((i * 97  + 7)  % horizonY);
        ctx.fillRect(sx, sy, 1, 1);
      }
    } else if (weather === 'rain' || weather === 'storm') {
      const g = ctx.createLinearGradient(0, 0, 0, horizonY);
      g.addColorStop(0, '#151525');
      g.addColorStop(1, '#2a2a3a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, horizonY);
    } else {
      // Day sky
      const g = ctx.createLinearGradient(0, 0, 0, horizonY);
      g.addColorStop(0, CONFIG.COLORS.SKY_TOP);
      g.addColorStop(0.6, CONFIG.COLORS.SKY_MID);
      g.addColorStop(1, CONFIG.COLORS.SKY_HORIZON);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, horizonY);
    }

    // Horizon line glow
    ctx.fillStyle = weather === 'night' ? 'rgba(60,60,120,0.3)' : 'rgba(80,80,200,0.2)';
    ctx.fillRect(0, horizonY - 2, W, 4);
  }

  // ── Segment renderer ────────────────────────────────────────
  function renderSegment(ctx, W, lanes, x1, y1, w1, x2, y2, w2, fog, col) {
    if (w1 <= 0 && w2 <= 0) return;

    // Grass strip (fills full width from y2 to y1)
    ctx.fillStyle = fog < 0.15
      ? blendColor(col.grass, fog)
      : col.grass;
    ctx.fillRect(0, y2, W, y1 - y2);

    if (w1 < 1 || w2 < 1) return;

    // Road surface
    Utils.drawTrap(ctx, x1, y1, w1, x2, y2, w2, col.road);

    // Rumble strips
    const rw1 = w1 / 5;
    const rw2 = w2 / 5;
    Utils.drawTrap(ctx, x1 - w1 - rw1 / 2, y1, rw1 / 2, x2 - w2 - rw2 / 2, y2, rw2 / 2, col.rumble);
    Utils.drawTrap(ctx, x1 + w1 + rw1 / 2, y1, rw1 / 2, x2 + w2 + rw2 / 2, y2, rw2 / 2, col.rumble);

    // Lane markers
    if (col.lane) {
      const lw1 = (w1 * 0.04);
      const lw2 = (w2 * 0.04);
      for (let lane = 1; lane < lanes; lane++) {
        const t   = lane / lanes;
        const lx1 = Utils.lerp(-w1, w1, t);
        const lx2 = Utils.lerp(-w2, w2, t);
        Utils.drawTrap(ctx, x1 + lx1, y1, lw1, x2 + lx2, y2, lw2, col.lane);
      }
    }

    // Fog overlay
    if (fog > 0.05) {
      ctx.fillStyle = `rgba(128,128,160,${fog * 0.7})`;
      Utils.drawTrap(ctx, x1, y1, w1 + w1 / 5 + 2, x2, y2, w2 + w2 / 5 + 2, `rgba(128,128,160,${fog * 0.7})`);
    }
  }

  // Blend colour toward fog colour
  function blendColor(hex, fog) {
    return hex; // simplified – grass is good enough without blending
  }

  // ── Main render ─────────────────────────────────────────────
  // Returns the projected x-offset at the player's position (used for car drawing)
  function render(ctx, playerZ, playerX, roadWidthMult, weather, nightLevel, visibleCars) {
    const W = CONFIG.WIDTH;
    const H = CONFIG.HEIGHT;
    const segLen = CONFIG.SEGMENT_LENGTH;
    const camH   = CONFIG.CAMERA_HEIGHT;
    const camD   = CONFIG.CAMERA_DEPTH;
    const rw     = CONFIG.ROAD_WIDTH * roadWidthMult;

    const baseIdx  = Math.floor(playerZ / segLen);
    const baseSeg  = getSegment(baseIdx);
    if (!baseSeg) return 0;

    const playerPercent = (playerZ % segLen) / segLen;
    const cameraX       = playerX * rw;  // camera lateral offset (world units)
    const cameraZ       = playerZ;

    // ── Fog density based on weather ──────────────────────────
    let fogDensity = 0.3;
    if (weather === 'fog')   fogDensity = 1.8;
    if (weather === 'rain')  fogDensity = 0.8;
    if (weather === 'storm') fogDensity = 2.0;
    if (weather === 'night') fogDensity = 0.6;
    if (nightLevel > 0.5)    fogDensity = Math.max(fogDensity, nightLevel * 1.2);

    // ── Background ────────────────────────────────────────────
    renderBackground(ctx, W, H, weather, nightLevel);

    // ── First pass: project all visible segments ──────────────
    // Accumulate curve offset from far to near, then render far→near
    // We need curveOffsets[n] = cumulative screen-X shift for segment n
    const draw = CONFIG.DRAW_DISTANCE;

    let cumX  = 0;
    let cumDX = -(baseSeg.curve * playerPercent);  // fractional adjustment

    const proj = new Array(draw + 1);

    for (let n = 0; n <= draw; n++) {
      const seg = getSegment(baseIdx + n);
      if (!seg) break;

      // Camera-relative Z for p1 and p2
      const z1 = seg.p1.worldZ - cameraZ;
      const z2 = seg.p2.worldZ - cameraZ;

      if (z2 <= 0) {
        // Both points behind camera (shouldn't happen for n>0 but be safe)
        cumX  += cumDX;
        cumDX += seg.curve;
        continue;
      }

      const scale1 = z1 > 0 ? camD / z1 : 0;
      const scale2 = camD / z2;

      // Screen positions
      const sx1 = W / 2 - scale1 * cameraX * W / 2;
      const sy1 = H / 2 - scale1 * (seg.p1.worldY - camH) * H / 2;
      const sw1 = scale1 * rw * W / 2;

      cumX  += cumDX;
      cumDX += seg.curve;

      const sx2 = W / 2 - scale2 * cameraX * W / 2;
      const sy2 = H / 2 - scale2 * (seg.p2.worldY - camH) * H / 2;
      const sw2 = scale2 * rw * W / 2;

      proj[n] = {
        seg,
        x1: sx1 + cumX - seg.curve,   // x before this segment's cumX contribution
        y1: sy1,
        w1: sw1,
        x2: sx2 + cumX,
        y2: sy2,
        w2: sw2,
        fog: Math.max(0, 1 - Utils.fogFactor(n, draw, fogDensity)),
        scale: scale2,
        cumX,
      };
    }

    // ── Render far → near (painter's algorithm) ───────────────
    let maxY = H;  // clip guard: skip anything above already-rendered horizon
    const carSprites = [];  // collect cars to draw after road

    for (let n = draw; n >= 0; n--) {
      const p = proj[n];
      if (!p) continue;

      const y2i = Math.round(p.y2);
      const y1i = Math.round(p.y1);

      if (y1i <= 0)   break;   // above screen
      if (y2i >= maxY) continue; // occluded by nearer segment

      renderSegment(
        ctx, W, CONFIG.LANES,
        p.x1, y1i, p.w1,
        p.x2, y2i, p.w2,
        p.fog, p.seg.color
      );

      // Collect fuel pickups to draw
      if (p.seg.pickup && p.scale > 0) {
        const pu = p.seg.pickup;
        const puX = p.x2 + pu.offset * p.w2;
        const puW = Math.max(4, p.scale * 60);
        carSprites.push({ x: puX, y: y2i, w: puW, type: 'fuel', obj: pu });
      }

      // Collect traffic cars to draw
      for (const car of p.seg.cars) {
        if (p.scale > 0) {
          const cx  = p.x2 + car.offset * p.w2;
          const ch  = Math.max(6, p.scale * car.height);
          const cw  = Math.max(4, p.scale * car.width);
          carSprites.push({ x: cx, y: y2i, w: cw, h: ch, type: 'car', obj: car });
        }
      }

      maxY = y2i;
    }

    // ── Draw sprites (sorted far→near is already done by segment order) ──
    for (const sp of carSprites) {
      if (sp.type === 'fuel') {
        drawFuelPickup(ctx, sp.x, sp.y, sp.w);
      } else if (sp.type === 'car') {
        drawTrafficCar(ctx, sp.x, sp.y, sp.w, sp.h, sp.obj.color);
      }
    }

    // Return the total curve X offset at player position (n=0)
    return proj[0] ? proj[0].cumX - (proj[0] ? baseSeg.curve * playerPercent : 0) : 0;
  }

  // ── Sprite drawing ──────────────────────────────────────────
  function drawFuelPickup(ctx, x, y, size) {
    const s = size * 1.2;
    // Glowing fuel canister
    ctx.save();
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = '#ffdd00';
    ctx.beginPath();
    ctx.arc(x, y - s / 2, s / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff8800';
    ctx.font = `bold ${Math.max(8, Math.round(s * 0.7))}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('⛽', x, y - s / 4);
    ctx.restore();
  }

  function drawTrafficCar(ctx, x, y, w, h, color) {
    const halfW = w / 2;
    // Car body
    ctx.fillStyle = color;
    ctx.fillRect(x - halfW, y - h, w, h);
    // Windows
    ctx.fillStyle = 'rgba(180,220,255,0.6)';
    ctx.fillRect(x - halfW * 0.7, y - h * 0.85, w * 0.7, h * 0.3);
    // Tail lights
    ctx.fillStyle = '#ff3333';
    ctx.fillRect(x - halfW,          y - h * 0.2, halfW * 0.25, h * 0.15);
    ctx.fillRect(x + halfW * 0.75,   y - h * 0.2, halfW * 0.25, h * 0.15);
  }

  // ── Public API ──────────────────────────────────────────────
  return {
    generate,
    extend,
    getSegment,
    segmentAt,
    getLength,
    getSegments,
    render,
  };

})();
