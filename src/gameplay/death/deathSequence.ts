// deathSequence.ts — 3-phase death state machine (freeze → slowmo+shatter → desaturate).
// Extracted from gameplayScene.ts. Caller (GameLoop) handles particles/eventLog/screenFx
// apply and arenaGlow each frame; this class owns phase transitions and FX triggers.

import { CFG } from '@core/config';
import { eventBus } from '@core/eventBus';
import type { ScreenFX } from '@render/screenFx';
import type { ParticleSystem } from '@render/particles';

export class DeathSequence {
  active = false;
  private _phase = 0;  // 0=freeze, 1=slowmo+shatter, 2=desat
  private _timer = 0;

  constructor(
    private _screenFx: ScreenFX,
    private _particles: ParticleSystem,
    private _onComplete: () => void,
  ) {}

  /** Call when player HP hits 0. Starts the freeze phase and emits playerDied. */
  trigger(): void {
    this.active = true;
    this._phase = 0;
    this._timer = CFG.FREEZE_TIME;
    this._screenFx.freeze(CFG.FREEZE_TIME);
    eventBus.emit('playerDied', {});
  }

  /**
   * Advance the state machine.
   * Must be called AFTER per-frame rendering (particles/eventLog/screenFx/arenaGlow)
   * so that _onComplete (→ destroy) runs after rendering, not before.
   */
  update(rawDt: number, playerX: number, playerY: number): void {
    this._timer -= rawDt;

    if (this._phase === 0 && this._timer <= 0) {
      // Phase 0 (freeze) done → phase 1: slowmo + shatter
      this._phase = 1;
      this._timer = CFG.DEATH_SLOWMO_DUR;
      this._screenFx.slowmo(CFG.DEATH_SLOWMO, CFG.DEATH_SLOWMO_DUR);
      this._screenFx.shake(10, 0.35);
      const shardCount = CFG.SHARD_COUNT_MIN + Math.floor(
        Math.random() * (CFG.SHARD_COUNT_MAX - CFG.SHARD_COUNT_MIN + 1),
      );
      this._particles.spawn(playerX, playerY, 0xEAEFF7, shardCount, {
        type: 'shard', vxMin: -300, vxMax: 300, vyMin: -300, vyMax: 300,
        lifeMin: 0.4, lifeMax: 0.8, sizeMin: 4, sizeMax: 10,
      });
      this._particles.addRing(playerX, playerY, 0xFF3B6B);
      this._screenFx.flash(0xFF3B6B, 0.15, 0.1);
    } else if (this._phase === 1 && this._timer <= 0) {
      // Phase 1 done → phase 2: desaturate
      this._phase = 2;
      this._timer = 0.5;
      this._screenFx.desaturate(0.7);
    } else if (this._phase === 2 && this._timer <= 0) {
      this._onComplete();
    }
  }

  destroy(): void {
    // ScreenFX and ParticleSystem are owned by GameLoop; nothing to free here.
  }
}
