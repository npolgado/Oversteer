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
  enter: boolean;   // CONFIRM / SELECT — edge-triggered (A button on gamepad)
  reroll: boolean;  // REROLL   — edge-triggered
  select1: boolean; // Digit1/Numpad1 — edge-triggered (upgrade card 1)
  select2: boolean; // Digit2/Numpad2 — edge-triggered (upgrade card 2)
  select3: boolean; // Digit3/Numpad3 — edge-triggered (upgrade card 3)
  menuLeft: boolean;  // KeyA / ArrowLeft / D-Pad Left — edge-triggered (cycle map left)
  menuRight: boolean; // KeyD / ArrowRight / D-Pad Right — edge-triggered (cycle map right)
  menuUp: boolean;    // ArrowUp / D-Pad Up — edge-triggered (focus cursor up)
  menuDown: boolean;  // ArrowDown / D-Pad Down — edge-triggered (focus cursor down)
  menuLaunch: boolean; // Enter / gamepad Start — edge-triggered (play / confirm)
  menuMod1: boolean;  // Digit1 in menu context — edge-triggered (keyboard only)
  menuMod2: boolean;  // Digit2 in menu context — edge-triggered (keyboard only)
  menuMod3: boolean;  // Digit3 in menu context — edge-triggered (keyboard only)
  menuMod4: boolean;  // Digit4 in menu context — edge-triggered (keyboard only)
  toggleSandbox: boolean; // KeyS — edge-triggered, keyboard only (sandbox toggle in map select)
  mute: boolean;    // KeyM — edge-triggered (mute toggle)
  sfxDown: boolean; // BracketLeft  '[' — edge-triggered (SFX volume down)
  sfxUp: boolean;   // BracketRight ']' — edge-triggered (SFX volume up)
  musicDown: boolean; // Minus '-' — edge-triggered (music volume down)
  musicUp: boolean;   // Equal '=' — edge-triggered (music volume up)
  escape: boolean;  // Escape / gamepad B — edge-triggered (back/cancel)
  perfToggle: boolean; // F3 — edge-triggered
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

export class InputManager {
  // Raw key map: code → held
  private _keys: Record<string, boolean> = {};

  // Edge-detection previous state
  private _pausePressed = false;
  private _rerollPressed = false;
  private _select1Pressed = false;
  private _select2Pressed = false;
  private _select3Pressed = false;
  private _menuLeftPressed = false;
  private _menuRightPressed = false;
  private _menuMod1Pressed = false;
  private _menuMod2Pressed = false;
  private _menuMod3Pressed = false;
  private _menuMod4Pressed = false;
  private _menuUpPressed = false;
  private _menuDownPressed = false;
  private _menuLaunchPressed = false;
  private _sandboxTogglePressed = false;
  private _mutePressed = false;
  private _sfxDownPressed = false;
  private _sfxUpPressed = false;
  private _musicDownPressed = false;
  private _musicUpPressed = false;
  private _escapePressed = false;
  private _f3Pressed = false;

  /** When non-null, poll() returns this instead of reading real input. Used by benchmark mode. */
  overrideState: InputState | null = null;

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

  // NOTE: not in original — hasTouched + virtual stick getters are a TS-port addition (mobile UI).
  // Tracks if the device has been touched at least once
  private _hasTouched: boolean = false;

  // Canvas reference — set during init()
  private _canvas: HTMLCanvasElement | null = null;

  // NOTE: not in original — gamepad state is a TS-port addition; arena-drifter has no Gamepad API.
  // Gamepad state (continuous fields only)
  private _gpState: Partial<InputState> = {};

  // Gamepad previous frame button states (for edge detection)
  private _gpPrev: boolean[] = [];

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

    // NOTE: not in original — gamepad event listeners.
    window.addEventListener('gamepadconnected', () => { this._gpPrev = []; this._gpState = {}; });
    window.addEventListener('gamepaddisconnected', () => { this._gpPrev = []; this._gpState = {}; });

    if (this._canvas) {
      this._canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
      this._canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
      this._canvas.addEventListener('touchend', this._onTouchEnd, { passive: false });
      this._canvas.addEventListener('touchcancel', this._onTouchEnd, { passive: false });
      this._canvas.addEventListener('mousedown', this._onMouseDown);
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

  /** Converts client coordinates to game-space (reference resolution: CFG.W × CFG.H). */
  private _getCanvasPos(clientX: number, clientY: number, canvas: HTMLCanvasElement): Vec2 {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * CFG.W,
      y: ((clientY - r.top) / r.height) * CFG.H,
    };
  }

  /**
   * Converts a Touch's clientX/Y to game-space coordinates
   * (reference resolution: CFG.W × CFG.H, default 1600×900).
   */
  private _getTouchPos(touch: Touch, canvas: HTMLCanvasElement): Vec2 {
    return this._getCanvasPos(touch.clientX, touch.clientY, canvas);
  }

  // ---------------------------------------------------------------------------
  // Touch handlers
  // ---------------------------------------------------------------------------

  private _onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    this._fireFirstInteraction();
    this._hasTouched = true;
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

