// propsRenderer.ts — PixiJS renderer for the props system.
// Renders all props once via setProps(); no per-frame update needed.

import { Sprite, Graphics, Assets } from 'pixi.js';
import type { Container } from 'pixi.js';
import type { Prop } from './propsSystem';
import { BOSS_ARENA_TEXTURE, BIOME_STRUCTURE_TEXTURE } from './bossArena';

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
      if (prop.textureKey === BOSS_ARENA_TEXTURE) {
        // Boss-arena pillar: solid dark column with a neon orange outline
        const g = new Graphics();
        g.circle(0, 0, prop.radius).fill({ color: 0x1A1A1A });
        g.circle(0, 0, prop.radius).stroke({ color: 0xFF6600, width: 3, alpha: 0.9 });
        g.x = prop.x;
        g.y = prop.y;
        this._layer.addChild(g);
        continue;
      }
      if (prop.textureKey === BIOME_STRUCTURE_TEXTURE) {
        // Biome landmark structure: color-coded by prop type
        const fillColor = prop.type === 'solid' ? 0x2A2A2A
          : prop.type === 'slip' ? 0x1A3A6A   // blue-grey for ice slip patches
          : 0x3A2A1A;                           // brown for slow patches
        const strokeColor = prop.type === 'solid' ? 0x888888
          : prop.type === 'slip' ? 0x88CCFF
          : 0x8B4513;
        const g = new Graphics();
        g.circle(0, 0, prop.radius).fill({ color: fillColor });
        g.circle(0, 0, prop.radius).stroke({ color: strokeColor, width: 2, alpha: 0.7 });
        g.x = prop.x;
        g.y = prop.y;
        this._layer.addChild(g);
        continue;
      }
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
