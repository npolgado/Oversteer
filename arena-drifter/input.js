// input.js — Assets (sprite loader) and Input (keyboard/touch)
(function() {
  'use strict';
  const { CFG, S } = window.OversteerLogic;

  // ── ASSET MANAGER ───────────────────────────────────────────
  const Assets = {
    _cache: {},
    _basePath: 'assets/',

    load(path) {
      if (this._cache[path]) return this._cache[path];
      const img = new Image();
      img.src = this._basePath + path;
      img._loaded = false;
      img.onload = () => { img._loaded = true; };
      img.onerror = () => { img._loaded = false; };
      this._cache[path] = img;
      return img;
    },

    drawOrFallback(ctx, path, x, y, w, h, fallbackFn) {
      const img = this._cache[path];
      if (img && img._loaded) {
        ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
        return true;
      }
      fallbackFn(ctx);
      return false;
    },

    preload(paths) {
      for (const p of paths) this.load(p);
    },
  };

  // Preload configured sprites
  Assets.preload([
    CFG.PLAYER_SPRITE,
    ...Object.values(CFG.ENEMY_SPRITES_BY_TYPE).flat(),
    ...CFG.PROP_POOL.map(p => p.image),
    CFG.BACKGROUND_SPRITE,
    'backgrounds/background_02.png',
  ]);

  // ── INPUT ────────────────────────────────────────────────────
  const Input = {
    keys: {},
    up: false, down: false, left: false, right: false,
    drift: false, pause: false, enter: false,
    _pausePressed: false, _enterPressed: false,
    // Touch state
    touch: { active: false, stickId: null, stickOrigin: null, stickPos: null, driftId: null, pauseTap: false, tap: null, tapAge: 0 },

    init() {
      document.addEventListener('keydown', e => {
        Input.keys[e.code] = true;
        window.Audio._resumeCtx();
        e.preventDefault();
      });
      document.addEventListener('keyup', e => {
        Input.keys[e.code] = false;
      });
      // Touch controls
      const cv = document.getElementById('c');
      cv.addEventListener('touchstart', e => { e.preventDefault(); window.Audio._resumeCtx(); Input._touchStart(e); }, { passive: false });
      cv.addEventListener('touchmove', e => { e.preventDefault(); Input._touchMove(e); }, { passive: false });
      cv.addEventListener('touchend', e => { e.preventDefault(); Input._touchEnd(e); }, { passive: false });
      cv.addEventListener('touchcancel', e => { e.preventDefault(); Input._touchEnd(e); }, { passive: false });
    },

    _getTouchPos(t) {
      const cv = document.getElementById('c');
      const r = cv.getBoundingClientRect();
      return {
        x: (t.clientX - r.left) / r.width * CFG.W,
        y: (t.clientY - r.top) / r.height * CFG.H
      };
    },

    _touchStart(e) {
      const t = this.touch;
      // Two-finger = pause
      if (e.touches.length >= 2) { t.pauseTap = true; return; }
      for (const touch of e.changedTouches) {
        const p = this._getTouchPos(touch);
        if (p.x < CFG.W / 2) {
          // Left side = stick
          t.active = true;
          t.stickId = touch.identifier;
          t.stickOrigin = { x: p.x, y: p.y };
          t.stickPos = { x: p.x, y: p.y };
        } else {
          // Right side = drift
          t.driftId = touch.identifier;
        }
      }
    },

    _touchMove(e) {
      const t = this.touch;
      for (const touch of e.changedTouches) {
        if (touch.identifier === t.stickId) {
          t.stickPos = this._getTouchPos(touch);
        }
      }
    },

    _touchEnd(e) {
      const t = this.touch;
      for (const touch of e.changedTouches) {
        t.tap = this._getTouchPos(touch);
        t.tapAge = 0;
        if (touch.identifier === t.stickId) {
          t.stickId = null; t.stickOrigin = null; t.stickPos = null; t.active = false;
        }
        if (touch.identifier === t.driftId) {
          t.driftId = null;
        }
      }
    },

    consumeTap() {
      const t = this.touch;
      if (!t.tap) return null;
      const tap = t.tap;
      t.tap = null;
      t.tapAge = 0;
      return tap;
    },

    poll() {
      const k = this.keys;
      this.up = !!(k['ArrowUp'] || k['KeyW']);
      this.down = !!(k['ArrowDown'] || k['KeyS']);
      this.left = !!(k['ArrowLeft'] || k['KeyA']);
      this.right = !!(k['ArrowRight'] || k['KeyD']);
      this.drift = !!k['Space'];

      // Touch stick
      const t = this.touch;
      if (t.stickOrigin && t.stickPos) {
        const dx = t.stickPos.x - t.stickOrigin.x;
        const dy = t.stickPos.y - t.stickOrigin.y;
        const mag = Math.hypot(dx, dy);
        if (mag > S(15)) {
          const angle = Math.atan2(dy, dx);
          this.up = this.up || dy < -S(15);
          this.down = this.down || dy > S(15);
          this.left = this.left || dx < -S(15);
          this.right = this.right || dx > S(15);
        }
      }
      if (t.driftId !== null) this.drift = true;

      // Edge-triggered pause
      const pNow = !!(k['KeyP'] || k['Escape']);
      this.pause = pNow && !this._pausePressed;
      this._pausePressed = pNow;

      // Edge-triggered enter
      const eNow = !!k['Enter'];
      this.enter = eNow && !this._enterPressed;
      this._enterPressed = eNow;

      // Touch pause
      if (t.pauseTap) { this.pause = true; t.pauseTap = false; }

      if (t.tap) {
        t.tapAge = (t.tapAge || 0) + 1;
        if (t.tapAge > 1) {
          t.tap = null;
          t.tapAge = 0;
        }
      }
    },
  };

  window.Assets = Assets;
  window.Input = Input;
})();
