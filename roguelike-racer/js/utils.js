// ============================================================
// Road Rogue - Utility Functions
// ============================================================
const Utils = {

  lerp(a, b, t) { return a + (b - a) * t; },

  clamp(v, min, max) { return Math.max(min, Math.min(max, v)); },

  randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },

  randomFloat(min, max) { return Math.random() * (max - min) + min; },

  randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  // Sample without replacement
  randomSample(arr, n) {
    const copy = arr.slice();
    const out = [];
    for (let i = 0; i < n && copy.length > 0; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      out.push(copy.splice(idx, 1)[0]);
    }
    return out;
  },

  // Approach `target` from `current` at rate `step` (delta-time aware)
  approach(current, target, step) {
    if (current < target) return Math.min(current + step, target);
    if (current > target) return Math.max(current - step, target);
    return target;
  },

  // Fog factor: 1 = fully visible, 0 = fully fogged
  fogFactor(n, drawDistance, density) {
    const t = n / drawDistance;
    return Math.max(0, 1 - t * t * density);
  },

  // Project a world point to screen space (pseudo-3D)
  // Returns { sx, sy, sw, scale } or null if behind camera
  project(worldX, worldY, worldZ, cameraX, cameraY, cameraZ, W, H) {
    const camZ = worldZ - cameraZ;
    if (camZ <= 0) return null;
    const scale = CONFIG.CAMERA_DEPTH / camZ;
    const sx = Math.round(W / 2 + scale * (worldX - cameraX) * W / 2);
    const sy = Math.round(H / 2 - scale * (worldY - cameraY) * H / 2);
    const sw = Math.round(scale * CONFIG.ROAD_WIDTH * W / 2);
    return { sx, sy, sw, scale, camZ };
  },

  // Draw a filled trapezoid (road segment)
  drawTrap(ctx, x1, y1, w1, x2, y2, w2, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1 - w1, y1);
    ctx.lineTo(x1 + w1, y1);
    ctx.lineTo(x2 + w2, y2);
    ctx.lineTo(x2 - w2, y2);
    ctx.closePath();
    ctx.fill();
  },

  // Draw rectangle
  rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  },

  // Draw text with optional shadow
  text(ctx, str, x, y, opts = {}) {
    const {
      color    = '#ffffff',
      size     = 18,
      align    = 'left',
      shadow   = false,
      bold     = false,
    } = opts;
    ctx.font = `${bold ? 'bold ' : ''}${size}px 'Courier New', monospace`;
    ctx.textAlign = align;
    if (shadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(str, x + 2, y + 2);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  },

  // Rounded rectangle path
  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  },

  formatDist(m) {
    if (m >= 1000) return (m / 1000).toFixed(2) + 'km';
    return Math.floor(m) + 'm';
  },

  formatSpeed(v) { return Math.floor(v * 0.36) + 'km/h'; },  // world-units/s → km/h (×3.6 / 10)
};
