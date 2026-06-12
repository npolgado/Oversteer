// biomeSystem.ts — Biome transition and hazard tick orchestration, extracted from GameLoop.
// Scene-side: touches Pixi Sprite/Graphics/Assets and renderer references.
// Pure biome logic (hazard math, run progression) stays in gameplay/world/.
// NOTE: not in original — Phase 4.5 biome orchestration extracted from GameLoop.

import { Assets } from 'pixi.js';
import type { Sprite, Graphics } from 'pixi.js';
import type { PlayerState } from '@gameplay/player/playerState';
import { BiomeManager } from '@gameplay/world/biomeManager';
import { RunProgression, isBiomeTransition } from '@gameplay/world/runProgression';
import {
  clearBiomeHazards,
  updateBiomeHazards,
  type BiomeHazardState,
} from '@gameplay/world/biomeHazards';
import { regenerateProps, type PropsState } from '@gameplay/world/propsSystem';
import type { PropsRenderer } from '@gameplay/world/propsRenderer';
import type { HudManager } from '@ui/hud/hudManager';
import type { ScreenFX } from '@render/screenFx';
import type { audioManager as AudioManagerType } from '@audio/audioManager';
import { CFG } from '@core/config';
import { eventBus } from '@core/eventBus';

export interface BiomeSystemDeps {
  biomeManager: BiomeManager;
  runProgression: RunProgression;
  hazardState: BiomeHazardState;
  propsState: PropsState;
  propsRenderer: PropsRenderer;
  audioManager: typeof AudioManagerType;
  hudManager: HudManager;
  screenFx: ScreenFX;
  /** Late-created by GameLoop — use getter to avoid capturing null reference */
  getBgSprite: () => Sprite | null;
  /** Late-created by GameLoop — use getter to avoid capturing null reference */
  getFogOverlay: () => Graphics | null;
}

export class BiomeSystem {
  constructor(private _deps: BiomeSystemDeps) {}

  /**
   * Apply biome swap effects when a new wave starts at a transition wave (8 or 15).
   * Idempotent when waveIndex is not a transition wave.
   * Note: caller (GameLoop) is responsible for resetting _scrapCarry after this call when wave === 15.
   */
  applyTransition(startedWave: number, playerState: PlayerState): void {
    if (!isBiomeTransition(startedWave)) return;
    const { biomeManager, runProgression, hazardState, propsState, propsRenderer, audioManager, hudManager, screenFx, getBgSprite, getFogOverlay } = this._deps;
    // Wave 15: reset the rewardMult applied during segment 1
    if (startedWave === 15 && runProgression.rewardMult > 1) {
      playerState.scoreMult /= runProgression.rewardMult;
      runProgression.resetRewardMult();
    }
    const newBiomeId = runProgression.biomeForWave(startedWave);
    biomeManager.setBiome(newBiomeId);
    const biome = biomeManager.active;
    audioManager.loadMusicPack(biome.musicPackId);
    // Regenerate props from the new biome's pool and refresh renderer
    regenerateProps(propsState, biome.propPool);
    propsRenderer.setProps(propsState.allProps);
    // Swap background texture and tint
    const bgSprite = getBgSprite();
    if (bgSprite) {
      const tex = Assets.get(biome.backgroundSprite);
      if (tex) bgSprite.texture = tex;
      bgSprite.tint = biome.lightingTint;
    }
    // Update fog overlay
    const fogOverlay = getFogOverlay();
    if (fogOverlay) {
      fogOverlay.tint = biome.fogColor;
      fogOverlay.alpha = biome.fogDensity;
    }
    hudManager.showMilestoneBanner(biome.name.toUpperCase(), '#35F2D0');
    screenFx.flash(0x35F2D0, 0.5, 1.0);
    screenFx.shake(4, 0.3);
    clearBiomeHazards(hazardState);
  }

  /**
   * Tick per-biome hazard zones (heat cracks, corruption). Applies damage to playerState directly.
   * Caller passes a death handle so BiomeSystem can trigger death without holding a DeathSequence ref.
   */
  tick(
    dilatedDt: number,
    playerState: PlayerState,
    death: { active: boolean; trigger(): void },
  ): void {
    const { biomeManager, hazardState } = this._deps;
    const rules = biomeManager.active.hazardRules;
    if (!rules || rules.kind === 'none') return;

    const result = updateBiomeHazards(
      hazardState,
      rules,
      dilatedDt,
      playerState.x,
      playerState.y,
      Math.random,
    );

    // Heat crack burst damage — applied once per zone on first overlap during the eruption window
    if (result.burstDamage > 0 && playerState.invulnTimer <= 0 && playerState.ghostFrameTimer <= 0) {
      const dmg = Math.ceil(result.burstDamage * (1 - (playerState.damageResist ?? 0)));
      if (dmg > 0) {
        const prevHp = playerState.hp;
        playerState.hp = Math.max(0, playerState.hp - dmg);
        if (playerState.hp !== prevHp) {
          playerState.invulnTimer = CFG.HIT_INVULN;
          playerState.lastHitTimer = 0;
          eventBus.emit('playerDamaged', { amount: dmg, x: playerState.x, y: playerState.y });
        }
        if (playerState.hp <= 0 && !death.active) {
          death.trigger();
        }
      }
    }

    // Corruption DPS — continuous while inside zone (slow also applied)
    if (result.inCorruption && playerState.invulnTimer <= 0 && playerState.ghostFrameTimer <= 0) {
      const dps = rules.dps ?? 0;
      if (dps > 0) {
        const dmg = dps * dilatedDt * (1 - (playerState.damageResist ?? 0));
        playerState.hp = Math.max(0, playerState.hp - dmg);
        playerState.slowTimer = Math.max(playerState.slowTimer ?? 0, 0.1);
        playerState.slowStrength = 0.35;
        playerState.lastHitTimer = 0;
        if (playerState.hp <= 0 && !death.active) {
          death.trigger();
        }
      }
    }
  }
}
