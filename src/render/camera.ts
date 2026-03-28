// Camera — smooth follow with velocity-based lead and dynamic zoom.
// Ported from arena-drifter/fx.js. Instead of ctx.translate(), sets
// worldContainer.position and worldContainer.scale each frame.
import type { Container } from 'pixi.js';
import { CFG } from '@core/config';
import { lerp, clamp } from '@core/utils';

export interface CameraState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  zoom: number;
}

const state: CameraState = {
  x: CFG.WORLD_W / 2,
  y: CFG.WORLD_H / 2,
  targetX: CFG.WORLD_W / 2,
  targetY: CFG.WORLD_H / 2,
  zoom: 1,
};

let _worldContainer: Container | null = null;

function attachContainer(container: Container): void {
  _worldContainer = container;
}

function update(
  dt: number,
  px: number,
  py: number,
  pvx: number,
  pvy: number,
  pSpeed: number,
): void {
  // Camera lead: offset target in direction of travel
  const leadAmount = 40;
  const leadFrac = clamp(pSpeed / (CFG.MAX_SPEED * 0.8), 0, 1);
  const lspd = Math.hypot(pvx, pvy) || 1;
  state.targetX = px + (pvx / lspd) * leadAmount * leadFrac;
  state.targetY = py + (pvy / lspd) * leadAmount * leadFrac;

  const speed = 6;
  const t = 1 - Math.exp(-speed * dt);
  state.x = lerp(state.x, state.targetX, t);
  state.y = lerp(state.y, state.targetY, t);

  // Clamp so viewport stays inside world
  state.x = clamp(state.x, CFG.W / 2, CFG.WORLD_W - CFG.W / 2);
  state.y = clamp(state.y, CFG.H / 2, CFG.WORLD_H - CFG.H / 2);

  // Dynamic zoom: slight zoom-out at high speed (up to 4%)
  const targetZoom = 1 - leadFrac * 0.04;
  state.zoom = lerp(state.zoom, targetZoom, t);

  // Apply to worldContainer
  if (_worldContainer) {
    _worldContainer.scale.set(state.zoom);
    // Translate so (state.x, state.y) in world space maps to screen center
    _worldContainer.position.set(
      CFG.W / 2 - state.x * state.zoom,
      CFG.H / 2 - state.y * state.zoom,
    );
  }
}

function isVisible(wx: number, wy: number, margin = 0): boolean {
  const sx = wx - state.x + CFG.W / 2;
  const sy = wy - state.y + CFG.H / 2;
  return sx >= -margin && sx <= CFG.W + margin && sy >= -margin && sy <= CFG.H + margin;
}

function reset(px: number, py: number): void {
  state.x = clamp(px, CFG.W / 2, CFG.WORLD_W - CFG.W / 2);
  state.y = clamp(py, CFG.H / 2, CFG.WORLD_H - CFG.H / 2);
  state.targetX = state.x;
  state.targetY = state.y;
  state.zoom = 1;
}

export const camera = { attachContainer, update, isVisible, reset, state };
