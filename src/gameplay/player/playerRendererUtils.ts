// playerRendererUtils.ts — Pure math helpers for player rendering.
// No PixiJS imports — fully testable in Node environment.

/**
 * Converts a player heading (radians, 0 = right) to sprite rotation.
 * Car PNG points UP, so +PI/2 offset aligns the asset with the heading.
 * Always uses heading — never velocity direction. See entities.js:230.
 */
export function computePlayerRotation(heading: number): number {
  return heading + Math.PI / 2;
}
