// layerInspect.ts — deep introspection of Pixi container trees.
//
// Existing state dumps only report `α=… ch=…` per container, which says NOTHING
// about whether the contents are actually renderable. A title screen with five
// children at α=1.0 looks identical in the log to one whose children are all
// invisible/empty/off-screen. This module exposes:
//
//   - describeContainer(c)  → one line per direct child: `type pos α vis size text`
//   - layerSnapshot(c)      → full lines including the parent's own summary
//
// The output is intentionally compact — one child per line — so it stays
// readable when written to logs/game.log every state dump.

import type { Container } from 'pixi.js';
import { CFG } from '@core/config';

type AnyPixi = Container & {
  text?: unknown;
  width?: number;
  height?: number;
  position?: { x: number; y: number };
  visible?: boolean;
  alpha?: number;
  texture?: { label?: string } | null;
  label?: string;
};

const MAX_TEXT_PREVIEW = 40;

function _typeName(c: AnyPixi): string {
  // Pixi v8 sets constructor.name reliably even after bundling for most nodes.
  // Fall back to a structural guess so the user sees something useful even when
  // names are minified.
  const ctor = (c as object).constructor?.name;
  if (ctor && ctor !== 'Object') return ctor;
  if (typeof c.text === 'string') return 'Text?';
  if (c.texture) return 'Sprite?';
  return 'Container?';
}

function _previewText(c: AnyPixi): string {
  if (typeof c.text !== 'string') return '';
  const t = c.text.replace(/\n/g, '\\n');
  return t.length > MAX_TEXT_PREVIEW ? `"${t.slice(0, MAX_TEXT_PREVIEW)}…"` : `"${t}"`;
}

export function describeChild(c: AnyPixi, index: number): string {
  const type = _typeName(c);
  const x = Math.round(c.position?.x ?? 0);
  const y = Math.round(c.position?.y ?? 0);
  const w = Math.round(c.width ?? 0);
  const h = Math.round(c.height ?? 0);
  const a = (c.alpha ?? 1).toFixed(2);
  const vis = c.visible === false ? 'F' : 'T';
  const label = c.label ? ` label="${c.label}"` : '';
  const text = _previewText(c);
  // Text nodes in Pixi v8 don't expose `.texture` (they extend Container, not Sprite).
  // Skip the check to avoid false-positive TEX=NULL! reports on every Text.
  const tex = (typeof c.text === 'string')
    ? ''
    : (c.texture === null || c.texture === undefined)
      ? ' TEX=NULL!'
      : (c.texture.label ? ` tex=${c.texture.label}` : '');

  let offScreen = '';
  try {
    const b = (c as Container).getBounds();
    if (b.maxX < 0 || b.minX > CFG.W || b.maxY < 0 || b.minY > CFG.H) {
      offScreen = ' OFF-SCREEN!';
    }
  } catch (_) {}

  return `    [${index}] ${type.padEnd(10)} ${w}x${h}@${x},${y}  α=${a} vis=${vis}${label}${tex}${offScreen} ${text}`.trimEnd();
}

export function layerSnapshot(name: string, c: Container): string[] {
  const lines = [`  ${name}: α=${c.alpha.toFixed(2)}  vis=${c.visible ? 'T' : 'F'}  ch=${c.children.length}`];
  for (let i = 0; i < c.children.length; i++) {
    lines.push(describeChild(c.children[i] as AnyPixi, i));
  }
  return lines;
}

// Walk the parent chain of a container and flag transform anomalies that would
// make all descendants invisible even when their own α/visible look fine.
export function checkAncestorTransforms(c: Container): string[] {
  const warns: string[] = [];
  let node = c.parent as (Container & { label?: string }) | null;
  while (node) {
    const sx = (node.scale?.x ?? 1) as number;
    const sy = (node.scale?.y ?? 1) as number;
    if (!isFinite(sx) || !isFinite(sy) || Math.abs(sx) < 1e-4 || Math.abs(sy) < 1e-4) {
      warns.push(`SCALE_ANOMALY on ancestor "${node.label ?? node.constructor?.name ?? '?'}" scale=(${sx},${sy})`);
    }
    if (Math.abs((node.rotation ?? 0) as number) > 1e-4) {
      warns.push(`ROTATION on ancestor "${node.label ?? node.constructor?.name ?? '?'}" rot=${((node.rotation ?? 0) as number).toFixed(4)}`);
    }
    node = node.parent as typeof node;
  }
  return warns;
}
