import { describe, it, expect, vi, beforeEach } from 'vitest';

// Minimal Pixi mock — PickupRenderer only calls clear/circle/fill/stroke on Graphics
const makeGraphicsMock = () => ({
  clear: vi.fn().mockReturnThis(),
  circle: vi.fn().mockReturnThis(),
  fill: vi.fn().mockReturnThis(),
  stroke: vi.fn().mockReturnThis(),
  moveTo: vi.fn().mockReturnThis(),
  lineTo: vi.fn().mockReturnThis(),
  closePath: vi.fn().mockReturnThis(),
  rect: vi.fn().mockReturnThis(),
  destroy: vi.fn(),
});

let graphicsMock: ReturnType<typeof makeGraphicsMock>;

vi.mock('pixi.js', () => ({
  Graphics: vi.fn().mockImplementation(() => graphicsMock),
  Container: vi.fn().mockImplementation(() => ({ addChild: vi.fn() })),
}));

vi.mock('@core/config', () => ({
  CFG: { SCRAP_RADIUS: 8 },
}));

import { PickupRenderer } from '@render/pickupRenderer';

describe('PickupRenderer', () => {
  let renderer: PickupRenderer;
  const fakeLayer = { addChild: vi.fn() } as any;

  beforeEach(() => {
    graphicsMock = makeGraphicsMock();
    renderer = new PickupRenderer(fakeLayer);
  });

  it('clears graphics each update', () => {
    renderer.update([], [], []);
    expect(graphicsMock.clear).toHaveBeenCalledOnce();
  });

  it('renders scrap pickups', () => {
    const scraps = [{ x: 100, y: 200, life: 10, type: 'scrap' as const }];
    renderer.update(scraps, [], []);
    expect(graphicsMock.circle).toHaveBeenCalled();
  });

  it('renders hazard zones with red fill', () => {
    const hazardZones = [{ x: 500, y: 500, radius: 55, life: 3, phase: 0 }];
    renderer.update([], hazardZones, []);
    const fillCalls = graphicsMock.fill.mock.calls;
    expect(fillCalls.some((args: any[]) => args[0]?.color === 0xFF0000)).toBe(true);
  });

  it('renders boost zones with cyan stroke', () => {
    const boostZones = [{ x: 300, y: 300, life: 5 }];
    renderer.update([], [], boostZones);
    const strokeCalls = graphicsMock.stroke.mock.calls;
    expect(strokeCalls.some((args: any[]) => args[0]?.color === 0x35F2D0)).toBe(true);
  });

  it('renders no boost zones when array is empty', () => {
    renderer.update([], [], []);
    // circle is only called for scraps/hazards — none here
    expect(graphicsMock.circle).not.toHaveBeenCalled();
  });

  it('renders multiple boost zones', () => {
    const boostZones = [
      { x: 100, y: 100, life: 5 },
      { x: 200, y: 200, life: 3 },
    ];
    renderer.update([], [], boostZones);
    // Each boost zone calls circle at least twice (outer + inner ring)
    expect(graphicsMock.circle.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('destroy cleans up graphics', () => {
    renderer.destroy();
    expect(graphicsMock.destroy).toHaveBeenCalledOnce();
  });
});
