// shopPanel.test.ts — ShopPanelUI: tryPurchase and handleGamepadInput logic.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlayerState } from '@gameplay/player/playerState';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@ui/textStyles', () => ({ makeUIStyle: () => ({}) }));

vi.mock('pixi.js', () => {
  class MockText {
    text = ''; alpha = 1;
    anchor = { set: vi.fn() };
    position = { set: vi.fn(), x: 0, y: 0 };
    constructor(opts: { text?: string } = {}) { this.text = opts.text ?? ''; }
  }
  class MockGraphics {
    alpha = 1;
    rect = vi.fn().mockReturnThis();
    fill = vi.fn().mockReturnThis();
    stroke = vi.fn().mockReturnThis();
  }
  class MockContainer {
    alpha = 1;
    children: unknown[] = [];
    position = { set: vi.fn(), x: 0, y: 0 };
    addChild = vi.fn((...items: unknown[]) => { this.children.push(...items); });
    removeChild = vi.fn();
    removeChildren = vi.fn(() => { this.children = []; });
    destroy = vi.fn();
  }
  return { Text: MockText, Graphics: MockGraphics, Container: MockContainer };
});

import { Container } from 'pixi.js';
import { ShopPanelUI } from '../shopPanel';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    x: 0, y: 0, vx: 0, vy: 0, heading: 0,
    drifting: false, driftJustStarted: false, driftTime: 0, lastDriftEndTime: 0, driftChain: 0,
    maxSpeed: 500, turnRate: 200,
    hp: 50, maxHp: 100, hpRegen: 0, lastHitTimer: 99,
    shield: false, invulnTimer: 0, ghostFrameTimer: 0, ghostFrame: false, frozen: false,
    slipTimer: 0, slipStrength: 0.6, slowTimer: 0, slowStrength: 1,
    wallHit: false, braking: false, wallRiding: false, comboLevel: 0,
    handbrakeTimer: 0, speedBoostTimer: 0,
    consecutiveNearMisses: 0, nearMissStreakTimer: 0,
    leanTimer: 0, leanDir: 0, exhaustTimer: 0, glowPhase: 0, driftDeniedTimer: 0,
    driftKing: false, afterburner: false, nitroDrift: false,
    tightTurns: false, magnetRange: 0,
    scoreMult: 1, thickPlating: false, comboMaster: false, speedDemon: false,
    encircleScoreBonus: 1, damageResist: 0, driftShield: false, comboHeal: false,
    trailMagnet: false, speedTrail: false, dashBurst: false, dashCooldown: 0,
    trailBurn: false, chainLightning: false, upgrades: [],
    scrapBank: 20, scoreMultBoostTimer: 0,
    ...overrides,
  } as PlayerState;
}

function tapAt(x: number, y: number) { return { x, y }; }

function makeShop() { return new ShopPanelUI(new Container() as never); }

// Tap at the center of item i's buy button based on the live _items bounds,
// so layout changes in shopPanel.ts don't silently break the test geometry.
function tapOnItem(shop: ShopPanelUI, i: number) {
  const b = (shop as any)._items[i].bounds;
  return tapAt(b.x + b.w / 2, b.y + b.h / 2);
}

// ── tryPurchase ────────────────────────────────────────────────────────────────

describe('ShopPanelUI.tryPurchase', () => {
  it('returns null when panel is not visible', () => {
    const shop = makeShop();
    const player = makePlayer();
    // show() never called — _visible is false
    expect(shop.tryPurchase(tapAt(1482, 386), player)).toBeNull();
  });

  it('returns null when tap is null', () => {
    const shop = makeShop();
    const player = makePlayer();
    shop.show(player);
    expect(shop.tryPurchase(null, player)).toBeNull();
  });

  it('returns null when tap misses all buttons', () => {
    const shop = makeShop();
    const player = makePlayer({ scrapBank: 99 });
    shop.show(player);
    expect(shop.tryPurchase(tapAt(0, 0), player)).toBeNull();
  });

  it('Field Repair: deducts cost and restores HP', () => {
    const player = makePlayer({ scrapBank: 10, hp: 50, maxHp: 100 });
    const shop = makeShop();
    shop.show(player);

    const result = shop.tryPurchase(tapOnItem(shop, 0), player);

    expect(result).toBe(0);             // item index
    expect(player.scrapBank).toBe(2);   // 10 - 8
    expect(player.hp).toBe(100);        // 50 + 50
  });

  it('Field Repair: returns "blocked" when player is already at full HP (canApply guard)', () => {
    const player = makePlayer({ scrapBank: 10, hp: 100, maxHp: 100 });
    const shop = makeShop();
    shop.show(player);

    // 'blocked' means the tap hit a disabled button — consumed so it doesn't leak to upgrade cards
    expect(shop.tryPurchase(tapOnItem(shop, 0), player)).toBe('blocked');
    expect(player.scrapBank).toBe(10);  // no deduction
  });

  it('Brief Invincibility: deducts cost and sets invulnTimer', () => {
    const player = makePlayer({ scrapBank: 5 });
    const shop = makeShop();
    shop.show(player);

    const result = shop.tryPurchase(tapOnItem(shop, 1), player);

    expect(result).toBe(1);
    expect(player.scrapBank).toBe(0);   // 5 - 5
    expect(player.invulnTimer).toBe(4.0);
  });

  it('Score Surge: deducts cost and sets scoreMultBoostTimer', () => {
    const player = makePlayer({ scrapBank: 12 });
    const shop = makeShop();
    shop.show(player);

    const result = shop.tryPurchase(tapOnItem(shop, 2), player);

    expect(result).toBe(2);
    expect(player.scrapBank).toBe(0);   // 12 - 12
    expect(player.scoreMultBoostTimer).toBe(30.0);
  });

  it('returns "blocked" and makes no deduction when funds are insufficient', () => {
    const player = makePlayer({ scrapBank: 3 }); // Score Surge costs 12
    const shop = makeShop();
    shop.show(player);

    expect(shop.tryPurchase(tapOnItem(shop, 2), player)).toBe('blocked');
    expect(player.scrapBank).toBe(3);
  });

  it('succeeds with exact funds (boundary)', () => {
    const player = makePlayer({ scrapBank: 8, hp: 50, maxHp: 100 }); // Field Repair costs exactly 8
    const shop = makeShop();
    shop.show(player);

    expect(shop.tryPurchase(tapOnItem(shop, 0), player)).toBe(0);
    expect(player.scrapBank).toBe(0);
    expect(player.hp).toBe(100);
  });

  it('HP restore is capped at maxHp', () => {
    const player = makePlayer({ scrapBank: 8, hp: 90, maxHp: 100 }); // +50 would exceed 100
    const shop = makeShop();
    shop.show(player);

    shop.tryPurchase(tapOnItem(shop, 0), player);

    expect(player.hp).toBe(100);
  });
});

