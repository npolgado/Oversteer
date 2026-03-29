// propsRenderer.ts — PixiJS renderer for the props system.
// Renders all props once via setProps(); no per-frame update needed.

import { Sprite, Graphics, Assets } from 'pixi.js';
import type { Container } from 'pixi.js';
import type { Prop } from './propsSystem';

const FALLBACK_COLORS: Record<string, number> = {
  solid: 0x228833,
  slow: 0x8b4513,
  slip: 0x4488ff,
  decoration: 0x44aa44,
};

export class PropsRenderer {
  private _layer: Container;

  constructor(layers: { propsLayer: Container }) {
    this._layer = layers.propsLayer;
  }

  setProps(props: Prop[]): void {
    this._layer.removeChildren();

    for (const prop of props) {
      const texture = Assets.get(prop.textureKey);
      if (texture) {
        const s = new Sprite(texture);
        s.anchor.set(0.5);
        s.width = prop.radius * 2;
        s.height = prop.radius * 2;
        s.x = prop.x;
        s.y = prop.y;
        this._layer.addChild(s);
      } else {
        const isRock = prop.textureKey.includes('rock');
        const color = isRock ? 0x888888 : (FALLBACK_COLORS[prop.type] ?? 0x888888);
        const g = new Graphics();
        g.circle(0, 0, prop.radius).fill({ color });
        g.x = prop.x;
        g.y = prop.y;
        this._layer.addChild(g);
      }
    }
  }

  destroy(): void {
    this._layer.removeChildren();
  }
}
