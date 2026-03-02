// ============================================================
// Road Rogue - Player & Traffic Entities
// ============================================================

// ── Player ──────────────────────────────────────────────────
class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.z        = 0;       // road position (world units)
    this.x        = 0;       // lateral position (-1 = left edge, +1 = right edge)
    this.speed    = 0;       // current speed (world units/second)
    this.maxSpeed = CONFIG.PLAYER_MAX_SPEED;
    this.fuel     = CONFIG.FUEL_MAX;
    this.shield   = false;   // one-hit shield upgrade
    this.nitroLeft = 0;      // seconds of nitro remaining
    this.nitroActive = false;
    this.upgrades = [];      // list of upgrade IDs applied
    this.dead     = false;
    this.crashTimer = 0;     // flash timer on crash

    // Derived from upgrades
    this.fuelEfficiency = 1.0;
    this.magnetRange    = 0;
    this.ghostTruck     = false;  // pass through trucks
    this.wideBody       = false;  // collision width modifier

    // Visual
    this.w = 80;     // sprite width  (screen pixels – scaled by camera)
    this.h = 60;     // sprite height
    this.color = '#e83030';
    this.roofColor = '#aa1818';
  }

  // Effective collision half-width in road-relative units (0-1)
  get hitWidth() {
    return CONFIG.PLAYER_WIDTH * (this.wideBody ? 1.3 : 1.0);
  }

  get speedFraction() { return this.speed / this.maxSpeed; }

  applyUpgrade(upgrade) {
    if (this.upgrades.includes(upgrade.id)) return; // no duplicates
    this.upgrades.push(upgrade.id);
    upgrade.apply(this);
  }

  update(dt, input, roadCurve, roadWidthMult) {
    const { accel, brake, left, right, nitro } = input;
    const rw = roadWidthMult;

    // ── Speed ─────────────────────────────────────────────
    const effectiveMax = this.maxSpeed * (this.nitroActive ? 1.5 : 1.0);

    if (accel && this.fuel > 0) {
      this.speed = Utils.approach(this.speed, effectiveMax, CONFIG.PLAYER_ACCEL * dt);
    } else if (brake) {
      this.speed = Utils.approach(this.speed, 0, CONFIG.PLAYER_BRAKE * dt);
    } else {
      this.speed = Utils.approach(this.speed, 0, CONFIG.PLAYER_DECEL * dt);
    }

    // ── Nitro ──────────────────────────────────────────────
    if (nitro && this.nitroLeft > 0) {
      this.nitroActive = true;
      this.nitroLeft   = Math.max(0, this.nitroLeft - dt);
    } else {
      this.nitroActive = false;
    }

    // ── Lateral steering ──────────────────────────────────
    const steerSpeed = CONFIG.PLAYER_STEER * this.speedFraction * dt;
    if (left)  this.x -= steerSpeed;
    if (right) this.x += steerSpeed;

    // Centrifugal drift on curves
    this.x += roadCurve * CONFIG.PLAYER_CENTRIFUGAL * this.speedFraction * dt;

    // ── Off-road penalty ──────────────────────────────────
    const xLimit = 1.0 * rw;
    if (Math.abs(this.x) > xLimit) {
      this.speed = Utils.approach(this.speed, 0, CONFIG.PLAYER_OFFROAD_DECEL * dt);
    }

    // Clamp lateral (allow slight overshoot for feel)
    this.x = Utils.clamp(this.x, -1.4 * rw, 1.4 * rw);

    // ── Move forward ──────────────────────────────────────
    this.z += this.speed * dt;

    // ── Fuel ─────────────────────────────────────────────
    if (this.speed > 0) {
      this.fuel -= CONFIG.FUEL_BURN_RATE * this.speedFraction * this.fuelEfficiency * dt * this.speed;
    }
    if (this.fuel <= 0) {
      this.fuel  = 0;
      this.speed = Utils.approach(this.speed, 0, CONFIG.PLAYER_BRAKE * dt);
      if (this.speed < 10) this.dead = true;
    }

    // ── Crash flash timer ─────────────────────────────────
    if (this.crashTimer > 0) this.crashTimer -= dt;
  }

  collide() {
    if (this.shield) {
      this.shield = false;
      this.crashTimer = 0.3;
      return false; // absorbed
    }
    return true; // dead
  }

  // Draw the player car at the bottom-centre of the screen
  render(ctx) {
    const W  = CONFIG.WIDTH;
    const H  = CONFIG.HEIGHT;
    const cx = W / 2;
    const cy = H - 80;

    // Crash flash
    if (this.crashTimer > 0 && Math.floor(this.crashTimer * 10) % 2 === 0) return;

    const w = this.w;
    const h = this.h;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + h / 2 + 4, w / 2 + 4, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = this.nitroActive ? '#ff8800' : this.color;
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);

    // Roof
    ctx.fillStyle = this.roofColor;
    ctx.fillRect(cx - w * 0.35, cy - h / 2 - h * 0.25, w * 0.7, h * 0.3);

    // Windscreen
    ctx.fillStyle = 'rgba(180,230,255,0.55)';
    ctx.fillRect(cx - w * 0.28, cy - h / 2 - h * 0.22, w * 0.56, h * 0.2);

    // Headlights
    ctx.fillStyle = '#ffffaa';
    ctx.fillRect(cx - w / 2,          cy - h / 2, w * 0.18, h * 0.14);
    ctx.fillRect(cx + w / 2 - w*0.18, cy - h / 2, w * 0.18, h * 0.14);

    // Nitro flame
    if (this.nitroActive) {
      ctx.fillStyle = `rgba(255,${Utils.randomInt(100,200)},0,0.8)`;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.25, cy + h / 2);
      ctx.lineTo(cx + w * 0.25, cy + h / 2);
      ctx.lineTo(cx, cy + h / 2 + Utils.randomInt(15, 30));
      ctx.closePath();
      ctx.fill();
    }

    // Shield bubble
    if (this.shield) {
      ctx.strokeStyle = 'rgba(0,200,255,0.5)';
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * 0.65, h * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

// ── Traffic Manager ─────────────────────────────────────────
class TrafficManager {
  constructor() {
    this.cars = [];
    this.nextSpawnIndex = 50; // segment index for next spawn
    this.density = CONFIG.TRAFFIC_DENSITY;
  }

  reset() {
    this.cars = [];
    this.nextSpawnIndex = 50;
    this.density = CONFIG.TRAFFIC_DENSITY;
  }

  // Called each frame – spawn new cars, remove old ones, update positions
  update(playerZ, playerSpeed, roadWidthMult) {
    const segLen = CONFIG.SEGMENT_LENGTH;
    const baseIdx = Math.floor(playerZ / segLen);

    // ── Remove old segments' car references ──────────────
    const segs = Road.getSegments();

    // Clear all segment car arrays (will re-populate)
    for (let i = Math.max(0, baseIdx - 5); i < Math.min(segs.length, baseIdx + CONFIG.DRAW_DISTANCE + 2); i++) {
      if (segs[i]) segs[i].cars = [];
    }

    // ── Spawn new cars ahead ──────────────────────────────
    const spawnAhead  = CONFIG.DRAW_DISTANCE + 30;
    const despawnBehind = 20;

    while (this.nextSpawnIndex < baseIdx + spawnAhead) {
      const idx = this.nextSpawnIndex;
      this.nextSpawnIndex += Math.max(3, Math.floor(this.density - Math.random() * 10));

      if (idx <= baseIdx) continue;

      const seg = Road.getSegment(idx);
      if (!seg) continue;

      const type   = Utils.randomChoice(CONFIG.TRAFFIC_TYPES);
      const offset = Utils.randomFloat(-0.7, 0.7);
      const spd    = Utils.randomFloat(CONFIG.TRAFFIC_SPEED_MIN, CONFIG.TRAFFIC_SPEED_MAX) * playerSpeed;

      this.cars.push({
        z:      idx * segLen + segLen / 2,
        x:      offset,
        speed:  Math.max(20, spd),
        type,
        width:  type === 'truck' ? 200 : type === 'sports' ? 120 : 150,
        height: type === 'truck' ? 80  : type === 'sports' ? 45  : 60,
        color:  TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)],
        offset, // lateral (-1..1 road fraction)
      });
    }

    // ── Advance car positions ─────────────────────────────
    // Traffic cars move at their own speed; player passes them
    for (const car of this.cars) {
      // Cars move forward at their speed (dt is not passed here;
      // we handle it from main.js via update delta approach)
      // For simplicity, car.z is set from segment + stays fixed
      // (they appear as static hazards at different speeds relative to player)
    }

    // ── Despawn cars well behind player ──────────────────
    this.cars = this.cars.filter(c => c.z > playerZ - despawnBehind * segLen);

    // ── Assign cars to segments ───────────────────────────
    for (const car of this.cars) {
      const idx = Math.floor(car.z / segLen);
      const seg = Road.getSegment(idx);
      if (seg) seg.cars.push(car);
    }
  }

  // Proper delta-time car movement
  tick(dt) {
    for (const car of this.cars) {
      car.z += car.speed * dt;
    }
  }

  checkCollision(player, roadWidthMult) {
    const playerSeg = Math.floor(player.z / CONFIG.SEGMENT_LENGTH);
    const lookAhead = 3;
    const rw = roadWidthMult;

    for (const car of this.cars) {
      const carSeg = Math.floor(car.z / CONFIG.SEGMENT_LENGTH);
      if (carSeg < playerSeg - 1 || carSeg > playerSeg + lookAhead) continue;

      // Lateral overlap test (road-relative coords)
      const dx = Math.abs(player.x - car.x * rw);
      const combinedHalf = player.hitWidth * rw + (car.width / CONFIG.ROAD_WIDTH) * rw;

      if (dx < combinedHalf) {
        // Z overlap: player front vs car back
        const dz = Math.abs(player.z - car.z);
        if (dz < CONFIG.SEGMENT_LENGTH * 0.8) {
          return car;
        }
      }
    }
    return null;
  }
}