// ── handleGamepadInput ────────────────────────────────────────────────────────

const noInput = { menuUp: false, menuDown: false, enter: false, select1: false };

describe('ShopPanelUI.handleGamepadInput', () => {
  it('returns null when panel is not visible', () => {
    const shop = makeShop();
    expect(shop.handleGamepadInput(noInput as never, makePlayer())).toBeNull();
  });

  it('menuDown advances focus by 1', () => {
    const player = makePlayer();
    const shop = makeShop();
    shop.show(player);

    shop.handleGamepadInput({ ...noInput, menuDown: true } as never, player);

    expect((shop as any)._focusedIndex).toBe(1);
  });

  it('menuDown wraps focus from last item back to 0', () => {
    const player = makePlayer();
    const shop = makeShop();
    shop.show(player);

    // 3 shop items; press down 3 times to wrap
    for (let i = 0; i < 3; i++) {
      shop.handleGamepadInput({ ...noInput, menuDown: true } as never, player);
    }
    expect((shop as any)._focusedIndex).toBe(0);
  });

  it('menuUp wraps focus from 0 to last item', () => {
    const player = makePlayer();
    const shop = makeShop();
    shop.show(player);

    shop.handleGamepadInput({ ...noInput, menuUp: true } as never, player);

    expect((shop as any)._focusedIndex).toBe(2); // 3 items, wraps to last
  });

  it('enter buys the focused item when affordable', () => {
    const player = makePlayer({ scrapBank: 8, hp: 50, maxHp: 100 });
    const shop = makeShop();
    shop.show(player);
    // Focus is 0 (Field Repair, cost 8)

    const result = shop.handleGamepadInput({ ...noInput, enter: true } as never, player);

    expect(result).toBe(0);
    expect(player.scrapBank).toBe(0);
    expect(player.hp).toBe(100);
  });

  it('enter on un-affordable item returns blocked and does not deduct scrap', () => {
    const player = makePlayer({ scrapBank: 2 }); // Field Repair costs 8
    const shop = makeShop();
    shop.show(player);

    const result = shop.handleGamepadInput({ ...noInput, enter: true } as never, player);

    expect(result).toBe('blocked');
    expect(player.scrapBank).toBe(2);
  });

  it('enter on item that fails canApply returns blocked and does not deduct scrap', () => {
    const player = makePlayer({ scrapBank: 20, hp: 100, maxHp: 100 }); // already full HP
    const shop = makeShop();
    shop.show(player);
    // Focused on item 0 (Field Repair), canApply returns false when hp === maxHp

    const result = shop.handleGamepadInput({ ...noInput, enter: true } as never, player);

    expect(result).toBe('blocked');
    expect(player.scrapBank).toBe(20);
  });

  it('enter without pressing (no input.enter) returns null', () => {
    const player = makePlayer({ scrapBank: 8 });
    const shop = makeShop();
    shop.show(player);

    const result = shop.handleGamepadInput({ ...noInput } as never, player);

    expect(result).toBeNull();
  });
});

// ── B3: rendering, pointer, and gamepad paths must all agree on affordability ──
// (all three now route through the single `_canPurchase` helper)

describe('ShopPanelUI - affordability agrees across render, tryPurchase, and gamepad', () => {
  it('an unaffordable item is dimmed in render AND blocked by both purchase paths', () => {
    const player = makePlayer({ scrapBank: 0, hp: 50, maxHp: 100 }); // Field Repair (cost 8) unaffordable
    const shop = makeShop();
    shop.show(player);

    const itemContainer = (shop as any)._items[0].container;
    expect(itemContainer.alpha).toBeCloseTo(0.4); // dimmed per _canPurchase(...)===false

    expect(shop.tryPurchase(tapOnItem(shop, 0), player)).toBe('blocked');
    expect(shop.handleGamepadInput({ ...noInput, enter: true } as never, player)).toBe('blocked');
    expect(player.scrapBank).toBe(0); // neither path deducted
  });

  it('an affordable, usable item is full-alpha in render AND purchasable via both paths', () => {
    const player = makePlayer({ scrapBank: 99, hp: 50, maxHp: 100 }); // Field Repair affordable + usable
    const shop = makeShop();
    shop.show(player);

    const itemContainer = (shop as any)._items[0].container;
    expect(itemContainer.alpha).toBeCloseTo(1.0);

    expect(shop.tryPurchase(tapOnItem(shop, 0), player)).toBe(0);
    expect(player.scrapBank).toBe(91); // 99 - 8
  });
});
