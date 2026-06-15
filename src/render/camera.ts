// Camera — smooth follow with velocity-based lead and dynamic zoom.
// Ported from arena-drifter/fx.js. Instead of ctx.translate(), sets
// worldContainer.position and worldContainer.scale each frame.
import type { Container } from 'pixi.js';
import { CFG } from '@core/config';
import { lerp, clamp } from '@core/utils';
import { getArenaBounds } from '@gameplay/world/arenaBounds';

export interface CameraState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  zoom: number;
  rotation: number;
}

const state: CameraState = {
  x: CFG.WORLD_W / 2,
  y: CFG.WORLD_H / 2,
  targetX: CFG.WORLD_W / 2,
  targetY: CFG.WORLD_H / 2,
  zoom: 1,
  rotation: 0,
};

let _worldContainer: Container | null = null;
let _headingUp = false;

function attachContainer(container: Container): void {
  _worldContainer = container;
}

function setHeadingMode(enabled: boolean): void {
  _headingUp = enabled;
}

function lerpAngle(current: number, target: number, t: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * t;
}

function update(
  dt: number,
  px: number,
  py: number,
  pvx: number,
  pvy: number,
  pSpeed: number,
  heading: number,
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

  // Clamp so viewport stays inside the active arena bounds.
  // NOTE: not in original — skip clamp in headingUp mode (rotated viewport makes rectangular
  // clamp unreliable); also use active arena bounds so boss-wave shrink is respected.
  // If the arena is narrower than the viewport, pin the camera to the arena center.
  if (!_headingUp) {
    const ab = getArenaBounds();
    const xLo = ab.cx - ab.halfW + CFG.W / 2;
    const xHi = ab.cx + ab.halfW - CFG.W / 2;
    state.x = xLo < xHi ? clamp(state.x, xLo, xHi) : ab.cx;
    const yLo = ab.cy - ab.halfH + CFG.H / 2;
    const yHi = ab.cy + ab.halfH - CFG.H / 2;
    state.y = yLo < yHi ? clamp(state.y, yLo, yHi) : ab.cy;
  }

  // Dynamic zoom: slight zoom-out at high speed (up to 4%)
  const targetZoom = 1 - leadFrac * 0.04;
  state.zoom = lerp(state.zoom, targetZoom, t);

  // Heading-up mode rotates world so car forward faces up.
  // NOTE: not in original — rotation uses a separate, slower lerp so large heading swings ease in gradually.
  const tRot = 1 - Math.exp(-CFG.CAMERA_ROTATION_LERP_SPEED * dt);
  const targetRotation = _headingUp ? (-Math.PI / 2 - heading) : 0;
  state.rotation = lerpAngle(state.rotation, targetRotation, tRot);

  // Apply to worldContainer
  if (_worldContainer) {
    _worldContainer.scale.set(state.zoom);
    _worldContainer.pivot.set(state.x, state.y);
    _worldContainer.position.set(CFG.W / 2, CFG.H / 2);
    _worldContainer.rotation = state.rotation;
  }
}

function isVisible(wx: number, wy: number, margin = 0): boolean {
  const dx = wx - state.x;
  const dy = wy - state.y;
  const cosR = Math.cos(state.rotation);
  const sinR = Math.sin(state.rotation);
  const sx = CFG.W / 2 + (dx * cosR - dy * sinR) * state.zoom;
  const sy = CFG.H / 2 + (dx * sinR + dy * cosR) * state.zoom;
  return sx >= -margin && sx <= CFG.W + margin && sy >= -margin && sy <= CFG.H + margin;
}

function reset(px: number, py: number): void {
  _headingUp = false;
  state.x = clamp(px, CFG.W / 2, CFG.WORLD_W - CFG.W / 2);
  state.y = clamp(py, CFG.H / 2, CFG.WORLD_H - CFG.H / 2);
  state.targetX = state.x;
  state.targetY = state.y;
  state.zoom = 1;
  state.rotation = 0;
  if (_worldContainer) {
    _worldContainer.scale.set(state.zoom);
    _worldContainer.pivot.set(state.x, state.y);
    _worldContainer.position.set(CFG.W / 2, CFG.H / 2);
    _worldContainer.rotation = state.rotation;
  }
}

export const camera = { attachContainer, setHeadingMode, update, isVisible, reset, state };
