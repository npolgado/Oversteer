// inputManager.ts — Ported from arena-drifter/input.js
// Handles keyboard + touch input and exposes a polled InputState each frame.

import { CFG } from '@core/config';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export enum InputAction {
  ACCELERATE = 'ACCELERATE',
  BRAKE = 'BRAKE',
  STEER_LEFT = 'STEER_LEFT',
  STEER_RIGHT = 'STEER_RIGHT',
  DRIFT = 'DRIFT',
  PAUSE = 'PAUSE',
  CONFIRM = 'CONFIRM',
  REROLL = 'REROLL',
}

export interface InputState {
  up: boolean;      // ACCELERATE
  down: boolean;    // BRAKE
  left: boolean;    // STEER_LEFT
  right: boolean;   // STEER_RIGHT
  drift: boolean;   // DRIFT
  pause: boolean;   // PAUSE    — edge-triggered, true only on frame of press
  enter: boolean;   // CONFIRM  — edge-triggered
  reroll: boolean;  // REROLL   — edge-triggered
}

// ---------------------------------------------------------------------------
// Internal touch state
// ---------------------------------------------------------------------------

interface Vec2 { x: number; y: number; }

interface TouchState {
  active: boolean;
  stickId: number | null;
  stickOrigin: Vec2 | null;
  stickPos: Vec2 | null;
  driftId: number | null;
  pauseTap: boolean;
  tap: Vec2 | null;
  tapAge: number;
}

// Dead-zone threshold in reference-resolution pixels.
// Matches S(15) at 1:1 scale (1280-wide reference).
const STICK_DEAD_ZONE = 15;

// ---------------------------------------------------------------------------
// InputManager class
// ---------------------------------------------------------------------------

class InputManager {
  // Raw key map: code → held
  private _keys: Record<string, boolean> = {};

  // Edge-detection previous state
  private _pausePressed = false;
  private _enterPressed = false;
  private _rerollPressed = false;

  // Touch state
  private _touch: TouchState = {
    active: false,
    stickId: null,
    stickOrigin: null,
    stickPos: null,
    driftId: null,
    pauseTap: false,
    tap: null,
    tapAge: 0,
  };

  // Canvas reference — set during init()
  private _canvas: HTMLCanvasElement | null = null;

  // Optional callback fired once on the first keydown or touchstart.
  // Use this to resume an AudioContext after user interaction.
  onFirstInteraction: (() => void) | null = null;
  private _interactionFired = false;

  // ---------------------------------------------------------------------------
  // init
  // ---------------------------------------------------------------------------

  /** Bind all event listeners. Must be called after the canvas exists in DOM. */
  init(canvas?: HTMLCanvasElement): void {
    this._canvas =
      canvas ??
      (document.querySelector('canvas') as HTMLCanvasElement | null);

    if (!this._canvas) {
      console.warn('[InputManager] No canvas element found — touch input disabled.');
    }

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);

