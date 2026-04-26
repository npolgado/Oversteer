// screenFx.ts — Transient screen effects: shake, flash, slowmo, freeze, desaturation.
// Ported from arena-drifter/fx.js:268-390 (source of truth for all numeric values).
// Vignette ported from arena-drifter/fx.js:51-61.

import { Graphics, Container, Sprite, getCanvasTexture, type Renderer } from 'pixi.js';
import { CFG } from '@core/config';
import { lerp } from '@core/utils';

export class ScreenFX {
  // Shake
  private _shakeIntensity = 0;
  private _shakeDuration = 0;
  private _shakeTimer = 0;
  private _shakeDirX = 0;
  private _shakeDirY = 0;

  // Flash
  private _flashColor = 0x000000;
  private _flashAlpha = 0;
  private _flashTimer = 0;

  // Zoom pulse (additive multiplier on top of camera base zoom)
  private _zoomPulse = 1;
  private _zoomTarget = 1;
  private _zoomTimer = 0;

  // Time dilation (slowmo)
  private _timeDilation = 1;
  private _timeTimer = 0;

  // Freeze
  private _freezeTimer = 0;

  // Desaturation (lerps toward target)
  private _desatAmount = 0;
  private _desatTarget = 0;

  // PixiJS overlay graphics on screenFxContainer
  private _flashGfx: Graphics;
  private _desatGfx: Graphics;
  private _container: Container;
  private _vignetteSprite: Sprite | null = null;

  constructor(screenFxContainer: Container, renderer?: Renderer) {
    this._container = screenFxContainer;
    this._flashGfx = new Graphics();
    this._desatGfx = new Graphics();
    // Vignette sits behind flash/desat; speed lines (SpeedLines class) sit on top.
    if (renderer) this._vignetteSprite = this._buildVignette(renderer, screenFxContainer);
    screenFxContainer.addChild(this._flashGfx, this._desatGfx);
  }

  // Port of arena-drifter/fx.js:51-61 — radial gradient from transparent center to dark edges.
  private _buildVignette(_renderer: Renderer, container: Container): Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = CFG.W;
    canvas.height = CFG.H;
    const cx = canvas.getContext('2d')!;
    const vig = cx.createRadialGradient(
      CFG.W / 2, CFG.H / 2, CFG.H * CFG.VIGNETTE_INNER,
      CFG.W / 2, CFG.H / 2, CFG.W * CFG.VIGNETTE_OUTER,
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(0,0,0,${CFG.VIGNETTE_ALPHA})`);
    cx.fillStyle = vig;
    cx.fillRect(0, 0, CFG.W, CFG.H);
    const tex = getCanvasTexture(canvas);
    const spr = new Sprite(tex);
    container.addChildAt(spr, 0); // behind flash and desat
    return spr;
  }

  shake(intensity: number, dur: number, dirX = 0, dirY = 0): void {
    this._shakeIntensity = intensity;
    this._shakeDuration = dur;
    this._shakeTimer = dur;
    this._shakeDirX = dirX;
    this._shakeDirY = dirY;
  }

  flash(color: number, alpha: number, dur: number): void {
    this._flashColor = color;
    this._flashAlpha = alpha;
    this._flashTimer = dur;
  }

  zoom(target: number, dur: number): void {
    this._zoomTarget = target;
    this._zoomTimer = dur;
  }

  slowmo(factor: number, dur: number): void {
    this._timeDilation = factor;
    this._timeTimer = dur;
  }

  freeze(dur: number): void {
    this._freezeTimer = dur;
  }

  desaturate(target: number): void {
    this._desatTarget = target;
  }

  reset(): void {
    this._shakeTimer = 0;
    this._flashTimer = 0;
    this._zoomPulse = 1; this._zoomTarget = 1; this._zoomTimer = 0;
    this._timeDilation = 1; this._timeTimer = 0;
    this._desatAmount = 0; this._desatTarget = 0;
    this._freezeTimer = 0;
    this._flashGfx.clear();
    this._desatGfx.clear();
  }

  /**
   * Advance all effect timers. Returns dilated dt (0 during freeze).
   * Match arena-drifter/fx.js:326-349.
   */
  update(rawDt: number): number {
    if (this._freezeTimer > 0) {
      this._freezeTimer -= rawDt;
      this._renderOverlays();
      return 0;
    }

    if (this._shakeTimer > 0) this._shakeTimer -= rawDt;
    if (this._flashTimer > 0) this._flashTimer -= rawDt;

    if (this._zoomTimer > 0) {
      this._zoomPulse = lerp(this._zoomPulse, this._zoomTarget, 0.15);
      this._zoomTimer -= rawDt;
    } else {
      this._zoomPulse = lerp(this._zoomPulse, 1, 0.15);
    }

    if (this._timeTimer > 0) {
      this._timeTimer -= rawDt;
    } else {
      this._timeDilation = lerp(this._timeDilation, 1, 0.1);
    }

    this._desatAmount = lerp(this._desatAmount, this._desatTarget, 0.05);

    this._renderOverlays();

    return rawDt * this._timeDilation;
  }

  /**
   * Apply shake offset and zoom pulse to worldContainer AFTER camera has set its transform.
   * Camera sets worldContainer.position and worldContainer.scale; we offset both here.
   */
  applyToContainer(worldContainer: Container): void {
    // Shake offset (with optional directional bias — fx.js:354-362)
    if (this._shakeTimer > 0 && this._shakeDuration > 0) {
      const frac = this._shakeTimer / this._shakeDuration;
      const mag = this._shakeIntensity * frac;
      let ox = (Math.random() * 2 - 1) * mag;
      let oy = (Math.random() * 2 - 1) * mag;
      if (this._shakeDirX || this._shakeDirY) {
        ox = ox * 0.3 + this._shakeDirX * mag * 0.7;
        oy = oy * 0.3 + this._shakeDirY * mag * 0.7;
      }
      worldContainer.position.x += ox;
      worldContainer.position.y += oy;
    }

    // Zoom pulse: multiplicative on top of camera scale
    if (Math.abs(this._zoomPulse - 1) > 0.001) {
      worldContainer.scale.x *= this._zoomPulse;
      worldContainer.scale.y *= this._zoomPulse;
    }
  }

  private _renderOverlays(): void {
    // Flash overlay
    this._flashGfx.clear();
    if (this._flashTimer > 0) {
      this._flashGfx
        .rect(0, 0, CFG.W, CFG.H)
        .fill({ color: this._flashColor, alpha: this._flashAlpha });
    }

    // Desaturation overlay (matches original: dark panel fill at desatAmount alpha)
    this._desatGfx.clear();
    if (this._desatAmount > 0.01) {
      this._desatGfx
        .rect(0, 0, CFG.W, CFG.H)
        .fill({ color: 0x1A2233, alpha: this._desatAmount }); // CFG.C_PANEL = '#1A2233'
    }
  }

  destroy(): void {
    this._flashGfx.destroy();
    this._desatGfx.destroy();
    this._vignetteSprite?.destroy();
  }
}
