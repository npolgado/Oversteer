/// <reference types="vite/client" />
// tween.ts — GSAP wrapper for UI animations.
// All UI motion goes through uiTween() so the category can be paused/killed uniformly.

import gsap from 'gsap';
import { PixiPlugin } from 'gsap/PixiPlugin';
import * as PIXI from 'pixi.js';
import { log } from '@debug/logger';

// Disable GSAP lag smoothing — the game has its own dt clamping.
gsap.ticker.lagSmoothing(0);
gsap.registerPlugin(PixiPlugin);
PixiPlugin.registerPIXI(PIXI);

/**
 * Tween a PixiJS Container property (alpha, x, y, etc.).
 * In test mode (MODE=test) the tween is applied instantly via gsap.set so assertions are deterministic.
 * Returns a Promise that resolves when the tween completes (useful for await in async hide/show flows).
 * pauseUITweens/resumeUITweens control all tweens via gsap.globalTimeline.
 */
export function uiTween(
  target: object,
  vars: gsap.TweenVars,
): Promise<void> {
  const label = vars._label as string | undefined;
  const desc = label ?? JSON.stringify(
    Object.fromEntries(
      Object.entries(vars).filter(([k]) => !k.startsWith('on') && k !== '_label')
    )
  );

  if (import.meta.env.MODE === 'test') {
    const { duration: _d, delay: _dl, ease: _e, onComplete, yoyo: _y, repeat: _r, _label: _lb, ...props } = vars;
    gsap.set(target, props);
    onComplete?.();
    return Promise.resolve();
  }

  log('tween', `START ${desc}`);
  return new Promise(resolve => {
    gsap.to(target, {
      ...vars,
      onComplete: () => {
        log('tween', `DONE  ${desc}`);
        vars.onComplete?.();
        resolve();
      },
    });
  });
}

let _timelinePaused = false;

/** Pause all in-flight UI tweens (call on game pause). Idempotent — safe to call redundantly. */
export function pauseUITweens(): void {
  if (_timelinePaused) return;
  _timelinePaused = true;
  log('tween', 'pauseUITweens');
  gsap.globalTimeline.pause();
}

/** Resume all UI tweens (call on game resume / scene destroy). Idempotent — safe to call redundantly. */
export function resumeUITweens(): void {
  if (!_timelinePaused) return;
  _timelinePaused = false;
  log('tween', 'resumeUITweens');
  gsap.globalTimeline.resume();
}

/** Exposed for tests only — resets the pause-tracking flag to initial state. */
export function _resetTweenStateForTest(): void {
  _timelinePaused = false;
}

/** Kill all in-flight tweens on a given target (call before destroying a Container). */
export function killUITweens(target: object): void {
  if (typeof gsap.isTweening === 'function' && gsap.isTweening(target)) {
    log('tween', 'killUITweens (was active)');
  }
  gsap.killTweensOf(target);
}
