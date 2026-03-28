import { describe, it, expect } from 'vitest';
import { CFG } from '@core/config';
import { makePlayerState } from '@gameplay/player/playerState';
import {
  makePropsState,
  generateProps,
  getPropsNear,
  checkPlayerCollision,
  handlePropCollisions,
  type Prop,
  type PropsState,
} from '../propsSystem';

// ── Helpers ──────────────────────────────────────────────────────────────────

function addTestProp(state: PropsState, prop: Prop): void {
  const cs = CFG.PROP_CHUNK_SIZE;
  const cx = Math.floor(prop.x / cs);
  const cy = Math.floor(prop.y / cs);
  const key = `${cx},${cy}`;
  if (!state.chunks.has(key)) state.chunks.set(key, []);
  state.chunks.get(key)!.push(prop);
  state.allProps.push(prop);
}

function makeSolidProp(x: number, y: number, radius = 40): Prop {
  return { x, y, radius, type: 'solid', textureKey: 'props/rock_1.png', nearMissCooldown: 0 };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('generateProps — determinism', () => {
  it('produces identical allProps arrays across two calls', () => {
    const a = makePropsState();
    const b = makePropsState();
    generateProps(a);
    generateProps(b);

    expect(a.allProps.length).toBe(b.allProps.length);
    for (let i = 0; i < a.allProps.length; i++) {
      expect(a.allProps[i].x).toBeCloseTo(b.allProps[i].x, 5);
      expect(a.allProps[i].y).toBeCloseTo(b.allProps[i].y, 5);
      expect(a.allProps[i].type).toBe(b.allProps[i].type);
      expect(a.allProps[i].radius).toBe(b.allProps[i].radius);
    }
  });

  it('generates a non-zero number of props', () => {
    const state = makePropsState();
    generateProps(state);
    expect(state.allProps.length).toBeGreaterThan(0);
  });
});

describe('checkPlayerCollision', () => {
  it('returns the prop when player overlaps a solid prop', () => {
    const state = makePropsState();
    const player = makePlayerState();
    // Place prop right on top of player
    const prop = makeSolidProp(player.x, player.y, 40);
    addTestProp(state, prop);

    const hits = checkPlayerCollision(state, player);
    expect(hits).toContain(prop);
  });

  it('returns empty array when player is far from props', () => {
    const state = makePropsState();
    const player = makePlayerState();
    // Place prop far away
    const prop = makeSolidProp(player.x + 500, player.y + 500, 40);
    addTestProp(state, prop);

    const hits = checkPlayerCollision(state, player);
    expect(hits).toHaveLength(0);
  });

  it('ignores decoration props', () => {
    const state = makePropsState();
    const player = makePlayerState();
    const prop: Prop = {
      x: player.x,
      y: player.y,
      radius: 25,
      type: 'decoration',
      textureKey: 'props/bush_1.png',
      nearMissCooldown: 0,
    };
    addTestProp(state, prop);

    const hits = checkPlayerCollision(state, player);
    expect(hits).toHaveLength(0);
  });
});

describe('handlePropCollisions — solid bounce', () => {
  it('pushes player out so distance >= sum of radii', () => {
    const player = makePlayerState();
    player.x = 1500;
    player.y = 1500;
    player.vx = 100;
    player.vy = 0;

    // Prop overlapping player from the right
    const prop = makeSolidProp(1510, 1500, 40);
    const events = handlePropCollisions([prop], player);

    const dx = player.x - prop.x;
    const dy = player.y - prop.y;
    const dist = Math.hypot(dx, dy);
    const sumR = CFG.PLAYER_RADIUS + prop.radius;
    expect(dist).toBeGreaterThanOrEqual(sumR - 0.001);
    expect(player.wallHit).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('solid_bounce');
  });
});

describe('handlePropCollisions — slow debuff', () => {
  it('applies slowTimer and slowStrength to player', () => {
    const player = makePlayerState();
    const prop: Prop = {
      x: player.x,
      y: player.y,
      radius: 62,
      type: 'slow',
      textureKey: 'props/mud_1.png',
      nearMissCooldown: 0,
      duration: 2.0,
      strength: 0.5,
    };

    const events = handlePropCollisions([prop], player);
    expect(player.slowTimer).toBe(2.0);
    expect(player.slowStrength).toBe(0.5);
    expect(events[0].type).toBe('slow_enter');
  });

  it('uses fallback duration/strength when prop has none', () => {
    const player = makePlayerState();
    const prop: Prop = {
      x: player.x,
      y: player.y,
      radius: 62,
      type: 'slow',
      textureKey: 'props/mud_1.png',
      nearMissCooldown: 0,
    };

    handlePropCollisions([prop], player);
    expect(player.slowTimer).toBe(2.0);
    expect(player.slowStrength).toBe(0.5);
  });
});

describe('handlePropCollisions — slip debuff', () => {
  it('applies slipTimer and slipStrength to player', () => {
    const player = makePlayerState();
    const prop: Prop = {
      x: player.x,
      y: player.y,
      radius: 55,
      type: 'slip',
      textureKey: 'props/mud_1.png',
      nearMissCooldown: 0,
      duration: 1.5,
      strength: 0.6,
    };

    const events = handlePropCollisions([prop], player);
    expect(player.slipTimer).toBe(1.5);
    expect(player.slipStrength).toBe(0.6);
    expect(events[0].type).toBe('slip_enter');
  });
});

describe('getPropsNear — spatial lookup', () => {
  it('returns only props in nearby chunks', () => {
    const state = makePropsState();

    // Two props in clearly different chunks
    const cs = CFG.PROP_CHUNK_SIZE;
    const nearProp = makeSolidProp(cs * 1 + 10, cs * 1 + 10, 40);      // chunk (1,1)
    const farProp = makeSolidProp(cs * 5 + 10, cs * 5 + 10, 40);        // chunk (5,5)
    addTestProp(state, nearProp);
    addTestProp(state, farProp);

    // Query centered on nearProp with a small range (only reaches chunk 1,1)
    const results = getPropsNear(state, cs * 1 + 10, cs * 1 + 10, cs * 0.4);
    expect(results).toContain(nearProp);
    expect(results).not.toContain(farProp);
  });
});
