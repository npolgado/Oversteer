// Camera rotation lerp tests.
// Verifies the separate CAMERA_ROTATION_LERP_SPEED formula introduced in Phase 3.
// The camera module uses a singleton state, so we reset it via camera.reset() before each test.

import { describe, it, expect, beforeEach } from 'vitest';
import { camera } from '../camera';
import { CFG } from '@core/config';

function callUpdate(dt: number, heading: number) {
  // Minimal update call: player at center of world, not moving.
  // Only the rotation output is under test here.
  camera.update(dt, CFG.WORLD_W / 2, CFG.WORLD_H / 2, 0, 0, 0, heading);
}

beforeEach(() => {
  camera.reset(CFG.WORLD_W / 2, CFG.WORLD_H / 2);
  // Ensure a known lerp speed for deterministic assertions
  CFG.CAMERA_ROTATION_LERP_SPEED = 1.5;
});

describe('camera rotation lerp — headingUp=false (default)', () => {
  it('rotation stays at 0 regardless of heading when headingUp is off', () => {
    callUpdate(1, Math.PI / 4); // heading = 45°
    expect(camera.state.rotation).toBeCloseTo(0);
  });

  it('rotation stays at 0 with dt=0', () => {
    callUpdate(0, Math.PI);
    expect(camera.state.rotation).toBe(0);
  });
});

describe('camera rotation lerp — headingUp=true', () => {
  beforeEach(() => {
    camera.setHeadingMode(true);
  });

  it('with heading=0, rotation lerps toward -π/2', () => {
    // tRot = 1 - exp(-1.5 * 1) ≈ 0.7769
    // target = -π/2, starting at 0
    // expected rotation = -π/2 * tRot
    const tRot = 1 - Math.exp(-CFG.CAMERA_ROTATION_LERP_SPEED * 1);
    const expected = (-Math.PI / 2) * tRot;
    callUpdate(1, 0);
    expect(camera.state.rotation).toBeCloseTo(expected, 5);
  });

  it('with dt=0, rotation does not change', () => {
    camera.state.rotation = -0.5; // seed a non-zero starting rotation
    callUpdate(0, 0);
    expect(camera.state.rotation).toBeCloseTo(-0.5);
  });

  it('converges fully to -π/2 after a very large dt', () => {
    // After many seconds, rotation should be essentially -π/2
    callUpdate(100, 0);
    expect(camera.state.rotation).toBeCloseTo(-Math.PI / 2, 4);
  });

  it('target rotation accounts for non-zero heading', () => {
    const heading = Math.PI / 4; // 45°
    const tRot = 1 - Math.exp(-CFG.CAMERA_ROTATION_LERP_SPEED * 1);
    const targetRot = -Math.PI / 2 - heading;
    const expected = targetRot * tRot; // starting from 0
    callUpdate(1, heading);
    expect(camera.state.rotation).toBeCloseTo(expected, 5);
  });

  it('rotation uses CAMERA_ROTATION_LERP_SPEED, not the pan/zoom speed=6', () => {
    // The pan/zoom uses speed=6 so tPan = 1-exp(-6) ≈ 0.9975.
    // Rotation uses CAMERA_ROTATION_LERP_SPEED=1.5 so tRot ≈ 0.7769.
    // If rotation were using speed=6 it would be much closer to -π/2 after 1 frame.
    const tRot = 1 - Math.exp(-1.5);
    const expected = (-Math.PI / 2) * tRot;
    const tPan = 1 - Math.exp(-6);
    const wrongExpected = (-Math.PI / 2) * tPan;

    callUpdate(1, 0);

    // Should match CAMERA_ROTATION_LERP_SPEED formula, not pan/zoom formula
    expect(camera.state.rotation).toBeCloseTo(expected, 4);
    expect(Math.abs(camera.state.rotation - wrongExpected)).toBeGreaterThan(0.1);
  });
});

describe('camera clamp — headingUp at world edge', () => {
  it('headingUp=true: camera stays centered on player at world edge (no clamp away from player)', () => {
    // NOTE: not in original — tests Bug 1.4 fix: skip clamp in headingUp mode.
    // Player is at the far-left edge of the world (x = 10).
    // With clamp active, camera would be pushed to CFG.W/2 (~800).
    // With clamp skipped in headingUp mode, camera lerps toward the player position.
    camera.setHeadingMode(true);
    const edgeX = 10;
    const centerY = CFG.WORLD_H / 2;
    // Run many frames so the camera fully converges on the player
    for (let i = 0; i < 200; i++) {
      camera.update(0.016, edgeX, centerY, 0, 0, 0, 0);
    }
    // Camera should be close to the player, NOT pushed to CFG.W/2 by the clamp
    expect(camera.state.x).toBeLessThan(CFG.W / 2);
  });

  it('headingUp=false: clamp is still active at world edge', () => {
    // Sanity check that the clamp still applies when headingUp is off.
    camera.setHeadingMode(false);
    const edgeX = 10;
    const centerY = CFG.WORLD_H / 2;
    for (let i = 0; i < 200; i++) {
      camera.update(0.016, edgeX, centerY, 0, 0, 0, 0);
    }
    // Camera should be clamped to at least CFG.W/2
    expect(camera.state.x).toBeGreaterThanOrEqual(CFG.W / 2);
  });
});