const TRAFFIC_COLORS = [
  '#3388ff', '#ff3333', '#33cc33', '#ffcc00', '#cc44cc',
  '#ff8800', '#00cccc', '#888888', '#ffffff', '#444444',
];

// ── Pickup Manager ──────────────────────────────────────────
class PickupManager {
  constructor() {
    this.nextPickupIdx = 0;
    this.interval = CONFIG.FUEL_PICKUP_INTERVAL;
  }

  reset() {
    this.nextPickupIdx = 0;
    this.interval = CONFIG.FUEL_PICKUP_INTERVAL;
    // Clear any existing pickups on segments
    for (const seg of Road.getSegments()) {
      if (seg) seg.pickup = null;
    }
  }

  update(playerZ) {
    const baseIdx = Math.floor(playerZ / CONFIG.SEGMENT_LENGTH);
    const aheadIdx = baseIdx + CONFIG.DRAW_DISTANCE + 20;

    // Spawn pickups ahead
    while (this.nextPickupIdx < aheadIdx) {
      const seg = Road.getSegment(this.nextPickupIdx);
      if (seg) {
        seg.pickup = {
          z:       this.nextPickupIdx * CONFIG.SEGMENT_LENGTH,
          offset:  Utils.randomFloat(-0.6, 0.6),
          amount:  CONFIG.FUEL_PICKUP_AMOUNT,
          collected: false,
        };
      }
      this.nextPickupIdx += this.interval;
    }
  }

  checkCollection(player, roadWidthMult) {
    const idx = Math.floor(player.z / CONFIG.SEGMENT_LENGTH);
    const rw  = roadWidthMult;
    const magnetRange = player.magnetRange;

    for (let i = idx - 1; i <= idx + 2; i++) {
      const seg = Road.getSegment(i);
      if (!seg || !seg.pickup || seg.pickup.collected) continue;

      const pu = seg.pickup;
      const dx = Math.abs(player.x - pu.offset * rw);
      const dz = Math.abs(player.z - pu.z);

      const collectRange = magnetRange > 0
        ? CONFIG.ROAD_WIDTH * 0.4 * rw + magnetRange
        : CONFIG.ROAD_WIDTH * 0.06 * rw;

      if (dx < collectRange && dz < CONFIG.SEGMENT_LENGTH) {
        pu.collected = true;
        seg.pickup   = null;
        return pu.amount;
      }
    }
    return 0;
  }
}
