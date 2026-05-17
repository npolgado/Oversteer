// textStyles.ts — Centralized Pixi.js TextStyle factory.
// All UI text goes through this to ensure consistent stroke + shadow for readability at any scale.
//
// IMPORTANT: only pass keys that have a defined value. Pixi v8's TextStyle setters
// accept `undefined` as a literal assignment (e.g. `_wordWrapWidth = undefined`),
// which then propagates as NaN through measurement and bounds → text renders 0×0
// and the whole UI silently disappears. Spreading `{ ...opts }` directly into the
// constructor breaks for the same reason. Build the literal explicitly.

import { TextStyle } from 'pixi.js';

interface UIStyleOpts {
  size: number;
  color: string;
  bold?: boolean;
  wordWrap?: boolean;
  wordWrapWidth?: number;
  align?: 'left' | 'center' | 'right';
  letterSpacing?: number;
  dropShadow?: { color: string; blur?: number; distance?: number; alpha?: number };
}

export function makeUIStyle(opts: UIStyleOpts): TextStyle {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg: Record<string, any> = {
    fontFamily: 'Courier New, monospace',
    fontSize: opts.size,
    fontWeight: opts.bold ? 'bold' : 'normal',
    fill: opts.color,
    stroke: { color: '#000000', width: 3 },
    dropShadow: opts.dropShadow ?? { color: '#000', blur: 2, distance: 1 },
  };
  if (opts.wordWrap !== undefined)      cfg.wordWrap      = opts.wordWrap;
  if (opts.wordWrapWidth !== undefined) cfg.wordWrapWidth = opts.wordWrapWidth;
  if (opts.align !== undefined)         cfg.align         = opts.align;
  if (opts.letterSpacing !== undefined) cfg.letterSpacing = opts.letterSpacing;
  return new TextStyle(cfg);
}
