// enemyRenderer.ts — PixiJS enemy sprite pool renderer.

import { Sprite, Graphics, Assets } from 'pixi.js';
import type { Container } from 'pixi.js';
import { CFG } from '@core/config';
import type { EnemyState } from './enemyState';

const BOSS_HP_BAR_W = 80;
const BOSS_HP_BAR_H = 6;
const BOSS_HP_BAR_OFFSET_Y = 44; // px above boss center

export class EnemyRenderer {
  private _layer: Container;
  private _sprites = new Map<number, Sprite | Graphics>();
  private _bossHpBars = new Map<number, Graphics>();

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

    // Remove HP bars for despawned enemies
    for (const [id, bar] of this._bossHpBars) {
      if (!currentIds.has(id)) {
        bar.destroy();
        this._bossHpBars.delete(id);
      }
    }

    // Add sprites for new enemies
    for (const enemy of enemies) {
      if (this._sprites.has(enemy.id)) continue;

      const isBoss = enemy.type === 'boss';
      const spriteSize = isBoss ? CFG.BOSS_SPRITE_S : CFG.ENEMY_SPRITE_S;
      const texture = Assets.get(enemy.sprite);
      if (texture) {
        const s = new Sprite(texture);
        s.anchor.set(0.5);
        s.width = spriteSize;
        s.height = spriteSize;
        if (enemy.type === 'interceptor') s.tint = 0xaabbff;
        if (enemy.type === 'splitter')    s.tint = 0xFF8800;
        if (isBoss) s.tint = 0xFF6600;
        this._layer.addChild(s);
        this._sprites.set(enemy.id, s);
      } else {
        // Fallback: colored circle
        const color = isBoss ? 0xFF6600
          : enemy.type === 'interceptor' ? 0x4444ff
          : enemy.type === 'splitter'    ? 0xFF8800
          : 0xff4444;
        const g = new Graphics();
        g.circle(0, 0, enemy.radius).fill({ color });
        this._layer.addChild(g);
        this._sprites.set(enemy.id, g);
      }

      // Boss HP bar
      if (isBoss) {
        const bar = new Graphics();
        this._layer.addChild(bar);
        this._bossHpBars.set(enemy.id, bar);
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

      // Hit flash: tint white while hitFlashTimer is active (timer decremented in enemyUpdate)
      if (enemy.type === 'boss') {
        if ((enemy.hitFlashTimer ?? 0) > 0) {
          (sprite as Sprite).tint = 0xFFFFFF;
        } else {
          (sprite as Sprite).tint = 0xFF6600;
        }

        // Update HP bar
        const bar = this._bossHpBars.get(enemy.id);
        if (bar) {
          bar.clear();
          const hpFrac = Math.max(0, Math.min(1, (enemy.health ?? 1) / CFG.BOSS_HP));
          const barX = enemy.x - BOSS_HP_BAR_W / 2;
          const barY = enemy.y - BOSS_HP_BAR_OFFSET_Y;
          // Dark backing
          bar.rect(barX, barY, BOSS_HP_BAR_W, BOSS_HP_BAR_H).fill({ color: 0x220000 });
          // HP fill
          if (hpFrac > 0) {
            bar.rect(barX, barY, BOSS_HP_BAR_W * hpFrac, BOSS_HP_BAR_H).fill({ color: 0xFF2222 });
          }
          // Border
          bar.rect(barX, barY, BOSS_HP_BAR_W, BOSS_HP_BAR_H).stroke({ color: 0xFF6600, width: 1, alpha: 0.8 });
        }
      }
    }
  }

  destroy(): void {
    for (const sprite of this._sprites.values()) {
      sprite.destroy();
    }
    this._sprites.clear();
    for (const bar of this._bossHpBars.values()) {
      bar.destroy();
    }
    this._bossHpBars.clear();
  }
}
