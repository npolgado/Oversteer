// PerfOverlay.ts — In-game FPS/frame-time overlay. Toggle via F3 or pause menu.
import { Graphics, Text, TextStyle, Container } from 'pixi.js';
import { CFG, S } from '@core/config';

export class PerfOverlay {
  private _buf = new Float32Array(60);
  private _idx = 0;
  private _count = 0;
  private _container: Container;
  private _bg: Graphics;
  private _label: Text;
  enabled: boolean;

  constructor(hudLayer: Container) {
    const urlPeek = new URLSearchParams(location.search).get('perf') === '1';
    this.enabled = urlPeek || localStorage.getItem('oversteer_perf_v1') === 'true';
    if (urlPeek) localStorage.setItem('oversteer_perf_v1', 'true');

    this._container = new Container();
    this._container.visible = this.enabled;
    hudLayer.addChild(this._container);

    this._bg = new Graphics();
    this._container.addChild(this._bg);

    this._label = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'Courier New, monospace',
        fontSize: S(11),
        fill: '#00ff88',
        dropShadow: { color: '#000', blur: 2, distance: 1 },
      }),
    });
    this._label.anchor.set(1, 0);
    this._label.position.set(CFG.W - S(8), S(4));
    this._container.addChild(this._label);
  }

  record(dtMs: number): void {
    this._buf[this._idx] = dtMs;
    this._idx = (this._idx + 1) % 60;
    if (this._count < 60) this._count++;
  }

  avgFps(): number {
    if (!this._count) return 0;
    let sum = 0;
    for (let i = 0; i < this._count; i++) sum += this._buf[i];
    return 1000 / (sum / this._count);
  }

  worstMs(): number {
    let worst = 0;
    for (let i = 0; i < this._count; i++) {
      if (this._buf[i] > worst) worst = this._buf[i];
    }
    return worst;
  }

  toggle(): void {
    this.enabled = !this.enabled;
    this._container.visible = this.enabled;
    localStorage.setItem('oversteer_perf_v1', String(this.enabled));
  }

  /** Call every frame with raw wall-clock dt in milliseconds. */
  update(dtMs: number): void {
    this.record(dtMs);
    if (!this.enabled || !this._count) return;
    const fps = this.avgFps().toFixed(0);
    const worst = this.worstMs().toFixed(1);
    this._label.text = `FPS: ${fps}  worst: ${worst}ms`;
    const w = this._label.width + S(12);
    this._bg.clear();
    this._bg.rect(CFG.W - S(8) - w, S(2), w, S(16)).fill({ color: 0x000000, alpha: 0.55 });
  }

  destroy(): void {
    this._container.destroy({ children: true });
  }
}