  // NOTE: not in original — mouse click support for desktop shop/UI interaction.
  private _onMouseDown = (e: MouseEvent): void => {
    if (!this._canvas) return;
    if (e.button !== 0) return; // left-click only; right/middle clicks must not fire UI taps
    e.preventDefault();
    this._fireFirstInteraction();
    const t = this._touch;
    t.tap = this._getCanvasPos(e.clientX, e.clientY, this._canvas);
    t.tapAge = 0;
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
  // Public getters — NOTE: not in original (virtual stick + touch state exposed for MobileControls)
  // ---------------------------------------------------------------------------

  /** Returns true if the device has been touched at least once. */
  get hasTouched(): boolean {
    return this._hasTouched;
  }

  /** Returns the virtual stick's origin position (where it was placed). */
  get stickOrigin(): Vec2 | null {
    return this._touch.stickOrigin;
  }

  /** Returns the virtual stick's current position (offset from origin). */
  get stickPos(): Vec2 | null {
    return this._touch.stickPos;
  }

  /** Returns true when a drift button touch is active. */
  get driftActive(): boolean {
    return this._touch.driftId !== null;
  }

  // ---------------------------------------------------------------------------
  // Gamepad private helper — NOTE: not in original (full gamepad support is a TS-port addition)
  // ---------------------------------------------------------------------------

  /**
   * Returns true if button at index is pressed this frame AND was not pressed last frame.
   */
  private _gpEdge(gp: Gamepad, index: number): boolean {
    const pressed = !!gp.buttons[index]?.pressed;
    const prev = !!this._gpPrev[index];
    return pressed && !prev;
  }

  /**
   * Polls the first connected gamepad and populates _gpState.
   * Rocket League-style scheme: left stick X steers, triggers throttle/brake, LB drifts.
   */
  private _pollGamepad(): void {
    const gps = navigator.getGamepads();
    const gp = gps[0];

    if (!gp) {
      this._gpPrev = [];
      this._gpState = {};
      return;
    }

    // Left stick X → steer. Y axis is NOT used for driving (triggers handle that).
    const ax = gp.axes[0];
    this._gpState.left  = ax < -0.15;
    this._gpState.right = ax > 0.15;
    this._gpState.up    = !!gp.buttons[7]?.pressed;   // RT  — throttle (continuous)
    this._gpState.down  = !!gp.buttons[6]?.pressed;   // LT  — brake/reverse (continuous)
    this._gpState.drift = !!gp.buttons[4]?.pressed;   // LB  — drift (continuous)

    this._gpState.pause      = this._gpEdge(gp, 9);   // Start — pause in-game
    this._gpState.menuLaunch = this._gpEdge(gp, 9);   // Start — also play/confirm in menus
    this._gpState.enter      = this._gpEdge(gp, 0);   // A — select/toggle in menus
    this._gpState.select1    = this._gpEdge(gp, 0);   // A — upgrade card 1 (different scene, no conflict)
    this._gpState.escape     = this._gpEdge(gp, 1);   // B — back/cancel
    this._gpState.select2    = this._gpEdge(gp, 2);   // X — upgrade card 2
    this._gpState.select3    = this._gpEdge(gp, 3);   // Y — upgrade card 3
    this._gpState.reroll     = this._gpEdge(gp, 5);   // RB — reroll (no conflict with select3)
    this._gpState.menuLeft   = this._gpEdge(gp, 14);  // D-Pad Left  — cycle map
    this._gpState.menuRight  = this._gpEdge(gp, 15);  // D-Pad Right — cycle map
    this._gpState.menuUp     = this._gpEdge(gp, 12);  // D-Pad Up    — focus cursor up
    this._gpState.menuDown   = this._gpEdge(gp, 13);  // D-Pad Down  — focus cursor down

    // Any gamepad activity counts as user gesture for AudioContext unlock
    if (gp.buttons.some(b => b.pressed) || Math.abs(ax) > 0.15 || Math.abs(gp.axes[1]) > 0.15) {
      this._fireFirstInteraction();
    }

    // Update previous button states
    this._gpPrev = Array.from(gp.buttons).map(b => b.pressed);
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
    if (this.overrideState !== null) return this.overrideState;
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

    // --- Edge-triggered: enter / confirm (gamepad A only — keyboard Enter fires menuLaunch instead) ---
    let enter = false;

    // --- Edge-triggered: reroll ---
    const rNow = !!k['KeyR'];
    let reroll = rNow && !this._rerollPressed;
    this._rerollPressed = rNow;

    // --- Edge-triggered: upgrade card selection (Digit/Numpad 1-3) ---
    const s1Now = !!(k['Digit1'] || k['Numpad1']);
    let select1 = s1Now && !this._select1Pressed;
    this._select1Pressed = s1Now;

    const s2Now = !!(k['Digit2'] || k['Numpad2']);
    let select2 = s2Now && !this._select2Pressed;
    this._select2Pressed = s2Now;

    const s3Now = !!(k['Digit3'] || k['Numpad3']);
    let select3 = s3Now && !this._select3Pressed;
    this._select3Pressed = s3Now;

    // --- Edge-triggered: menu navigation ---
    const mlNow = !!(k['KeyA'] || k['ArrowLeft']);
    let menuLeft = mlNow && !this._menuLeftPressed;
    this._menuLeftPressed = mlNow;

    const mrNow = !!(k['KeyD'] || k['ArrowRight']);
    let menuRight = mrNow && !this._menuRightPressed;
    this._menuRightPressed = mrNow;

    const muNow = !!k['ArrowUp'];
    let menuUp = muNow && !this._menuUpPressed;
    this._menuUpPressed = muNow;

    const mdNow = !!k['ArrowDown'];
    let menuDown = mdNow && !this._menuDownPressed;
    this._menuDownPressed = mdNow;

    // keyboard Enter → menuLaunch only (enter is reserved for gamepad A)
    const eNow = !!k['Enter'];
    let menuLaunch = eNow && !this._menuLaunchPressed;
    this._menuLaunchPressed = eNow;

    // --- Edge-triggered: sandbox toggle (KeyS, keyboard only; KeyS also fires down=brake — each scene reads only what it needs) ---
    const sbNow = !!k['KeyS'];
    let toggleSandbox = sbNow && !this._sandboxTogglePressed;
    this._sandboxTogglePressed = sbNow;

    // --- Edge-triggered: menu modifier toggles (Digit 1-4, separate from select1-3) ---
    const mm1Now = !!k['Digit1'];
    let menuMod1 = mm1Now && !this._menuMod1Pressed;
    this._menuMod1Pressed = mm1Now;

    const mm2Now = !!k['Digit2'];
    let menuMod2 = mm2Now && !this._menuMod2Pressed;
    this._menuMod2Pressed = mm2Now;

    const mm3Now = !!k['Digit3'];
    let menuMod3 = mm3Now && !this._menuMod3Pressed;
    this._menuMod3Pressed = mm3Now;

    const mm4Now = !!k['Digit4'];
    let menuMod4 = mm4Now && !this._menuMod4Pressed;
    this._menuMod4Pressed = mm4Now;

    // --- Edge-triggered: mute ---
    const muteNow = !!k['KeyM'];
    const mute = muteNow && !this._mutePressed;
    this._mutePressed = muteNow;

    // --- Edge-triggered: volume controls ---
    const sfxDownNow = !!k['BracketLeft'];
    const sfxDown = sfxDownNow && !this._sfxDownPressed;
    this._sfxDownPressed = sfxDownNow;

    const sfxUpNow = !!k['BracketRight'];
    const sfxUp = sfxUpNow && !this._sfxUpPressed;
    this._sfxUpPressed = sfxUpNow;

    const musicDownNow = !!k['Minus'];
    const musicDown = musicDownNow && !this._musicDownPressed;
    this._musicDownPressed = musicDownNow;

    const musicUpNow = !!k['Equal'];
    const musicUp = musicUpNow && !this._musicUpPressed;
    this._musicUpPressed = musicUpNow;

    // --- Edge-triggered: escape (Escape key / gamepad B — back-navigation) ---
    const escNow = !!k['Escape'];
    let escape = escNow && !this._escapePressed;
    this._escapePressed = escNow;

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

    // --- Edge-triggered: perf overlay toggle (F3) ---
    const f3Now = !!k['F3'];
    const perfToggle = f3Now && !this._f3Pressed;
    this._f3Pressed = f3Now;

    // NOTE: not in original — merge gamepad state into keyboard state.
    this._pollGamepad();

    up    = up    || !!this._gpState.up;
    down  = down  || !!this._gpState.down;
    left  = left  || !!this._gpState.left;
    right = right || !!this._gpState.right;
    drift = drift || !!this._gpState.drift;

    pauseOut   = pauseOut   || !!this._gpState.pause;
    enter      = enter      || !!this._gpState.enter;
    reroll     = reroll     || !!this._gpState.reroll;
    select1    = select1    || !!this._gpState.select1;
    select2    = select2    || !!this._gpState.select2;
    select3    = select3    || !!this._gpState.select3;
    escape     = escape     || !!this._gpState.escape;
    menuLeft   = menuLeft   || !!this._gpState.menuLeft;
    menuRight  = menuRight  || !!this._gpState.menuRight;
    menuUp     = menuUp     || !!this._gpState.menuUp;
    menuDown   = menuDown   || !!this._gpState.menuDown;
    menuLaunch = menuLaunch || !!this._gpState.menuLaunch;
    // menuMod1-4 are keyboard-only (D-pad now drives menuUp/Down/Left/Right)

    return {
      up, down, left, right, drift,
      pause: pauseOut, enter, reroll,
      select1, select2, select3,
      escape,
      menuLeft, menuRight, menuUp, menuDown, menuLaunch,
      menuMod1, menuMod2, menuMod3, menuMod4,
      toggleSandbox,
      mute, sfxDown, sfxUp, musicDown, musicUp,
      perfToggle,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const inputManager = new InputManager();
