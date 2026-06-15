// arenaBounds.ts — Runtime active arena bounds with animated shrink/restore.
// NOTE: not in original — Phase 4.9 response, replaces boss-arena grey-circle pillars.
//
// During normal waves the bounds equal the full world (cx=WORLD_W/2, halfW=WORLD_W/2).
// On boss_spawn the bounds lerp to BOSS_HALF over ~1 s, creating a visible walled arena.
// On wave_end they restore to full world.
//
// Three systems consume these bounds:
//   - physics.ts  (wall-bounce clamps)
//   - camera.ts   (viewport clamp when headingUp=false)
//   - gameLoop.ts (enemy/pickup/scrap spawn clamps + wall graphics)

import { CFG } from '@core/config';
import { lerp } from '@core/utils';

export interface ArenaBounds {
  cx: number;
  cy: number;
  halfW: number;
  halfH: number;
}

// Boss arena target size (600 → 1200×1200 box centered on world center)
export const BOSS_ARENA_HALF = 600;

interface _AnimState {
  fromHalfW: number;
  fromHalfH: number;
  toHalfW: number;
  toHalfH: number;
  progress: number;  // 0..1
  duration: number;  // seconds
  running: boolean;
}

// Initialized to full world so the module is safe to import without calling resetArenaBounds first.
const _bounds: ArenaBounds = {
  cx: CFG.WORLD_W / 2,
  cy: CFG.WORLD_H / 2,
  halfW: CFG.WORLD_W / 2,
  halfH: CFG.WORLD_H / 2,
};

const _anim: _AnimState = {
  fromHalfW: 0, fromHalfH: 0,
  toHalfW: 0,   toHalfH: 0,
  progress: 1,
  duration: 1,
  running: false,
};

function _fullHalfW(): number { return CFG.WORLD_W / 2; }
function _fullHalfH(): number { return CFG.WORLD_H / 2; }

/** Call once at game/scene init to set bounds to full-world defaults. */
export function resetArenaBounds(): void {
  _bounds.cx = CFG.WORLD_W / 2;
  _bounds.cy = CFG.WORLD_H / 2;
  _bounds.halfW = _fullHalfW();
  _bounds.halfH = _fullHalfH();
  _anim.running = false;
  _anim.progress = 1;
}

/** Begin lerping to the boss arena size. Call on boss_spawn. */
export function shrinkArena(duration = 1.0): void {
  _anim.fromHalfW = _bounds.halfW;
  _anim.fromHalfH = _bounds.halfH;
  _anim.toHalfW = BOSS_ARENA_HALF;
  _anim.toHalfH = BOSS_ARENA_HALF;
  _anim.progress = 0;
  _anim.duration = Math.max(0.01, duration);
  _anim.running = true;
}

/** Begin lerping back to full world. Call on wave_end after a boss wave. */
export function restoreArena(duration = 1.0): void {
  _anim.fromHalfW = _bounds.halfW;
  _anim.fromHalfH = _bounds.halfH;
  _anim.toHalfW = _fullHalfW();
  _anim.toHalfH = _fullHalfH();
  _anim.progress = 0;
  _anim.duration = Math.max(0.01, duration);
  _anim.running = true;
}

/** Advance lerp animation. Returns true if bounds changed this tick. */
export function tickArenaBounds(dt: number): boolean {
  if (!_anim.running) return false;
  _anim.progress = Math.min(1, _anim.progress + dt / _anim.duration);
  _bounds.halfW = lerp(_anim.fromHalfW, _anim.toHalfW, _anim.progress);
  _bounds.halfH = lerp(_anim.fromHalfH, _anim.toHalfH, _anim.progress);
  if (_anim.progress >= 1) _anim.running = false;
  return true;
}

/** Returns whether the arena is currently shrunk (smaller than full world). */
export function isArenaShrunk(): boolean {
  return _bounds.halfW < _fullHalfW() * 0.99;
}

export function getArenaBounds(): Readonly<ArenaBounds> {
  return _bounds;
}
