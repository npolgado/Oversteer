// enemyRenderer.ts — PixiJS enemy sprite pool renderer.

import { Sprite, Graphics, Assets } from 'pixi.js';
import type { Container } from 'pixi.js';
import { CFG } from '@core/config';
import type { EnemyState } from './enemyState';

export class EnemyRenderer {
  private _layer: Container;
  private _sprites = new Map<number, Sprite | Graphics>();

  constructor(layers: { enemiesLayer: Container }) {
    this._layer = layers.enemiesLayer;
  }

  sync(enemies: EnemyState[]): void {
    const currentIds = new Set(enemies.map((e) => e.id));

    // Remove sprites for despawned enemies
    for (const [id, sprite] of this._sprites) {
      if (!currentIds.has(id)) {
        sprite.destroy();
        this._sprites.delete(id);
      }
    }

    // Add sprites for new enemies
    for (const enemy of enemies) {
      if (this._sprites.has(enemy.id)) continue;

      const texture = Assets.get(enemy.sprite);
      if (texture) {
        const s = new Sprite(texture);
        s.anchor.set(0.5);
        s.width = CFG.ENEMY_SPRITE_S;
        s.height = CFG.ENEMY_SPRITE_S;
        if (enemy.type === 'interceptor') s.tint = 0xaabbff;
        this._layer.addChild(s);
        this._sprites.set(enemy.id, s);
      } else {
        // Fallback: colored circle
        const color = enemy.type === 'interceptor' ? 0x4444ff : 0xff4444;
        const g = new Graphics();
        g.circle(0, 0, enemy.radius).fill({ color });
        this._layer.addChild(g);
        this._sprites.set(enemy.id, g);
      }
    }
  }

  update(enemies: EnemyState[]): void {
    for (const enemy of enemies) {
      const sprite = this._sprites.get(enemy.id);
      if (!sprite) continue;
      sprite.x = enemy.x;
      sprite.y = enemy.y;
      sprite.rotation = enemy.heading + Math.PI / 2;
      sprite.alpha = enemy.fadeAlpha;
    }
  }

  destroy(): void {
    for (const sprite of this._sprites.values()) {
      sprite.destroy();
    }
    this._sprites.clear();
  }
}
