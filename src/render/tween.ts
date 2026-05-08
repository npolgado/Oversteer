/// <reference types="vite/client" />
// tween.ts — GSAP wrapper for UI animations.
// All UI motion goes through uiTween() so the category can be paused/killed uniformly.

import gsap from 'gsap';
import { PixiPlugin } from 'gsap/PixiPlugin';
import * as PIXI from 'pixi.js';

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
  if (import.meta.env.MODE === 'test') {
    const { duration: _d, delay: _dl, ease: _e, onComplete, yoyo: _y, repeat: _r, ...props } = vars;
    gsap.set(target, props);
    onComplete?.();
    return Promise.resolve();
  }
  return new Promise(resolve => {
    gsap.to(target, { ...vars, onComplete: () => { vars.onComplete?.(); resolve(); } });
  });
}

/** Pause all in-flight UI tweens (call on game pause). */
export function pauseUITweens(): void {
  gsap.globalTimeline.pause();
}

/** Resume all UI tweens (call on game resume). */
export function resumeUITweens(): void {
  gsap.globalTimeline.resume();
}

/** Kill all in-flight tweens on a given target (call before destroying a Container). */
export function killUITweens(target: object): void {
  gsap.killTweensOf(target);
}