    if (this._canvas) {
      this._canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
      this._canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
      this._canvas.addEventListener('touchend', this._onTouchEnd, { passive: false });
      this._canvas.addEventListener('touchcancel', this._onTouchEnd, { passive: false });
    }
  }

  // ---------------------------------------------------------------------------
  // Keyboard handlers
  // ---------------------------------------------------------------------------

  private _onKeyDown = (e: KeyboardEvent): void => {
    this._keys[e.code] = true;
    this._fireFirstInteraction();
    e.preventDefault();
  };

  private _onKeyUp = (e: KeyboardEvent): void => {
    this._keys[e.code] = false;
  };

  // ---------------------------------------------------------------------------
  // Touch coordinate conversion
  // ---------------------------------------------------------------------------

  /**
   * Converts a Touch's clientX/Y to game-space coordinates
   * (reference resolution: CFG.W × CFG.H, default 1600×900).
   */
  private _getTouchPos(touch: Touch, canvas: HTMLCanvasElement): Vec2 {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((touch.clientX - r.left) / r.width) * CFG.W,
      y: ((touch.clientY - r.top) / r.height) * CFG.H,
    };
  }

  // ---------------------------------------------------------------------------
  // Touch handlers
  // ---------------------------------------------------------------------------

  private _onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    this._fireFirstInteraction();
    const t = this._touch;

    if (e.touches.length >= 2) {
      t.pauseTap = true;
      return;
    }

    for (const touch of Array.from(e.changedTouches)) {
      const p = this._getTouchPos(touch, this._canvas!);
      if (p.x < CFG.W / 2) {
        // Left half → virtual joystick
        t.active = true;
        t.stickId = touch.identifier;
        t.stickOrigin = { x: p.x, y: p.y };
        t.stickPos = { x: p.x, y: p.y };
      } else {
        // Right half → drift button
        t.driftId = touch.identifier;
      }
    }
  };

  private _onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    const t = this._touch;
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier === t.stickId) {
        t.stickPos = this._getTouchPos(touch, this._canvas!);
      }
    }
  };

  private _onTouchEnd = (e: TouchEvent): void => {
    e.preventDefault();
    const t = this._touch;
    for (const touch of Array.from(e.changedTouches)) {
      t.tap = this._getTouchPos(touch, this._canvas!);
      t.tapAge = 0;

      if (touch.identifier === t.stickId) {
        t.stickId = null;
        t.stickOrigin = null;
        t.stickPos = null;
        t.active = false;
      }
      if (touch.identifier === t.driftId) {
        t.driftId = null;
      }
    }
  };

  // ---------------------------------------------------------------------------
  // First-interaction callback
  // ---------------------------------------------------------------------------

  private _fireFirstInteraction(): void {
    if (!this._interactionFired && this.onFirstInteraction) {
      this._interactionFired = true;
      this.onFirstInteraction();
    }
  }

  // ---------------------------------------------------------------------------
  // Gamepad stub (Phase 0 — no processing)
  // ---------------------------------------------------------------------------

  private _pollGamepad(): void {
    // Stub: retrieve gamepad list to satisfy the browser permission model.
    // Full gamepad processing is deferred to a later phase.
    navigator.getGamepads();
  }

  // ---------------------------------------------------------------------------
  // consumeTap
  // ---------------------------------------------------------------------------

  /**
   * Returns and clears the most recent touch tap position (game-space coords),
   * or null if no tap is pending.
   */
  consumeTap(): Vec2 | null {
    const t = this._touch;
    if (!t.tap) return null;
    const tap = t.tap;
    t.tap = null;
    t.tapAge = 0;
    return tap;
  }

  // ---------------------------------------------------------------------------
  // poll — call once per frame, returns current InputState
  // ---------------------------------------------------------------------------

  poll(): InputState {
    const k = this._keys;
    const t = this._touch;

    // --- Continuous keys ---
    let up    = !!(k['ArrowUp']    || k['KeyW']);
    let down  = !!(k['ArrowDown']  || k['KeyS']);
    let left  = !!(k['ArrowLeft']  || k['KeyA']);
    let right = !!(k['ArrowRight'] || k['KeyD']);
    let drift = !!k['Space'];

    // --- Virtual joystick ---
    if (t.stickOrigin && t.stickPos) {
      const dx = t.stickPos.x - t.stickOrigin.x;
      const dy = t.stickPos.y - t.stickOrigin.y;
      const mag = Math.hypot(dx, dy);
      if (mag > STICK_DEAD_ZONE) {
        up    = up    || dy < -STICK_DEAD_ZONE;
        down  = down  || dy >  STICK_DEAD_ZONE;
        left  = left  || dx < -STICK_DEAD_ZONE;
        right = right || dx >  STICK_DEAD_ZONE;
      }
    }

    // Drift button (right-half touch)
    if (t.driftId !== null) drift = true;

    // --- Edge-triggered: pause ---
    const pNow = !!(k['KeyP'] || k['Escape']);
    const pause = pNow && !this._pausePressed;
    this._pausePressed = pNow;

    // --- Edge-triggered: enter / confirm ---
    const eNow = !!k['Enter'];
    const enter = eNow && !this._enterPressed;
    this._enterPressed = eNow;

    // --- Edge-triggered: reroll ---
    const rNow = !!k['KeyR'];
    const reroll = rNow && !this._rerollPressed;
    this._rerollPressed = rNow;

    // Two-finger tap → pause
    let pauseOut = pause;
    if (t.pauseTap) {
      pauseOut = true;
      t.pauseTap = false;
    }

    // Age the tap so it expires after one frame
    if (t.tap) {
      t.tapAge = (t.tapAge || 0) + 1;
      if (t.tapAge > 1) {
        t.tap = null;
        t.tapAge = 0;
      }
    }

    // Poll gamepad stub (no-op for now)
    this._pollGamepad();

    return { up, down, left, right, drift, pause: pauseOut, enter, reroll };
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const inputManager = new InputManager();
