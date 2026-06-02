// upgradeBreakPhase.ts — Upgrade break state machine (card selection, reroll, countdown).
// Extracted from gameplayScene.ts. Rendering during the break is handled by GameLoop.

import { CFG } from '@core/config';
import { eventBus } from '@core/eventBus';
import { inputManager } from '@input/inputManager';
import { buildUpgradeOffer, applyUpgrade, getRerollCount } from '@gameplay/upgrades/upgradeSystem';
import { startWave } from '@gameplay/spawning/waveManager';
import type { UpgradeDef } from '@gameplay/upgrades/upgradeRegistry';
import type { PlayerState } from '@gameplay/player/playerState';
import type { TrailState } from '@gameplay/trail/trailState';
import type { WaveState } from '@gameplay/spawning/waveManager';
import type { InputState } from '@input/inputManager';
import type { UpgradeCardsUI } from '@ui/menus/upgradeCards';
import type { ShopPanelUI } from '@ui/menus/shopPanel';
import { getShopItemLabel } from '@ui/menus/shopPanel';
import type { audioManager as AudioManagerType } from '@audio/audioManager';

export class UpgradeBreakPhase {
  active = false;
  private _upgradeChosen = false;
  private _upgradeConfirmTimer = 0;
  private _cardAnimTimer = 0;
  private _currentOffer: UpgradeDef[] = [];
  private _rerollsLeft = 0;
  private _chosenUpgrade: UpgradeDef | null = null;

  get upgradeChosen(): boolean { return this._upgradeChosen; }
  get upgradeConfirmTimer(): number { return this._upgradeConfirmTimer; }
  get chosenUpgrade(): UpgradeDef | null { return this._chosenUpgrade; }

  constructor(
    private _upgradeCards: UpgradeCardsUI,
    private _audio: typeof AudioManagerType,
    /** Called when a new wave begins (after countdown). Receives the new wave index. */
    private _onWaveStart: (waveIndex: number) => void,
    private _shopPanel: ShopPanelUI | null = null,
    private _getUpgradeBias: () => Record<string, number> = () => ({}),
  ) {}

  /**
   * Enter the break phase: freeze the player, build the upgrade offer, show cards.
   * Called from GameLoop when a wave_end event fires, or directly for situation presets.
   * bossReward=true: grants +1 reroll as a boss kill bonus.
   * extraRerolls: additional rerolls on top of base + bossReward (used by dev situations).
   */
  enter(playerState: PlayerState, waveState: WaveState, bossReward = false, extraRerolls = 0): void {
    this.active = true;
    this._upgradeChosen = false;
    this._upgradeConfirmTimer = CFG.UPGRADE_CONFIRM_TIME;
    this._chosenUpgrade = null;
    this._cardAnimTimer = 0;
    this._rerollsLeft = getRerollCount(playerState) + (bossReward ? 1 : 0) + extraRerolls;
    this._currentOffer = buildUpgradeOffer(playerState, this._getUpgradeBias());
    // Freeze player (from game.js:911-928)
    playerState.vx = 0;
    playerState.vy = 0;
    playerState.drifting = false;
    playerState.handbrakeTimer = 0;
    playerState.driftTime = 0;
    playerState.wallRiding = false;
    playerState.driftChain = 0;
    playerState.frozen = true;
    if (this._currentOffer.length > 0) {
      this._upgradeCards.show(this._currentOffer, this._rerollsLeft, playerState.upgrades);
    }
    this._shopPanel?.show(playerState);
  }

  /**
   * Update card input, reroll, upgrade application, and post-selection countdown.
   * Uses rawDt (not dilated) to match original — break phase doesn't slow down.
   */
  update(
    dt: number,
    input: InputState,
    playerState: PlayerState,
    trailState: TrailState,
    waveState: WaveState,
  ): void {
    this._cardAnimTimer += dt;
    this._upgradeCards.update(dt);

    this._shopPanel?.update(dt);

    if (!this._upgradeChosen) {
      // NOTE: not in original — shop takes priority on 'enter' so D-pad + A buys before cards.
      // Gamepad D-pad + A: navigate/buy from shop before card input sees 'enter'.
      // 'blocked' means enter was pressed on a disabled item — consume it so it doesn't reach cards.
      const gpResult = this._shopPanel?.handleGamepadInput(input, playerState) ?? null;
      const gpBought = (gpResult !== null && gpResult !== 'blocked') ? gpResult : null;
      const gpConsumed = gpResult !== null; // true for successful purchase OR blocked press

      // Mouse/touch tap: shop intercepts before upgrade cards.
      const tap = inputManager.consumeTap();
      const tapResult = this._shopPanel?.tryPurchase(tap, playerState) ?? null;
      // 'blocked' means tap hit a disabled button — consume it so it doesn't reach cards
      const tapBought = (tapResult !== null && tapResult !== 'blocked') ? tapResult : null;
      const tapConsumed = tapResult !== null; // 'blocked' or a successful purchase both consume the tap
      const shopBought = gpBought ?? tapBought;

      if (shopBought != null) {
        this._audio.play('ui_click');
        eventBus.emit('eventLog', { text: `BOUGHT: ${getShopItemLabel(shopBought) ?? '?'}`, color: '#ffb000' });
      }
      // If shop consumed 'enter' (D-pad buy or blocked press), mask all menu inputs so cards don't double-act
      const maskedInput = gpConsumed
        ? { ...input, enter: false, select1: false, menuDown: false, menuUp: false, menuLaunch: false }
        : input;
      const cardAction = this._upgradeCards.checkInput(
        maskedInput,
        tapConsumed ? null : tap,
      ) ?? null;

      if (cardAction !== null && cardAction !== 'reroll') {
        const upgrade = this._currentOffer[cardAction as number];
        if (upgrade) {
          this._audio.play('ui_click');
          applyUpgrade(playerState, upgrade);
          // Trail upgrades mutate trailState directly (can't be applied inside playerState alone)
          if (upgrade.id === 'wider_trail') trailState.closeDist = 60;
          if (upgrade.id === 'trail_echo')  trailState.maxPoints = 600;
          // speed_demon: enemies also get +10% speed bonus (game.js:422-426)
          if (upgrade.id === 'speed_demon') waveState.speedBonus += 40;
          eventBus.emit('upgradeApplied', { id: upgrade.id });
          this._chosenUpgrade = upgrade;
          this._upgradeChosen = true;
          this._upgradeCards.hide(); // fire-and-forget; cards animate out via update()
        }
      } else if (cardAction === 'reroll' && this._rerollsLeft > 0) {
        this._audio.play('ui_click');
        this._upgradeCards.pulseRerollBtn();
        const newOffer = buildUpgradeOffer(playerState, this._getUpgradeBias());
        if (newOffer.length > 0) {
          this._rerollsLeft--;
          this._currentOffer = newOffer;
          this._cardAnimTimer = 0;
          this._upgradeCards.show(this._currentOffer, this._rerollsLeft, playerState.upgrades);
        }
      }
    }

    // Post-selection countdown (also handles empty pool auto-start)
    if (this._upgradeChosen || this._currentOffer.length === 0) {
      this._upgradeConfirmTimer -= dt;
      if (this._upgradeConfirmTimer <= 0) {
        this.active = false;
        playerState.frozen = false;
        this._shopPanel?.hide();
        startWave(waveState);
        eventBus.emit('waveStarted', { wave: waveState.waveIndex });
        this._audio.startEngine();
        this._onWaveStart(waveState.waveIndex);
      }
    }
  }

  destroy(): void {
    this._upgradeCards.destroy();
    this._shopPanel?.destroy();
  }
}
